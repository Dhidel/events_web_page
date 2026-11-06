import { jwt } from "@elysiajs/jwt";

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  throw new Error(
    "Falta la variable de entorno JWT_SECRET. Definila en tu archivo .env (ver .env.example)."
  );
}

export const SESION_HORAS = 12;

export const authJwt = jwt({
  name: "jwt",
  secret: JWT_SECRET,
  // Corto a propósito: si alguien roba el token, le sirve pocas horas. El admin vuelve a
  // iniciar sesión cada día de trabajo.
  exp: SESION_HORAS + "h",
});
