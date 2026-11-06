import { isIP } from "node:net";
import { ApiError } from "./errors";

// Límite de solicitudes por IP para el endpoint público de cotizaciones: sin él, un script
// puede llenar la bandeja del panel y agotar la cuota de correos de Resend.
// Es un contador en memoria (ventana deslizante): alcanza para un solo servidor, que es
// como corre este proyecto. Se reinicia al reiniciar el servidor.
//
// [14.3] También lo usa el login del panel (intentos fallidos) y define cómo se obtiene la
// IP real detrás del proxy del hosting (CLIENT_IP_HEADER / TRUST_PROXY_HOPS).

// Entero > 0 desde una variable de entorno; si falta o es inválido, el valor por defecto.
function enteroPositivo(nombre: string, porDefecto: number): number {
  const valor = process.env[nombre];
  if (valor === undefined || valor.trim() === "") return porDefecto;
  const n = Number(valor);
  if (Number.isInteger(n) && n > 0) return n;
  console.warn(`⚠ [Anti-spam] ${nombre}="${valor}" no es un entero > 0: se usa ${porDefecto}.`);
  return porDefecto;
}

export const MAX_SOLICITUDES_POR_IP = enteroPositivo("RATE_LIMIT_COTIZACIONES_MAX", 5);
export const VENTANA_SOLICITUDES_MS = enteroPositivo("RATE_LIMIT_COTIZACIONES_VENTANA_MIN", 10) * 60 * 1000;

// Login del panel: solo cuentan los intentos fallidos (401), por IP y no por correo (un
// límite por correo dejaría que cualquiera bloqueara al admin a propósito).
export const MAX_LOGIN_FALLIDOS_POR_IP = enteroPositivo("RATE_LIMIT_LOGIN_MAX", 10);
export const VENTANA_LOGIN_MS = enteroPositivo("RATE_LIMIT_LOGIN_VENTANA_MIN", 15) * 60 * 1000;

// Cada cuántos registros se barren las IP que ya no tienen envíos dentro de la ventana.
const LIMPIAR_CADA = 500;

export function crearLimite({ max, ventanaMs }: { max: number; ventanaMs: number }) {
  const envios = new Map<string, number[]>();
  let registros = 0;

  // Registra un intento de `clave` y devuelve false si ya superó el máximo en la ventana.
  function permitir(clave: string, ahora = Date.now()): boolean {
    const desde = ahora - ventanaMs;

    if (++registros % LIMPIAR_CADA === 0) {
      for (const [otra, tiempos] of envios) {
        if (tiempos.every((t) => t <= desde)) envios.delete(otra);
      }
    }

    const recientes = (envios.get(clave) ?? []).filter((t) => t > desde);
    if (recientes.length >= max) {
      envios.set(clave, recientes);
      return false;
    }
    recientes.push(ahora);
    envios.set(clave, recientes);
    return true;
  }

  return Object.assign(permitir, {
    // Segundos hasta que `clave` vuelva a tener cupo (0 si ya lo tiene). No registra nada:
    // sirve para el header Retry-After y para revisar antes de contar (login).
    esperaSegundos(clave: string, ahora = Date.now()): number {
      const recientes = (envios.get(clave) ?? []).filter((t) => t > ahora - ventanaMs);
      if (recientes.length < max) return 0;
      return Math.max(1, Math.ceil((recientes[recientes.length - max]! + ventanaMs - ahora) / 1000));
    },
    // Para las pruebas: vacía los contadores.
    reiniciar() {
      envios.clear();
      registros = 0;
    },
  });
}

// ---------------------------------------------------------------------------------------
// IP del cliente

// "1.2.3.4:5678" → "1.2.3.4"; "[2001:db8::1]:443" → "2001:db8::1"; "fe80::1%eth0" → "fe80::1".
// Devuelve null si no es una IP válida.
export function limpiarIp(valor: string): string | null {
  let ip = valor.trim();
  const conCorchetes = ip.match(/^\[([^\]]+)\](?::\d+)?$/);
  if (conCorchetes) ip = conCorchetes[1]!;
  else if (/^\d{1,3}(\.\d{1,3}){3}:\d+$/.test(ip)) ip = ip.slice(0, ip.lastIndexOf(":"));
  ip = ip.replace(/%.*$/, "");
  return isIP(ip) ? ip : null;
}

// TRUST_PROXY_HOPS: entero >= 0. Un valor inválido se trata como 0 (no confiar en el header).
export function leerTrustProxyHops(valor: string | undefined, log: Pick<Console, "warn"> = console): number {
  if (valor === undefined || valor.trim() === "") return 0;
  const n = Number(valor);
  if (Number.isInteger(n) && n >= 0) return n;
  log.warn(`⚠ [Anti-spam] TRUST_PROXY_HOPS="${valor}" no es un entero >= 0: se usa 0 (X-Forwarded-For se ignora).`);
  return 0;
}

