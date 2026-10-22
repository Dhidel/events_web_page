import { describe, expect, mock, test } from "bun:test";
import { Elysia } from "elysia";
import { errorHandler } from "../../src/lib/errors";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { servirFrontend } from "../../src/lib/frontend";
import { CSP, DEV_ORIGIN, HEADERS_SEGURIDAD, HSTS, origenesPermitidos, seguridadHttp } from "../../src/lib/seguridadHttp";

// [14.2] CORS y HSTS. "Rechazado por CORS" = la respuesta no trae Access-Control-Allow-Origin
// para ese origen, así que el navegador no deja que la página lea la respuesta.

// Lo único que usan los helpers: evita arrastrar los genéricos de Elysia.
type App = { handle(request: Request): Promise<Response> };

const PERMITIDO = "https://www.midominio.com";
const AJENO = "https://sitio-malicioso.example";

function crearApp(opciones: { produccion: boolean; corsOrigin?: string }) {
  const log = { warn: mock(() => {}), log: mock(() => {}) };
  const app = new Elysia()
    .use(errorHandler)
    .use(seguridadHttp({ ...opciones, log }))
    .get("/api/x", () => ({ ok: true }))
    .patch("/api/x", () => ({ ok: true }))
    .get("/api/boom", () => {
      throw new Error("falla interna");
    });
  return { app, log };
}

const get = (app: App, origen: string, ruta = "/api/x") =>
  app.handle(new Request(`http://localhost${ruta}`, { headers: { Origin: origen } }));

// Lo que manda el navegador antes de un PATCH con Authorization desde otro origen.
const preflight = (app: App, origen: string) =>
  app.handle(
    new Request("http://localhost/api/x", {
      method: "OPTIONS",
      headers: { Origin: origen, "Access-Control-Request-Method": "PATCH", "Access-Control-Request-Headers": "authorization,content-type" },
    })
  );

const CORS_HEADERS = ["access-control-allow-origin", "access-control-allow-methods", "access-control-allow-headers", "access-control-allow-credentials"];
const headersCors = (res: Response) => CORS_HEADERS.filter((h) => res.headers.get(h) !== null);

describe("desarrollo", () => {
  test("el frontend de Vite (localhost:5173) pasa, con los métodos y headers que usa", async () => {
    const { app } = crearApp({ produccion: false });

    const pre = await preflight(app, DEV_ORIGIN);
    expect(pre.headers.get("access-control-allow-origin")).toBe(DEV_ORIGIN);
    expect(pre.headers.get("access-control-allow-methods")).toBe("GET, POST, PUT, PATCH, DELETE, OPTIONS");
    expect(pre.headers.get("access-control-allow-headers")).toBe("Content-Type, Authorization");

    const res = await get(app, DEV_ORIGIN);
    expect(res.status).toBe(200);
    expect(res.headers.get("access-control-allow-origin")).toBe(DEV_ORIGIN);
  });

  test("un origen no autorizado es rechazado (sin Access-Control-Allow-Origin)", async () => {
    const { app } = crearApp({ produccion: false });
    expect((await preflight(app, AJENO)).headers.get("access-control-allow-origin")).toBeNull();
    expect((await get(app, AJENO)).headers.get("access-control-allow-origin")).toBeNull();
  });

  test("sin cookies: no se envía Access-Control-Allow-Credentials", async () => {
    const { app } = crearApp({ produccion: false });
    expect((await preflight(app, DEV_ORIGIN)).headers.get("access-control-allow-credentials")).toBeNull();
  });

  test("localhost:5173 sigue permitido aunque el .env traiga un CORS_ORIGIN de producción", async () => {
    const { app } = crearApp({ produccion: false, corsOrigin: PERMITIDO });
    expect((await get(app, DEV_ORIGIN)).headers.get("access-control-allow-origin")).toBe(DEV_ORIGIN);
    expect((await get(app, PERMITIDO)).headers.get("access-control-allow-origin")).toBe(PERMITIDO);
  });

  test("no envía HSTS ni CSP (la CSP rompería /swagger)", async () => {
    const { app } = crearApp({ produccion: false });
    const res = await get(app, DEV_ORIGIN);
    expect(res.headers.get("strict-transport-security")).toBeNull();
    expect(res.headers.get("content-security-policy")).toBeNull();
  });
});

