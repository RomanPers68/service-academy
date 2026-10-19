// ui/live-guest.jsx — Доп. 312: «Живой гость».
//
// ИИ играет гостя: у стола, у входа или у бара — по треку сотрудника. Карточка стола → разговор
// (голосом или текстом) → «чек разбора» на той же бумаге, что чеки «у стола»: пять оценок,
// что получилось, что поправить, фраза, которую стоило сказать, уроки — открыть одним касанием.
// Вопросы тестов этих уроков уходят в «Работу над ошибками». Без ИИ — гость по сценарию:
// ситуации практики трека «у стола» (TableCheck, mode="guest").
// v31: стол сверху на карточке; крупное живое настроение и линия настроения в чеке; «шёпот
// наставника» (одна подсказка за разговор); ответы гостя потоком; «осталось реплик» видно всегда;
// «ещё раз с этим гостем» и «было/стало»; свои гости заведения — их пишет руководитель (этап 25).
// v42 (Доп. 355): гость знает роль — на карточке сказано, кто ты в этой сцене (хостес, официант, бармен,
// менеджер); кнопки, конец разговора и пункты чека — по роли; в ai-chat уходит трек (track).
import React from "react";
import { TableCheck, TableMood, TableLine, TableEdge, tableShell, tableVars, TableSound, TABLE_MOOD_WORD } from "./table";
import { Ic } from "./table-bits";
import { MicButton } from "./mic";
import { TalkButton, TalkBar, TalkDots, TalkSpeaking, canTalk } from "./talk";   // v34–v35 (Доп. 343–344): разговор голосом прямо в разговоре
import { voiceSupported } from "../lib/voice";
import { SUPABASE_URL, SUPABASE_KEY, saToken, rpc, rpcMissing } from "../api/supabase";
import { pickGuest, parseGuestReply, parseReceipt, mistakesForLessons, saveGuestRun, readGuestRuns, guestErrorText, CRITERIA, POS_WORD, previousRun, streamText, normPersona, placeUi, receiptKind, placeOf, NEW_IN_V42 } from "../lib/live-guest";
import { tablePool } from "../lib/table-pick";
import { pickWarmup } from "../lib/warmup";
import { MODULES_INDEX } from "../data/modules-index";
import { dishesOf } from "../lib/reference-context";
import { COCKTAILS } from "../data/cocktails";
import { vibrate } from "../lib/utils";
import { ymd } from "../lib/streak";
import { speakText, audioWake, audioSleep, stopSpeech } from "../lib/speech";   // v32 (Доп. 336)

