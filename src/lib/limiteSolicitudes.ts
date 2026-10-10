// Límite de solicitudes por IP para el endpoint público de cotizaciones: sin él, un script
// puede llenar la bandeja del panel y agotar la cuota de correos de Resend.
// Es un contador en memoria (ventana deslizante): alcanza para un solo servidor, que es
// como corre este proyecto. Se reinicia al reiniciar el servidor.

export const MAX_SOLICITUDES_POR_IP = 5;
export const VENTANA_SOLICITUDES_MS = 10 * 60 * 1000;

// Cada cuántos registros se barren las IP que ya no tienen envíos dentro de la ventana.
const LIMPIAR_CADA = 500;

export function crearLimite({ max, ventanaMs }: { max: number; ventanaMs: number }) {
  const envios = new Map<string, number[]>();
  let registros = 0;

  // Registra un intento de `clave` y devuelve false si ya superó el máximo en la ventana.
  return function permitir(clave: string, ahora = Date.now()): boolean {
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
  };
}

// IP del visitante. Detrás del proxy del hosting, la IP de la conexión es la del proxy (la
// misma para todos), así que se toma del header que el proxy agrega:
// - CLIENT_IP_HEADER definida (ej. "cf-connecting-ip", "x-real-ip", "fly-client-ip"): ese header.
// - Si no, el primer valor de X-Forwarded-For cuando viene.
// - Si no, la IP de la conexión.
// Devuelve null si no se puede saber (p. ej. en las pruebas con app.handle): no se limita.
export function ipDelCliente(request: Request, ipConexion?: string | null, headerConfigurado = process.env.CLIENT_IP_HEADER): string | null {
  const header = headerConfigurado?.trim().toLowerCase() || "x-forwarded-for";
  const valor = request.headers.get(header)?.split(",")[0]?.trim();
  return valor || ipConexion || null;
}
