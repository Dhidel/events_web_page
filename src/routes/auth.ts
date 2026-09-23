import { Elysia, t } from "elysia";
import { authJwt } from "../plugins/jwt";
import { AdminUser } from "../models/AdminUser";
import { ErrorSchemas, errorResponses } from "../lib/apiSchemas";

const GENERIC_LOGIN_ERROR = "Correo o contraseña incorrectos.";

export const authRoutes = new Elysia().use(authJwt).post(
  "/api/auth/login",
  async ({ body, jwt, set }) => {
    const email = body.email.trim().toLowerCase();

    const user = await AdminUser.findOne({ email }).select("+password");
    const isValid = user ? await user.comparePassword(body.password) : false;

    if (!user || !isValid) {
      set.status = 401;
      return { error: GENERIC_LOGIN_ERROR };
    }

    const token = await jwt.sign({ id: user.id, email: user.email });
    return { token };
  },
  {
    parse: "json",
    body: t.Object({
      email: t.String({ examples: ["admin@example.com"] }),
      password: t.String(),
    }),
    response: {
      200: t.Object(
        { token: t.String({ description: "JWT válido por 7 días. Enviarlo como Authorization: Bearer <token>." }) },
        { examples: [{ token: "eyJhbGciOiJIUzI1NiJ9.eyJpZCI6Ii4uLiJ9.abc123" }] }
      ),
      ...errorResponses(400, 422, 500),
      401: t.Object(ErrorSchemas[401].properties, {
        description: "Correo o contraseña incorrectos.",
        examples: [{ error: "Correo o contraseña incorrectos." }],
      }),
    },
    detail: {
      tags: ["Auth"],
      summary: "Iniciar sesión en el panel admin",
      description:
        "Devuelve un JWT para usar en las rutas /api/admin/*. Con credenciales incorrectas responde 401 con un mensaje genérico (no revela si el correo existe).",
    },
  }
);