const CSS = `
.lg-card{position:relative;margin:6px 0 14px;padding:16px 16px 14px;border-radius:6px;background:var(--paper);color:var(--paper-ink);box-shadow:0 10px 26px var(--drop);font-family:var(--font-body)}
.lg-card .ey{font-family:var(--font-mono);font-size:10.5px;letter-spacing:2.4px;color:var(--paper-sub);display:flex;justify-content:space-between;gap:8px}
.lg-card h2{margin:10px 0 2px;font-family:var(--font-display);font-size:24px;line-height:1.15;color:var(--paper-ink)}
.lg-card .ag{font-size:13px;color:var(--paper-sub);font-style:italic}
.lg-card p{margin:8px 0 0;font-size:14.5px;line-height:1.5}
.lg-card p.nt{font-size:13.5px;color:var(--paper-sub);font-style:italic}
.lg-tags{display:flex;flex-wrap:wrap;gap:6px;margin-top:10px}
.lg-tags span{font-family:var(--font-mono);font-size:10.5px;letter-spacing:1px;text-transform:uppercase;padding:4px 9px;border-radius:999px;border:1px solid var(--paper-line);color:var(--paper-sub)}
.lg-tags span.own{border-color:#B08A3E;color:#7A5A1E}
.lg-note{margin:0 0 12px;font-size:13.5px;line-height:1.5;color:var(--sub)}
.lg-role{margin:0 0 8px;font-size:14px;line-height:1.45;color:var(--text)}
.lg-opt{display:flex;align-items:center;gap:10px;margin:0 0 12px;font-size:14px;color:var(--text)}
.lg-opt input{width:18px;height:18px;accent-color:#C8A96E}
.lg-g,.lg-gp{align-self:flex-start;max-width:88%;padding:10px 13px;border-radius:16px;border-bottom-left-radius:5px;background:var(--glass-2);border:1px solid var(--edge);font-size:15px;line-height:1.45}
.lg-g b,.lg-gp b{display:block;font-family:var(--font-mono);font-size:10.5px;letter-spacing:1.6px;text-transform:uppercase;color:var(--sub);margin-bottom:2px;font-weight:400}
.lg-gp span::after{content:"▍";margin-left:1px;opacity:.6;animation:tbBlink 1s infinite}
.lg-row{display:flex;align-items:flex-end;gap:8px}
.lg-in{flex:1;min-width:0;min-height:46px;max-height:120px;resize:none;box-sizing:border-box;padding:12px 14px;border-radius:22px;border:1px solid var(--edge);background:var(--glass);color:var(--text);font:15px/1.35 var(--font-body)}
.lg-in:focus{outline:2px solid #C8A96E;outline-offset:1px}
.lg-send{flex:0 0 auto;width:46px;height:46px;border-radius:50%;border:0;display:grid;place-items:center;cursor:pointer;color:var(--on-gold);background:linear-gradient(180deg,#E4C88C,#C8A96E)}
.lg-send[disabled]{opacity:.45;cursor:default}
.lg-bar{display:flex;gap:8px;margin-top:8px}
.lg-bar .tb-ghost{padding:8px 10px;flex:1}
.lg-err{margin:0 0 10px;padding:10px 12px;border-radius:12px;border:1px solid var(--bad-edge);background:var(--bad-wash);font-size:13.5px;line-height:1.45}
.lg-crit li>b{letter-spacing:1.5px}
.lg-sec{margin:10px 0 2px;font-family:var(--font-mono);font-size:10.5px;letter-spacing:2px;color:var(--paper-sub)}
.lg-li{margin:3px 0 0;padding-left:14px;position:relative;font-family:var(--font-body);font-size:13.5px;line-height:1.4}
.lg-li::before{content:"·";position:absolute;left:3px;top:-1px;font-weight:700}
.lg-say{font-family:var(--font-hand);font-size:21px;line-height:1.25;margin:8px 0 2px;color:#2E2010;transform:rotate(-1deg)}
.lg-les{display:flex;flex-direction:column;gap:6px;margin-top:8px}
.lg-les button{display:flex;align-items:center;gap:8px;width:100%;text-align:left;padding:9px 11px;border-radius:10px;border:1px dashed var(--paper-line);background:transparent;color:var(--paper-ink);font:13.5px/1.3 var(--font-body);cursor:pointer}
.lg-wait{display:flex;flex-direction:column;align-items:center;gap:12px;padding:40px 0;color:var(--sub);font-style:italic}
.lg-top{display:block;width:100%;max-width:250px;height:auto;margin:12px auto 0}
.lg-top .tt-desk{fill:rgba(70,48,12,.07);stroke:var(--paper-sub);stroke-width:1.4}
.lg-top .tt-frame{fill:none;stroke:var(--paper-sub);stroke-width:1.6;stroke-linecap:round}
.lg-top .tt-seat{fill:transparent;stroke:var(--paper-sub);stroke-width:1.3}
.lg-top .tt-seat.on{fill:rgba(70,48,12,.16)}
.lg-top .tt-me{fill:#C8A96E;stroke:#8B6A30;stroke-width:1.4}
.lg-top .tt-num{font:700 14px var(--font-mono);fill:var(--paper-sub)}
.lg-top .tt-cap{font:9px var(--font-mono);letter-spacing:1.4px;fill:var(--paper-sub)}
.lg-mood{display:flex;align-items:center;gap:12px;margin:0 0 12px;padding:10px 12px;border-radius:16px;border:1px solid var(--edge);background:var(--glass)}
.lg-mood .tb-mood{transform:scale(1.3);margin:0 4px}
.lg-mood .mw{flex:1;min-width:0}
.lg-mood .mw b{display:block;font-family:var(--font-display);font-size:17px;line-height:1.2}
.lg-mood .mw small{display:block;font-size:12px;color:var(--sub)}
.lg-mood .md{display:flex;gap:4px}
.lg-mood .md i{width:16px;height:6px;border-radius:3px;background:var(--glass-2);border:1px solid var(--edge);transition:background .35s}
.lg-mood .md i.on{background:var(--mood-c,#C8A96E);border-color:transparent}
.lg-mood.bump{animation:lgBump .55s cubic-bezier(.3,1.4,.5,1)}
@keyframes lgBump{0%{transform:scale(1)}40%{transform:scale(1.035)}100%{transform:scale(1)}}
.lg-whisper{margin:0 0 12px;padding:10px 12px;border-radius:14px;border:1px dashed var(--edge-gold);background:rgba(200,169,110,.08);font-size:14px;line-height:1.45}
.lg-whisper b{display:flex;align-items:center;gap:6px;font-family:var(--font-mono);font-size:10.5px;letter-spacing:1.6px;color:var(--gold-ink);font-weight:400;margin-bottom:3px}
.lg-left{display:inline-flex;align-items:center;gap:6px;margin:0 0 10px;padding:4px 10px;border-radius:999px;border:1px solid var(--edge);font-size:12px;color:var(--sub)}
.lg-line{display:block;width:100%;height:auto;margin:6px 0 2px}
.lg-line path{fill:none;stroke:#8B6A30;stroke-width:1.8;stroke-linejoin:round;stroke-linecap:round}
.lg-line path.base{stroke:var(--paper-line);stroke-width:1;stroke-dasharray:2 3}
.lg-line circle{fill:#8B6A30}
.lg-was{display:flex;align-items:center;justify-content:space-between;gap:10px;margin:8px 0 0;font-family:var(--font-mono);font-size:10.5px;letter-spacing:1px;color:var(--paper-sub)}
.lg-was b{font-family:var(--font-body);font-size:13.5px;letter-spacing:0;color:var(--paper-ink);white-space:nowrap}
.lg-own{margin:0 0 12px;font-size:13px;color:var(--sub);display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.lg-own button{padding:6px 11px;border-radius:999px;border:1px solid var(--edge-gold);background:transparent;color:var(--gold-ink);font:700 12.5px var(--font-body);cursor:pointer}
.lg-ed{max-height:88vh;overflow-y:auto;box-sizing:border-box}
.lg-ed ul{margin:8px 0 12px;padding:0;list-style:none}
.lg-ed li{display:flex;align-items:center;gap:6px;padding:9px 0;border-bottom:1px dashed var(--edge)}
.lg-ed li .tx{flex:1;min-width:0}
.lg-ed li .tx b{display:block;font-size:15px}
.lg-ed li .tx small{display:block;font-size:12px;color:var(--sub);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.lg-ed li button{flex:0 0 auto;padding:6px 10px;border-radius:999px;border:1px solid var(--edge);background:transparent;color:var(--text);font:12.5px var(--font-body);cursor:pointer}
.lg-ed li button.del{border-color:var(--bad-edge)}
.lg-ed label{display:block;margin:10px 0 0;font-size:12.5px;color:var(--sub)}
.lg-ed input,.lg-ed textarea{display:block;width:100%;box-sizing:border-box;margin-top:4px;padding:10px 12px;border-radius:12px;border:1px solid var(--edge);background:var(--glass);color:var(--text);font:14.5px/1.35 var(--font-body)}
.lg-ed textarea{min-height:58px;resize:vertical}
.lg-seg{display:flex;gap:6px;margin-top:4px}
.lg-seg button{flex:1;padding:8px 6px;border-radius:10px;border:1px solid var(--edge);background:transparent;color:var(--sub);font:700 13px var(--font-body);cursor:pointer}
.lg-seg button.on{border-color:var(--edge-gold);background:var(--glass-2);color:var(--text)}
.lg-ed .row2{display:flex;gap:10px}
.lg-ed .row2>*{flex:1;min-width:0}
.lg-ed .msg{margin:10px 0 0;font-size:13px;color:var(--bad-ink,#C2553C)}
@media (prefers-reduced-motion: reduce){.lg-mood.bump{animation:none}.lg-mood .md i{transition:none}.lg-gp span::after{animation:none}}
`;
let cssDone = false;
function ensureCss() {
  if (cssDone || typeof document === "undefined" || !document.head || !document.createElement) return;
  cssDone = true;
  const st = document.createElement("style"); st.id = "sa-live-guest-css"; st.textContent = CSS; document.head.appendChild(st);
}

const stars = (n) => "★".repeat(n) + "☆".repeat(Math.max(0, 5 - n));
const lessonTitle = (id) => {
  for (const t of Object.keys(MODULES_INDEX || {})) for (const m of MODULES_INDEX[t] || []) { const l = (m.lessons || []).find((x) => x.id === id); if (l) return l.title || id; }
  return "";
};
const knownLesson = (id) => !!lessonTitle(id) || /^cms-/.test(String(id || ""));
const MOOD_C = ["", "#C2553C", "#C98A3E", "#B9A06A", "#7FA86A", "#4E9A6E"];
const PLACE_NAME = { hall: "зал", door: "вход", bar: "бар" };

