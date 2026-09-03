import { Elysia, t } from "elysia";
import { Solicitud, SOLICITUD_ORIGENES } from "../models/Solicitud";

// Endpoint público: lo usan el formulario de Contacto y el Cotizador al confirmar.
export const cotizacionesRoutes = new Elysia()
  .onError(({ code, set }) => {
    if (code === "VALIDATION") {
      set.status = 422;
      return { error: "Faltan datos requeridos (nombre, teléfono, correo u origen) o tienen un formato inválido." };
    }
  })
  .post(
    "/api/cotizaciones",
    async ({ body, set }) => {
      const doc = await Solicitud.create({ ...body, estado: "nuevo" });
      set.status = 201;
      return doc.toJSON();
    },
    {
      body: t.Object({
        nombre: t.String({ minLength: 1 }),
        telefono: t.String({ minLength: 1 }),
        correo: t.String({ minLength: 1 }),
        tipoEvento: t.Optional(t.String()),
        mensaje: t.Optional(t.String()),
        origen: t.Union(SOLICITUD_ORIGENES.map((value) => t.Literal(value))),
        detalleCotizador: t.Optional(t.Record(t.String(), t.Unknown())),
      }),
    }
  );
