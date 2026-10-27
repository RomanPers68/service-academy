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
// с ней. Через 0,4 с поле уже над клавиатурой, Telegram ничего не прокручивает, а когда окно сжимается, отступ в тот
// же кадр становится 0 и на экране ничего не двигается. Клавиатура уходит: низ едет вниз вместе с ней, не зависая над
// пустым местом. В браузере и на Android: по visualViewport, как раньше (v91, v94).
// v95 (Доп. 408): на iPhone окно сжимается без события resize — размер самого слоя смотрит ResizeObserver: слой стал
// ниже или выше — пересчёт в том же кадре, до отрисовки; после сообщения Telegram о высоте — ещё через 0,5 и 1 с.
//
// v96 (Доп. 409): ход — средствами браузера, а не кадр за кадром. Запись владельца (60 кадров в секунду): строка ввода
// дрожала относительно клавиатуры на 8–15 px — отступ, который код менял каждый кадр, в Telegram на iPhone доходит до
// экрана неровно, через раз (на экране 120 Гц), а клавиатуру iPhone рисует сам, ровно. И трогалась строка позже
// клавиатуры: при открытии клавиатура 2 кадра накрывала её, при закрытии открывалась щель до 95 px. Теперь:
//   · в пути низ не меняет раскладку: ленту, строку ввода и листы (у них data-kbm) двигает transform через Web
//     Animations — это ведёт сам браузер, как клавиатуру, ровно; раскладка (--kb, --kbs) меняется один раз, в начале
//     пути вниз или в конце пути вверх, и в тот же кадр трансформ и прокрутка ленты (data-kbm-scroll) её покрывают:
//     на экране ничего не дёргается. Лента едет внутри своей рамки (у чата .ch-chatwrap, overflow: hidden) и уходит
//     под шапку, не налезая на неё. Прокрутка ленты при этом держит зазор до низа (сколько не докручено): низ ленты
//     на экране стоит, значит, и сообщения у низа стоят. Окно выросло раньше, чем мы узнали, — браузер уже прижал
//     прокрутку к новому низу; берём ту, что была до того (запоминаем после каждого замера и при прокрутке);
//   · ход — по кривой самой клавиатуры, снятой с записи (KB_OPEN — появляется, KB_CLOSE — уходит), с момента нажатия:
//     фокус в поле — клавиатура уже поехала, высоту клавиатуры помним с прошлого раза (localStorage sa_kb_k), не ждём
//     сообщения Telegram; фокус ушёл — едем вниз, как только окно позволит. Опоздали (Telegram сообщил позже, окно
//     выросло на кадр позже) — догоняем клавиатуру за KB_CATCH мс, а не отстаём весь путь.
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
const textInput = (a) => !!a && (a.tagName === "TEXTAREA" || !!a.isContentEditable || (a.tagName === "INPUT" && !/^(button|checkbox|radio|range|file|submit|reset|color|image|hidden)$/i.test(a.type || "")));
export const typing = () => { try { return textInput(document.activeElement); } catch (e) { return false; } };
const calm = () => { try { return !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches); } catch (e) { return false; } };
const now = () => (typeof performance !== "undefined" && performance.now ? performance.now() : Date.now());

// v96: ход клавиатуры iPhone, снятый с записи владельца (iOS, Telegram, 60 кадров в секунду): [мс от нажатия, доля пути].
// Появляется резко: в первом же кадре треть пути, дальше мягко; уходит чуть плавнее с места. Весь путь — 0,26–0,29 с,
// дальше клавиатура дотягивает последние 1–2 % (3–5 px) ещё полсекунды — это ход уже не нужен.
export const KB_OPEN = [[0, 0], [8, 0.12], [17, 0.27], [25, 0.38], [42, 0.49], [58, 0.6], [75, 0.695], [92, 0.77], [108, 0.83], [125, 0.875],
  [142, 0.905], [158, 0.932], [175, 0.95], [192, 0.964], [208, 0.973], [225, 0.98], [242, 0.986], [258, 0.991], [275, 0.996], [290, 1]];
