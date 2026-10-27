// ui/keyboard.js
// v94 (Доп. 407): клавиатура и низ слоя: один расчёт для чата (ui/chat.jsx) и Наставника (ui/assistant.jsx).
//
// Как Telegram на iPhone показывает клавиатуру (исходники Telegram iOS: WebAppController.swift, WebAppWebView.swift):
//   · сам WebKit о клавиатуре не знает: Telegram снимает его подписки на клавиатуру, visualViewport не меняется
//     (а когда меняется, то то отстаёт, то короче на клавиатуру: v91 и v94 вычитали её дважды);
//   · высоту над клавиатурой Telegram сообщает сразу, как только клавиатура поехала: событие viewport_changed
//     (WebApp.viewportHeight, событие viewportChanged);
//   · окно уменьшает только через 0,4 с и в тот же миг спрашивает, где поле ввода. Если поле ниже края клавиатуры
//     (с запасом 44 px), Telegram прокручивает к нему всю страницу. Fixed-слой при этом падал вниз на высоту
//     клавиатуры и ехал обратно, а сверху мелькала чёрная полоса (записи владельца, v93);
//   · клавиатура уходит: окно растёт сразу.
// Поэтому в Telegram на iPhone низ слоя поднимаем по viewportHeight, как только клавиатура поехала, и ведём вместе
// с ней (220 мс). Через 0,4 с поле уже над клавиатурой, Telegram ничего не прокручивает, а когда окно сжимается,
// отступ в тот же кадр становится 0 и на экране ничего не двигается. Клавиатура уходит: низ едет вниз вместе с ней,
// не зависая над пустым местом.
// В браузере и на Android: по visualViewport, как раньше (v91, v94).
//
// Отступ слой берёт из переменной --kb (padding-bottom: var(--kb)). Её ставит хук сам, каждый кадр, без React:
// так отступ меняется в тот же кадр, что и высота окна.
import React from "react";

const num = (v) => Number(v) || 0;

// v91: сколько видимая часть (visualViewport) перекрывает низ слоя
export const kbOverlap = (layerBottom, vvTop, vvHeight) => Math.max(0, Math.round(num(layerBottom) - num(vvTop) - num(vvHeight)));
// v94: окно с клавиатурой сжалось само, а visualViewport всё равно короче на клавиатуру: из перекрытия вычитаем,
// насколько слой уже стал ниже своей высоты без клавиатуры (baseH)
export const kbPad = (layerBottom, layerH, baseH, vvTop, vvHeight) =>
  Math.max(0, kbOverlap(layerBottom, vvTop, vvHeight) - Math.max(0, Math.round(num(baseH) - num(layerH))));

// Telegram на iPhone и iPad
export const tgIos = (w) => {
  try { const tg = (w || window).Telegram && (w || window).Telegram.WebApp; return !!tg && String(tg.platform || "").toLowerCase() === "ios"; } catch (e) { return false; }
};

// Где должен быть низ слоя: px от верха окна.
// p: bottom — низ слоя без отступа; layerH, baseH — высота слоя сейчас и без клавиатуры; vvTop, vvH — visualViewport;
// tgH — WebApp.viewportHeight; ios — Telegram на iPhone; typing — фокус в поле ввода.
export function kbBottom(p) {
  const bottom = num(p && p.bottom);
  if (p && p.ios) {
    const h = num(p.tgH);
    return Math.round(p.typing && h > 120 ? Math.min(bottom, h) : bottom);
  }
  return Math.round(bottom - kbPad(bottom, p && p.layerH, p && p.baseH, p && p.vvTop, p && p.vvH));
}
// клавиатура на экране: низ поднят или окно уже само сжалось под неё (тогда отступ 0, но вырез снизу не нужен).
// Фокус ушёл, а окно ещё короткое: клавиатура уезжает, вырез вернётся, когда окно вырастет
export const kbUp = (p, vis) => num(p && p.bottom) - num(vis) > 80 || num(p && p.baseH) - num(p && p.layerH) > 80;

// высота слоя без клавиатуры (на эту ширину экрана): помним, пока слой закрыт и открыт заново
const KB_BASE = { w: 0, h: 0, low: 0 };
export const typing = () => {
  try {
    const a = document.activeElement;
    return !!a && (a.tagName === "TEXTAREA" || a.isContentEditable || (a.tagName === "INPUT" && !/^(button|checkbox|radio|range|file|submit|reset|color|image|hidden)$/i.test(a.type || "")));
  } catch (e) { return false; }
};
export const KB_MS = 220;
// как у клавиатуры iPhone: резко с места и мягко в конце
export const kbEase = (t) => { const x = Math.min(1, Math.max(0, num(t))); return 1 - Math.pow(1 - x, 3); };
const calm = () => { try { return !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches); } catch (e) { return false; } };
const now = () => (typeof performance !== "undefined" && performance.now ? performance.now() : Date.now());

/**
 * Низ слоя над клавиатурой. ref — корень слоя (position:fixed; inset:0; padding-bottom: var(--kb, 0px)).
 * Возвращает { lift, up }: lift — на сколько поднят низ (когда доедет), up — клавиатура на экране.
 */
