import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import aveTematico from "../assets/img/ave-tematico.jpg";

const FAQS = [
  {
    q: "¿Cuál es el precio de sus servicios o espectáculos?",
    a: "Cada producción que realizamos es única y se diseña a la medida. El precio final depende de la magnitud técnica, el tipo de show y el escenario elegido. Nos adaptamos a proyectos que busquen excelencia, garantizando siempre que cada centavo invertido se refleje en un impacto visual impecable y seguro. Contáctanos hoy para presentarte una propuesta económica personalizada.",
  },
  {
    q: "¿Cuentan con un catálogo de shows disponibles o listado de precios?",
    a: "¡Por supuesto! Poseemos un portafolio exclusivo con una amplia variedad de conceptos artísticos y montajes de alta gama que hemos perfeccionado a lo largo de nuestros 25 años de trayectoria en Guatemala. Al escribirnos, te compartiremos nuestro catálogo visual para que elijas la línea de entretenimiento que mejor se adapte a tu marca o evento.",
  },
  {
    q: "¿Qué tipos de espectáculos tienen?",
    a: "Diseñamos y ejecutamos desde magnas producciones corporativas y galas exclusivas, hasta espectáculos masivos de primer nivel. El único requisito indispensable en nuestro filtro de calidad es que los shows y los escenarios seleccionados respeten los principios éticos, garanticen la seguridad total del público y eleven el prestigio de los organizadores.",
  },
  {
    q: "¿Cuánto tiempo dura cada espectáculo o montaje?",
    a: "La duración del show en escena es completamente flexible y se ajusta al cronograma de tu evento, desde intervenciones de alto impacto de 60 minutos hasta espectáculos continuos. Nuestra experiencia nos permite coordinar logísticas impecables en tiempos récord, cuidando cada detalle antes de que llegue el primer invitado.",
  },
  {
    q: "¿Cómo podemos iniciar la cotización de nuestro evento?",
    a: "El proceso es muy sencillo y directo. Solo necesitas compartirnos la fecha ideal, el lugar que tienes en mente y el tipo de impacto que deseas lograr. Nuestro equipo de asesores expertos te guiará de inmediato para mostrarte nuestras opciones exclusivas y diseñar la cotización perfecta para tu proyecto.",
  },
];

const EVENT_TYPES = [
  "¿Qué tipo de evento estás planificando?",
  "Evento Corporativo / Empresarial",
  "Concierto o Espectáculo Masivo",
  "Gala o Celebración Privada Premium",
  "Boda",
  "Quinceaños",
  "Otro",
];

const PHONE_REGEX = /^[+]?[\d\s()-]{7,20}$/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const isNameValid = (value: string) => value.trim().length > 0;
const isPhoneValid = (value: string) => PHONE_REGEX.test(value.trim());
const isEmailValid = (value: string) => EMAIL_REGEX.test(value.trim());

type ContactErrors = { name: string; phone: string; email: string };