export const KB_CLOSE = [[0, 0], [8, 0.078], [25, 0.216], [42, 0.375], [58, 0.484], [75, 0.594], [92, 0.692], [108, 0.769], [125, 0.827],
  [142, 0.873], [158, 0.908], [175, 0.934], [192, 0.951], [208, 0.963], [225, 0.974], [242, 0.985], [258, 1]];
// доля пути в момент ms (кусочно-линейно, до начала 0, после конца 1)
export const kbCurve = (pts, ms) => {
  const t = num(ms);
  if (!pts || !pts.length) return 1;
  if (t <= pts[0][0]) return pts[0][1];
  for (let i = 1; i < pts.length; i++) {
    if (t <= pts[i][0]) { const a = pts[i - 1], b = pts[i]; return a[1] + (b[1] - a[1]) * (t - a[0]) / Math.max(1e-6, b[0] - a[0]); }
  }
  return pts[pts.length - 1][1];
};
// опоздали за клавиатурой — догоняем её за столько мс
export const KB_CATCH = 50;
const smooth = (x) => { const u = Math.min(1, Math.max(0, x)); return u * u * (3 - 2 * u); };
/**
 * Путь низа (y, px от верха окна) от момента s до конца: клавиатура поехала в k0 от y0 к y1 по кривой pts, мы — в s с
 * места ys. Не опоздали — ровно по клавиатуре; опоздали или цель сменилась — сходимся с ней за KB_CATCH мс.
 * → [{ t, y }]: t — мс от s, шаг step; последний y — ровно y1.
 */
export function kbPath(pts, { y0, y1, k0, s, ys, step = 16 }) {
  const T = pts && pts.length ? pts[pts.length - 1][0] : 0;
  const ref = (t) => num(y0) + (num(y1) - num(y0)) * kbCurve(pts, t - num(k0));
  const end = Math.max(num(k0) + T, num(s) + 90);   // клавиатура уже доехала — короткий доезд
  const d = num(ys) - ref(num(s));
  const out = [];
  for (let t = num(s); ; t += step) {
    const tt = Math.min(t, end), u = tt - num(s);
    out.push({ t: Math.round(u * 10) / 10, y: tt >= end ? num(y1) : ref(tt) + d * (1 - smooth(u / KB_CATCH)) });
    if (tt >= end) break;
  }
  return out;
}
// где низ на пути в момент t (мс от начала пути)
export const kbAt = (path, u) => {
  if (!path || !path.length) return 0;
  if (u <= path[0].t) return path[0].y;
  for (let i = 1; i < path.length; i++) {
    if (u <= path[i].t) { const a = path[i - 1], b = path[i]; return a.y + (b.y - a.y) * (u - a.t) / Math.max(1e-6, b.t - a.t); }
  }
  return path[path.length - 1].y;
};
// куда ехать: «settle» — на место сразу (вниз от раскладки трансформом не сдвигаем: лента отошла бы от шапки),
// «up» — вверх трансформом, раскладка в конце, «down» — раскладка сразу, трансформом вниз
export const kbMove = (yS, goal, oFrom) => {
  const dy = num(goal) - num(yS);
  if (Math.abs(dy) < 1) return "settle";
  if (dy < 0) return num(oFrom) > 0.5 ? "settle" : "up";
  return "down";
};

