import { Elysia, t } from "elysia";
import { GalleryImage } from "../models/GalleryImage";
import { errorResponses, GalleryImageSchema, toApi } from "../lib/apiSchemas";

// Endpoint público: la página /galeria del sitio consume esto.
export const galleryRoutes = new Elysia().get(
  "/api/gallery",
  async () => {
    const items = await GalleryImage.find().sort({ order: 1, createdAt: 1 });
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