export default function Contacto() {
  const [form, setForm] = useState({
    name: "",
    phone: "",
    email: "",
    eventType: EVENT_TYPES[0],
    date: "",
    details: "",
  });
  const [errors, setErrors] = useState<ContactErrors>({ name: "", phone: "", email: "" });

  const updateField = (field: keyof ContactErrors, value: string) => {
    setForm((f) => ({ ...f, [field]: value }));
    setErrors((prev) => {
      if (!prev[field]) return prev;
      const stillInvalid =
        field === "name" ? !isNameValid(value) : field === "phone" ? !isPhoneValid(value) : !isEmailValid(value);
      return stillInvalid ? prev : { ...prev, [field]: "" };
    });
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();

    const nextErrors: ContactErrors = {
      name: isNameValid(form.name) ? "" : "Por favor ingresa tu nombre.",
      phone: isPhoneValid(form.phone) ? "" : "Ingresa un teléfono válido (solo números, espacios, + o -).",
      email: isEmailValid(form.email) ? "" : "Ingresa un correo electrónico válido.",
    };
    setErrors(nextErrors);

    if (nextErrors.name || nextErrors.phone || nextErrors.email) return;

    alert("Demo: aquí se enviaría el formulario a tu backend y se notificaría al equipo por WhatsApp.");
  };

  return (
    <>
      <section className="page-banner">
        <div className="page-banner-bg" style={{ backgroundImage: `url('${aveTematico}')` }} />
        <div className="wrap">
          <div className="breadcrumb">
            <Link to="/">Inicio</Link>
            <svg><use href="#i-arrow" /></svg>
            <span>Contacto</span>
          </div>
          <span className="hero-badge"><svg><use href="#i-sparkle" /></svg>Solicita tu propuesta</span>
          <h1 style={{ marginTop: "16px" }}>Solicita nuestro <span className="accent">Catálogo Exclusivo</span> de Espectáculos</h1>
          <p>Más de 25 años diseñando los mejores eventos de Guatemala. Cuéntanos la fecha, el lugar y el tipo de impacto que buscas — nuestro equipo te guía de inmediato.</p>
        </div>
      </section>

      <section>
        <div className="wrap contact-page-grid">
          <div>
            <span className="eyebrow on-light"><svg><use href="#i-wand" /></svg>Hablemos por WhatsApp</span>
            <h2 style={{ fontSize: "26px", fontWeight: 900, marginBottom: "14px" }}>La forma más rápida de cotizar tu evento</h2>
            <p style={{ color: "var(--muted)", fontSize: "15px", lineHeight: 1.7, marginBottom: "26px" }}>
              Cada producción que realizamos es única y se diseña a la medida. El precio final depende de la magnitud
              técnica, el tipo de show y el escenario elegido — por eso preferimos platicarlo directamente contigo.
              Escríbenos por WhatsApp o llena el formulario — cualquiera de las dos formas llega directo a nuestro
              equipo.
            </p>

            <div className="contact-info">
              <div><span className="ico"><svg><use href="#i-whatsapp" /></svg></span> WhatsApp: +502 3073 8716</div>
              <div><span className="ico"><svg><use href="#i-phone" /></svg></span> PBX: +502 2289 5551</div>
              <div><span className="ico"><svg><use href="#i-mail" /></svg></span> ventas@showcompany.net</div>
              <div><span className="ico"><svg><use href="#i-pin" /></svg></span> 8 avenida 0-61 zona 2, Guatemala</div>
              <div><span className="ico"><svg><use href="#i-clock" /></svg></span> Oficina: Lun - Vie, horario laboral · Redes sociales: atención 24 horas</div>
            </div>

            <a href="https://wa.me/50230738716" className="btn btn-primary" style={{ marginBottom: "30px" }}>
              <svg><use href="#i-whatsapp" /></svg>Escribir por WhatsApp ahora
            </a>

            <h5 style={{ fontSize: "13px", textTransform: "uppercase", letterSpacing: ".08em", color: "var(--muted)", marginBottom: "14px" }}>Síguenos</h5>
            <div className="contact-socials">
              <a href="https://www.instagram.com/showcompany_gt" target="_blank" rel="noreferrer" style={{ background: "var(--ig-grad)" }} aria-label="Instagram">
                <svg><use href="#i-ig" /></svg>
              </a>
              <a href="https://www.tiktok.com/@showcompanygt" target="_blank" rel="noreferrer" style={{ background: "#000" }} aria-label="TikTok">
                <svg><use href="#i-tiktok" /></svg>
              </a>
              <a href="https://www.facebook.com/showcompany" target="_blank" rel="noreferrer" style={{ background: "var(--fb)" }} aria-label="Facebook">
                <svg><use href="#i-fb" /></svg>
              </a>
              <a href="https://www.youtube.com/@showcompanygt" target="_blank" rel="noreferrer" style={{ background: "var(--yt)" }} aria-label="YouTube">
                <svg><use href="#i-yt" /></svg>
              </a>
              <a href="https://wa.me/50230738716" target="_blank" rel="noreferrer" style={{ background: "var(--wa)" }} aria-label="WhatsApp">
                <svg><use href="#i-whatsapp" /></svg>
              </a>
            </div>
          </div>

          <form onSubmit={handleSubmit}>
            <h3 style={{ gridColumn: "1/-1", fontSize: "16px", fontWeight: 800, marginBottom: "-4px" }}>
              Solicita nuestro Catálogo Exclusivo de Espectáculos y Cotizaciones
            </h3>
            <p style={{ gridColumn: "1/-1", fontSize: "12.5px", color: "var(--muted)", marginBottom: "6px" }}>
              Más de 25 años diseñando los mejores eventos de Guatemala.
            </p>
            <div>
              <input
                type="text"
                placeholder="Nombre completo"
                value={form.name}
                onChange={(e) => updateField("name", e.target.value)}
              />
              {errors.name && <span className="field-error">{errors.name}</span>}
            </div>
            <div>
              <input
                type="tel"
                placeholder="WhatsApp / Teléfono directo"
                value={form.phone}
                onChange={(e) => updateField("phone", e.target.value)}
              />
              {errors.phone && <span className="field-error">{errors.phone}</span>}
            </div>
            <div className="full">
              <input
                type="email"
                placeholder="Correo electrónico corporativo o personal"
                value={form.email}
                onChange={(e) => updateField("email", e.target.value)}
              />
              {errors.email && <span className="field-error">{errors.email}</span>}
            </div>
            <select value={form.eventType} onChange={(e) => setForm({ ...form, eventType: e.target.value })}>
              {EVENT_TYPES.map((opt) => (
                <option key={opt}>{opt}</option>
              ))}
            </select>
            <input
              type="date"
              placeholder="Fecha estimada del evento"
              value={form.date}
              onChange={(e) => setForm({ ...form, date: e.target.value })}
            />
            <textarea
              className="full"
              placeholder="Cuéntanos más detalles sobre tu evento..."
              value={form.details}
              onChange={(e) => setForm({ ...form, details: e.target.value })}
            />
            <button type="submit" className="btn btn-primary">
              Enviar solicitud<svg><use href="#i-whatsapp" /></svg>
            </button>
          </form>
        </div>
      </section>

      <section className="why">
        <div className="wrap" style={{ maxWidth: "820px" }}>
          <div className="section-head">
            <span className="eyebrow" style={{ justifyContent: "center" }}><svg><use href="#i-sparkle" /></svg>Preguntas frecuentes</span>
            <h2 style={{ color: "#fff" }}>Antes de escribirnos, quizás esto ya te responde algo</h2>
          </div>
          <div style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: "20px", padding: "10px 30px" }}>
            {FAQS.map((f, i) => (
              <div className="faq-item" style={i === FAQS.length - 1 ? { borderBottom: "none" } : undefined} key={f.q}>
                <h3><svg><use href="#i-sparkle" /></svg>{f.q}</h3>
                <p>{f.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
