import { Elysia, t } from "elysia";
import { adminGuard } from "../middleware/adminGuard";
import { Solicitud, SOLICITUD_ESTADOS } from "../models/Solicitud";
import { adminDetail, errorResponses, IdParams, SolicitudSchema, toApi } from "../lib/apiSchemas";
import { ApiError } from "../lib/errors";

const estadoSchema = t.Union(SOLICITUD_ESTADOS.map((value) => t.Literal(value)));

// Todas las rutas pasan por adminGuard (requiere JWT válido en Authorization: Bearer).
export const adminCotizacionesRoutes = new Elysia({ prefix: "/api/admin/cotizaciones" })
  .use(adminGuard)
  .get(
    "/",
    async ({ query }) => {
      const filter = query.estado ? { estado: query.estado } : {};
      const items = await Solicitud.find(filter).sort({ createdAt: -1 });
      return items.map((item) => toApi(SolicitudSchema, item));
    },
    {
      query: t.Object({
        estado: t.Optional(estadoSchema),
      }),
      response: { 200: t.Array(SolicitudSchema), ...errorResponses(401, 422, 500) },
      detail: {
        ...adminDetail,
        summary: "Listar solicitudes de cotización",
        description:
          "Devuelve las solicitudes de Contacto y Cotizador, las más recientes primero. ?estado= filtra por estado (nuevo, contactado, propuesta_enviada, confirmado).",
      },
    }
  )
  .patch(
    "/:id",
    async ({ params, body }) => {
      const doc = await Solicitud.findById(params.id);
      if (!doc) throw new ApiError(404, "Solicitud no encontrada.");

      doc.estado = body.estado;
      await doc.save();
      return toApi(SolicitudSchema, doc);
    },
    {
      params: IdParams,
      parse: "json",
      body: t.Object({
        estado: estadoSchema,
      }),
      response: { 200: SolicitudSchema, ...errorResponses(400, 401, 404, 422, 500) },
      detail: {
        ...adminDetail,
        summary: "Cambiar el estado de una solicitud",
        description: "Actualiza el estado de seguimiento de una solicitud (p. ej. de \"nuevo\" a \"contactado\").",
      },
    }
  );