export const configuracionIp = {
  header: process.env.CLIENT_IP_HEADER?.trim().toLowerCase() || "",
  hops: leerTrustProxyHops(process.env.TRUST_PROXY_HOPS),
};

// IP del visitante. Detrás del proxy del hosting, la IP de la conexión es la del proxy (la
// misma para todos), así que se toma de lo que agrega el proxy, en este orden:
// 1. CLIENT_IP_HEADER definida (ej. "cf-connecting-ip", "x-real-ip", "fly-client-ip"): ese
//    header. Solo es seguro si el hosting lo sobrescribe siempre.
// 2. TRUST_PROXY_HOPS = N > 0: la entrada de X-Forwarded-For en la posición (largo − N), la
//    que agregó el proxy más cercano. Los proxies AGREGAN la IP al final, así que lo que el
//    visitante escriba más a la izquierda se ignora y no puede falsificarla.
// 3. Si no (o si lo anterior falta o no es una IP): la IP de la conexión. Con N = 0 (por
//    defecto) X-Forwarded-For se ignora por completo.
// Devuelve null si no se puede saber (p. ej. en las pruebas con app.handle).
export function ipDelCliente(
  request: Request,
  ipConexion?: string | null,
  headerConfigurado: string | undefined = configuracionIp.header,
  hops: number = configuracionIp.hops
): string | null {
  const header = headerConfigurado?.trim().toLowerCase();
  if (header) {
    const valor = request.headers.get(header)?.split(",")[0];
    const ip = valor ? limpiarIp(valor) : null;
    if (ip) return ip;
  } else if (hops > 0) {
    const saltos = (request.headers.get("x-forwarded-for") ?? "")
      .split(",")
      .map((s: string) => s.trim())
      .filter(Boolean);
    if (saltos.length >= hops) {
      const ip = limpiarIp(saltos[saltos.length - hops]!);
      if (ip) return ip;
    }
  }
  return ipConexion ? limpiarIp(ipConexion) : null;
}

// Expande "2001:db8::1" a sus 8 grupos de 4 dígitos.
function expandirIpv6(ip: string): string[] {
  const [izquierda, derecha] = ip.includes("::") ? ip.split("::") : [ip, undefined];
  const izq = izquierda ? izquierda.split(":") : [];
  const der = derecha ? derecha.split(":") : [];
  const ceros = derecha === undefined ? [] : Array(8 - izq.length - der.length).fill("0");
  return [...izq, ...ceros, ...der].map((g) => g.padStart(4, "0").toLowerCase());
}

// Clave del limitador para una IP. IPv6 se agrupa por /64: una conexión doméstica recibe
// un bloque /64 entero y podría rotar direcciones dentro de él para saltarse el límite.
export function claveDeIp(ip: string): string {
  const mapeada = ip.match(/^::ffff:(\d{1,3}(\.\d{1,3}){3})$/i);
  if (mapeada) return mapeada[1]!;
  if (isIP(ip) === 6) return `${expandirIpv6(ip).slice(0, 4).join(":")}::/64`;
  return ip;
}

// Rangos de red interna (privados, loopback, link-local, CGNAT). Si la IP "del cliente" cae
// aquí en producción, casi seguro es la del proxy: la configuración de la IP está mal.
export function esIpInterna(ip: string): boolean {
  if (isIP(ip) === 4) {
    const [a, b] = ip.split(".").map(Number) as [number, number];
    return a === 10 || a === 127 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 169 && b === 254) || (a === 100 && b >= 64 && b <= 127);
  }
  const primero = expandirIpv6(ip)[0]!;
  return ip === "::1" || primero.startsWith("fc") || primero.startsWith("fd") || primero.startsWith("fe8");
}

// Cómo se está obteniendo la IP, para el log de arranque.
export function describirConfiguracionIp({ header, hops } = configuracionIp): { texto: string; advertencia: boolean } {
  if (header) return { texto: `CLIENT_IP_HEADER=${header} (la IP sale de ese header; TRUST_PROXY_HOPS no se usa)`, advertencia: false };
  if (hops > 0) return { texto: `TRUST_PROXY_HOPS=${hops} (la IP sale de X-Forwarded-For, ${hops} salto(s) desde el final)`, advertencia: false };
  return {
    texto:
      "CLIENT_IP_HEADER vacía y TRUST_PROXY_HOPS=0: se usa la IP de la conexión y X-Forwarded-For se ignora. " +
      "Si hay un proxy delante (casi todos los hostings), TODOS los visitantes compartirán el límite: " +
      "define TRUST_PROXY_HOPS=1 o CLIENT_IP_HEADER.",
    advertencia: true,
  };
}