function speak(text, female) {
  try {
    if (!("speechSynthesis" in window) || !text) return;
    // v32 (Доп. 336): через lib/speech (фраза держится до конца)
    audioWake();
    speakText(String(text).replace(/\*[^*]*\*/g, ""), { rate: 1, pitch: female ? 1.12 : 0.88, cancelBefore: true, onend: () => audioSleep(), onerror: () => audioSleep() });
  } catch (e) {}
}
const isFemale = (name) => /[ая]$/i.test(String(name || "").split(" ")[0]) && !/^(никита|илья|кузьма|фома|лука)$/i.test(String(name || "").split(" ")[0]);

// Блюда и напитки ресторана — из того же кэша меню, что видит Наставник
function menuOf(restaurant) {
  let dishes = []; try { dishes = dishesOf(restaurant) || []; } catch (e) { dishes = []; }
  let drinks = []; try { drinks = (COCKTAILS || []).map((c) => ({ name: c.name })).concat(dishes.filter((d) => d.kind === "cocktail")); } catch (e) { drinks = []; }
  return { dishes: dishes.filter((d) => d.kind !== "cocktail"), drinks };
}

// v31: стол сверху — где гость и сколько человек; у бара — стойка, у входа — дверь и стойка хостес
function TableTop({ guest }) {
  const seats = Math.max(1, Math.min(8, Number(guest.seats) || 2));
  if (guest.place === "bar") {
    return (
      <svg className="lg-top" viewBox="0 0 160 76" role="img" aria-label="Барная стойка, гость — у стойки">
        <path className="tt-desk" d="M14 12h132a9 9 0 0 1 0 18H14a9 9 0 0 1 0-18z" />
        <text className="tt-cap" x="80" y="24.5" textAnchor="middle">БАР</text>
        {[0, 1, 2, 3, 4].map((i) => <circle key={i} cx={24 + i * 28} cy={50} r={8} className={i === 2 ? "tt-me" : i === 0 ? "tt-seat on" : "tt-seat"} />)}
      </svg>
    );
  }
  // v42: звонок на стойку хостес — стойка с телефоном, у двери никого
  if (guest.place === "door" && guest.phone) {
    return (
      <svg className="lg-top" viewBox="0 0 160 84" role="img" aria-label="Стойка хостес, звонит гость">
        <path className="tt-frame" d="M100 78V12h40v66" />
        <rect className="tt-desk" x="8" y="54" width="48" height="20" rx="4" />
        <text className="tt-cap" x="32" y="67" textAnchor="middle">ХОСТЕС</text>
        <path className="tt-desk" d="M22 52l3-8h14l3 8z" />
        <path className="tt-frame" d="M19 41c2-7 24-7 26 0" />
        <rect className="tt-me" x="15" y="39" width="8" height="4.5" rx="2" />
        <rect className="tt-me" x="41" y="39" width="8" height="4.5" rx="2" />
        <path className="tt-frame" d="M52 33c2 1.5 3 3.5 3 6M56 29c3.5 2.5 5 6 5 10" opacity=".6" />
      </svg>
    );
  }
  if (guest.place === "door") {
    const n = Math.min(seats, 6);
    return (
      <svg className="lg-top" viewBox="0 0 160 84" role="img" aria-label={"Вход, гостей: " + seats}>
        <path className="tt-frame" d="M100 78V12h40v66" />
        <path className="tt-frame" d="M100 12l16 8v58" opacity=".5" />
        <rect className="tt-desk" x="8" y="54" width="48" height="20" rx="4" />
        <text className="tt-cap" x="32" y="67" textAnchor="middle">ХОСТЕС</text>
        {Array.from({ length: n }, (_, i) => <circle key={i} cx={80 - (i % 3) * 15} cy={30 + Math.floor(i / 3) * 18} r={6.5} className={i === 0 ? "tt-me" : "tt-seat on"} />)}
      </svg>
    );
  }
  const round = seats <= 4;
  const n = Math.max(2, seats);
  const chairs = [];
  if (round) {
    for (let k = 0; k < n; k++) {
      const a = (-90 + (k * 360) / n) * (Math.PI / 180);
      chairs.push([80 + Math.cos(a) * 34, 42 + Math.sin(a) * 30]);
    }
  } else {
    const per = Math.ceil(n / 2);
    for (let k = 0; k < n; k++) {
      const top = k < per, idx = top ? k : k - per, cnt = top ? per : n - per;
      chairs.push([80 - ((cnt - 1) * 22) / 2 + idx * 22, top ? 13 : 71]);
    }
  }
  return (
    <svg className="lg-top" viewBox="0 0 160 84" role="img" aria-label={"Стол " + guest.table + ", за столом: " + seats}>
      {round ? <circle className="tt-desk" cx="80" cy="42" r="22" /> : <rect className="tt-desk" x={80 - Math.ceil(n / 2) * 11 - 8} y="24" width={Math.ceil(n / 2) * 22 + 16} height="36" rx="6" />}
      <text className="tt-num" x="80" y="47" textAnchor="middle">{guest.table}</text>
      {chairs.map(([x, y], k) => <circle key={k} cx={x} cy={y} r={7} className={k === 0 ? "tt-me" : k < seats ? "tt-seat on" : "tt-seat"} />)}
    </svg>
  );
}

// v31: настроение гостя крупно — лицо, слово, пять делений; при перемене — лёгкий толчок
function MoodStrip({ moods }) {
  const m = moods[moods.length - 1] || 3, p = moods.length > 1 ? moods[moods.length - 2] : null;
  const trend = p == null ? "настроение гостя" : m > p ? "стало лучше ↑" : m < p ? "стало хуже ↓" : "без перемен";
  return (
    <div key={moods.length} className={"lg-mood" + (p != null && p !== m ? " bump" : "")} style={{ "--mood-c": MOOD_C[m] }} data-mood={m} aria-live="polite">
      <TableMood m={m} />
      <span className="mw"><b>Гость {TABLE_MOOD_WORD[m]}</b><small>{trend}</small></span>
      <span className="md" aria-hidden="true">{[1, 2, 3, 4, 5].map((i) => <i key={i} className={i <= m ? "on" : undefined} />)}</span>
    </div>
  );
}

// v31: линия настроения в чеке — от первой реплики гостя до последней
function MoodLine({ moods }) {
  if (!moods || moods.length < 2) return null;
  const W = 260, H = 50, n = moods.length;
  const x = (i) => 8 + (i * (W - 16)) / (n - 1);
  const y = (v) => 7 + ((5 - v) / 4) * (H - 14);
  const d = moods.map((v, i) => (i ? "L" : "M") + x(i).toFixed(1) + " " + y(v).toFixed(1)).join(" ");
  return (
    <>
      <div className="lg-sec">НАСТРОЕНИЕ ГОСТЯ · {TABLE_MOOD_WORD[moods[0]]} → {TABLE_MOOD_WORD[moods[n - 1]]}</div>
      <svg className="lg-line" viewBox={"0 0 " + W + " " + H} role="img" aria-label={"Настроение по ходу разговора: " + moods.map((v) => TABLE_MOOD_WORD[v]).join(", ")}>
        <path className="base" d={"M8 " + y(3) + " H" + (W - 8)} />
        <path d={d} />
        {moods.map((v, i) => <circle key={i} cx={x(i)} cy={y(v)} r={i === n - 1 ? 3.8 : 2.5} />)}
      </svg>
    </>
  );
}

