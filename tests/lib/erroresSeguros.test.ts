import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, spyOn, test } from "bun:test";
import { mkdtemp, mkdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { connect } from "node:net";
import { Elysia, t } from "elysia";
import { errorHandler, GENERIC_ERROR } from "../../src/lib/errors";
import { esRutaApi, servirFrontend } from "../../src/lib/frontend";
import { redactPII } from "../../src/lib/privacy";
import { MAX_BODY_BYTES } from "../../src/lib/seguridadHttp";
import { GalleryImage } from "../../src/models/GalleryImage";
import { authJwt } from "../../src/plugins/jwt";
import { adminGalleryRoutes } from "../../src/routes/adminGallery";
import { cloudinaryFalso } from "../helpers/cloudinaryFalso";

// [14.4] Ningún error expone información interna al cliente, y los logs no llevan
// credenciales ni datos personales.

// Rastros que nunca deben llegar al cliente.
const RASTROS = /C:[\\/]|\/home\/|node_modules|\.ts\b|at \w+ \(|solicituds|mongo|mongoose|cloudinary|resend|jwt|stack|Error:/i;

async function soloErrorGenerico(res: Response, status: number, mensaje: string) {
  expect(res.status).toBe(status);
  const texto = await res.text();
  expect(JSON.parse(texto)).toEqual({ error: mensaje });
  expect(texto).not.toMatch(RASTROS);
}

let consoleError: ReturnType<typeof spyOn>;
const logs = () => consoleError.mock.calls.map((c: unknown[]) => c.map(String).join(" ")).join("\n");
beforeEach(() => {
  consoleError = spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => consoleError.mockRestore());

// ---------------------------------------------------------------------------------------

describe("respuestas de error genéricas", () => {
  const app = new Elysia()
    .use(errorHandler)
    .get("/sonda/500", () => {
      throw new Error("Fallo en C:/proyecto/src/services/x.ts, colección solicituds, mongodb 6.x, JWT_SECRET=abc");
    })
    .get("/sonda/texto", () => {
      throw "texto suelto";
    })
    .post("/sonda/json", ({ body }) => body, { parse: "json", body: t.Object({ a: t.String() }) })
    .get(
      "/sonda/respuesta",
      // `id` numérico a propósito: la respuesta no cumple el esquema declarado.
      () => ({ id: 123, nombre: "Ana López", mensaje: "Quiero una boda el 5 de diciembre" }) as unknown as { id: string; nombre: string; mensaje: string },
      { response: { 200: t.Object({ id: t.String(), nombre: t.String(), mensaje: t.String() }) } }
    );
  const pedir = (metodo: string, ruta: string, init: RequestInit = {}) =>
    app.handle(new Request(`http://localhost${ruta}`, { method: metodo, ...init }));

  test("un 500 provocado devuelve solo { error } genérico, sin rastros internos", async () => {
    await soloErrorGenerico(await pedir("GET", "/sonda/500"), 500, GENERIC_ERROR);
    // El detalle sí queda en el log del servidor (enmascarado), para poder depurar.
    expect(logs()).toContain("[GET /sonda/500] Error inesperado");
  });

  test("lanzar algo que no es un Error también da el 500 genérico", async () => {
    await soloErrorGenerico(await pedir("GET", "/sonda/texto"), 500, GENERIC_ERROR);
  });

  test("ruta inexistente → 404 genérico", async () => {
    await soloErrorGenerico(await pedir("GET", "/api/no-existe"), 404, "Ruta no encontrada.");
  });

  test("método no permitido → 404 genérico (no revela qué métodos existen)", async () => {
    await soloErrorGenerico(await pedir("DELETE", "/sonda/json"), 404, "Ruta no encontrada.");
  });

  test("JSON roto → 400 genérico", async () => {
    const res = await pedir("POST", "/sonda/json", { headers: { "Content-Type": "application/json" }, body: '{"a": "x",' });
    await soloErrorGenerico(res, 400, "El cuerpo de la solicitud no tiene un formato válido.");
  });

  test("respuesta que no cumple el esquema → 500 genérico; el log nombra el campo pero no los valores", async () => {
    await soloErrorGenerico(await pedir("GET", "/sonda/respuesta"), 500, GENERIC_ERROR);
    expect(logs()).toContain("La respuesta no cumple el esquema documentado (campos: id)");
    for (const dato of ["Ana López", "boda", "123"]) expect(logs()).not.toContain(dato);
  });
});

// ---------------------------------------------------------------------------------------

describe("Cloudinary: el error llega genérico al cliente y sin la API key al log", () => {
  const API_KEY = "987654321012345"; // 15 dígitos, como las de Cloudinary
  const app = new Elysia().use(errorHandler).use(adminGalleryRoutes);
  let AUTH: Record<string, string>;
  beforeAll(async () => {
    const token = await new Elysia()
      .use(authJwt)
      .get("/t", ({ jwt }) => jwt.sign({ id: "admin", email: "admin@example.com" }))
      .handle(new Request("http://localhost/t"))
      .then((r) => r.text());
    AUTH = { Authorization: `Bearer ${token}` };
  });
  beforeEach(() => {
    cloudinaryFalso.fallarCon = new Error(`Unknown API key ${API_KEY}`);
  });

  const JPG = () => Bun.file(new URL("../../client/src/assets/img/navidad.jpg", import.meta.url)).arrayBuffer();
  const formulario = async () => {
    const fd = new FormData();
    fd.append("image", new File([await JPG()], "a.jpg", { type: "image/jpeg" }));
    fd.append("alt", "Pareja");
    fd.append("label", "Boda");
    fd.append("category", "bodas");
    return fd;
  };
  const crearImagen = () =>
    GalleryImage.create({ imageUrl: "https://x/a.jpg", publicId: "falso/a", alt: "a", label: "b", category: "bodas", categoryLabel: "Bodas" });

  test("subida que falla → 502 genérico; ni la key ni sus dígitos en el log", async () => {
    const res = await adminRequest(app, "POST", "/api/admin/gallery", AUTH, await formulario());
    await soloErrorGenerico(res, 502, "No se pudo procesar la imagen. Intenta de nuevo.");
    expect(logs()).toContain("Cloudinary: falló la subida");
    expect(logs()).toContain("API key ****");
    expect(logs()).not.toContain(API_KEY);
    expect(logs()).not.toContain(API_KEY.slice(-4));
  });

  test("borrado que falla (DELETE) → la operación sigue y la key no aparece en el log", async () => {
    const doc = await crearImagen();
    const res = await adminRequest(app, "DELETE", `/api/admin/gallery/${doc.id}`, AUTH);
    expect(res.status).toBe(200);
    expect(logs()).toContain("Cloudinary: no se pudo borrar la imagen");
    expect(logs()).not.toContain(API_KEY);
  });

  test("reemplazo de imagen con fallo al borrar la anterior (PUT) → la key no aparece en el log", async () => {
    const doc = await crearImagen();
    // La subida funciona; falla solo el borrado de la imagen anterior.
    cloudinaryFalso.fallarCon = null;
    const fd = new FormData();
    fd.append("image", new File([await JPG()], "b.jpg", { type: "image/jpeg" }));
    const original = cloudinaryFalso.borradas;
    cloudinaryFalso.borradas = new Proxy(original, {
      get(lista, prop) {
        if (prop === "push") throw new Error(`Unknown API key ${API_KEY}`);
        return Reflect.get(lista, prop);
      },
    });
    const res = await adminRequest(app, "PUT", `/api/admin/gallery/${doc.id}`, AUTH, fd);
    expect(res.status).toBe(200);
    await Bun.sleep(10); // el borrado de la anterior corre en segundo plano
    expect(logs()).toContain("Cloudinary: no se pudo borrar la imagen anterior");
    expect(logs()).not.toContain(API_KEY);
  });
});

// Lo único que usa del app: evita arrastrar los genéricos de Elysia.
type App = { handle(request: Request): Promise<Response> };
function adminRequest(app: App, metodo: string, ruta: string, auth: Record<string, string>, body?: FormData) {
  return app.handle(new Request(`http://localhost${ruta}`, { method: metodo, headers: auth, body }));
}

describe("redactPII: API keys", () => {
  test.each([
    ["Unknown API key 987654321012345", "Unknown API key ****"],
    ["fetch https://x?api_key=987654321012345&timestamp=1", "fetch https://x?api_key=****&timestamp=1"],
    ["Invalid api-key: abcDEF123456", "Invalid api-key: ****"],
  ])("%p → %p", (entrada, esperado) => {
    expect(redactPII(entrada)).toBe(esperado);
  });
});

// ---------------------------------------------------------------------------------------

describe("frontend en producción: /api/* inexistente → 404 JSON; el resto sirve el sitio", () => {
  let dist: string;
  let servidor: { stop(): void };
  let url: string;
  beforeAll(async () => {
    dist = await mkdtemp(join(tmpdir(), "dist-"));
    await mkdir(join(dist, "assets"));
    await Bun.write(join(dist, "index.html"), "<!doctype html><title>Sitio</title>");
    await Bun.write(join(dist, "assets", "app.js"), "console.log('app')");
    // Servidor escuchando, como en producción (los archivos estáticos se registran al cargar
    // el plugin, que es asíncrono).
    const app = new Elysia()
      .use(errorHandler)
      .get("/api/health", () => ({ status: "ok" }))
      .use(servirFrontend(dist, { siteUrl: "https://www.midominio.com" }));
    await app.modules;
    app.listen(0);
    servidor = app;
    url = `http://localhost:${app.server!.port}`;
  });
  afterAll(async () => {
    servidor.stop();
    await rm(dist, { recursive: true, force: true });
  });

  const get = (ruta: string) => fetch(`${url}${ruta}`);

  test.each(["/api", "/api/", "/api/no-existe", "/api/admin/nada/mas"])("%s → 404 { error } en JSON", async (ruta) => {
    const res = await get(ruta);
    await soloErrorGenerico(res, 404, "Ruta no encontrada.");
    expect(res.headers.get("content-type")).toContain("application/json");
  });

  test.each(["/cotizador", "/admin/dashboard", "/galeria"])("%s → página del sitio (200 HTML)", async (ruta) => {
    const res = await get(ruta);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/html");
  });

  // Rutas que no son de la API ni del sitio: la página del sitio (React muestra su pantalla),
  // pero con 404 para que los buscadores no las tomen como páginas reales ("soft 404").
  test.each(["/apixyz", "/api-docs"])("%s → página del sitio con 404", async (ruta) => {
    const res = await get(ruta);
    expect(res.status).toBe(404);
    expect(await res.text()).toContain("<title>Sitio</title>");
  });

  test("las rutas reales de la API y los archivos estáticos siguen funcionando", async () => {
    expect(await (await get("/api/health")).json()).toEqual({ status: "ok" });
    expect(await (await get("/assets/app.js")).text()).toBe("console.log('app')");
    expect((await get("/")).status).toBe(200);
  });

  test("esRutaApi", () => {
    expect(["/api", "/api/", "/api/x"].map(esRutaApi)).toEqual([true, true, true]);
    expect(["/apixyz", "/ap", "/", "/x/api/y"].map(esRutaApi)).toEqual([false, false, false, false]);
  });
});

// ---------------------------------------------------------------------------------------

describe(`tope del body: ${MAX_BODY_BYTES / 1024 / 1024} MB (servidor real escuchando)`, () => {
  let servidor: { stop(): void; server?: { port?: number } | null };
  let puerto: number;
  let AUTH: Record<string, string>;
  beforeAll(async () => {
    const app = new Elysia().use(errorHandler).use(adminGalleryRoutes).listen({ port: 0, maxRequestBodySize: MAX_BODY_BYTES });
    servidor = app;
    puerto = app.server!.port!;
    const token = await new Elysia()
      .use(authJwt)
      .get("/t", ({ jwt }) => jwt.sign({ id: "admin", email: "admin@example.com" }))
      .handle(new Request("http://localhost/t"))
      .then((r) => r.text());
    AUTH = { Authorization: `Bearer ${token}` };
  });
  afterAll(() => servidor.stop());

  test("una subida real de imagen de ~9 MB sigue funcionando (201)", async () => {
    const jpg = await Bun.file(new URL("../../client/src/assets/img/navidad.jpg", import.meta.url)).arrayBuffer();
    // Un JPG real (la cabecera es la de verdad) completado hasta 9 MB.
    const imagen = new File([jpg, new Uint8Array(9 * 1024 * 1024 - jpg.byteLength)], "grande.jpg", { type: "image/jpeg" });
    expect(imagen.size).toBe(9 * 1024 * 1024);
    const fd = new FormData();
    fd.append("image", imagen);
    fd.append("alt", "Foto grande");
    fd.append("label", "Boda");
    fd.append("category", "bodas");

    const res = await fetch(`http://localhost:${puerto}/api/admin/gallery`, { method: "POST", headers: AUTH, body: fd });
    expect(res.status).toBe(201);
    expect(cloudinaryFalso.subidas).toEqual(["grande.jpg"]);
  }, 30_000);

  // Bun corta antes de leer el body: basta con anunciar el tamaño en Content-Length.
  test("más de 12 MB → Bun responde 413 sin llegar a la API", async () => {
    const linea = await new Promise<string>((resolve, reject) => {
      const socket = connect(puerto, "127.0.0.1", () => {
        socket.write(
          `POST /api/admin/gallery HTTP/1.1\r\nHost: localhost\r\nAuthorization: ${AUTH.Authorization}\r\n` +
            `Content-Type: multipart/form-data; boundary=x\r\nContent-Length: ${13 * 1024 * 1024}\r\n\r\n`
        );
      });
      socket.once("data", (datos) => {
        resolve(datos.toString().split("\r\n")[0]!);
        socket.destroy();
      });
      socket.once("error", reject);
    });
    expect(linea).toBe("HTTP/1.1 413 Request Entity Too Large");
    expect(cloudinaryFalso.subidas).toHaveLength(0);
  });
});
