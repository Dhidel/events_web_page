import { afterAll, afterEach, beforeAll } from "bun:test";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";

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
  const collections = await mongoose.connection.db!.collections();
  await Promise.all(collections.map((c) => c.deleteMany({})));
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongo.stop();
});
