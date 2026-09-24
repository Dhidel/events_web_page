// Enmascarado de datos personales (correo y teléfono) para respuestas públicas y logs.
// Regla: solo quedan visibles los últimos 4 caracteres; el resto se reemplaza por "*".

const VISIBLE = 4;

// "5555-1234" → "****1234". Se cuentan solo los dígitos, así el formato
// (espacios, guiones, +502) no revela nada extra.
export function maskPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length <= VISIBLE) return "*".repeat(digits.length);
  return "*".repeat(digits.length - VISIBLE) + digits.slice(-VISIBLE);
}

// "ana.lopez@gmail.com" → "*****opez@gmail.com". Se enmascara la parte antes de la @
// (la que identifica a la persona); el dominio se deja para saber a qué proveedor escribir.
// Si la parte local es muy corta, solo se muestra su último carácter.
export function maskEmail(email: string): string {
  const at = email.lastIndexOf("@");
  if (at <= 0) return maskPhone(email) || "****";
  const local = email.slice(0, at);
  const visible = local.length > VISIBLE ? VISIBLE : 1;
  return "*".repeat(local.length - visible) + local.slice(-visible) + email.slice(at);
}

// Copia de la solicitud con correo y teléfono enmascarados.
export function maskContact<T extends { correo: string; telefono: string }>(data: T): T {
  return { ...data, correo: maskEmail(data.correo), telefono: maskPhone(data.telefono) };
}

const EMAIL_RE = /[^\s@"'<>(){}\[\],;:]+@[^\s@"'<>(){}\[\],;:]+\.[a-z]{2,}/gi;
// 8+ dígitos, opcionalmente con +, espacios o guiones (teléfonos de Guatemala y con código de país).
// No toca números de línea de los stack traces ("index.ts:57:12").
const PHONE_RE = /\+?\d[\d\s-]{6,}\d/g;
// Usuario y contraseña dentro de una URI ("mongodb+srv://user:pass@host"): se ocultan completos.
const URI_CREDENTIALS_RE = /\/\/[^/\s:@]+:[^@\s]+@/g;

// Busca correos y teléfonos dentro de un texto libre (mensajes de error, stacks) y los enmascara.
export function redactPII(text: string): string {
  return text
    .replace(URI_CREDENTIALS_RE, "//****:****@")
    .replace(EMAIL_RE, maskEmail).replace(PHONE_RE, (m) => (m.replace(/\D/g, "").length >= 8 ? maskPhone(m) : m));
}

// Versión segura de un error para console.error: solo nombre, mensaje y stack, ya enmascarados.
// Nunca se loguea el objeto completo (Mongoose adjunta los valores del documento en él).
export function safeErrorLog(error: unknown): string {
  if (error instanceof Error) return redactPII(error.stack ?? `${error.name}: ${error.message}`);
  return redactPII(String(error));
}
