import { Elysia, t, type Static } from "elysia";
import { Types } from "mongoose";
import { SOLICITUD_ORIGENES } from "../models/Solicitud";
import { sanitizeText } from "../lib/sanitize";
import { errorResponses, SolicitudSchema, toApi } from "../lib/apiSchemas";
import { ApiError } from "../lib/errors";
import { CORREO_MAX, NOMBRE_MAX, NOMBRE_MIN, PHONE_REGEX, rechazarCamposExtra, textoLibre } from "../lib/validation";
import { limiteCotizaciones, MAX_SOLICITUDES_POR_IP, VENTANA_SOLICITUDES_MS } from "../lib/limiteSolicitudes";
import { crearSolicitud } from "../services/solicitud.service";
import {
  MAX_CANTIDAD_POR_SERVICIO,
  recalcularDetalleCotizador,
  SeleccionInvalidaError,
} from "../services/cotizador.service";

// Lo que manda el Cotizador. Solo servicioId y cantidad se usan; nombre, subtotal y
// total se aceptan (el frontend los manda) pero el servidor los recalcula con MongoDB.
const DetalleCotizadorBody = t.Object(
  {
    personajes: t.Array(
      t.Object(
        {
          servicioId: t.String({ pattern: "^[a-fA-F0-9]{24}$", description: "Id del servicio en MongoDB." }),
          cantidad: t.Integer({ minimum: 0, maximum: MAX_CANTIDAD_POR_SERVICIO }),
          nombre: t.Optional(t.String({ maxLength: 200 })),
          subtotal: t.Optional(t.Number()),
        },
        { additionalProperties: false }
      ),
      { maxItems: 50 }
    ),
    total: t.Optional(t.Number({ description: "Se ignora: el servidor recalcula el total con los precios reales." })),
  },
  { additionalProperties: false }
);

const CotizacionBody = t.Object(
  {
    nombre: textoLibre(NOMBRE_MAX, { minLength: NOMBRE_MIN, description: "Nombre del cliente o empresa" }),
    telefono: t.RegExp(PHONE_REGEX, {
      description: "Teléfono de contacto: 7 a 20 caracteres (dígitos, espacios, +, -, paréntesis o puntos) con al menos 7 dígitos",
    }),
    correo: t.String({
      format: "email",
      maxLength: CORREO_MAX,
      description: "Correo electrónico con formato válido",
    }),
    tipoEvento: t.Optional(
      t.String({
        maxLength: 100,
        description: "Tipo de evento (ej. Boda, Graduación, Cumpleaños)",
      })
    ),
    mensaje: t.Optional(
      t.String({
        maxLength: 2000,
        description: "Mensaje o detalles adicionales",
      })
    ),
    fechaEvento: t.Optional(
      t.String({
        pattern: "^\\d{4}-\\d{2}-\\d{2}$",
        description: 'Fecha estimada del evento, "YYYY-MM-DD" (formulario de Contacto).',
        examples: ["2026-12-05"],
      })
    ),
    origen: t.Union(SOLICITUD_ORIGENES.map((value) => t.Literal(value)), {
      description: '"contacto" (formulario de Contacto) o "cotizador" (botón Confirmar del Cotizador).',
    }),
    detalleCotizador: t.Optional(DetalleCotizadorBody),
    // Honeypot ([14.3]): declarado para que el hook de campos extra no lo rechace.
    sitioWeb: t.Optional(
      t.String({
        maxLength: 200,
        description: "Campo trampa anti-spam (honeypot). Debe ir vacío u omitido; si trae texto el envío se descarta en silencio.",
      })
    ),
  },
  { additionalProperties: false }
);

// Respuesta para un envío que llenó el honeypot: tiene la misma forma que una solicitud
// guardada (id nuevo, estado "nuevo"), para que el bot no note que fue descartado. No se
// guarda nada, no se consulta la base y no se manda correo.
function respuestaHoneypot(datos: Omit<Static<typeof CotizacionBody>, "detalleCotizador" | "sitioWeb">) {
  const id = new Types.ObjectId().toString();
  const ahora = new Date();
  return {
    _id: id,
    id,
    nombre: sanitizeText(datos.nombre),
    telefono: sanitizeText(datos.telefono),
    correo: sanitizeText(datos.correo).toLowerCase(),
    tipoEvento: datos.tipoEvento ? sanitizeText(datos.tipoEvento) : undefined,
    mensaje: datos.mensaje ? sanitizeText(datos.mensaje) : undefined,
    fechaEvento: datos.fechaEvento,
    origen: datos.origen,
    estado: "nuevo" as const,
    createdAt: ahora,
    updatedAt: ahora,
  };
}

