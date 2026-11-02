// ui/bar-pin.jsx — v128 (Доп. 441): «Барная карта» — шапка не уезжает; карточки листаются подряд (внизу файла).
//
// Владелец (01.11) прислал запись: в карте 120 вин, чтобы сменить раздел или вкладку, приходилось листать наверх. Теперь,
// когда строка разделов уехала вверх, сверху её копия в слое поверх экрана: вкладки «Коктейли · Вина · Крепкое», разделы,
// поиск и «наверх». Так же, как полоска разделов редактора урока (ui/content-editor.jsx, .sa-ednav-pin): position: fixed
// не дрожит на iPhone, в отличие от position: sticky внутри прокрутки приложения (листается #root).
import React from "react";
import { createPortal } from "react-dom";
import { topInsetPx } from "../lib/tg-screen";
import { vibrate } from "../lib/utils";

export const scrollRoot = () => (typeof document !== "undefined" ? document.getElementById("root") || document.scrollingElement : null);
/** Наверх экрана (прокрутка приложения — #root). */
export const toTop = (smooth = true) => { try { const r = scrollRoot(); if (r) r.scrollTo({ top: 0, behavior: smooth ? "smooth" : "auto" }); } catch (e) {} };
/** Прокрутить так, чтобы элемент встал сверху (под кнопками Telegram, если они есть). */
export const scrollToEl = (el) => {
  try { const r = scrollRoot(); if (!r || !el) return; const top = el.getBoundingClientRect().top - r.getBoundingClientRect().top + r.scrollTop - topInsetPx() - 8; r.scrollTo({ top: Math.max(0, top) }); } catch (e) {}
};

/** watchRef уехал вверх — { left, width } рамки (frameRef) для копии сверху; иначе null. По прокрутке, а не
 *  IntersectionObserver: быстрый взмах (или прыжок прокрутки) переносит строку из-под низа экрана сразу выше верха, ни разу
 *  не показав её, и наблюдатель такого перехода не замечает. */
export function usePin(watchRef, frameRef, on) {
  const [box, setBox] = React.useState(null);
  React.useEffect(() => {
    const el = watchRef.current, fr = frameRef.current, root = scrollRoot();
    if (!on || !el || !fr || !root || typeof window === "undefined") { setBox(null); return undefined; }
    const doc = root === document.scrollingElement || root === document.documentElement;
    const target = doc ? window : root;
    let raf = 0, was = null;
    const measure = () => { const b = fr.getBoundingClientRect(); return { left: Math.round(b.left), width: Math.round(b.width) }; };
    const check = () => {
      raf = 0;
      const top = doc ? topInsetPx() : root.getBoundingClientRect().top;
      const up = el.getBoundingClientRect().top < top - 0.5;   // верх строки ушёл под край прокрутки (под кнопками Telegram — тоже)
      if (up !== was) { was = up; setBox(up ? measure() : null); }
    };
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(check); };
    const onResize = () => { was = null; onScroll(); };
    target.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onResize);
    check();
    return () => { if (raf) cancelAnimationFrame(raf); target.removeEventListener("scroll", onScroll); window.removeEventListener("resize", onResize); };
  }, [on]);   // eslint-disable-line react-hooks/exhaustive-deps
  return box;
}

const ICON = {
  search: (c) => <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="6.5" /><path d="m16 16 4.5 4.5" /></svg>,
  up: (c) => <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 19V5M6 11l6-6 6 6" /></svg>,
};

/** v129: выбранная кнопка раздела — в видимой части своей ленты (иначе «Красные» уезжают за край, и не видно, что включено). */
export const showActiveChip = (row) => {
  try {
    if (!row) return;
    const el = row.querySelector('[aria-pressed="true"]'); if (!el) return;
    const r = row.getBoundingClientRect(), b = el.getBoundingClientRect(), l = b.left - r.left + row.scrollLeft;
    if (l < row.scrollLeft + 4 || l + b.width > row.scrollLeft + row.clientWidth - 4) row.scrollLeft = Math.max(0, l - (row.clientWidth - b.width) / 2);
  } catch (e) {}
};

/** Копия шапки сверху: вкладки (tabs — их вариант для копии), разделы (chips), поиск и «наверх». Поиск — поле самой карты:
 *  касание прокручивает к нему и ставит курсор (поле в копии пропадало бы вместе с ней, пока список под ним меняется).
 *  v129: line — строка под разделами (что показано или в каком разделе ты сейчас); active — выбранный раздел, он всегда в
 *  видимой части ленты. */