describe("producción con CORS_ORIGIN", () => {
  const corsOrigin = " https://www.midominio.com , https://midominio.com/ ";

  test("acepta varios orígenes separados por coma (con espacios y / final)", async () => {
    const { app } = crearApp({ produccion: true, corsOrigin });
    for (const origen of [PERMITIDO, "https://midominio.com"]) {
      expect((await preflight(app, origen)).headers.get("access-control-allow-origin")).toBe(origen);
      expect((await get(app, origen)).headers.get("access-control-allow-origin")).toBe(origen);
    }
  });

  test("un origen no autorizado es rechazado", async () => {
    const { app } = crearApp({ produccion: true, corsOrigin });
    for (const origen of [AJENO, DEV_ORIGIN, "http://www.midominio.com" /* http, no https */]) {
      expect((await preflight(app, origen)).headers.get("access-control-allow-origin")).toBeNull();
      expect((await get(app, origen)).headers.get("access-control-allow-origin")).toBeNull();
    }
  });

  test("envía HSTS (180 días, sin includeSubDomains ni preload), también en errores", async () => {
    const { app } = crearApp({ produccion: true, corsOrigin });
    expect((await get(app, PERMITIDO)).headers.get("strict-transport-security")).toBe(HSTS);
    const error = await get(app, PERMITIDO, "/api/boom");
    expect(error.status).toBe(500);
    expect(error.headers.get("strict-transport-security")).toBe("max-age=15552000");
  });

  test("envía todos los headers de seguridad, también en errores", async () => {
    const { app } = crearApp({ produccion: true, corsOrigin });
    for (const res of [await get(app, PERMITIDO), await get(app, PERMITIDO, "/api/boom")]) {
      for (const [header, valor] of Object.entries(HEADERS_SEGURIDAD)) expect(res.headers.get(header)).toBe(valor);
    }
  });

  test("la CSP bloquea scripts externos y iframes, y permite Google Fonts y Cloudinary", () => {
    expect(CSP).toContain("script-src 'self';");
    expect(CSP).toContain("frame-ancestors 'none'");
    expect(CSP).toContain("connect-src 'self';");
    expect(CSP).toContain("https://fonts.googleapis.com");
    expect(CSP).toContain("https://fonts.gstatic.com");
    expect(CSP).toContain("https://res.cloudinary.com");
  });

  test("las páginas del sitio (servirFrontend) también llevan los headers", async () => {
    const dist = await mkdtemp(join(tmpdir(), "dist-"));
    try {
      await Bun.write(join(dist, "index.html"), "<!doctype html><title>x</title>");
      await Bun.write(join(dist, "app.js"), "console.log(1)");
      const app = new Elysia().use(seguridadHttp({ produccion: true, log: { warn() {}, log() {} } })).use(servirFrontend(dist));
      await app.modules; // el plugin de archivos estáticos se arma de forma asíncrona
      for (const ruta of ["/", "/app.js", "/admin/cotizaciones"]) {
        const res = await app.handle(new Request(`http://localhost${ruta}`));
        expect(res.status).toBe(200);
        expect(res.headers.get("content-security-policy")).toBe(CSP);
        expect(res.headers.get("x-frame-options")).toBe("DENY");
      }
    } finally {
      await rm(dist, { recursive: true, force: true });
    }
  });

  test("ignora con aviso los valores que no son un origen", () => {
    const log = { warn: mock(() => {}), log: mock(() => {}) };
    const origenes = origenesPermitidos({
      produccion: true,
      corsOrigin: "midominio.com, https://ok.example, https://x.example/ruta, ftp://x.example",
      log,
    });
    expect(origenes).toEqual(["https://ok.example"]);
    expect(log.warn).toHaveBeenCalledTimes(3);
  });
});

