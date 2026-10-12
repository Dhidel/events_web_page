import { Elysia } from "elysia";
import { staticPlugin } from "@elysiajs/static";
import { ApiError } from "./errors";

// Rutas de la API: "/api" y todo lo que empieza con "/api/". "/apixyz" NO es de la API.
export function esRutaApi(ruta: string): boolean {
  return ruta === "/api" || ruta.startsWith("/api/");
}

// En producción este servidor sirve también el frontend (client/dist): los archivos
// estáticos y, para cualquier otra ruta, index.html (React Router decide qué pantalla
// mostrar). Las rutas de la API que no existen responden 404 { error } en JSON, no la
// página del sitio con 200.
export function servirFrontend(dist: string) {
  const index = () => Bun.file(`${dist}/index.html`);
  return (
    new Elysia({ name: "frontend" })
      // alwaysStatic: una ruta por archivo (en producción ya es el modo por defecto). Sin
      // esto, fuera de producción el plugin usa un comodín "/*" que el de abajo reemplaza.
      .use(staticPlugin({ assets: dist, prefix: "/", indexHTML: true, alwaysStatic: true }))
      // @elysiajs/static registra "" en vez de "/" para el index en Windows
      // (usa path.sep, que ahí es "\" y no "/"), así que se agrega explícito.
      .get("/", index)
      .get("/*", ({ path }) => {
        if (esRutaApi(path)) throw new ApiError(404, "Ruta no encontrada.");
        return index();
      })
  );
}
