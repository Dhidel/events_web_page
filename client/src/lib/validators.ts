// Mismas reglas que el servidor (src/lib/validation.ts y el formato "email" de Elysia):
// si se cambia una, hay que cambiar la otra, o el formulario deja pasar datos que la API rechaza.
export const NOMBRE_MIN = 2;
export const NOMBRE_MAX = 120;
export const CORREO_MAX = 150;
// Largo máximo del teléfono: "+" y 20 caracteres.
export const TELEFONO_MAX = 21;

// "+" opcional, luego dígitos, espacios, paréntesis, puntos o guiones (7 a 20 caracteres)
// con al menos 7 dígitos. Acepta "5555-1234", "+502 5555 1234", "+1 (555) 123-4567".
const PHONE_REGEX = /^(?=(?:\D*\d){7})[+]?[\d\s().-]{7,20}$/;
// Sin tildes ni "ñ", sin puntos al inicio/final ni dobles antes de la @, dominio con punto.
const EMAIL_REGEX =
  /^[a-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-z0-9!#$%&'*+/=?^_`{|}~-]+)*@(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/i;

export const isNameValid = (value: string) => {
  const nombre = value.trim();
  return nombre.length >= NOMBRE_MIN && nombre.length <= NOMBRE_MAX;
};
export const isPhoneValid = (value: string) => PHONE_REGEX.test(value.trim());
export const isEmailValid = (value: string) => {
  const correo = value.trim();
  return correo.length <= CORREO_MAX && EMAIL_REGEX.test(correo);
};

export const MENSAJE_NOMBRE = "Ingresa tu nombre (mínimo 2 letras).";
export const MENSAJE_TELEFONO = "Ingresa un teléfono válido, con al menos 7 dígitos (ej. 5555-1234 o +502 5555 1234).";
export const MENSAJE_CORREO = "Ingresa un correo válido, sin tildes ni espacios (ej. nombre@correo.com).";

// Primer campo con error, en el orden en que aparecen en el formulario. Al enviar con errores
// se le lleva el foco: así el lector de pantalla lee el campo y su mensaje (aria-describedby).
export function primerCampoConError<K extends string>(errores: Record<K, string>, orden: readonly K[]): K | null {
  return orden.find((campo) => errores[campo]) ?? null;
}
