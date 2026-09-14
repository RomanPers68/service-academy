import React from "react";
import { onActivate, vibrate } from "../lib/utils";
import { GOLD } from "./tokens";
import { allergenLabel } from "../lib/deck-extras";
import { groupByCat } from "../lib/menu-sections";
import { dishNutrition, nutritionLine } from "../lib/nutrition";

// ── Дополнение 261: меню для печати ────────────────────────────────────────────
// Тот же путь, что у карты бара: рисуем лист на canvas и отдаём PNG постранично.
// Ссылка в браузер не годится — у сотрудников одноразовые коды входа.

export function MenuPrint({ T, a11y, dishes = [], restaurant = "", onBack }) {
  const gold = a11y ? "#8B6A30" : GOLD; const text = T.modTitle.color, sub = T.modSub.color;
  const [shot, setShot] = React.useState(null);   // [{ url, blob, name }]
  const [page, setPage] = React.useState(0);
  const [busy, setBusy] = React.useState(false);
  const [hint, setHint] = React.useState("");
  const [withPhoto, setWithPhoto] = React.useState(true);
  const list = React.useMemo(() => (dishes || []).filter(d => d && d.name && !d.archived), [dishes]);
  const PER_PAGE = 8;

  const loadImg = (src) => new Promise(res => {
    if (!src) return res(null);
    const img = new Image(); let done = false;
    const finish = (v) => { if (!done) { done = true; res(v); } };
    img.crossOrigin = "anonymous";
    img.onload = () => finish(img); img.onerror = () => finish(null);
    setTimeout(() => finish(null), 4000);              // медленная сеть не держит весь лист
    img.src = src;
  });

  const draw = async () => {
    setBusy(true); setHint("");
    try {
      const C = { bg: "#FBF7EE", text: "#2A1F0E", dim: "#6B5B40", faint: "#8A7A5C", line: "#DED3BC", warn: "#A33A2A" };
      const S = 2, W = 760, PAD = 28, HEAD = 104, PH = 96;
      const probe = document.createElement("canvas").getContext("2d");
      const wrap = (x, t, max) => { const words = String(t || "").split(" "); const out = []; let ln = "";
        for (const w of words) { const p = ln ? ln + " " + w : w; if (x.measureText(p).width > max && ln) { out.push(ln); ln = w; } else ln = p; } if (ln) out.push(ln); return out; };
      // порядок как в Колоде: по разделам
      const ordered = groupByCat(list).flatMap(g => g.items.map(d => ({ d, cat: g.cat })));
      const imgs = withPhoto ? await Promise.all(ordered.map(o => loadImg(o.d.img))) : ordered.map(() => null);
      const TX = PAD + (withPhoto ? PH + 14 : 0);
      const rows = ordered.map((o, i) => {
        const d = o.d;
        probe.font = "15px Georgia, serif"; const ing = wrap(probe, (d.ingredients || []).join(" · "), W - TX - PAD);
        probe.font = "13.5px Georgia, serif"; const desc = wrap(probe, d.desc || d.short || "", W - TX - PAD);
        const al = (d.allergens || []).map(allergenLabel).join(" · ");
        const nut = nutritionLine(dishNutrition(d));                       // Доп. 264
        const h = Math.max(withPhoto ? PH + 16 : 0, 28 + ing.length * 20 + desc.length * 19 + (al ? 22 : 0) + (nut ? 20 : 0) + 14);
        return { d, cat: o.cat, ing, desc, al, nut, img: imgs[i], h };
      });
      const pages = []; for (let i = 0; i < rows.length; i += PER_PAGE) pages.push(rows.slice(i, i + PER_PAGE));
      const out = [];
      for (let pi = 0; pi < pages.length; pi++) {
        const part = pages[pi];
        const H = HEAD + part.reduce((a, r) => a + r.h, 0) + 54;
        const cv = document.createElement("canvas"); cv.width = W * S; cv.height = H * S;
        const x = cv.getContext("2d"); x.scale(S, S); x.textBaseline = "middle";
        x.fillStyle = C.bg; x.fillRect(0, 0, W, H);
        x.fillStyle = C.text; x.font = "600 26px Georgia, serif"; x.fillText(`${restaurant} · меню`, PAD, 42);
        x.fillStyle = C.dim; x.font = "14px Georgia, serif";
        x.fillText(`${new Date().toLocaleDateString("ru-RU")} · ${list.length} блюд · страница ${pi + 1} из ${pages.length}`, PAD, 70);
        x.strokeStyle = C.line; x.lineWidth = 1; x.beginPath(); x.moveTo(PAD, 88); x.lineTo(W - PAD, 88); x.stroke();
        let y = HEAD, lastCat = null;
        for (const r of part) {
          if (r.cat !== lastCat) { lastCat = r.cat;
            x.fillStyle = C.faint; x.font = "600 11px Georgia, serif";
            x.fillText(String(r.cat || "").toUpperCase(), PAD, y - 6); y += 8; }
          if (withPhoto) {
            if (r.img) { x.save(); const p2 = new Path2D(); p2.roundRect ? p2.roundRect(PAD, y - 6, PH, PH, 12) : p2.rect(PAD, y - 6, PH, PH); x.clip(p2);
              const k = Math.max(PH / r.img.width, PH / r.img.height);
              x.drawImage(r.img, PAD + (PH - r.img.width * k) / 2, y - 6 + (PH - r.img.height * k) / 2, r.img.width * k, r.img.height * k); x.restore(); }
            else { x.strokeStyle = C.line; x.strokeRect(PAD, y - 6, PH, PH); x.fillStyle = C.faint; x.font = "11px Georgia, serif"; x.fillText("фото нет", PAD + 20, y + 42); }
          }
          x.fillStyle = C.text; x.font = "600 17px Georgia, serif"; x.fillText(r.d.name, TX, y + 8);
          let yy = y + 32;
          if (r.ing.length) { x.fillStyle = C.text; x.font = "15px Georgia, serif"; for (const ln of r.ing) { x.fillText(ln, TX, yy); yy += 20; } }
          if (r.al) { x.fillStyle = C.warn; x.font = "13px Georgia, serif"; x.fillText("Аллергены: " + r.al, TX, yy); yy += 22; }
          if (r.nut) { x.fillStyle = C.faint; x.font = "12.5px ui-monospace, Menlo, monospace"; x.fillText(r.nut, TX, yy); yy += 20; }
          if (r.desc.length) { x.fillStyle = C.dim; x.font = "13.5px Georgia, serif"; for (const ln of r.desc) { x.fillText(ln, TX, yy); yy += 19; } }
          y += r.h;
          x.strokeStyle = C.line; x.beginPath(); x.moveTo(PAD, y - 8); x.lineTo(W - PAD, y - 8); x.stroke();
        }
        x.fillStyle = C.faint; x.font = "12px Georgia, serif";
        x.fillText(`Service Academy · состав и аллергены как в Колоде меню · ${pi + 1}/${pages.length}`, PAD, H - 26);
        const blob = await new Promise(res => cv.toBlob(res, "image/png"));
        out.push({ url: URL.createObjectURL(blob), blob, name: `Меню_${restaurant}_${pi + 1}.png`.replace(/\s/g, "_") });
      }
      setShot(out); setPage(0); vibrate("success");
    } catch (e) {
      // Чужое фото без разрешения браузера «пачкает» холст — тогда собираем без фото
      setHint(withPhoto ? "С фото не вышло — собираю без них" : "Не удалось собрать картинку");
      if (withPhoto) { setWithPhoto(false); setBusy(false); setTimeout(() => draw(), 50); return; }
    }
    setBusy(false);
  };
  const share = async (all = false) => {
    if (!shot || !shot.length) return;
    const items = all ? shot : [shot[page]];
    try { const files = items.map(sh => new File([sh.blob], sh.name, { type: "image/png" }));
      if (navigator.canShare && navigator.canShare({ files })) { await navigator.share({ files, title: `Меню · ${restaurant}` }); return; } } catch (e) {}
    items.forEach(sh => { const a = document.createElement("a"); a.href = sh.url; a.download = sh.name; a.click(); });
  };

  return (
    <div style={T.screen} className="sa-screen">
      <div style={{ padding: "16px 16px 6px", display: "flex", alignItems: "center", gap: 10 }}>
        <button className="sa-btn" onClick={onBack} {...onActivate(onBack)} aria-label="Назад" style={{ border: "none", background: "transparent", color: gold, fontSize: 22, cursor: "pointer", padding: "4px 8px 4px 0" }}>‹</button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: "ui-monospace, Menlo, monospace", fontSize: 10.5, letterSpacing: 1.5, color: gold }}>МЕНЮ · ЭКСПОРТ</div>
          <div style={{ fontFamily: "Georgia, serif", fontSize: 22, color: text, lineHeight: 1.15 }}>Меню для печати</div>
        </div>
      </div>
      <div style={{ padding: "4px 16px 10px", display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <button className="sa-btn" onClick={draw} disabled={busy || !list.length} style={{ ...T.doneBtn, flex: 1.4, marginTop: 0, background: gold, opacity: busy || !list.length ? 0.6 : 1 }}>{busy ? "Собираю…" : "Картинкой"}</button>
        <span onClick={() => setWithPhoto(v => !v)} {...onActivate(() => setWithPhoto(v => !v))} style={{ padding: "8px 12px", borderRadius: 999, fontSize: 12.5, cursor: "pointer", border: `1px solid ${withPhoto ? gold : gold + "44"}`, background: withPhoto ? "rgba(214,178,102,0.16)" : "transparent", color: withPhoto ? text : sub }}>{withPhoto ? "С фото ✓" : "Без фото"}</span>
      </div>
      {hint && <div style={{ padding: "0 16px 6px", fontSize: 12.5, color: gold }}>{hint}</div>}
      <div style={{ padding: "0 16px 8px", fontSize: 12, color: sub, lineHeight: 1.5 }}>{list.length} блюд, по {PER_PAGE} на страницу. Сохраняется в галерею и уходит в любой мессенджер — коды входа не нужны.</div>
      {shot && shot.length > 0 && (
        <div className="sa-fadein" style={{ margin: "0 16px 14px", padding: 12, borderRadius: 16, border: `1px solid ${gold}55` }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <span style={{ fontSize: 10.5, letterSpacing: 1.5, color: gold, fontFamily: "monospace", flex: 1 }}>СТРАНИЦА {page + 1} ИЗ {shot.length}</span>
            {shot.length > 1 && <>
              <span onClick={() => setPage(p => Math.max(0, p - 1))} style={{ color: page ? gold : sub, cursor: "pointer", padding: "2px 8px", fontSize: 17 }}>‹</span>
              <span onClick={() => setPage(p => Math.min(shot.length - 1, p + 1))} style={{ color: page < shot.length - 1 ? gold : sub, cursor: "pointer", padding: "2px 8px", fontSize: 17 }}>›</span>
            </>}
          </div>
          <img src={shot[page].url} alt={`Меню · страница ${page + 1}`} style={{ width: "100%", borderRadius: 12, display: "block", border: `1px solid ${gold}33` }} />
          <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
            <button className="sa-btn" onClick={() => share(false)} style={{ ...T.doneBtn, flex: 1.4, marginTop: 0, background: gold }}>Отправить страницу</button>
            {shot.length > 1 && <button className="sa-btn" onClick={() => share(true)} style={{ ...T.doneBtn, flex: 1.2, marginTop: 0, background: "transparent", border: `1px solid ${gold}88`, color: text }}>Все {shot.length}</button>}
            <button className="sa-btn" onClick={() => { shot.forEach(sh => URL.revokeObjectURL(sh.url)); setShot(null); }} style={{ ...T.doneBtn, flex: 1, marginTop: 0, background: "transparent", border: `1px solid ${gold}66`, color: sub }}>Закрыть</button>
          </div>
        </div>
      )}
      <div style={{ height: 90 }} />
    </div>
  );
}
