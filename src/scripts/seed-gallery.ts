import mongoose from "mongoose";
import { connectDB } from "../db";
import {
  GalleryImage,
  CATEGORY_LABELS,
  type GalleryCategory,
} from "../models/GalleryImage";
import { uploadImage } from "../lib/cloudinary";

// Las 10 fotos que hoy están hardcodeadas en client/src/data/gallery.ts.
// Este script las sube a Cloudinary y las inserta en Mongo para que el panel
// admin tenga contenido inicial que editar. Correr con: bun run seed-gallery
// (agrega --force para vaciar la galería y volver a subirlas).
const SEED: { file: string; alt: string; category: GalleryCategory; label: string }[] = [
  { file: "quince-vivo.jpg", alt: "Quinceañera con personajes en vivo", category: "quinceaneras", label: "Producción de fantasía con personajes dorados" },
  { file: "quince-alicia.jpg", alt: "Producción temática de Alicia en el País de las Maravillas", category: "quinceaneras", label: "Producción temática · Alicia en el País de las Maravillas" },
  { file: "bodas-anillos-color.jpg", alt: "Anillos de bodas a color", category: "bodas", label: "Elegancia de época en cada detalle" },
  { file: "bodas-anillos-bn.jpg", alt: "Manos de novios con anillos en blanco y negro", category: "bodas", label: "Bienvenida con estilo para los invitados" },
  { file: "corporativo.jpg", alt: "Bailarinas con vestuario de lámpara/candelabro", category: "corporativo", label: "Ambientación de gala para evento empresarial" },
  { file: "navidad.jpg", alt: "Personajes navideños en centro comercial", category: "navidad", label: "Elfos y personajes navideños en escena" },
  { file: "espectaculos-robots.jpg", alt: "Personajes de mascarón para espectáculo", category: "espectaculos", label: "Escuadrón de robots LED" },
  { file: "carnaval-plumas.jpg", alt: "Bailarina de carnaval con tocado de plumas", category: "espectaculos", label: "Personajes en zancos, temática circense" },
  { file: "ave-tematico.jpg", alt: "Personaje con traje temático de ave", category: "espectaculos", label: "Personajes en zancos, temática dorada" },
  { file: "animacion-evento.jpg", alt: "Bailarinas con vestuario de animación en evento", category: "espectaculos", label: "Cabezones de personajes urbanos" },
];

async function main() {
  await connectDB();

  const existing = await GalleryImage.estimatedDocumentCount();
  const force = process.argv.includes("--force");

  if (existing > 0 && !force) {
    console.log(
      `La galería ya tiene ${existing} imágenes. No se hace nada. Usá "--force" para vaciarla y recrearla.`
    );
    await mongoose.disconnect();
    process.exit(0);
  }

  if (force && existing > 0) {
    await GalleryImage.deleteMany({});
    console.log(`Galería vaciada (${existing} imágenes eliminadas por --force).`);
  }

  const imgDir = new URL("../../client/src/assets/img/", import.meta.url);

  let order = 0;
  for (const item of SEED) {
    const file = Bun.file(new URL(item.file, imgDir));
    const buffer = await file.arrayBuffer();
    const upload = await uploadImage(
      new File([buffer], item.file, { type: file.type || "image/jpeg" })
    );

    await GalleryImage.create({
      imageUrl: upload.url,
      publicId: upload.publicId,
      alt: item.alt,
      label: item.label,
      category: item.category,
      categoryLabel: CATEGORY_LABELS[item.category],
      order: order++,
    });

    console.log(`✓ ${item.file} → ${upload.url}`);
  }

  console.log(`\nListo: ${SEED.length} imágenes subidas e insertadas.`);
  await mongoose.disconnect();
  process.exit(0);
}

main();
