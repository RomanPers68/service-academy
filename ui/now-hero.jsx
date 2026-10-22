// ui/now-hero.jsx — v68 (Доп. 381): главная карточка «Приглашение».
// Владелец просил главный экран «удобнее и чтобы глазу приятно». Из показанных вариантов выбрал «Приглашение» —
// карточку как приглашение в хороший ресторан: плотная бумага, отрывной корешок с полукруглыми вырезами по линии
// отрыва, на корешке — кнопка. «Белая — для светлой темы, тёмная — для тёмной»:
//   светлая «Для чтения» — белая бумага с золотой рамкой, на корешке — сургучная печать;
//   тёмная               — чёрная карта с золотым тиснением; на корешке — линза, как кнопка AI в нижнем меню
//                          (владелец: «сделаем его линзой, как кнопка AI»), под ней — «Начать».
// Карточка одна на все случаи: до смены — разминка, на смене — ошибки или SOS, после смены — «как прошла?»,
// после перерыва — «С возвращением», ответ на «как прошла» — разбор с Наставником; в обычный день (без «сейчас») —
// приглашение к следующему шагу трека (mode: "track"). Нижние строки — «Дальше» (следующий урок), «Разминка» и
// «Шаг дня» (в обычный день); вся карточка и корешок — одно нажатие.
import React from "react";
import { onActivate, vibrate } from "../lib/utils";
import { UI_SVG } from "./icons";
import { faceIcon } from "./icons-extra";
import { MOOD_FACES } from "./mood-cards";
import { hhmm, untilText } from "../lib/now-card";
import { ACCENT_SERIF } from "./styles";
import { GOLD } from "./tokens";

function useActs({ ctx, on, onReplyDone }) {
  const act = () => {
    if (!on) return;
    vibrate("light");
    if (ctx.action === "warmup") on.warmup();
    else if (ctx.action === "mistakes") on.mistakes();
    else if (ctx.action === "sos") on.sos();
    else if (ctx.action === "ask") { on.ask(ctx.ask); if (onReplyDone) onReplyDone(); }
    else if (ctx.action === "go" && on.go) on.go();
  };
  const stop = (fn) => (e) => { if (e && e.stopPropagation) e.stopPropagation(); fn(); };
  const key = (fn) => (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.stopPropagation(); fn(); } };
  const later = () => { if (onReplyDone) onReplyDone(); };
  return { act, stop, key, later, tappable: ctx.action !== "mood" };
}

// Надпись над заголовком — обычными буквами: «До смены 26 мин», «На смене до 24:00», «Смена позади», «С возвращением»;
// в обычный день — трек и сколько пройдено («Хостес · пройдено 8%»)
export function nowLead(ctx) {
  if (!ctx) return "";
  if (ctx.mode === "before" && ctx.mins != null) return "До смены " + untilText(ctx.mins);
  if (ctx.mode === "during" && ctx.to != null) return "На смене до " + hhmm(ctx.to);
  if (ctx.mode === "after") return "Смена позади";
  if (ctx.mode === "reply") return "Смена позади ✓";
  if (ctx.mode === "back") return "С возвращением";
  if (ctx.mode === "track") return ctx.lead || "";
  const t = String(ctx.tag || "").toLowerCase();
  return t ? t.charAt(0).toUpperCase() + t.slice(1) : "";
}

const ICON = { warmup: "clock", mistakes: "target", sos: "bulb", ask: "sparkle", mood: "moon", go: "sparkle" };
// значок на корешке: имя значка (UI_SVG) или своя отрисовка (c, s) => svg — в обычный день это значок роли
const glyph = (icon, c, s) => (typeof icon === "function" ? icon(c, s) : UI_SVG[icon] ? UI_SVG[icon](c, s) : null);

