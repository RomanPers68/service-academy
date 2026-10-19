// ui/together.jsx — v30: «Квест смены» (Доп. 314) и «Свеча на двоих» (Доп. 318). v31 — доработки.
//
// QuestCard — на вкладке «Смена»: общая цель для тех, кто сегодня в графике заведения (сервер,
//             этап 24), вклад каждого и «твоя часть» — три личных задания на день.
//             v31: компактно (люди — одной строкой, раскрываются), вклад каждого — цветными долями
//             в шкалах, печать «Смена отработана» опускается один раз, «Спасибо команде», старшему —
//             кто ещё не начал и «Позвать на разминку» (сообщение в Telegram, этап 25).
// PairSheet — «Свеча на двоих»: общая серия с напарником или наставником. v31: две большие свечи —
//             когда горят обе, пламя общее; неделя — подписанными строками; «Подтолкнуть» (одно
//             сообщение в Telegram в день); вехи 7, 30 и 100 дней. Без пары — приглашения и выбор.
// Лениво: грузится вместе с вкладкой, приложению на старте не нужен.
import React from "react";
import { rpc, saToken, rpcMissing } from "../api/supabase";
import { Candle, Ic } from "./table-bits";
import { ensureTableCss } from "./table-css";
import { frostOf } from "./home-hubs";
import { vibrate, onActivate } from "../lib/utils";
import { SkelLines } from "./skeleton";   // v55 (Доп. 368): силуэты вместо «Загрузка…»
import { taskProgress, goalLine, plural, GOAL_WORDS } from "../lib/quest";
import { serverMissing } from "../lib/server-text";   // v58 (Доп. 371)

