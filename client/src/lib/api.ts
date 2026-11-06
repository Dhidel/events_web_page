// En dev el frontend corre en Vite (5173) y la API en Bun (3000). En producción
// el mismo servidor sirve ambos, así que la base es relativa.
export const API_BASE = import.meta.env.DEV ? "http://localhost:3000" : "";

export interface GalleryImage {
  id: string;
  imageUrl: string;
  alt: string;
  category: string;
  categoryLabel: string;
  label: string;
  order: number;
}

export type SolicitudOrigen = "cotizador" | "contacto";
export type SolicitudEstado = "nuevo" | "contactado" | "propuesta_enviada" | "confirmado";

export interface Solicitud {
  id: string;
  nombre: string;
  telefono: string;
  correo: string;
  tipoEvento?: string;
  mensaje?: string;
  fechaEvento?: string;
  origen: SolicitudOrigen;
  detalleCotizador?: Record<string, unknown>;
  estado: SolicitudEstado;
  createdAt: string;
}

export function getAdminToken(): string | null {
  return localStorage.getItem("adminToken");
}

export function clearAdminToken(): void {
  localStorage.removeItem("adminToken");
}

// Galería pública para la página /galeria.
export async function fetchGallery(): Promise<GalleryImage[]> {
  const res = await fetch(`${API_BASE}/api/gallery`);
  if (!res.ok) throw new Error("No se pudo cargar la galería.");
  return res.json();
}

export interface Servicio {
  id: string;
  nombre: string;
  descripcion: string;
  categoria: string;
  precio: number;
  unidad: string;
  // Solo en grupos (batucadas): artistas incluidos en el precio. La cantidad cuenta grupos.
  artistas?: number;
  activo: boolean;
  orden: number;
}

// Catálogo público de personajes/actos (Servicios y Cotizador). Un catálogo vacío
// se trata como error: las páginas no tienen nada útil que mostrar sin él.
export async function fetchServicios(): Promise<Servicio[]> {
  const res = await fetch(`${API_BASE}/api/servicios`);
  if (!res.ok) throw new Error("No se pudieron cargar los servicios.");
  const data = (await res.json()) as Servicio[];
  if (!Array.isArray(data) || data.length === 0) throw new Error("El catálogo de servicios está vacío.");
  return data;
}

export interface CotizacionPayload {
  nombre: string;
  telefono: string;
  correo: string;
  tipoEvento?: string;
  mensaje?: string;
  fechaEvento?: string;
  origen: SolicitudOrigen;
  detalleCotizador?: Record<string, unknown>;
  // Honeypot anti-spam: el input está oculto y una persona nunca lo llena. Solo se envía si
  // trae texto (o sea, si lo llenó un bot).
  sitioWeb?: string;
}

export class UnauthorizedError extends Error {}

// 429: demasiadas solicitudes seguidas desde esta conexión. Lleva el mensaje del servidor;
// el tipo propio permite a la página ofrecer WhatsApp en vez de "Reintentar".
export class DemasiadasSolicitudesError extends Error {
  constructor(mensaje: string) {
    super(mensaje);
    this.name = "DemasiadasSolicitudesError";
  }
}

// Extrae un mensaje legible de una respuesta con error. El backend a veces responde
// JSON ({ error: "..." }) y a veces texto plano (errores no capturados de Elysia),
// así que se intenta parsear JSON y si no, se usa el texto tal cual.
export async function readError(res: Response, fallback: string): Promise<string> {
  const text = await res.text().catch(() => "");
  if (!text) return fallback;
  try {
    const data = JSON.parse(text) as { error?: string; message?: string };
    return data.error ?? data.message ?? fallback;
  } catch {
    return text.length > 300 ? fallback : text;
  }
}

// fetch autenticado para el panel admin. Adjunta el Bearer token y convierte un
// 401 en UnauthorizedError para que la página pueda mandar al login.
export async function adminFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const token = getAdminToken();
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: { ...init.headers, Authorization: `Bearer ${token ?? ""}` },
  });

  if (res.status === 401) {
    clearAdminToken();
    throw new UnauthorizedError("Tu sesión expiró. Inicia sesión de nuevo.");
  }

  return res;
}

// La API nombra los campos rechazados con su nombre interno ("Datos inválidos o faltantes:
// telefono."). Los formularios ya validan con las mismas reglas, así que esto casi no se ve;
// si pasa, se traduce a algo que el visitante entienda.
const CAMPOS_LEGIBLES: Record<string, string> = {
  nombre: "nombre",
  telefono: "teléfono",
  correo: "correo",
  tipoEvento: "tipo de evento",
  mensaje: "mensaje",
  fechaEvento: "fecha del evento",
  detalleCotizador: "personajes seleccionados",
};

export function mensajeLegible(error: string): string {
  const campos = /^Datos inválidos o faltantes: (.+)\.$/.exec(error)?.[1];
  if (!campos) return error;
  const nombres = campos.split(", ").map((campo) => CAMPOS_LEGIBLES[campo] ?? campo);
  return `Revisa estos datos e intenta de nuevo: ${nombres.join(", ")}.`;
}

// Endpoint público que usan el formulario de Contacto y el Cotizador al confirmar.
export async function submitCotizacion(payload: CotizacionPayload, signal?: AbortSignal): Promise<Solicitud> {
  const res = await fetch(`${API_BASE}/api/cotizaciones`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    signal,
  });
  if (res.status === 429) {
    throw new DemasiadasSolicitudesError(
      await readError(res, "Recibimos varias solicitudes seguidas desde tu conexión. Espera unos minutos e intenta de nuevo.")
    );
  }
  if (!res.ok) throw new Error(mensajeLegible(await readError(res, "No se pudo enviar la solicitud.")));
  return res.json();
}
