import { beforeEach, describe, expect, test } from "bun:test";
import { AdminUser } from "../../src/models/AdminUser";
import { validarCredencialesAdmin } from "../../src/services/auth.service";

const EMAIL = "admin@example.com";
const PASSWORD = "clave-de-prueba-123";

describe("validarCredencialesAdmin", () => {
  let adminId: string;

  beforeEach(async () => {
    // El pre-save del modelo guarda la contraseña hasheada con bcrypt.
    const admin = await AdminUser.create({ email: EMAIL, password: PASSWORD, name: "Admin" });
    adminId = admin.id;
  });

  test("devuelve id y email con credenciales correctas", async () => {
    const resultado = await validarCredencialesAdmin(EMAIL, PASSWORD);
    expect(resultado).toEqual({ id: adminId, email: EMAIL });
  });

  test("no expone la contraseña en el resultado", async () => {
    const resultado = await validarCredencialesAdmin(EMAIL, PASSWORD);
    expect(resultado).not.toHaveProperty("password");
  });

  test("devuelve null si la contraseña es incorrecta", async () => {
    expect(await validarCredencialesAdmin(EMAIL, "otra-clave")).toBeNull();
  });

  test("devuelve null si el correo no existe", async () => {
    expect(await validarCredencialesAdmin("nadie@example.com", PASSWORD)).toBeNull();
  });

  test("la contraseña se guarda hasheada, no en texto plano", async () => {
    const guardado = await AdminUser.findOne({ email: EMAIL }).select("+password").lean();
    expect(guardado!.password).not.toBe(PASSWORD);
    expect(guardado!.password).toStartWith("$2");
  });
});
