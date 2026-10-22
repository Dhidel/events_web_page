import { afterAll, beforeAll, describe, expect, mock, test } from "bun:test";
import { Elysia } from "elysia";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { errorHandler } from "../../src/lib/errors";
import { servirFrontend } from "../../src/lib/frontend";
import { escaparHtml, htmlConHead, leerSiteUrl, normalizarRuta, PAGINAS_PUBLICAS, robotsTxt, sitemapXml } from "../../src/lib/seo";

// SEO: robots.txt, sitemap.xml, <head> por página, 404 real y noindex en el admin.

const SITE = "https://www.midominio.com";
const RUTAS_PUBLICAS = ["/", "/servicios", "/cotizador", "/galeria", "/nosotros", "/contacto"];

// Un index.html como el que genera Vite (con <head> y el <title> por defecto).
const INDEX =
  '<!doctype html>\n<html lang="es">\n  <head>\n    <meta charset="UTF-8" />\n    <title>Título por defecto</title>\n  </head>\n  <body><div id="root"></div><script type="module" src="/assets/app.js"></script></body>\n</html>';

async function levantar(siteUrl: string | undefined) {
  const dist = await mkdtemp(join(tmpdir(), "dist-seo-"));
  await mkdir(join(dist, "assets"));
  await Bun.write(join(dist, "index.html"), INDEX);
  await Bun.write(join(dist, "assets", "app.js"), "console.log('app')");
  await Bun.write(join(dist, "og-image.jpg"), "imagen");
  const log = { warn: mock(() => {}) };
  const app = new Elysia()
    .use(errorHandler)
    .get("/api/health", () => ({ status: "ok" }))
    .use(servirFrontend(dist, { siteUrl, log }));
  await app.modules;
  app.listen(0);
  const url = `http://localhost:${app.server!.port}`;
  return {
    log,
    get: (ruta: string, init?: RequestInit) => fetch(`${url}${ruta}`, { redirect: "manual", ...init }),
    cerrar: async () => {
      app.stop();
      await rm(dist, { recursive: true, force: true });
    },
  };
}

describe("con SITE_URL", () => {
  let s: Awaited<ReturnType<typeof levantar>>;
  beforeAll(async () => {
    s = await levantar(`${SITE}/`);
  });
  afterAll(() => s.cerrar());

  test("no avisa en el log", () => {
    expect(s.log.warn).not.toHaveBeenCalled();
  });

  test("robots.txt: texto plano en la raíz, permite indexar, bloquea la API y apunta al sitemap", async () => {
    const res = await s.get("/robots.txt");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/plain");
    const texto = await res.text();
    expect(texto).toContain("User-agent: *\nAllow: /\nDisallow: /api/");
    expect(texto).toContain(`Sitemap: ${SITE}/sitemap.xml`);
    // /admin NO se bloquea: si no, Google no vería su noindex.
    expect(texto).not.toContain("/admin");
  });

  test("sitemap.xml: XML con las 6 URLs públicas absolutas y nada del admin", async () => {
    const res = await s.get("/sitemap.xml");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("application/xml");
    const xml = await res.text();
    const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
    expect(locs).toEqual([`${SITE}/`, ...RUTAS_PUBLICAS.slice(1).map((r) => SITE + r)]);
    expect(xml).not.toContain("admin");
  });

  test.each(RUTAS_PUBLICAS)("%s → 200 con su propio título, descripción, canonical y vista previa", async (ruta) => {
    const res = await s.get(ruta);
    expect(res.status).toBe(200);
    expect(res.headers.get("x-robots-tag")).toBeNull();
    const html = await res.text();
    const pagina = PAGINAS_PUBLICAS[ruta]!;
    const url = SITE + (ruta === "/" ? "/" : ruta);
    expect(html.match(/<title>/g)).toHaveLength(1);
    expect(html).toContain(`<title>${escaparHtml(pagina.title)}</title>`);
    expect(html).not.toContain("Título por defecto");
    expect(html).toContain(`<meta name="description" content="${escaparHtml(pagina.description)}" />`);
    expect(html).toContain(`<link rel="canonical" href="${url}" />`);
    expect(html).toContain(`<meta property="og:url" content="${url}" />`);
    expect(html).toContain(`<meta property="og:image" content="${SITE}/og-image.jpg" />`);
    // El resto de index.html (React) queda igual.
    expect(html).toContain('<div id="root"></div><script type="module" src="/assets/app.js"></script>');
  });

  test("las 6 páginas tienen títulos y descripciones distintos", () => {
    const paginas = Object.values(PAGINAS_PUBLICAS);
    expect(Object.keys(PAGINAS_PUBLICAS)).toEqual(RUTAS_PUBLICAS);
    expect(new Set(paginas.map((p) => p.title)).size).toBe(6);
    expect(new Set(paginas.map((p) => p.description)).size).toBe(6);
  });

  test("con barra final o query string se sirve la misma página (canonical sin ellos)", async () => {
    for (const ruta of ["/servicios/", "/servicios?utm_source=facebook"]) {
      const res = await s.get(ruta);
      expect(res.status).toBe(200);
      expect(await res.text()).toContain(`<link rel="canonical" href="${SITE}/servicios" />`);
    }
  });

  test.each(["/admin", "/admin/dashboard", "/admin/cotizaciones"])("%s → 200 (el panel sigue cargando) con noindex", async (ruta) => {
    const res = await s.get(ruta);
    expect(res.status).toBe(200);
    expect(res.headers.get("x-robots-tag")).toBe("noindex, nofollow");
    expect(await res.text()).toBe(INDEX);
  });

  test.each(["/no-existe", "/servicios/otra", "/administrador", "/constructor", "/__proto__"])("%s → 404 con la página del sitio y noindex", async (ruta) => {
    const res = await s.get(ruta);
    expect(res.status).toBe(404);
    expect(res.headers.get("content-type")).toContain("text/html");
    expect(res.headers.get("x-robots-tag")).toBe("noindex, nofollow");
    expect(await res.text()).toBe(INDEX);
  });

  test("/index.html redirige a / (una sola URL por página)", async () => {
    const res = await s.get("/index.html");
    expect(res.status).toBe(301);
    expect(res.headers.get("location")).toBe("/");
  });

  test("un Host falso no cambia ninguna URL (host header injection)", async () => {
    const headers = { Host: "sitio-malicioso.example" };
    for (const ruta of ["/robots.txt", "/sitemap.xml", "/servicios"]) {
      const texto = await (await s.get(ruta, { headers })).text();
      expect(texto).not.toContain("sitio-malicioso");
      expect(texto).toContain(SITE);
    }
  });

  test("la API, sus 404 en JSON y los archivos estáticos siguen igual", async () => {
    expect(await (await s.get("/api/health")).json()).toEqual({ status: "ok" });
    const noApi = await s.get("/api/no-existe");
    expect(noApi.status).toBe(404);
    expect(noApi.headers.get("content-type")).toContain("application/json");
    expect(await (await s.get("/assets/app.js")).text()).toBe("console.log('app')");
    expect(await (await s.get("/og-image.jpg")).text()).toBe("imagen");
  });
});

