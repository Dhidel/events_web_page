import { describe, expect, test } from "bun:test";
import {
  claveDeIp,
  crearLimite,
  describirConfiguracionIp,
  esIpInterna,
  ipDelCliente,
  leerTrustProxyHops,
} from "../../src/lib/limiteSolicitudes";

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

  // [14.3] Antes se usaba el PRIMER valor de X-Forwarded-For, que escribe el propio visitante
  // (falsificable). Ahora se cuenta desde el final según TRUST_PROXY_HOPS (ver abajo).
  test("con TRUST_PROXY_HOPS toma la entrada que agregó el proxy, contando desde el final", () => {
    const r = req({ "x-forwarded-for": "203.0.113.7, 10.0.0.1" });
    expect(ipDelCliente(r, "10.0.0.2", undefined, 2)).toBe("203.0.113.7");
    expect(ipDelCliente(r, "10.0.0.2", undefined, 1)).toBe("10.0.0.1");
  });

  test("con TRUST_PROXY_HOPS=0 (por defecto) X-Forwarded-For se ignora", () => {
    expect(ipDelCliente(req({ "x-forwarded-for": "203.0.113.7" }), "198.51.100.4", undefined, 0)).toBe("198.51.100.4");
  });

  test("lo que el visitante escribe a la izquierda no cambia la IP", () => {
    const r = req({ "x-forwarded-for": "1.1.1.1, 2.2.2.2, 203.0.113.7" });
    expect(ipDelCliente(r, "10.0.0.2", undefined, 1)).toBe("203.0.113.7");
  });

  test.each([
    ["sin header", {}],
    ["menos entradas que los saltos", { "x-forwarded-for": "203.0.113.7" }],
    ["entrada que no es una IP", { "x-forwarded-for": "hola, tampoco" }],
  ])("cae a la IP de la conexión: %s", (_caso, headers) => {
    expect(ipDelCliente(req(headers as Record<string, string>), "198.51.100.4", undefined, 2)).toBe("198.51.100.4");
  });

  test("sin header usa la IP de la conexión", () => {
    expect(ipDelCliente(req(), "198.51.100.4", undefined, 0)).toBe("198.51.100.4");
  });

  test("con CLIENT_IP_HEADER usa ese header (tiene prioridad sobre TRUST_PROXY_HOPS)", () => {
    const r = req({ "cf-connecting-ip": "203.0.113.9", "x-forwarded-for": "1.1.1.1" });
    expect(ipDelCliente(r, "10.0.0.1", "CF-Connecting-IP", 1)).toBe("203.0.113.9");
  });

  test("CLIENT_IP_HEADER ausente o inválido: cae a la IP de la conexión (no a X-Forwarded-For)", () => {
    expect(ipDelCliente(req({ "x-forwarded-for": "1.1.1.1" }), "198.51.100.4", "x-real-ip", 1)).toBe("198.51.100.4");
    expect(ipDelCliente(req({ "x-real-ip": "no-es-ip" }), "198.51.100.4", "x-real-ip", 0)).toBe("198.51.100.4");
  });

  test("limpia puertos y corchetes", () => {
    expect(ipDelCliente(req({ "x-forwarded-for": "203.0.113.7:5678" }), null, undefined, 1)).toBe("203.0.113.7");
    expect(ipDelCliente(req({ "x-forwarded-for": "[2001:db8::1]:443" }), null, undefined, 1)).toBe("2001:db8::1");
  });

  test("devuelve null si no hay forma de saberla", () => {
    expect(ipDelCliente(req(), null, undefined, 0)).toBeNull();
  });
});

// ---------------------------------------------------------------------------------------
// [14.3] Lo agregado al módulo del compañero.

describe("crearLimite: esperaSegundos (para Retry-After) y reiniciar", () => {
  test("0 mientras hay cupo; después, lo que falta para que vence el envío más viejo", () => {
    const permitir = crearLimite({ max: 2, ventanaMs: 600_000 });
    expect(permitir.esperaSegundos("a", 0)).toBe(0);
    permitir("a", 0);
    permitir("a", 120_000);
    expect(permitir.esperaSegundos("a", 120_000)).toBe(480); // el de t=0 vence a los 600 s
    expect(permitir.esperaSegundos("a", 599_500)).toBe(1); // nunca 0 si sigue bloqueado
    expect(permitir.esperaSegundos("a", 600_001)).toBe(0);
  });

  test("no registra nada: consultar no gasta cupo", () => {
    const permitir = crearLimite({ max: 1, ventanaMs: 1000 });
    for (let i = 0; i < 10; i++) permitir.esperaSegundos("a", 0);
    expect(permitir("a", 0)).toBe(true);
  });

  test("reiniciar vacía los contadores", () => {
    const permitir = crearLimite({ max: 1, ventanaMs: 1000 });
    permitir("a", 0);
    expect(permitir("a", 1)).toBe(false);
    permitir.reiniciar();
    expect(permitir("a", 2)).toBe(true);
  });
});

describe("claveDeIp", () => {
  test("IPv4 queda igual", () => expect(claveDeIp("198.51.100.7")).toBe("198.51.100.7"));
  test("IPv4 mapeada en IPv6 cuenta como la IPv4", () => expect(claveDeIp("::ffff:198.51.100.7")).toBe("198.51.100.7"));
  test("IPv6: todo el /64 comparte clave; otro /64 es otra", () => {
    const a = claveDeIp("2001:db8:aaaa:1::1");
    expect(a).toBe("2001:0db8:aaaa:0001::/64");
    expect(claveDeIp("2001:db8:aaaa:1:ffff:ffff:ffff:ffff")).toBe(a);
    expect(claveDeIp("2001:db8:aaaa:2::1")).not.toBe(a);
  });
});

describe("esIpInterna (delata que se está viendo la IP del proxy)", () => {
  test.each(["10.0.0.5", "172.16.3.1", "192.168.1.10", "127.0.0.1", "100.64.0.1", "::1", "fd00::1", "fe80::1"])("%s es interna", (ip) => {
    expect(esIpInterna(ip)).toBe(true);
  });
  test.each(["198.51.100.7", "190.56.12.3", "172.32.0.1", "2001:db8::1"])("%s es pública", (ip) => {
    expect(esIpInterna(ip)).toBe(false);
  });
});

describe("configuración de la IP", () => {
  const log = { warn: () => {} };
  test.each([
    [undefined, 0],
    ["", 0],
    ["1", 1],
    ["2", 2],
    ["-1", 0],
    ["uno", 0],
    ["1.5", 0],
  ])("TRUST_PROXY_HOPS=%p → %p", (valor, esperado) => {
    expect(leerTrustProxyHops(valor, log)).toBe(esperado);
  });

  test("sin CLIENT_IP_HEADER ni TRUST_PROXY_HOPS: lo marca como advertencia y dice cómo arreglarlo", () => {
    const r = describirConfiguracionIp({ header: "", hops: 0 });
    expect(r.advertencia).toBe(true);
    expect(r.texto).toContain("TODOS los visitantes compartirán el límite");
    expect(r.texto).toContain("TRUST_PROXY_HOPS=1");
  });

  test("con TRUST_PROXY_HOPS o CLIENT_IP_HEADER no hay advertencia", () => {
    expect(describirConfiguracionIp({ header: "", hops: 1 }).advertencia).toBe(false);
    expect(describirConfiguracionIp({ header: "cf-connecting-ip", hops: 0 }).advertencia).toBe(false);
  });
});
