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

export class UnauthorizedError extends Error {}

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
