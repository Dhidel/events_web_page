import { Elysia, t } from "elysia";
import { errorResponses, GalleryImageSchema, toApi } from "../lib/apiSchemas";
import { listarImagenesGaleria } from "../services/gallery.service";

// Endpoint público: la página /galeria del sitio consume esto.
export const galleryRoutes = new Elysia().get(
  "/api/gallery",
  async () => {
    const items = await listarImagenesGaleria();
    return items.map((item) => toApi(GalleryImageSchema, item));
  },
  {
    response: { 200: t.Array(GalleryImageSchema), ...errorResponses(500) },
    detail: {
      tags: ["Público"],
      summary: "Fotos de la galería",
      description:
        "Devuelve todas las fotos de la galería ordenadas por `order`. El filtrado por categoría lo hace el frontend (página /galeria).",
    },
  }
);