const SERIF = "'Piazzolla',Georgia,'Times New Roman',serif";
const BODY = "Georgia,'Times New Roman',serif";
const CSS = `
.tg-tag{font-family:ui-monospace,Menlo,monospace;font-size:10.5px;letter-spacing:1.6px;color:#D2A85A}
html.sa-light .tg-tag{color:#7A5D2A}
.tg-h{font-family:Georgia,serif;font-size:19px;line-height:1.2;color:#EFE4C8;margin:6px 0 2px}
html.sa-light .tg-h{color:#2A1F0E}
.tg-sub{font-size:12.5px;line-height:1.4;color:#A8966F}
html.sa-light .tg-sub{color:#6B5B40}
/* v32 (Доп. 335): квест компактнее — три шкалы в одну строку, «Подробнее» раскрывает остальное */
.tg-qtop{display:flex;align-items:center;gap:8px;min-height:22px}
.tg-qtop .tg-tag{flex:1;min-width:0}
.tg-more{flex:0 0 auto;width:28px;height:28px;margin:-3px -4px -3px 0;display:grid;place-items:center;padding:0;border-radius:50%;border:1px solid rgba(255,255,255,.12);
  background:rgba(226,186,116,.08);color:#C8A96E;cursor:pointer;box-shadow:inset 0 1px 0 rgba(255,255,255,.1)}
html.sa-light .tg-more{border-color:rgba(139,106,48,.3);background:rgba(255,250,238,.7);color:#7A5D2A}
.tg-more span{display:inline-block;font-size:11px;line-height:1;transition:transform .2s}
.tg-more[aria-expanded="true"] span{transform:rotate(180deg)}
.tg-more:focus-visible{outline:2px solid #D9B87C;outline-offset:2px;border-radius:8px}
.tg-quest .tg-h{margin:2px 0 1px}
.tg-goal{margin-top:2px}
.tg-bars{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:4px 12px;margin:10px 0 2px}
.tg-bar{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:4px 6px;align-items:baseline;font-size:12px;color:#CFC2A4}
.tg-bar .lb{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.tg-bar .nv{font-variant-numeric:tabular-nums;font-weight:700}
html.sa-light .tg-bar{color:#4A3B22}
.tg-bar i{grid-column:1/-1;display:flex;height:5px;border-radius:99px;background:rgba(255,255,255,.08);overflow:hidden}
html.sa-light .tg-bar i{background:rgba(120,90,30,.14)}
.tg-bar i b{display:block;height:100%;background:linear-gradient(90deg,#C8A96E,#E8C56A);transition:width .6s cubic-bezier(.2,.8,.2,1)}
.tg-bar i b+b{box-shadow:inset 1.5px 0 0 rgba(20,14,6,.55)}
html.sa-light .tg-bar i b+b{box-shadow:inset 1.5px 0 0 rgba(255,250,238,.8)}
.tg-bar.ok{color:#9CC7A8}
html.sa-light .tg-bar.ok{color:#2F6B45}
.tg-people{display:flex;flex-wrap:wrap;gap:6px;margin:10px 0 2px}
.tg-p{display:inline-flex;align-items:center;gap:6px;padding:4px 9px 4px 4px;border-radius:999px;border:1px solid rgba(214,178,102,.28);font-size:12px;color:#CFC2A4}
html.sa-light .tg-p{border-color:rgba(139,106,48,.3);color:#4A3B22}
.tg-p .av{width:20px;height:20px;border-radius:50%;display:grid;place-items:center;font:700 10.5px Georgia,serif;color:#1A1008;background:var(--pc,#C8A96E)}
.tg-p.me{border-color:#C8A96E}
.tg-p .d{color:#D9B87C;font-weight:700}
html.sa-light .tg-p .d{color:#7A5D2A}
.tg-who{display:flex;align-items:center;gap:8px;width:100%;margin:6px 0 0;padding:5px 2px;border:0;background:none;color:inherit;font:12.5px ${BODY};cursor:pointer;text-align:left}
.tg-who .avs{display:flex}
.tg-who .avs span{width:22px;height:22px;border-radius:50%;display:grid;place-items:center;font:700 10.5px Georgia,serif;color:#1A1008;background:var(--pc,#C8A96E);box-shadow:0 0 0 2px #1E170C;margin-left:-5px}
html.sa-light .tg-who .avs span{box-shadow:0 0 0 2px #F6EEDC}
.tg-who .avs span:first-child{margin-left:0}
.tg-who .t{flex:1;min-width:0;color:#CFC2A4}
html.sa-light .tg-who .t{color:#4A3B22}
.tg-who .ch{color:#A8966F;transition:transform .2s}
.tg-who[aria-expanded="true"] .ch{transform:rotate(180deg)}
.tg-sep{display:flex;align-items:center;gap:8px;margin:8px 0 2px}
.tg-sep i{flex:1;border-top:1px dashed rgba(214,178,102,.3)}
html.sa-light .tg-sep i{border-color:rgba(139,106,48,.3)}
.tg-task{display:flex;align-items:center;gap:10px;width:100%;text-align:left;padding:7px 2px;border:0;background:none;color:inherit;font:inherit;cursor:pointer}
.tg-task .ck{flex:0 0 auto;width:20px;height:20px;border-radius:50%;border:1.5px solid #C8A96E;display:grid;place-items:center;color:#1A1008}
.tg-task.done .ck{background:#C8A96E}
.tg-task .tt{flex:1;min-width:0;font-size:14px;line-height:1.3;color:#EFE4C8}
html.sa-light .tg-task .tt{color:#2A1F0E}
.tg-task.done .tt{color:#A8966F;text-decoration:line-through;text-decoration-color:rgba(168,150,111,.6)}
html.sa-light .tg-task.done .tt{color:#6B5B40}
.tg-task .n{flex:0 0 auto;font-size:12px;color:#A8966F;font-variant-numeric:tabular-nums}
html.sa-light .tg-task .n{color:#6B5B40}
.tg-task:focus-visible,.tg-who:focus-visible{outline:2px solid #D9B87C;outline-offset:2px;border-radius:8px}
.tg-stamp{display:inline-flex;align-items:center;gap:8px;margin-top:10px;padding:6px 12px;border-radius:999px;border:1.5px solid #B0492F;color:#E08A70;font:700 11px ui-monospace,Menlo,monospace;letter-spacing:1.6px;transform:rotate(-2deg)}
.tg-stamp.drop{animation:tgStamp .75s cubic-bezier(.2,1.5,.45,1) both}
@keyframes tgStamp{0%{opacity:0;transform:scale(2.2) rotate(-14deg)}60%{opacity:1;transform:scale(.94) rotate(-1deg)}100%{opacity:1;transform:scale(1) rotate(-2deg)}}
html.sa-light .tg-stamp{color:#8F3520;border-color:#8F3520}
.tg-note{font-size:12px;line-height:1.45;color:#A8966F;margin-top:8px}
html.sa-light .tg-note{color:#6B5B40}
.tg-row2{display:flex;flex-wrap:wrap;align-items:center;gap:8px;margin-top:10px}
.tg-chipbtn{display:inline-flex;align-items:center;gap:6px;padding:8px 13px;border-radius:999px;border:1px solid rgba(214,178,102,.5);background:transparent;color:#D9B87C;font:700 12.5px ${BODY};cursor:pointer}
html.sa-light .tg-chipbtn{border-color:rgba(122,93,42,.5);color:#6B4E1A}
.tg-chipbtn.on{border-color:transparent;background:rgba(156,199,168,.16);color:#9CC7A8;cursor:default}
html.sa-light .tg-chipbtn.on{background:rgba(47,107,69,.1);color:#2F6B45}
.tg-chipbtn[disabled]{opacity:.55;cursor:default}
.tg-thanks{font-size:12.5px;line-height:1.45;color:#CFC2A4;margin-top:6px}
html.sa-light .tg-thanks{color:#4A3B22}
.tg-lead{margin-top:8px;padding:9px 12px;border-radius:14px;border:1px dashed rgba(214,178,102,.4)}
.tg-lead.min{display:flex;align-items:center;gap:10px;flex-wrap:wrap;padding:6px 6px 6px 12px}
.tg-lead.min .tg-sub{flex:1;min-width:0}
.tg-lead.min .tg-row2{margin-top:0}
.tg-notg{margin-top:3px;font-size:12px}
html.sa-light .tg-lead{border-color:rgba(139,106,48,.4)}
/* Свеча на двоих */
.tg-scrim{position:fixed;inset:0;z-index:1050;display:flex;align-items:flex-end;justify-content:center;background:rgba(8,6,3,.62)}
html.sa-light .tg-scrim{background:rgba(70,52,24,.35)}
.tg-sheet{width:100%;max-width:560px;max-height:90vh;overflow:auto;box-sizing:border-box;padding:18px 16px calc(18px + env(safe-area-inset-bottom,0px));border-radius:22px 22px 0 0;background-color:#1E170C;background-image:var(--sheet-bg,none);color:#EFE4C8;border:1px solid var(--sheet-edge,rgba(214,178,102,.32));border-top-color:var(--sheet-top,rgba(214,178,102,.32));border-bottom:0;box-shadow:var(--sheet-shadow,none);font-family:${BODY}}
html.sa-light .tg-sheet{background-color:#F6EEDC;color:#2A1F0E}
.tg-two{position:relative;display:flex;align-items:flex-end;justify-content:center;gap:46px;margin:18px 0 6px}
.tg-two>div{position:relative;z-index:1;display:flex;flex-direction:column;align-items:center;gap:6px;font-size:13px;color:#CFC2A4;min-width:84px}
html.sa-light .tg-two>div{color:#4A3B22}
.tg-glow{position:absolute;left:50%;top:-6px;width:150px;height:96px;transform:translateX(-50%);border-radius:50%;background:radial-gradient(ellipse at 50% 55%,rgba(248,210,122,.42),rgba(226,135,58,.16) 45%,transparent 70%);pointer-events:none;animation:tgGlow 2.8s ease-in-out infinite}
@keyframes tgGlow{0%,100%{opacity:.75;transform:translateX(-50%) scale(1)}50%{opacity:1;transform:translateX(-50%) scale(1.06)}}
.tg-bridge{position:absolute;left:50%;top:6px;transform:translateX(-50%);font-family:ui-monospace,Menlo,monospace;font-size:10.5px;letter-spacing:1.6px;color:#E8C56A;white-space:nowrap}
html.sa-light .tg-bridge{color:#8A6410}
.tg-big{text-align:center;font-family:Georgia,serif;font-size:30px;line-height:1.1;margin-top:6px}
.tg-big small{display:block;font:12.5px ${BODY};color:#A8966F;margin-top:2px}
html.sa-light .tg-big small{color:#6B5B40}
.tg-week{display:grid;grid-template-columns:auto repeat(7,1fr);gap:6px 4px;align-items:center;margin:14px 0 4px;text-align:center;font-size:10.5px;color:#A8966F}
html.sa-light .tg-week{color:#6B5B40}
.tg-week .lb{text-align:left;padding-right:6px;font:12px ${BODY};color:#CFC2A4;white-space:nowrap;max-width:84px;overflow:hidden;text-overflow:ellipsis}
html.sa-light .tg-week .lb{color:#4A3B22}
.tg-week .dc{display:flex;justify-content:center}
.tg-dot{width:11px;height:11px;border-radius:50%;border:1.4px solid rgba(214,178,102,.5);box-sizing:border-box}
.tg-dot.s2{background:#E8C56A;border-color:#E8C56A}.tg-dot.s1{border-style:dashed}
html.sa-light .tg-dot{border-color:rgba(122,93,42,.55)}html.sa-light .tg-dot.s2{background:#B8902E;border-color:#B8902E}
.tg-ms{display:flex;gap:6px;justify-content:center;margin:10px 0 2px}
.tg-ms span{padding:4px 10px;border-radius:999px;border:1px dashed rgba(214,178,102,.4);font:700 11px ui-monospace,Menlo,monospace;letter-spacing:1px;color:#A8966F}
.tg-ms span.got{border-style:solid;border-color:#E8C56A;color:#E8C56A}
html.sa-light .tg-ms span{color:#6B5B40;border-color:rgba(139,106,48,.4)}html.sa-light .tg-ms span.got{color:#8A6410;border-color:#B8902E}
.tg-nudge{display:flex;align-items:center;gap:10px;width:100%;text-align:left;margin:10px 0 0;padding:11px 13px;border-radius:14px;border:1px solid rgba(214,178,102,.4);background:rgba(214,178,102,.10);color:inherit;font:14px/1.4 ${BODY};cursor:pointer}
html.sa-light .tg-nudge{border-color:rgba(139,106,48,.4);background:rgba(139,106,48,.08)}
.tg-btn{display:block;width:100%;margin-top:10px;min-height:48px;border-radius:999px;border:0;font:700 15px ${SERIF};cursor:pointer;color:#1A1008;background:linear-gradient(180deg,#E4C88C,#C8A96E)}
.tg-ghost{display:block;width:100%;margin-top:6px;padding:10px;border:0;background:none;color:#A8966F;font:700 14px ${BODY};cursor:pointer}
html.sa-light .tg-ghost{color:#6B5B40}
.tg-row{display:flex;align-items:center;gap:10px;padding:10px 4px;border-bottom:1px solid rgba(214,178,102,.14)}
html.sa-light .tg-row{border-color:rgba(139,106,48,.16)}
.tg-row .nm{flex:1;min-width:0;font-size:15px}
.tg-row .nm small{display:block;font-size:12px;color:#A8966F}
html.sa-light .tg-row .nm small{color:#6B5B40}
.tg-row button{flex:0 0 auto;padding:8px 13px;border-radius:999px;border:1px solid rgba(214,178,102,.5);background:transparent;color:#D9B87C;font:700 12.5px ${BODY};cursor:pointer}
html.sa-light .tg-row button{border-color:rgba(122,93,42,.5);color:#6B4E1A}
.tg-row button[disabled]{opacity:.5;cursor:default}
.tg-search{width:100%;box-sizing:border-box;margin:10px 0 4px;padding:11px 14px;border-radius:12px;border:1px solid rgba(214,178,102,.3);background:rgba(255,250,238,.05);color:inherit;font:15px ${BODY}}
html.sa-light .tg-search{border-color:rgba(139,106,48,.35);background:#FFFBF2}
.tg-inv{margin:10px 0 0;padding:12px 13px;border-radius:14px;border:1px solid rgba(214,178,102,.45);background:rgba(214,178,102,.08)}
.tg-inv .bb{display:flex;gap:8px;margin-top:8px}
.tg-inv .bb button{flex:1;min-height:42px;border-radius:999px;font:700 13.5px ${BODY};cursor:pointer;border:1px solid rgba(214,178,102,.5);background:transparent;color:inherit}
.tg-inv .bb button.y{border:0;color:#1A1008;background:linear-gradient(180deg,#E4C88C,#C8A96E)}
@media (prefers-reduced-motion: reduce){.tg-stamp.drop,.tg-glow{animation:none!important}}
`;
let cssOn = false;
function ensureCss() {
  ensureTableCss();
  if (cssOn || typeof document === "undefined" || !document.head || !document.createElement) return;
  cssOn = true;
  const st = document.createElement("style"); st.id = "sa-together-css"; st.textContent = CSS; document.head.appendChild(st);
}
const POS = { waiter: "официант", hostess: "хостес", bartender: "бармен", senior_bartender: "старший бармен", manager: "менеджер", senior: "руководитель", owner: "владелец" };
const short = (p) => (p ? (p.name || "") + (p.surname ? " " + p.surname[0] + "." : p.initial ? " " + p.initial + "." : "") : "");
const WD = ["Вс", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"];
const BAR_LABEL = { warm: "Разминки", steps: "Шаги обучения", guest: "Живые гости" };
const BAR_SHORT = { warm: "Разминки", steps: "Шаги", guest: "Гости" };   // v32: шкалы в одну строку
const BAR_FIELD = { warm: "warm", steps: "steps", guest: "guest" };
// цвета людей в шкалах: у каждого свой оттенок (у тебя — самый яркий)
const PC_DARK = ["#E8C56A", "#9CC7A8", "#D99A6C", "#8FB0D6", "#C9A2D8", "#C8A96E", "#E0B08A", "#A8C68F"];
const PC_LIGHT = ["#B8902E", "#2F6B45", "#A3532A", "#2F5A86", "#7A4B91", "#8B6A30", "#9A6034", "#557A35"];
const fem = (name) => /[ая]$/i.test(String(name || "").split(" ")[0]) && !/^(никита|илья|кузьма|фома|лука)$/i.test(String(name || "").split(" ")[0]);
const readLS = (k) => { try { return localStorage.getItem(k) || ""; } catch (e) { return ""; } };
const writeLS = (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} };

