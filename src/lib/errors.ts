import { Elysia, type ValidationError } from "elysia";
import { safeErrorLog } from "./privacy";

// Formato único de error de toda la API: { error: "mensaje para el usuario" }.
// Este plugin es el único onError del servidor; se registra una vez en index.ts
// y aplica a todas las rutas.

export const GENERIC_ERROR = "Ocurrió un error, intenta de nuevo.";

// Error esperado con código HTTP y un mensaje apto para mostrar al usuario.
// Lanzarlo desde una ruta responde { error: message } con ese status.
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message);
  }
}

// Solo nombra los campos con problema; nunca devuelve el esquema ni los valores recibidos.
function validationMessage(error: Readonly<ValidationError>): string {
  if (error.type === "params") return "El id no es válido.";

  const fields = [
    ...new Set(error.all.map((e) => ("path" in e ? e.path : "").replace(/^\//, "").split("/")[0]).filter(Boolean)),
  ];
  return fields.length > 0 ? `Datos inválidos o faltantes: ${fields.join(", ")}.` : "Datos inválidos o faltantes.";
}

export const errorHandler = new Elysia({ name: "error-handler" }).onError(
  { as: "global" },
  ({ code, error, set, request, path }) => {
    if (error instanceof ApiError) {
      set.status = error.status;
      return { error: error.message };
    }

    switch (code) {
      case "VALIDATION":
        // Si lo que no pasa la validación es la *respuesta*, el error es del servidor
        // (el dato guardado no coincide con el esquema documentado): cae al 500.
        if (error.type === "response") break;
        set.status = 422;
        return { error: validationMessage(error) };
      case "INVALID_FILE_TYPE":
        set.status = 422;
        return { error: "El archivo debe ser una imagen." };
      case "PARSE":
        set.status = 400;
        return { error: "El cuerpo de la solicitud no tiene un formato válido." };
      case "NOT_FOUND":
        set.status = 404;
        return { error: "Ruta no encontrada." };
    }

    // Inesperado: el detalle queda solo en el log del servidor, nunca en la respuesta.
    // Se loguea enmascarado: los errores de Mongo pueden traer correos/teléfonos del documento.
    console.error(`[${request.method} ${path}] Error inesperado: ${safeErrorLog(error)}`);
    set.status = 500;
    return { error: GENERIC_ERROR };
  }
);
