import { Elysia } from "elysia";
import { staticPlugin } from "@elysiajs/static";
import { resolve } from "node:path";
import type { FotoPrincipal } from "../../client/src/data/paginas";
import { comprimir, EXTENSIONES_COMPRIMIBLES, responderComprimido, type Comprimido } from "./compresion";
import { ApiError } from "./errors";
import { escaparHtml, esRutaAdmin, htmlConHead, leerSiteUrl, normalizarRuta, PAGINAS_PUBLICAS, paginaPublica, robotsTxt, sitemapXml } from "./seo";

// Rutas de la API: "/api" y todo lo que empieza con "/api/". "/apixyz" NO es de la API.
export function esRutaApi(ruta: string): boolean {
  return ruta === "/api" || ruta.startsWith("/api/");
}

const NOINDEX = "noindex, nofollow";

const escaparRegex = (texto: string) => texto.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// Caché del navegador. Los archivos de /assets llevan un hash en el nombre que cambia con su
// contenido (index-BKTcJBKK.js): se pueden guardar un año sin riesgo de servir uno viejo. El
// resto (favicon.svg, og-image.jpg…) tiene nombre fijo: un día.
const CACHE_ASSETS = "public, max-age=31536000, immutable";
const MAX_AGE_RESTO = 86400;

interface OpcionesFrontend {
  // Valor de SITE_URL (dominio público, ej. https://www.midominio.com). Sin él no hay
  // sitemap ni URLs absolutas (canonical, og:url, og:image).
  siteUrl?: string;
  log?: Pick<Console, "warn">;
}

// <link rel="preload"> de la foto principal de una página, armado con los archivos de
// client/dist/assets (los nombres llevan el hash de Vite: foto-720-AbCd1234.webp). Tiene que
// pedir exactamente lo mismo que el <img> de la página (mismo srcset y sizes), si no el
// navegador descarga dos fotos. null si no hay versiones de esa foto.
export function precargaFoto(foto: FotoPrincipal, archivosAssets: string[]): string | null {
  const patron = new RegExp(`^${escaparRegex(foto.nombre)}-(\\d+)-[\\w-]+\\.(webp|jpe?g|png|avif)$`);
  const versiones = archivosAssets
    .map((archivo) => ({ archivo, ancho: Number(patron.exec(archivo)?.[1]) }))
    .filter((v) => v.ancho > 0)
    .sort((a, b) => a.ancho - b.ancho);
  if (!versiones.length) return null;
  if (!foto.sizes) {
    // El <img> usa solo src (la versión más grande).
    const grande = versiones.at(-1)!;
    return `<link rel="preload" as="image" href="/assets/${escaparHtml(grande.archivo)}" fetchpriority="high" />`;
  }
  const srcset = versiones.map((v) => `/assets/${v.archivo} ${v.ancho}w`).join(", ");
  return `<link rel="preload" as="image" imagesrcset="${escaparHtml(srcset)}" imagesizes="${escaparHtml(foto.sizes)}" fetchpriority="high" />`;
}

// Inserta una etiqueta en el <head> justo después del <meta name="viewport"> (o al final del
// <head> si no lo hay). No antes: hasta leer el viewport, el celular cree que la pantalla
// mide 980px y elegiría del srcset una foto mucho más grande que la que pide después el <img>.
function agregarAlHead(html: string, etiqueta: string): string {
  const viewport = /<meta name="viewport"[^>]*>/i;
  if (viewport.test(html)) return html.replace(viewport, (m) => `${m}\n    ${etiqueta}`);
  return html.replace(/<\/head>/i, (m) => `  ${etiqueta}\n  ${m}`);
}

