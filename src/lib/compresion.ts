import { brotliCompress, constants, gzip } from "node:zlib";
import { promisify } from "node:util";

// Compresión de las respuestas de texto del frontend (JS, CSS, SVG, HTML). Bun no comprime
// por su cuenta: sin esto el JS del sitio (~340 KB) viaja entero en vez de ~100 KB.
// Cada contenido se comprime una sola vez (los archivos de client/dist no cambian mientras
// el servidor corre) y después se sirve desde memoria.

const brotli = promisify(brotliCompress);
const gzipAsync = promisify(gzip);

// Extensiones que vale la pena comprimir (las imágenes ya vienen comprimidas).
export const EXTENSIONES_COMPRIMIBLES = /\.(js|mjs|css|svg|json|webmanifest)$/i;

// Por debajo de esto el ahorro no compensa (los headers pesan más que lo que se ahorra).
const MINIMO_BYTES = 1024;

export interface Comprimido {
  original: Uint8Array;
  br?: Uint8Array;
  gzip?: Uint8Array;
}

export async function comprimir(contenido: string | Uint8Array): Promise<Comprimido> {
  const original = typeof contenido === "string" ? new TextEncoder().encode(contenido) : contenido;
  if (original.byteLength < MINIMO_BYTES) return { original };
  const [br, gz] = await Promise.all([
    // Calidad máxima: se paga una sola vez por archivo.
    brotli(original, { params: { [constants.BROTLI_PARAM_QUALITY]: 11 } }),
    gzipAsync(original, { level: 9 }),
  ]);
  return { original, br: new Uint8Array(br), gzip: new Uint8Array(gz) };
}

// Codificación a usar según el header Accept-Encoding del navegador: br si lo acepta, si no
// gzip, si no ninguna. "q=0" significa "no la aceptes".
export function elegirCodificacion(acceptEncoding: string | null | undefined): "br" | "gzip" | null {
  const aceptadas = new Set<string>();
  for (const parte of (acceptEncoding ?? "").toLowerCase().split(",")) {
    const [nombre, ...params] = parte.trim().split(";");
    const q = params.map((p) => p.trim()).find((p) => p.startsWith("q="));
    if (nombre && !(q && Number(q.slice(2)) === 0)) aceptadas.add(nombre.trim());
  }
  if (aceptadas.has("br")) return "br";
  if (aceptadas.has("gzip")) return "gzip";
  return null;
}

// Respuesta con la versión comprimida que acepte el navegador. Vary: Accept-Encoding avisa a
// los cachés intermedios que la respuesta depende de ese header.
export function responderComprimido(
  comprimido: Comprimido,
  acceptEncoding: string | null | undefined,
  init: { status?: number; headers: Record<string, string> }
): Response {
  const codificacion = elegirCodificacion(acceptEncoding);
  const cuerpo = codificacion ? comprimido[codificacion] : undefined;
  const headers: Record<string, string> = { ...init.headers, vary: "Accept-Encoding" };
  if (cuerpo && codificacion) headers["content-encoding"] = codificacion;
  return new Response(cuerpo ?? comprimido.original, { status: init.status ?? 200, headers });
}
