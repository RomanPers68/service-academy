// ui/bar-kit.jsx — v129 (Доп. 442): «Барная карта» — чтобы зашёл и не заблудился.
//
// Владелец (02.11): «Как ещё можем сделать удобнее барную карту. Что бы человек зайдя в неё не заблудился и все было
// интуитивно понятно?» — на восемь предложений «Давай все». Здесь общее для вкладок «Коктейли», «Вина» и «Крепкое»:
// поле поиска со своим золотым крестиком, строка «Показаны: Красные, 7 из 30 · Показать все» и конец списка, «Нашлось во
// вкладке «Вина»» (поиск во вкладке смотрит всю карту), строка «Учить» (одна и та же во всех вкладках), золотая стрелка у
// строки, листание карточек пальцем, раздел под копией шапки, место списка вкладки и подсказка первого входа.
import React from "react";
import { labelStyle } from "./tokens";
import { onActivate, vibrate } from "../lib/utils";
import { topInsetPx } from "../lib/tg-screen";
import { useHintOnce, HintBubble } from "./widgets";
import { hintsFor } from "../data/hints";
import { scrollRoot } from "./bar-pin";

const SERIF = "Georgia, 'Times New Roman', serif";
const rootTarget = (root) => (root === document.scrollingElement || root === document.documentElement ? window : root);

/** Золотая стрелка у строки: видно, что строка открывается. */
export const Chevron = ({ gold }) => <span aria-hidden="true" data-bar-chev="" style={{ flexShrink: 0, color: gold, opacity: 0.85, fontSize: 21, lineHeight: 1, fontFamily: SERIF, marginLeft: 2 }}>›</span>;

