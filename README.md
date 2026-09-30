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