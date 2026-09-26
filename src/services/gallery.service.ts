import { GalleryImage, CATEGORY_LABELS, type GalleryCategory } from "../models/GalleryImage";

export interface CrearImagenInput {
  imageUrl: string;
  publicId: string;
  alt: string;
  label: string;
  category: GalleryCategory;
  order?: number;
}

export interface EditarImagenInput {
  imageUrl?: string;
  publicId?: string;
  alt?: string;
  label?: string;
  category?: GalleryCategory;
  order?: number;
}

export async function listarImagenesGaleria() {
  return await GalleryImage.find().sort({ order: 1, createdAt: 1 });
}

export async function obtenerImagenPorId(id: string) {
  return await GalleryImage.findById(id);
}

export async function crearImagenGaleria(data: CrearImagenInput) {
  return await GalleryImage.create({
    ...data,
    categoryLabel: CATEGORY_LABELS[data.category],
    order: data.order ?? 0,
  });
}

export async function actualizarImagenGaleria(id: string, data: EditarImagenInput) {
  const doc = await GalleryImage.findById(id);
  if (!doc) return null;

  if (data.imageUrl !== undefined) doc.imageUrl = data.imageUrl;
  if (data.publicId !== undefined) doc.publicId = data.publicId;
  if (data.alt !== undefined) doc.alt = data.alt;
  if (data.label !== undefined) doc.label = data.label;
  if (data.category !== undefined) {
    doc.category = data.category;
    doc.categoryLabel = CATEGORY_LABELS[data.category];
  }
  if (data.order !== undefined) doc.order = data.order;

  await doc.save();
  return doc;
}

export async function eliminarImagenGaleria(id: string) {
  const doc = await GalleryImage.findById(id);
  if (!doc) return null;

  await doc.deleteOne();
  return doc;
}