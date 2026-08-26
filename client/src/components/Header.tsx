import { useState } from "react";
import { Link, NavLink } from "react-router-dom";
import logo from "../assets/img/logo.png";

const NAV_LINKS = [
  { to: "/", label: "Inicio" },
  { to: "/servicios", label: "Servicios" },
  { to: "/cotizador", label: "Cotizador" },
  { to: "/galeria", label: "Galería" },
  { to: "/nosotros", label: "Nosotros" },
  { to: "/contacto", label: "Contacto" },
];

export default function Header() {
  const [open, setOpen] = useState(false);

  return (
    <header>
      <nav>
        <Link to="/" className="brand" onClick={() => setOpen(false)}>
          <img src={logo} alt="Show Company" />
          <span className="brand-name">SHOW COMPANY</span>
        </Link>
        <div className={open ? "nav-links open" : "nav-links"}>
          {NAV_LINKS.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.to === "/"}
              className={({ isActive }) => (isActive ? "active" : "")}
              onClick={() => setOpen(false)}
            >
              {link.label}
            </NavLink>
          ))}
          <Link to="/contacto" className="btn btn-primary mobile-only-cta" onClick={() => setOpen(false)}>
            <svg><use href="#i-phone" /></svg>Cotizar mi evento
          </Link>
        </div>
        <div className="nav-right">
          <Link to="/contacto" className="btn btn-primary">
            <svg><use href="#i-phone" /></svg>Cotizar mi evento
          </Link>
        </div>
        <button className="burger" aria-label="Menú" onClick={() => setOpen((v) => !v)}>
          ≡
        </button>
      </nav>
    </header>
  );
}
