import { Elysia, t } from "elysia";
import { openapi } from "@elysiajs/openapi";
import { staticPlugin } from "@elysiajs/static";
import { cors } from "@elysiajs/cors";
import { connectDB } from "./db";
import { authRoutes } from "./routes/auth";
import { galleryRoutes } from "./routes/gallery";
import { adminGalleryRoutes } from "./routes/adminGallery";
import { cotizacionesRoutes } from "./routes/cotizaciones";
import { serviciosRoutes } from "./routes/servicios";
import { adminCotizacionesRoutes } from "./routes/adminCotizaciones";
import { adminGuard } from "./middleware/adminGuard";
import { adminDetail, errorResponses } from "./lib/apiSchemas";
import { errorHandler } from "./lib/errors";

await connectDB();

const isProduction = process.env.NODE_ENV === "production";
const VITE_DEV_ORIGIN = "http://localhost:5173";
const CLIENT_DIST = "client/dist";

// Todo lo que empiece con /api/admin pasa primero por adminGuard (requiere JWT válido).
const adminRoutes = new Elysia({ prefix: "/api/admin" })
  .use(adminGuard)
  .get("/me", ({ admin }) => ({ admin: admin as { id: string; email: string } }), {
    response: {
      200: t.Object(
        { admin: t.Object({ id: t.String(), email: t.String() }, { additionalProperties: true }) },
        { examples: [{ admin: { id: "6ab3e1f0c9d8b7a6f5e4d3c2", email: "admin@example.com", exp: 1790000000 } }] }
      ),
      ...errorResponses(401, 500),
    },
    detail: {
      ...adminDetail,
      summary: "Admin con sesión activa",
      description: "Devuelve los datos del token (id y correo del admin). Sirve para comprobar que el token sigue siendo válido.",
    },
  });

const app = new Elysia()
  // Formato único de error { error } para todas las rutas (ver src/lib/errors.ts).
  .use(errorHandler)
  // Documentación de la API en /swagger (JSON de la especificación en /swagger/json).
  // Solo en desarrollo: en producción no se publica el mapa de las rutas admin.
  .use(
    openapi({
      enabled: !isProduction,
      path: "/swagger",
      provider: "swagger-ui",
      exclude: { paths: ["/", "/*"] },
      documentation: {
        info: {
          title: "Show Company API",
          version: "1.0.0",
          description:
            "API del sitio de Show Company. Las rutas de la etiqueta Admin requieren un token: obtenelo en POST /api/auth/login y pegalo en el botón Authorize.",
        },
        tags: [
          { name: "Público", description: "Endpoints que usa el sitio público (sin autenticación)." },
          { name: "Auth", description: "Inicio de sesión del panel admin." },
          { name: "Admin", description: "Panel administrativo. Requieren Authorization: Bearer <token>." },
        ],
        components: {
          securitySchemes: {
            bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT" },
          },
        },
      },
    })
  )
  .use(
    cors({
      origin: isProduction ? true : VITE_DEV_ORIGIN,
    })
  )
  .get("/api/health", () => ({ status: "ok" as const }), {
    response: { 200: t.Object({ status: t.Literal("ok") }, { examples: [{ status: "ok" }] }) },
    detail: { tags: ["Público"], summary: "Estado del servidor", description: "Responde { status: \"ok\" } si el servidor está arriba." },
  })
  .use(authRoutes)
  .use(galleryRoutes)
  .use(cotizacionesRoutes)
  .use(serviciosRoutes)
  .use(adminRoutes)
  .use(adminGalleryRoutes)
  .use(adminCotizacionesRoutes);

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
