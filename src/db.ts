import mongoose from "mongoose";
import { safeErrorLog } from "./lib/privacy";

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  throw new Error(
    "Falta la variable de entorno MONGODB_URI. Definila en tu archivo .env (ver .env.example)."
  );
}

// Tiempo máximo para encontrar el cluster al arrancar (el default de Mongo es 30 s).
const SERVER_SELECTION_TIMEOUT_MS = 10_000;

// Solo después de la primera conexión tiene sentido hablar de "conexión perdida";
// si el arranque falla, connectDB ya explica el problema.
let hasConnected = false;

mongoose.connection.on("connected", () => {
  hasConnected = true;
  console.log("MongoDB: conectado");
});

mongoose.connection.on("error", (error) => {
  if (!hasConnected) return;
  // El error puede incluir la URI de conexión con usuario y contraseña: se loguea enmascarado.
  console.error(`MongoDB: error de conexión: ${safeErrorLog(error)}`);
});

mongoose.connection.on("disconnected", () => {
  if (!hasConnected) return;
  console.warn("MongoDB: conexión perdida, Mongoose intentará reconectar automáticamente...");
});

// Si no se puede conectar al arrancar, el servidor no sirve de nada (todas las rutas
// usan la base): se explica la causa más probable y se sale con código 1.
export async function connectDB() {
  try {
    await mongoose.connect(MONGODB_URI as string, { serverSelectionTimeoutMS: SERVER_SELECTION_TIMEOUT_MS });
  } catch (error) {
    const name = error instanceof Error ? error.name : "";
    const message = error instanceof Error ? error.message : String(error);
    console.error(`\nMongoDB: no se pudo conectar (${name || "error"}).`);

    if (name === "MongooseServerSelectionError") {
      console.error(
        [
          "Causa más común: tu IP no está permitida en MongoDB Atlas.",
          "  1. Atlas → Security → Network Access → Add IP Address → \"Add Current IP Address\".",
          "  2. Espera ~1 minuto a que quede \"Active\" y vuelve a correr el servidor.",
          "Si ya está agregada: tu red (oficina/universidad) puede bloquear el puerto 27017;",
          "prueba desde otra red (p. ej. el hotspot del celular).",
        ].join("\n")
      );
    } else if (/auth/i.test(name) || /auth/i.test(message)) {
      console.error("Usuario o contraseña de MONGODB_URI incorrectos (Atlas → Database Access).");
    } else if (/ENOTFOUND|querySrv/i.test(message)) {
      console.error("No se encontró el cluster: revisa el host de MONGODB_URI o tu conexión a internet.");
    }

    console.error(`Detalle: ${safeErrorLog(error).split("\n")[0]}\n`);
    process.exit(1);
  }
}
