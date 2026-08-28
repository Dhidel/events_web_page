import { jwt } from "@elysiajs/jwt";

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  throw new Error(
    "Falta la variable de entorno JWT_SECRET. Definila en tu archivo .env (ver .env.example)."
  );
}

export const authJwt = jwt({
  name: "jwt",
  secret: JWT_SECRET,
  exp: "7d",
});
