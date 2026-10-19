import { describe, expect, test } from "bun:test";
import { Elysia, t } from "elysia";
import { errorHandler } from "../../src/lib/errors";
import { CORREO_MAX, NOMBRE_MAX, NOMBRE_MIN, PHONE_REGEX, textoLibre } from "../../src/lib/validation";
import { isEmailValid, isNameValid, isPhoneValid, primerCampoConError } from "../../client/src/lib/validators";
import { mensajeLegible } from "../../client/src/lib/api";

// El formulario (client/src/lib/validators.ts) y la API tienen que aceptar y rechazar lo
// mismo: si el formulario deja pasar algo que la API rechaza, el visitante ve un error del
// servidor en vez del aviso junto al campo. Aquí se pasa cada valor por los dos lados.
const app = new Elysia().use(errorHandler).post("/", () => "ok", {
  body: t.Object({
    nombre: t.Optional(textoLibre(NOMBRE_MAX, { minLength: NOMBRE_MIN })),
    telefono: t.Optional(t.RegExp(PHONE_REGEX)),
    correo: t.Optional(t.String({ format: "email", maxLength: CORREO_MAX })),
  }),
});

async function servidorAcepta(body: Record<string, string>) {
  const res = await app.handle(
    new Request("http://localhost/", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
  );
  return res.status === 200;
}

describe("formulario y API validan igual", () => {
  const telefonos: [string, boolean][] = [
    ["5555-1234", true],
    ["55551234", true],
    ["+502 5555-1234", true],
    ["(502) 5555-1234", true],
    ["+502 (5555) 1234", true],
    ["+1 (555) 123-4567", true],
    ["5555 (1234)", true],
    ["5555.1234", true],
    ["1234567", true],
    ["123456", false],
    ["-------", false],
    ["(((((((", false],
    ["+502 555", false],
    ["5555-1234 ext 2", false],
    ["123456789012345678901", false],
    ["", false],
  ];
  test.each(telefonos)("teléfono %p → %p", async (valor, esperado) => {
    expect(isPhoneValid(valor)).toBe(esperado);
    expect(await servidorAcepta({ telefono: valor })).toBe(esperado);
  });

  const correos: [string, boolean][] = [
    ["ana@example.com", true],
    ["ANA@EXAMPLE.COM", true],
    ["ana+tag@example.co", true],
    ["ana@sub.example.com.gt", true],
    ["josé@example.com", false],
    ["ana@exámple.com", false],
    ["ana..x@example.com", false],
    [".ana@example.com", false],
    ["ana.@example.com", false],
    ["ana@-example.com", false],
    ["ana@example", false],
    ["ana@@example.com", false],
    ["a b@example.com", false],
    [`${"a".repeat(CORREO_MAX)}@example.com`, false],
    ["", false],
  ];
  test.each(correos)("correo %p → %p", async (valor, esperado) => {
    expect(isEmailValid(valor)).toBe(esperado);
    expect(await servidorAcepta({ correo: valor })).toBe(esperado);
  });

  const nombres: [string, boolean][] = [
    ["Ana López", true],
    ["Li", true],
    ["A", false],
    ["", false],
    ["x".repeat(NOMBRE_MAX), true],
    ["x".repeat(NOMBRE_MAX + 1), false],
  ];
  test.each(nombres)("nombre %p → %p", async (valor, esperado) => {
    expect(isNameValid(valor)).toBe(esperado);
    expect(await servidorAcepta({ nombre: valor })).toBe(esperado);
  });
});

describe("mensajeLegible", () => {
  test("traduce los nombres internos de los campos", () => {
    expect(mensajeLegible("Datos inválidos o faltantes: telefono, detalleCotizador.")).toBe(
      "Revisa estos datos e intenta de nuevo: teléfono, personajes seleccionados."
    );
  });

  test("deja igual cualquier otro mensaje", () => {
    expect(mensajeLegible("Selecciona al menos un personaje.")).toBe("Selecciona al menos un personaje.");
  });
});

// Al enviar con errores, Contacto y Cotizador le pasan el foco al primer campo inválido ([12.3]).
describe("primerCampoConError", () => {
  const orden = ["name", "phone", "email"] as const;

  test("devuelve el primero con error según el orden del formulario, no el del objeto", () => {
    expect(primerCampoConError({ email: "x", phone: "y", name: "" }, orden)).toBe("phone");
    expect(primerCampoConError({ name: "x", phone: "y", email: "z" }, orden)).toBe("name");
  });

  test("sin errores devuelve null", () => {
    expect(primerCampoConError({ name: "", phone: "", email: "" }, orden)).toBeNull();
  });
});
