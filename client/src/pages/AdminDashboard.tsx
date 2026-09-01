import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import logo from "../assets/img/logo.png";
import {
  adminFetch,
  clearAdminToken,
  getAdminToken,
  UnauthorizedError,
  type GalleryImage,
} from "../lib/api";

const CATEGORIES = [
  { value: "quinceaneras", label: "Quinceaños" },
  { value: "bodas", label: "Bodas" },
  { value: "corporativo", label: "Corporativo" },
  { value: "navidad", label: "Navidad" },
  { value: "espectaculos", label: "Espectáculos" },
];

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [items, setItems] = useState<GalleryImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const handleAuthError = useCallback(() => {
    clearAdminToken();
    navigate("/admin");
  }, [navigate]);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await adminFetch("/api/admin/gallery");
      if (!res.ok) throw new Error("No se pudo cargar la galería.");
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

  const handleCreated = (created: GalleryImage) => {
    setItems((prev) => [...prev, created].sort((a, b) => a.order - b.order));
  };

  const handleSaved = (saved: GalleryImage) => {
    setItems((prev) =>
      prev.map((it) => (it.id === saved.id ? saved : it)).sort((a, b) => a.order - b.order)
    );
  };

  const handleDeleted = (id: string) => {
    setItems((prev) => prev.filter((it) => it.id !== id));
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
            <h1>Galería de eventos</h1>
          </div>
        </div>
        <div className="admin-dash-head-actions">
          <Link to="/galeria" className="btn btn-ghost" target="_blank">
            Ver galería
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
        Sube nuevas fotos, reemplaza las existentes, edita sus textos o elimínalas. Los
        cambios se ven de inmediato en la página pública de la galería.
      </p>

      <NewImageForm onCreated={handleCreated} onAuthError={handleAuthError} />

      {error && <p className="admin-login-error">{error}</p>}

      {loading ? (
        <p className="admin-dash-muted">Cargando galería…</p>
      ) : items.length === 0 ? (
        <p className="admin-dash-muted">
          Todavía no hay fotos. Agrega la primera con el formulario de arriba, o corre{" "}
          <code>bun run seed-gallery</code> en el servidor para cargar las iniciales.
        </p>
      ) : (
        <div className="admin-dash-grid">
          {items.map((item) => (
            <GalleryCard
              key={item.id}
              item={item}
              onSaved={handleSaved}
              onDeleted={handleDeleted}
              onAuthError={handleAuthError}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function NewImageForm({
  onCreated,
  onAuthError,
}: {
  onCreated: (item: GalleryImage) => void;
  onAuthError: () => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [label, setLabel] = useState("");
  const [alt, setAlt] = useState("");
  const [category, setCategory] = useState(CATEGORIES[0].value);
  const [order, setOrder] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [formKey, setFormKey] = useState(0);

  const pickFile = (selected: File | null) => {
    setFile(selected);
    setPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return selected ? URL.createObjectURL(selected) : null;
    });
  };

  const reset = () => {
    pickFile(null);
    setLabel("");
    setAlt("");
    setCategory(CATEGORIES[0].value);
    setOrder("");
    setFormKey((k) => k + 1);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!file) {
      setError("Selecciona una imagen.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const form = new FormData();
      form.append("image", file);
      form.append("label", label);
      form.append("alt", alt);
      form.append("category", category);
      if (order.trim() !== "") form.append("order", order);

      const res = await adminFetch("/api/admin/gallery", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "No se pudo guardar la foto.");

      onCreated(data);
      reset();
    } catch (err) {
      if (err instanceof UnauthorizedError) return onAuthError();
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="admin-dash-newform" onSubmit={handleSubmit}>
      <h2>Agregar foto</h2>
      <div className="admin-dash-newform-body">
        <label className="admin-dash-drop">
          {preview ? (
            <img src={preview} alt="Vista previa" />
          ) : (
            <span>Haz clic para elegir una imagen</span>
          )}
          <input
            key={formKey}
            type="file"
            accept="image/*"
            onChange={(e) => pickFile(e.target.files?.[0] ?? null)}
            hidden
          />
        </label>

        <div className="admin-dash-fields">
          <label>
            Texto / descripción
            <input value={label} onChange={(e) => setLabel(e.target.value)} required />
          </label>
          <label>
            Texto alternativo (accesibilidad)
            <input value={alt} onChange={(e) => setAlt(e.target.value)} required />
          </label>
          <div className="admin-dash-fields-row">
            <label>
              Categoría
              <select value={category} onChange={(e) => setCategory(e.target.value)}>
                {CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Orden
              <input
                type="number"
                value={order}
                onChange={(e) => setOrder(e.target.value)}
                placeholder="0"
              />
            </label>
          </div>
        </div>
      </div>

      {error && <span className="field-error">{error}</span>}

      <button type="submit" className="btn btn-primary" disabled={busy}>
        {busy ? "Subiendo…" : "Agregar a la galería"}
      </button>
    </form>
  );
}

function GalleryCard({
  item,
  onSaved,
  onDeleted,
  onAuthError,
}: {
  item: GalleryImage;
  onSaved: (item: GalleryImage) => void;
  onDeleted: (id: string) => void;
  onAuthError: () => void;
}) {
  const [label, setLabel] = useState(item.label);
  const [alt, setAlt] = useState(item.alt);
  const [category, setCategory] = useState(item.category);
  const [order, setOrder] = useState(String(item.order));
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  const pickFile = (selected: File | null) => {
    setFile(selected);
    setPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return selected ? URL.createObjectURL(selected) : null;
    });
  };

  const dirty =
    label !== item.label ||
    alt !== item.alt ||
    category !== item.category ||
    order !== String(item.order) ||
    file !== null;

  const save = async () => {
    setBusy(true);
    setError("");
    setDone(false);
    try {
      const form = new FormData();
      form.append("label", label);
      form.append("alt", alt);
      form.append("category", category);
      form.append("order", order.trim() === "" ? "0" : order);
      if (file) form.append("image", file);

      const res = await adminFetch(`/api/admin/gallery/${item.id}`, {
        method: "PUT",
        body: form,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "No se pudo guardar.");

      pickFile(null);
      setDone(true);
      onSaved(data);
    } catch (err) {
      if (err instanceof UnauthorizedError) return onAuthError();
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!confirm("¿Eliminar esta foto de la galería? No se puede deshacer.")) return;
    setBusy(true);
    setError("");
    try {
      const res = await adminFetch(`/api/admin/gallery/${item.id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "No se pudo eliminar.");
      }
      onDeleted(item.id);
    } catch (err) {
      if (err instanceof UnauthorizedError) return onAuthError();
      setError((err as Error).message);
      setBusy(false);
    }
  };

  return (
    <div className="gallery-admin-card">
      <label className="gallery-admin-thumb">
        <img src={preview ?? item.imageUrl} alt={alt} />
        <span className="gallery-admin-thumb-hint">
          {file ? "Nueva imagen seleccionada" : "Reemplazar imagen"}
        </span>
        <input
          type="file"
          accept="image/*"
          onChange={(e) => pickFile(e.target.files?.[0] ?? null)}
          hidden
        />
      </label>

      <div className="gallery-admin-fields">
        <label>
          Texto / descripción
          <input value={label} onChange={(e) => setLabel(e.target.value)} />
        </label>
        <label>
          Texto alternativo
          <input value={alt} onChange={(e) => setAlt(e.target.value)} />
        </label>
        <div className="admin-dash-fields-row">
          <label>
            Categoría
            <select value={category} onChange={(e) => setCategory(e.target.value)}>
              {CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Orden
            <input
              type="number"
              value={order}
              onChange={(e) => setOrder(e.target.value)}
            />
          </label>
        </div>

        {error && <span className="field-error">{error}</span>}
        {done && !dirty && <span className="gallery-admin-ok">Guardado ✓</span>}

        <div className="gallery-admin-actions">
          <button
            type="button"
            className="btn btn-primary"
            onClick={save}
            disabled={busy || !dirty}
          >
            {busy ? "Guardando…" : "Guardar"}
          </button>
          <button
            type="button"
            className="btn btn-reset"
            onClick={remove}
            disabled={busy}
          >
            Eliminar
          </button>
        </div>
      </div>
    </div>
  );
}
