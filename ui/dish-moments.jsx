// ui/dish-moments.jsx — v193 (Доп. 518): меню между делом, ненавязчиво.
//   BreakDish  — «В перерыв: одно блюдо за 20 секунд»: под главной карточкой «на смене», без перехода в меню. Название и
//                фото, вспомни состав, открой — «Знаю» / «Не уверен»; «Ещё одно» — следующее, «Закрыть» — свернуть.
//   AskedSheet — после смены: «Спросили о блюде, а ты не знал?» — выбрать блюдо (поиск по названию и составу); завтра оно
//                первым придёт в разминку (lib/menu-repeat.js addAsked, missDish).
// Цвета — переменные стола (.tbv): светлая и тёмная тема сами.
import React from "react";
import { createPortal } from "react-dom";
import { vibrate, onActivate } from "../lib/utils";
import { SEARCH_ATTRS } from "../lib/search-field";

const btn = (main) => ({ flex: main ? "1 1 auto" : "0 0 auto", padding: main ? "9px 16px" : "9px 12px", borderRadius: 999, cursor: "pointer", fontFamily: "Georgia, serif", fontSize: 14, fontWeight: "bold",
  border: main ? "0" : "1px solid var(--edge-gold)", color: main ? "var(--on-gold)" : "var(--gold-ink)", background: main ? "linear-gradient(180deg,var(--gold-hi),var(--gold))" : "transparent" });

/** item: { id, name, why, brief: { img, cat, comp, al, desc } }; onMark(id, знаю); onMore — ещё одно; onClose — свернуть. */
export function BreakDish({ item, female = false, onMark, onMore, onClose }) {
  const [open, setOpen] = React.useState(false);
  const [done, setDone] = React.useState(null);   // { ok }
  const box = React.useRef(null);
  React.useEffect(() => { setOpen(false); setDone(null); }, [item && item.id]);
  // открыли, перевернули, отметили — карточка целиком на экране (над нижним меню)
  React.useEffect(() => {
    const el = box.current;
    if (!el || typeof el.getBoundingClientRect !== "function") return undefined;
    const t = setTimeout(() => { try { const r = el.getBoundingClientRect(), lim = window.innerHeight - 110; if (r.bottom > lim) el.scrollIntoView({ block: "end", behavior: "smooth" }); } catch (e) { /* без окна */ } }, 80);
    return () => clearTimeout(t);
  }, [item && item.id, open, done]);
  if (!item) return (
    <div data-break-dish="empty" style={{ padding: "10px 12px", borderRadius: 14, border: "1px solid var(--edge)", background: "var(--glass)", fontFamily: "Georgia, serif", fontSize: 13.5, color: "var(--sub)" }}>
      На сегодня всё: блюда, что пора повторить, уже отмечены. <span role="button" tabIndex={0} onClick={onClose} {...onActivate(onClose)} style={{ color: "var(--gold-ink)", cursor: "pointer" }}>Закрыть</span>
    </div>);
  const b = item.brief || {};
  const mark = (ok) => { vibrate(ok ? "success" : "light"); setDone({ ok }); if (onMark) onMark(item.id, ok); };
  return (
    <div ref={box} data-break-dish={item.id} className="sa-fadein" style={{ scrollMarginBottom: 110, padding: "11px 12px 12px", borderRadius: 16, border: "1px solid var(--edge-gold)", background: "var(--glass)",
      boxShadow: "inset 0 0 18px var(--inner), inset 0 1px 0 var(--hi)", fontFamily: "Georgia, serif" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        {b.img ? <img src={b.img} alt="" loading="lazy" decoding="async" style={{ width: 46, height: 46, objectFit: "cover", borderRadius: 11, flexShrink: 0 }} /> : null}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12, fontStyle: "italic", color: "var(--gold-ink)" }}>Блюдо в перерыв{b.cat ? " · " + b.cat : ""}</div>
          <div style={{ fontSize: 16.5, lineHeight: 1.25, color: "var(--text)" }}>{item.name}</div>
        </div>
        {!done ? <button type="button" aria-label="Свернуть" data-lens="back" onClick={onClose}
          style={{ flexShrink: 0, width: 30, height: 30, borderRadius: 15, border: "1px solid var(--edge)", background: "transparent", color: "var(--sub)", cursor: "pointer", fontSize: 15, lineHeight: 1 }}>×</button> : null}
      </div>
      {done ? (
        <div data-break-done={done.ok ? "ok" : "again"} role="status" style={{ marginTop: 9, fontSize: 13.5, lineHeight: 1.45, color: "var(--text)" }}>
          {done.ok ? "Отметил" + (female ? "а" : "") + " «Знаю». Повторим, когда подойдёт срок." : "Хорошо, что честно. Блюдо вернётся в разминку."}
          <div style={{ display: "flex", gap: 8, marginTop: 9 }}>
            <button type="button" data-lens-btn="soft" data-break-more="" onClick={() => { vibrate("light"); if (onMore) onMore(); }} style={btn(false)}>Ещё одно</button>
            <button type="button" data-lens-btn="soft" data-break-close="" onClick={onClose} style={btn(false)}>Закрыть</button>
          </div>
        </div>
      ) : !open ? (
        <>
          <p style={{ margin: "8px 0 9px", fontSize: 13.5, lineHeight: 1.45, color: "var(--sub)", fontStyle: "italic" }}>Вспомни состав и аллергены, потом проверь себя.</p>
          <button type="button" data-lens-btn="main" data-break-open="" onClick={() => { vibrate("light"); setOpen(true); }} style={{ ...btn(true), width: "100%" }}>Показать состав</button>
        </>
      ) : (
        <div className="sa-fadein" data-break-back="" style={{ marginTop: 9 }}>
          <div style={{ fontSize: 13.5, lineHeight: 1.5, color: "var(--text)" }}>{b.comp || "Состав ещё не заполнили"}</div>
          <div style={{ fontSize: 13, lineHeight: 1.5, color: (b.al || []).length ? "var(--bad-ink)" : "var(--ok-ink)", marginTop: 4 }}>
            {(b.al || []).length ? "Аллергены: " + b.al.join(", ").toLowerCase() : "Аллергенов из «большой восьмёрки» нет"}</div>
          <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
            <button type="button" data-lens-btn="main" data-break-know="" onClick={() => mark(true)} style={btn(true)}>Знаю</button>
            <button type="button" data-lens-btn="soft" data-break-unsure="" onClick={() => mark(false)} style={btn(false)}>{female ? "Не уверена" : "Не уверен"}</button>
          </div>
        </div>
      )}
    </div>
  );
}

