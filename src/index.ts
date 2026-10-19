import { Elysia, t } from "elysia";
import { openapi } from "@elysiajs/openapi";
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
import { DEV_ORIGIN, MAX_BODY_BYTES, seguridadHttp } from "./lib/seguridadHttp";
import { servirFrontend } from "./lib/frontend";
import { describirConfiguracionIp, limiteCotizaciones, limiteLogin } from "./lib/limiteSolicitudes";

await connectDB();

const isProduction = process.env.NODE_ENV === "production";
const CLIENT_DIST = "client/dist";
// Los hostings asignan el puerto con PORT; en local queda 3000.
const PORT = Number(process.env.PORT ?? 3000);

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
  .get("/ping", () => "pong")
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
  // CORS (CORS_ORIGIN; en desarrollo siempre http://localhost:5173) y HSTS en producción.
  // Ver src/lib/seguridadHttp.ts.
  .use(seguridadHttp({ produccion: isProduction, corsOrigin: process.env.CORS_ORIGIN }))
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

// Producción: también sirve el frontend (ver src/lib/frontend.ts). Las rutas /api/* que no
// existen responden 404 { error }, no la página del sitio.
if (isProduction) app.use(servirFrontend(CLIENT_DIST));

// Tope del body por petición (Bun responde 413 si se pasa; ver MAX_BODY_BYTES).
app.listen({ hostname: "0.0.0.0", port: PORT, maxRequestBodySize: MAX_BODY_BYTES });

if (isProduction) {
  // Para comprobar al desplegar cómo se obtiene la IP del visitante (anti-spam [14.3]). Con un
  // proxy delante y sin CLIENT_IP_HEADER ni TRUST_PROXY_HOPS, todos compartirían el límite.
  const ip = describirConfiguracionIp();
  const limites =
    `Límites por IP: cotizaciones ${limiteCotizaciones.max} cada ${limiteCotizaciones.ventanaMinutos} min; ` +
    `login ${limiteLogin.max} intentos fallidos cada ${limiteLogin.ventanaMinutos} min.`;
  if (ip.advertencia) console.warn(`⚠ [Anti-spam] REVISA LA CONFIGURACIÓN DE IP: ${ip.texto} ${limites}`);
  else console.log(`[Anti-spam] IP del cliente: ${ip.texto}. ${limites}`);
}

console.log(
  `Servidor ejecutándose en http://localhost:${app.server?.port} (${isProduction ? "producción — sirviendo client/dist" : "desarrollo — solo API, frontend en " + DEV_ORIGIN})`
);
