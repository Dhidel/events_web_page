import { Link } from "react-router-dom";
import nosotrosBanner from "../assets/img/nosotros-banner.jpg";
import quinceAlicia from "../assets/img/quince-alicia.jpg";

const STATS = [
  { icon: "i-star", title: "25 años", text: "de trayectoria formal en el mercado guatemalteco desde 2003" },
  { icon: "i-medal", title: "Los mejores eventos", text: "del país, ejecutados con excelencia técnica y artística" },
  { icon: "i-pin", title: "Cobertura nacional", text: "en toda Guatemala, no solo la capital" },
  { icon: "i-briefcase", title: "100% formal", text: "patente de comercio y respaldo legal desde 2003" },
];

const VALUES = [
  { icon: "i-headset", title: "Transparencia absoluta", text: "Comunicación clara, honesta y sin filtros ocultos en cada negociación y etapa del proyecto." },
  { icon: "i-medal", title: "Responsabilidad y seguridad", text: "Compromiso total con la protección del público, el equipo y la calidad técnica de cada montaje." },
  { icon: "i-sparkle", title: "Excelencia en el detalle", text: "Búsqueda minuciosa de la perfección artística para lograr un impacto visual y emocional único." },
  { icon: "i-star", title: "Integridad y respeto", text: "Trato digno a todas las personas y rechazo absoluto a contenidos que vulneren los principios éticos." },
  { icon: "i-briefcase", title: "Cumplimiento profesional", text: "Rigor y seriedad en la puntualidad, los acuerdos contractuales y las formalidades comerciales." },
  { icon: "i-heart", title: "Valor humano", text: "Priorizamos la felicidad y las emociones memorables de los asistentes por encima del beneficio económico." },
];

const TEAM = [
  { icon: "i-briefcase", title: "Directores", text: "Visión estratégica y control de cada proyecto" },
  { icon: "i-wand", title: "Creativos", text: "Diseño de conceptos y montajes escénicos" },
  { icon: "i-masks", title: "Talento artístico", text: "Artistas profesionales que ejecutan cada show" },
  { icon: "i-headset", title: "Atención al cliente", text: "Tu punto de contacto de principio a fin" },
];

export default function Nosotros() {
  return (
    <>
      <section className="page-banner">
        <div className="page-banner-bg" style={{ backgroundImage: `url('${nosotrosBanner}')` }} />
        <div className="wrap">
          <div className="breadcrumb">
            <Link to="/">Inicio</Link>
            <svg><use href="#i-arrow" /></svg>
            <span>Nosotros</span>
          </div>
          <span className="hero-badge"><svg><use href="#i-sparkle" /></svg>Nuestra historia</span>
          <h1 style={{ marginTop: "16px" }}>25 años construyendo <span className="accent">excelencia artística</span></h1>
          <p>Actuamos con total transparencia, responsabilidad y respeto en cada producción, asegurando eventos 100% profesionales y de calidad.</p>
        </div>
      </section>

      <section>
        <div className="wrap story-grid">
          <div className="story-media"><img src={quinceAlicia} alt="Producción temática de Show Company" /></div>
          <div className="story-body">
            <span className="eyebrow on-light"><svg><use href="#i-sparkle" /></svg>Cómo empezamos</span>
            <h2 style={{ fontSize: "28px", fontWeight: 900, marginBottom: "16px" }}>De una visión clara a una empresa formal</h2>
            <p>El origen de Show Company se remonta a 1996, cuando surge el nombre de la marca como una visión clara y una idea en marcha hacia la construcción de una empresa formal. En aquellos primeros años, el proyecto se impulsó con pura pasión y determinación, sentando las bases de lo que se convertiría en un modelo de negocio sólido dentro de la industria.</p>
            <p>Tras años de ganar experiencia y entender a fondo las dinámicas del mercado, la consolidación definitiva llegó en el año 2003: la empresa nace formalmente con su respectiva patente de comercio y una identidad visual propia. Este paso transformó la visión inicial en una estructura corporativa competitiva, diseñada para ofrecer servicios profesionales de alto nivel a empresas y corporaciones.</p>
            <p>Hoy, 25 años después, seguimos operando bajo el mismo principio: un momento feliz vale más que el oro y el dinero, por eso cuidamos cada detalle para que sea perfecto.</p>
          </div>
        </div>
      </section>

      <section className="why">
        <div className="wrap">
          <div className="section-head">
            <span className="eyebrow" style={{ justifyContent: "center" }}><svg><use href="#i-sparkle" /></svg>Nuestra historia en números</span>
            <h2 style={{ color: "#fff" }}>25 años construyendo confianza</h2>
          </div>
          <div className="why-items" style={{ gridTemplateColumns: "repeat(4,1fr)", textAlign: "center" }}>
            {STATS.map((s) => (
              <div className="why-item" key={s.title}>
                <div className="why-icon" style={{ margin: "0 auto 12px" }}><svg><use href={`#${s.icon}`} /></svg></div>
                <h4>{s.title}</h4>
                <p>{s.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="valores">
        <div className="wrap">
          <div className="section-head">
            <span className="eyebrow on-light"><svg><use href="#i-sparkle" /></svg>Valores de marca</span>
            <h2>Lo que nos mueve</h2>
          </div>
          <div className="services-grid" style={{ gridTemplateColumns: "repeat(3,1fr)" }}>
            {VALUES.map((v) => (
              <div className="service-card" style={{ padding: 0 }} key={v.title}>
                <div className="service-body" style={{ padding: "26px" }}>
                  <div className="service-icon" style={{ marginTop: 0 }}><svg><use href={`#${v.icon}`} /></svg></div>
                  <h3>{v.title}</h3>
                  <p style={{ minHeight: "auto" }}>{v.text}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="why">
        <div className="wrap">
          <div className="section-head">
            <span className="eyebrow" style={{ justifyContent: "center" }}><svg><use href="#i-sparkle" /></svg>Quiénes hacen la magia</span>
            <h2 style={{ color: "#fff" }}>La gente detrás de cada producción</h2>
            <p style={{ color: "rgba(255,255,255,.6)", marginTop: "10px" }}>Un equipo multidisciplinario que garantiza control total de la logística, de principio a fin.</p>
          </div>
          <div className="team-grid">
            {TEAM.map((t) => (
              <div className="team-card" key={t.title}>
                <div className="team-icon"><svg><use href={`#${t.icon}`} /></svg></div>
                <h4>{t.title}</h4>
                <span>{t.text}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="cta-banner">
        <div className="wrap">
          <h2>¿Listos para elevar tu próximo evento?</h2>
          <p>Conoces nuestra historia — ahora cuéntanos tu proyecto y te presentamos una propuesta a la altura.</p>
          <div className="hero-ctas">
            <Link to="/contacto" className="btn btn-primary"><svg><use href="#i-wand" /></svg>Solicitar catálogo exclusivo</Link>
            <a href="https://wa.me/50230738716" className="btn btn-ghost"><svg><use href="#i-whatsapp" /></svg>Escribir por WhatsApp</a>
          </div>
        </div>
      </section>
    </>
  );
}
