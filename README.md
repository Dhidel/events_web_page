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
