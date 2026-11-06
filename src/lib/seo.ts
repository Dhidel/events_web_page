import { PAGINAS_PUBLICAS, type PaginaPublica } from "../../client/src/data/paginas";
import { normalizarOrigen } from "./seguridadHttp";

// SEO del sitio público: robots.txt, sitemap.xml y el <head> de cada página.
// Todas las URLs absolutas salen de SITE_URL (variable de entorno), NUNCA del header Host
// de la petición: el Host lo escribe el visitante y, con una caché delante, un Host falso
// terminaría en los enlaces que ven todos (host header injection).

export { PAGINAS_PUBLICAS };

// Imagen de la vista previa al compartir un enlace (WhatsApp, Facebook…). Está en
// client/public, así que se sirve en la raíz con un nombre fijo.
export const IMAGEN_VISTA_PREVIA = "/og-image.jpg";

// "https://www.midominio.com/" → "https://www.midominio.com". null si falta o no es válida.
export function leerSiteUrl(valor: string | undefined): string | null {
  return valor?.trim() ? normalizarOrigen(valor) : null;
}

// "/servicios/" → "/servicios" (la raíz se queda "/").
export function normalizarRuta(ruta: string): string {
  return ruta.length > 1 ? ruta.replace(/\/+$/, "") || "/" : ruta;
}

export function paginaPublica(ruta: string): PaginaPublica | undefined {
  return Object.hasOwn(PAGINAS_PUBLICAS, ruta) ? PAGINAS_PUBLICAS[ruta] : undefined;
}

// El panel admin: no se indexa, pero tiene que seguir cargando (React decide la pantalla).
export function esRutaAdmin(ruta: string): boolean {
  return ruta === "/admin" || ruta.startsWith("/admin/");
}

// Para meter texto en HTML o XML sin que pueda cerrar la etiqueta o el atributo (XSS).
export function escaparHtml(texto: string): string {
  return texto
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

// No se bloquea /admin a propósito: si Google no puede rastrearlo, tampoco ve el
// "noindex" que lleva cada respuesta del admin, y la URL podría aparecer igual en
// resultados (enlazada desde otro sitio). Sin SITE_URL se omite la línea del sitemap.
export function robotsTxt(siteUrl: string | null): string {
  const lineas = ["User-agent: *", "Allow: /", "Disallow: /api/"];
  if (siteUrl) lineas.push("", `Sitemap: ${siteUrl}/sitemap.xml`);
  return lineas.join("\n") + "\n";
}

export function sitemapXml(siteUrl: string): string {
  const urls = Object.keys(PAGINAS_PUBLICAS)
    .map((ruta) => `  <url><loc>${escaparHtml(siteUrl + (ruta === "/" ? "/" : ruta))}</loc></url>`)
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
}

// Reemplaza el <title> de index.html por el de la página y agrega descripción, canonical
// y Open Graph (vista previa al compartir). Sin SITE_URL se omiten las etiquetas que
// necesitan una URL absoluta.
export function htmlConHead(plantilla: string, ruta: string, pagina: PaginaPublica, siteUrl: string | null): string {
  const title = escaparHtml(pagina.title);
  const description = escaparHtml(pagina.description);
  const etiquetas = [
    `<title>${title}</title>`,
    `<meta name="description" content="${description}" />`,
    `<meta property="og:type" content="website" />`,
    `<meta property="og:locale" content="es_GT" />`,
    `<meta property="og:site_name" content="Show Company" />`,
    `<meta property="og:title" content="${title}" />`,
    `<meta property="og:description" content="${description}" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
  ];
  if (siteUrl) {
    const url = escaparHtml(siteUrl + (ruta === "/" ? "/" : ruta));
    etiquetas.push(
      `<link rel="canonical" href="${url}" />`,
      `<meta property="og:url" content="${url}" />`,
      `<meta property="og:image" content="${escaparHtml(siteUrl + IMAGEN_VISTA_PREVIA)}" />`
    );
  }
  const head = etiquetas.join("\n    ");
  // Función como reemplazo: así un "$" en los textos no se interpreta como patrón.
  if (/<title>[\s\S]*?<\/title>/i.test(plantilla)) return plantilla.replace(/<title>[\s\S]*?<\/title>/i, () => head);
  return plantilla.replace(/<\/head>/i, () => `${head}\n  </head>`);
}
