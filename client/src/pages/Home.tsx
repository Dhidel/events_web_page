import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import quinceAlicia from "../assets/img/quince-alicia.jpg";
import espectaculosRobots from "../assets/img/espectaculos-robots.jpg";
import navidad from "../assets/img/navidad.jpg";
import corporativo from "../assets/img/corporativo.jpg";
import quinceVivo from "../assets/img/quince-vivo.jpg";
import bodasColor from "../assets/img/bodas-anillos-color.jpg";
import carnavalPlumas from "../assets/img/carnaval-plumas.jpg";
import aveTematico from "../assets/img/ave-tematico.jpg";
import animacionEvento from "../assets/img/animacion-evento.jpg";
import bodasBn from "../assets/img/bodas-anillos-bn.jpg";

const SLIDES = [quinceAlicia, espectaculosRobots, navidad, corporativo, quinceVivo];

const SERVICES = [
  {
    img: quinceVivo,
    alt: "Fiesta de quinceañera con personajes en vivo",
    icon: "i-crown",
    title: "Fiestas de Quinceañeras",
    text: "Producciones únicas y mágicas que marcan un antes y un después.",
    anchor: "quinceaneras",
  },
  {
    img: bodasColor,
    alt: "Anillos de bodas",
    icon: "i-rings",
    title: "Bodas Espectaculares",
    text: "Creamos bodas de ensueño con cada detalle pensado para ustedes.",
    anchor: "bodas",
  },
  {
    img: corporativo,
    alt: "Producción de gala para evento corporativo",
    icon: "i-briefcase",
    title: "Eventos Corporativos",
    text: "Soluciones creativas para eventos empresariales inolvidables.",
    anchor: "corporativos",
  },
  {
    img: navidad,
    alt: "Personajes navideños en centro comercial",
    icon: "i-gift",
    title: "Personajes Navideños",
    text: "Llevamos la magia de la Navidad a centros comerciales y empresas.",
    anchor: "navidad",
  },
  {
    img: espectaculosRobots,
    alt: "Personajes de espectáculo y animación",
    icon: "i-masks",
    title: "Espectáculos y Animación",
    text: "Shows, animación y diversión que hacen vibrar a tus invitados.",
    anchor: "espectaculos",
  },
];

const WHY_ITEMS = [
  { icon: "i-star", title: "25 años de trayectoria", text: "Más de dos décadas liderando la industria en Guatemala respaldan cada producción." },
  { icon: "i-medal", title: "Los mejores eventos del país", text: "Hemos ejecutado con éxito los espectáculos más icónicos y memorables del territorio nacional." },
  { icon: "i-headset", title: "Filtro estricto de escenarios", text: "Solo operamos en locaciones que cumplan con altos estándares de seguridad y exclusividad." },
  { icon: "i-bulb", title: "Cero improvisaciones", text: "Nuestra experiencia nos permite prever imprevistos y garantizar control total de la logística." },
  { icon: "i-briefcase", title: "Cumplimiento legal y comercial", text: "Formalidad total, contratos transparentes y respeto estricto a las normativas de seguridad." },
  { icon: "i-heart", title: "Enfoque en la experiencia", text: "Creamos conexiones emocionales únicas — un momento feliz vale más que todo." },
];

const STEPS = [
  { n: 1, title: "Cuéntanos sobre tu evento", text: "Llena nuestro formulario o escríbenos por WhatsApp." },
  { n: 2, title: "Platicamos los detalles por WhatsApp", text: "Un asesor te contacta para definir personajes, alcance y precio a la medida de tu evento." },
  { n: 3, title: "Confirmamos y organizamos", text: "Reservamos tu fecha y comenzamos a planear cada detalle." },
  { n: 4, title: "Disfrutas tu evento inolvidable", text: "Nos encargamos de todo para que vivas momentos únicos." },
];

const GALLERY_TEASER = [
  { img: carnavalPlumas, alt: "Bailarina de carnaval con tocado de plumas", tag: "Espectáculos", label: "Personajes en zancos, temática circense" },
  { img: aveTematico, alt: "Personaje con traje temático de ave", tag: "Espectáculos", label: "Personajes en zancos, temática dorada" },
  { img: animacionEvento, alt: "Bailarinas con vestuario de animación en evento", tag: "Animación", label: "Cabezones de personajes urbanos" },
  { img: bodasBn, alt: "Manos de novios con anillos de boda", tag: "Bodas", label: "Boda íntima · Detalles con estilo" },
];