export function BarPin({ box, a11y, gold, tabs = null, chips, onSearch, line = null, active = "" }) {
  const rowRef = React.useRef(null);
  React.useLayoutEffect(() => { showActiveChip(rowRef.current); }, [box ? box.width : 0, active]);   // eslint-disable-line react-hooks/exhaustive-deps
  if (!box || typeof document === "undefined") return null;
  const bg = { background: a11y ? "rgba(242,233,212,0.95)" : "rgba(23,18,9,0.94)", WebkitBackdropFilter: "blur(10px)", backdropFilter: "blur(10px)",
    borderBottom: `1px solid ${a11y ? "rgba(139,106,48,0.3)" : "rgba(214,178,102,0.25)"}` };
  const iconBtn = { width: 34, height: 34, flexShrink: 0, borderRadius: 17, border: `1px solid ${gold}66`, background: "transparent", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", padding: 0 };
  return createPortal(
    <div data-bar-pin="" style={{ position: "fixed", top: 0, left: box.left, width: box.width, zIndex: 330, boxSizing: "border-box",
      padding: "calc(var(--sa-st, env(safe-area-inset-top, 0px)) + 6px) 12px 7px", ...bg }}>
      {tabs ? <div style={{ marginBottom: 6 }}>{tabs}</div> : null}
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <div ref={rowRef} className="sa-hscroll" role="group" aria-label="Разделы" style={{ flex: 1, minWidth: 0, display: "flex", gap: 6, overflowX: "auto" }}>{chips}</div>
        {onSearch ? <button type="button" data-bar-pin-search="" aria-label="Поиск" data-lens="disc" onClick={() => { vibrate("light"); onSearch(); }} style={iconBtn}>{ICON.search(gold)}</button> : null}
        <button type="button" data-bar-pin-up="" aria-label="Наверх" data-lens="disc" onClick={() => { vibrate("light"); toTop(); }} style={iconBtn}>{ICON.up(gold)}</button>
      </div>
      {line ? <div data-bar-pin-line="">{line}</div> : null}
    </div>, document.body);
}
/** Поиск из копии шапки: поле карты — сверху экрана, курсор в нём (клавиатура открывается в том же касании). */
export const focusSearch = (el) => { if (!el) return; try { el.focus({ preventScroll: true }); } catch (e) {} scrollToEl(el); };

// v128, владелец: «Как ещё проще и удобнее мы можем сделать?» — «Да, давай». Карточки листаются подряд: внизу карточки вина,
// крепкого и коктейля «‹ предыдущее» и «следующее ›» в том порядке, в каком они стоят в списке (с поиском, разделом и
// подбором). Вернулся в список после листания — строка последней карточки в поле зрения.
const SERIF = "Georgia, 'Times New Roman', serif";
/** Строка не видна (под копией шапки сверху или под нижним меню) — прокрутить, чтобы встала на треть экрана сверху. */
export const revealEl = (el) => {
  try {
    const r = scrollRoot(); if (!r || !el) return;
    const rb = r.getBoundingClientRect(), b = el.getBoundingClientRect(), vh = Math.min(rb.bottom, window.innerHeight);
    if (b.top >= rb.top + topInsetPx() + 120 && b.bottom <= vh - 90) return;
    r.scrollTo({ top: Math.max(0, b.top - rb.top + r.scrollTop - (vh - rb.top) * 0.33) });
  } catch (e) {}
};
/** Список ↔ карточка: листал карточки — после «назад» строка последней в поле зрения (без листания список стоит, где был).
 *  Вызывать после useInnerTop: тот сначала возвращает прокрутку списка. sel(id) — селектор строки. */
export function useBackToRow(openId, sel) {
  const first = React.useRef(null), last = React.useRef(null);
  React.useEffect(() => {
    if (openId) { last.current = openId; if (first.current == null) first.current = openId; return; }
    const id = last.current, f = first.current; last.current = null; first.current = null;
    if (!id || id === f || typeof document === "undefined") return;
    const esc = typeof CSS !== "undefined" && CSS.escape ? CSS.escape(id) : String(id).replace(/"/g, '\\"');
    revealEl(document.querySelector(sel(esc)));
  }, [openId]);   // eslint-disable-line react-hooks/exhaustive-deps
}
/** Где карточка в списке: { at, n, prev, next } — по порядку на экране (order), а нет её там (поиск её уже не находит) — по
 *  всему списку (all). */
export function stepsOf(id, order, all) {
  let list = order || [], at = list.findIndex((x) => x.id === id);
  if (at < 0) { list = all || []; at = list.findIndex((x) => x.id === id); }
  return { at, n: list.length, prev: at > 0 ? list[at - 1] : null, next: at >= 0 && at < list.length - 1 ? list[at + 1] : null };
}
/** «‹ предыдущее» и «следующее ›» внизу карточки; под словом — название соседней. На светлом стекле «Для чтения» слово —
 *  тёмным золотом #6B4E1A (#7A5D2A там давал 4,17 при норме 4,5, как у стекла линзы, ui/home-look.jsx). */
export function PrevNext({ a11y, gold, text, sub, steps, name, onGo }) {
  if (!steps || steps.at < 0 || steps.n < 2) return null;
  const btn = (x, dir) => (x ? (
    <button type="button" className="sa-btn" data-card-step={dir} data-lens-btn="soft" onClick={() => { vibrate("light"); onGo(x.id); }}
      style={{ flex: 1, minWidth: 0, textAlign: dir === "prev" ? "left" : "right", padding: "9px 12px", borderRadius: 14, border: `1px solid ${gold}55`,
        background: a11y ? "rgba(255,255,255,0.45)" : "rgba(255,248,230,0.04)", cursor: "pointer", fontFamily: SERIF }}>
      <span style={{ display: "block", fontStyle: "italic", fontSize: 13, color: a11y ? "#6B4E1A" : gold }}>{dir === "prev" ? "‹ предыдущее" : "следующее ›"}</span>
      <span style={{ display: "block", fontSize: 13.5, color: text, lineHeight: 1.3, marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{name(x)}</span>
    </button>) : <span aria-hidden="true" style={{ flex: 1 }} />);
  return (
    <div data-card-steps={steps.at + 1 + "/" + steps.n} style={{ marginTop: 24 }}>
      <div style={{ textAlign: "center", fontSize: 12.5, color: sub, marginBottom: 8 }}>{steps.at + 1} из {steps.n}</div>
      <div style={{ display: "flex", gap: 8 }}>{btn(steps.prev, "prev")}{btn(steps.next, "next")}</div>
    </div>);
}
