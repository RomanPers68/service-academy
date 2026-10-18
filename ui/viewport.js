// ui/viewport.js
// v50 (Доп. 363): горизонталь и компьютер. Один источник правды о раскладке экрана.
//
// Владелец: «Главное, чтобы всё приложение имело возможность переходить в горизонт и было им удобно пользоваться».
// Портрет телефона (уже 600 px) не меняется ни на пиксель. Шире — «широкая» раскладка:
//   · меню слева (NavRail) вместо нижней панели — в горизонтали панель съедала четверть высоты;
//   · колонка экрана шире (640 px вместо 430) и по центру свободного места, справа от меню;
//   · главная и график руководителя — в две колонки, когда хватает места;
//   · низкий экран (телефон лёжа, ниже 540 px) — всё компактнее по высоте.
// App ставит классы на <html> (sa-wide, sa-short, sa-desk, sa-railon) и переменные --sa-rail, --sa-colw —
// по ним живут правила в ui/css.js, в том числе у слоёв, которые открываются порталом в body.
import React from "react";

export const WIDE_MIN = 600;     // от этой ширины — широкая раскладка (телефон лёжа, планшет, компьютер)
export const SHORT_MAX = 540;    // ниже этой высоты — телефон лёжа: компактнее по высоте
export const DESK_MIN = 1100;    // компьютер и планшет лёжа: две колонки там, где это удобно
export const RAIL_W = 80;        // меню слева: пилюля 68 px + поле 12 px (вырез экрана — сверху, env())
export const COL_W = 640;        // колонка обычного экрана в широкой раскладке
export const HOME2_MIN = 630;    // главная в две колонки — когда колонке есть 310 + 20 + 300 px: iPhone лёжа (и с вырезом), планшет, компьютер

// Чистая функция — для тестов и для App
export function layoutOf(w, h) {
  const W = Math.max(0, Math.round(Number(w) || 0)), H = Math.max(0, Math.round(Number(h) || 0));
  const wide = W >= WIDE_MIN;
  return { w: W, h: H, wide, short: wide && H < SHORT_MAX, desk: wide && W >= DESK_MIN && H >= 600 };
}

// Сколько места у колонки: ширина экрана без меню слева, вырезов и полей по 12 px
export function availOf(lay, rail, safe) {
  const s = safe || { l: 0, r: 0 };
  return Math.max(0, lay.w - (rail ? RAIL_W : 0) - (s.l || 0) - (s.r || 0) - 24);
}

// Главная в две колонки — только по свободному месту (колонка по умолчанию 640 px сама по себе не повод)
export function homeTwoCols(lay, rail, safe) {
  return !!lay.wide && availOf(lay, rail, safe) >= HOME2_MIN;
}

// Ширина колонки экрана в широкой раскладке. Портрет — прежние 430.
export function colWidthOf(lay, screen, rail, safe) {
  if (!lay.wide) return 430;
  if (screen === "roleSelect" && homeTwoCols(lay, rail, safe)) return Math.min(1120, availOf(lay, rail, safe));
  return COL_W;
}

// Вырезы экрана (чёлка / Dynamic Island в горизонтали). v51 (Доп. 364): Telegram на iPhone лёжа растягивает
// окно под «остров», а env() без viewport-fit=cover там 0 — меню слева уезжало под «остров» (запись владельца).
// Telegram сообщает вырезы сам (WebApp.safeAreaInset, Bot API 8.0) — берём больший из двух замеров. Старый
// Telegram ничего не сообщает: iPhone с вырезом лёжа, окно во всю длину экрана — запас 50 px с обеих сторон.
export function safeInsets() {
  const z = { t: 0, r: 0, b: 0, l: 0 };
  if (typeof document === "undefined" || !document.body) return z;
  let e = z;
  try {
    const d = document.createElement("div");
    d.style.cssText = "position:fixed;left:0;top:0;width:0;height:0;visibility:hidden;pointer-events:none;"
      + "padding:env(safe-area-inset-top,0px) env(safe-area-inset-right,0px) env(safe-area-inset-bottom,0px) env(safe-area-inset-left,0px)";
    document.body.appendChild(d);
    const cs = getComputedStyle(d);
    e = { t: parseFloat(cs.paddingTop) || 0, r: parseFloat(cs.paddingRight) || 0, b: parseFloat(cs.paddingBottom) || 0, l: parseFloat(cs.paddingLeft) || 0 };
    d.remove();
  } catch (er) {}
  let g = z;
  try {
    const s = window.Telegram && window.Telegram.WebApp && window.Telegram.WebApp.safeAreaInset;
    if (s && typeof s === "object") g = { t: Number(s.top) || 0, r: Number(s.right) || 0, b: Number(s.bottom) || 0, l: Number(s.left) || 0 };
  } catch (er) {}
  const r = { t: Math.max(e.t, g.t), r: Math.max(e.r, g.r), b: Math.max(e.b, g.b), l: Math.max(e.l, g.l) };
  if (!r.l && !r.r && notchedFullWidth()) { r.l = 50; r.r = 50; }
  return r;
}

