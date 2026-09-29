// Guardar la cotización y *después* abrir WhatsApp tiene un problema: los navegadores
// solo permiten window.open() durante el clic del usuario (la "activación transitoria").
// Safari la pierde en cuanto hay un await de por medio, y Chrome/Firefox a los pocos
// segundos, así que un window.open() al volver del fetch puede quedar bloqueado.
// Solución: abrir una pestaña en blanco en el mismo clic y, cuando responde el servidor,
// mandarla a WhatsApp (si se guardó) o cerrarla (si falló).

export type ResultadoConfirmacion =
  | { ok: true; whatsappAbierto: boolean }
  | { ok: false; error: string };

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
export async function guardarYAbrirWhatsApp({
  waHref,
  guardar,
  abrirPestana = abrirPestanaEnEspera,
}: {
  waHref: string;
  guardar: () => Promise<unknown>;
  abrirPestana?: () => Window | null;
}): Promise<ResultadoConfirmacion> {
  const pestana = abrirPestana();

  try {
    await guardar();
  } catch (error) {
    // No se abre WhatsApp si la cotización no quedó guardada.
    pestana?.close();
    return { ok: false, error: mensajeDeError(error) };
  }

  // El usuario pudo cerrar la pestaña de espera mientras se guardaba.
  if (!pestana || pestana.closed) return { ok: true, whatsappAbierto: false };
  return { ok: true, whatsappAbierto: navegarAWhatsApp(pestana, waHref) };
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
