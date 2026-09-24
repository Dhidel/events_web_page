import { Elysia, t } from "elysia";
import { Solicitud, SOLICITUD_ORIGENES } from "../models/Solicitud";
import { errorResponses, SolicitudSchema, toApi } from "../lib/apiSchemas";
import { maskContact } from "../lib/privacy";

// Endpoint público: lo usan el formulario de Contacto y el Cotizador al confirmar.
export const cotizacionesRoutes = new Elysia()
  .post(
    "/api/cotizaciones",
    async ({ body, set }) => {
      const doc = await Solicitud.create({ ...body, estado: "nuevo" });
      set.status = 201;
      // Respuesta pública: correo y teléfono enmascarados (solo los últimos 4 caracteres).
      // El dato completo queda guardado en la base y solo lo ve el panel admin.
      return maskContact(toApi(SolicitudSchema, doc));
    },
    {
      parse: "json",
      body: t.Object({
        nombre: t.String({ minLength: 1 }),
        telefono: t.String({ minLength: 1 }),
        correo: t.String({ minLength: 1 }),
        tipoEvento: t.Optional(t.String()),
        mensaje: t.Optional(t.String()),
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
          "Guarda una solicitud del formulario de Contacto o del Cotizador con estado \"nuevo\". Aparece en el panel admin (/api/admin/cotizaciones). Responde 422 si falta nombre, teléfono, correo u origen. En la respuesta, correo y teléfono vienen enmascarados (p. ej. \"****1234\").",
      },
    }
  );
