import { Elysia, t } from "elysia";
import { authJwt } from "../plugins/jwt";
import { AdminUser } from "../models/AdminUser";

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
    body: t.Object({
      email: t.String(),
      password: t.String(),
    }),
  }
);
