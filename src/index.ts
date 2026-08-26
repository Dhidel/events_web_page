import { Elysia } from "elysia";
import { staticPlugin } from "@elysiajs/static";
import { html } from "@elysiajs/html";
import { cors } from "@elysiajs/cors";
import { connectDB } from "./db";

await connectDB();

const isProduction = process.env.NODE_ENV === "production";
const VITE_DEV_ORIGIN = "http://localhost:5173";
const CLIENT_DIST = "client/dist";

const app = new Elysia()
  .use(html())
  .use(
    cors({
      origin: isProduction ? true : VITE_DEV_ORIGIN,
    })
  )
  .get("/api/health", () => ({ status: "ok" }));

if (isProduction) {
  app
    .use(
      staticPlugin({
        assets: CLIENT_DIST,
        prefix: "/",
        indexHTML: true,
      })
    )
    // @elysiajs/static registra "" en vez de "/" para el index en Windows
    // (usa path.sep, que ahí es "\" y no "/"), así que se agrega explícito.
    .get("/", () => Bun.file(`${CLIENT_DIST}/index.html`))
    // SPA fallback: cualquier ruta de React Router (/servicios, /cotizador, etc.)
    // que no sea un archivo estático ni un endpoint /api debe servir index.html.
    .get("/*", () => Bun.file(`${CLIENT_DIST}/index.html`));
}

app.listen(3000);

console.log(
  `Servidor ejecutándose en http://localhost:${app.server?.port} (${isProduction ? "producción — sirviendo client/dist" : "desarrollo — solo API, frontend en " + VITE_DEV_ORIGIN})`
);