// v31: свои гости заведения — список и редактор (только руководитель; сервер проверяет сам)
const ED_ERR = { name: "Нужно имя гостя.", open: "Нужна первая фраза гостя.", limit: "В заведении уже 30 своих гостей — удали лишних.", forbidden: "Добавлять гостей может руководитель.", not_found: "Этого гостя уже нет — обнови список.", auth: "Сессия устарела — войди заново." };
function PersonaEditor({ rows, myPlace, onClose, onSaved, onDeleted, onPlay }) {
  const [form, setForm] = React.useState(null);
  const [busy, setBusy] = React.useState(false);
  const [msg, setMsg] = React.useState("");
  const [del, setDel] = React.useState("");
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const save = () => {
    if (busy || !form) return;
    setBusy(true); setMsg("");
    const data = { ...form, tags: String(form.tagsText || "").split(",").map((t) => t.trim()).filter(Boolean).slice(0, 3) };
    delete data.tagsText;
    rpc("guest_persona_save", { p_token: saToken(), p_data: data }).then((r) => {
      setBusy(false);
      if (r && r.ok && r.row) { onSaved(r.row); setForm(null); vibrate("success"); return; }
      setMsg(rpcMissing(r) ? "Свои гости появятся, когда владелец обновит сервер." : ED_ERR[(r && r.error) || ""] || "Не сохранилось — проверь связь.");
    }, () => { setBusy(false); setMsg("Не сохранилось — проверь связь."); });
  };
  const remove = (id) => {
    if (del !== id) { setDel(id); return; }
    rpc("guest_persona_delete", { p_token: saToken(), p_id: id }).then((r) => {
      setDel("");
      if (r && r.ok) { onDeleted(id); vibrate("light"); } else setMsg(ED_ERR[(r && r.error) || ""] || "Не удалилось — проверь связь.");
    }, () => { setDel(""); setMsg("Не удалилось — проверь связь."); });
  };
  const edit = (row) => { setMsg(""); setForm(row ? { id: row.id, place: row.place, name: row.name, age: row.age, mood: row.mood, who: row.who, occasion: row.occasion, hidden: row.hidden, open: row.open, whisper: row.whisper, tagsText: (row.tags || []).join(", ") }
    : { place: myPlace, name: "", age: 35, mood: 3, who: "", occasion: "", hidden: "", open: "", whisper: "", tagsText: "" }); };
  return (
    <div className="tb-scrim" onClick={(e) => { if (e.target === e.currentTarget && !form) onClose(); }}>
      <div className="tb-sheet lg-ed" role="dialog" aria-modal="true" aria-label="Гости заведения" data-persona-editor="">
        {!form ? (
          <>
            <h3>Гости заведения</h3>
            <p>Свои характеры для «Живого гостя»: кто пришёл, что держит в голове, с чего начнёт. Сотрудники встретят их наравне с обычными гостями.</p>
            {rows.length ? (
              <ul>{rows.map((r) => (
                <li key={r.id}>
                  <span className="tx"><b>{r.name}</b><small>{PLACE_NAME[r.place] || "зал"}{(r.tags || []).length ? " · " + r.tags.join(" · ") : ""}</small></span>
                  {r.place === myPlace ? <button type="button" onClick={() => onPlay(r.id)}>Сыграть</button> : null}
                  <button type="button" onClick={() => edit(r)}>Изменить</button>
                  <button type="button" className="del" onClick={() => remove(r.id)}>{del === r.id ? "Точно?" : "Удалить"}</button>
                </li>
              ))}</ul>
            ) : <p style={{ marginTop: 4 }}>Пока своих гостей нет.</p>}
            {msg ? <p className="msg" role="alert">{msg}</p> : null}
            <button type="button" className="tb-main" onClick={() => edit(null)} disabled={rows.length >= 30}>Добавить гостя</button>
            <button type="button" className="tb-ghost" data-sa-back="" onClick={onClose}>Закрыть</button>
          </>
        ) : (
          <>
            <h3>{form.id ? "Гость: " + (form.name || "…") : "Новый гость"}</h3>
            <label>Где встречаем</label>
            <div className="lg-seg" role="radiogroup" aria-label="Где встречаем">
              {["hall", "door", "bar"].map((p) => <button key={p} type="button" role="radio" aria-checked={form.place === p} className={form.place === p ? "on" : undefined} onClick={() => set("place", p)}>{p === "hall" ? "Зал" : p === "door" ? "Вход" : "Бар"}</button>)}
            </div>
            <div className="row2">
              <label>Имя<input value={form.name} maxLength={40} onChange={(e) => set("name", e.target.value)} placeholder="Например, Пётр" /></label>
              <label>Возраст<input type="number" inputMode="numeric" min={16} max={90} value={form.age} onChange={(e) => set("age", e.target.value)} /></label>
            </div>
            <label>Настроение на входе</label>
            <div className="lg-seg" role="radiogroup" aria-label="Настроение на входе">
              {[1, 2, 3, 4, 5].map((v) => <button key={v} type="button" role="radio" aria-checked={Number(form.mood) === v} title={TABLE_MOOD_WORD[v]} className={Number(form.mood) === v ? "on" : undefined} onClick={() => set("mood", v)}>{v}</button>)}
            </div>
            <label>Кто он<textarea value={form.who} maxLength={200} onChange={(e) => set("who", e.target.value)} placeholder="Пришёл с коллегами на бизнес-ланч" /></label>
            <label>Повод<input value={form.occasion} maxLength={120} onChange={(e) => set("occasion", e.target.value)} placeholder="деловой обед" /></label>
            <label>Что держит в голове (скажет, только если спросят)<textarea value={form.hidden} maxLength={300} onChange={(e) => set("hidden", e.target.value)} placeholder="Не ест мясо; хочет уйти к 14:00" /></label>
            <label>Первая фраза гостя<textarea value={form.open} maxLength={200} onChange={(e) => set("open", e.target.value)} placeholder="Добрый день! Что у вас есть без мяса?" /></label>
            <label>Шёпот наставника (одна подсказка сотруднику)<input value={form.whisper} maxLength={160} onChange={(e) => set("whisper", e.target.value)} placeholder="Спроси про время и предпочтения" /></label>
            <label>Метки через запятую (до трёх)<input value={form.tagsText} maxLength={80} onChange={(e) => set("tagsText", e.target.value)} placeholder="вегетарианец, торопится" /></label>
            {msg ? <p className="msg" role="alert">{msg}</p> : null}
            <button type="button" className="tb-main" onClick={save} disabled={busy}>{busy ? "Сохраняем…" : "Сохранить"}</button>
            <button type="button" className="tb-ghost" data-sa-back="" onClick={() => { setForm(null); setMsg(""); }}>Назад к списку</button>
          </>
        )}
      </div>
    </div>
  );
}

