import { Elysia } from "elysia";
import { staticPlugin } from "@elysiajs/static";
import { html } from "@elysiajs/html";
import { cors } from "@elysiajs/cors";
import { connectDB } from "./db";

await connectDB();

const app = new Elysia()
  .use(cors())
  .use(html())
  .use(
    staticPlugin({
      assets: "public",
      prefix: "/",
      indexHTML: true,
    })
  )
  // @elysiajs/static registra "" en vez de "/" para el index en Windows
  // (usa path.sep, que ahí es "\" y no "/"), así que se agrega explícito.
  .get("/", () => Bun.file("public/index.html"))
  .listen(3000);

console.log(`Servidor ejecutándose en http://localhost:${app.server?.port}`);