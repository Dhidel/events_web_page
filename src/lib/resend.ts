import { Resend } from "resend";

const apiKey = process.env.RESEND_API_KEY;

if (!apiKey) {
  console.warn("⚠ [Resend] Advertencia: RESEND_API_KEY no está configurada en el archivo .env.");
}

function crearCliente(key: string): Resend {
  const cliente = new Resend(key);
  // Fuera de producción el SDK imprime la respuesta de error completa de Resend, sin
  // enmascarar (puede traer correos). Se silencia: email.service lanza el error y quien lo
  // atrapa lo registra con safeErrorLog.
  (cliente as unknown as { logError: () => void }).logError = () => {};
  return cliente;
}

// Sin API key no se crea el cliente: `new Resend()` lanzaría al importar este módulo y
// tumbaría todo el servidor. En ese caso el envío falla con un error claro y la solicitud
// se guarda igual (ver solicitud.service.ts).
export const resend: Resend | null = apiKey ? crearCliente(apiKey) : null;
