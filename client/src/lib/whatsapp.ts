// Guardar la cotización y *después* abrir WhatsApp tiene un problema: los navegadores
// solo permiten window.open() durante el clic del usuario (la "activación transitoria").
// Safari la pierde en cuanto hay un await de por medio, y Chrome/Firefox a los pocos
// segundos, así que un window.open() al volver del fetch puede quedar bloqueado.
// Solución: abrir una pestaña en blanco en el mismo clic y, cuando responde el servidor,
// mandarla a WhatsApp (si se guardó) o cerrarla (si falló).

import { DemasiadasSolicitudesError } from "./api";

export type ResultadoConfirmacion<T = unknown> =
  | { ok: true; whatsappAbierto: boolean; guardado: T }
  // limite: el servidor respondió 429. Reintentar enseguida volvería a fallar.
  | { ok: false; error: string; limite?: true };

const WHATSAPP_NUMERO = (import.meta.env?.VITE_WHATSAPP_PHONE as string) || "50230738716";

export interface LineaEstimado {
  nombre: string;
  cantidad: number;
  subtotal: number;
}

// Redondea a centavos (igual que el servidor): sin esto, un precio con decimales deja
// montos como 0.30000000000000004.
export const redondearMonto = (monto: number) => Math.round((monto + Number.EPSILON) * 100) / 100;

// Mensaje que el cliente manda por WhatsApp con su estimado. Si marcó que el evento es fuera
// de la Ciudad Capital se avisa en una línea aparte (el traslado no está en el total).
export function mensajeEstimado(lineas: LineaEstimado[], total: number, fueraDeCapital = false): string {
  return (
    "Hola! Usé el cotizador del sitio y me interesa este estimado:\n" +
    lineas.map((l) => `${l.cantidad}x ${l.nombre} (Q${l.subtotal.toLocaleString("es-GT")})`).join("\n") +
    `\nTotal estimado: Q${total.toLocaleString("es-GT")}` +
    (fueraDeCapital ? "\nMi evento es fuera de la Ciudad Capital (traslado a cotizar aparte)." : "")
  );
}

export const enlaceWhatsApp = (mensaje: string) => `https://wa.me/${WHATSAPP_NUMERO}?text=${encodeURIComponent(mensaje)}`;

// Detalle que devuelve el servidor al guardar (calculado con los precios vigentes). Llega como
// objeto libre; devuelve null si no tiene la forma esperada.
export function leerEstimadoGuardado(
  detalle: unknown
): { lineas: LineaEstimado[]; total: number; fueraDeCapital: boolean } | null {
  const d = detalle as { personajes?: unknown; total?: unknown; fueraDeCapital?: unknown } | null | undefined;
  if (!d || !Array.isArray(d.personajes) || typeof d.total !== "number") return null;
  const lineas = d.personajes as Partial<LineaEstimado>[];
  const validas = lineas.every(
    (l) => typeof l?.nombre === "string" && typeof l.cantidad === "number" && typeof l.subtotal === "number"
  );
  return validas ? { lineas: lineas as LineaEstimado[], total: d.total, fueraDeCapital: d.fueraDeCapital === true } : null;
}

// Pestaña de espera. Devuelve null si el navegador la bloqueó igual.
//
// Ojo: aquí NO se corta pestana.opener. Chrome solo deja que esta página navegue la
// pestaña si es del mismo origen o si es su opener; en algunos navegadores el about:blank
// no cuenta como mismo origen, y sin opener la navegación a WhatsApp se rechaza con
// SecurityError ("Unsafe attempt to initiate navigation..."). El opener se corta en
// navegarAWhatsApp, después de iniciar la navegación.
export function abrirPestanaEnEspera(): Window | null {
  const pestana = window.open("", "_blank");
  if (!pestana) return null;
  try {
    pestana.document.title = "Abriendo WhatsApp…";
    pestana.document.body.textContent = "Guardando tu cotización y abriendo WhatsApp…";
  } catch {
    // Solo es texto de cortesía: si no se puede escribir, la pestaña sigue sirviendo.
  }
  return pestana;
}

export function mensajeDeError(error: unknown): string {
  if (error instanceof DOMException && (error.name === "TimeoutError" || error.name === "AbortError")) {
    return "El servidor tardó demasiado en responder.";
  }
  // fetch lanza TypeError cuando no hay red o el servidor no responde.
  if (error instanceof TypeError) return "No pudimos conectar con el servidor.";
  if (error instanceof Error && error.message) return error.message;
  return "Ocurrió un error, intenta de nuevo.";
}

// Debe llamarse directamente desde el manejador del clic: la pestaña se abre de forma
// síncrona (antes del primer await), mientras el clic todavía cuenta como del usuario.
//
// `waHref` puede ser una función de lo que devolvió el servidor: así el mensaje de WhatsApp
// lleva el estimado que realmente quedó guardado (los precios pudieron cambiar desde que el
// cliente abrió la página).
export async function guardarYAbrirWhatsApp<T>({
  waHref,
  guardar,
  abrirPestana = abrirPestanaEnEspera,
}: {
  waHref: string | ((guardado: T) => string);
  guardar: () => Promise<T>;
  abrirPestana?: () => Window | null;
}): Promise<ResultadoConfirmacion<T>> {
  const pestana = abrirPestana();

  let guardado: T;
  try {
    guardado = await guardar();
  } catch (error) {
    // No se abre WhatsApp si la cotización no quedó guardada.
    pestana?.close();
    if (error instanceof DemasiadasSolicitudesError) return { ok: false, error: error.message, limite: true };
    return { ok: false, error: mensajeDeError(error) };
  }

  // El usuario pudo cerrar la pestaña de espera mientras se guardaba.
  if (!pestana || pestana.closed) return { ok: true, whatsappAbierto: false, guardado };
  const destino = typeof waHref === "function" ? waHref(guardado) : waHref;
  return { ok: true, whatsappAbierto: navegarAWhatsApp(pestana, destino), guardado };
}

// Manda la pestaña de espera a WhatsApp. Si el navegador no lo permite, la cierra (para no
// dejarla en about:blank) y devuelve false: la página muestra entonces un botón
// "Abrir WhatsApp", que al ser un clic directo del usuario siempre funciona.
function navegarAWhatsApp(pestana: Window, waHref: string): boolean {
  try {
    pestana.location.href = waHref;
  } catch {
    pestana.close();
    return false;
  }
  try {
    // Con la navegación ya iniciada, se corta el vínculo para que WhatsApp no tenga
    // acceso a esta página (window.opener). Si el navegador no deja tocarlo, no importa.
    pestana.opener = null;
  } catch {
    // Sin efecto en la navegación.
  }
  return true;
}