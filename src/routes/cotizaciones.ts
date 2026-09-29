import { Elysia, t } from "elysia";
import { SOLICITUD_ORIGENES } from "../models/Solicitud";
import { errorResponses, SolicitudSchema, toApi } from "../lib/apiSchemas";
import { ApiError } from "../lib/errors";
import { crearSolicitud } from "../services/solicitud.service";
import {
  MAX_CANTIDAD_POR_SERVICIO,
  recalcularDetalleCotizador,
  SeleccionInvalidaError,
} from "../services/cotizador.service";

// Teléfono: admite dígitos, +, -, espacios y paréntesis (mínimo 7 caracteres)
const PHONE_REGEX = /^[+]?[(]?[0-9]{1,4}[)]?[-\s./0-9]{6,20}$/;

// Lo que manda el Cotizador. Solo servicioId y cantidad se usan; nombre, subtotal y
// total se aceptan (el frontend los manda) pero el servidor los recalcula con MongoDB.
const DetalleCotizadorBody = t.Object({
  personajes: t.Array(
    t.Object({
      servicioId: t.String({ pattern: "^[a-fA-F0-9]{24}$", description: "Id del servicio en MongoDB." }),
      cantidad: t.Integer({ minimum: 0, maximum: MAX_CANTIDAD_POR_SERVICIO }),
      nombre: t.Optional(t.String({ maxLength: 200 })),
      subtotal: t.Optional(t.Number()),
    }),
    { maxItems: 50 }
  ),
  total: t.Optional(t.Number({ description: "Se ignora: el servidor recalcula el total con los precios reales." })),
});

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
  async ({ body, set }) => {
    const { detalleCotizador, ...datos } = body;

    if (datos.fechaEvento && !esFechaReal(datos.fechaEvento)) {
      throw new ApiError(422, "Datos inválidos o faltantes: fechaEvento.");
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
    body: t.Object({
      nombre: t.String({
        minLength: 2,
        maxLength: 120,
        description: "Nombre del cliente o empresa",
      }),
      telefono: t.RegExp(PHONE_REGEX, {
        description: "Teléfono de contacto válido (7 a 20 dígitos/caracteres válidos)",
      }),
      correo: t.String({
        format: "email",
        maxLength: 150,
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
    }),
    response: { 201: SolicitudSchema, ...errorResponses(400, 422, 500) },
    detail: {
      tags: ["Público"],
      summary: "Enviar una solicitud de cotización",
      description:
        "Guarda una solicitud del formulario de Contacto o del Cotizador con estado \"nuevo\". Valida formato estricto de correo, teléfono y longitudes. Responde 422 si los datos son inválidos.\n\n" +
        "Con `origen: \"cotizador\"`, `detalleCotizador.personajes` es obligatorio (cantidades enteras de 0 a " +
        `${MAX_CANTIDAD_POR_SERVICIO}). El servidor recalcula nombres, subtotales y total con los precios actuales de MongoDB e ignora los que manda el cliente. ` +
        "Responde 422 si un servicio no existe o está inactivo. Con `origen: \"contacto\"` el detalle se descarta.",
    },
  }
);