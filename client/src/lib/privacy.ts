// Enmascarado de correo y teléfono para mostrar en pantalla (misma regla que src/lib/privacy.ts
// del servidor): solo quedan visibles los últimos 4 caracteres.

const VISIBLE = 4;

// "5555-1234" → "****1234"
export function maskPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length <= VISIBLE) return "*".repeat(digits.length);
  return "*".repeat(digits.length - VISIBLE) + digits.slice(-VISIBLE);
}

// "ana.lopez@gmail.com" → "*****opez@gmail.com"
export function maskEmail(email: string): string {
  const at = email.lastIndexOf("@");
  if (at <= 0) return maskPhone(email) || "****";
  const local = email.slice(0, at);
  const visible = local.length > VISIBLE ? VISIBLE : 1;
  return "*".repeat(local.length - visible) + local.slice(-visible) + email.slice(at);
}
