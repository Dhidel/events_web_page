# events_web_page
Página web para eventos en Guatemala



# Spike [10.1]: Arquitectura de Integración de Correo y Credenciales Seguras

## 1. Contexto y Decisión Técnica
Para el envío de correos transaccionales (notificaciones de contacto y cotizaciones) se seleccionó **Resend** sobre una solución SMTP tradicional con Gmail. 

* **Confiabilidad:** Se evitan bloqueos de seguridad por accesos programáticos o autenticaciones en dos pasos de cuentas de correo convencionales.
* **Rendimiento:** Comunicación nativa vía API REST (HTTPS), óptima para entornos modernos basados en Bun/Node sin mantener conexiones TCP abiertas.
* **Entregabilidad:** Infraestructura preparada para firmas criptográficas (DKIM, SPF y DMARC), asegurando que los correos lleguen a la bandeja de entrada principal y no a spam.

---

## 2. Variables de Entorno y Seguridad
Las credenciales nunca se exponen en el frontend ni se versionan en el repositorio. El archivo `.env` está expresamente excluido en `.gitignore`.

Configuración requerida en `.env`:

```env
# Clave secreta obtenida desde el panel de Resend
RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxx

# Remitente del mensaje (onboarding@resend.dev en desarrollo; remitente oficial en producción)
EMAIL_FROM=onboarding@resend.dev

# Dirección receptora de notificaciones internas
EMAIL_TO_NOTIFY=correo_empresa@ejemplo.com
```

---

# [14.2] CORS y HTTPS en producción

El servidor usa `NODE_ENV` para saber si está en producción (`NODE_ENV=production`) y lee
los orígenes permitidos de `CORS_ORIGIN`. La lógica está en `src/lib/seguridadHttp.ts`.

| Variable | Desarrollo | Producción |
|---|---|---|
| `CORS_ORIGIN` | Opcional. `http://localhost:5173` siempre está permitido. | Uno o varios orígenes separados por coma, sin `/` final: `https://www.midominio.com,https://midominio.com`. Si queda vacía, **no se permite ningún origen externo** y se avisa en el log al arrancar. |
| `PORT` | 3000 por defecto. | Lo asigna el hosting. |

- **CORS:** solo los métodos `GET, POST, PUT, PATCH, DELETE, OPTIONS` y los headers
  `Content-Type` y `Authorization` (JWT del panel). Sin cookies (`credentials: false`).
  Como en producción este mismo servidor sirve el frontend, el sitio funciona aunque
  `CORS_ORIGIN` esté vacía: CORS solo importa si el frontend se hospeda en otro dominio.
- **HTTPS:** el certificado y la redirección de `http://` a `https://` los hace el hosting.
  En producción la API envía `Strict-Transport-Security: max-age=15552000` (180 días), sin
  `includeSubDomains` ni `preload` hasta confirmar el dominio final.
- **Headers de seguridad (solo en producción, en todas las respuestas):**
  `Content-Security-Policy` (scripts solo del propio dominio; estilos y fuentes de Google
  Fonts; imágenes propias, `data:` y de `res.cloudinary.com`; no se puede meter en un iframe),
  `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff` y
  `Referrer-Policy: strict-origin-when-cross-origin`. **Si se agrega un servicio externo** (un
  video de YouTube embebido, analytics, otra CDN de imágenes) hay que sumarlo a `CSP` en
  `src/lib/seguridadHttp.ts` o el navegador lo bloquea.

**Sesión del panel admin:** el JWT dura **12 horas** (`SESION_HORAS` en `src/plugins/jwt.ts`).
Además de la firma, `adminGuard` revisa en la base que el admin siga existiendo y que el token
sea de su `versionSesion` actual. Para cerrar todas las sesiones de un admin (p. ej. si perdió
la laptop): `bun run revocar-sesiones` y escribir su correo; sus tokens dejan de servir al
instante. Borrar al admin tiene el mismo efecto.

---

# [14.3] Rate limiting y anti-spam

Todo vive en `src/lib/limiteSolicitudes.ts`: un contador por IP en memoria con ventana
deslizante (`crearLimite`). Al pasarse, la API responde **429** con `{ "error": "..." }` y el
header `Retry-After` (segundos).

| Ruta | Límite por IP (por defecto) | Qué cuenta |
|---|---|---|
| `POST /api/cotizaciones` (Contacto y Cotizador) | 5 cada 10 min | Envíos válidos (los rechazados por validación no cuentan) |
| `POST /api/auth/login` | 10 cada 15 min | Solo intentos **fallidos** (401). Sin límite por correo, para que nadie pueda bloquear al admin a propósito |

Además, una solicitud idéntica a otra de los últimos 10 minutos no se guarda de nuevo
(`crearSolicitud` devuelve la que ya existe).

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
después del límite, así que un bot insistente igual termina en 429.

---

# [14.4] Errores seguros, dependencias y type-check

**Errores:** todas las respuestas de error usan el formato único `{ "error": "mensaje" }`
(`src/lib/errors.ts`) y nunca incluyen rutas de archivos, stack traces, nombres de modelos o
colecciones, ni mensajes de Mongo, Cloudinary, Resend o JWT. El detalle queda solo en el log
del servidor, enmascarado con `safeErrorLog` (correos, teléfonos, credenciales de URIs, API
keys y tokens `Bearer`).

| Caso | Respuesta |
|---|---|
| Error inesperado | `500 {"error":"Ocurrió un error, intenta de nuevo."}` |
| Ruta inexistente o método no permitido | `404 {"error":"Ruta no encontrada."}` (en producción también para `/api/...`; las demás rutas sirven el sitio) |
| JSON roto | `400 {"error":"El cuerpo de la solicitud no tiene un formato válido."}` |
| Datos inválidos | `422` nombrando solo los campos |
| Sin sesión / token inválido o vencido | `401 {"error":"No autorizado."}` |
| Demasiadas solicitudes | `429` con `Retry-After` (ver [14.3]) |
| Falla de Cloudinary | `502 {"error":"No se pudo procesar la imagen. Intenta de nuevo."}` |
| **Body de más de 12 MB** | **`413 Request Entity Too Large` sin cuerpo**: lo responde Bun antes de llegar a la API (`maxRequestBodySize`, en `src/lib/seguridadHttp.ts`), así que no lleva el formato `{ error }`. El tope cubre la imagen más grande que acepta la galería (10 MB) más el formulario. |

`/swagger` no existe en producción, y el servidor no envía headers como `Server` o
`X-Powered-By`.

**Dependencias:** revisar con `bun audit` en la raíz y en `client/`.

**Type-check:** `bun run typecheck` corre los tres proyectos de TypeScript: el backend
(`src` y `tests`, con los tipos de Bun de `@types/bun`), las pruebas de código del navegador
(`tests/client`, que agrega los tipos del DOM) y `client/` (su propio `tsc -b`).
