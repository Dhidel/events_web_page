import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { Elysia } from "elysia";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { brotliDecompressSync, gunzipSync } from "node:zlib";
import { comprimir, elegirCodificacion } from "../../src/lib/compresion";
import { precargaFoto, servirFrontend } from "../../src/lib/frontend";
import { PAGINAS_PUBLICAS } from "../../src/lib/seo";

// Rendimiento del frontend: compresión, caché del navegador y precarga de la foto principal.

const JS = `console.log(${JSON.stringify("x".repeat(5000))});`;
const INDEX =
  '<!doctype html>\n<html lang="es">\n  <head>\n    <meta charset="UTF-8" />\n    <meta name="viewport" content="width=device-width, initial-scale=1.0" />\n    <title>Título</title>\n  </head>\n  <body><div id="root"></div></body>\n</html>';

describe("servidor", () => {
  let dist: string;
  let url: string;
  let app: { stop: () => unknown };
  const get = (ruta: string, headers: Record<string, string> = {}) =>
    // decompress: false para ver los bytes tal como llegan.
    fetch(`${url}${ruta}`, { headers: { "accept-encoding": "", ...headers }, decompress: false } as RequestInit);

  beforeAll(async () => {
    dist = await mkdtemp(join(tmpdir(), "dist-rend-"));
    await mkdir(join(dist, "assets"));
    await Bun.write(join(dist, "index.html"), INDEX);
    await Bun.write(join(dist, "assets", "app-Ab12Cd34.js"), JS);
    await Bun.write(join(dist, "assets", "foto-480-Ab12Cd34.webp"), "webp");
    await Bun.write(join(dist, "og-image.jpg"), "imagen");
    for (const { fotoPrincipal } of Object.values(PAGINAS_PUBLICAS)) {
      if (fotoPrincipal) await Bun.write(join(dist, "assets", `${fotoPrincipal.nombre}-720-Zz99Yy88.webp`), "webp");
    }
    const servidor = new Elysia().use(servirFrontend(dist, { siteUrl: "https://www.midominio.com", log: { warn: () => {} } }));
    await servidor.modules;
    servidor.listen(0);
    app = servidor;
    url = `http://localhost:${servidor.server!.port}`;
  });
  afterAll(async () => {
    app.stop();
    await rm(dist, { recursive: true, force: true });
  });

  test("el JS se envía comprimido con brotli o gzip según lo que acepte el navegador", async () => {
    const br = await get("/assets/app-Ab12Cd34.js", { "accept-encoding": "gzip, deflate, br" });
    expect(br.headers.get("content-encoding")).toBe("br");
    expect(br.headers.get("vary")).toBe("Accept-Encoding");
    const cuerpoBr = new Uint8Array(await br.arrayBuffer());
    expect(cuerpoBr.byteLength).toBeLessThan(JS.length / 10);
    expect(brotliDecompressSync(cuerpoBr).toString()).toBe(JS);

    const gz = await get("/assets/app-Ab12Cd34.js", { "accept-encoding": "gzip" });
    expect(gz.headers.get("content-encoding")).toBe("gzip");
    expect(gunzipSync(new Uint8Array(await gz.arrayBuffer())).toString()).toBe(JS);

    const sin = await get("/assets/app-Ab12Cd34.js");
    expect(sin.headers.get("content-encoding")).toBeNull();
    expect(await sin.text()).toBe(JS);
    expect(sin.headers.get("content-type")).toContain("javascript");
  });

  test("/assets se guarda un año (nombre con hash); el resto, un día", async () => {
    for (const ruta of ["/assets/app-Ab12Cd34.js", "/assets/foto-480-Ab12Cd34.webp"]) {
      expect((await get(ruta)).headers.get("cache-control")).toBe("public, max-age=31536000, immutable");
    }
    expect((await get("/og-image.jpg")).headers.get("cache-control")).toBe("public, max-age=86400");
  });

  test("con el ETag que ya tiene el navegador responde 304 sin cuerpo", async () => {
    const etag = (await get("/assets/app-Ab12Cd34.js")).headers.get("etag")!;
    expect(etag).toBeTruthy();
    const res = await get("/assets/app-Ab12Cd34.js", { "if-none-match": etag });
    expect(res.status).toBe(304);
    expect(await res.text()).toBe("");
  });

  test("cada página pública precarga su foto principal, después del viewport (antes, el celular elegiría otra versión)", async () => {
    for (const [ruta, { fotoPrincipal }] of Object.entries(PAGINAS_PUBLICAS)) {
      const html = await (await get(ruta)).text();
      expect(html).toContain(`<link rel="preload" as="image"`);
      expect(html).toContain(`/assets/${fotoPrincipal!.nombre}-720-Zz99Yy88.webp`);
      expect(html.indexOf("preload")).toBeGreaterThan(html.indexOf('name="viewport"'));
      expect(html.indexOf("preload")).toBeLessThan(html.indexOf("<title>"));
    }
  });

  test("admin y 404 no precargan nada", async () => {
    for (const ruta of ["/admin", "/no-existe"]) expect(await (await get(ruta)).text()).not.toContain("preload");
  });
});

