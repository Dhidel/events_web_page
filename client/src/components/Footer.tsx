import { Link } from "react-router-dom";
import logo from "../assets/img/logo.png";

export default function Footer() {
  return (
    <footer>
      <div className="wrap">
        <div className="footer-top">
          <div>
            <div className="footer-brand">
              <img src={logo} alt="Show Company" />
              <span>SHOW COMPANY</span>
            </div>
            <p style={{ fontSize: "13px", lineHeight: 1.6, maxWidth: "260px" }}>
              Nuestra misión es tu diversión. 25 años de excelencia técnica y artística en cada producción.
            </p>
          </div>
          <div>
            <h5>Enlaces rápidos</h5>
            <ul>
              <li><Link to="/">Inicio</Link></li>
              <li><Link to="/servicios">Servicios</Link></li>
              <li><Link to="/cotizador">Cotizador</Link></li>
              <li><Link to="/galeria">Galería</Link></li>
              <li><Link to="/nosotros">Nosotros</Link></li>
              <li><Link to="/contacto">Contacto</Link></li>
            </ul>
          </div>
          <div>
            <h5>Servicios</h5>
            <ul>
              <li>Quinceaños</li>
              <li>Bodas</li>
              <li>Eventos Corporativos</li>
              <li>Personajes Navideños</li>
              <li>Espectáculos y Animación</li>
            </ul>
          </div>
          <div>
            <h5>Síguenos</h5>
            <div className="socials">
              <a href="https://www.facebook.com/showcompany" target="_blank" rel="noreferrer" className="s-fb" aria-label="Facebook">
                <svg><use href="#i-fb" /></svg>
              </a>
              <a href="https://www.instagram.com/showcompany_gt" target="_blank" rel="noreferrer" className="s-ig" aria-label="Instagram">
                <svg><use href="#i-ig" /></svg>
              </a>
              <a href="https://www.tiktok.com/@showcompanygt" target="_blank" rel="noreferrer" className="s-tiktok" aria-label="TikTok">
                <svg><use href="#i-tiktok" /></svg>
              </a>
              <a href="https://www.youtube.com/@showcompanygt" target="_blank" rel="noreferrer" className="s-yt" aria-label="YouTube">
                <svg><use href="#i-yt" /></svg>
              </a>
              <a href="https://wa.me/50230738716" target="_blank" rel="noreferrer" className="s-wa" aria-label="WhatsApp">
                <svg><use href="#i-whatsapp" /></svg>
              </a>
            </div>
          </div>
        </div>
        <div className="footer-bottom">
          <span>© 2026 Show Company GT. Todos los derechos reservados.</span>
          <span>¿Necesitas ayuda? Escríbenos por WhatsApp</span>
        </div>
      </div>
    </footer>
  );
}
