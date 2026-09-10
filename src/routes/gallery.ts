import { Elysia } from "elysia";
import { GalleryImage } from "../models/GalleryImage";

// Endpoint público: la página /galeria del sitio consume esto.
export const galleryRoutes = new Elysia().get("/api/gallery", async () => {
  const items = await GalleryImage.find().sort({ order: 1, createdAt: 1 });
  return items.map((item) => item.toJSON());
});
