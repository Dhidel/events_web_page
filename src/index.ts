import { Elysia } from "elysia";

const app = new Elysia()
  .get("/", () => "¡Hola desde Elysia!")
  .listen(3000);

console.log(`Servidor ejecutándose en http://localhost:3000`);