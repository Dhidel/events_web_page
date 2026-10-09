import { Elysia } from "elysia";
import { cors } from "@elysiajs/cors";

// CORS y HSTS de la API ([14.2]). Se arma aparte de index.ts para poder probarlo sin
// conectarse a la base ni levantar el servidor.

export const DEV_ORIGIN = "http://localhost:5173";

// 180 días. Sin includeSubDomains ni preload hasta conocer el dominio final: son difíciles
// de revertir (el navegador del visitante lo recuerda).
export const HSTS = "max-age=15552000";

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
function normalizarOrigen(valor: string): string | null {
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

  // HSTS solo en producción: le dice al navegador que use siempre HTTPS con este dominio.
  // Solo tiene efecto si la respuesta llega por HTTPS (lo termina el hosting).
  if (produccion) {
    plugin.onRequest(({ set }) => {
      set.headers["strict-transport-security"] = HSTS;
    });
  }

  return plugin;
}