describe("sin SITE_URL (o inválida)", () => {
  test.each([undefined, "", "midominio.com", "https://www.midominio.com/ruta"])("SITE_URL=%p → avisa, sin sitemap ni URLs absolutas; el sitio sigue funcionando", async (valor) => {
    const s = await levantar(valor);
    try {
      expect(s.log.warn).toHaveBeenCalledTimes(1);
      expect((await s.get("/sitemap.xml")).status).toBe(404);
      const robots = await (await s.get("/robots.txt")).text();
      expect(robots).toContain("Allow: /");
      expect(robots).not.toContain("Sitemap:");
      const res = await s.get("/galeria");
      expect(res.status).toBe(200);
      const html = await res.text();
      expect(html).toContain(`<title>${escaparHtml(PAGINAS_PUBLICAS["/galeria"]!.title)}</title>`);
      expect(html).not.toContain("canonical");
      expect(html).not.toContain("og:url");
    } finally {
      await s.cerrar();
    }
  });
});

describe("funciones", () => {
  test("escaparHtml: un texto no puede cerrar la etiqueta ni el atributo (XSS)", () => {
    expect(escaparHtml(`"><script>alert('x')</script>&`)).toBe("&quot;&gt;&lt;script&gt;alert(&#39;x&#39;)&lt;/script&gt;&amp;");
  });

  test("htmlConHead escapa los textos y no interpreta $ como patrón", () => {
    const html = htmlConHead("<head><title>x</title></head>", "/p", { title: 'A "$&" <b>', description: "$1 & </title>" }, SITE);
    expect(html).toContain("<title>A &quot;$&amp;&quot; &lt;b&gt;</title>");
    expect(html).toContain('content="$1 &amp; &lt;/title&gt;"');
    expect(html).not.toContain("<b>");
  });

  test("htmlConHead sin <title> en la plantilla: agrega las etiquetas antes de </head>", () => {
    const html = htmlConHead("<head></head><body></body>", "/", { title: "T", description: "D" }, null);
    expect(html).toContain("<title>T</title>");
    expect(html.indexOf("<title>")).toBeLessThan(html.indexOf("</head>"));
  });

  test("leerSiteUrl", () => {
    expect(leerSiteUrl(" https://www.midominio.com/ ")).toBe(SITE);
    expect(leerSiteUrl("http://localhost:3000")).toBe("http://localhost:3000");
    expect([undefined, "", "  ", "midominio.com", "ftp://midominio.com", `${SITE}/x`, `${SITE}?a=1`].map(leerSiteUrl)).toEqual([
      null, null, null, null, null, null, null,
    ]);
  });

  test("normalizarRuta", () => {
    expect(["/", "/servicios", "/servicios/", "/servicios//", "//"].map(normalizarRuta)).toEqual(["/", "/servicios", "/servicios", "/servicios", "/"]);
  });

  test("robotsTxt y sitemapXml", () => {
    expect(robotsTxt(null)).toBe("User-agent: *\nAllow: /\nDisallow: /api/\n");
    expect(sitemapXml(SITE)).toStartWith('<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">');
  });
});
