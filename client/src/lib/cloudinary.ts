// Las fotos de la galería se guardan en Cloudinary con su tamaño original (hasta 10 MB).
// Cloudinary puede entregar otra versión cambiando la URL: f_auto elige el formato más
// liviano que acepta el navegador (AVIF/WebP), q_auto la calidad mínima sin pérdida visible
// y c_limit,w_N reduce a N px de ancho sin recortar ni agrandar nunca la original.
const SEGMENTO = "/image/upload/";

export const ANCHOS_GALERIA = [400, 600, 800, 1200];

function esCloudinary(url: string): boolean {
  return url.startsWith("https://res.cloudinary.com/") && url.includes(SEGMENTO);
}

// URL de la foto a `ancho` px como máximo. Una URL que no es de Cloudinary se devuelve igual.
export function urlCloudinary(url: string, ancho: number): string {
  if (!esCloudinary(url)) return url;
  return url.replace(SEGMENTO, `${SEGMENTO}f_auto,q_auto,c_limit,w_${ancho}/`);
}

// srcset con una versión por ancho; undefined si la URL no es de Cloudinary (se usa solo src).
export function srcSetCloudinary(url: string, anchos: number[] = ANCHOS_GALERIA): string | undefined {
  if (!esCloudinary(url)) return undefined;
  return anchos.map((ancho) => `${urlCloudinary(url, ancho)} ${ancho}w`).join(", ");
}
