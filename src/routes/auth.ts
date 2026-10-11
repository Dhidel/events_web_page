import { Elysia, t } from "elysia";
import { authJwt } from "../plugins/jwt";
import { ErrorSchemas, errorResponses } from "../lib/apiSchemas";
import { validarCredencialesAdmin } from "../services/auth.service";
import { rechazarCamposExtra } from "../lib/validation";
import { limiteLogin } from "../lib/limiteSolicitudes";

const GENERIC_LOGIN_ERROR = "Correo o contraseña incorrectos.";
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// t.String rechaza tipos que no sean texto (p. ej. {"$ne": null}: inyección NoSQL) con 422.
// El formato del correo NO va en el esquema a propósito: uno mal formado responde el mismo
// 401 genérico que unas credenciales incorrectas (ver el handler).
const LoginBody = t.Object(
  {
    email: t.String({ maxLength: 254, examples: ["admin@example.com"] }),
    password: t.String({ maxLength: 200 }),
  },
  { additionalProperties: false }
);

export const authRoutes = new Elysia().use(authJwt).post(
  "/api/auth/login",
  async ({ body, jwt, set, request, server }) => {
    const email = body.email.trim().toLowerCase();

    // Cada 401 cuenta para el límite de intentos fallidos de esta IP ([14.3]).
    const rechazar = () => {
      limiteLogin.registrar({ request, server, set });
      set.status = 401;
      return { error: GENERIC_LOGIN_ERROR };
    };

    // Correo mal formado o contraseña vacía: mismo 401 que credenciales incorrectas,
    // sin consultar la base.
    if (!EMAIL_RE.test(email) || body.password.length === 0) return rechazar();

    const user = await validarCredencialesAdmin(email, body.password);
    if (!user) return rechazar();

    const token = await jwt.sign({ id: user.id, email: user.email });
    return { token };
  },
  {
    parse: "json",
    body: LoginBody,
    // Con la cuota de intentos fallidos agotada se responde 429 incluso con la contraseña
    // correcta (si no, un atacante podría seguir probando y distinguir el acierto).
    transform: [(ctx) => void limiteLogin.verificar(ctx), rechazarCamposExtra(LoginBody)],
    response: {
      200: t.Object(
        { token: t.String({ description: "JWT válido por 7 días. Enviarlo como Authorization: Bearer <token>." }) },
        { examples: [{ token: "eyJhbGciOiJIUzI1NiJ9.eyJpZCI6Ii4uLiJ9.abc123" }] }
      ),
      ...errorResponses(400, 422, 500),
      429: t.Object(ErrorSchemas[429].properties, {
        description: "Demasiados intentos fallidos desde la misma IP. El header Retry-After indica en cuántos segundos reintentar.",
        examples: [{ error: "Demasiados intentos de inicio de sesión. Espera unos minutos e intenta de nuevo." }],
      }),
      401: t.Object(ErrorSchemas[401].properties, {
        description: "Correo o contraseña incorrectos.",
        examples: [{ error: "Correo o contraseña incorrectos." }],
      }),
    },
    detail: {
      tags: ["Auth"],
      summary: "Iniciar sesión en el panel admin",
      description:
        "Devuelve un JWT para usar en las rutas /api/admin/*. Con credenciales incorrectas o un correo mal formado responde 401 con un mensaje genérico (no revela si el correo existe). " +
        "Responde 422 si email/password no son texto, superan el largo máximo (254 / 200) o hay campos no permitidos.\n\n" +
        `**Fuerza bruta:** tras ${limiteLogin.max} intentos fallidos (401) en ${limiteLogin.ventanaMinutos} minutos desde la misma IP ` +
        "responde 429 con header `Retry-After`, aunque la contraseña sea correcta. Los inicios de sesión correctos no cuentan.",
    },
  }
);
