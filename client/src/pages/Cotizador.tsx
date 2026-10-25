import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { animacionEvento } from "../assets/imagenes";
import { FondoBanner } from "../components/Foto";
import { EVENT_TYPES } from "../data/eventTypes";
import {
  isNameValid,
  isPhoneValid,
  isEmailValid,
  CORREO_MAX,
  MENSAJE_CORREO,
  MENSAJE_NOMBRE,
  MENSAJE_TELEFONO,
  NOMBRE_MAX,
  primerCampoConError,
  TELEFONO_MAX,
} from "../lib/validators";
import { fetchServicios, submitCotizacion, type Servicio } from "../lib/api";
import {
  enlaceWhatsApp,
  guardarYAbrirWhatsApp,
  leerEstimadoGuardado,
  mensajeEstimado,
  redondearMonto,
} from "../lib/whatsapp";
import CampoTrampa from "../components/CampoTrampa";

type ContactField = "name" | "phone" | "email";
type ContactState = Record<ContactField, string>;

// Ids de los campos de contacto (label for/id, mensaje de error y foco al primer error).
const CAMPOS: ContactState = { name: "cotizador-nombre", phone: "cotizador-telefono", email: "cotizador-correo" };
const ORDEN_CAMPOS = ["name", "phone", "email"] as const;

// Props de accesibilidad de un campo con validación: id, aria-invalid y el mensaje asociado.
const propsDeError = (campo: ContactField, error: string) => ({
  id: CAMPOS[campo],
  "aria-invalid": error ? true : undefined,
  "aria-describedby": error ? `${CAMPOS[campo]}-error` : undefined,
});

// Estado del guardado al confirmar. WhatsApp solo se abre si la cotización quedó guardada.
type Confirmacion =
  | { estado: "inicial" }
  | { estado: "guardando" }
  // preciosActualizados: el servidor guardó un total distinto al que veía el cliente.
  | { estado: "guardada"; whatsappAbierto: boolean; preciosActualizados: boolean }
  // limite: el servidor respondió 429 (demasiadas solicitudes seguidas desde esta conexión).
  | { estado: "error"; mensaje: string; limite?: boolean };

// Si el backend no responde en este tiempo se trata como error (y se ofrece reintentar).
const SAVE_TIMEOUT_MS = 15_000;

