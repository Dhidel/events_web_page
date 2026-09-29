import { Elysia, t } from "elysia";
import { SOLICITUD_ORIGENES } from "../models/Solicitud";
import { errorResponses, SolicitudSchema, toApi } from "../lib/apiSchemas";
import { crearSolicitud } from "../services/solicitud.service";

// Teléfono: admite dígitos, +, -, espacios y paréntesis (mínimo 7 caracteres)
const PHONE_REGEX = /^[+]?[(]?[0-9]{1,4}[)]?[-\s./0-9]{6,20}$/;

// Endpoint público: lo usan el formulario de Contacto y el Cotizador al confirmar.
export const cotizacionesRoutes = new Elysia().post(
  "/api/cotizaciones",
  async ({ body, set }) => {
    const doc = await crearSolicitud(body);
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
      origen: t.Union(SOLICITUD_ORIGENES.map((value) => t.Literal(value)), {
        description: '"contacto" (formulario de Contacto) o "cotizador" (botón Confirmar del Cotizador).',
      }),
      detalleCotizador: t.Optional(t.Record(t.String(), t.Unknown())),
    }),
    response: { 201: SolicitudSchema, ...errorResponses(400, 422, 500) },
    detail: {
      tags: ["Público"],
      summary: "Enviar una solicitud de cotización",
      description:
        "Guarda una solicitud del formulario de Contacto o del Cotizador con estado \"nuevo\". Valida formato estricto de correo, teléfono y longitudes. Responde 422 si los datos son inválidos.",
    },
  }
);