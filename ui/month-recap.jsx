// ui/month-recap.jsx — Доп. 320: «Итоги месяца» — карточки подряд, как истории.
// Касание справа — дальше, слева — назад; карточки листаются и сами (кроме «меньше движения»).
// В конце — «Поделиться»: в Telegram (выбор чата), иначе системное «Поделиться» или копия текста.
// v31: рисунок на каждой карточке, сравнение с прошлым месяцем, подписи с числом («9 уроков»),
// шрифты приложения вместо системного, «Поделиться картинкой» (PNG; где нельзя отправить
// файлом — просмотр со «Скачать» и «нажми и удерживай»).
import React from "react";
import { createPortal } from "react-dom";
import { Candle, Ic, Wax } from "./table-bits";
import { ensureTableCss } from "./table-css";
import { monthRecap, recapShareText, plural, recapParts, compareLine } from "../lib/month-recap";
import { recapImage } from "../lib/recap-image";
import { vibrate } from "../lib/utils";

const SERIF = "'Piazzolla',Georgia,'Times New Roman',serif";
const BODY = "Georgia,'Times New Roman',serif";
const CSS = `
.mr{position:fixed;inset:0;z-index:1000;display:flex;flex-direction:column;color:#F3E9D2;font-family:${BODY};user-select:none;-webkit-user-select:none}
.mr-bg{position:absolute;inset:0;transition:background .5s}
.mr-top{position:relative;z-index:2;padding:max(14px,env(safe-area-inset-top,0px)) 14px 0}
.mr-bars{display:flex;gap:4px}
.mr-bars i{flex:1;height:3px;border-radius:2px;background:rgba(255,255,255,.22);overflow:hidden}
.mr-bars i b{display:block;height:100%;width:0;background:#F3E2B8}
.mr-bars i.done b{width:100%}
.mr-bars i.run b{animation:mrFill linear forwards}
.mr-bars i.run.hold b{animation-play-state:paused}
@keyframes mrFill{from{width:0}to{width:100%}}
.mr-hd{display:flex;align-items:center;gap:10px;margin-top:12px;font:12.5px ${BODY};color:rgba(243,233,210,.8)}
.mr-hd b{font-family:ui-monospace,Menlo,monospace;font-size:10.5px;letter-spacing:2px;color:#E8C56A;font-weight:400}
.mr-x{margin-left:auto;width:36px;height:36px;border-radius:50%;border:1px solid rgba(243,233,210,.3);background:rgba(0,0,0,.2);color:#F3E9D2;display:grid;place-items:center;cursor:pointer}
.mr-body{position:relative;z-index:1;flex:1;display:flex;flex-direction:column;justify-content:center;padding:18px 26px 30px;max-width:520px;width:100%;margin:0 auto;box-sizing:border-box}
.mr-ey{font-family:ui-monospace,Menlo,monospace;font-size:11px;letter-spacing:2.6px;color:#E8C56A;text-transform:uppercase}
.mr-big{font:700 64px/1 ${SERIF};margin:12px 0 6px;color:#FFF6E2}
.mr-h{font:600 28px/1.18 ${SERIF};margin:10px 0 6px;text-wrap:balance;color:#FFF6E2}
.mr-p{font:15.5px/1.5 ${BODY};color:rgba(243,233,210,.86);margin:6px 0 0}
.mr-cal{display:grid;grid-template-columns:repeat(7,1fr);gap:6px;margin-top:18px}
.mr-cal span{display:flex;flex-direction:column;align-items:center;justify-content:center;height:34px;border-radius:9px;background:rgba(255,255,255,.05);font:11px ${BODY};color:rgba(243,233,210,.55)}
.mr-cal span.on{background:rgba(232,197,106,.16)}
.mr-cal span.fr{background:rgba(143,176,214,.12)}
.mr-cal span.wk{background:transparent}
.mr-chips{display:flex;flex-wrap:wrap;gap:8px;margin-top:16px}
.mr-chips span{padding:7px 12px;border-radius:999px;border:1px solid rgba(243,233,210,.25);font:14px ${BODY};color:#F3E9D2}
.mr-chips span b{color:#E8C56A}
.mr-stamp{display:inline-block;margin-top:18px;padding:8px 16px;border:2px solid #E08A70;border-radius:8px;color:#F2A88E;font:700 13px ui-monospace,Menlo,monospace;letter-spacing:2px;transform:rotate(-4deg)}
.mr-nav{position:absolute;inset:0;z-index:0;display:flex}
.mr-nav button{flex:1;border:0;background:transparent;cursor:pointer}
.mr-nav button:first-child{flex:0 0 32%}
.mr-foot{position:relative;z-index:2;padding:0 20px calc(18px + env(safe-area-inset-bottom,0px));max-width:520px;width:100%;margin:0 auto;box-sizing:border-box}
.mr-btn{display:flex;align-items:center;justify-content:center;gap:9px;width:100%;min-height:52px;border-radius:999px;border:0;font:700 16px ${SERIF};color:#1A1008;background:linear-gradient(180deg,#F0D9A0,#C8A96E);cursor:pointer}
.mr-btn[disabled]{opacity:.6;cursor:default}
.mr-ghost{display:block;width:100%;padding:12px;border:0;background:none;color:rgba(243,233,210,.8);font:700 14px ${BODY};cursor:pointer}
.mr-sent{text-align:center;font:13px ${BODY};color:rgba(243,233,210,.85);margin:8px 0 0}
@media (prefers-reduced-motion: reduce){.mr-bars i.run b{animation:none;width:100%}}
.mr-art{width:88px;height:88px;margin:0 0 14px;color:#E8C56A;animation:mrArt .6s cubic-bezier(.2,1.3,.4,1) both}
.mr-art svg{width:100%;height:100%;overflow:visible}
.mr-art .candle{width:88px;height:88px}
@keyframes mrArt{from{opacity:0;transform:translateY(10px) scale(.86)}to{opacity:1;transform:none}}
.mr-chips span b{font-family:${SERIF}}
.mr-cmp{margin-top:16px;display:flex;flex-direction:column;gap:14px}
.mr-cmp .lb{font:13px ${BODY};color:rgba(243,233,210,.7);margin-bottom:5px}
.mr-cmp .br{display:flex;align-items:center;gap:10px;height:22px}
.mr-cmp .br i{display:block;height:12px;border-radius:6px;background:linear-gradient(90deg,#C8A96E,#F0D9A0);min-width:4px;transition:width .6s cubic-bezier(.3,1,.4,1)}
.mr-cmp .br.was i{background:rgba(243,233,210,.24)}
.mr-cmp .br span{font:700 15px ${SERIF};color:#FFF6E2;white-space:nowrap}
.mr-cmp .br.was span{font-weight:400;color:rgba(243,233,210,.62)}
.mr-cmp .br small{font:12px ${BODY};color:rgba(243,233,210,.5);margin-left:2px}
.mr-delta{display:inline-block;margin-top:14px;padding:6px 12px;border-radius:999px;font:700 13px ${BODY};background:rgba(232,197,106,.16);color:#F0D9A0}
.mr-delta.eq{background:rgba(255,255,255,.08);color:rgba(243,233,210,.8)}
.mr-delta.down{background:rgba(143,176,214,.14);color:#BFD3EA}
.mr-row2{display:flex;gap:8px;margin-top:8px}
.mr-row2 .mr-ghost{flex:1;border:1px solid rgba(243,233,210,.24);border-radius:999px;padding:11px}
.mr-pv{position:fixed;inset:0;z-index:1002;background:#0D0905;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;padding:max(18px,env(safe-area-inset-top,0px)) 18px calc(18px + env(safe-area-inset-bottom,0px));box-sizing:border-box}
.mr-pv img{max-width:100%;max-height:68vh;border-radius:14px;box-shadow:0 18px 50px rgba(0,0,0,.55);-webkit-touch-callout:default;user-select:auto;-webkit-user-select:auto}
.mr-pv p{margin:0;text-align:center;font:13.5px/1.45 ${BODY};color:rgba(243,233,210,.82);max-width:360px}
.mr-pv a.mr-btn{text-decoration:none;max-width:360px}
.mr-pv .mr-ghost{max-width:360px}
@media (prefers-reduced-motion: reduce){.mr-art{animation:none}.mr-cmp .br i{transition:none}}
`;
let cssOn = false;
function ensureCss() { ensureTableCss(); if (cssOn || typeof document === "undefined" || !document.head || !document.createElement) return; cssOn = true; const st = document.createElement("style"); st.id = "sa-month-css"; st.textContent = CSS; document.head.appendChild(st); }
const BG = [
  "radial-gradient(120% 80% at 20% 10%,#5A3E18 0%,#1E150A 60%,#120C05 100%)",
  "radial-gradient(120% 80% at 80% 0%,#3D4A2A 0%,#18160C 62%,#0E0C06 100%)",
  "radial-gradient(120% 80% at 10% 90%,#5A2A1A 0%,#1E120A 60%,#120A05 100%)",
  "radial-gradient(120% 80% at 90% 80%,#2A3A52 0%,#141418 60%,#0B0B0E 100%)",
  "radial-gradient(120% 80% at 50% 0%,#6A4C16 0%,#20170A 60%,#120C05 100%)",
];
const reduced = () => { try { return !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches); } catch (e) { return false; } };
const DOW = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];
const SHOW = 6500;

