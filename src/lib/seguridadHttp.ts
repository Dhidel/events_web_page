import { Elysia } from "elysia";
import { cors } from "@elysiajs/cors";

// CORS, HSTS y demás headers de seguridad ([14.2]). Se arma aparte de index.ts para poder probarlo sin
// conectarse a la base ni levantar el servidor.

export const DEV_ORIGIN = "http://localhost:5173";

// 180 días. Sin includeSubDomains ni preload hasta conocer el dominio final: son difíciles
// de revertir (el navegador del visitante lo recuerda).
export const HSTS = "max-age=15552000";

// Content-Security-Policy: de dónde puede cargar cosas el sitio. Si alguien lograra meter un
// <script> en la página (XSS), el navegador no lo ejecuta ni lo deja mandar datos a otro
// dominio. Lo único externo que usa el sitio: Google Fonts (CSS y fuentes) y las fotos de
// la galería en Cloudinary. 'unsafe-inline' solo en estilos (los style={{...}} de React).
// Si se agrega un servicio externo (p. ej. un video de YouTube embebido), hay que sumarlo aquí.
export const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com",
  "img-src 'self' data: https://res.cloudinary.com",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

// Headers de seguridad que se envían en producción en todas las respuestas (API y sitio).
export const HEADERS_SEGURIDAD = {
  "strict-transport-security": HSTS,
  "content-security-policy": CSP,
  // Nadie puede mostrar el sitio dentro de un <iframe> (clickjacking del panel admin).
  // frame-ancestors en la CSP hace lo mismo; este es para navegadores viejos.
  "x-frame-options": "DENY",
  // El navegador no "adivina" el tipo de un archivo: un JSON nunca se ejecuta como script.
  "x-content-type-options": "nosniff",
  // A otros sitios (WhatsApp, redes) solo se les dice el dominio de origen, nunca la ruta.
  "referrer-policy": "strict-origin-when-cross-origin",
} as const;

// Tope del body por petición ([14.4]). Lo más grande que acepta la API es la subida de una
// imagen de la galería (10 MB) más el resto del formulario; sin tope propio, Bun acepta hasta
// 128 MB y la API los procesaría antes de rechazarlos. Al pasarse, Bun responde 413 antes de
// llegar a Elysia (sin el formato { error }; ver README).
export const MAX_BODY_BYTES = 12 * 1024 * 1024;

// Lo que usa el frontend (Contacto, Cotizador, login y panel admin). El JWT del panel viaja
// en Authorization (no en cookies), por eso credentials va en false.
const METODOS = ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"];
const HEADERS = ["Content-Type", "Authorization"];

interface Opciones {
  produccion: boolean;
  // Valor de CORS_ORIGIN: uno o varios orígenes separados por coma.
  corsOrigin?: string;
  log?: Pick<Console, "warn" | "log">;
}

// "https://midominio.com/" → "https://midominio.com". Devuelve null si no es un origen
// (protocolo + dominio [+ puerto], sin ruta ni query).
export function normalizarOrigen(valor: string): string | null {
  const limpio = valor.trim().replace(/\/+$/, "");
  try {
    const url = new URL(limpio);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return url.origin === limpio ? limpio : null;
  } catch {
    return null;
  }
}

export function origenesPermitidos({ produccion, corsOrigin, log = console }: Opciones): string[] {
  const configurados: string[] = [];
  for (const valor of (corsOrigin ?? "").split(",")) {
    if (!valor.trim()) continue;
    const origen = normalizarOrigen(valor);
    if (origen) configurados.push(origen);
    else log.warn(`⚠ [CORS] Se ignora "${valor.trim()}" en CORS_ORIGIN: no es un origen válido (ej. https://midominio.com).`);
  }

  // En desarrollo el frontend de Vite siempre puede llamar a la API, aunque el .env
  // traiga un CORS_ORIGIN de producción copiado de .env.example.
  const origenes = produccion ? configurados : [DEV_ORIGIN, ...configurados];
  return [...new Set(origenes)];
}

export function seguridadHttp(opciones: Opciones) {
  const { produccion, log = console } = opciones;
  const origenes = origenesPermitidos(opciones);
  const plugin = new Elysia({ name: "seguridad-http" });

  if (origenes.length > 0) {
    plugin.use(
      cors({
        origin: origenes,
        methods: METODOS,
        allowedHeaders: HEADERS,
        credentials: false,
        exposeHeaders: [],
      })
    );
    if (produccion) log.log(`[CORS] Orígenes permitidos: ${origenes.join(", ")}`);
  } else {
    // Sin el plugin no sale ningún header de CORS: el navegador solo deja usar la API a
    // páginas del mismo dominio (en producción este servidor sirve también el frontend).
    log.warn(
      "⚠ [CORS] CORS_ORIGIN no está definida: no se permite ningún origen externo. " +
        "La API solo funciona desde el mismo dominio que la sirve. Si el frontend está en otro " +
        "dominio, define CORS_ORIGIN (ej. CORS_ORIGIN=https://www.midominio.com)."
    );
  }

  // Solo en producción: en desarrollo la CSP bloquearía /swagger (carga scripts de un CDN).
  // HSTS le dice al navegador que use siempre HTTPS con este dominio; solo tiene efecto si la
  // respuesta llega por HTTPS (lo termina el hosting).
  if (produccion) {
    plugin.onRequest(({ set }) => {
      Object.assign(set.headers, HEADERS_SEGURIDAD);
    });
  }

  return plugin;
}