export function useKeyboardLift(ref) {
  const [st, setSt] = React.useState({ lift: 0, up: false });
  React.useLayoutEffect(() => {
    if (typeof window === "undefined") return undefined;
    const vv = window.visualViewport || null;
    const tg = window.Telegram && window.Telegram.WebApp;
    let shown = null, from = 0, to = 0, t0 = 0, raf = 0, timer = 0, settle = 0, put = null, last = { lift: 0, up: false }, alive = true;
    const rect = () => {
      const el = ref && ref.current;
      try { if (el) return el.getBoundingClientRect(); } catch (e) { /* */ }
      return { bottom: window.innerHeight, height: window.innerHeight, width: window.innerWidth };
    };
    // отступ: от низа слоя до того места, где сейчас должен быть его низ
    const paint = (r) => {
      const el = ref && ref.current; if (!el || shown == null) return;
      const v = Math.max(0, Math.round((r || rect()).bottom - shown));
      if (v !== put) { put = v; el.style.setProperty("--kb", v + "px"); }
    };
    const step = (t) => {
      raf = 0; if (!alive) return;
      const k = KB_MS > 0 ? (t - t0) / KB_MS : 1;
      shown = from + (to - from) * kbEase(k);
      paint();
      if (k < 1) raf = requestAnimationFrame(step);
    };
    const measure = () => {
      if (!alive) return;
      const r = rect(), ty = typing();
      if (Math.abs(r.width - KB_BASE.w) > 1 || !KB_BASE.h) { KB_BASE.w = r.width; KB_BASE.h = r.height; KB_BASE.low = 0; }   // первый замер или поворот
      else if (ty || r.height >= KB_BASE.h) { KB_BASE.h = Math.max(KB_BASE.h, r.height); KB_BASE.low = 0; }                // печатают или окно выросло
      else if (!KB_BASE.low) { KB_BASE.low = now(); clearTimeout(settle); settle = setTimeout(measure, 700); }               // фокус ушёл, окно ещё низкое: клавиатура уезжает
      else if (now() - KB_BASE.low > 600) { KB_BASE.h = r.height; KB_BASE.low = 0; }                                         // так и осталось: это новая высота окна
      let tgH = 0; try { tgH = tg ? num(tg.viewportHeight) : 0; } catch (e) { tgH = 0; }
      const p = { bottom: r.bottom, layerH: r.height, baseH: KB_BASE.h, vvTop: vv ? vv.offsetTop : 0, vvH: vv ? vv.height : window.innerHeight, tgH, ios: tgIos(), typing: ty };
      const target = kbBottom(p);
      if (shown == null || calm()) {
        if (raf) { cancelAnimationFrame(raf); raf = 0; }
        shown = to = target;
      } else if (target !== to) {
        // новая цель: едем к ней от того места, где низ сейчас
        from = shown; to = target; t0 = now();
        if (!raf) raf = requestAnimationFrame(step);
      }
      // окно сменило высоту, а цель та же: отступ пересчитан в этот же кадр, на экране ничего не дёрнулось
      paint(r);
      const next = { lift: Math.max(0, Math.round(r.bottom - target)), up: kbUp(p, target) };
      if (next.lift !== last.lift || next.up !== last.up) { last = next; setSt(next); }
    };
    // фокус сменился: activeElement становится известен чуть позже события
    const later = () => { clearTimeout(timer); timer = setTimeout(measure, 0); };
    if (vv) { vv.addEventListener("resize", measure); vv.addEventListener("scroll", measure); }
    window.addEventListener("resize", measure);
    document.addEventListener("focusin", later); document.addEventListener("focusout", later);
    try { if (tg && tg.onEvent) tg.onEvent("viewportChanged", measure); } catch (e) { /* */ }
    measure();
    return () => {
      alive = false; clearTimeout(timer); clearTimeout(settle); if (raf) cancelAnimationFrame(raf);
      if (vv) { vv.removeEventListener("resize", measure); vv.removeEventListener("scroll", measure); }
      window.removeEventListener("resize", measure);
      document.removeEventListener("focusin", later); document.removeEventListener("focusout", later);
      try { if (tg && tg.offEvent) tg.offEvent("viewportChanged", measure); } catch (e) { /* */ }
      const el = ref && ref.current; if (el) el.style.removeProperty("--kb");
    };
  }, []);   // eslint-disable-line react-hooks/exhaustive-deps
  return st;
}

/**
 * Лента у низа остаётся у низа, когда её высота меняется: клавиатура поднимает низ, поле ввода растёт.
 * Кто листает историю выше, того не трогаем.
 */
export function usePinBottom(ref) {
  React.useLayoutEffect(() => {
    const el = ref && ref.current;
    if (!el || typeof ResizeObserver === "undefined") return undefined;
    let near = true, h = el.clientHeight;
    const onScroll = () => { near = el.scrollHeight - el.scrollTop - el.clientHeight < 80; };
    const ro = new ResizeObserver(() => {
      const nh = el.clientHeight;
      if (nh !== h) { h = nh; if (near) el.scrollTop = el.scrollHeight; }
    });
    el.addEventListener("scroll", onScroll, { passive: true });
    ro.observe(el);
    return () => { ro.disconnect(); el.removeEventListener("scroll", onScroll); };
  }, []);   // eslint-disable-line react-hooks/exhaustive-deps
}