// v31: рисунок карточки — линией, золотом приложения
const STROKE = { fill: "none", stroke: "currentColor", strokeWidth: 1.6, strokeLinecap: "round", strokeLinejoin: "round" };
function Art({ k, r }) {
  if (k === "days" || k === "end") return <div className="mr-art" aria-hidden="true"><Candle s={88} lit /></div>;
  if (k === "quest") return <div className="mr-art" aria-hidden="true"><Wax s={88} /></div>;
  let g = null;
  if (k === "cover") g = <g {...STROKE}><rect x="10" y="14" width="44" height="40" rx="5" /><path d="M10 25h44M21 9v9M43 9v9" /><text x="32" y="47" textAnchor="middle" fontSize="17" fontFamily={SERIF} fontWeight="700" fill="currentColor" stroke="none">{r ? r.month : ""}</text></g>;
  else if (k === "steps") g = <g {...STROKE}><path d="M8 54h12V43h12V32h12V21h12" /><path d="M8 54h48" opacity=".45" /><circle cx="50" cy="12" r="3.2" fill="currentColor" stroke="none" /></g>;
  else if (k === "cmp") {
    const was = r && r.prev ? r.prev.st : 0, cur = r ? r.totals.st : 0, mx = Math.max(1, was, cur);
    const hw = 40 * (was / mx), hc = 40 * (cur / mx);
    g = <g><path d="M8 54h48" {...STROKE} opacity=".45" /><rect x="15" y={52 - hw} width="13" height={Math.max(2, hw)} rx="3" fill="currentColor" opacity=".3" /><rect x="36" y={52 - hc} width="13" height={Math.max(2, hc)} rx="3" fill="currentColor" /></g>;
  }
  else if (k === "best") g = <g {...STROKE}><path d="M32 12l5.6 11.4 12.6 1.8-9.1 8.9 2.1 12.5L32 40.7l-11.2 5.9 2.1-12.5-9.1-8.9 12.6-1.8z" /><path d="M14 52c6 3 12 4 18 4s12-1 18-4" opacity=".55" /></g>;
  else if (k === "guest") g = <g {...STROKE}><circle cx="32" cy="34" r="15" /><circle cx="32" cy="34" r="9" opacity=".5" /><circle cx="32" cy="11" r="4.5" /><path d="M10 34h-4M58 34h-4" opacity=".55" /><path d="M24 52l-3 6M40 52l3 6" opacity=".55" /></g>;
  else if (k === "topics") g = <g {...STROKE}><path d="M20 8h24l-1.6 15a10.4 10.4 0 0 1-20.8 0z" /><path d="M21.5 18h21" opacity=".55" /><path d="M32 33.5V52M23 55h18" /></g>;
  if (!g) return null;
  return <div className="mr-art" aria-hidden="true"><svg viewBox="0 0 64 64">{g}</svg></div>;
}

