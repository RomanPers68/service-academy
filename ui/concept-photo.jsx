// ui/concept-photo.jsx — v139 (Доп. 454): фото блоков «О нас» (дресс-код, сервировка, атмосфера). Отдельный маленький
// модуль: их показывают и экран «О нас», и урок раздела «Наш ресторан» (ui/screens-learning.jsx), а экран урока не должен
// тянуть за собой весь редактор. Фото лежат в базе (этап 49, concept_photo): превью до 80 КБ для сетки, целиком до 450 КБ
// по касанию; запомненные в памяти не просим второй раз (как фото в чате).
import React from "react";
import { createPortal } from "react-dom";
import { rpc, saToken } from "../api/supabase";

const PH = new Map();   // "id|1" (целиком) или "id|0" (превью) → data: URL или обещание

export function conceptPhotoUrl(id, full = false) {
  const k = id + "|" + (full ? 1 : 0);
  const have = PH.get(k);
  if (have) return typeof have === "string" ? Promise.resolve(have) : have;
  const p = rpc("concept_photo", { p_token: saToken(), p_id: id, p_full: !!full }).then((r) => {
    if (!r || !r.ok || !r.data) { PH.delete(k); return null; }
    const url = "data:" + (r.mime || "image/jpeg") + ";base64," + r.data;
    PH.set(k, url);
    return url;
  }).catch(() => { PH.delete(k); return null; });
  PH.set(k, p);
  return p;
}
/** Уже загруженное фото (без запроса) или null. */
export const conceptPhotoCached = (id, full = false) => { const v = PH.get(id + "|" + (full ? 1 : 0)); return typeof v === "string" ? v : null; };
/** Только что загруженное с телефона — сразу в память, без лишнего запроса. */
export const conceptPhotoRemember = (id, thumbUrl, fullUrl) => { if (thumbUrl) PH.set(id + "|0", thumbUrl); if (fullUrl) PH.set(id + "|1", fullUrl); };

export function ConceptPhoto({ id, cap = "", onOpen, h = 150, a11y = false }) {
  const [src, setSrc] = React.useState(() => conceptPhotoCached(id, false) || conceptPhotoCached(id, true));
  const [bad, setBad] = React.useState(false);
  React.useEffect(() => {
    if (src) return undefined;
    let live = true;
    conceptPhotoUrl(id, false).then((u) => { if (!live) return; if (u) setSrc(u); else setBad(true); });
    return () => { live = false; };
  }, [id, src]);
  const line = a11y ? "rgba(139,106,48,0.25)" : "rgba(214,178,102,0.22)";
  return (
    <figure data-cn-photo={id} style={{ margin: 0, display: "flex", flexDirection: "column", gap: 4, minWidth: 0 }}>
      <button type="button" className="sa-hit" aria-label={cap ? "Фото: " + cap : "Открыть фото"} onClick={() => onOpen && onOpen(id, cap)}
        style={{ padding: 0, border: "1px solid " + line, borderRadius: 12, overflow: "hidden", background: a11y ? "rgba(139,106,48,0.08)" : "rgba(255,250,238,0.04)",
          height: h, cursor: "pointer", display: "block", width: "100%" }}>
        {src ? <img src={src} alt={cap || ""} decoding="async" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
          : <span style={{ display: "grid", placeItems: "center", height: "100%", fontSize: 12, color: a11y ? "#7A5A1E" : "rgba(232,215,180,0.6)" }}>{bad ? "Фото не загрузилось" : "Фото…"}</span>}
      </button>
      {cap ? <figcaption style={{ fontSize: 12, lineHeight: 1.4, color: a11y ? "#5C4A2A" : "rgba(232,215,180,0.75)" }}>{cap}</figcaption> : null}
    </figure>);
}

/** Фото целиком поверх экрана: касание или «Закрыть» — назад. */
export function PhotoViewer({ id, cap = "", onClose }) {
  const [src, setSrc] = React.useState(() => conceptPhotoCached(id, true) || conceptPhotoCached(id, false));
  React.useEffect(() => {
    let live = true;
    if (!conceptPhotoCached(id, true)) conceptPhotoUrl(id, true).then((u) => { if (live && u) setSrc(u); });
    return () => { live = false; };
  }, [id]);
  React.useEffect(() => {
    const k = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onClose]);
  const body = (
    <div role="dialog" aria-modal="true" aria-label={cap || "Фото"} data-cn-viewer={id} onClick={onClose}
      style={{ position: "fixed", inset: 0, zIndex: 400, background: "rgba(8,6,3,0.94)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        padding: "calc(16px + var(--sa-st, env(safe-area-inset-top, 0px))) 14px calc(16px + var(--sa-sb, env(safe-area-inset-bottom, 0px)))" }}>
      {src ? <img src={src} alt={cap || ""} style={{ maxWidth: "100%", maxHeight: "78vh", objectFit: "contain", borderRadius: 10 }} /> : <div style={{ color: "#E8D7B4" }}>Фото…</div>}
      {cap ? <div style={{ color: "#E8D7B4", fontFamily: "Georgia, serif", fontSize: 15, lineHeight: 1.45, marginTop: 12, textAlign: "center", maxWidth: 560 }}>{cap}</div> : null}
      <button type="button" onClick={onClose} style={{ marginTop: 14, padding: "8px 18px", borderRadius: 999, border: "1px solid rgba(214,178,102,0.4)", background: "transparent",
        color: "#E8D7B4", fontFamily: "Georgia, serif", fontSize: 14, cursor: "pointer" }}>Закрыть</button>
    </div>);
  return typeof document !== "undefined" ? createPortal(body, document.body) : body;
}

/** Сетка фото блока (по два в ряд) с просмотром. photos — [{ id, cap }]. */
export function ConceptPhotos({ photos, a11y = false, h = 150 }) {
  const [open, setOpen] = React.useState(null);
  const list = (Array.isArray(photos) ? photos : []).filter((p) => p && p.id);
  if (!list.length) return null;
  return (
    <div data-cn-photos={list.length} style={{ display: "grid", gridTemplateColumns: list.length === 1 ? "1fr" : "1fr 1fr", gap: 10, margin: "10px 0 4px" }}>
      {list.map((p) => <ConceptPhoto key={p.id} id={p.id} cap={p.cap} a11y={a11y} h={list.length === 1 ? Math.round(h * 1.4) : h} onOpen={(id, cap) => setOpen({ id, cap })} />)}
      {open ? <PhotoViewer id={open.id} cap={open.cap} onClose={() => setOpen(null)} /> : null}
    </div>);
}