// Elysia convierte "2" (texto) a 2 antes de validar, así que t.Integer no lo rechaza.
// Aquí, en `transform`, el body todavía está como llegó: las cantidades tienen que ser números.
function rechazarTiposConvertidos({ body }: { body: unknown }) {
  const detalle = (body as { detalleCotizador?: { personajes?: unknown } } | null)?.detalleCotizador;
  if (!detalle || typeof detalle !== "object") return;
  const personajes = detalle.personajes;
  if (!Array.isArray(personajes)) return;
  if (personajes.some((p) => p !== null && typeof p === "object" && "cantidad" in p && typeof p.cantidad !== "number")) {
    throw new ApiError(422, "Datos inválidos o faltantes: detalleCotizador.");
  }
}

// El patrón del body solo revisa la forma "YYYY-MM-DD"; esto descarta días que no existen
// (2026-02-31). Se arma en UTC para que la zona horaria del servidor no mueva el día.
function esFechaReal(fecha: string): boolean {
  const [y, m, d] = fecha.split("-").map(Number) as [number, number, number];
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}

// Endpoint público: lo usan el formulario de Contacto y el Cotizador al confirmar.
export const cotizacionesRoutes = new Elysia().post(
  "/api/cotizaciones",
  async ({ body, set, request, server }) => {
    // Freno contra spam: máximo de envíos por IP en una ventana de tiempo (429 con Retry-After;
    // ver lib/limiteSolicitudes.ts).
    limiteCotizaciones.verificarYRegistrar({ request, server, set });

    const { detalleCotizador, sitioWeb, ...datos } = body;

    if (datos.fechaEvento && !esFechaReal(datos.fechaEvento)) {
      throw new ApiError(422, "Datos inválidos o faltantes: fechaEvento.");
    }

    // Honeypot: una persona nunca ve ni llena "sitioWeb". Si viene con texto es un bot: se
    // responde como si hubiera funcionado, sin guardar ni notificar. Va después del límite,
    // así un bot insistente igual termina en 429. El log no lleva ningún dato del envío.
    if (sitioWeb?.trim()) {
      console.warn(`[Anti-spam] Envío descartado por honeypot (origen: ${datos.origen}).`);
      set.status = 201;
      return respuestaHoneypot(datos);
    }

    // El detalle solo aplica al Cotizador, y nunca se guarda lo que mandó el cliente:
    // se vuelve a calcular con los precios de MongoDB (un total manipulado se descarta).
    let detalle: Awaited<ReturnType<typeof recalcularDetalleCotizador>> | undefined;
    if (datos.origen === "cotizador") {
      if (!detalleCotizador) throw new ApiError(422, "Datos inválidos o faltantes: detalleCotizador.");
      try {
        detalle = await recalcularDetalleCotizador(detalleCotizador.personajes);
      } catch (error) {
        if (error instanceof SeleccionInvalidaError) throw new ApiError(422, error.message);
        throw error;
      }
    }

    const doc = await crearSolicitud({ ...datos, detalleCotizador: detalle as Record<string, unknown> | undefined });
    set.status = 201;
    return toApi(SolicitudSchema, doc);
  },
  {
    parse: "json",
    body: CotizacionBody,
    transform: [rechazarCamposExtra(CotizacionBody), rechazarTiposConvertidos],
    response: { 201: SolicitudSchema, ...errorResponses(400, 422, 429, 500) },
    detail: {
      tags: ["Público"],
      summary: "Enviar una solicitud de cotización",
      description:
        "Guarda una solicitud del formulario de Contacto o del Cotizador con estado \"nuevo\". Valida formato estricto de correo, teléfono y longitudes. Responde 422 si los datos son inválidos.\n\n" +
        "Con `origen: \"cotizador\"`, `detalleCotizador.personajes` es obligatorio (cantidades enteras de 0 a " +
        `${MAX_CANTIDAD_POR_SERVICIO}). El servidor recalcula nombres, subtotales y total con los precios actuales de MongoDB e ignora los que manda el cliente. ` +
        "Responde 422 si un servicio no existe o está inactivo. Con `origen: \"contacto\"` el detalle se descarta.\n\n" +
        "No se aceptan campos que no estén en el esquema (422 \"Campos no permitidos: ...\").\n\n" +
        `Contra spam y duplicados: más de ${MAX_SOLICITUDES_POR_IP} envíos desde la misma IP en ${VENTANA_SOLICITUDES_MS / 60000} minutos responden 429 ` +
        "(con header `Retry-After` en segundos), y una solicitud idéntica a otra reciente no se guarda de nuevo (devuelve la que ya existe).\n\n" +
        "`sitioWeb` es un campo trampa (honeypot): el formulario lo oculta y debe ir vacío u omitido. Si trae texto, la respuesta es un 201 " +
        "normal pero la solicitud no se guarda ni se notifica.",
    },
  }
);