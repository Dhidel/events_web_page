import mongoose from "mongoose";
import { connectDB } from "../db";
import { AdminUser } from "../models/AdminUser";
import { GalleryImage } from "../models/GalleryImage";
import { Servicio } from "../models/Servicio";
import { Solicitud } from "../models/Solicitud";

const MODELS = [Solicitud, GalleryImage, Servicio, AdminUser];

async function main() {
  console.log("Conectando a la base de datos...");
  await connectDB();

  console.log("Creando y sincronizando índices...");
  for (const model of MODELS) {
    // syncIndexes() aplica los índices declarados en el schema en MongoDB
    // (y borra los que ya no están declarados, salvo _id).
    await model.syncIndexes();

    const indexes = await model.collection.indexes();
    console.log(`Índices en '${model.collection.collectionName}':`);
    console.log(indexes.map((idx) => `  ${idx.name}${idx.unique ? " (único)" : ""}`).join("\n"));
  }

  await mongoose.disconnect();
  console.log("Base de datos inicializada correctamente.");
}

main().catch((err) => {
  console.error("Error al inicializar la base de datos:", err);
  process.exit(1);
});
