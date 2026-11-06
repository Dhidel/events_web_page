import { describe, expect, test } from "bun:test";
import { Elysia } from "elysia";
import { Types } from "mongoose";
import { errorHandler } from "../../src/lib/errors";
import { AdminUser } from "../../src/models/AdminUser";
import { SESION_HORAS } from "../../src/plugins/jwt";
import { adminCotizacionesRoutes } from "../../src/routes/adminCotizaciones";
import { authRoutes } from "../../src/routes/auth";
import { revocarSesionesAdmin } from "../../src/services/auth.service";
import { firmarToken } from "../helpers/adminDePrueba";

// Sesiones del panel: un token con firma válida no alcanza; el admin tiene que existir y el
// token tiene que ser de su versión de sesión actual (adminGuard + sesionAdminVigente).

const app = new Elysia().use(errorHandler).use(authRoutes).use(adminCotizacionesRoutes);

const EMAIL = "admin@example.com";
const PASSWORD = "clave-correcta-123";

async function login(): Promise<string> {
  const res = await app.handle(
    new Request("http://localhost/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
    })
  );
  expect(res.status).toBe(200);
  return ((await res.json()) as { token: string }).token;
}

const listar = (token: string) =>
  app.handle(new Request("http://localhost/api/admin/cotizaciones", { headers: { Authorization: `Bearer ${token}` } }));

const crearAdmin = () => AdminUser.create({ email: EMAIL, password: PASSWORD, name: "Admin" });

describe("sesión del panel admin", () => {
  test(`el token del login sirve y vence en ${SESION_HORAS} horas`, async () => {
    await crearAdmin();
    const token = await login();
    expect((await listar(token)).status).toBe(200);

    const { iat, exp } = JSON.parse(atob(token.split(".")[1]!)) as { iat: number; exp: number };
    expect(exp - iat).toBe(SESION_HORAS * 3600);
  });

  test("si se borra el admin, su token deja de servir al instante", async () => {
    const admin = await crearAdmin();
    const token = await login();
    await admin.deleteOne();

    const res = await listar(token);
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "No autorizado." });
  });

  test("revocar-sesiones invalida los tokens emitidos; un login nuevo vuelve a funcionar", async () => {
    await crearAdmin();
    const viejo = await login();

    expect(await revocarSesionesAdmin(` ${EMAIL.toUpperCase()} `)).toBe(true);
    expect((await listar(viejo)).status).toBe(401);
    expect((await listar(await login())).status).toBe(200);
  });

  test("revocar-sesiones con un correo que no existe devuelve false", async () => {
    expect(await revocarSesionesAdmin("nadie@example.com")).toBe(false);
  });

  test("tokens con firma válida pero mal formados se rechazan", async () => {
    const admin = await crearAdmin();
    const sinVersion = await firmarToken({ id: admin.id, email: EMAIL }); // formato anterior a este cambio
    const idInventado = await firmarToken({ id: "admin", email: EMAIL, v: 0 });
    const idInexistente = await firmarToken({ id: new Types.ObjectId().toString(), email: EMAIL, v: 0 });
    const versionVieja = await firmarToken({ id: admin.id, email: EMAIL, v: -1 });

    for (const token of [sinVersion, idInventado, idInexistente, versionVieja]) {
      expect((await listar(token)).status).toBe(401);
    }
  });

  test("un admin creado antes de versionSesion (sin el campo en la base) puede iniciar sesión", async () => {
    const admin = await crearAdmin();
    await AdminUser.collection.updateOne({ _id: admin._id }, { $unset: { versionSesion: "" } });

    expect((await listar(await login())).status).toBe(200);
  });
});