describe("funciones", () => {
  test("elegirCodificacion: br antes que gzip; q=0 la rechaza", () => {
    expect(elegirCodificacion("gzip, deflate, br")).toBe("br");
    expect(elegirCodificacion("gzip")).toBe("gzip");
    expect(elegirCodificacion("br;q=0, gzip;q=0.5")).toBe("gzip");
    expect(elegirCodificacion("identity")).toBeNull();
    expect(elegirCodificacion(null)).toBeNull();
  });

  test("comprimir: no comprime contenidos chicos", async () => {
    const chico = await comprimir("hola");
    expect(chico.br).toBeUndefined();
    expect(chico.gzip).toBeUndefined();
    expect((await comprimir(JS)).br).toBeDefined();
  });

  test("precargaFoto sin sizes: solo la versión más grande (como el carrusel del inicio)", () => {
    const archivos = ["quince-alicia-480-a1.webp", "quince-alicia-1600-b2.jpg", "quince-alicia-960-c3.webp"];
    expect(precargaFoto({ nombre: "quince-alicia" }, archivos)).toBe(
      '<link rel="preload" as="image" href="/assets/quince-alicia-1600-b2.jpg" fetchpriority="high" />'
    );
  });

  test("precargaFoto con sizes: el mismo srcset que el <img> (de menor a mayor) y su sizes", () => {
    const archivos = ["banner-900-x_9.jpg", "banner-480-a-1.webp", "banner-720-b2.webp", "otra-480-c3.webp"];
    expect(precargaFoto({ nombre: "banner", sizes: "100vw" }, archivos)).toBe(
      '<link rel="preload" as="image" imagesrcset="/assets/banner-480-a-1.webp 480w, /assets/banner-720-b2.webp 720w, /assets/banner-900-x_9.jpg 900w" imagesizes="100vw" fetchpriority="high" />'
    );
  });

  test("precargaFoto no confunde fotos con nombres parecidos y devuelve null si no hay versiones", () => {
    expect(precargaFoto({ nombre: "quince" }, ["quince-alicia-480-a1.webp", "quince-vivo-480-b2.webp"])).toBeNull();
    expect(precargaFoto({ nombre: "bodas-anillos-bn", sizes: "1px" }, ["bodas-anillos-bn-480-a1.webp"])).toContain("bodas-anillos-bn-480-a1.webp 480w");
  });

  test("las fotos principales de data/paginas.ts existen en client/src/assets/img", async () => {
    const imagenes = [...new Bun.Glob("*").scanSync(join(import.meta.dir, "../../client/src/assets/img"))];
    for (const { fotoPrincipal } of Object.values(PAGINAS_PUBLICAS)) {
      expect(imagenes.some((a) => a.startsWith(`${fotoPrincipal!.nombre}-`))).toBe(true);
    }
  });
});
