import { Elysia } from "elysia";
import { authJwt } from "../plugins/jwt";
import { ApiError } from "../lib/errors";

// La sesión se verifica en derive (fase transform), no en onBeforeHandle: así corre ANTES
// de validar el body. Una petición sin token recibe 401 y nunca un 422 que describa los
// campos del esquema ("Campos no permitidos: ...", "Datos inválidos: ...") a un anónimo.
export const adminGuard = new Elysia()
  .use(authJwt)
  .derive({ as: "scoped" }, async ({ jwt, headers }) => {
    const authHeader = headers.authorization;
    const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
    const payload = token ? await jwt.verify(token) : false;

    if (!payload) throw new ApiError(401, "No autorizado.");
    return { admin: payload };
  });