// v96: высота клавиатуры с прошлого раза (ширина и высота окна те же) — чтобы ехать с нажатия, не ожидая Telegram
const KB_KEY = "sa_kb_k";
let KB_K;
export const kbRemembered = () => {
  if (KB_K === undefined) { try { const o = JSON.parse(localStorage.getItem(KB_KEY) || "null"); KB_K = o && o.k > 0 && o.w > 0 && o.h > 0 ? o : null; } catch (e) { KB_K = null; } }
  return KB_K;
};
export const kbRemember = (w, h, k) => {
  const o = kbRemembered();
  if (o && Math.abs(o.w - w) <= 1 && Math.abs(o.h - h) <= 2 && Math.abs(o.k - k) <= 1) return;
  KB_K = { w: Math.round(w), h: Math.round(h), k: Math.round(k) };
  try { localStorage.setItem(KB_KEY, JSON.stringify(KB_K)); } catch (e) { /* */ }
};
// вырез снизу в px (как его считает разметка: var(--sa-sb, env(…))) — замер невидимым элементом
const PROBES = {};
const probePx = (expr) => {
  try {
    let p = PROBES[expr];
    if (!p || !p.isConnected) {
      p = document.createElement("div"); p.setAttribute("aria-hidden", "true");
      p.style.cssText = "position:fixed;left:0;top:0;width:0;height:0;overflow:hidden;visibility:hidden;pointer-events:none;padding:0 0 " + expr + " 0";
      document.body.appendChild(p); PROBES[expr] = p;
    }
    return parseFloat(getComputedStyle(p).paddingBottom) || 0;
  } catch (e) { return 0; }
};
const animOk = () => { try { return typeof Element !== "undefined" && typeof Element.prototype.animate === "function"; } catch (e) { return false; } };
const tlNow = () => { try { const t = document.timeline && document.timeline.currentTime; if (t != null && t > 0) return Number(t); } catch (e) { /* */ } return now(); };

/**
 * Низ слоя над клавиатурой. ref — корень слоя (position:fixed; inset:0; padding-bottom: var(--kb, 0px)).
 * Возвращает { lift, up }: lift — на сколько поднят низ (когда доедет), up — клавиатура на экране.
 * Вырез снизу (полоска «домой») у строки ввода — переменная --kbs: 1 — клавиатуры нет, 0 — есть; в разметке:
 * calc(8px + var(--sa-sb) * var(--kbs, 1)). Класс cls (у чата — kb) и атрибут data-kbup хук тоже ставит сам.
 * v96: что едет вместе с клавиатурой — элементы с data-kbm внутри слоя (лента, строка ввода, листы, подсказка);
 * лента с прокруткой — data-kbm-scroll. safe — как разметка считает вырез снизу (у Наставника — env()).
 */
