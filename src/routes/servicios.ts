import { Elysia, t } from "elysia";
import { errorResponses, ServicioSchema, toApi } from "../lib/apiSchemas";
import { SERVICIO_CATEGORIAS } from "../models/Servicio";
import { listarServiciosActivos } from "../services/servicios.service";

// Endpoint público: el catálogo de Servicios y el Cotizador consumen esto.
// Solo devuelve servicios activos; ?categoria=Batucadas filtra por categoría.
export const serviciosRoutes = new Elysia().get(
  "/api/servicios",
  async ({ query }) => {
    const items = await listarServiciosActivos(query.categoria);
    return items.map((item) => toApi(ServicioSchema, item));
  },
  {
    query: t.Object({
      // Lista fija tomada del enum del modelo: un valor fuera de ella responde 422.
      // Ojo: t.Union de literales y NO t.UnionEnum: con UnionEnum, Elysia rellena el query
      // ausente con el primer valor ("Batucadas") y la lista sin filtro sale filtrada.
      categoria: t.Optional(
        t.Union(SERVICIO_CATEGORIAS.map((valor) => t.Literal(valor)), {
          description: `Filtra por categoría exacta: ${SERVICIO_CATEGORIAS.join(", ")}. Otro valor responde 422.`,
          examples: ["Batucadas"],
        })
      ),
    }),
    response: { 200: t.Array(ServicioSchema), ...errorResponses(422, 500) },
    detail: {
      tags: ["Público"],
      summary: "Catálogo de servicios activos",
      description:
        "Devuelve los personajes/actos activos (activo = true) ordenados por `orden`. Lo consumen las páginas Servicios y Cotizador. Los servicios desactivados no aparecen.\n\n" +
        "**Parámetro opcional `?categoria=`**: filtra por categoría exacta — `Batucadas`, `Zanqueros` o `Personajes` (ej. `/api/servicios?categoria=Batucadas`). Una categoría que no está en esa lista responde 422.",
    },
  }
);