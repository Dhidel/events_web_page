import { afterAll, afterEach, beforeAll, mock } from "bun:test";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { ResendFalso, resendFalso } from "./helpers/resendFalso";

// Bun carga .env también en las pruebas, así que con la RESEND_API_KEY real cada solicitud
// creada mandaría un correo de verdad. Se reemplaza el SDK por uno falso (ver helpers/resendFalso.ts)
// y se usa una key de prueba, para que src/lib/resend.ts cree el cliente.
mock.module("resend", () => ({ Resend: ResendFalso }));
process.env.RESEND_API_KEY = "re_PruebaFalsa_noEsReal123";

// Las pruebas corren contra un MongoDB temporal en memoria, nunca contra Atlas
// (desarrollo/producción). La base se crea al arrancar la suite y se destruye al final.
let mongo: MongoMemoryServer;

// La primera vez, mongodb-memory-server descarga el binario de mongod: puede tardar.
const START_TIMEOUT_MS = 120_000;

beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  // Queda disponible para las pruebas que simulan una caída y necesitan reconectar.
  process.env.TEST_MONGODB_URI = mongo.getUri();
  await mongoose.connect(mongo.getUri(), { dbName: "events_test" });
}, START_TIMEOUT_MS);

// Cada prueba empieza con la base vacía: se borran los documentos que haya creado.
afterEach(async () => {
  resendFalso.reiniciar();
  const collections = await mongoose.connection.db!.collections();
  await Promise.all(collections.map((c) => c.deleteMany({})));
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongo.stop();
});