export function MonthRecap({ a11y, profile, data, month, shareUrl = "", onClose, inline = false }) {
  ensureCss();
  const r = React.useMemo(() => monthRecap({ ...(data || {}), month }), [data, month]);
  const t = r.totals;
  const cards = [];
  cards.push({ k: "cover", body: <>
    <Art k="cover" r={r} />
    <div className="mr-ey">{r.current ? "месяц в разгаре" : "итоги месяца"}</div>
    <h2 className="mr-h" style={{ fontSize: 40 }}>{r.title}{r.current ? " — пока" : ""} в академии</h2>
    <p className="mr-p">{profile ? [profile.name, profile.surname].filter(Boolean).join(" ") : ""}{profile && profile.restaurant ? " · " + profile.restaurant : ""}</p>
    <p className="mr-p" style={{ marginTop: 18 }}>Листай карточки — касание справа, дальше само.</p>
  </> });
  const first = (new Date(r.year, r.month - 1, 1).getDay() + 6) % 7;
  cards.push({ k: "days", body: <>
    <Art k="days" />
    <div className="mr-ey">дни в деле</div>
    <div className="mr-big">{r.active}</div>
    <p className="mr-p">{plural(r.active, "день", "дня", "дней")} из {r.current ? r.upto : r.daysIn} {r.current ? "прошедших" : ""}{r.off ? " · выходных по графику " + r.off + " — серия в них не гаснет" : ""}</p>
    <div className="mr-cal" role="img" aria-label={"Календарь: в деле " + r.active + " дней"}>
      {DOW.map((d) => <span key={d} className="wk">{d}</span>)}
      {Array.from({ length: first }, (_, i) => <span key={"e" + i} className="wk" />)}
      {r.calendar.map((c) => <span key={c.d} className={c.state === 2 ? "on" : c.state === 1 ? "fr" : undefined}>{c.state === 2 ? <Candle s={16} lit /> : c.state === 1 ? <Ic n="snow" s={13} /> : null}<small>{c.d}</small></span>)}
    </div>
  </> });
  // v31: подпись согласуется с числом — «9 уроков», «1 тест»
  const parts = recapParts(t);
  cards.push({ k: "steps", body: <>
    <Art k="steps" />
    <div className="mr-ey">шаги обучения</div>
    <div className="mr-big">{t.st}</div>
    <p className="mr-p">{t.st ? plural(t.st, "шаг", "шага", "шагов") + " за " + r.title.toLowerCase() + " · " + r.points + " " + plural(r.points, "очко", "очка", "очков") + " лиги" : "в этом месяце пока тихо — первый шаг всё изменит"}</p>
    {parts.length ? <div className="mr-chips">{parts.map((p) => <span key={p.k}><b>{p.n}</b> {p.word}</span>)}</div> : null}
  </> });
  // v31: сравнение с прошлым месяцем
  const cmp = compareLine(r);
  if (r.prev && cmp) {
    const pv = r.prev;
    const rows = [["Дни в деле", r.active, pv.active], ["Шаги", t.st, pv.st], ["Очки лиги", r.points, pv.points]];
    const w = (v, a, b) => Math.round(100 * (Number(v) || 0) / Math.max(1, a, b)) + "%";
    cards.push({ k: "cmp", body: <>
      <Art k="cmp" r={r} />
      <div className="mr-ey">{pv.partial ? "к " + r.upto + "-му числу" : "к прошлому месяцу"}</div>
      <h2 className="mr-h">{cmp.title}</h2>
      <div className="mr-cmp" role="img" aria-label={rows.map((x) => x[0] + ": " + x[1] + " против " + x[2]).join("; ")}>
        {rows.map((x) => <div key={x[0]}>
          <div className="lb">{x[0]}</div>
          <div className="br"><i style={{ width: w(x[1], x[1], x[2]) }} /><span>{x[1]}</span><small>{r.title.toLowerCase()}</small></div>
          <div className="br was"><i style={{ width: w(x[2], x[1], x[2]) }} /><span>{x[2]}</span><small>{pv.title.toLowerCase()}</small></div>
        </div>)}
      </div>
      {cmp.d ? <span className={"mr-delta " + cmp.tone}>{(cmp.d > 0 ? "+" : "−") + Math.abs(cmp.d) + " " + plural(Math.abs(cmp.d), "шаг", "шага", "шагов")}</span> : <span className="mr-delta eq">столько же шагов</span>}
      {pv.partial ? <p className="mr-p" style={{ marginTop: 10 }}>Сравниваем одинаковые отрезки: 1–{r.upto} {r.gen} и 1–{pv.upto} {pv.gen}.</p> : null}
    </> });
  }
  if (r.best || r.longest > 1) cards.push({ k: "best", body: <>
    <Art k="best" />
    <div className="mr-ey">лучшее</div>
    {r.best ? <><h2 className="mr-h">{r.best.label}</h2><p className="mr-p">лучший день: {r.best.steps} {plural(r.best.steps, "шаг", "шага", "шагов")}</p></> : null}
    {r.longest > 1 ? <><div className="mr-big" style={{ marginTop: 26 }}>{r.longest}</div><p className="mr-p">{plural(r.longest, "день", "дня", "дней")} подряд — самая длинная серия месяца</p></> : null}
  </> });
  if (r.guests.n) cards.push({ k: "guest", body: <>
    <Art k="guest" />
    <div className="mr-ey">живой гость</div>
    <div className="mr-big">{r.guests.n}</div>
    <p className="mr-p">{plural(r.guests.n, "гость обслужен", "гостя обслужено", "гостей обслужено")}{r.guests.best ? " · лучший чек разбора — " + r.guests.best + " из 5" : ""}</p>
  </> });
  if (r.gold || r.credits || t.u) cards.push({ k: "topics", body: <>
    <Art k="topics" />
    <div className="mr-ey">темы</div>
    <h2 className="mr-h">{r.gold ? "Золотых тем: " + r.gold : t.u ? "Освежено тем: " + t.u : "Зачтено по опыту: " + r.credits}</h2>
    <div className="mr-chips">
      {r.gold ? <span><b>{r.gold}</b> {plural(r.gold, "золотая тема", "золотые темы", "золотых тем")} ✦</span> : null}
      {t.u ? <span><b>{t.u}</b> {plural(t.u, "тема освежена", "темы освежены", "тем освежено")}</span> : null}
      {r.credits ? <span><b>{r.credits}</b> {plural(r.credits, "зачёт на опыт", "зачёта на опыт", "зачётов на опыт")}</span> : null}
    </div>
  </> });
  if (r.quests) cards.push({ k: "quest", body: <>
    <Art k="quest" />
    <div className="mr-ey">квест смены</div>
    <div className="mr-big">{r.quests}</div>
    <p className="mr-p">{plural(r.quests, "раз", "раза", "раз")} смена закрыла квест вместе</p>
    <div className="mr-stamp">✦ СМЕНА ОТРАБОТАНА ✦</div>
  </> });
  cards.push({ k: "end", body: <>
    <Art k="end" />
    <div className="mr-ey">{r.current ? "месяц продолжается" : "до встречи в новом месяце"}</div>
    <h2 className="mr-h" style={{ fontSize: 34 }}>Спасибо за {r.title.toLowerCase()} ✦</h2>
    <p className="mr-p">{r.active ? "Каждый день в деле — это гость, которого ты обслужишь чуть лучше." : "Новый месяц — новая свеча. Начни с разминки или урока."}</p>
  </> });

  const [i, setI] = React.useState(0);
  const [hold, setHold] = React.useState(false);
  const [sent, setSent] = React.useState("");
  const last = i >= cards.length - 1;
  React.useEffect(() => {
    if (last || hold || reduced()) return undefined;
    const tm = setTimeout(() => setI((x) => Math.min(x + 1, cards.length - 1)), SHOW);
    return () => clearTimeout(tm);
  }, [i, hold, last, cards.length]);
  const go = (d) => { vibrate("light"); setSent(""); setI((x) => Math.max(0, Math.min(cards.length - 1, x + d))); };
  const share = () => {
    const name = profile && profile.name;
    const text = recapShareText(r, name);
    try {
      const tg = window.Telegram && window.Telegram.WebApp;
      if (tg && tg.initData && typeof tg.openTelegramLink === "function") { tg.openTelegramLink("https://t.me/share/url?url=" + encodeURIComponent(shareUrl || "") + "&text=" + encodeURIComponent(text)); setSent("Выбери чат в Telegram"); return; }
    } catch (e) {}
    const full = text + (shareUrl ? "\n" + shareUrl : "");
    const copy = () => { try { navigator.clipboard.writeText(full).then(() => setSent("Текст скопирован"), () => setSent("Не получилось скопировать — сделай снимок экрана")); } catch (e) { setSent("Не получилось скопировать — сделай снимок экрана"); } };
    try { if (navigator.share) { navigator.share({ text: full }).then(() => setSent("Отправлено"), (e) => { if (!(e && e.name === "AbortError")) copy(); }); return; } } catch (e) {}
    copy();
  };
  // v31: «Поделиться картинкой». Картинку рисуем заранее, как только открылась последняя
  // карточка: системное «Поделиться» с файлом работает только сразу по нажатию.
  const [pic, setPic] = React.useState(null);     // { blob, name }
  const [pv, setPv] = React.useState(null);       // { url, name } — просмотр со «Скачать»
  const [busy, setBusy] = React.useState(false);
  const who = profile ? { name: profile.name, surname: profile.surname, restaurant: profile.restaurant } : {};
  const picName = "itogi-" + r.key + ".png";
  React.useEffect(() => {
    if (!last || pic) return undefined;
    let dead = false;
    recapImage(r, who).then((blob) => { if (!dead && blob) setPic({ blob, name: picName }); }).catch(() => {});
    return () => { dead = true; };
  }, [last]);   // eslint-disable-line react-hooks/exhaustive-deps
  React.useEffect(() => () => { if (pv && pv.url) { try { URL.revokeObjectURL(pv.url); } catch (e) {} } }, [pv]);
  const preview = (blob) => { try { setPv({ url: URL.createObjectURL(blob), name: picName }); } catch (e) { setSent("Картинка не открылась — поделись текстом"); } };
  const sharePic = () => {
    if (busy) return;
    setSent("");
    const send = (blob) => {
      let file = null;
      try { file = new File([blob], picName, { type: "image/png" }); } catch (e) {}
      let can = false;
      try { can = !!(file && navigator.share && navigator.canShare && navigator.canShare({ files: [file] })); } catch (e) {}
      if (!can) { preview(blob); return; }
      navigator.share({ files: [file], title: "Итоги: " + r.title.toLowerCase() }).then(() => setSent("Отправлено"), (e) => {
        if (!(e && e.name === "AbortError")) preview(blob);
      });
    };
    if (pic) { vibrate("light"); send(pic.blob); return; }
    setBusy(true);
    recapImage(r, who).then((blob) => {
      setBusy(false);
      if (!blob) { setSent("Картинка не получилась — поделись текстом"); return; }
      setPic({ blob, name: picName });
      preview(blob);   // время нажатия уже ушло — сразу просмотр, оттуда «Скачать» или «Поделиться»
    }, () => { setBusy(false); setSent("Картинка не получилась — поделись текстом"); });
  };
  const pvShare = () => {
    if (!pic) return;
    let file = null;
    try { file = new File([pic.blob], picName, { type: "image/png" }); } catch (e) {}
    try { if (file && navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) navigator.share({ files: [file] }).catch(() => {}); } catch (e) {}
  };
  const canFiles = (() => { try { return !!(typeof navigator !== "undefined" && navigator.canShare && typeof File !== "undefined" && navigator.canShare({ files: [new File([""], "a.png", { type: "image/png" })] })); } catch (e) { return false; } })();
  const el = (
    <div className="mr tbv" role="dialog" aria-modal="true" aria-label={"Итоги месяца: " + r.title}>
      <div className="mr-bg" style={{ background: BG[i % BG.length] }} />
      <div className="mr-top">
        <div className="mr-bars" aria-hidden="true">{cards.map((c, k) => <i key={c.k} className={k < i ? "done" : k === i ? "run" + (hold || last ? " hold" : "") : undefined}><b style={k === i ? { animationDuration: SHOW + "ms" } : undefined} /></i>)}</div>
        <div className="mr-hd"><b>✦ ИТОГИ · {r.title.toUpperCase()}</b><span>{i + 1} / {cards.length}</span>
          <button type="button" className="mr-x" data-sa-back={pv ? undefined : ""} aria-label="Закрыть" onClick={onClose}><Ic n="x" s={16} /></button></div>
      </div>
      <div className="mr-nav" onPointerDown={() => setHold(true)} onPointerUp={() => setHold(false)} onPointerCancel={() => setHold(false)} onPointerLeave={() => setHold(false)}>
        <button type="button" aria-label="Назад" onClick={() => go(-1)} />
        <button type="button" aria-label="Дальше" onClick={() => go(1)} />
      </div>
      <div className="mr-body" key={cards[i].k} aria-live="polite" style={{ pointerEvents: "none" }}>{cards[i].body}</div>
      <div className="mr-foot">
        {last ? <>
          <button type="button" className="mr-btn" data-recap-pic="" onClick={sharePic} disabled={busy}><Ic n="share" s={18} />{busy ? "Рисуем картинку…" : "Поделиться картинкой"}</button>
          <div className="mr-row2">
            <button type="button" className="mr-ghost" data-recap-text="" onClick={share}>Поделиться текстом</button>
          </div>
          {sent ? <p className="mr-sent" role="status">{sent}</p> : null}
          <button type="button" className="mr-ghost" onClick={onClose}>Закрыть</button>
        </> : <button type="button" className="mr-ghost" onClick={() => go(1)}>Дальше ›</button>}
      </div>
    </div>
  );
  const pvEl = pv ? (
    <div className="mr-pv" role="dialog" aria-modal="true" aria-label="Итоги месяца картинкой" data-recap-preview="">
      <img src={pv.url} alt={"Итоги месяца: " + r.title} />
      <a className="mr-btn" href={pv.url} download={pv.name}>Скачать картинку</a>
      {canFiles ? <button type="button" className="mr-ghost" onClick={pvShare}>Поделиться…</button> : null}
      <p>Или нажми и удерживай картинку — «Сохранить» или «Поделиться». В Telegram её можно отправить из галереи.</p>
      <button type="button" className="mr-ghost" data-sa-back="" onClick={() => setPv(null)}>Готово</button>
    </div>
  ) : null;
  if (inline) return <>{el}{pvEl}</>;
  return <>{createPortal(el, document.body)}{pvEl ? createPortal(pvEl, document.body) : null}</>;
}

export default MonthRecap;