// En producción este servidor sirve también el frontend (client/dist): los archivos
// estáticos y, para el resto de rutas, index.html (React Router decide qué pantalla
// mostrar). Según la ruta:
// - página pública (src/lib/seo.ts): 200 con su título, descripción y canonical en el <head>,
//   y la precarga de su foto principal;
// - /admin y /admin/*: 200 con index.html tal cual y X-Robots-Tag: noindex;
// - cualquier otra: 404 (con index.html, para que React muestre su pantalla) y noindex;
// - /api/* inexistente: 404 { error } en JSON.
// El HTML y los archivos de texto (JS, CSS, SVG) se envían comprimidos (src/lib/compresion.ts).
export function servirFrontend(dist: string, { siteUrl: valorSiteUrl, log = console }: OpcionesFrontend = {}) {
  const siteUrl = leerSiteUrl(valorSiteUrl);
  if (!siteUrl) {
    log.warn(
      valorSiteUrl?.trim()
        ? `⚠ [SEO] SITE_URL="${valorSiteUrl.trim()}" no es un dominio válido (ej. https://www.midominio.com): sin sitemap.xml ni URLs canónicas.`
        : "⚠ [SEO] Falta SITE_URL (ej. https://www.midominio.com): sin sitemap.xml ni URLs canónicas."
    );
  }

  const raiz = resolve(dist);
  const dirAssets = resolve(raiz, "assets");
  const archivos = [...new Bun.Glob("**/*").scanSync({ cwd: raiz, dot: false })].map((a) => a.replaceAll("\\", "/"));
  const archivosAssets = archivos.filter((a) => a.startsWith("assets/") && !a.slice(7).includes("/")).map((a) => a.slice(7));

  // index.html se lee y comprime una vez (la primera petición) y el <head> de cada página se
  // arma una sola vez: después cada respuesta sale de memoria.
  let plantilla: Promise<string> | undefined;
  const leerPlantilla = () => (plantilla ??= Bun.file(`${raiz}/index.html`).text());
  let plantillaComprimida: Promise<Comprimido> | undefined;
  const htmlPorRuta = new Map<string, Promise<Comprimido>>();

  // Precarga de la foto principal de cada página pública (ver data/paginas.ts).
  const precargas = new Map<string, string>();
  for (const [ruta, datos] of Object.entries(PAGINAS_PUBLICAS)) {
    if (!datos.fotoPrincipal) continue;
    const etiqueta = precargaFoto(datos.fotoPrincipal, archivosAssets);
    if (etiqueta) precargas.set(ruta, etiqueta);
    else log.warn(`⚠ [Rendimiento] No hay versiones de "${datos.fotoPrincipal.nombre}" en ${dist}/assets: ${ruta} se sirve sin precargar su foto principal.`);
  }

  const html = (cuerpo: Comprimido, acceptEncoding: string | null, status = 200, extra: Record<string, string> = {}) =>
    responderComprimido(cuerpo, acceptEncoding, { status, headers: { "content-type": "text/html; charset=utf-8", ...extra } });

  const pagina = async ({ path, request }: { path: string; request: Request }) => {
    if (esRutaApi(path)) throw new ApiError(404, "Ruta no encontrada.");
    const ae = request.headers.get("accept-encoding");
    const ruta = normalizarRuta(path);
    const datos = paginaPublica(ruta);
    if (datos) {
      let cuerpo = htmlPorRuta.get(ruta);
      if (!cuerpo) {
        cuerpo = leerPlantilla().then((p) => {
          let conHead = htmlConHead(p, ruta, datos, siteUrl);
          const etiqueta = precargas.get(ruta);
          if (etiqueta) conHead = agregarAlHead(conHead, etiqueta);
          return comprimir(conHead);
        });
        htmlPorRuta.set(ruta, cuerpo);
      }
      return html(await cuerpo, ae);
    }
    const index = await (plantillaComprimida ??= leerPlantilla().then(comprimir));
    if (esRutaAdmin(ruta)) return html(index, ae, 200, { "x-robots-tag": NOINDEX });
    return html(index, ae, 404, { "x-robots-tag": NOINDEX });
  };

  // Archivos de texto (JS, CSS, SVG…): rutas propias para enviarlos comprimidos. Se empiezan
  // a comprimir al arrancar, así la primera visita no espera.
  const textos = new Elysia({ name: "frontend-textos" });
  for (const archivo of archivos) {
    if (!EXTENSIONES_COMPRIMIBLES.test(archivo)) continue;
    const file = Bun.file(`${raiz}/${archivo}`);
    const listo = file.bytes().then(async (bytes) => ({ comprimido: await comprimir(bytes), etag: `W/"${Bun.hash(bytes).toString(36)}"` }));
    listo.catch(() => {});
    const headers = {
      "content-type": file.type,
      "cache-control": archivo.startsWith("assets/") ? CACHE_ASSETS : `public, max-age=${MAX_AGE_RESTO}`,
    };
    textos.get(`/${archivo}`, async ({ request }) => {
      const { comprimido, etag } = await listo;
      if (request.headers.get("if-none-match")?.split(",").some((e) => e.trim() === etag)) {
        return new Response(null, { status: 304, headers: { etag, "cache-control": headers["cache-control"], vary: "Accept-Encoding" } });
      }
      return responderComprimido(comprimido, request.headers.get("accept-encoding"), { headers: { ...headers, etag } });
    });
  }

  // El resto (imágenes, fuentes…) ya viene comprimido: lo sirve staticPlugin tal cual. Se
  // excluyen los archivos de texto (rutas de arriba) e index.html (lo sirve el comodín de abajo
  // con el <head> de cada página).
  const ignorar = [".DS_Store", ".git", ".env", /[\\/]index\.html$/, EXTENSIONES_COMPRIMIBLES];
  const dentroDeAssets = new RegExp(`^${escaparRegex(dirAssets)}[\\\\/]`);

  // Cada staticPlugin va en su propia instancia: dos en la misma se quedan colgados al
  // cargar (@elysiajs/static 1.4.10). alwaysStatic: una ruta por archivo (en producción ya es
  // el modo por defecto). Sin esto, fuera de producción el plugin usa un comodín "/*" que el
  // de abajo reemplaza.
  const archivosAssetsEstaticos = new Elysia({ name: "frontend-assets" }).use(
    staticPlugin({
      assets: dirAssets,
      prefix: "/assets",
      indexHTML: false,
      alwaysStatic: true,
      headers: { "Cache-Control": CACHE_ASSETS },
      ignorePatterns: ignorar,
    })
  );
  const archivosRaiz = new Elysia({ name: "frontend-raiz" }).use(
    staticPlugin({
      assets: raiz,
      prefix: "/",
      indexHTML: false,
      alwaysStatic: true,
      maxAge: MAX_AGE_RESTO,
      ignorePatterns: [...ignorar, dentroDeAssets],
    })
  );

  return (
    new Elysia({ name: "frontend" })
      .use(textos)
      .use(archivosAssetsEstaticos)
      .use(archivosRaiz)
      .get("/robots.txt", () => new Response(robotsTxt(siteUrl), { headers: { "content-type": "text/plain; charset=utf-8" } }))
      .get("/sitemap.xml", () => {
        if (!siteUrl) throw new ApiError(404, "Ruta no encontrada.");
        return new Response(sitemapXml(siteUrl), { headers: { "content-type": "application/xml; charset=utf-8" } });
      })
      .get("/index.html", ({ redirect }) => redirect("/", 301))
      .get("/", pagina)
      .get("/*", pagina)
  );
}