export default function Cotizador() {
  // Personajes/actos con precio, servidos desde /api/servicios (MongoDB).
  const [servicios, setServicios] = useState<Servicio[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  // Cantidad por id de servicio; un id ausente equivale a 0.
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [contact, setContact] = useState<ContactState>({ name: "", phone: "", email: "" });
  const [contactErrors, setContactErrors] = useState<ContactState>({ name: "", phone: "", email: "" });
  const [eventType, setEventType] = useState(EVENT_TYPES[0]);
  const [confirmacion, setConfirmacion] = useState<Confirmacion>({ estado: "inicial" });
  const [sitioWeb, setSitioWeb] = useState(""); // honeypot: siempre vacío para una persona real
  // Freno síncrono contra doble clic: el estado de React se actualiza después del clic.
  const guardandoRef = useRef(false);
  // Foco después de una acción (WCAG 2.4.3): el botón pulsado desaparece al guardar o reiniciar, y
  // sin esto el foco cae al <body> y el siguiente Tab empieza desde arriba de la página.
  const mensajeResultadoRef = useRef<HTMLParagraphElement>(null);
  const tituloSeleccionRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    fetchServicios()
      .then((data) => {
        setServicios(data);
        setStatus("ready");
      })
      .catch(() => setStatus("error"));
  }, []);

  const reintentarCarga = () => {
    setStatus("loading");
    fetchServicios()
      .then((data) => {
        setServicios(data);
        setStatus("ready");
      })
      .catch(() => setStatus("error"));
  };

  // Vuelve a pedir el catálogo sin tocar la selección, para mostrar precios y personajes
  // vigentes. Si falla no pasa nada: se sigue con el catálogo que ya estaba en pantalla.
  const refrescarCatalogo = () => {
    fetchServicios()
      .then(setServicios)
      .catch(() => {});
  };

  const changeQty = (id: string, delta: number) => {
    // Mientras se guarda, la selección no cambia: lo que se ve es lo que se está enviando.
    if (guardandoRef.current) return;
    setQuantities((prev) => ({
      ...prev,
      [id]: Math.min(20, Math.max(0, (prev[id] ?? 0) + delta)),
    }));
    // Una selección nueva es otra cotización: se puede volver a confirmar.
    setConfirmacion({ estado: "inicial" });
  };

  const resetQuoter = () => {
    if (guardandoRef.current) return;
    setQuantities({});
    setContact({ name: "", phone: "", email: "" });
    setContactErrors({ name: "", phone: "", email: "" });
    setEventType(EVENT_TYPES[0]);
    setConfirmacion({ estado: "inicial" });
    // "Reiniciar" desaparece al vaciar la selección: el foco vuelve al inicio de la lista de personajes.
    tituloSeleccionRef.current?.focus();
  };

  // Al terminar de guardar (bien o mal), el foco pasa al mensaje del resultado: el lector de
  // pantalla lo lee y el siguiente Tab llega a "Abrir WhatsApp" o "Reintentar".
  useEffect(() => {
    if (confirmacion.estado === "guardada" || confirmacion.estado === "error") mensajeResultadoRef.current?.focus();
  }, [confirmacion.estado]);

  const updateContact = (field: ContactField, value: string) => {
    setContact((c) => ({ ...c, [field]: value }));
    // Corregir un dato después de guardar es otra solicitud: se puede volver a confirmar.
    setConfirmacion((c) => (c.estado === "guardada" ? { estado: "inicial" } : c));
    setContactErrors((prev) => {
      if (!prev[field]) return prev;
      const stillInvalid =
        field === "name" ? !isNameValid(value) : field === "phone" ? !isPhoneValid(value) : !isEmailValid(value);
      return stillInvalid ? prev : { ...prev, [field]: "" };
    });
  };

  const { total, totalQty, lines, waHref } = useMemo(() => {
    let total = 0;
    let totalQty = 0;
    // esGrupo: el precio es por grupo (batucadas con `artistas`) y la cantidad cuenta grupos.
    const lines: { id: string; name: string; qty: number; subtotal: number; esGrupo: boolean }[] = [];
    for (const servicio of servicios) {
      const qty = quantities[servicio.id] ?? 0;
      if (qty > 0) {
        const subtotal = redondearMonto(qty * servicio.precio);
        total = redondearMonto(total + subtotal);
        totalQty += qty;
        lines.push({ id: servicio.id, name: servicio.nombre, qty, subtotal, esGrupo: servicio.artistas !== undefined });
      }
    }
    const waHref = enlaceWhatsApp(
      mensajeEstimado(
        lines.map((l) => ({ nombre: l.name, cantidad: l.qty, subtotal: l.subtotal })),
        total
      )
    );
    return { total, totalQty, lines, waHref };
  }, [servicios, quantities]);

  const hasSelection = totalQty > 0;

  // Se usa tanto en "Confirmar" como en "Reintentar". Tiene que llamarse directo desde el
  // clic: guardarYAbrirWhatsApp abre la pestaña de WhatsApp antes de esperar al servidor.
  const handleConfirm = async () => {
    if (guardandoRef.current) return;

    const nextErrors: ContactState = {
      name: isNameValid(contact.name) ? "" : MENSAJE_NOMBRE,
      phone: isPhoneValid(contact.phone) ? "" : MENSAJE_TELEFONO,
      email: isEmailValid(contact.email) ? "" : MENSAJE_CORREO,
    };
    setContactErrors(nextErrors);
    // Con errores, el foco va al primer campo inválido: el lector de pantalla lee el campo y su mensaje.
    const conError = primerCampoConError(nextErrors, ORDEN_CAMPOS);
    if (conError) {
      document.getElementById(CAMPOS[conError])?.focus();
      return;
    }

    guardandoRef.current = true;
    setConfirmacion({ estado: "guardando" });

    const resultado = await guardarYAbrirWhatsApp({
      // WhatsApp se abre con el estimado que guardó el servidor (precios vigentes), no con el
      // que se calculó aquí: si un precio cambió, el mensaje y lo guardado coinciden.
      waHref: (guardada) => {
        const estimado = leerEstimadoGuardado(guardada.detalleCotizador);
        return estimado
          ? enlaceWhatsApp(mensajeEstimado(estimado.lineas, estimado.total))
          : waHref;
      },
      guardar: () =>
        submitCotizacion(
          {
            nombre: contact.name.trim(),
            telefono: contact.phone.trim(),
            correo: contact.email.trim(),
            tipoEvento: eventType !== EVENT_TYPES[0] ? eventType : undefined,
            origen: "cotizador",
            // El servidor recalcula nombres, subtotales y total con los precios de MongoDB.
            detalleCotizador: {
              personajes: lines.map((l) => ({ servicioId: l.id, nombre: l.name, cantidad: l.qty, subtotal: l.subtotal })),
              total,
            },
            sitioWeb: sitioWeb || undefined,
          },
          AbortSignal.timeout(SAVE_TIMEOUT_MS)
        ),
    });

    guardandoRef.current = false;

    if (!resultado.ok) {
      // Puede haber fallado porque el catálogo cambió (un personaje ya no está disponible).
      refrescarCatalogo();
      setConfirmacion({ estado: "error", mensaje: resultado.error, limite: resultado.limite });
      return;
    }

    const estimado = leerEstimadoGuardado(resultado.guardado.detalleCotizador);
    const preciosActualizados = estimado !== null && estimado.total !== total;
    // Con el catálogo al día, el panel muestra el mismo total que quedó guardado.
    if (preciosActualizados) refrescarCatalogo();
    setConfirmacion({ estado: "guardada", whatsappAbierto: resultado.whatsappAbierto, preciosActualizados });
  };

  const guardando = confirmacion.estado === "guardando";

  return (
    <>
      <section className="page-banner">
        <FondoBanner imagen={animacionEvento} />
        <div className="wrap">
          <div className="breadcrumb">
            <Link to="/">Inicio</Link>
            <svg><use href="#i-arrow" /></svg>
            <span>Cotizador</span>
          </div>
          <span className="hero-badge"><svg><use href="#i-sparkle" /></svg>Estimado inmediato</span>
          <h1 style={{ marginTop: "16px" }}>Arma tu <span className="accent">espectáculo</span> y calcula el estimado</h1>
          <p>Elige cuántos personajes o actos quieres — el precio se calcula con nuestras tarifas reales por hora. El total final (traslado fuera de la capital, horas extra, montaje) siempre se confirma con un asesor por WhatsApp.</p>
        </div>
      </section>

      <section>
        <div className="wrap">
          <div className="contact-page-grid">
            <div>
              <span className="eyebrow on-light"><svg><use href="#i-sparkle" /></svg>Selecciona tus personajes</span>
              <h2 ref={tituloSeleccionRef} tabIndex={-1} className="foco-programatico" style={{ fontSize: "24px", fontWeight: 900, marginBottom: "8px" }}>¿Qué quieres en tu evento?</h2>
              <p style={{ color: "var(--muted)", fontSize: "13.5px", marginBottom: "22px" }}>
                Precios reales por personaje (las batucadas, por grupo), 1 hora de animación, dentro de la Ciudad
                Capital.
              </p>

              {status === "loading" && <p className="gallery-empty">Cargando servicios…</p>}
              {status === "error" && (
                <div className="gallery-empty">
                  <p>No se pudieron cargar los servicios.</p>
                  <button type="button" className="btn btn-outline" onClick={reintentarCarga} style={{ marginTop: "14px" }}>
                    Reintentar
                  </button>
                </div>
              )}
              {status === "ready" && (
                <div className="acts-selector">
                  {servicios.map((servicio) => (
                    <div className="act-row" key={servicio.id}>
                      <div className="act-row-info">
                        <h3>{servicio.nombre}</h3>
                        {servicio.artistas !== undefined ? (
                          // Grupo (batucadas): el precio cubre 1 hora con N artistas y la cantidad cuenta grupos.
                          <>
                            <span>{servicio.descripcion}</span>
                            <span className="act-row-grupo">
                              <strong>Q{servicio.precio.toLocaleString("es-GT")}</strong> por grupo · 1 hora ·{" "}
                              {servicio.artistas} artistas. La cantidad es el número de grupos, no de horas.
                            </span>
                          </>
                        ) : (
                          <span>
                            {servicio.descripcion} · 1 hora · <strong>Q{servicio.precio.toLocaleString("es-GT")}</strong> c/u
                          </span>
                        )}
                      </div>
                      <div className="act-row-qty">
                        <button
                          type="button"
                          className="qty-btn qty-minus"
                          aria-label={`Quitar ${servicio.artistas !== undefined ? "un grupo" : "uno"} de ${servicio.nombre}`}
                          onClick={() => changeQty(servicio.id, -1)}
                          disabled={guardando}
                        >
                          –
                        </button>
                        <input
                          type="number"
                          className="qty-input"
                          value={quantities[servicio.id] ?? 0}
                          min={0}
                          max={20}
                          readOnly
                          // Solo muestra la cantidad: se cambia con +/–, así que no es una parada del Tab.
                          tabIndex={-1}
                          aria-label={servicio.artistas !== undefined ? `Grupos de ${servicio.nombre}` : `Cantidad de ${servicio.nombre}`}
                        />
                        <button
                          type="button"
                          className="qty-btn qty-plus"
                          aria-label={`Agregar ${servicio.artistas !== undefined ? "un grupo" : "uno"} de ${servicio.nombre}`}
                          onClick={() => changeQty(servicio.id, 1)}
                          disabled={guardando}
                        >
                          +
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div>
              <div className="quoter-panel">
                <span className="eyebrow" style={{ color: "var(--blue-light)" }}><svg><use href="#i-sparkle" /></svg>Tu estimado</span>
                {/* aria-live: el lector de pantalla anuncia el total nuevo después de cada +/–. */}
                <div aria-live="polite" aria-atomic="true" style={{ fontSize: "42px", fontWeight: 900, margin: "10px 0 4px" }}>
                  <span className="sr-only">Total estimado: </span>Q {total.toLocaleString("es-GT")}
                </div>
                <p style={{ color: "rgba(255,255,255,.5)", fontSize: "12.5px", marginBottom: "24px" }}>
                  Suma de personajes seleccionados — no incluye traslado, montaje ni horas extra
                </p>

                <div style={{ borderTop: "1px solid rgba(255,255,255,.12)", paddingTop: "16px", display: "flex", flexDirection: "column", gap: "8px", fontSize: "13px", color: "rgba(255,255,255,.8)", maxHeight: "260px", overflowY: "auto" }}>
                  {lines.length === 0 ? (
                    <span style={{ color: "rgba(255,255,255,.5)" }}>Aún no has seleccionado personajes.</span>
                  ) : (
                    lines.map((l) => (
                      <div key={l.id} style={{ display: "flex", justifyContent: "space-between", gap: "12px" }}>
                        <span>
                          {l.esGrupo ? `${l.qty} ${l.qty === 1 ? "grupo" : "grupos"} · ` : `${l.qty}x `}
                          {l.name}
                        </span>
                        <span>Q{l.subtotal.toLocaleString("es-GT")}</span>
                      </div>
                    ))
                  )}
                </div>

                {hasSelection && (
                  <div className="quoter-contact">
                    <span className="eyebrow" style={{ color: "var(--blue-light)", marginBottom: 0 }}>
                      Tus datos de contacto
                    </span>
                    {/* Labels ocultos a la vista (.sr-only): el diseño sigue mostrando el placeholder. */}
                    <div>
                      <label htmlFor={CAMPOS.name} className="sr-only">Nombre completo</label>
                      <input
                        type="text"
                        autoComplete="name"
                        placeholder="Nombre completo"
                        maxLength={NOMBRE_MAX}
                        value={contact.name}
                        onChange={(e) => updateContact("name", e.target.value)}
                        {...propsDeError("name", contactErrors.name)}
                      />
                      {contactErrors.name && <span id={`${CAMPOS.name}-error`} className="field-error">{contactErrors.name}</span>}
                    </div>
                    <div>
                      <label htmlFor={CAMPOS.phone} className="sr-only">Teléfono</label>
                      <input
                        type="tel"
                        autoComplete="tel"
                        placeholder="Teléfono"
                        maxLength={TELEFONO_MAX}
                        value={contact.phone}
                        onChange={(e) => updateContact("phone", e.target.value)}
                        {...propsDeError("phone", contactErrors.phone)}
                      />
                      {contactErrors.phone && <span id={`${CAMPOS.phone}-error`} className="field-error">{contactErrors.phone}</span>}
                    </div>
                    <div>
                      <label htmlFor={CAMPOS.email} className="sr-only">Correo electrónico</label>
                      <input
                        type="email"
                        autoComplete="email"
                        placeholder="Correo electrónico"
                        maxLength={CORREO_MAX}
                        value={contact.email}
                        onChange={(e) => updateContact("email", e.target.value)}
                        {...propsDeError("email", contactErrors.email)}
                      />
                      {contactErrors.email && <span id={`${CAMPOS.email}-error`} className="field-error">{contactErrors.email}</span>}
                    </div>
                    <label htmlFor="cotizador-tipo-evento" className="sr-only">Tipo de evento</label>
                    <select
                      id="cotizador-tipo-evento"
                      value={eventType}
                      onChange={(e) => {
                        setEventType(e.target.value);
                        setConfirmacion((c) => (c.estado === "guardada" ? { estado: "inicial" } : c));
                      }}
                    >
                      {EVENT_TYPES.map((opt) => (
                        <option key={opt}>{opt}</option>
                      ))}
                    </select>
                    <CampoTrampa value={sitioWeb} onChange={setSitioWeb} />
                  </div>
                )}

                {hasSelection && confirmacion.estado === "error" && confirmacion.limite ? (
                  // 429: reintentar enseguida volvería a fallar, así que WhatsApp pasa a ser la opción
                  // principal (un enlace normal: no se abre ninguna pestaña por su cuenta).
                  <div className="quoter-error" role="alert">
                    <p ref={mensajeResultadoRef} tabIndex={-1} className="foco-programatico">
                      <strong>{confirmacion.mensaje}</strong> Mientras tanto, puedes escribirnos directo por
                      WhatsApp con tu selección.
                    </p>
                    <a
                      href={waHref}
                      target="_blank"
                      rel="noreferrer"
                      className="btn btn-primary"
                      style={{ width: "100%", justifyContent: "center" }}
                    >
                      <svg><use href="#i-whatsapp" /></svg>Continuar por WhatsApp
                    </a>
                    <button
                      type="button"
                      className="btn btn-ghost"
                      onClick={handleConfirm}
                      style={{ width: "100%", justifyContent: "center" }}
                    >
                      Reintentar más tarde
                    </button>
                  </div>
                ) : hasSelection && confirmacion.estado === "error" ? (
                  <div className="quoter-error" role="alert">
                    <p ref={mensajeResultadoRef} tabIndex={-1} className="foco-programatico">
                      <strong>No pudimos guardar tu cotización.</strong> {confirmacion.mensaje} Tu selección sigue
                      aquí: puedes reintentar o escribirnos directo por WhatsApp.
                    </p>
                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={handleConfirm}
                      style={{ width: "100%", justifyContent: "center" }}
                    >
                      Reintentar
                    </button>
                    <a
                      href={waHref}
                      target="_blank"
                      rel="noreferrer"
                      className="btn btn-ghost"
                      style={{ width: "100%", justifyContent: "center" }}
                    >
                      <svg><use href="#i-whatsapp" /></svg>Continuar por WhatsApp de todas formas
                    </a>
                  </div>
                ) : hasSelection && confirmacion.estado === "guardada" ? (
                  // Ya guardada: en vez de "Confirmar" (un segundo clic duplicaría la solicitud) queda
                  // un enlace directo a WhatsApp, que también sirve si el navegador no abrió la pestaña.
                  // Cambiar la selección o los datos vuelve a mostrar "Confirmar".
                  <>
                    <p ref={mensajeResultadoRef} tabIndex={-1} className="quoter-success foco-programatico" role="status">
                      ¡Listo! Guardamos tu cotización.{" "}
                      {confirmacion.whatsappAbierto ? "¿No se abrió WhatsApp?" : "Continúa en WhatsApp:"}
                    </p>
                    {confirmacion.preciosActualizados && (
                      <p className="quoter-hint" role="status">
                        Nuestros precios se actualizaron mientras armabas tu estimado. El total de arriba y el
                        mensaje de WhatsApp ya usan los precios vigentes.
                      </p>
                    )}
                    <a
                      href={waHref}
                      target="_blank"
                      rel="noreferrer"
                      className="btn btn-primary"
                      style={{ width: "100%", justifyContent: "center", marginTop: "10px" }}
                    >
                      <svg><use href="#i-whatsapp" /></svg>Abrir WhatsApp
                    </a>
                  </>
                ) : hasSelection ? (
                  <button
                    type="button"
                    className="btn btn-primary"
                    style={{ width: "100%", justifyContent: "center", marginTop: "16px" }}
                    onClick={handleConfirm}
                    // aria-disabled y no disabled: un botón deshabilitado pierde el foco. El doble
                    // clic mientras se guarda lo frena guardandoRef en handleConfirm.
                    aria-disabled={guardando || undefined}
                  >
                    <svg><use href="#i-whatsapp" /></svg>
                    {guardando ? "Guardando tu cotización…" : "Confirmar este estimado por WhatsApp"}
                  </button>
                ) : (
                  <>
                    <button type="button" className="btn btn-primary" disabled style={{ width: "100%", justifyContent: "center", marginTop: "26px" }}>
                      <svg><use href="#i-whatsapp" /></svg>Confirmar este estimado por WhatsApp
                    </button>
                    <p className="quoter-hint">Selecciona al menos un personaje para continuar.</p>
                  </>
                )}

                {hasSelection && (
                  <button
                    type="button"
                    className="btn btn-reset"
                    onClick={resetQuoter}
                    disabled={guardando}
                    style={{ width: "100%", justifyContent: "center", marginTop: "12px" }}
                  >
                    Reiniciar cotización
                  </button>
                )}

                {/* Texto legal aprobado por el cliente: no cambiarlo sin su visto bueno. */}
                <p style={{ fontSize: "12px", color: "rgba(255,255,255,.55)", marginTop: "14px", lineHeight: 1.5 }}>
                  <strong>Nota sobre este estimado:</strong> Los valores mostrados por este cotizador automatizado son
                  precios aproximados de referencia y pueden variar según los detalles específicos, ubicación y fecha
                  de su evento. Este cálculo no representa una cotización final ni un compromiso de reserva. Para
                  recibir una propuesta formal y definitiva a la medida de sus necesidades, por favor póngase en
                  contacto con nuestro equipo de ventas de ShowCompany.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
