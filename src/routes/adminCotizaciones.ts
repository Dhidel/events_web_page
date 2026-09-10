import { Elysia, t } from "elysia";
import { adminGuard } from "../middleware/adminGuard";
import { Solicitud, SOLICITUD_ESTADOS } from "../models/Solicitud";

const estadoSchema = t.Union(SOLICITUD_ESTADOS.map((value) => t.Literal(value)));

// Todas las rutas pasan por adminGuard (requiere JWT válido en Authorization: Bearer).
export const adminCotizacionesRoutes = new Elysia({ prefix: "/api/admin/cotizaciones" })
  .use(adminGuard)
  .onError(({ error, code, set }) => {
    if (code === "VALIDATION") set.status = 422;
    else if (!set.status || set.status === 200) set.status = 500;
    return { error: error instanceof Error ? error.message : "Error interno del servidor." };
  })
  .get(
    "/",
    async ({ query }) => {
      const filter = query.estado ? { estado: query.estado } : {};
      const items = await Solicitud.find(filter).sort({ createdAt: -1 });
      return items.map((item) => item.toJSON());
    },
    {
      query: t.Object({
        estado: t.Optional(estadoSchema),
      }),
    }
  )
  .patch(
    "/:id",
    async ({ params, body, set }) => {
      const doc = await Solicitud.findById(params.id);
      if (!doc) {
        set.status = 404;
        return { error: "Solicitud no encontrada." };
      }

      doc.estado = body.estado;
      await doc.save();
      return doc.toJSON();
    },
    {
      body: t.Object({
        estado: estadoSchema,
      }),
    }
  );
