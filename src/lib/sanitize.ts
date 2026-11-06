// Quita etiquetas HTML de un texto. Solo cuenta como etiqueta un "<" seguido de una letra,
// "/", "!" o "?" (así empiezan las etiquetas, comentarios y declaraciones): un "<" suelto,
// como en "Juan <3 María" o "menos de < 50 invitados", es texto y se conserva.
export function sanitizeText(input: string): string {
  if (!input) return "";

  return input
    .replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, "")
    .replace(/<[a-zA-Z\/!?][^>]*(>|$)/g, "")
    .trim();
}

// Sanitizacion

export function sanitizeInput<T>(data: T): T {
  if (typeof data === "string") {
    return sanitizeText(data) as unknown as T;
  }

  if (Array.isArray(data)) {
    return data.map((item) => sanitizeInput(item)) as unknown as T;
  }

  if (data !== null && typeof data === "object") {
    const sanitizedObj: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(data)) {
      sanitizedObj[key] = sanitizeInput(value);
    }
    return sanitizedObj as T;
  }

  return data;
}