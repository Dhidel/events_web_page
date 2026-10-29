# Reglas del cotizador e integraciones

Cómo calcula el cotizador y cómo funcionan el correo (Resend) y WhatsApp, **tal como están
implementados hoy**. Para los esquemas de la base de datos y el detalle de cada endpoint, ver
Swagger: `http://localhost:3000/swagger` (solo en desarrollo).

- [Reglas del cotizador](#reglas-del-cotizador)
- [Correo de notificaciones (Resend)](#correo-de-notificaciones-resend)
- [WhatsApp](#whatsapp)

---

## Reglas del cotizador

### Qué significa cada campo de un servicio

Los servicios viven en la colección `servicios` (modelo `src/models/Servicio.ts`) y el sitio los
lee de `GET /api/servicios` (solo los que tienen `activo: true`, en el orden de `orden`).

| Campo | Significado |
|---|---|
| `precio` | Quetzales por **1 hora** de animación **dentro de la Ciudad Capital**. Es por personaje, o **por grupo** si el servicio tiene `artistas`. |
| `artistas` | Solo en grupos (batucadas): cuántos artistas incluye el precio. No cambia el cálculo, solo el texto: en el cotizador la cantidad cuenta **grupos completos**, no artistas ni horas. |
| `unidad` | `"por hora"` o `"por evento"`. Se guarda en el modelo pero **no interviene en el cálculo**: todos los servicios del catálogo usan `"por hora"`. |
| `activo` | `false` lo oculta del sitio y del cotizador sin borrarlo. Un servicio inactivo no se puede cotizar. |
| `categoria` | `Batucadas`, `Zanqueros` o `Personajes`. |

### Fórmula

```
subtotal de cada línea = cantidad × precio        (redondeado a centavos)
total                  = suma de los subtotales   (redondeado a centavos)
```

- El redondeo es `Math.round((monto + Number.EPSILON) * 100) / 100`, igual en el cliente
  (`client/src/lib/whatsapp.ts`) y en el servidor (`src/services/cotizador.service.ts`).
- No hay descuentos, recargos, mínimos ni impuestos.

### Límites y validaciones

| Regla | Valor | Dónde |
|---|---|---|
| Cantidad por servicio | Entero de **0 a 20**. Los botones +/– no pasan de ese rango; el servidor rechaza decimales, negativos, más de 20 y cantidades enviadas como texto (`"2"`). | `MAX_CANTIDAD_POR_SERVICIO` |
| Líneas por cotización | Hasta **50** | `src/routes/cotizaciones.ts` |
| Servicio repetido | No se permite (evita saltarse el máximo de 20) | `calcularEstimado` |
| Líneas en 0 | Se descartan | `calcularEstimado` |
| Selección vacía | Tiene que haber al menos un servicio con cantidad mayor que 0 | `calcularEstimado` |
| Servicio inexistente o inactivo | Se rechaza: "Uno de los personajes seleccionados ya no está disponible." | `recalcularDetalleCotizador` |
| Campos que no están en el esquema | Se rechazan: `Campos no permitidos: ...` | `rechazarCamposExtra` |

Todo rechazo responde **422** con un mensaje apto para mostrar al usuario, y no se guarda nada.

### El servidor recalcula el total

El navegador manda la selección (`servicioId` y `cantidad` de cada línea) junto con los
nombres, subtotales y total que calculó. **El servidor solo usa `servicioId` y `cantidad`:**
vuelve a leer los precios vigentes en MongoDB, recalcula nombres, precio unitario, subtotales y
total, y guarda ese resultado. Un total manipulado se descarta.

Si un precio cambió mientras el visitante armaba su estimado, el cotizador recibe el total
guardado, actualiza el catálogo en pantalla y avisa: "Nuestros precios se actualizaron mientras
armabas tu estimado". El mensaje de WhatsApp usa siempre el estimado guardado.

### Catálogo actual (seed)

Lo carga `bun run seed-servicios` (`src/scripts/seed-servicios.ts`): 15 servicios.

| Servicio | Precio | Notas |
|---|---|---|
| Batucada Hora Loca — 3 Tamboreros | Q3,800 | por grupo · 1 hora · `artistas: 3` |
| Batucada Hora Loca — 6 Tamboreros | Q6,500 | por grupo · 1 hora · `artistas: 6` |
| Batucada Temática Brasileña | Q3,800 | por grupo · 1 hora · `artistas: 3` |
| Batucada Temática Dominicana | Q3,800 | por grupo · 1 hora · `artistas: 3` |
| Batucada Temática Chapina | Q3,800 | por grupo · 1 hora · `artistas: 3` |
| Batucada Temática Colombiana | Q3,800 | por grupo · 1 hora · `artistas: 3` |
| Zanquero Iluminado | Q2,500 | por personaje · 1 hora |
| Personajes de Espejos Dorados y Plateados | Q2,200 | por personaje · 1 hora |
| Personajes VIP Trajes de Plumas | Q3,500 | por personaje · 1 hora |
| Personajes Temáticos | Q3,500 | por personaje · 1 hora |
| Robots LED | Q2,500 | por personaje · 1 hora |
| Zanqueras de Mariposas Iluminadas | Q2,500 | por personaje · 1 hora |
| Personajes de Carnaval | Q2,500 | por personaje · 1 hora |
| Cabezones de Tus Artistas Favoritos | Q1,800 | por personaje · 1 hora |
| Animals Mirror Plateados y Dorados | Q2,500 | por personaje · 1 hora |

En el cotizador, las batucadas se muestran como "**Q3,800 por grupo · 1 hora · 3 artistas.
La cantidad es el número de grupos, no de horas.**" y en el resumen como "2 grupos · …".
Ejemplo: 2 grupos de Batucada Temática Chapina + 1 Zanquero Iluminado = 2 × 3,800 + 1 × 2,500 =
**Q10,100**.

El seed no duplica nada y **no cambia precios existentes**: si un servicio ya existe (por
nombre) conserva su precio, descripción, categoría, unidad y `activo`; solo se actualizan
`orden` y `artistas`. `--force` borra todo el catálogo y lo recrea: no usarlo en producción.

### Texto legal

Aparece bajo el panel del estimado (`client/src/pages/Cotizador.tsx`), aprobado por el cliente,
tal cual:

> **Nota sobre este estimado:** Los valores mostrados por este cotizador automatizado son
> precios aproximados de referencia y pueden variar según los detalles específicos, ubicación y
> fecha de su evento. Este cálculo no representa una cotización final ni un compromiso de
> reserva. Para recibir una propuesta formal y definitiva a la medida de sus necesidades, por
> favor póngase en contacto con nuestro equipo de ventas de ShowCompany.

No cambiarlo sin el visto bueno del cliente.

### Datos de contacto y guardado

Para confirmar, el cotizador pide nombre (2 a 120 caracteres), teléfono (al menos 7 dígitos;
acepta `5555-1234` o `+502 5555 1234`), correo y, opcionalmente, el tipo de evento. Las mismas
reglas se validan en el navegador y en el servidor. Al confirmar se guarda una solicitud con
`origen: "cotizador"` y estado `nuevo`, que aparece en la bandeja del panel admin con su
desglose.

### Lo que NO está implementado

| Tema | Estado |
|---|---|
| **Casilla "fuera de la Ciudad Capital"** | **No implementada (se quitó en el commit `9b325d8`).** El servidor rechaza el campo `fueraDeCapital` con 422. El cliente indicó que el traslado se cotiza aparte, según la distancia y el día. |
| Traslado con precio | No existe. El cotizador aclara: "no incluye traslado, montaje ni horas extra". |
| Hora extra | No existe: el precio es siempre por 1 hora y la cantidad cuenta personajes o grupos, no horas. |
| Montaje, descuentos, impuestos | No existen. |

---

## Correo de notificaciones (Resend)

### Qué hace hoy

Cada vez que se guarda una solicitud nueva (formulario de Contacto o Cotizador), el servidor
manda un correo al equipo con Resend (`src/services/email.service.ts`).

- **Cuándo:** después de guardar, **en segundo plano**. La respuesta al visitante no espera al
  correo.
- **Si falla** (Resend rechaza el envío, no hay red o falta la clave): la solicitud **ya está
  guardada** y el error solo queda en el log, enmascarado:
  `[Correo] No se pudo enviar la notificación de la solicitud <id>: ...`.
- **Sin correo duplicado:** si llega la misma solicitud otra vez en 10 minutos (doble clic,
  reintento), no se guarda de nuevo ni se manda otro correo.
- **Honeypot:** un envío de bot descartado no manda correo.

| Variable | Qué hace | Si falta |
|---|---|---|
| `RESEND_API_KEY` | Clave de la API de Resend | El servidor avisa al arrancar; las solicitudes se guardan pero no se manda correo |
| `EMAIL_FROM` | Remitente | Se usa `onboarding@resend.dev` (el remitente de pruebas de Resend, que **solo puede enviar al correo dueño de la cuenta**) |
| `EMAIL_TO_NOTIFY` | Destinatario | Se usa una dirección de desarrollo escrita en el código. **Hoy admite UN solo destinatario.** |

### Qué contiene el correo

- **Asunto:** `Nueva Cotización: <nombre>` (Cotizador) o `Nuevo Contacto: <nombre>` (Contacto).
- **Datos:** origen, nombre, teléfono (enlace `tel:`), correo (enlace `mailto:`) y, si los hay,
  tipo de evento, fecha del evento y mensaje del cliente.
- **Solo en cotizaciones:** el desglose (servicio, cantidad, precio unitario, subtotal) y el
  **total estimado**, con los valores que calculó el servidor.
- **Botón "Responder al cliente por WhatsApp":** abre un chat con el teléfono del cliente y un
  saludo listo (ver [WhatsApp](#whatsapp)).

Todo el texto del cliente se escapa antes de meterlo al HTML del correo.

### Configuración paso a paso

1. Crea una cuenta en [resend.com](https://resend.com).
2. En **API Keys**, crea una clave y ponla en `.env` como `RESEND_API_KEY` (nunca en el código
   ni en el repositorio).
3. **Desarrollo:** deja `EMAIL_FROM=onboarding@resend.dev` y pon en `EMAIL_TO_NOTIFY` el correo
   dueño de la cuenta de Resend (el remitente de pruebas solo puede enviarle a él).
4. **Producción:** en Resend → **Domains**, agrega el dominio de la empresa y crea los
   registros DNS que indica (SPF y DKIM) hasta que aparezca como verificado. Después:
   - `EMAIL_FROM` = una dirección de ese dominio (ej. `notificaciones@ejemplo.com`);
   - `EMAIL_TO_NOTIFY` = el correo del equipo que recibe las solicitudes (una sola dirección).
5. Prueba el envío: `bun run src/scripts/test-email.ts` manda un correo real de prueba (una
   solicitud de Contacto de ejemplo) al `EMAIL_TO_NOTIFY` configurado. Después, envía un
   formulario desde el sitio y revisa el log: tiene que decir
   `[Correo] Notificación enviada por Resend (id ...)`.

---

## WhatsApp

### Cómo funciona hoy

No hay integración con la API de WhatsApp: el sitio usa **enlaces `wa.me`** que abren un chat
con un mensaje ya escrito. El visitante lo revisa y lo envía desde su WhatsApp.

| Dónde | Mensaje | Código |
|---|---|---|
| Botón flotante, franja superior, pie, botones "Escribir por WhatsApp" | Saludo fijo pidiendo información | `generarEnlaceWhatsAppDirecto` en `client/src/utils/whatsapp.ts` |
| **Cotizador** | `Hola! Usé el cotizador del sitio y me interesa este estimado:`, una línea por servicio (`2x Batucada Temática Chapina (Q7,600)`) y `Total estimado: Q...` | `mensajeEstimado` en `client/src/lib/whatsapp.ts` |
| **Contacto** | Saludo, nombre, tipo de evento, fecha y mensaje (con emojis), terminando en `Enviado desde showcompany.net` | `generarEnlaceWhatsApp` en `client/src/utils/whatsapp.ts` |
| **Correo al equipo** | Botón para **responder al cliente**: chat con el teléfono del cliente y un saludo de Show Company | `generarEnlaceRespuestaCliente` en `src/services/whatsapp.service.ts` |

**Número de la empresa:** `VITE_WHATSAPP_PHONE` en **`client/.env`** (código de país + número,
solo dígitos). Si no existe, se usa el número escrito en `client/src/lib/whatsapp.ts` y
`client/src/utils/whatsapp.ts`. Ponerla en el `.env` de la raíz **no tiene efecto**: Vite solo
lee `client/.env`.

**Teléfono del cliente (botón del correo):** se dejan solo los dígitos; si quedan 8, se
antepone `502` (Guatemala). Si algo falla al armar el enlace, se usa uno sin mensaje.

### Guardar primero, abrir WhatsApp después

En el Cotizador y en Contacto, WhatsApp **solo se abre si la solicitud quedó guardada**
(`guardarYAbrirWhatsApp` en `client/src/lib/whatsapp.ts`):

1. En el mismo clic se abre una pestaña en blanco. Los navegadores bloquean las ventanas que se
   abren después de esperar al servidor; así no se bloquea.
2. Se guarda la solicitud (con un límite de 15 segundos).
3. Si se guardó, esa pestaña va a WhatsApp con el mensaje. En el Cotizador, el mensaje lleva el
   estimado que **guardó el servidor**.
4. Si falló, la pestaña se cierra, WhatsApp no se abre y se muestra el error:
   - **Cotizador:** ofrece **Reintentar** o **Continuar por WhatsApp de todas formas** (con el
     estimado armado en el navegador). Si el error es **429** (demasiados envíos), la opción
     principal pasa a ser **Continuar por WhatsApp** y reintentar queda como "más tarde".
   - **Contacto:** el formulario conserva los datos para volver a enviar. Si el error es
     **429**, ofrece **Escribirnos por WhatsApp** (con el saludo fijo).
5. Si se guardó pero el navegador no dejó abrir la pestaña, la página muestra un botón
   **Abrir WhatsApp** con el mismo mensaje.

### Configuración paso a paso

1. Crea `client/.env` con el número de la empresa (solo dígitos, con código de país):
   ```env
   VITE_WHATSAPP_PHONE=50200000000
   ```
2. Recompila el cliente (`cd client && bun run build`) o reinicia Vite en desarrollo: el número
   se fija al compilar.
3. Verifica: el botón flotante, un envío del Contacto y uno del Cotizador tienen que abrir
   `wa.me/<ese número>`.

### Variables que hoy no tienen efecto

`WHATSAPP_PHONE` y `WHATSAPP_API_TOKEN` (en el `.env` de la raíz) solo las leen funciones del
servidor que hoy no se usan (`construirMensajeWhatsApp`, `generarEnlaceWhatsAppBackend` y
`enviarNotificacionWhatsAppOficial` en `src/services/whatsapp.service.ts`, y
`src/services/whatsappService.ts`). Cambiarlas no modifica nada en el sitio.