/** Поле поиска карты: свой золотой крестик вместо крестика браузера (его прячет ui/css.js по data-bar-search). */
export function SearchField({ inputRef, value, onChange, placeholder, aria, a11y, gold, text, style = null }) {
  const clear = () => { vibrate("light"); onChange(""); try { if (inputRef && inputRef.current) inputRef.current.focus({ preventScroll: true }); } catch (e) {} };
  return (
    <div style={{ position: "relative", flex: 1, minWidth: 0, ...style }}>
      <input ref={inputRef} data-lens-field="" data-bar-search="" type="search" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} aria-label={aria}
        style={{ width: "100%", boxSizing: "border-box", padding: value ? "11px 40px 11px 14px" : "11px 14px", borderRadius: 14, border: `1px solid ${gold}55`, background: a11y ? "rgba(255,255,255,0.55)" : "rgba(0,0,0,0.22)", color: text, fontSize: 14.5, fontFamily: SERIF, outline: "none" }} />
      {value ? <button type="button" data-bar-search-clear="" aria-label="Очистить поиск" onClick={clear}
        style={{ position: "absolute", right: 5, top: "50%", transform: "translateY(-50%)", width: 32, height: 32, borderRadius: 16, border: "none", background: "transparent", color: a11y ? "#6B4E1A" : gold, fontSize: 15, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", padding: 0 }}>✕</button> : null}
    </div>);
}

/** Что сейчас прячет часть карты: «Показаны: Красные, по запросу «шаб», 2 из 30» и «Показать все» (сбрасывает всё сразу). */
export function FilterNote({ parts, n, total, onReset, gold, text, sub, a11y, compact = false }) {
  if (!parts || !parts.length) return null;
  return (
    <div data-bar-filter={n + "/" + total} style={{ display: "flex", alignItems: "center", gap: 8, margin: compact ? "6px 0 0" : "8px 2px 2px", fontSize: compact ? 12.5 : 13, color: sub, lineHeight: 1.4 }}>
      <span style={{ flex: 1, minWidth: 0 }}>{"Показаны: " + parts.join(", ") + ", " + n + " из " + total}</span>
      <button type="button" className="sa-btn" data-bar-filter-reset="" data-lens-btn="soft" data-lens-ink="" onClick={() => { vibrate("light"); onReset(); }}
        style={{ flexShrink: 0, padding: "4px 11px", borderRadius: 999, border: `1px solid ${gold}77`, background: "transparent", color: a11y ? "#6B4E1A" : text, fontFamily: SERIF, fontSize: 12.5, cursor: "pointer", whiteSpace: "nowrap" }}>Показать все</button>
    </div>);
}

/** Конец списка, когда показана часть карты: «Это весь раздел «Красные»» и кнопка показать всё. */
export function EndNote({ text, button, onClick, gold, sub, a11y }) {
  return (
    <div data-bar-end="" style={{ textAlign: "center", padding: "12px 6px 2px", fontSize: 13, color: sub, lineHeight: 1.5 }}>
      <div>{text}</div>
      {button ? <button type="button" className="sa-btn" data-bar-end-all="" data-lens-btn="soft" data-lens-ink="" onClick={() => { vibrate("light"); onClick(); }}
        style={{ marginTop: 8, padding: "7px 14px", borderRadius: 999, border: `1px solid ${gold}77`, background: "transparent", color: a11y ? "#6B4E1A" : gold, fontFamily: SERIF, fontSize: 13.5, cursor: "pointer" }}>{button}</button> : null}
    </div>);
}

/** Поиск во вкладке смотрит всю карту: «Нашлось во вкладке «Вина»» — строки других вкладок (касание — карточка там) и
 *  «Все 12 во вкладке «Вина» ›» (та вкладка с тем же поиском). none — здесь не нашлось ничего. */
export function Elsewhere({ groups, onOpen, onAll, T, gold, text, sub, none = false }) {
  if (!groups || !groups.length) return null;
  return (
    <div data-bar-elsewhere={groups.map((g) => g.tab).join(",")} style={{ marginTop: none ? 6 : 18 }}>
      {groups.map((g) => (
        <div key={g.tab} data-bar-elsewhere-tab={g.tab} style={{ marginBottom: 10 }}>
          <div style={{ ...labelStyle(13.5), color: gold, margin: "0 2px 6px" }}>{(none ? "Нашлось" : "Ещё нашлось") + " во вкладке «" + g.label + "»"}</div>
          {g.items.map((x) => {
            const go = () => { vibrate("light"); onOpen(g.tab, x.id); };
            return (
              <div key={x.id} role="button" tabIndex={0} data-bar-elsewhere-item={x.id} data-lens-card="" onClick={go} {...onActivate(go)}
                style={{ ...T.modCard, display: "flex", alignItems: "center", gap: 10, padding: "9px 14px", marginBottom: 8 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: SERIF, fontSize: 15, color: text, lineHeight: 1.3 }}>{x.title}</div>
                  {x.sub ? <div style={{ fontSize: 12.5, color: sub, marginTop: 2, lineHeight: 1.4 }}>{x.sub}</div> : null}
                </div>
                <Chevron gold={gold} />
              </div>);
          })}
          {g.n > g.items.length ? <button type="button" className="sa-btn" data-bar-elsewhere-all={g.tab} data-lens-btn="soft" data-lens-ink="" onClick={() => { vibrate("light"); onAll(g.tab); }}
            style={{ padding: "6px 13px", borderRadius: 999, border: `1px solid ${gold}77`, background: "transparent", color: text, fontFamily: SERIF, fontSize: 13, cursor: "pointer" }}>{"Все " + g.n + " во вкладке «" + g.label + "» ›"}</button> : null}
        </div>))}
    </div>);
}

/** Строка «Учить» — одна и та же во всех вкладках, каждая кнопка сразу в дело. По две в ряд: всё видно сразу, без ленты
 *  вбок (её третью кнопку никто бы не нашёл); нечётная последняя — на всю ширину. Самое длинное слово не режется: не
 *  влезает в половину (320 px, «Лаборатория») — кнопки друг под другом. wide — одна кнопка на всю ширину (учить пока
 *  нечего: «Проверь вина…»). */
export function LearnStrip({ T, items, gold }) {
  if (!items || !items.length) return null;
  return (
    <div id="sa-bar-learn" data-bar-learn-row={items.map((x) => x.key).join(",")} style={{ margin: "0 0 10px" }}>
      <div style={{ ...labelStyle(13.5), color: gold, margin: "0 2px 6px" }}>Учить</div>
      <div role="group" aria-label="Учить" style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {items.map((x) => {
          const go = () => { vibrate("light"); x.go(); };
          return (
            <div key={x.key} className="sa-card" role="button" tabIndex={0} data-bar-learn={x.key} data-lens-card={x.hi ? "hi" : ""} {...(x.attrs || {})} onClick={go} {...onActivate(go)}
              style={{ ...T.modCard, boxSizing: "border-box", flex: x.wide ? "1 1 100%" : "1 1 calc(50% - 4px)", minWidth: "min-content", margin: 0, padding: "9px 12px 9px 11px", gap: 8, ...(x.hi ? { border: `1px solid ${gold}AA` } : {}) }}>
              <span aria-hidden="true" style={{ flexShrink: 0, display: "flex" }}>{x.icon}</span>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ ...T.modTitle, whiteSpace: "normal", lineHeight: 1.25 }}>{x.title}</div>
                <div style={{ ...T.modSub, whiteSpace: "normal", lineHeight: 1.35 }}>{x.sub}</div>
              </div>
            </div>);
        })}
      </div>
    </div>);
}