// iPhone с вырезом (длинная сторона экрана от 812 pt; у SE её нет), лежит, окно — во всю длину экрана:
// значит, вырез внутри окна, а про него никто не сказал
export function notchedFullWidth(nav, scr, w, h) {
  try {
    const ua = String((nav || navigator).userAgent || "");
    const S = scr || screen, W = w != null ? w : window.innerWidth, H = h != null ? h : window.innerHeight;
    const long = Math.max(Number(S.width) || 0, Number(S.height) || 0);
    return /iPhone/.test(ua) && W > H && long >= 812 && W >= long - 2;
  } catch (er) { return false; }
}

const read = () => {
  if (typeof window === "undefined") return { ...layoutOf(390, 844), safe: { t: 0, r: 0, b: 0, l: 0 } };
  return { ...layoutOf(window.innerWidth, window.innerHeight), safe: safeInsets() };
};
const same = (a, b) => a.w === b.w && a.h === b.h && a.safe.l === b.safe.l && a.safe.r === b.safe.r && a.safe.t === b.safe.t && a.safe.b === b.safe.b;

// Размер экрана с поворотом. iPhone отдаёт новый размер не сразу после поворота —
// перечитываем ещё раз чуть позже. Сменилась раскладка (повернули телефон) — сразу, в следующем кадре;
// просто тянут край окна на компьютере — раз в 120 мс тишины, чтобы не перерисовывать всё приложение
// на каждый пиксель.
export function useViewport() {
  const [v, setV] = React.useState(read);
  const cur = React.useRef(v); cur.current = v;
  React.useEffect(() => {
    let raf = 0, t0 = 0, t1 = 0, t2 = 0;
    const upd = () => setV((p) => { const n = read(); return same(n, p) ? p : n; });
    const on = () => {
      const n = layoutOf(window.innerWidth, window.innerHeight), p = cur.current;
      clearTimeout(t0); clearTimeout(t1); clearTimeout(t2); cancelAnimationFrame(raf);
      if (n.wide !== p.wide || n.short !== p.short || n.desk !== p.desk) raf = requestAnimationFrame(upd);
      else t0 = setTimeout(upd, 120);
      t1 = setTimeout(upd, 250); t2 = setTimeout(upd, 700);
    };
    window.addEventListener("resize", on);
    window.addEventListener("orientationchange", on);
    // v51: Telegram сообщает вырезы и новую высоту окна своими событиями — иногда позже, чем resize
    const tg = typeof window !== "undefined" && window.Telegram && window.Telegram.WebApp;
    const TG_EV = ["safeAreaChanged", "contentSafeAreaChanged", "viewportChanged"];
    try { if (tg && tg.onEvent) TG_EV.forEach((ev) => tg.onEvent(ev, on)); } catch (er) {}
    upd();
    return () => {
      window.removeEventListener("resize", on); window.removeEventListener("orientationchange", on);
      try { if (tg && tg.offEvent) TG_EV.forEach((ev) => tg.offEvent(ev, on)); } catch (er) {}
      cancelAnimationFrame(raf); clearTimeout(t0); clearTimeout(t1); clearTimeout(t2);
    };
  }, []);
  return v;
}

// v52 (Доп. 365): экран сам просит ширину колонки на широком экране (карточки в две-три колонки, редактор с
// предпросмотром). Переменная --sa-colw-req живёт, пока экран открыт; правила ui/css.js берут её вместо
// ширины, которую ставит App, и сами ужимают до свободного места. В портрете она ни на что не влияет.
export function useColumn(w) {
  React.useLayoutEffect(() => {
    if (!w || typeof document === "undefined") return undefined;
    const el = document.documentElement;
    el.style.setProperty("--sa-colw-req", Math.round(w) + "px");
    return () => { el.style.removeProperty("--sa-colw-req"); };
  }, [w]);
}

// Широкая раскладка — для экранов, которым нужно только «да/нет»
export function useWide() {
  return useViewport().wide;
}

// Где разрезать список на две колонки, чтобы они вышли примерно равной высоты (веса — прикидка высоты
// карточек). Колонки независимые: раскрылась карточка (SOS, заметка в глоссарии) — растёт только её колонка,
// соседние карточки не перепрыгивают в другую. При равенстве левая колонка — не короче правой.
export function splitAt(weights) {
  const w = (weights || []).map((x) => Math.max(0, Number(x) || 0));
  if (w.length < 2) return w.length;
  const total = w.reduce((a, b) => a + b, 0);
  let acc = 0, best = 1, bestD = Infinity;
  for (let i = 1; i < w.length; i++) {
    acc += w[i - 1];
    const d = Math.abs(total - 2 * acc);
    if (d <= bestD) { bestD = d; best = i; }
  }
  return best;
}
