import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import logo from "../assets/img/logo.png";
import {
  adminFetch,
  clearAdminToken,
  getAdminToken,
  readError,
  UnauthorizedError,
  type Solicitud,
  type SolicitudEstado,
} from "../lib/api";

const ESTADOS: { value: SolicitudEstado; label: string; key: string }[] = [
  { value: "nuevo", label: "Nuevo", key: "nuevo" },
  { value: "contactado", label: "Contactado", key: "contactado" },
  { value: "propuesta_enviada", label: "Propuesta enviada", key: "propuesta" },
  { value: "confirmado", label: "Confirmado", key: "confirmado" },
];

const ESTADO_KEY = Object.fromEntries(ESTADOS.map((e) => [e.value, e.key])) as Record<SolicitudEstado, string>;
const ESTADO_LABEL = Object.fromEntries(ESTADOS.map((e) => [e.value, e.label])) as Record<SolicitudEstado, string>;

const ORIGEN_LABEL: Record<Solicitud["origen"], string> = {
  cotizador: "Cotizador",
  contacto: "Contacto",
};

export default function AdminCotizaciones() {
  const navigate = useNavigate();
  const [items, setItems] = useState<Solicitud[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<SolicitudEstado | "">("");
  const [savingId, setSavingId] = useState<string | null>(null);

  const handleAuthError = useCallback(() => {
    clearAdminToken();
    navigate("/admin");
  }, [navigate]);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await adminFetch("/api/admin/cotizaciones");
      if (!res.ok) throw new Error(await readError(res, "No se pudieron cargar las solicitudes."));
      setItems(await res.json());
    } catch (err) {
      if (err instanceof UnauthorizedError) return handleAuthError();
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [handleAuthError]);

  useEffect(() => {
    if (!getAdminToken()) {
      navigate("/admin");
      return;
    }
    load();
  }, [navigate, load]);

  const counts = useMemo(() => {
    const base: Record<SolicitudEstado, number> = {
      nuevo: 0,
      contactado: 0,
      propuesta_enviada: 0,
      confirmado: 0,
    };
    for (const item of items) base[item.estado] += 1;
    return base;
  }, [items]);

  const filteredItems = useMemo(
    () => (filter ? items.filter((item) => item.estado === filter) : items),
    [items, filter]
  );

  const changeEstado = async (id: string, estado: SolicitudEstado) => {
    setSavingId(id);
    setError("");
    try {
      const res = await adminFetch(`/api/admin/cotizaciones/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ estado }),
      });
      if (!res.ok) throw new Error(await readError(res, "No se pudo actualizar el estado."));
      const updated: Solicitud = await res.json();
      setItems((prev) => prev.map((it) => (it.id === id ? updated : it)));
    } catch (err) {
      if (err instanceof UnauthorizedError) return handleAuthError();
      setError((err as Error).message);
    } finally {
      setSavingId(null);
    }
  };

  return (
    <div className="admin-dash">
      <header className="admin-dash-head">
        <div className="admin-dash-head-brand">
          <img src={logo} alt="Show Company" />
          <div>
            <span className="eyebrow" style={{ marginBottom: 2 }}>
              Panel administrativo
            </span>
            <h1>Bandeja de cotizaciones</h1>
          </div>
        </div>
        <div className="admin-dash-head-actions">
          <Link to="/admin/dashboard" className="btn btn-ghost">
            Galería
          </Link>
          <button
            type="button"
            className="btn btn-reset"
            onClick={() => {
              clearAdminToken();
              navigate("/admin");
            }}
          >
            Cerrar sesión
          </button>
        </div>
      </header>

      <p className="admin-dash-intro">
        Solicitudes recibidas desde el formulario de Contacto y el Cotizador. Cambia el estado de
        cada una para ir marcando el avance de la conversación.
      </p>

      <div className="cotiz-counters">
        <button
          type="button"
          className={filter === "" ? "cotiz-counter active" : "cotiz-counter"}
          onClick={() => setFilter("")}
        >
          <strong>{items.length}</strong>
          <span>Total</span>
        </button>
        {ESTADOS.map((e) => (
          <button
            type="button"
            key={e.value}
            className={
              filter === e.value
                ? `cotiz-counter cotiz-counter-${e.key} active`
                : `cotiz-counter cotiz-counter-${e.key}`
            }
            onClick={() => setFilter(e.value)}
          >
            <strong>{counts[e.value]}</strong>
            <span>{e.label}</span>
          </button>
        ))}
      </div>

      {error && <p className="admin-login-error">{error}</p>}

      {loading ? (
        <p className="admin-dash-muted">Cargando solicitudes…</p>
      ) : filteredItems.length === 0 ? (
        <p className="admin-dash-muted">
          {filter ? "No hay solicitudes con ese estado." : "Todavía no ha llegado ninguna solicitud."}
        </p>
      ) : (
        <div className="cotiz-table-wrap">
          <table className="cotiz-table">
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Teléfono</th>
                <th>Tipo de evento</th>
                <th>Origen</th>
                <th>Fecha</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {filteredItems.map((item) => (
                <tr key={item.id}>
                  <td>
                    <div className="cotiz-name">{item.nombre}</div>
                    <div className="cotiz-email">{item.correo}</div>
                  </td>
                  <td>{item.telefono}</td>
                  <td>{item.tipoEvento || "—"}</td>
                  <td>{ORIGEN_LABEL[item.origen]}</td>
                  <td>
                    {new Date(item.createdAt).toLocaleDateString("es-GT", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                    })}
                  </td>
                  <td>
                    <div className="cotiz-estado-cell">
                      <span className={`cotiz-badge cotiz-badge-${ESTADO_KEY[item.estado]}`}>
                        {ESTADO_LABEL[item.estado]}
                      </span>
                      <select
                        className="cotiz-select"
                        value={item.estado}
                        disabled={savingId === item.id}
                        onChange={(e) => changeEstado(item.id, e.target.value as SolicitudEstado)}
                      >
                        {ESTADOS.map((e) => (
                          <option key={e.value} value={e.value}>
                            {e.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