/** Карточки листают пальцем: влево — следующая, вправо — предыдущая, как колоду. Вертикальный жест — прокрутка; у самого
 *  левого края не ловим (там системное «назад»). swipe(onPrev, onNext) — обработчики для карточки. */
export function useSwipe() {
  const s = React.useRef(null);
  return (onPrev, onNext) => ({
    onTouchStart: (e) => { const t = e.touches && e.touches[0]; s.current = !t || e.touches.length > 1 || t.clientX < 24 ? null : { x: t.clientX, y: t.clientY, t: Date.now(), axis: null }; },
    onTouchMove: (e) => {
      const st = s.current, t = e.touches && e.touches[0]; if (!st || !t || st.axis) return;
      const dx = t.clientX - st.x, dy = t.clientY - st.y; if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
      st.axis = Math.abs(dx) > Math.abs(dy) * 1.2 ? "x" : "y";
    },
    onTouchEnd: (e) => {
      const st = s.current; s.current = null; const t = e.changedTouches && e.changedTouches[0];
      if (!st || !t || st.axis === "y") return;
      const dx = t.clientX - st.x, dy = t.clientY - st.y, v = Math.abs(dx) / Math.max(1, Date.now() - st.t);
      if (Math.abs(dx) < Math.abs(dy) * 1.2 || !(Math.abs(dx) > 70 || (Math.abs(dx) > 30 && v > 0.45))) return;
      if (dx < 0 && onNext) onNext(); else if (dx > 0 && onPrev) onPrev();
    },
    onTouchCancel: () => { s.current = null; },
  });
}

/** Какой раздел списка сейчас под копией шапки: последний заголовок, ушедший выше её нижнего края (без копии — выше верха
 *  экрана). sel — заголовки разделов, attr — где у них ключ. */
export function useSection(on, sel, attr) {
  const [cur, setCur] = React.useState("");
  React.useEffect(() => {
    const root = scrollRoot();
    if (!on || !root || typeof window === "undefined") { setCur(""); return undefined; }
    let raf = 0;
    const check = () => {
      raf = 0;
      const pin = document.querySelector("[data-bar-pin]"), lim = pin ? pin.getBoundingClientRect().bottom + 2 : topInsetPx() + 2;
      let k = "";
      for (const el of document.querySelectorAll(sel)) { if (el.getBoundingClientRect().top <= lim) k = el.getAttribute(attr) || ""; else break; }
      setCur(k);
    };
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(check); };
    const target = rootTarget(root);
    target.addEventListener("scroll", onScroll, { passive: true });
    check();
    return () => { if (raf) cancelAnimationFrame(raf); target.removeEventListener("scroll", onScroll); };
  }, [on, sel]);   // eslint-disable-line react-hooks/exhaustive-deps
  return cur;
}

/** Вкладка помнит место в списке: пока список на экране, запоминаем прокрутку; ушёл со вкладки (другая вкладка, карточка
 *  другой вкладки) — отдаём её в save. Прокрутку берём из запомненного, а не с экрана: при смене вкладки его уже нет. */
export function useKeepScroll(on, start, save) {
  const y = React.useRef(start || 0), saveRef = React.useRef(save);
  saveRef.current = save;
  React.useEffect(() => {
    const root = scrollRoot(); if (!on || !root || typeof window === "undefined") return undefined;
    const f = () => { y.current = root.scrollTop; };
    const target = rootTarget(root);
    target.addEventListener("scroll", f, { passive: true });
    return () => target.removeEventListener("scroll", f);
  }, [on]);
  React.useEffect(() => () => { if (saveRef.current) saveRef.current(y.current); }, []);
}

/** Первый вход в «Барную карту» — три шага по экрану, один раз: вкладки, строка и карточка, «Учить» (тексты —
 *  data/hints.js, ключ barCard). has — какие цели есть на экране (у сотрудника с одними коктейлями вкладок нет). */
export function BarHint({ a11y, ready, has }) {
  const [on, done] = useHintOnce("barCard", ready);
  const [i, setI] = React.useState(0);
  const all = hintsFor("barCard");
  const steps = [["tabs", "sa-bar-tabs"], ["row", "sa-bar-row1"], ["learn", "sa-bar-learn"]].map(([k, id], n) => ({ k, id, text: all[n] })).filter((x) => x.text && has && has[x.k]);
  if (!on || !steps.length) return null;
  const at = Math.min(i, steps.length - 1), s = steps[at];
  return <HintBubble a11y={a11y} text={s.text} anchorId={s.id} step={at + 1} total={steps.length}
    onNext={at >= steps.length - 1 ? null : () => setI((v) => v + 1)} onClose={done} />;
}