function Moods({ color, sub, onMood, stop, size = 28 }) {
  return (
    <div data-now-moods="" style={{ display: "flex", justifyContent: "space-between", gap: 2 }}>
      {MOOD_FACES.map((m) => (
        <button key={m.lvl} type="button" className="sa-btn" aria-label={m.l} onClick={stop(() => { if (onMood) onMood(m.lvl); })}
          style={{ flex: 1, minWidth: 0, background: "transparent", border: 0, padding: "4px 0", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
          {faceIcon(m.lvl, color, size)}
          <span style={{ fontSize: 11, color: sub, whiteSpace: "nowrap", fontFamily: "Georgia, serif" }}>{m.l}</span>
        </button>
      ))}
    </div>
  );
}

// Сургучная печать — как в «Книге отзывов» (ui/screens-roleselect.jsx WaxSealMini), крупнее и со значком
const WAX = "M12 1.9c2.3-.3 4.5.7 6.1 2.2 1.6 1.5 2.9 3.5 3.5 5.6.6 2.2.2 4.6-1 6.5-1.1 1.9-3 3.5-5.1 4.4-2.1.9-4.6 1-6.7.1-2.1-.8-3.9-2.5-5-4.5-1.1-2-1.5-4.4-.9-6.6C3.5 7.4 5 5.4 6.9 4 8.4 2.9 10.2 2.1 12 1.9Z";
let waxSeq = 0;
function WaxSeal({ size = 50, icon = "clock" }) {
  const id = React.useMemo(() => "nhw" + (++waxSeq), []);
  return (
    <span aria-hidden="true" data-now-seal="" style={{ position: "relative", width: size, height: size, display: "inline-grid", placeItems: "center", flexShrink: 0, filter: "drop-shadow(0 2px 2px rgba(60,20,8,0.45))" }}>
      <svg width={size} height={size} viewBox="0 0 24 24" style={{ position: "absolute", inset: 0, transform: "rotate(-8deg)" }}>
        <defs><radialGradient id={id} cx="35%" cy="30%" r="75%"><stop offset="0%" stopColor="#C9583A" /><stop offset="45%" stopColor="#9A3520" /><stop offset="80%" stopColor="#702415" /><stop offset="100%" stopColor="#541809" /></radialGradient></defs>
        <path d={WAX} fill={`url(#${id})`} />
        <circle cx="12" cy="12" r="7.3" fill="none" stroke="rgba(58,12,4,0.7)" strokeWidth="1.1" />
        <ellipse cx="8.6" cy="6.6" rx="3" ry="1.6" fill="rgba(255,235,210,0.26)" transform="rotate(-28 8.6 6.6)" />
      </svg>
      <span style={{ position: "relative", display: "inline-flex" }}>{glyph(icon, "#F4DDBC", Math.round(size * 0.4))}</span>
    </span>
  );
}

// Линза — то же стекло, что у кнопки AI в нижнем меню (ui/tabbar.jsx AiDisc): золотая кромка, изморозь изнутри,
// блик сверху, и тонкое золотое кольцо вокруг. v69 (Доп. 382), владелец: «не кажется, что она слишком тёмная?» —
// кнопка AI стоит на стеклянной панели меню, линза — на чёрной карте, и то же стекло выходило темнее. Под стеклом
// теперь тон панели меню (на телефоне владельца — rgb 33,30,23): линза такой же светлоты, как кнопка AI на экране.
const LENS_BASE = "#221E16";
function Lens({ size = 44, icon = "clock" }) {
  return (
    <span aria-hidden="true" data-now-lens="" style={{ position: "relative", width: size, height: size, borderRadius: "50%", display: "grid", placeItems: "center", flexShrink: 0,
      background: "linear-gradient(rgba(200,169,110,0.12), rgba(200,169,110,0.12)), " + LENS_BASE,
      boxShadow: "inset 0 0 0 1px rgba(214,178,102,0.45), inset 0 0 18px rgba(255,230,170,0.12), inset 0 1.5px 0 rgba(255,255,255,0.18)" }}>
      <span style={{ position: "absolute", inset: -4, borderRadius: "50%", border: "1.5px solid " + GOLD, pointerEvents: "none" }} />
      {glyph(icon, GOLD, Math.round(size * 0.46))}
    </span>
  );
}

// лёгкая фактура бумаги: шум поверх цвета, едва заметный
const GRAIN = "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 0.35  0 0 0 0 0.25  0 0 0 0 0.1  0 0 0 .55 0'/></filter><rect width='160' height='160' filter='url(%23n)' opacity='.22'/></svg>\")";
// золотое тиснение заголовка на чёрной карте
const FOIL = { background: "linear-gradient(180deg,#F8E8BE 0%,#DDBD7F 48%,#A9833F 100%)", WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent" };
const STUB = 100;
// полукруглые вырезы по линии отрыва — настоящие (маска): сквозь них видно фон экрана
const CUT = `radial-gradient(circle at calc(100% - ${STUB}px) 0, transparent 9px, #000 9.5px) top / 100% 51% no-repeat, radial-gradient(circle at calc(100% - ${STUB}px) 100%, transparent 9px, #000 9.5px) bottom / 100% 51% no-repeat`;
// v69 (Доп. 382): без CSS filter. Владелец заметил мерцание: на iPhone карточка с filter (тень и золотая кромка) под
// маской перерисовывалась после анимации появления. Теперь тень — у подложки (box-shadow), кромка — у самой карточки
// (inset), вокруг вырезов — кольцами в фоне; на вид — как было
const notchRim = (c) => [0, 100].map((y) => `radial-gradient(circle at calc(100% - ${STUB}px) ${y}%, transparent 9.1px, ${c} 9.6px, ${c} 10.3px, transparent 10.9px)`).join(", ");

// rows — нижние строки: [{ key, label: "Дальше:", title, onClick }]; foot — подсказка под карточкой (напоминания в Telegram)
// fade — мягкое появление: только когда состояние сменилось на открытом экране (ответ на «как прошла», началась
// смена). v69 (Доп. 382): при возврате на главную карточка проявлялась второй раз поверх появления всей страницы —
// позже остального экрана («мерцание», запись владельца)
export function NowInvitation({ refEl, ctx, a11y, rows = [], foot = null, on, onMood, onReplyDone, fade = false }) {
  const { act, stop, key, later, tappable } = useActs({ ctx, on, onReplyDone });
  const dark = !a11y;
  const P = dark
    ? { ink: "#EFE4C8", sub: "#A99B7E", lead: "#C8A96E", gold: "#D9B87C", perf: "2px dotted rgba(214,178,102,0.45)", rowLine: "1px dashed rgba(214,178,102,0.30)",
        frame: "rgba(214,178,102,0.42)", bg: "radial-gradient(120% 90% at 20% 0%, rgba(214,178,102,0.10), transparent 60%), linear-gradient(160deg,#211809 0%,#0D0904 58%,#171009 100%)",
        rim: "rgba(214,178,102,0.38)", shadow: "0 10px 16px rgba(0,0,0,0.6)" }
    : { ink: "#2A1F0E", sub: "#6E5A38", lead: "#8A6524", gold: "#8A6524", perf: "2px dashed rgba(122,93,42,0.38)", rowLine: "1px dashed rgba(122,93,42,0.38)",
        frame: "rgba(139,106,48,0.42)", bg: GRAIN + ", linear-gradient(180deg,#FFFDF8 0%,#F7EEDC 100%)",
        rim: null, shadow: "0 5px 12px rgba(120,85,25,0.20)" };
  const mood = ctx.action === "mood";
  const icon = ctx.glyph || ICON[ctx.action] || ctx.icon || "clock";
  const list = (rows || []).filter((r) => r && r.title);
  return (
    <div className="tbv">
      <div ref={refEl} data-now-card={ctx.mode} data-hero={dark ? "black" : "paper"} className={fade ? "sa-fadein" : undefined} onClick={tappable ? act : undefined} {...(tappable ? onActivate(act) : {})}
        aria-label={tappable ? [nowLead(ctx), ctx.title, ctx.cta].filter(Boolean).join(". ") : undefined}
        style={{ position: "relative", cursor: tappable ? "pointer" : "default" }}>
        <span aria-hidden="true" data-now-shadow="" style={{ position: "absolute", inset: 0, borderRadius: 16, boxShadow: P.shadow, pointerEvents: "none" }} />
        <div style={{ position: "relative", display: "flex", borderRadius: 16, background: (P.rim ? notchRim(P.rim) + ", " : "") + P.bg,
          boxShadow: P.rim ? "inset 0 0 0 1px " + P.rim : undefined, WebkitMask: CUT, mask: CUT, minHeight: 124 }}>
          <span aria-hidden="true" style={{ position: "absolute", inset: 5, borderRadius: 12, border: "1px solid " + P.frame, pointerEvents: "none" }} />
          <div style={{ flex: 1, minWidth: 0, padding: "15px 12px 12px 18px", display: "flex", flexDirection: "column" }}>
            <div data-now-tag="" style={{ fontFamily: "Georgia, serif", fontStyle: "italic", fontSize: 13, color: P.lead }}>{nowLead(ctx)}</div>
            <div data-now-title="" style={{ fontFamily: ACCENT_SERIF, fontSize: "clamp(18px, 4.9vw, 21px)", lineHeight: 1.15, marginTop: 2, ...(dark ? FOIL : { color: P.ink }) }}>{ctx.title}</div>
            {mood ? <div style={{ marginTop: 8 }}><Moods color={P.gold} sub={P.sub} onMood={onMood} stop={stop} /></div>
              : ctx.sub ? <div data-now-sub="" style={{ fontFamily: "Georgia, serif", fontSize: 12.5, color: P.sub, marginTop: 4, lineHeight: 1.35 }}>{ctx.sub}</div> : null}
            {ctx.mode === "reply" ? <span role="button" tabIndex={0} data-now-later="" onClick={stop(later)} onKeyDown={key(later)}
              style={{ marginTop: 6, fontSize: 12.5, color: P.sub, textDecoration: "underline", textUnderlineOffset: 3, cursor: "pointer", alignSelf: "flex-start" }}>Не сейчас</span> : null}
            {list.length ? (
              <div style={{ marginTop: "auto", paddingTop: 8 }}>
                {list.map((r, i) => (
                  <div key={r.key || i} data-now-next={r.key === "next" ? "" : undefined} data-now-row={r.key || ""} role="button" tabIndex={0}
                    onClick={stop(() => { vibrate("light"); if (r.onClick) r.onClick(); })} onKeyDown={key(() => { if (r.onClick) r.onClick(); })}
                    style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", fontFamily: "Georgia, serif", fontSize: 12.5, color: P.sub,
                      padding: i ? "6px 0 0" : "8px 0 0", borderTop: i ? "none" : P.rowLine }}>
                    <span style={{ whiteSpace: "nowrap" }}>{r.label}</span>
                    <span style={{ flex: 1, minWidth: 0, color: P.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.title}</span>
                    <span aria-hidden="true" style={{ color: P.gold, fontSize: 16, lineHeight: 1 }}>›</span>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
          <span aria-hidden="true" style={{ width: 0, borderLeft: P.perf, margin: "14px 0" }} />
          <div data-now-stub="" style={{ width: STUB - 2, flexShrink: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: dark ? 9 : 5, padding: "12px 4px" }}>
            {dark ? <Lens size={44} icon={icon} /> : <WaxSeal size={50} icon={icon} />}
            {ctx.cta ? <span data-now-cta="" style={dark ? { fontFamily: "Georgia, serif", fontWeight: "bold", fontSize: 14.5, color: P.ink, marginTop: 1 }
              : { fontFamily: ACCENT_SERIF, fontWeight: 700, fontSize: 16, color: P.ink, marginTop: 2 }}>{ctx.cta}</span> : null}
            {ctx.action === "warmup" ? <span style={{ fontFamily: "Georgia, serif", fontSize: 11.5, color: P.sub, marginTop: dark ? -5 : 0 }}>2 мин</span> : null}
          </div>
        </div>
      </div>
      {foot ? <div onClick={(e) => e.stopPropagation()} style={{ padding: "7px 6px 0" }}>{foot}</div> : null}
    </div>
  );
}