export function LiveGuestScreen({ a11y, profile, role, uk, color, track = [], modules = [], dishes: dishesIn = null, drinks: drinksIn = null, mistakeBank = [],
  onMistakes, onActivity, onTouch, onOpenLesson, onClose, inline = false }) {
  ensureCss();
  const menu = React.useMemo(() => (dishesIn || drinksIn ? { dishes: dishesIn || [], drinks: drinksIn || [] } : menuOf(profile && profile.restaurant)), [profile, dishesIn, drinksIn]);
  const { dishes, drinks } = menu;
  const runsRef = React.useRef(readGuestRuns(uk));
  const ownRef = React.useRef([]);
  // v42: сервер ai-chat ещё старый (не знает новых гостей) — до конца сеанса гости как в v41
  const legacyRef = React.useRef((() => { try { return sessionStorage.getItem("sa_guest_legacy") === "1"; } catch (e) { return false; } })());
  const pick = React.useCallback((seed, prefer = "") => pickGuest({ role, position: profile && profile.position, dishes, drinks, seed, lastId: (runsRef.current.slice(-1)[0] || {}).p || "", extra: ownRef.current, prefer, legacy: legacyRef.current }), [role, profile, dishes, drinks]);
  const [guest, setGuest] = React.useState(() => pick(Date.now()));
  const [phase, setPhase] = React.useState("card");     // card | talk | eval | receipt | script
  const [msgs, setMsgs] = React.useState([]);           // { who: "guest"|"me", text }
  const [mood, setMood] = React.useState(3);
  const [moods, setMoods] = React.useState([3]);        // v31: настроение после каждой реплики гостя
  const [input, setInput] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [partial, setPartial] = React.useState("");     // v31: ответ гостя, пока идёт потоком
  const [err, setErr] = React.useState(null);
  const [ended, setEnded] = React.useState(false);
  const [receipt, setReceipt] = React.useState(null);
  const [prev, setPrev] = React.useState(null);         // v31: прошлый разговор — «было/стало»
  const [left, setLeft] = React.useState(null);
  const [whisper, setWhisper] = React.useState(false);  // v31: шёпот наставника уже взят
  const [own, setOwn] = React.useState([]);             // v31: свои гости заведения
  const [canEdit, setCanEdit] = React.useState(false);
  const [editor, setEditor] = React.useState(false);
  const [voiceOn, setVoiceOn] = React.useState(() => { try { return localStorage.getItem("sa_guest_voice") !== "0"; } catch (e) { return true; } });
  const [talk, setTalk] = React.useState(false);        // v34: открыт разговор голосом
  const [talkState, setTalkState] = React.useState("idle");   // v35: что сейчас в разговоре голосом
  const [oldAi, setOldAi] = React.useState(false);      // v42: ответ пришёл без метки версии — ai-chat на сервере до v42
  const talkOk = React.useMemo(() => canTalk(), []);
  const [micBusy, setMicBusy] = React.useState(false);  // v34: кнопка-микрофон пишет — волна ждёт
  const msgsRef = React.useRef(msgs); msgsRef.current = msgs;     // v34: реплики голосом идут подряд
  const endedRef = React.useRef(false); endedRef.current = ended;
  const t0 = React.useRef(0);
  const mount = React.useRef(Date.now());
  const touched = React.useRef(false);                  // человек уже выбирал гостя или начал разговор
  const bodyRef = React.useRef(null);
  const doneRef = React.useRef(false);
  const female = isFemale(guest.name);
  const ui = placeUi(guest);                            // v42: слова экрана по роли
  const ownHere = own.filter((r) => r && r.place === placeOf(role, profile && profile.position)).length;   // v42: свои гости этого места
  const vars = tableVars(color, a11y);
  React.useEffect(() => () => { try { stopSpeech(); } catch (e) {} }, []);
  React.useEffect(() => { const el = bodyRef.current; if (el) el.scrollTop = el.scrollHeight; }, [msgs.length, busy, phase, partial, talkState]);
  // v31: свои гости заведения (этап 25). Пришли быстро, пока карточка только открылась, — гость
  // может смениться на своего; позже — войдут в следующий выбор («Другой гость»).
  React.useEffect(() => {
    let dead = false;
    rpc("guest_personas", { p_token: saToken() }).then((r) => {
      if (dead || !r || !r.ok) return;
      const rows = (Array.isArray(r.rows) ? r.rows : []).filter((x) => normPersona(x));
      ownRef.current = rows; setOwn(rows); setCanEdit(!!r.can_edit);
      // список пришёл сразу, а человек ещё ничего не трогал — выбираем гостя заново уже с ними
      if (rows.length && !touched.current && Date.now() - mount.current < 1500) setGuest(pick(mount.current));
    }).catch(() => {});
    return () => { dead = true; };
  }, []);

  const setVoice = (v) => { setVoiceOn(v); try { localStorage.setItem("sa_guest_voice", v ? "1" : "0"); } catch (e) {} };
  // сервер берёт характер гостя по номеру персонажа (id) из своей копии — остальное для старого сервера
  const payload = () => ({ id: guest.id, name: guest.name, age: guest.age, who: guest.who, occasion: guest.occasion, hidden: guest.hidden, mood: guest.mood,
    place: guest.place, table: guest.table, menu: guest.menu, stop: guest.stop });
  // история для модели: гость — assistant, сотрудник — user; первое сообщение — от сотрудника (так требуют модели)
  const history = (list) => [{ role: "user", content: guest.phone ? "*снимает трубку на стойке хостес*" : "*подходит к гостю*" }, ...list.map((m) => ({ role: m.who === "guest" ? "assistant" : "user", content: m.text }))];
  // v31: реплика гостя — потоком (onPart получает текст по мере готовности). Старый сервер
  // отвечает целиком (JSON) — читаем как раньше.
  const call = async (list, finish, onPart) => {
    const r = await fetch(`${SUPABASE_URL}/functions/v1/ai-chat`, {
      method: "POST", headers: { "Content-Type": "application/json", apikey: SUPABASE_KEY, Authorization: "Bearer " + SUPABASE_KEY },
      // v42: track — трек сотрудника: сервер берёт уроки на повтор из него (роль — по месту гостя)
      body: JSON.stringify({ token: saToken(), mode: "guest", guest: payload(), track: role || "", finish: !!finish, stream: !finish && !!onPart, messages: history(list) }),
    });
    const ct = (r.headers && r.headers.get && r.headers.get("content-type")) || "";
    if (/event-stream/i.test(ct) && r.body && r.body.getReader) {
      const reader = r.body.getReader(); const dec = new TextDecoder();
      let buf = "", text = "", bad = null;
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        let i;
        while ((i = buf.indexOf("\n\n")) >= 0) {
          const chunk = buf.slice(0, i); buf = buf.slice(i + 2);
          const line = chunk.split("\n").find((x) => x.indexOf("data:") === 0);
          if (!line) continue;
          let j = null; try { j = JSON.parse(line.slice(5).trim()); } catch (e) { continue; }
          if (!j) continue;
          if (typeof j.t === "string") { text += j.t; if (onPart) onPart(text); }
          if (typeof j.remaining === "number" && j.remaining >= 0) setLeft(j.remaining);
          if (j.done) setOldAi(!(Number(j.v) >= 42));
          if (j.error) bad = j.error;
        }
      }
      if (!text.trim()) throw new Error(bad || "server");
      return text;
    }
    let d = null; try { d = await r.json(); } catch (e) { d = null; }
    if (d && typeof d.remaining === "number" && d.remaining >= 0) setLeft(d.remaining);
    if (d && d.ok) setOldAi(!(Number(d.v) >= 42));
    if (!d || !d.ok || !d.reply) throw new Error((d && d.error) || "server");
    return d.reply;
  };

  const start = (g = guest) => {
    vibrate("light"); touched.current = true;
    t0.current = Date.now(); doneRef.current = false;
    const first = [{ who: "guest", text: g.open }];
    setMsgs(first); setMood(g.mood || 3); setMoods([g.mood || 3]); setEnded(false); setReceipt(null); setPrev(null); setErr(null); setInput(""); setWhisper(false); setPartial("");
    setPhase("talk");
    if (voiceOn) speak(g.open, isFemale(g.name));
  };
  const another = () => { vibrate("light"); touched.current = true; setGuest(pick(Date.now())); setErr(null); };
  // v42: старый ai-chat не знает нового гостя — дальше в этом сеансе гости как в v41; «Другой гость» — сразу к карточке
  const noteBad = (code) => {
    if (code !== "bad_guest" || guest.custom || !NEW_IN_V42.has(guest.id)) return;
    legacyRef.current = true;
    try { sessionStorage.setItem("sa_guest_legacy", "1"); } catch (e) {}
  };
  const anotherAfterErr = () => { vibrate("light"); try { stopSpeech(); } catch (e) {} setTalk(false); setGuest(pick(Date.now())); setMsgs([]); setErr(null); setEnded(false); setPhase("card"); };
  const playOwn = (id) => { touched.current = true; const g = pick(Date.now(), id); setGuest(g); setEditor(false); setErr(null); setPhase("card"); };
  const myTurns = msgs.filter((m) => m.who === "me").length;
  // v42: у входа и у менеджера гость может проститься уже после первой реплики — чек доступен и тогда
  const canFinish = myTurns >= 2 || (ended && myTurns >= 1);

  const send = async (textArg) => {
    const text = String(textArg != null ? textArg : input).trim();
    if (!text || busy || ended) return;
    vibrate("light");
    const list = [...msgs, { who: "me", text }];
    setMsgs(list); setInput(""); setBusy(true); setErr(null); setPartial("");
    try {
      const reply = await call(list, false, (t) => setPartial(streamText(t)));
      const g = parseGuestReply(reply);
      const next = [...list, { who: "guest", text: g.text || "…" }];
      setMsgs(next);
      if (g.mood) setMood(g.mood);
      setMoods((ms) => [...ms, g.mood || ms[ms.length - 1] || 3]);
      if (voiceOn) speak(g.text, female);
      if (g.end || next.filter((m) => m.who === "me").length >= 12) setEnded(true);
    } catch (e) {
      const code = String((e && e.message) || "server") === "Failed to fetch" ? "network" : String((e && e.message) || "server");
      noteBad(code); setErr(code);
    } finally { setBusy(false); setPartial(""); }
  };

  // v34 (Доп. 343): реплика в разговоре голосом — та же, что текстом (в чат, настроение, конец визита),
  // только гостя озвучивает экран разговора (живым голосом или голосом телефона), а не speak()
  const talkTurn = async (text) => {
    const said = String(text || "").trim();
    if (!said) return { text: "" };
    if (endedRef.current) return { text: "", end: true };
    const list = [...msgsRef.current, { who: "me", text: said }];
    msgsRef.current = list;
    setMsgs(list); setBusy(true); setErr(null); setPartial("");
    try {
      const reply = await call(list, false, (t) => setPartial(streamText(t)));
      const g = parseGuestReply(reply);
      const next = [...list, { who: "guest", text: g.text || "…" }];
      msgsRef.current = next;
      setMsgs(next);
      if (g.mood) setMood(g.mood);
      setMoods((ms) => [...ms, g.mood || ms[ms.length - 1] || 3]);
      const over = !!(g.end || next.filter((m) => m.who === "me").length >= 12);
      if (over) { endedRef.current = true; setEnded(true); }
      return { text: g.text || "", end: over };
    } catch (e) {
      const code = String((e && e.message) || "server") === "Failed to fetch" ? "network" : String((e && e.message) || "server");
      noteBad(code); setErr(code);
      throw new Error(guestErrorText(code));
    } finally { setBusy(false); setPartial(""); }
  };
  const openTalk = () => {
    vibrate("light");
    try { stopSpeech(); } catch (e) {}
    try { if (document.activeElement && document.activeElement.blur) document.activeElement.blur(); } catch (e) {}   // клавиатура — вниз
    setTalk(true);
  };

  const finish = async () => {
    if (busy || !canFinish) return;
    vibrate("light");
    try { stopSpeech(); } catch (e) {}
    setPhase("eval"); setErr(null);
    try {
      const reply = await call(msgs, true);
      const rc = parseReceipt(reply, knownLesson, receiptKind(guest));
      if (!rc) throw new Error("receipt");
      setReceipt(rc); setPhase("receipt");
      if (!doneRef.current) {
        doneRef.current = true;
        setPrev(previousRun(runsRef.current, guest.id));
        const items = mistakesForLessons(rc.lessons, modules, mistakeBank);
        if (items.length && onMistakes) onMistakes(items);
        const run = { d: ymd(new Date()), s: rc.score, p: guest.id, ai: true, fix: rc.fix[0] || "" };
        if (whisper) run.w = 1;
        if (moods.length > 1) run.m = moods.slice(-12);
        runsRef.current = saveGuestRun(uk, run);
        try { onActivity && onActivity("guest"); onTouch && onTouch(); } catch (e) {}
        vibrate("success");
      }
    } catch (e) {
      setErr(String((e && e.message) || "server")); setPhase("talk");
    }
  };

  // ── гость по сценарию: ситуации практики трека «у стола» ──
  const scriptSits = React.useMemo(() => pickWarmup(((track && track.length ? track : modules) || []).filter((m) => m && !m.hidden).flatMap((m) => tablePool(m)), 4, "g" + guest.id + Date.now()), [guest.id, phase === "script"]);   // eslint-disable-line react-hooks/exhaustive-deps
  if (phase === "script") {
    return (
      <TableCheck mode="guest" situations={scriptSits} modules={track && track.length ? track : modules} color={color} a11y={a11y} profile={profile} mistakeBank={mistakeBank}
        guest={{ name: guest.name, table: guest.table, line: guest.name + " · " + guest.line, place: guest.place }} onMistakes={onMistakes} onActivity={(k) => onActivity && onActivity(k)}
        onFinish={(res) => {
          runsRef.current = saveGuestRun(uk, { d: ymd(new Date()), s: Math.max(1, Math.min(5, Math.round((res.firstOk / Math.max(1, res.total)) * 5))), p: guest.id, ai: false });
          try { onActivity && onActivity("guest"); onTouch && onTouch(); } catch (e) {}
        }}
        onClose={onClose} inline={inline} />
    );
  }

  const head = (
    <div className="tb-head"><div className="tb-col tb-top">
      <button type="button" className="tb-x" data-sa-back={editor || talk ? undefined : ""} aria-label="Закрыть" onClick={onClose}><Ic n="x" s={18} /></button>
      <div className="tb-host"><span className="tb-av" aria-hidden="true"><Ic n="guest" s={18} /></span>
        <span className="tb-host-t"><b>Живой гость</b><span>{phase === "card" ? "гость — ИИ · " + POS_WORD[guest.place] : guest.name + " · " + guest.line}</span></span></div>
      {phase === "card" ? <TableSound /> : <TableMood m={mood} hall />}
    </div></div>
  );

  if (phase === "card") {
    return tableShell(
      <>
        {head}
        <div className="tb-body"><div className="tb-col">
          <div className="lg-card" role="group" aria-label={"Карточка гостя: " + guest.name}>
            <div className="ey"><span>{ui.eye}</span><span>{new Date().toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}</span></div>
            <h2>{guest.name}</h2>
            <div className="ag">{guest.age} · {guest.occasion}</div>
            <p>{guest.who}.</p>
            {guest.note ? <p className="nt" data-guest-note="">{guest.note}.</p> : null}
            <div className="lg-tags">{guest.tags.map((t) => <span key={t}>{t}</span>)}{guest.custom ? <span className="own">✦ гость заведения</span> : null}</div>
            <TableTop guest={guest} />
          </div>
          {/* v42: кто ты в этой сцене — гость и чек разбора ждут именно этого */}
          <p className="lg-role" data-guest-role={guest.place}>{ui.role}</p>
          <p className="lg-note">Говори как на смене — голосом или текстом. Гость ведёт себя как настоящий: заметит заботу и ошибки. Он может что-то держать в голове и не сказать, пока не спросишь. В конце — чек разбора от Наставника.</p>
          <label className="lg-opt"><input type="checkbox" checked={voiceOn} onChange={(e) => setVoice(e.target.checked)} />Озвучивать гостя</label>
          {canEdit ? <div className="lg-own">Гости заведения: {own.length}<button type="button" onClick={() => setEditor(true)} data-persona-open="">{own.length ? "Изменить" : "Добавить своих"}</button></div>
            : ownHere ? <p className="lg-own">В подборке есть гости вашего заведения: {ownHere}</p> : null}
          {err ? <div className="lg-err" role="alert">{guestErrorText(err)}</div> : null}
        </div></div>
        <div className="tb-foot"><div className="tb-col">
          <button type="button" className="tb-main" onClick={() => start()}>{ui.go}</button>
          <div className="lg-bar">
            <button type="button" className="tb-ghost" onClick={another}>Другой гость</button>
            <button type="button" className="tb-ghost" onClick={() => { vibrate("light"); setPhase("script"); }}>По сценарию</button>
          </div>
        </div></div>
        {editor ? <PersonaEditor rows={own} myPlace={guest.place === "manager" ? "hall" : guest.place} onClose={() => setEditor(false)} onPlay={playOwn}
          onSaved={(row) => { const rows = own.some((x) => x.id === row.id) ? own.map((x) => (x.id === row.id ? row : x)) : own.concat([row]); ownRef.current = rows; setOwn(rows); }}
          onDeleted={(id) => { const rows = own.filter((x) => x.id !== id); ownRef.current = rows; setOwn(rows); if (guest.id === id) setGuest(pick(Date.now())); }} /> : null}
      </>, vars, inline);
  }

  if (phase === "eval") {
    return tableShell(
      <>
        {head}
        <div className="tb-body"><div className="tb-col"><div className="lg-wait" role="status"><Ic n="clipboard" s={28} />Наставник пишет чек разбора…</div></div></div>
      </>, vars, inline);
  }

  if (phase === "receipt" && receipt) {
    const secs = Math.max(1, Math.round((Date.now() - t0.current) / 1000));
    const rc = receipt;
    return tableShell(
      <>
        {head}
        <div className="tb-body" ref={bodyRef}><div className="tb-col">
          <div className="tb-res"><div className="tb-rslot"><div className="tb-rslot-in">
            <div className="tb-receipt" role="group" aria-label="Чек разбора">
              <div className="r-brand">✦ SERVICE ACADEMY ✦</div>
              <div className="r-place">{(profile && profile.restaurant) || "Service Academy"} · {ui.where}</div>
              <div className="r-cut" />
              <h2 className="r-title">Чек разбора</h2>
              <div className="r-name">{guest.name} · {guest.tags.join(" · ")}</div>
              <div className="r-meta">разговор {Math.floor(secs / 60)}:{String(secs % 60).padStart(2, "0")} · реплик {myTurns} · гость {TABLE_MOOD_WORD[mood]}{whisper ? " · с шёпотом наставника" : ""}</div>
              <div className="r-cut" />
              <ul className="r-lines lg-crit">
                {(rc.crit || CRITERIA).map(([k, label]) => <TableLine key={k} label={label} value={stars(rc.scores[k])} />)}
              </ul>
              <div className="r-total"><span>ИТОГ</span><b>{rc.score} / 5</b></div>
              {prev ? <div className="lg-was" data-was=""><span>{prev.same ? "В ПРОШЛЫЙ РАЗ С ЭТИМ ГОСТЕМ" : "ПРОШЛЫЙ РАЗГОВОР"}</span><b>{prev.s} / 5 → {rc.score} / 5 {rc.score > prev.s ? "▲" : rc.score < prev.s ? "▼" : "="}</b></div> : null}
              <MoodLine moods={moods} />
              {rc.good.length ? <><div className="lg-sec">ПОЛУЧИЛОСЬ</div>{rc.good.map((x, i) => <p key={i} className="lg-li">{x}</p>)}</> : null}
              {rc.fix.length ? <><div className="lg-sec">ПОПРАВИТЬ</div>{rc.fix.map((x, i) => <p key={i} className="lg-li">{x}</p>)}</> : null}
              {rc.phrase ? <><div className="lg-sec">МОЖНО БЫЛО СКАЗАТЬ</div><div className="lg-say">«{rc.phrase.replace(/^[«"]|[»"]$/g, "")}»</div></> : null}
              {rc.lessons.length ? (
                <>
                  <div className="lg-sec">ПОВТОРИТЬ</div>
                  <div className="lg-les">{rc.lessons.map((id) => <button key={id} type="button" onClick={() => onOpenLesson && onOpenLesson(id)}><Ic n="book" s={15} /><span>{lessonTitle(id) || "Урок"}</span></button>)}</div>
                  <p className="r-note"><Ic n="refresh" s={14} /><span>Вопросы по этим урокам — в «Работе над ошибками».</span></p>
                </>
              ) : null}
              <TableEdge />
            </div>
          </div></div></div>
        </div></div>
        <div className="tb-foot"><div className="tb-col">
          <button type="button" className="tb-main" onClick={() => { setGuest(pick(Date.now())); setPhase("card"); setMsgs([]); setReceipt(null); }}>Новый гость</button>
          <div className="lg-bar">
            <button type="button" className="tb-ghost" data-guest-again="" onClick={() => start(guest)}>Ещё раз с этим гостем</button>
            <button type="button" className="tb-ghost" onClick={onClose}>Готово</button>
          </div>
        </div></div>
      </>, vars, inline);
  }

  // ── разговор ──
  const canVoice = voiceSupported();
  return tableShell(
    <>
      {head}
      <div className="tb-body" ref={bodyRef}><div className="tb-col">
        <MoodStrip moods={moods} />
        <div className="tb-chat" aria-live="polite">
          {msgs.map((m, i) => m.who === "guest"
            ? <div key={i} className="lg-g tb-new"><b>{guest.name}{talk && talkState === "speaking" && i === msgs.length - 1 ? <TalkSpeaking style={{ marginLeft: 8, color: "var(--gold-ink)" }} /> : null}</b>{m.text}</div>
            : <div key={i} className="tb-mine tb-new">{m.text}</div>)}
          {/* v35: ты говоришь — твой пузырь с точками, пока фраза записывается и распознаётся */}
          {talk && (talkState === "hearing" || talkState === "recognizing") ? <div className="tb-mine tb-new" data-talk-pending=""><TalkDots /></div> : null}
          {busy && partial ? <div className="lg-gp" aria-busy="true"><b>{guest.name}</b><span>{partial}</span></div>
            : busy ? <div className="tb-typing tb-new" aria-label="Гость отвечает"><i /><i /><i /></div> : null}
          {ended ? <div className="tb-actl tb-new">{ui.ended}</div> : null}
        </div>
        {whisper && guest.whisper ? <div className="lg-whisper" role="note"><b><Ic n="mentor" s={13} />ШЁПОТ НАСТАВНИКА</b>{guest.whisper}</div> : null}
        {err ? (
          <div className="lg-err" role="alert">{guestErrorText(err)}
            <div className="lg-bar">
              {err === "bad_guest" ? <button type="button" className="tb-ghost" data-guest-other="" onClick={anotherAfterErr}>Другой гость</button> : null}
              <button type="button" className="tb-ghost" onClick={() => setPhase("script")}>Гость по сценарию</button>
              {canFinish ? <button type="button" className="tb-ghost" onClick={finish}>Чек разбора</button> : null}
            </div>
          </div>
        ) : null}
        {/* v42: роли знает только обновлённый ai-chat — без него гость у входа ведёт себя как с официантом */}
        {oldAi && guest.place !== "hall" ? <p className="lg-note" data-old-ai="">ИИ-гость на сервере ещё прежней версии — может вести себя как с официантом. Руководителю: обновить функцию ai-chat.</p> : null}
        {left != null && left <= 6 ? <p className="lg-note">Живых реплик на сегодня осталось: {left}</p>
          : left != null ? <span className="lg-left" data-left={left}>живых реплик сегодня: {left}</span> : null}
      </div></div>
      <div className="tb-foot"><div className="tb-col">
        {talk ? (
          // v35 (Доп. 344): разговор голосом — полоса на месте поля; гость прощается — она закрывается сама
          <>
            <TalkBar who="guest" name={guest.name} voice={female ? "guest_f" : "guest"} phone={{ pitch: female ? 1.12 : 0.88, rate: 1 }} actions
              first={myTurns === 0 ? guest.open : null} ask={talkTurn} onState={setTalkState} onClose={() => setTalk(false)} />
            <div className="lg-bar">
              {guest.whisper ? <button type="button" className="tb-ghost" data-whisper="" onClick={() => { if (!whisper) { vibrate("light"); setWhisper(true); } }} disabled={whisper}>{whisper ? "Шёпот взят" : "Шёпот наставника"}</button> : null}
              <button type="button" className="tb-ghost" onClick={() => { setTalk(false); finish(); }} disabled={busy || !canFinish}>{ui.finish}</button>
            </div>
          </>
        ) : ended ? (
          <button type="button" className="tb-main" onClick={finish}>Получить чек разбора</button>
        ) : (
          <>
            <div className="lg-row">
              <textarea className="lg-in" rows={1} value={input} placeholder="Что скажешь гостю?" aria-label="Твоя реплика гостю"
                onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }} disabled={busy} />
              {canVoice ? <MicButton a11y={a11y} size={46} sttUrl={`${SUPABASE_URL}/functions/v1/stt`} headers={{ apikey: SUPABASE_KEY, Authorization: "Bearer " + SUPABASE_KEY }}
                onText={(t) => setInput((v) => (v ? v + " " : "") + t)} onBusy={setMicBusy} onError={() => {}} /> : null}
              {/* v34 (Доп. 343): поле пустое — на месте «Сказать» кнопка-волна «Разговор голосом» */}
              {!input.trim() && talkOk ? <TalkButton size={46} disabled={busy || micBusy} onClick={openTalk} label="Разговор голосом с гостем" />
                : <button type="button" className="lg-send" onClick={() => send()} disabled={busy || !input.trim()} aria-label="Сказать"><Ic n="send" s={18} /></button>}
            </div>
            <div className="lg-bar">
              {guest.whisper ? <button type="button" className="tb-ghost" data-whisper="" onClick={() => { if (!whisper) { vibrate("light"); setWhisper(true); } }} disabled={whisper}>{whisper ? "Шёпот взят" : "Шёпот наставника"}</button> : null}
              <button type="button" className="tb-ghost" onClick={finish} disabled={busy || !canFinish}>{ui.finish}</button>
            </div>
          </>
        )}
      </div></div>
    </>, vars, inline);
}

export default LiveGuestScreen;
