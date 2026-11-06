import { Elysia, type ValidationError } from "elysia";
import mongoose from "mongoose";
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

// Campos (primer nivel) que no pasaron la validación, sin valores.
function camposConError(error: Readonly<ValidationError>): string[] {
  return [
    ...new Set(error.all.map((e) => ("path" in e ? e.path : "").replace(/^\//, "").split("/")[0]).filter(Boolean)),
  ] as string[];
}

// Solo nombra los campos con problema; nunca devuelve el esquema ni los valores recibidos.
function validationMessage(error: Readonly<ValidationError>): string {
  if (error.type === "params") return "El id no es válido.";

  const fields = camposConError(error);
  return fields.length > 0 ? `Datos inválidos o faltantes: ${fields.join(", ")}.` : "Datos inválidos o faltantes.";
}

export const errorHandler = new Elysia({ name: "error-handler" }).onError(
  { as: "global" },
  ({ code, error, set, request, path }) => {
    if (error instanceof ApiError) {
      set.status = error.status;
      return { error: error.message };
    }

    // Dato que pasó el esquema de la ruta pero no el del modelo (p. ej. un nombre que queda
    // vacío al quitarle el HTML): es un dato inválido del usuario, no un error del servidor.
    // Igual que en VALIDATION, solo se nombran los campos; nunca los valores ni el detalle.
    if (error instanceof mongoose.Error.ValidationError) {
      set.status = 422;
      return { error: `Datos inválidos o faltantes: ${Object.keys(error.errors).join(", ")}.` };
    }

    switch (code) {
      case "VALIDATION":
        // Si lo que no pasa la validación es la *respuesta*, el error es del servidor
        // (el dato guardado no coincide con el esquema documentado): 500 genérico. Al log van
        // solo los campos con problema: el detalle de Elysia trae los valores del documento
        // (nombre, mensaje...), que redactPII no cubre.
        if (error.type === "response") {
          console.error(`[${request.method} ${path}] La respuesta no cumple el esquema documentado (campos: ${camposConError(error)}).`);
          set.status = 500;
          return { error: GENERIC_ERROR };
        }
        set.status = 422;
        return { error: validationMessage(error) };
      case "INVALID_FILE_TYPE":
        set.status = 422;
        return { error: "El archivo debe ser una imagen JPG, PNG o WebP." };
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
