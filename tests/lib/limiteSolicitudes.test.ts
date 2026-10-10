import { describe, expect, test } from "bun:test";
import { crearLimite, ipDelCliente } from "../../src/lib/limiteSolicitudes";

describe("crearLimite", () => {
  test("deja pasar hasta el máximo y bloquea el siguiente", () => {
    const permitir = crearLimite({ max: 3, ventanaMs: 1000 });
    expect([permitir("a", 0), permitir("a", 1), permitir("a", 2)]).toEqual([true, true, true]);
    expect(permitir("a", 3)).toBe(false);
  });

  test("cada IP tiene su propio contador", () => {
    const permitir = crearLimite({ max: 1, ventanaMs: 1000 });
    expect(permitir("a", 0)).toBe(true);
    expect(permitir("b", 0)).toBe(true);
    expect(permitir("a", 1)).toBe(false);
  });

  test("vuelve a permitir cuando los envíos salen de la ventana", () => {
    const permitir = crearLimite({ max: 2, ventanaMs: 1000 });
    permitir("a", 0);
    permitir("a", 500);
    expect(permitir("a", 900)).toBe(false);
    expect(permitir("a", 1001)).toBe(true); // el de t=0 ya salió
    expect(permitir("a", 1002)).toBe(false);
  });

  test("los intentos bloqueados no alargan el bloqueo", () => {
    const permitir = crearLimite({ max: 1, ventanaMs: 1000 });
    permitir("a", 0);
    expect(permitir("a", 999)).toBe(false);
    expect(permitir("a", 1001)).toBe(true);
  });
});

describe("ipDelCliente", () => {
  const req = (headers: Record<string, string> = {}) => new Request("http://localhost/", { headers });

  test("usa el primer valor de X-Forwarded-For cuando viene", () => {
    expect(ipDelCliente(req({ "x-forwarded-for": "203.0.113.7, 10.0.0.1" }), "10.0.0.1", undefined)).toBe("203.0.113.7");
  });

  test("sin header usa la IP de la conexión", () => {
    expect(ipDelCliente(req(), "198.51.100.4", undefined)).toBe("198.51.100.4");
  });

  test("con CLIENT_IP_HEADER usa ese header", () => {
    const r = req({ "cf-connecting-ip": "203.0.113.9", "x-forwarded-for": "1.1.1.1" });
    expect(ipDelCliente(r, "10.0.0.1", "CF-Connecting-IP")).toBe("203.0.113.9");
  });

  test("devuelve null si no hay forma de saberla", () => {
    expect(ipDelCliente(req(), null, undefined)).toBeNull();
  });
});
