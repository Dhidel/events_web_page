import { Schema, model, type HydratedDocument, type Model } from "mongoose";

export const GALLERY_CATEGORIES = [
  "quinceaneras",
  "bodas",
  "corporativo",
  "navidad",
  "espectaculos",
] as const;

export type GalleryCategory = (typeof GALLERY_CATEGORIES)[number];

// Etiqueta legible que se muestra en el sitio para cada categoría. El cliente solo
// envía la clave (category); la etiqueta se deriva aquí para mantenerlas sincronizadas.
export const CATEGORY_LABELS: Record<GalleryCategory, string> = {
  quinceaneras: "Quinceaños",
  bodas: "Bodas",
  corporativo: "Corporativo",
  navidad: "Navidad",
  espectaculos: "Espectáculos",
};

export interface GalleryImageAttrs {
  imageUrl: string;
  publicId: string;
  alt: string;
  category: GalleryCategory;
  categoryLabel: string;
  label: string;
  order: number;
}

export type GalleryImageDocument = HydratedDocument<GalleryImageAttrs>;
type GalleryImageModel = Model<GalleryImageAttrs>;

const galleryImageSchema = new Schema<GalleryImageAttrs, GalleryImageModel>(
  {
    imageUrl: { type: String, required: true },
    // public_id de Cloudinary: se guarda para poder borrar/reemplazar la imagen.
    publicId: { type: String, required: true },
    alt: { type: String, required: true, trim: true },
    category: { type: String, required: true, enum: GALLERY_CATEGORIES },
    categoryLabel: { type: String, required: true, trim: true },
    label: { type: String, required: true, trim: true },
    order: { type: Number, default: 0 },
  },
  { timestamps: true }
);

// `virtuals: true` incluye el getter `id` (string de _id) que espera el frontend.
galleryImageSchema.set("toJSON", { virtuals: true, versionKey: false });

export const GalleryImage = model<GalleryImageAttrs, GalleryImageModel>(
  "GalleryImage",
  galleryImageSchema
);
