import { Elysia } from "elysia";
import { staticPlugin } from "@elysiajs/static";
import { html } from "@elysiajs/html";
import { cors } from "@elysiajs/cors";
import { connectDB } from "./db";
import { authRoutes } from "./routes/auth";
import { galleryRoutes } from "./routes/gallery";
import { adminGalleryRoutes } from "./routes/adminGallery";
import { adminGuard } from "./middleware/adminGuard";

await connectDB();

const isProduction = process.env.NODE_ENV === "production";
const VITE_DEV_ORIGIN = "http://localhost:5173";
const CLIENT_DIST = "client/dist";

// Todo lo que empiece con /api/admin pasa primero por adminGuard (requiere JWT válido).
const adminRoutes = new Elysia({ prefix: "/api/admin" })
  .use(adminGuard)
  .get("/me", ({ admin }) => ({ admin }));

const app = new Elysia()
  .use(html())
  .use(
    cors({
      origin: isProduction ? true : VITE_DEV_ORIGIN,
    })
  )
  .get("/api/health", () => ({ status: "ok" }))
  .use(authRoutes)
  .use(galleryRoutes)
  .use(adminRoutes)
  .use(adminGalleryRoutes);

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