const nrm = (s) => String(s || "").toLowerCase().replace(/ё/g, "е");
/** dishes — блюда меню ({ id, name, cat, ingredients }); picked — уже отмеченные сегодня; onPick(id, name). */
export function AskedSheet({ a11y, dishes = [], picked = [], female = false, onPick, onClose }) {
  const [q, setQ] = React.useState("");
  const list = React.useMemo(() => {
    const t = nrm(q).trim();
    const all = (dishes || []).filter((d) => d && d.id != null && d.name);
    return (t ? all.filter((d) => nrm(d.name).includes(t) || nrm((d.ingredients || []).join(" ")).includes(t)) : all).slice(0, 60);
  }, [dishes, q]);
  const have = new Set((picked || []).map(String));
  const pick = (d) => { if (have.has(String(d.id))) return; vibrate("success"); if (onPick) onPick(String(d.id), String(d.name)); };
  return createPortal(
    <div className="tbv" onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 1000, background: a11y ? "rgba(70,52,24,0.35)" : "rgba(8,6,3,0.62)", display: "flex", alignItems: "flex-end" }}>
      <div role="dialog" aria-modal="true" aria-label="О каком блюде спросили" data-asked-sheet="" onClick={(e) => e.stopPropagation()}
        style={{ width: "100%", maxWidth: 560, maxHeight: "86vh", display: "flex", flexDirection: "column", boxSizing: "border-box", margin: "0 auto", padding: "18px 16px calc(14px + env(safe-area-inset-bottom,0px))",
          borderRadius: "22px 22px 0 0", backgroundColor: a11y ? "#F6EEDC" : "#1E170C", backgroundImage: "var(--sheet-bg,none)", borderTop: "1px solid var(--sheet-edge, var(--edge-gold))", fontFamily: "Georgia, serif" }}>
        <h3 style={{ margin: "0 2px 4px", fontFamily: "'Piazzolla', Georgia, serif", fontSize: 20, color: "var(--text)" }}>О каком блюде спросили?</h3>
        <p style={{ margin: "0 2px 10px", fontSize: 13.5, lineHeight: 1.5, color: "var(--sub)" }}>
          Гость спросил, а ты не знал{female ? "а" : ""} ответа? Отметь блюдо: завтра оно первым придёт в разминку, а в «Знаю?» уже ждёт повтора.</p>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Название или что в составе" data-lens-field="" aria-label="Найти блюдо"
          style={{ width: "100%", boxSizing: "border-box", padding: "10px 12px", borderRadius: 12, border: "1px solid var(--edge-gold)", background: "var(--glass)", color: "var(--text)", fontFamily: "Georgia, serif", fontSize: 15, outline: "none", marginBottom: 8 }} {...SEARCH_ATTRS} />
        <div style={{ flex: "1 1 auto", overflowY: "auto", WebkitOverflowScrolling: "touch", margin: "0 -4px" }}>
          {list.length ? list.map((d) => { const on = have.has(String(d.id)); return (
            <div key={d.id} role="button" tabIndex={0} data-asked-dish={d.id} aria-pressed={on} onClick={() => pick(d)} {...onActivate(() => pick(d))}
              style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 8px", borderBottom: "1px dashed var(--edge)", cursor: on ? "default" : "pointer" }}>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: "block", fontSize: 15, color: "var(--text)" }}>{d.name}</span>
                {d.cat ? <span style={{ display: "block", fontSize: 12, color: "var(--sub)" }}>{d.cat}</span> : null}
              </span>
              <span aria-hidden="true" style={{ color: on ? "var(--ok-ink)" : "var(--gold-ink)", fontSize: 13.5, whiteSpace: "nowrap" }}>{on ? "✓ завтра в разминке" : "Отметить"}</span>
            </div>); }) : <div style={{ padding: "14px 8px", fontSize: 14, color: "var(--sub)" }}>Ничего не нашлось. Попробуй по-другому.</div>}
        </div>
        <button type="button" data-sa-back="" onClick={onClose} className="sa-btn"
          style={{ display: "block", width: "100%", marginTop: 8, padding: 12, border: 0, background: "none", color: "var(--sub)", fontSize: 14, fontWeight: "bold", cursor: "pointer" }}>{(picked || []).length ? "Готово" : "Закрыть"}</button>
      </div>
    </div>, document.body);
}
