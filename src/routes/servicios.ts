import { Elysia, t } from "elysia";
import { Servicio } from "../models/Servicio";
import { errorResponses, ServicioSchema, toApi } from "../lib/apiSchemas";

// Endpoint público: el catálogo de Servicios y el Cotizador consumen esto.
// Solo devuelve servicios activos; ?categoria=Batucadas filtra por categoría.
export const serviciosRoutes = new Elysia().get(
  "/api/servicios",
  async ({ query }) => {
    const filtro: Record<string, unknown> = { activo: true };
    if (query.categoria) filtro.categoria = query.categoria;

    const items = await Servicio.find(filtro).sort({ orden: 1, createdAt: 1 });
    return items.map((item) => toApi(ServicioSchema, item));
  },
  {
    query: t.Object({
      categoria: t.Optional(
        t.String({
          description: 'Filtra por categoría exacta: "Batucadas", "Zanqueros" o "Personajes". Una categoría inexistente devuelve [].',
          examples: ["Batucadas"],
        })
      ),
    }),
    response: { 200: t.Array(ServicioSchema), ...errorResponses(500) },
    detail: {
      tags: ["Público"],
      summary: "Catálogo de servicios activos",
      description:
        "Devuelve los personajes/actos activos (activo = true) ordenados por `orden`. Lo consumen las páginas Servicios y Cotizador. Los servicios desactivados no aparecen.\n\n" +
        "**Parámetro opcional `?categoria=`**: filtra por categoría exacta — `Batucadas`, `Zanqueros` o `Personajes` (ej. `/api/servicios?categoria=Batucadas`). Una categoría inexistente devuelve `[]`.",
    },
  }
);
