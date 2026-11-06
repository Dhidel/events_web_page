import { Elysia } from "elysia";
import { Types } from "mongoose";
import { AdminUser } from "../../src/models/AdminUser";
import { authJwt } from "../../src/plugins/jwt";
import { payloadDeSesion } from "../../src/services/auth.service";

// adminGuard exige que el admin del token exista en la base con la misma versionSesion. Cada
// prueba empieza con la base vacía (tests/setup.ts), así que las pruebas de rutas admin llaman
// a asegurarAdminDePrueba() en un beforeEach.
export const ADMIN_PRUEBA = { id: new Types.ObjectId().toString(), email: "admin-de-prueba@example.com", versionSesion: 0 };

export async function asegurarAdminDePrueba() {
  // Directo a la colección: la contraseña no se usa y así no se paga el hash de bcrypt.
  await AdminUser.collection.updateOne(
    { _id: new Types.ObjectId(ADMIN_PRUEBA.id) },
    { $setOnInsert: { email: ADMIN_PRUEBA.email, name: "Admin de prueba", password: "no-se-usa", versionSesion: 0 } },
    { upsert: true }
  );
}

// Firma un token con el mismo secreto que el servidor (sirve para armar tokens a mano).
export function firmarToken(payload: Record<string, string | number>): Promise<string> {
  return new Elysia()
    .use(authJwt)
    .get("/t", ({ jwt }) => jwt.sign(payload))
    .handle(new Request("http://localhost/t"))
    .then((r) => r.text());
}

export const tokenDeAdminDePrueba = () => firmarToken(payloadDeSesion(ADMIN_PRUEBA));
