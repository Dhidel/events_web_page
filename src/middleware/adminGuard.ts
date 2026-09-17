import { Elysia } from "elysia";
import { authJwt } from "../plugins/jwt";

export const adminGuard = new Elysia()
  .use(authJwt)
  .derive({ as: "scoped" }, async ({ jwt, headers }) => {
    const authHeader = headers.authorization;
    const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
    const payload = token ? await jwt.verify(token) : false;

    return { admin: payload || null };
  })
  .onBeforeHandle({ as: "scoped" }, ({ admin, set }) => {
    if (!admin) {
      set.status = 401;
      return { error: "No autorizado." };
    }
  });
