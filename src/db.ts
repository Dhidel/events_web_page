import mongoose from "mongoose";

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  throw new Error(
    "Falta la variable de entorno MONGODB_URI. Definila en tu archivo .env (ver .env.example)."
  );
}

mongoose.connection.on("connected", () => {
  console.log("MongoDB: conectado");
});

mongoose.connection.on("error", (error) => {
  console.error("MongoDB: error de conexión:", error);
});

mongoose.connection.on("disconnected", () => {
  console.warn("MongoDB: conexión perdida, Mongoose intentará reconectar automáticamente...");
});

export async function connectDB() {
  await mongoose.connect(MONGODB_URI as string);
}
