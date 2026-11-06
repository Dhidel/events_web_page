# Seguridad y operación

Cómo se protege el servidor y qué hay que revisar al operarlo. Todo describe lo que hace el
código hoy; cada sección indica dónde está la lógica.

- [CORS, HTTPS y headers de seguridad](#cors-https-y-headers-de-seguridad-142)
- [Sesión del panel admin](#sesión-del-panel-admin)
- [Límite por IP y anti-spam](#límite-por-ip-y-anti-spam-143)
- [Errores seguros, dependencias y type-check](#errores-seguros-dependencias-y-type-check-144)
- [Lo que sirve el servidor en producción](#lo-que-sirve-el-servidor-en-producción)
- [Peso de las imágenes](#peso-de-las-imágenes)

---

## CORS, HTTPS y headers de seguridad ([14.2])

El servidor usa `NODE_ENV` para saber si está en producción (`NODE_ENV=production`) y lee
los orígenes permitidos de `CORS_ORIGIN`. La lógica está en `src/lib/seguridadHttp.ts`.

| Variable | Desarrollo | Producción |
|---|---|---|
| `CORS_ORIGIN` | Opcional. `http://localhost:5173` siempre está permitido. | Uno o varios orígenes separados por coma, sin `/` final: `https://www.ejemplo.com,https://ejemplo.com`. Si queda vacía, **no se permite ningún origen externo** y se avisa en el log al arrancar. |
| `PORT` | 3000 por defecto. | Lo asigna el hosting. |

- **CORS:** solo los métodos `GET, POST, PUT, PATCH, DELETE, OPTIONS` y los headers
  `Content-Type` y `Authorization` (JWT del panel). Sin cookies (`credentials: false`).
  Como en producción este mismo servidor sirve el frontend, el sitio funciona aunque
  `CORS_ORIGIN` esté vacía: CORS solo importa si el frontend se hospeda en otro dominio.
  A un origen que no está en la lista no se le responde `Access-Control-Allow-Origin`, así que
  el navegador bloquea la respuesta.
- **Desarrollo:** el cliente de Vite tiene que correr en el puerto 5173. Si Vite arranca en
  otro (por ejemplo 5174, porque el 5173 estaba ocupado), las llamadas a la API fallan por CORS.
- **HTTPS:** el certificado y la redirección de `http://` a `https://` los hace el hosting.
  En producción la API envía `Strict-Transport-Security: max-age=15552000` (180 días), sin
  `includeSubDomains` ni `preload` hasta confirmar el dominio final.
- **Headers de seguridad (solo en producción, en todas las respuestas: API y sitio):**

  | Header | Valor |
  |---|---|
  | `Content-Security-Policy` | `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; font-src 'self'; img-src 'self' data: https://res.cloudinary.com; connect-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'` |
  | `X-Frame-Options` | `DENY` |
  | `X-Content-Type-Options` | `nosniff` |
  | `Referrer-Policy` | `strict-origin-when-cross-origin` |

  En palabras: scripts, estilos y **fuentes solo del propio dominio** (las fuentes Manrope y
  Sora se sirven desde el sitio, en `client/src/assets/fonts`; no se usa Google Fonts),
  imágenes propias, `data:` y de `res.cloudinary.com`, y nadie puede mostrar el sitio dentro de
  un `<iframe>`. `'unsafe-inline'` existe solo para los estilos en línea de React.

  **Si se agrega un servicio externo** (un video de YouTube embebido, analytics, otra CDN de
  imágenes o de fuentes) hay que sumarlo a `CSP` en `src/lib/seguridadHttp.ts`, o el navegador
  lo bloquea en producción. En desarrollo no hay CSP (bloquearía `/swagger`).

---

## Sesión del panel admin

- Las contraseñas de los administradores se guardan con **bcrypt** (`src/models/AdminUser.ts`).
- Al iniciar sesión (`POST /api/auth/login`) el servidor entrega un **JWT** firmado con
  `JWT_SECRET` que dura **12 horas** (`SESION_HORAS` en `src/plugins/jwt.ts`). El panel lo envía
  en el header `Authorization: Bearer <token>`.
- Además de la firma, `src/middleware/adminGuard.ts` revisa en la base que el admin siga
  existiendo y que el token sea de su `versionSesion` actual.
- Para **cerrar todas las sesiones de un admin** (por ejemplo, si perdió la laptop):
  `bun run revocar-sesiones` y escribir su correo; sus tokens dejan de servir al instante.
  Borrar al admin tiene el mismo efecto.
- Si cambia `JWT_SECRET`, todas las sesiones de todos los admins dejan de servir.

---

## Límite por IP y anti-spam ([14.3])

Todo vive en `src/lib/limiteSolicitudes.ts`: un contador por IP en memoria con ventana
deslizante (`crearLimite`). Al pasarse, la API responde **429** con `{ "error": "..." }` y el
header `Retry-After` (segundos).

| Ruta | Límite por IP (por defecto) | Qué cuenta |
|---|---|---|
| `POST /api/cotizaciones` (Contacto y Cotizador) | 5 cada 10 min | Envíos válidos (los rechazados por validación no cuentan) |
| `POST /api/auth/login` | 10 cada 15 min | Solo intentos **fallidos** (401). Sin límite por correo, para que nadie pueda bloquear al admin a propósito |

Además, una solicitud idéntica a otra de los últimos 10 minutos no se guarda de nuevo
(`crearSolicitud` en `src/services/solicitud.service.ts` devuelve la que ya existe y no manda
otro correo).

**IP del visitante** (en este orden):

| Variable | Qué hace |
|---|---|
| `CLIENT_IP_HEADER` | Header donde el hosting pone la IP (ej. `cf-connecting-ip`, `x-real-ip`, `fly-client-ip`). Solo es seguro si el hosting lo sobrescribe siempre. |
| `TRUST_PROXY_HOPS` | Proxies de confianza delante (por defecto `0`). Con `N > 0` se toma la entrada de `X-Forwarded-For` en la posición `largo − N`; lo que el visitante escriba a la izquierda se ignora. Con `0`, `X-Forwarded-For` se ignora y se usa la IP de la conexión. |
| `RATE_LIMIT_COTIZACIONES_MAX` / `_VENTANA_MIN` | `5` / `10` |
| `RATE_LIMIT_LOGIN_MAX` / `_VENTANA_MIN` | `10` / `15` |

- **IPv6** se agrupa por `/64` (una conexión puede rotar direcciones dentro de ese bloque).
- **IP desconocida:** esas peticiones comparten una cuota 10 veces mayor y el log lo avisa una vez.
- **Al desplegar**, el log de arranque dice de dónde sale la IP y los límites. Si no hay
  `CLIENT_IP_HEADER` ni `TRUST_PROXY_HOPS`, avisa que todos los visitantes compartirían el
  límite. La primera petición indica si la IP detectada es pública (correcto) o de red interna
  (es la del proxy: hay que corregir la configuración). Nunca se escribe la IP en el log.
- **Antes de publicar (obligatorio):** configurar en el hosting `CLIENT_IP_HEADER` o
  `TRUST_PROXY_HOPS` según cómo ese hosting entrega la IP (revisar su documentación):
  - Delante hay Cloudflare: `CLIENT_IP_HEADER=cf-connecting-ip`.
  - Fly.io: `CLIENT_IP_HEADER=fly-client-ip`.
  - Un hosting que documenta un header propio con la IP del visitante y lo **sobrescribe**
    siempre: ese header en `CLIENT_IP_HEADER`.
  - Si no, un solo proxy que agrega la IP a `X-Forwarded-For` (lo más común): `TRUST_PROXY_HOPS=1`.

  Después de desplegar, enviar un formulario y revisar el log: tiene que decir
  `Primera IP de cliente detectada: es pública`. Si dice `CONFIGURACIÓN DE IP INCORRECTA`,
  la configuración está mal. Con un valor equivocado pasa una de dos cosas: todos los
  visitantes comparten el límite (5 envíos cada 10 minutos para todo el sitio) o un bot puede
  inventar su IP y saltárselo.
- **Limitaciones:** el contador vive en memoria: se reinicia al redesplegar y no se comparte
  entre varias instancias (con varias, habría que moverlo a Redis).

**Honeypot:** los formularios de Contacto y Cotizador tienen un campo oculto `sitioWeb`
(`client/src/components/CampoTrampa.tsx`): fuera de la pantalla (no `display:none`),
`aria-hidden`, `tabIndex=-1` y `autocomplete="off"`. Una persona nunca lo llena. Si llega con
texto, la API responde un 201 normal pero no guarda nada, no consulta la base ni manda correo,
y deja en el log solo `[Anti-spam] Envío descartado por honeypot (origen: ...)`. Se revisa
después del límite, así que un bot insistente igual termina en 429. Este campo está oculto a
propósito: no hay que darle un label visible ni hacerlo alcanzable con el teclado.

---

## Errores seguros, dependencias y type-check ([14.4])

**Errores:** todas las respuestas de error de la API usan el formato único
`{ "error": "mensaje" }` (`src/lib/errors.ts`) y nunca incluyen rutas de archivos, stack
traces, nombres de modelos o colecciones, ni mensajes de Mongo, Cloudinary, Resend o JWT. El
detalle queda solo en el log del servidor, enmascarado con `safeErrorLog`
(`src/lib/privacy.ts`: correos, teléfonos, credenciales de URIs, API keys y tokens `Bearer`).

| Caso | Respuesta |
|---|---|
| Error inesperado | `500 {"error":"Ocurrió un error, intenta de nuevo."}` |
| Ruta de la API inexistente o método no permitido | `404 {"error":"Ruta no encontrada."}` |
| JSON roto | `400 {"error":"El cuerpo de la solicitud no tiene un formato válido."}` |
| Datos inválidos o campos no permitidos | `422` nombrando solo los campos (ej. `Campos no permitidos: extra.`) |
| Sin sesión / token inválido, vencido o revocado | `401 {"error":"No autorizado."}` |
| Demasiadas solicitudes | `429` con `Retry-After` (ver [14.3]) |
| Falla de Cloudinary (o Cloudinary sin configurar) | `502 {"error":"No se pudo procesar la imagen. Intenta de nuevo."}` |
| **Body de más de 12 MB** | **`413 Request Entity Too Large` sin cuerpo**: lo responde Bun antes de llegar a la API (`MAX_BODY_BYTES`, en `src/lib/seguridadHttp.ts`), así que no lleva el formato `{ error }`. El tope cubre la imagen más grande que acepta la galería (10 MB) más el formulario. |

En producción, `/swagger` no existe y el servidor no envía headers como `Server` o
`X-Powered-By`. Las páginas que no existen se tratan en
[Lo que sirve el servidor en producción](#lo-que-sirve-el-servidor-en-producción).

**Dependencias:** revisar con `bun audit` en la raíz y en `client/`.

**Type-check:** `bun run typecheck` corre los tres proyectos de TypeScript: el backend
(`src` y `tests`, con los tipos de Bun de `@types/bun`), las pruebas de código del navegador
(`tests/client`, que agrega los tipos del DOM) y `client/` (su propio `tsc -b`).

---

## Lo que sirve el servidor en producción

Con `NODE_ENV=production`, el mismo proceso que atiende la API sirve el sitio desde
`client/dist` (`src/lib/frontend.ts`). **`client/dist` tiene que existir** (se genera con
`bun run build` en `client/`): sin él, el servidor no arranca.

| Ruta | Respuesta |
|---|---|
| Página pública (`/`, `/servicios`, `/cotizador`, `/galeria`, `/nosotros`, `/contacto`) | `200` con su propio `<title>`, descripción, URL canónica, Open Graph y la precarga de su foto principal ya escritos en el `<head>`, para que los vea un buscador o una red social sin ejecutar JavaScript. Los textos salen de `client/src/data/paginas.ts`. |
| `/admin` y `/admin/*` | `200` con la app y `X-Robots-Tag: noindex, nofollow` |
| Cualquier otra ruta que no sea de la API | **`404`** con la app (React muestra su pantalla de "no encontrado") y `X-Robots-Tag: noindex, nofollow` |
| `/api/*` inexistente | `404 {"error":"Ruta no encontrada."}` |
| `/robots.txt` | Permite todo menos `/api/`, y enlaza el sitemap si hay `SITE_URL` |
| `/sitemap.xml` | Las 6 páginas públicas con el dominio de `SITE_URL`. **Sin `SITE_URL` responde 404** (y tampoco hay URLs canónicas ni `og:url`) |

- **Compresión:** el HTML y los archivos de texto (`.js`, `.css`, `.svg`, `.json`) se envían
  con brotli o gzip según lo que acepte el navegador (`src/lib/compresion.ts`).
- **Caché:** los archivos de `/assets` llevan un hash en el nombre y se guardan un año
  (`immutable`); el resto de archivos con nombre fijo (favicon, imagen para compartir), un día.

---

## Peso de las imágenes

Las fotos del sitio se editan en `client/imagenes-originales/` (no se publican tal cual).
`bun run imagenes` (en `client/`) genera en `client/src/assets/img/` una versión WebP por
ancho (480/720/960/1280, sin agrandar nunca la original) más la original como versión más
grande, el logo a 192 px sin pérdida, `public/og-image.jpg` recomprimida y el módulo
`client/src/assets/imagenes.ts` que importan las páginas. Cada versión se compara con la
original (SSIM ≥ 0.98): si se nota la compresión, el script sube la calidad.

Las páginas usan `<Foto>` (`client/src/components/Foto.tsx`) con `srcset` y un `sizes` que
describe el ancho real en el CSS: si cambia el layout de una sección, hay que actualizar su
`sizes` o el navegador elegirá una versión demasiado chica (borrosa) o demasiado grande.

Las fotos de la galería (Cloudinary) se piden con `f_auto,q_auto,c_limit,w_N` desde
`client/src/lib/cloudinary.ts`: la original subida no se modifica.