// Доли людей в шкале: [{ w: %, c: цвет, who }] — сумма не больше 100%
export function questSegments(people = [], field, need, palette = PC_DARK) {
  const out = [];
  if (!need) return out;
  let left = 100;
  people.forEach((p, i) => {
    const v = Number(p && p[field]) || 0;
    if (v <= 0 || left <= 0) return;
    const w = Math.min(left, (v / need) * 100);
    left -= w;
    out.push({ w: Math.round(w * 10) / 10, c: palette[(p.me ? 0 : (i % (palette.length - 1)) + 1)], who: p.me ? "ты" : short(p), v });
  });
  return out;
}

// ── Квест смены ───────────────────────────────────────────────────────────────
// data — ответ quest_today из сводки дня (этап 25): undefined — сводки нет, карточка грузит сама;
// null — сводка ещё едет.
export function QuestCard({ a11y, tasks = [], todayRec = {}, tick = 0, lead = false, shift = "", data, onReload, onTask, onComplete }) {
  ensureCss();
  const ext = data !== undefined;
  const [own, setOwn] = React.useState({ status: "loading" });
  React.useEffect(() => {
    if (ext) return undefined;
    let live = true;
    rpc("quest_today", { p_token: saToken() }).then((r) => {
      if (!live) return;
      if (rpcMissing(r)) setOwn({ status: "missing" });
      else if (r && r.ok) setOwn({ status: "ok", ...r });
      else setOwn({ status: "error" });
    }).catch(() => { if (live) setOwn({ status: "offline" }); });
    return () => { live = false; };
  }, [tick, ext]);
  const q = ext ? (data === null ? { status: "loading" } : data && data.ok ? { status: "ok", ...data } : { status: "error" }) : own;
  // в копилку «смен отработано» — только тем, кто сам был в смене (в выходной смену видно, но
  // засчитывать её себе нечестно — ревью v30); без графика сервер ставит me_on всем занимавшимся
  React.useEffect(() => { if (q.status === "ok" && q.complete && q.me_on && onComplete) onComplete(q.date); }, [q.status, q.complete, q.me_on, q.date]);   // eslint-disable-line react-hooks/exhaustive-deps
  const team = q.status === "ok" ? q : null;
  const pal = a11y ? PC_LIGHT : PC_DARK;
  const people = (team && Array.isArray(team.people)) ? team.people : [];
  const [openWho, setOpenWho] = React.useState(() => readLS("sa_quest_who") === "1");
  const toggleWho = () => { vibrate("light"); setOpenWho((v) => { writeLS("sa_quest_who", v ? "0" : "1"); return !v; }); };
  const myDone = tasks.filter((t) => taskProgress(t, todayRec).done).length;
  const allMine = tasks.length > 0 && myDone >= tasks.length;
  const [openTasks, setOpenTasks] = React.useState(false);
  // печать «Смена отработана» опускается один раз за день, дальше просто стоит
  const [dropDay, setDropDay] = React.useState("");
  React.useEffect(() => {
    if (team && team.complete && team.date && readLS("sa_quest_stamp") !== team.date) { setDropDay(team.date); writeLS("sa_quest_stamp", team.date); vibrate("success"); }
  }, [team && team.complete, team && team.date]);   // eslint-disable-line react-hooks/exhaustive-deps
  const drop = !!team && !!team.complete && dropDay === team.date;
  const [thx, setThx] = React.useState({ busy: false, done: false, missing: false });
  const thanksList = (team && Array.isArray(team.thanks)) ? team.thanks : [];
  const iThanked = thx.done || thanksList.some((t) => t.me);
  const sayThanks = () => {
    if (thx.busy || iThanked) return;
    vibrate("success"); setThx((x) => ({ ...x, busy: true }));
    rpc("quest_thanks", { p_token: saToken() }).then((r) => {
      if (rpcMissing(r)) { setThx({ busy: false, done: false, missing: true }); return; }
      setThx({ busy: false, done: !!(r && r.ok), missing: false });
      if (r && r.ok && onReload) onReload();
    }).catch(() => setThx((x) => ({ ...x, busy: false })));
  };
  const notStarted = people.filter((p) => !p.me && !(Number(p.steps) > 0));
  const [call, setCall] = React.useState({ busy: false, msg: "" });
  const callAll = () => {
    if (call.busy) return;
    vibrate("light"); setCall({ busy: true, msg: "" });
    rpc("quest_call", { p_token: saToken() }).then((r) => {
      if (rpcMissing(r)) { setCall({ busy: false, msg: "Позвать в Telegram получится, когда владелец обновит сервер." }); return; }
      if (r && r.ok) {
        const n = r.sent || 0;
        setCall({ busy: false, msg: n ? "Позвали " + n + " " + plural(n, "человека", "человек", "человек") + " — сообщение в Telegram ✦" + (r.no_tg ? " · без Telegram: " + r.no_tg : "")
          : r.already ? "Сегодня уже звали — хватит одного раза" : "Некого звать: у остальных нет Telegram или напоминания выключены" });
        if (onReload) onReload();
        return;
      }
      const e = r && r.error;
      setCall({ busy: false, msg: e === "no_bot" ? "Напоминания в Telegram ещё не подключены — скажи владельцу." : e === "forbidden" ? "Звать может старший смены." : "Не получилось — попробуй ещё раз." });
    }).catch(() => setCall({ busy: false, msg: "Нет связи — попробуй ещё раз." }));
  };
  // v32 (Доп. 335): три шкалы — в одну строку (подпись и счёт над тонкой полосой)
  const bar = (k) => {
    const need = (team.goal || {})[k] || 0, have = (team.done || {})[k] || 0;
    if (!need) return null;
    const segs = questSegments(people, BAR_FIELD[k], need, pal);
    const fallback = !segs.length && have > 0 ? [{ w: Math.min(100, (have / need) * 100), c: pal[0], who: "" }] : segs;
    return (
      <div key={k} className={"tg-bar" + (have >= need ? " ok" : "")} role="group" title={BAR_LABEL[k]} aria-label={GOAL_WORDS[k][2] + ": " + have + " из " + need + (segs.length ? " — " + segs.map((x) => x.who + " " + x.v).join(", ") : "")}>
        <span className="lb">{BAR_SHORT[k]}</span><span className="nv">{Math.min(have, need)}/{need}{have >= need ? " ✓" : ""}</span>
        <i>{fallback.map((x, j) => <b key={j} style={{ width: x.w + "%", background: x.c }} title={x.who} />)}</i>
      </div>
    );
  };
  // v32 (Доп. 335): карточка свёрнута по умолчанию — цель, шкалы, твой следующий шаг и люди одной
  // строкой; «Подробнее» раскрывает всё остальное (люди с вкладом, «Спасибо», кто не начал, все
  // задания). Выбор запоминается.
  const [open, setOpen] = React.useState(() => readLS("sa_quest_open") === "1");
  const toggleOpen = () => { vibrate("light"); setOpen((v) => { writeLS("sa_quest_open", v ? "0" : "1"); return !v; }); };
  const nextTask = tasks.find((t) => !taskProgress(t, todayRec).done) || null;
  const taskRow = (t) => {
    const pg = taskProgress(t, todayRec);
    return (
      <button key={t.id} type="button" className={"tg-task" + (pg.done ? " done" : "")} onClick={() => { if (!pg.done && onTask) { vibrate("light"); onTask(t); } }} aria-label={t.label + (pg.done ? " — сделано" : " — " + pg.have + " из " + pg.need)}>
        <span className="ck" aria-hidden="true">{pg.done ? <Ic n="check" s={12} /> : null}</span>
        <span className="tt">{t.label}</span>
        <span className="n">{pg.done ? "✓" : pg.need > 1 ? pg.have + "/" + pg.need : "›"}</span>
      </button>
    );
  };
  const me = people.find((p) => p.me) || {};
  const noTg = notStarted.filter((p) => p.tg === false && !p.called);
  return (
    <div className={"sa-card sa-pagein tg-quest" + (open ? " open" : "")} style={{ ...frostOf(a11y), borderRadius: 18, padding: "12px 14px 10px" }} data-quest="">
      <div className="tg-qtop">
        <div className="tg-tag">КВЕСТ {team && !team.known ? "ЗАВЕДЕНИЯ" : "СМЕНЫ"}{shift ? " · " + shift.toUpperCase() : ""}</div>
        <button type="button" className="tg-more" aria-expanded={open} onClick={toggleOpen} data-quest-more="" aria-label={open ? "Свернуть квест" : "Подробнее: люди, спасибо, все задания"} title={open ? "Свернуть" : "Подробнее"}><span aria-hidden="true">▾</span></button>
      </div>
      {team ? (
        <>
          <div className="tg-h">{team.complete ? "Смена отработана ✦" : team.known ? (team.me_on ? "Смена вместе" : "Сегодня у тебя выходной") : "Заведение сегодня"}</div>
          {team.known && !team.me_on ? <div className="tg-sub">Смена занимается без тебя — отдыхай.</div> : null}
          {open ? <div className="tg-sub tg-goal">Цель: {goalLine(team.goal)}</div> : null}
          <div className="tg-bars">{["warm", "steps", "guest"].map(bar)}</div>
          {team.complete ? <div className={"tg-stamp" + (drop ? " drop" : "")}><span>✦</span>СМЕНА ОТРАБОТАНА</div> : null}
          {people.length ? (
            <>
              <button type="button" className="tg-who" aria-expanded={open && openWho} onClick={() => { if (!open) { setOpen(true); writeLS("sa_quest_open", "1"); if (!openWho) { setOpenWho(true); writeLS("sa_quest_who", "1"); } vibrate("light"); } else toggleWho(); }}>
                <span className="avs" aria-hidden="true">{people.slice(0, 5).map((p, i) => <span key={p.id} style={{ "--pc": pal[p.me ? 0 : (i % (pal.length - 1)) + 1] }}>{(p.name || "?")[0]}</span>)}</span>
                <span className="t">{people.length} {plural(people.length, "человек", "человека", "человек")} {team.known ? "в смене" : "сегодня"} · ты {me.steps || 0} {plural(me.steps || 0, "шаг", "шага", "шагов")}{!open && thanksList.length ? " · спасибо: " + thanksList.length : ""}</span>
                <span className="ch" aria-hidden="true">▾</span>
              </button>
              {open && openWho ? (
                <div className="tg-people" aria-label="Кто в смене">
                  {people.map((p, i) => (
                    <span key={p.id} className={"tg-p" + (p.me ? " me" : "")} title={p.synced ? "" : "ещё не открывал(а) приложение сегодня"}>
                      <span className="av" aria-hidden="true" style={{ "--pc": pal[p.me ? 0 : (i % (pal.length - 1)) + 1] }}>{(p.name || "?")[0]}</span>{p.me ? "ты" : short(p)}<span className="d">{p.steps || 0}</span>
                    </span>
                  ))}
                </div>
              ) : null}
            </>
          ) : null}
          {open && people.length >= 2 && !thx.missing && (team.thanks !== undefined) ? (
            <div className="tg-row2">
              <button type="button" className={"tg-chipbtn" + (iThanked ? " on" : "")} onClick={sayThanks} disabled={thx.busy} aria-pressed={iThanked}>{iThanked ? "Ты сказал(а) спасибо ✓" : "Спасибо команде ✦"}</button>
            </div>
          ) : null}
          {open && thanksList.length ? <div className="tg-thanks">Спасибо от {thanksList.map((t) => (t.me ? "тебя" : t.name + (t.initial ? " " + t.initial + "." : ""))).join(", ")} ✦</div> : null}
          {team.lead && notStarted.length ? (
            <div className={"tg-lead" + (open ? "" : " min")} role="group" aria-label="Кто ещё не начал">
              {open ? (
                <>
                  <div className="tg-sub">Ещё не начали: {notStarted.map((p) => short(p) + (p.called ? " (позвали)" : "")).join(", ")}</div>
                  {noTg.length ? <div className="tg-sub tg-notg">{noTg.length === notStarted.length && notStarted.length > 1 ? "Без Telegram — все" : "Без Telegram: " + noTg.map(short).join(", ")}</div> : null}
                </>
              ) : <div className="tg-sub">Ещё не начали: <b>{notStarted.length}</b></div>}
              {team.tg !== false ? <div className="tg-row2"><button type="button" className="tg-chipbtn" onClick={callAll} disabled={call.busy || notStarted.every((p) => p.called || p.tg === false)}>{call.busy ? "Минуту…" : "Позвать на разминку"}</button></div> : null}
              {call.msg ? <div className="tg-note" role="status">{call.msg}</div> : null}
            </div>
          ) : null}
        </>
      ) : q.status === "loading" ? (
        <div className="tg-sub" style={{ marginTop: 6 }}>Смотрю, кто сегодня в смене…</div>
      ) : (
        <div className="tg-sub" style={{ marginTop: 6 }}>{q.status === "missing" ? (lead ? "Общий квест смены включится, когда владелец обновит сервер. Пока — личные задания." : "Твои задания на сегодня") : "Общий квест не загрузился — личные задания работают и так."}</div>
      )}
      {tasks.length ? (
        <>
          {allMine && !openTasks && !open ? (
            <button type="button" className="tg-who" aria-expanded={false} onClick={() => { setOpenTasks(true); setOpen(true); writeLS("sa_quest_open", "1"); }}>
              <span className="t"><b style={{ color: a11y ? "#2F6B45" : "#9CC7A8" }}>Твоя часть сделана · {myDone} из {tasks.length} ✓</b></span><span className="ch" aria-hidden="true">▾</span>
            </button>
          ) : (
            <>
              <div className="tg-sep"><i /><span className="tg-tag">ТВОЯ ЧАСТЬ · {myDone} ИЗ {tasks.length}</span><i /></div>
              {open || openTasks ? tasks.map(taskRow) : nextTask ? taskRow(nextTask) : null}
            </>
          )}
        </>
      ) : null}
      {open && team && people.some((p) => !p.synced) ? <div className="tg-note">Занятия приходят с телефонов за несколько секунд.</div> : null}
    </div>
  );
}

