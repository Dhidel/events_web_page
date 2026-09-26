import mongoose from "mongoose";
import { connectDB } from "../db";
import { Solicitud } from "../models/Solicitud";

async function main() {
  console.log("Conectando a la base de datos...");
  await connectDB();

  console.log("Creando y sincronizando índices...");
  // syncIndexes() aplica los índices declarados en el schema en MongoDB
  await Solicitud.syncIndexes();

  const indexes = await Solicitud.collection.indexes();
  console.log("Índices actuales en la colección 'solicituds':");
  console.log(indexes.map((idx) => idx.name));

  await mongoose.disconnect();
  console.log("Base de datos inicializada correctamente.");
}

main().catch((err) => {
  console.error("Error al inicializar la base de datos:", err);
  process.exit(1);
});