const TESTIMONIALS = [
  { initials: "MJ", name: "María José Gómez", role: "Quinceaños", text: "Show Company hizo de los 15 años de mi hija un sueño hecho realidad. Cada detalle fue perfecto, los invitados quedaron fascinados." },
  { initials: "CJ", name: "Carolina & Juan Pablo", role: "Boda", text: "Nuestra boda fue simplemente increíble. El equipo fue profesional, atento y superó todas nuestras expectativas." },
  { initials: "AR", name: "Alejandro Ramírez", role: "Evento Corporativo", text: "Organizamos nuestro evento corporativo con Show Company y fue todo un éxito. Recomendados al 100%." },
];

export default function Home() {
  const [current, setCurrent] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const restart = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setCurrent((c) => (c + 1) % SLIDES.length);
    }, 4500);
  };

  useEffect(() => {
    restart();
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const goTo = (i: number) => {
    setCurrent((i + SLIDES.length) % SLIDES.length);
    restart();
  };

  return (
    <>
      <section className="hero" id="inicio">
        <div className="slides">
          {SLIDES.map((src, i) => (
            <div
              key={i}
              className={i === current ? "slide active" : "slide"}
              style={{ backgroundImage: `url('${src}')` }}
            />
          ))}
        </div>

        <button className="slide-arrow prev" aria-label="Anterior" onClick={() => goTo(current - 1)}>
          <svg><use href="#i-chevron" transform="scale(-1,1) translate(-24,0)" /></svg>
        </button>
        <button className="slide-arrow next" aria-label="Siguiente" onClick={() => goTo(current + 1)}>
          <svg><use href="#i-chevron" /></svg>
        </button>

        <div className="sparkle-field">
          <span className="spark" style={{ top: "14%", left: "82%", width: "20px", height: "20px", animationDelay: ".2s" }}>
            <svg><use href="#i-sparkle" /></svg>
          </span>
          <span className="spark" style={{ top: "64%", left: "90%", width: "15px", height: "15px", animationDelay: "1.6s" }}>
            <svg><use href="#i-sparkle" /></svg>
          </span>
          <span className="spark" style={{ top: "38%", left: "70%", width: "11px", height: "11px", animationDelay: "2.6s" }}>
            <svg><use href="#i-sparkle" /></svg>
          </span>
        </div>

        <div className="hero-inner">
          <span className="hero-badge">
            <svg><use href="#i-sparkle" /></svg>Selección Exclusiva · 25 años de trayectoria
          </span>
          <h1>
            Creamos espectáculos <span className="accent">impecables</span>. El arte del entretenimiento al más alto nivel
          </h1>
          <p>
            Producciones de primer nivel bajo los más estrictos estándares de excelencia técnica y artística — para
            clientes que no negocian la calidad de su evento.
          </p>
          <span className="hero-note">
            <svg><use href="#i-medal" /></svg>Filtro estricto de escenarios y cero improvisaciones: cada montaje se
            ejecuta con control total, de principio a fin.
          </span>
          <div className="hero-ctas">
            <Link to="/contacto" className="btn btn-primary">
              <svg><use href="#i-wand" /></svg>Solicitar catálogo exclusivo
            </Link>
            <a href="#redes" className="btn btn-ghost">
              <svg><use href="#i-ig" /></svg>Síguenos en redes
            </a>
          </div>
        </div>

        <div className="slide-dots">
          {SLIDES.map((_, i) => (
            <button key={i} className={i === current ? "active" : ""} onClick={() => goTo(i)} />
          ))}
        </div>

        <div className="stat-bar">
          <div><svg><use href="#i-star" /></svg><span><strong>+25 años</strong>de experiencia</span></div>
          <div><svg><use href="#i-users" /></svg><span><strong>Miles de eventos</strong>exitosos</span></div>
          <div><svg><use href="#i-pin" /></svg><span><strong>Cobertura</strong>en toda Guatemala</span></div>
          <div><svg><use href="#i-headset" /></svg><span><strong>Atención</strong>personalizada por WhatsApp</span></div>
        </div>
      </section>

      <section className="promise">
        <div className="wrap">
          <div className="promise-grid">
            <div className="promise-item">
              <div className="promise-icon"><svg><use href="#i-wand" /></svg></div>
              <h3>Perfección técnica y artística</h3>
              <p>Sofisticados y detallistas: no dejamos nada al azar. Cada montaje se ejecuta con la tecnología y los artistas más avanzados del gremio.</p>
            </div>
            <div className="promise-item">
              <div className="promise-icon"><svg><use href="#i-sparkle" /></svg></div>
              <h3>Selección exclusiva</h3>
              <p>Solo operamos en locaciones y proyectos que dignifiquen el arte y cumplan con altos estándares de seguridad y exclusividad.</p>
            </div>
            <div className="promise-item">
              <div className="promise-icon"><svg><use href="#i-medal" /></svg></div>
              <h3>Cumplimiento y formalidad total</h3>
              <p>Contratos transparentes, puntualidad estricta y respeto absoluto por las normativas de seguridad vigentes en cada producción.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="social-hub" id="redes">
        <div className="sparkle-field">
          <span className="spark" style={{ top: "10%", left: "5%", width: "14px", height: "14px", animationDelay: ".4s" }}>
            <svg><use href="#i-sparkle" /></svg>
          </span>
          <span className="spark" style={{ top: "82%", left: "94%", width: "16px", height: "16px", animationDelay: "2s" }}>
            <svg><use href="#i-sparkle" /></svg>
          </span>
        </div>
        <div className="wrap">
          <div className="section-head">
            <span className="eyebrow" style={{ justifyContent: "center", color: "var(--blue-light)" }}>
              <svg><use href="#i-sparkle" /></svg>No te quedes fuera del show
            </span>
            <h2>Síguenos, ahí pasa toda la magia</h2>
            <p>Detrás de cámaras, shows completos, transformaciones de personajes y los eventos más locos del momento — todo lo subimos primero a redes.</p>
          </div>
          <div className="social-cards">
            <a href="#" className="social-card sc-ig">
              <div className="sc-icon"><svg><use href="#i-ig" /></svg></div>
              <h4>Instagram</h4>
              <span>Reels y detrás de cámaras</span>
              <span className="sc-btn">Seguir<svg><use href="#i-arrow" /></svg></span>
            </a>
            <a href="#" className="social-card sc-tiktok">
              <div className="sc-icon"><svg><use href="#i-tiktok" /></svg></div>
              <h4>TikTok</h4>
              <span>Los momentos más virales</span>
              <span className="sc-btn">Seguir<svg><use href="#i-arrow" /></svg></span>
            </a>
            <a href="#" className="social-card sc-fb">
              <div className="sc-icon"><svg><use href="#i-fb" /></svg></div>
              <h4>Facebook</h4>
              <span>Álbumes completos de eventos</span>
              <span className="sc-btn">Seguir<svg><use href="#i-arrow" /></svg></span>
            </a>
            <a href="#" className="social-card sc-yt">
              <div className="sc-icon"><svg><use href="#i-yt" /></svg></div>
              <h4>YouTube</h4>
              <span>Shows completos en video</span>
              <span className="sc-btn">Suscribirme<svg><use href="#i-arrow" /></svg></span>
            </a>
            <a href="https://wa.me/50230738716" className="social-card sc-wa">
              <div className="sc-icon"><svg><use href="#i-whatsapp" /></svg></div>
              <h4>WhatsApp</h4>
              <span>Cotiza directo, sin vueltas</span>
              <span className="sc-btn">Escribir<svg><use href="#i-arrow" /></svg></span>
            </a>
          </div>
        </div>
      </section>

      <section id="servicios">
        <div className="wrap">
          <div className="section-head">
            <span className="eyebrow on-light"><svg><use href="#i-sparkle" /></svg>Nuestros servicios</span>
            <h2>Cada evento es una historia distinta. Nosotros ponemos la magia</h2>
          </div>
          <div className="services-grid">
            {SERVICES.map((s) => (
              <div className="service-card" key={s.anchor}>
                <div className="service-img"><img src={s.img} alt={s.alt} /></div>
                <div className="service-body">
                  <div className="service-icon"><svg><use href={`#${s.icon}`} /></svg></div>
                  <h3>{s.title}</h3>
                  <p>{s.text}</p>
                  <div className="service-actions">
                    <Link to={`/servicios#${s.anchor}`} className="btn btn-outline">Ver más</Link>
                    <Link to="/contacto" className="btn btn-primary">Cotizar</Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="services-cta"><Link to="/servicios" className="btn btn-primary">Ver todos los servicios</Link></div>
        </div>
      </section>

      <section className="cta-banner">
        <div className="wrap" style={{ maxWidth: "720px" }}>
          <span className="eyebrow" style={{ justifyContent: "center", color: "var(--blue-light)" }}>
            <svg><use href="#i-sparkle" /></svg>Herramienta exclusiva
          </span>
          <h2>¿Quieres una referencia de inversión al instante?</h2>
          <p>Usa nuestro cotizador y obtén un estimado en segundos — luego un asesor confirma la propuesta exacta contigo por WhatsApp.</p>
          <div className="hero-ctas">
            <Link to="/cotizador" className="btn btn-primary"><svg><use href="#i-sparkle" /></svg>Calcular mi estimado</Link>
          </div>
        </div>
      </section>

      <section className="why" id="nosotros">
        <div className="wrap why-grid">
          <div>
            <span className="eyebrow"><svg><use href="#i-sparkle" /></svg>¿Por qué elegirnos?</span>
            <h2>25 años liderando la industria con <span className="accent">integridad absoluta</span></h2>
            <p>Entendemos que un momento feliz vale más que el oro y el dinero — por eso cuidamos cada detalle para que sea perfecto. Al contratarnos, la reputación de nuestra marca respalda y eleva la imagen de tu propio evento.</p>
          </div>
          <div className="why-items">
            {WHY_ITEMS.map((item) => (
              <div className="why-item" key={item.title}>
                <div className="why-icon"><svg><use href={`#${item.icon}`} /></svg></div>
                <h4>{item.title}</h4>
                <p>{item.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section>
        <div className="wrap">
          <div className="section-head">
            <span className="eyebrow on-light"><svg><use href="#i-sparkle" /></svg>Nuestro proceso</span>
            <h2>De la idea a la magia, paso a paso</h2>
          </div>
          <div className="steps">
            {STEPS.map((s) => (
              <div className="step" key={s.n}>
                <div className="step-circle">{s.n}</div>
                <h4>{s.title}</h4>
                <p>{s.text}</p>
                {s.n !== STEPS.length && <span className="step-arrow"><svg><use href="#i-arrow" /></svg></span>}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="gallery" id="galeria">
        <div className="wrap">
          <div className="gallery-top">
            <div>
              <span className="eyebrow"><svg><use href="#i-sparkle" /></svg>Eventos recientes</span>
              <h2>Portafolio que respalda cada palabra</h2>
              <p>Los espectáculos más icónicos y memorables del territorio nacional, ejecutados con excelencia técnica y artística.</p>
            </div>
            <Link to="/galeria" className="btn btn-primary">Ver galería completa<svg><use href="#i-arrow" /></svg></Link>
          </div>
          <div className="gallery-grid">
            {GALLERY_TEASER.map((item) => (
              <div className="gallery-item" key={item.alt}>
                <img src={item.img} alt={item.alt} />
                <span className="gallery-tag">{item.tag}</span>
                <span className="gallery-label">{item.label}</span>
                <span className="gallery-zoom"><svg><use href="#i-search" /></svg></span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="testimonios">
        <div className="wrap">
          <div className="section-head">
            <span className="eyebrow on-light"><svg><use href="#i-sparkle" /></svg>Nuestros clientes</span>
            <h2>Lo que dicen de nosotros</h2>
          </div>
          <div className="testi-grid">
            {TESTIMONIALS.map((t) => (
              <div className="testi-card" key={t.initials}>
                <div className="stars">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <svg key={i}><use href="#i-star" /></svg>
                  ))}
                </div>
                <p>{t.text}</p>
                <div className="testi-person">
                  <div className="avatar">{t.initials}</div>
                  <div><strong>{t.name}</strong><span>{t.role}</span></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="cta-banner">
        <div className="wrap">
          <h2>Solicita nuestro Catálogo Exclusivo de Espectáculos</h2>
          <p>Más de 25 años diseñando los mejores eventos de Guatemala. Cuéntanos tu proyecto y te presentamos una propuesta a la altura.</p>
          <div className="hero-ctas">
            <Link to="/contacto" className="btn btn-primary"><svg><use href="#i-wand" /></svg>Solicitar catálogo exclusivo</Link>
            <a href="https://wa.me/50230738716" className="btn btn-ghost"><svg><use href="#i-whatsapp" /></svg>Escribir por WhatsApp</a>
          </div>
        </div>
      </section>
    </>
  );
}