export function useKeyboardLift(ref, { cls = "", safe = "var(--sa-sb, env(safe-area-inset-bottom, 0px))" } = {}) {
  const [st, setSt] = React.useState({ lift: 0, up: false });
  React.useLayoutEffect(() => {
    if (typeof window === "undefined") return undefined;
    const vv = window.visualViewport || null;
    const tg = window.Telegram && window.Telegram.WebApp;
    let timer = 0, settle = 0, last = { lift: 0, up: false }, alive = true, ro = null, late = [];
    // v96: раскладка (--kb, --kbs), где низ в покое, путь в работе
    let L = 0, S = 1, yIdle = null, run = null, lastR = null, kOpen = -1e9, kClose = -1e9, pred = null, predT = 0;
    // v96: рамка слоя по раскладке. Слой ещё въезжает (у .sa-screen анимация fadeIn: translateY(12px) → 0) — сдвиг
    // анимации не в счёт: иначе низ «в покое» запоминался на 12 px ниже, и первый же ход вверх считался рывком (сразу на место)
    const rect = () => {
      const el = ref && ref.current;
      try {
        if (el) {
          const r = el.getBoundingClientRect();
          let dy = 0;
          try {
            const tf = getComputedStyle(el).transform;
            if (tf && tf !== "none" && typeof DOMMatrixReadOnly !== "undefined") {
              const m = new DOMMatrixReadOnly(tf);
              if (Math.abs(m.a - 1) < 1e-3 && Math.abs(m.d - 1) < 1e-3 && Math.abs(m.b) < 1e-3 && Math.abs(m.c) < 1e-3) dy = m.f || 0;
            }
          } catch (e) { dy = 0; }
          return dy ? { top: r.top - dy, bottom: r.bottom - dy, height: r.height, width: r.width } : r;
        }
      } catch (e) { /* */ }
      return { bottom: window.innerHeight, height: window.innerHeight, width: window.innerWidth };
    };
    const setLayout = (l, s) => {
      const el = ref && ref.current; if (!el) return;
      const v = Math.max(0, Math.round(l));
      if (v !== L) { L = v; el.style.setProperty("--kb", v + "px"); }
      if (s !== S) { S = s; el.style.setProperty("--kbs", String(s)); }
    };
    const yLay = (r, sp) => (r.bottom - L) - sp * S;   // низ по раскладке, без трансформа
    const all = (sel) => { const el = ref && ref.current; try { return el ? Array.prototype.slice.call(el.querySelectorAll(sel)) : []; } catch (e) { return []; } };
    const stop = () => { if (!run) return; clearTimeout(run.timer); run.anims.forEach((a) => { try { a.cancel(); } catch (e) { /* */ } }); run = null; };
    // прокрутка лент (data-kbm-scroll): t — scrollTop, c — высота ленты. Раскладку меняем под трансформом, низ ленты
    // на экране стоит — держим зазор до низа: t' = t + (c − c'). До перемены раскладки — before(), после — keepScroll().
    const kept = new WeakMap();
    const snapOf = (s) => ({ t: s.scrollTop, c: s.clientHeight });
    const note = () => all("[data-kbm-scroll]").forEach((s) => { try { kept.set(s, snapOf(s)); } catch (e) { /* */ } });
    const before = (resized) => all("[data-kbm-scroll]").map((s) => { let w = null; try { w = (resized && kept.get(s)) || snapOf(s); } catch (e) { w = null; } return [s, w]; });
    const keepScroll = (was) => was.forEach(([s, w]) => {
      if (!w) return;
      try {
        const c = s.clientHeight, t = w.t + (w.c - c);
        if (Math.abs(s.scrollTop - t) >= 0.5) s.scrollTop = t;
        s.__kbH = c !== w.c ? c : undefined;   // usePinBottom: эту высоту уже учли — не прижимать к низу поверх
        kept.set(s, snapOf(s));
      } catch (e) { /* */ }
    });
    // путь — трансформом у всех, кто едет (data-kbm), с одного момента
    const play = (path, base, t0) => {
      const total = Math.max(1, path[path.length - 1].t), frames = [];
      let prev = -1;
      path.forEach((q) => { const off = Math.min(1, Math.max(0, q.t / total)); if (off <= prev) return; prev = off; frames.push({ offset: off, transform: "translateY(" + (Math.round((q.y - base) * 10) / 10) + "px)" }); });
      if (frames.length < 2) return [];
      frames[0].offset = 0; frames[frames.length - 1].offset = 1;
      const anims = [];
      all("[data-kbm]").forEach((m) => { try { anims.push(m.animate(frames, { duration: total, easing: "linear", fill: "forwards" })); } catch (e) { /* */ } });
      anims.forEach((a) => { try { a.startTime = t0; } catch (e) { /* */ } });
      return anims;
    };
    // доехали: вверх — раскладка цели и трансформ снят (в один кадр), вниз — трансформ уже 0
    const finish = (rn) => {
      if (!rn || run !== rn) return;
      clearTimeout(rn.timer); run = null;
      const was = rn.dir === "up" ? before(false) : null;
      if (rn.dir === "up") setLayout(rn.Lg, rn.St);
      rn.anims.forEach((a) => { try { a.cancel(); } catch (e) { /* */ } });
      if (was) keepScroll(was);
      yIdle = rn.goal;
    };
    const start = (dir, base, ref0, pts, Lg, St, goal) => {
      const t0 = tlNow();
      const path = kbPath(pts, { ...ref0, s: t0 });
      const anims = play(path, base, t0);
      if (!anims.length) { setLayout(Lg, St); yIdle = goal; return; }   // ехать некому — сразу на место
      const rn = { dir, base, path, t0, goal, Lg, St, y0: ref0.y0, k0: ref0.k0, anims, timer: 0 };
      run = rn;
      rn.timer = setTimeout(() => finish(rn), path[path.length - 1].t + 80);
      try { anims[0].finished.then(() => finish(rn), () => {}); } catch (e) { /* */ }
    };
    // новая цель или окно сменило высоту: куда и как ехать
    const plan = (r, target, upT) => {
      const sp = probePx(safe), tn = tlNow();
      const Lg = Math.max(0, Math.round(r.bottom - target)), St = upT ? 0 : 1;
      const goal = (r.bottom - Lg) - sp * St;
      const resized = !!lastR && Math.abs(r.bottom - lastR.bottom) > 0.5;
      lastR = { bottom: r.bottom };
      const was = before(resized);   // прокрутка лент до перемены раскладки (окно уже сменило высоту — до того)
      if (yIdle == null && !run) { setLayout(Lg, St); keepScroll(was); yIdle = goal; return; }   // первый замер — сразу на место
      const yS = run ? kbAt(run.path, tn - run.t0) : yIdle;
      const snap = () => { stop(); setLayout(Lg, St); keepScroll(was); yIdle = goal; };
      if (!animOk() || calm()) { snap(); return; }
      if (run && !resized && Math.abs(run.goal - goal) < 0.5 && run.Lg === Lg && run.St === St) return;   // уже едем туда
      if (run && resized) { snap(); return; }   // окно сменило высоту посреди пути (редко) — сразу на место
      const base = run ? run.base : yLay(r, sp);
      const how = kbMove(yS, goal, yS - base);
      if (how === "settle") { snap(); return; }
      if (how === "up") {
        // вверх: раскладку не трогаем, едем трансформом от того же места; в конце — раскладка цели
        const same = run && run.dir === "up";
        const k0 = same ? run.k0 : (tn - kOpen < 250 ? kOpen : tn), y0 = same ? run.y0 : yS;
        stop();
        keepScroll(was);   // окно сменило высоту — тот же зазор до низа
        start("up", base, { y0, y1: goal, k0, ys: yS }, KB_OPEN, Lg, St, goal);
        return;
      }
      // вниз: сразу раскладка цели, трансформом держим, где было (лента уходит под шапку), и едем вниз
      const same = run && run.dir === "down";
      const k0 = same ? run.k0 : (tn - kClose < 250 ? kClose : tn), y0 = same ? run.y0 : yS;
      stop();
      setLayout(Lg, St);
      keepScroll(was);
      start("down", yLay(r, sp), { y0, y1: goal, k0, ys: yS }, KB_CLOSE, Lg, St, goal);
    };
    const measure = () => {
      if (!alive) return;
      const r = rect(), ty = typing(), tn = now();
      if (Math.abs(r.width - KB_BASE.w) > 1 || !KB_BASE.h) { KB_BASE.w = r.width; KB_BASE.h = r.height; KB_BASE.low = 0; }   // первый замер или поворот
      else if (ty || r.height >= KB_BASE.h) { KB_BASE.h = Math.max(KB_BASE.h, r.height); KB_BASE.low = 0; }                // печатают или окно выросло
      else if (!KB_BASE.low) { KB_BASE.low = tn; clearTimeout(settle); settle = setTimeout(measure, 700); }                  // фокус ушёл, окно ещё низкое: клавиатура уезжает
      else if (tn - KB_BASE.low > 600) { KB_BASE.h = r.height; KB_BASE.low = 0; }                                            // так и осталось: это новая высота окна
      let tgH = 0; try { tgH = tg ? num(tg.viewportHeight) : 0; } catch (e) { tgH = 0; }
      const p = { bottom: r.bottom, layerH: r.height, baseH: KB_BASE.h, vvTop: vv ? vv.offsetTop : 0, vvH: vv ? vv.height : window.innerHeight, tgH, ios: tgIos(), typing: ty };
      let target = kbBottom(p);
      // v96: Telegram сообщил высоту клавиатуры, окно ещё прежнее — запомним на следующий раз
      const told = p.ios && ty && tgH > 120 && r.bottom - tgH > 120;
      if (told && Math.abs(r.height - KB_BASE.h) <= 2) kbRemember(r.width, KB_BASE.h, r.bottom - tgH);
      // клавиатура поехала по фокусу, Telegram ещё молчит — едем по запомненной высоте
      if (pred) {
        if (!ty || told || tn > pred.until || Math.abs(r.width - pred.w) > 1) pred = null;
        else if (Math.abs(target - r.bottom) < 1) target = Math.round(r.bottom - pred.k);
      }
      const upT = kbUp(p, target) ? 1 : 0;
      plan(r, target, upT);
      note();
      const next = { lift: Math.max(0, Math.round(r.bottom - target)), up: !!upT };
      if (next.up !== last.up) {
        const el = ref && ref.current;
        if (el) { el.setAttribute("data-kbup", next.up ? "1" : "0"); if (cls) el.classList.toggle(cls, next.up); }
      }
      if (next.lift !== last.lift || next.up !== last.up) { last = next; setSt(next); }
    };
    // фокус сменился: activeElement становится известен чуть позже события
    const later = () => { clearTimeout(timer); timer = setTimeout(measure, 0); };
    // v96: фокус в поле — клавиатура уже поехала: с этого мига и считаем её ход; высоту знаем с прошлого раза — едем сразу
    const onIn = (e) => {
      if (textInput(e && e.target)) {
        kOpen = now();
        const o = kbRemembered(), r = rect();
        if (!pred && o && tgIos() && !last.up && r.width < 700 && Math.abs(o.w - r.width) <= 1 && Math.abs(o.h - KB_BASE.h) <= 2 && Math.abs(r.height - KB_BASE.h) <= 2) {
          pred = { k: o.k, w: r.width, until: kOpen + 700 };
          measure();
          clearTimeout(predT); predT = setTimeout(measure, 720);   // Telegram так и не сообщил (клавиатуры нет) — вернём, как было
        }
      }
      later();
    };
    // фокус ушёл не в другое поле — клавиатура уходит с этого мига
    const onOut = (e) => { if (!textInput(e && e.relatedTarget)) kClose = now(); later(); };
    // v95: Telegram сообщил высоту — окно он сожмёт через 0,4 с; перемерим и тогда, даже если об этом никто не скажет
    const onTg = () => { measure(); late.forEach(clearTimeout); late = [500, 1000].map((ms) => setTimeout(measure, ms)); };
    // прокрутку лент помним, пока окно не сменило высоту (события прокрутки не всплывают — ловим на погружении)
    const onScroll = (e) => { const s = e && e.target; try { if (s && s.hasAttribute && s.hasAttribute("data-kbm-scroll")) kept.set(s, snapOf(s)); } catch (er) { /* */ } };
    const root = ref && ref.current;
    if (root) root.addEventListener("scroll", onScroll, { capture: true, passive: true });
    if (vv) { vv.addEventListener("resize", measure); vv.addEventListener("scroll", measure); }
    window.addEventListener("resize", measure);
    document.addEventListener("focusin", onIn); document.addEventListener("focusout", onOut);
    try { if (tg && tg.onEvent) tg.onEvent("viewportChanged", onTg); } catch (e) { /* */ }
    // v95: слой стал ниже или выше (окно сжалось, клавиатура ушла) — пересчёт до отрисовки этого кадра, без событий окна
    try {
      const el = ref && ref.current;
      if (el && typeof ResizeObserver !== "undefined") {
        ro = new ResizeObserver(() => measure());
        try { ro.observe(el, { box: "border-box" }); } catch (e) { ro.observe(el); }
      }
    } catch (e) { ro = null; }
    measure();
    return () => {
      alive = false; clearTimeout(timer); clearTimeout(settle); clearTimeout(predT); late.forEach(clearTimeout); stop();
      if (ro) { try { ro.disconnect(); } catch (e) { /* */ } }
      if (root) root.removeEventListener("scroll", onScroll, { capture: true });
      if (vv) { vv.removeEventListener("resize", measure); vv.removeEventListener("scroll", measure); }
      window.removeEventListener("resize", measure);
      document.removeEventListener("focusin", onIn); document.removeEventListener("focusout", onOut);
      try { if (tg && tg.offEvent) tg.offEvent("viewportChanged", onTg); } catch (e) { /* */ }
      const el = ref && ref.current; if (el) { el.style.removeProperty("--kb"); el.style.removeProperty("--kbs"); }
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
      if (nh === h) return;
      h = nh;
      if (el.__kbH === nh) { el.__kbH = undefined; return; }   // v96: высоту сменила клавиатура — зазор до низа уже держит useKeyboardLift
      if (near) el.scrollTop = el.scrollHeight;
    });
    el.addEventListener("scroll", onScroll, { passive: true });
    ro.observe(el);
    return () => { ro.disconnect(); el.removeEventListener("scroll", onScroll); };
  }, []);   // eslint-disable-line react-hooks/exhaustive-deps
}