// ---------------------------------------------------------------------------------------
// Límite por IP para una ruta (usa crearLimite)

// Si no se puede saber la IP, esas peticiones comparten una clave. Para no bloquear a todos
// a la vez por culpa de unos pocos, esa clave tiene una cuota este múltiplo de mayor.
export const FACTOR_IP_DESCONOCIDA = 10;
export const CLAVE_IP_DESCONOCIDA = "desconocida";

// Avisos de una sola vez por proceso.
const avisos = { ipDesconocida: false, primeraIp: false };
const produccion = process.env.NODE_ENV === "production";

export interface ContextoPeticion {
  request: Request;
  server: { requestIP(request: Request): { address: string } | null } | null;
  set: { headers: Record<string, string | number> };
}

function claveDePeticion({ request, server }: ContextoPeticion): string {
  const ip = ipDelCliente(request, server?.requestIP(request)?.address);

  if (!ip) {
    if (!avisos.ipDesconocida) {
      avisos.ipDesconocida = true;
      console.warn(
        `⚠ [Anti-spam] No se pudo determinar la IP de una petición: esas peticiones comparten una cuota ` +
          `${FACTOR_IP_DESCONOCIDA} veces mayor. Si se repite en producción, revisa CLIENT_IP_HEADER / TRUST_PROXY_HOPS.`
      );
    }
    return CLAVE_IP_DESCONOCIDA;
  }

  // Al desplegar: confirmar que la IP detectada es la del visitante y no la del proxy. Se
  // dice si es pública o interna y con qué configuración, nunca la IP (dato personal).
  if (produccion && !avisos.primeraIp) {
    avisos.primeraIp = true;
    const config = describirConfiguracionIp().texto;
    if (esIpInterna(ip)) {
      console.warn(
        `⚠ [Anti-spam] CONFIGURACIÓN DE IP INCORRECTA: la primera IP de cliente detectada es de red interna, ` +
          `así que casi seguro es la del proxy y todos los visitantes comparten el límite. Configuración actual: ${config}`
      );
    } else {
      console.log(`[Anti-spam] Primera IP de cliente detectada: es pública (configuración correcta). ${config}`);
    }
  }

  return claveDeIp(ip);
}

export function limitePorIp({ max, ventanaMs, mensaje }: { max: number; ventanaMs: number; mensaje: string }) {
  const porIp = crearLimite({ max, ventanaMs });
  const desconocida = crearLimite({ max: max * FACTOR_IP_DESCONOCIDA, ventanaMs });
  const limiteDe = (clave: string) => (clave === CLAVE_IP_DESCONOCIDA ? desconocida : porIp);

  // Lanza 429 { error } con Retry-After si la IP ya agotó su cuota. No registra el intento.
  function verificar(ctx: ContextoPeticion): string {
    const clave = claveDePeticion(ctx);
    const espera = limiteDe(clave).esperaSegundos(clave);
    if (espera > 0) {
      ctx.set.headers["retry-after"] = String(espera);
      throw new ApiError(429, mensaje);
    }
    return clave;
  }

  return {
    max,
    ventanaMinutos: ventanaMs / 60_000,
    verificar,
    // Cuenta el intento sin revisar (login: solo se cuentan los fallidos).
    registrar(ctx: ContextoPeticion) {
      const clave = claveDePeticion(ctx);
      limiteDe(clave)(clave);
    },
    // Revisa y, si hay cupo, cuenta el intento.
    verificarYRegistrar(ctx: ContextoPeticion) {
      const clave = verificar(ctx);
      limiteDe(clave)(clave);
    },
    reiniciar() {
      porIp.reiniciar();
      desconocida.reiniciar();
    },
  };
}

export const limiteCotizaciones = limitePorIp({
  max: MAX_SOLICITUDES_POR_IP,
  ventanaMs: VENTANA_SOLICITUDES_MS,
  mensaje: "Recibimos varias solicitudes seguidas desde tu conexión. Espera unos minutos e intenta de nuevo.",
});

export const limiteLogin = limitePorIp({
  max: MAX_LOGIN_FALLIDOS_POR_IP,
  ventanaMs: VENTANA_LOGIN_MS,
  mensaje: "Demasiados intentos de inicio de sesión. Espera unos minutos e intenta de nuevo.",
});

// Para las pruebas: vacía todos los contadores y vuelve a mostrar los avisos de una sola vez.
export function reiniciarLimites() {
  limiteCotizaciones.reiniciar();
  limiteLogin.reiniciar();
  avisos.ipDesconocida = false;
  avisos.primeraIp = false;
}
