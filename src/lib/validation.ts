import { t, type TSchema } from "elysia";
import { ApiError } from "./errors";

// Utilidades de validación compartidas por las rutas ([14.1]).

// Reglas de contacto. Son las mismas que aplica el frontend antes de enviar
// (client/src/lib/validators.ts): si se cambia una, hay que cambiar la otra, o el formulario
// deja pasar datos que aquí se rechazan.
export const NOMBRE_MIN = 2;
export const NOMBRE_MAX = 120;
export const CORREO_MAX = 150;
// Teléfono: "+" opcional, luego dígitos, espacios, paréntesis, puntos o guiones (7 a 20
// caracteres) con al menos 7 dígitos. Acepta "5555-1234", "+502 5555 1234", "+1 (555) 123-4567".
export const PHONE_REGEX = /^(?=(?:\D*\d){7})[+]?[\d\s().-]{7,20}$/;

// Texto libre que se guarda o se muestra: al menos un carácter que no sea espacio
// (rechaza "   ") y un largo máximo. El trim y la limpieza de HTML los hace sanitizeText
// (src/lib/sanitize.ts) en la capa de servicios antes de guardar.
export const textoLibre = (maxLength: number, opciones: { minLength?: number; description?: string } = {}) =>
  t.String({ minLength: opciones.minLength ?? 1, maxLength, pattern: "\\S", description: opciones.description });

type SchemaObjeto = TSchema & { type?: string; properties?: Record<string, TSchema>; additionalProperties?: unknown; items?: TSchema };

// Devuelve los campos de `valor` que el esquema no declara (con su ruta: "detalleCotizador.extra").
// Solo revisa objetos marcados con additionalProperties: false, y entra en arrays de objetos.
export function camposExtra(schema: TSchema, valor: unknown, ruta = ""): string[] {
  const s = schema as SchemaObjeto;

  if (s.type === "array" && s.items && Array.isArray(valor)) {
    return valor.flatMap((item, i) => camposExtra(s.items!, item, `${ruta}[${i}]`));
  }

  if (s.type !== "object" || !s.properties || valor === null || typeof valor !== "object" || Array.isArray(valor)) {
    return [];
  }

  const extras: string[] = [];
  for (const [clave, sub] of Object.entries(valor)) {
    const nombre = ruta ? `${ruta}.${clave}` : clave;
    const propiedad = s.properties[clave];
    if (!propiedad) {
      if (s.additionalProperties === false) extras.push(nombre);
      continue;
    }
    extras.push(...camposExtra(propiedad, sub, nombre));
  }
  return extras;
}

// Hook `transform` para una ruta: rechaza con 422 los campos no declarados en el body.
// Hace falta porque Elysia (normalize: true, el valor por defecto) no los rechaza aunque el
// esquema tenga additionalProperties: false: los quita en silencio. `transform` corre
// antes de esa limpieza y de la validación, así que aquí todavía se ve el body tal cual llegó.
// Uso: { body: MiBody, transform: rechazarCamposExtra(MiBody) }
export function rechazarCamposExtra(schema: TSchema) {
  return ({ body }: { body: unknown }) => {
    const extras = camposExtra(schema, body);
    if (extras.length > 0) throw new ApiError(422, `Campos no permitidos: ${extras.join(", ")}.`);
  };
}