// ── Свеча на двоих ────────────────────────────────────────────────────────────
export function pairNudgeText(pair) {
  if (!pair || !pair.partner) return "";
  const name = pair.partner.name || "Напарник";
  const f = fem(name);
  const pt = pair.partner_today || {}, me = pair.me_today || {};
  // 1 — сегодня выходной по графику заведения (сервер, этап 24): такой день серию не рвёт,
  // но и не считается; рвёт её день, когда второй в смене и не занимался
  if (me.state === 1) return pt.state === 2 ? "У тебя выходной по графику, а " + name + (f ? " свою часть сделала" : " свою часть сделал") + " — свеча горит"
    : pt.state === 1 ? "Сегодня у обоих выходной — свеча подождёт" : "У тебя выходной по графику — свечу сегодня держит " + name;
  if (pt.state === 2 && me.state !== 2) return name + (pt.warm ? (f ? " уже размялась" : " уже размялся") : (f ? " уже занималась сегодня" : " уже занимался сегодня")) + " — твоя очередь";
  if (me.state === 2 && pt.state === 1) return "Ты свою часть сделал(а). " + name + " сегодня не в смене — свеча подождёт";
  if (me.state === 2 && pt.state !== 2) return "Ты свою часть сделал(а). " + name + " — ещё нет: свеча ждёт двоих";
  if (me.state === 2 && pt.state === 2) return "Сегодня горите вдвоём ✦";
  if (pt.state === 1) return name + " сегодня не в смене — свечу сегодня держишь ты: хотя бы один шаг";
  return "Свеча ждёт вас обоих — хотя бы по шагу за день";
}

