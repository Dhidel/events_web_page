import { Elysia } from "elysia";
import { staticPlugin } from "@elysiajs/static";
import { ApiError } from "./errors";
import { esRutaAdmin, htmlConHead, leerSiteUrl, normalizarRuta, paginaPublica, robotsTxt, sitemapXml } from "./seo";

// Rutas de la API: "/api" y todo lo que empieza con "/api/". "/apixyz" NO es de la API.
export function esRutaApi(ruta: string): boolean {
  return ruta === "/api" || ruta.startsWith("/api/");
}

const NOINDEX = "noindex, nofollow";

interface OpcionesFrontend {
  // Valor de SITE_URL (dominio público, ej. https://www.midominio.com). Sin él no hay
  // sitemap ni URLs absolutas (canonical, og:url, og:image).
  siteUrl?: string;
  log?: Pick<Console, "warn">;
}

// En producción este servidor sirve también el frontend (client/dist): los archivos
// estáticos y, para el resto de rutas, index.html (React Router decide qué pantalla
// mostrar). Según la ruta:
// - página pública (src/lib/seo.ts): 200 con su título, descripción y canonical en el <head>;
// - /admin y /admin/*: 200 con index.html tal cual y X-Robots-Tag: noindex;
// - cualquier otra: 404 (con index.html, para que React muestre su pantalla) y noindex;
// - /api/* inexistente: 404 { error } en JSON.
export function servirFrontend(dist: string, { siteUrl: valorSiteUrl, log = console }: OpcionesFrontend = {}) {
  const siteUrl = leerSiteUrl(valorSiteUrl);
  if (!siteUrl) {
    log.warn(
      valorSiteUrl?.trim()
        ? `⚠ [SEO] SITE_URL="${valorSiteUrl.trim()}" no es un dominio válido (ej. https://www.midominio.com): sin sitemap.xml ni URLs canónicas.`
        : "⚠ [SEO] Falta SITE_URL (ej. https://www.midominio.com): sin sitemap.xml ni URLs canónicas."
    );
  }

  // index.html se lee una vez (la primera petición) y el <head> de cada página se arma
  // una sola vez: después cada respuesta sale de memoria.
  let plantilla: Promise<string> | undefined;
  const leerPlantilla = () => (plantilla ??= Bun.file(`${dist}/index.html`).text());
  const htmlPorRuta = new Map<string, string>();

  const html = (cuerpo: string, status = 200, extra: Record<string, string> = {}) =>
    new Response(cuerpo, { status, headers: { "content-type": "text/html; charset=utf-8", ...extra } });

  const pagina = async ({ path }: { path: string }) => {
    if (esRutaApi(path)) throw new ApiError(404, "Ruta no encontrada.");
    const ruta = normalizarRuta(path);
    const datos = paginaPublica(ruta);
    if (datos) {
      let cuerpo = htmlPorRuta.get(ruta);
      if (!cuerpo) htmlPorRuta.set(ruta, (cuerpo = htmlConHead(await leerPlantilla(), ruta, datos, siteUrl)));
      return html(cuerpo);
    }
    if (esRutaAdmin(ruta)) return html(await leerPlantilla(), 200, { "x-robots-tag": NOINDEX });
    return html(await leerPlantilla(), 404, { "x-robots-tag": NOINDEX });
  };

  return (
    new Elysia({ name: "frontend" })
      // alwaysStatic: una ruta por archivo (en producción ya es el modo por defecto). Sin
      // esto, fuera de producción el plugin usa un comodín "/*" que el de abajo reemplaza.
      // index.html se excluye: lo sirve el comodín de abajo con el <head> de cada página.
      .use(
        staticPlugin({
          assets: dist,
          prefix: "/",
          indexHTML: false,
          alwaysStatic: true,
          ignorePatterns: [".DS_Store", ".git", ".env", /[\\/]index\.html$/],
        })
      )
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