describe("producción sin CORS_ORIGIN", () => {
  test.each([undefined, "", "  ,  "])("CORS_ORIGIN=%p: ningún origen externo, ni un solo header de CORS", async (corsOrigin) => {
    const { app } = crearApp({ produccion: true, corsOrigin });
    for (const origen of [PERMITIDO, AJENO, DEV_ORIGIN]) {
      expect(headersCors(await preflight(app, origen))).toEqual([]);
      expect(headersCors(await get(app, origen))).toEqual([]);
    }
  });

  test("avisa en el log y la API sigue respondiendo (no falla)", async () => {
    const { app, log } = crearApp({ produccion: true });
    expect(log.warn).toHaveBeenCalledTimes(1);
    expect(String((log.warn.mock.calls[0] as unknown[])[0])).toContain("CORS_ORIGIN no está definida");
    const res = await app.handle(new Request("http://localhost/api/x"));
    expect(res.status).toBe(200);
    expect(res.headers.get("strict-transport-security")).toBe(HSTS);
  });
});

// Arranque real de src/index.ts en modo producción, contra el MongoDB en memoria.
describe("servidor real (src/index.ts) en producción", () => {
  async function arrancar(env: Record<string, string>) {
    const puerto = String(4100 + Math.floor(Math.random() * 800));
    const proceso = Bun.spawn(["bun", "src/index.ts"], {
      env: { ...process.env, NODE_ENV: "production", MONGODB_URI: `${process.env.TEST_MONGODB_URI}seguridad`, PORT: puerto, ...env },
      stdout: "pipe",
      stderr: "pipe",
    });
    const salida: string[] = [];
    const leer = async (s: ReadableStream<Uint8Array>) => {
      for await (const trozo of s) salida.push(new TextDecoder().decode(trozo));
    };
    void leer(proceso.stdout);
    void leer(proceso.stderr);
    for (let i = 0; i < 100 && !salida.join("").includes("Servidor ejecutándose"); i++) {
      if (proceso.exitCode !== null) break;
      await Bun.sleep(100);
    }
    return { proceso, salida, url: `http://localhost:${puerto}` };
  }

  test("sin CORS_ORIGIN: arranca, avisa en el log, no permite orígenes externos y usa PORT", async () => {
    const { proceso, salida, url } = await arrancar({ CORS_ORIGIN: "" });
    try {
      expect(proceso.exitCode).toBeNull(); // sigue vivo: no falló al arrancar
      const log = salida.join("");
      expect(log).toContain("CORS_ORIGIN no está definida");
      expect(log).toContain(`Servidor ejecutándose en ${url}`);

      const res = await fetch(`${url}/api/health`, { headers: { Origin: AJENO } });
      expect(res.status).toBe(200);
      expect(res.headers.get("access-control-allow-origin")).toBeNull();
      expect(res.headers.get("strict-transport-security")).toBe(HSTS);
    } finally {
      proceso.kill();
    }
  }, 30_000);

  test("con CORS_ORIGIN: el dominio configurado pasa y otro no", async () => {
    const { proceso, salida, url } = await arrancar({ CORS_ORIGIN: PERMITIDO });
    try {
      expect(salida.join("")).toContain(`[CORS] Orígenes permitidos: ${PERMITIDO}`);
      const ok = await fetch(`${url}/api/health`, { headers: { Origin: PERMITIDO } });
      expect(ok.headers.get("access-control-allow-origin")).toBe(PERMITIDO);
      const ajeno = await fetch(`${url}/api/health`, { headers: { Origin: AJENO } });
      expect(ajeno.headers.get("access-control-allow-origin")).toBeNull();
    } finally {
      proceso.kill();
    }
  }, 30_000);
});