// Вехи серии на двоих
export const PAIR_MILESTONES = [7, 30, 100];
export function pairMilestone(streak) {
  const n = Number(streak) || 0;
  const got = PAIR_MILESTONES.filter((m) => n >= m);
  const next = PAIR_MILESTONES.find((m) => n < m) || null;
  return { got, next, left: next ? next - n : 0, last: got.length ? got[got.length - 1] : 0 };
}
const MS_WORD = { 7: "Неделя вместе ✦", 30: "Месяц вместе ✦", 100: "Сто дней вместе ✦" };

export function PairSheet({ a11y, profile, onClose, onGo, onChange }) {
  ensureCss();
  const [st, setSt] = React.useState({ status: "loading" });
  const [cands, setCands] = React.useState(null);
  const [q, setQ] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [msg, setMsg] = React.useState("");
  const [confirmEnd, setConfirmEnd] = React.useState(false);
  const [nudge, setNudge] = React.useState({ busy: false, msg: "", hide: false });
  const load = React.useCallback(() => {
    rpc("pair_status", { p_token: saToken() }).then((r) => {
      if (rpcMissing(r)) { setSt({ status: "missing" }); return; }
      if (r && r.ok) { setSt({ status: "ok", ...r }); if (onChange) onChange(r); } else setSt({ status: "error" });
    }).catch(() => setSt({ status: "offline" }));
  }, [onChange]);
  React.useEffect(() => { load(); }, [load]);
  const needCands = st.status === "ok" && !st.pair && !st.outgoing;
  React.useEffect(() => {
    if (!needCands || cands) return;
    rpc("pair_candidates", { p_token: saToken() }).then((r) => setCands(r && r.ok && Array.isArray(r.rows) ? r.rows : [])).catch(() => setCands([]));
  }, [needCands, cands]);
  const act = async (fn, args, okText) => {
    if (busy) return;
    setBusy(true); setMsg("");
    try {
      const r = await rpc(fn, { p_token: saToken(), ...args });
      if (r && r.ok) { vibrate("success"); if (okText) setMsg(okText(r)); load(); setCands(null); }
      else setMsg(ERR[(r && r.error) || ""] || "Не получилось — попробуй ещё раз");
    } catch (e) { setMsg("Нет связи — попробуй ещё раз"); }
    finally { setBusy(false); }
  };
  const pair = st.status === "ok" ? st.pair : null;
  // имя напарника: если его строку в команде удалили, сервер пару гасит сам (этап 24),
  // а экран на всякий случай не падает и на старом ответе (ревью v30)
  const pn = (pair && pair.partner && pair.partner.name) || "напарник";
  const days = (pair && pair.days) || [];
  const list = (cands || []).filter((c) => !q.trim() || (c.name + " " + c.surname).toLowerCase().includes(q.trim().toLowerCase()));
  const nudgeLine = pairNudgeText(pair);
  const goTo = pair && pair.me_today && pair.me_today.state !== 2 ? (pair.partner_today && pair.partner_today.warm ? "warmup" : "track") : null;
  const ms = pairMilestone(pair ? pair.streak : 0);
  // веха достигнута впервые — отмечаем и празднуем один раз
  const msKey = pair ? "sa_pair_ms_" + pair.id : "";
  const [msNew, setMsNew] = React.useState(0);
  React.useEffect(() => { if (msKey && ms.last && Number(readLS(msKey) || 0) < ms.last) { writeLS(msKey, String(ms.last)); setMsNew(ms.last); vibrate("success"); } }, [msKey, ms.last]);
  const both = !!(pair && pair.me_today && pair.me_today.state === 2 && pair.partner_today && pair.partner_today.state === 2);
  const doNudge = () => {
    if (nudge.busy) return;
    vibrate("light"); setNudge({ busy: true, msg: "", hide: false });
    rpc("pair_nudge", { p_token: saToken() }).then((r) => {
      if (rpcMissing(r)) { setNudge({ busy: false, msg: "", hide: true }); return; }
      if (r && r.ok) { vibrate("success"); setNudge({ busy: false, msg: pn + " получит сообщение в Telegram ✦", hide: false, sent: true }); return; }
      const e = r && r.error;
      setNudge({ busy: false, hide: false, msg: e === "already" ? "Сегодня уже подталкивал(а) — хватит одного раза" : e === "done" ? pn + (fem(pn) ? " уже сделала" : " уже сделал") + " свою часть ✦"
        : e === "no_tg" ? "У " + (fem(pn) ? "напарницы" : "напарника") + " не включены сообщения в Telegram" : e === "no_bot" ? "Бот ещё не подключён на сервере" : "Не получилось — попробуй ещё раз" });
    }).catch(() => setNudge({ busy: false, msg: "Нет связи — попробуй ещё раз", hide: false }));
  };
  const canNudge = !!pair && !nudge.hide && pair.partner && !(pair.partner_today && pair.partner_today.state === 2) && !(pair.partner_today && pair.partner_today.state === 1);
  return (
    <div className="tg-scrim tbv" onClick={onClose}>
      <div className="tg-sheet" role="dialog" aria-modal="true" aria-label="Свеча на двоих" onClick={(e) => e.stopPropagation()}>
        <div className="tg-tag">СВЕЧА НА ДВОИХ</div>
        {st.status === "loading" ? <SkelLines a11y={a11y} widths={["74%", "52%"]} style={{ marginTop: 10 }} /> : null}
        {st.status === "missing" ? <div className="tg-sub" style={{ marginTop: 8 }}>{serverMissing({ what: "«Свеча на двоих»", admin: !!(profile && profile.is_admin), sql: "supabase-stage24-together.sql" })}</div> : null}
        {st.status === "offline" || st.status === "error" ? <div className="tg-sub" style={{ marginTop: 8 }}>Нет связи с сервером — попробуй чуть позже.</div> : null}
        {pair ? (
          <>
            <div className="tg-h">Ты и {pn} · {pair.streak ? pair.streak + " " + plural(pair.streak, "день", "дня", "дней") + " вместе" : "свеча ждёт первого общего дня"}</div>
            <div className="tg-sub">Свеча горит, пока занимаетесь оба — хотя бы по шагу в день. Выходной по графику свечу не гасит.</div>
            <div className="tg-two" aria-label={both ? "Сегодня горите вдвоём" : "Свечи на сегодня"}>
              {both ? <><span className="tg-glow" aria-hidden="true" /><span className="tg-bridge" aria-hidden="true">✦ ВДВОЁМ ✦</span></> : null}
              <div><Candle s={64} lit={pair.me_today && pair.me_today.state === 2} /><span>ты</span></div>
              <div><Candle s={64} lit={pair.partner_today && pair.partner_today.state === 2} /><span>{short(pair.partner) || pn}</span></div>
            </div>
            <div className="tg-week" role="table" aria-label="Неделя пары">
              <span role="columnheader" />
              {days.map((d) => { const dd = new Date(d.d + "T12:00:00"); return <span key={"h" + d.d} role="columnheader">{WD[dd.getDay()]}</span>; })}
              <span className="lb" role="rowheader">ты</span>
              {days.map((d) => { const dd = new Date(d.d + "T12:00:00"); return <span key={"m" + d.d} className="dc" role="cell" aria-label={WD[dd.getDay()] + ": ты — " + STATE[d.me]}><i className={"tg-dot s" + d.me} /></span>; })}
              <span className="lb" role="rowheader">{pn}</span>
              {days.map((d) => { const dd = new Date(d.d + "T12:00:00"); return <span key={"p" + d.d} className="dc" role="cell" aria-label={WD[dd.getDay()] + ": " + pn + " — " + STATE[d.partner]}><i className={"tg-dot s" + d.partner} /></span>; })}
            </div>
            <div className="tg-note" style={{ textAlign: "center", marginTop: 2 }}>пунктир — выходной по графику: такой день свечу не гасит</div>
            <div className="tg-ms" aria-label={ms.next ? "До вехи " + ms.next + " дней осталось " + ms.left : "Все вехи пройдены"}>
              {PAIR_MILESTONES.map((m) => <span key={m} className={pair.streak >= m ? "got" : undefined}>{m} {plural(m, "день", "дня", "дней")}{pair.streak >= m ? " ✦" : ""}</span>)}
            </div>
            {msNew ? <div className="tg-big" role="status" style={{ fontSize: 22 }}>{MS_WORD[msNew]}<small>Серия на двоих — {pair.streak} {plural(pair.streak, "день", "дня", "дней")}</small></div>
              : ms.next ? <div className="tg-note" style={{ textAlign: "center", marginTop: 4 }}>до вехи «{ms.next} {plural(ms.next, "день", "дня", "дней")}» — {ms.left} {plural(ms.left, "день", "дня", "дней")}</div> : null}
            {nudgeLine ? (
              goTo && onGo ? <button type="button" className="tg-nudge" onClick={() => onGo(goTo)}><Candle s={20} lit /><span style={{ flex: 1 }}>{nudgeLine}</span><span aria-hidden="true">›</span></button>
                : <div className="tg-nudge" role="status"><Candle s={20} lit={pair.me_today && pair.me_today.state === 2} /><span style={{ flex: 1 }}>{nudgeLine}</span></div>
            ) : null}
            {canNudge ? <button type="button" className="tg-ghost" style={{ marginTop: 10, border: "1px solid rgba(214,178,102,.45)", borderRadius: 999, color: a11y ? "#6B4E1A" : "#D9B87C" }} onClick={doNudge} disabled={nudge.busy || nudge.sent}>{nudge.busy ? "Минуту…" : nudge.sent ? "Сообщение ушло ✓" : "Подтолкнуть: " + pn + " получит сообщение"}</button> : null}
            {nudge.msg ? <div className="tg-note" role="status" style={{ textAlign: "center" }}>{nudge.msg}</div> : null}
            {confirmEnd ? (
              <div className="tg-inv">
                <div>Погасить свечу на двоих? Серия {pair.streak} {plural(pair.streak, "день", "дня", "дней")} закончится, у каждого останется своя свеча.</div>
                <div className="bb"><button type="button" onClick={() => setConfirmEnd(false)}>Оставить</button><button type="button" className="y" disabled={busy} onClick={() => act("pair_end", {}, () => "Свеча погашена")}>Погасить</button></div>
              </div>
            ) : <button type="button" className="tg-ghost" onClick={() => setConfirmEnd(true)}>Погасить свечу на двоих</button>}
          </>
        ) : st.status === "ok" ? (
          <>
            <div className="tg-h">Зажги свечу на двоих</div>
            <div className="tg-sub">Общая серия с напарником или наставником: горит, пока занимаетесь оба. Видно, кто уже сделал свою часть сегодня.</div>
            {(st.invites || []).map((inv) => (
              <div key={inv.id} className="tg-inv">
                <div><b>{short(inv.from)}</b> зовёт тебя в Свечу на двоих</div>
                <div className="bb">
                  <button type="button" disabled={busy} onClick={() => act("pair_answer", { p_id: inv.id, p_accept: false }, () => "Приглашение отклонено")}>Не сейчас</button>
                  <button type="button" className="y" disabled={busy} onClick={() => act("pair_answer", { p_id: inv.id, p_accept: true }, () => "Свеча на двоих зажжена ✦")}>Принять</button>
                </div>
              </div>
            ))}
            {st.outgoing ? (
              <div className="tg-inv">
                <div>Ты позвал(а) <b>{short(st.outgoing.to)}</b> — ждём ответа.</div>
                <div className="bb"><button type="button" disabled={busy} onClick={() => act("pair_end", {}, () => "Приглашение отозвано")}>Отозвать</button></div>
              </div>
            ) : (
              <>
                <input className="tg-search" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Найти коллегу" aria-label="Найти коллегу" />
                {cands == null ? <div className="tg-sub">Загружаю коллег…</div> : !list.length ? <div className="tg-sub">{cands.length ? "Никого не нашлось" : "В заведении пока нет коллег в приложении"}</div> : null}
                <div>
                  {list.slice(0, 60).map((c) => (
                    <div key={c.id} className="tg-row">
                      <div className="nm">{c.name} {c.surname}<small>{(POS[c.position] || "сотрудник") + (c.lead ? " · может быть наставником" : "")}{c.busy ? " · уже в паре" : ""}</small></div>
                      <button type="button" disabled={busy || c.busy} onClick={() => act("pair_invite", { p_emp: c.id }, (r) => (r.status === "active" ? "Свеча на двоих зажжена ✦" : "Приглашение отправлено — " + c.name + " увидит его у себя"))}>Позвать</button>
                    </div>
                  ))}
                </div>
              </>
            )}
          </>
        ) : null}
        {msg ? <div className="tg-note" role="status">{msg}</div> : null}
        <button type="button" className="tg-ghost" data-sa-back="" onClick={onClose}>Закрыть</button>
      </div>
    </div>
  );
}
const STATE = { 0: "пропуск", 1: "выходной", 2: "занимался" };
const ERR = { have_pair: "У тебя уже есть пара — сначала погаси свою свечу", busy: "Коллега уже в паре с кем-то", other_restaurant: "Пару можно зажечь только в своём заведении",
  self: "Себя позвать нельзя", not_found: "Не нашёл — обнови список", already: "Приглашение уже не действует" };

export default QuestCard;
