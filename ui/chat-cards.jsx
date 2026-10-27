// ui/chat-cards.jsx — v93 (Доп. 406): умный чат. Сообщение-карточка делает дело в приложении:
//   • смена: «Отдаю смену» с кнопкой «Забрать» и «Меняю смену» с «Поменяться» — у тех, кто правда может (решает сервер
//     по графику); график меняется сразу, без подтверждения, руководитель получает сообщение (владелец: «без
//     подтверждения руководителя, но что бы руководитель видел»);
//   • задание: «пройти урок «…» до пятницы» — «Открыть урок», «прошли 3 из 8», «Напомнить остальным»;
//   • «поделиться»: блюдо, коктейль, карточка справочника, урок — нажатие открывает в приложении;
//   • опрос, стоп-лист (в Меню у всех сразу помечено), брифинг смены карточкой;
//   • Наставник в переписке: «@Наставник, какие аллергены в тартаре?» — отвечает всем, текстом и карточкой блюда;
//   • «+» в строке ввода — все действия; подсказки над строкой ввода по тексту («кто может выйти в субботу?»).
// Сеть — api (lib/chat-api.js, демо — tools/claude/chat-demo/demo-api.js), то, что знает приложение (уроки, меню,
// брифинг, открыть экран), — app (App.jsx, демо — entry.jsx). Расчёт — lib/chat-smart.js.
import React from "react";
import { vibrate } from "../lib/utils";
import { bubbleName, hhmm, quoteText } from "../lib/chat";
import { shiftState, shiftLine, wantLine, dayLong, dayShort, dayParts, nextDays, taskLine, dueLine, dueChoices, pollView, pollProblem, POLL_MAX, actTiles, INTENT_LABEL, AI_NAME, aiQuestion } from "../lib/chat-smart";
import { IC, stop } from "./chat-kit";

export const CARDS_CSS = `
/* v93: умные карточки */
/* «Билет» (выбор владельца): золотой корешок слева — дата смены, кольцо задания, голоса опроса, значок или фото;
   перфорация и вырезы сверху и снизу; закрытая карточка — корешок гаснет, стоп-лист — красный */
.ch-card{position:relative;display:flex;align-items:stretch;width:100%;max-width:440px;border-radius:16px;overflow:hidden;background:var(--card);border:1px solid rgba(214,178,102,0.42);
  box-shadow:0 8px 22px rgba(0,0,0,0.32);text-align:left;cursor:pointer;color:var(--text)}
.ch-card::before,.ch-card::after{content:"";position:absolute;left:66px;width:16px;height:16px;border-radius:50%;background:var(--bg);box-shadow:inset 0 0 0 1px rgba(214,178,102,0.42);z-index:1}
.ch-card::before{top:-9px}
.ch-card::after{bottom:-9px}
.ch-card-tile{display:flex;flex:0 0 74px;align-items:center;justify-content:center;border-right:2px dashed rgba(26,16,8,0.3);
  background:linear-gradient(165deg,var(--gold-hi),var(--gold));color:var(--on-gold);box-shadow:inset -10px 0 18px rgba(26,16,8,0.08),inset 0 1px 0 rgba(255,255,255,0.4)}
.ch-card-main{flex:1;min-width:0;padding:11px 14px 12px}
.lt .ch-card{border-color:rgba(139,106,48,0.42);box-shadow:0 6px 18px rgba(120,85,25,0.16)}
.lt .ch-card::before,.lt .ch-card::after{box-shadow:inset 0 0 0 1px rgba(139,106,48,0.42)}
.ch-sheet .ch-card::before,.ch-sheet .ch-card::after{display:none}
.ch-card.done{border-color:var(--edge)}
.ch-card.done .ch-card-tile{background:linear-gradient(165deg,#9A907B,#776D59);color:#1E1A12}
.lt .ch-card.done .ch-card-tile{background:linear-gradient(165deg,#D8CDB5,#BCAF94);color:#3A2F1C}
.ch-card.stopc{border-color:rgba(224,120,120,0.55)}
.ch-card.stopc .ch-card-tile{background:linear-gradient(165deg,#F09A8E,#B8352A);color:#fff;border-right-color:rgba(255,255,255,0.45)}
.ch-card-h{display:flex;align-items:center;gap:7px;color:var(--gold-ink);font-size:12.5px;line-height:1.3;min-width:0}
.ch-card-h svg{flex:0 0 auto;width:18px;height:18px}
.ch-card-k{text-transform:uppercase;letter-spacing:.9px;font-weight:700;font-size:11.5px;white-space:nowrap}
.ch-card-w{color:var(--faint);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-width:0}
.ch-card.stopc .ch-card-h{color:var(--bad-ink)}
.ch-card-t{margin:6px 0 2px;font-family:'Piazzolla',Georgia,serif;font-weight:700;font-size:17px;line-height:1.3;color:var(--text)}
.ch-card-s{font-size:14px;line-height:1.4;color:var(--sub)}
.ch-card-n{margin-top:6px;font-size:14px;line-height:1.4;color:var(--text);font-style:italic}
.ch-card-st{display:flex;align-items:flex-start;gap:6px;margin-top:8px;font-size:13.5px;line-height:1.35;color:var(--sub)}
.ch-card-st svg{flex:0 0 auto;width:16px;height:16px;margin-top:1px}
.ch-card-st.ok{color:var(--ok-ink)}
.ch-done-l{margin-top:0;align-self:center}
.ch-acts2{margin-top:8px}
.ch-card-acts{display:flex;flex-wrap:wrap;gap:8px;margin-top:10px}
.ch-cbtn{min-height:40px;padding:0 18px;border-radius:999px;border:0;background:linear-gradient(180deg,var(--gold-hi),var(--gold));color:var(--on-gold);font-weight:700;font-size:15px;cursor:pointer;
  box-shadow:0 3px 10px rgba(0,0,0,0.22),inset 0 1px 0 rgba(255,255,255,0.35)}
.ch-cbtn.ghost{background:none;border:1px solid var(--opt-edge);color:var(--gold-ink);box-shadow:none;font-weight:400}
.ch-cbtn.bad{background:none;border:1px solid rgba(224,120,120,0.55);color:var(--bad-ink);box-shadow:none;font-weight:400}
.ch-cbtn:disabled{opacity:.55}
.ch-cbtn.sm{min-height:34px;padding:0 13px;font-size:14px}
.ch-card-acts .ch-cbtn.wide{flex:1 1 100%}
.ch-who-l{margin-top:8px;font-size:13.5px;line-height:1.5;color:var(--sub)}
.ch-who-l b{color:var(--text);font-weight:400}
.ch-poll{display:flex;flex-direction:column;gap:7px;margin-top:9px}
.ch-po{position:relative;display:block;width:100%;padding:8px 12px;border-radius:12px;border:1px solid var(--opt-edge);background:var(--opt);text-align:left;cursor:pointer;overflow:hidden;color:var(--text)}
.ch-po[aria-pressed="true"]{border-color:var(--gold)}
.ch-po-bar{position:absolute;left:0;top:0;bottom:0;background:rgba(214,178,102,0.2);transition:width .3s ease}
.ch-po[aria-pressed="true"] .ch-po-bar{background:rgba(214,178,102,0.32)}
.ch-po-r{position:relative;display:flex;align-items:baseline;gap:8px}
.ch-po-t{flex:1;min-width:0;display:inline-flex;align-items:center;gap:5px;font-size:15px;line-height:1.3}
.ch-po-t svg{flex:0 0 auto;width:15px;height:15px;color:var(--gold-ink)}
.ch-po-n{flex:0 0 auto;font-family:system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;font-size:13px;font-weight:700;color:var(--gold-ink);font-variant-numeric:tabular-nums}
.ch-po-w{position:relative;margin-top:2px;font-size:12px;line-height:1.3;color:var(--faint)}
.ch-brief{margin:6px 0 0;padding:0 0 0 18px;font-size:14.5px;line-height:1.5;color:var(--text)}
.ch-brief li::marker{color:var(--gold-ink)}
/* Наставник в переписке */
.ch-ai-nm{display:inline-flex;align-items:center;gap:6px;margin:0 0 3px 4px;font-size:13px;line-height:1.2;color:var(--gold-ink);font-style:italic}
.ch-ai-nm .ch-ai-d{width:20px;height:20px;border-radius:50%;display:grid;place-items:center;background:linear-gradient(180deg,var(--gold-hi),var(--gold));color:var(--on-gold)}
.ch-ai-nm .ch-ai-d svg{width:15px;height:15px}
.ch-b.ai{border:1px solid var(--edge-gold)}
.ch-ai-for{display:block;margin:0 0 4px;font-size:12.5px;color:var(--faint);font-style:italic}
.ch-mini{display:flex;align-items:center;gap:10px;width:100%;margin-top:8px;padding:7px 9px;border-radius:12px;border:1px solid var(--opt-edge);background:var(--opt);text-align:left;cursor:pointer;color:var(--text)}
.ch-mini img,.ch-mini .ic{width:40px;height:40px;flex:0 0 auto;border-radius:9px;object-fit:cover;display:grid;place-items:center;background:rgba(214,178,102,0.14);color:var(--gold-ink)}
.ch-mini-b{flex:1;min-width:0;display:flex;flex-direction:column}
.ch-mini-t{font-size:14.5px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.ch-mini-s{font-size:12.5px;color:var(--sub);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.ch-typing{align-self:flex-start;display:inline-flex;align-items:center;gap:8px;margin:9px 0 0 6px;padding:7px 12px;border-radius:16px;background:var(--in);color:var(--sub);font-size:13.5px;font-style:italic}
.ch-typing i{width:6px;height:6px;border-radius:50%;background:var(--gold);animation:chDot 1.2s ease-in-out infinite}
.ch-typing i:nth-child(2){animation-delay:.2s}.ch-typing i:nth-child(3){animation-delay:.4s}
@keyframes chDot{0%,80%,100%{opacity:.25;transform:translateY(0)}40%{opacity:1;transform:translateY(-3px)}}
.ch-sys.log{cursor:default;align-items:flex-start;text-align:left;line-height:1.4;border-radius:14px;padding:6px 12px}
.ch-sys.log svg{width:16px;height:16px;flex:0 0 auto;margin-top:2px}
.ch-sys.log span{white-space:normal;overflow:visible}
/* «+» и подсказки */
.ch-tiles{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}
.ch-tile{display:flex;flex-direction:column;align-items:center;gap:7px;padding:12px 4px 10px;border-radius:16px;border:1px solid var(--opt-edge);background:var(--opt);color:var(--text);font-size:13.5px;line-height:1.2;text-align:center;cursor:pointer;min-width:0}
.ch-tile-i{width:44px;height:44px;border-radius:50%;display:grid;place-items:center;background:linear-gradient(180deg,var(--gold-hi),var(--gold));color:var(--on-gold)}
.ch-sugg{display:flex;gap:6px;max-width:640px;margin:0 auto 7px;overflow-x:auto;scrollbar-width:none;padding:0 2px}
.ch-sugg::-webkit-scrollbar{display:none}
.ch-sg{flex:0 0 auto;display:inline-flex;align-items:center;gap:6px;height:32px;padding:0 12px 0 9px;border-radius:999px;border:1px solid var(--edge-gold);background:rgba(214,178,102,0.12);color:var(--gold-ink);font-size:13.5px;cursor:pointer}
.ch-sg svg{width:16px;height:16px}
/* выбор */
.ch-opt{display:flex;align-items:center;gap:12px;width:100%;padding:11px 10px;margin-top:6px;border-radius:14px;border:1px solid var(--opt-edge);background:var(--opt);color:var(--text);text-align:left;cursor:pointer}
.ch-opt[aria-pressed="true"]{border-color:var(--gold);background:rgba(214,178,102,0.16)}
.ch-opt-i{width:38px;height:38px;flex:0 0 auto;border-radius:11px;display:grid;place-items:center;background:rgba(214,178,102,0.14);color:var(--gold-ink);overflow:hidden}
.ch-opt-i img{width:100%;height:100%;object-fit:cover}
.ch-opt-b{flex:1;min-width:0;display:flex;flex-direction:column;gap:1px}
.ch-opt-t{font-size:15.5px;line-height:1.3}
.ch-opt-s{font-size:12.5px;line-height:1.3;color:var(--sub)}
.ch-hint{margin:8px 2px 0;font-size:13px;line-height:1.45;color:var(--faint);font-style:italic}
.ch-po-in{display:flex;gap:6px;align-items:center}
.ch-po-in .ch-field{flex:1}
/* корешок: дата, кольцо задания, число голосов, значок или фото с подписью */
.ch-tl{position:relative;display:flex;flex-direction:column;align-items:center;justify-content:center;width:62px;color:inherit;text-align:center}
.ch-tl-d i{font-style:normal;font-size:10.5px;line-height:1.15;letter-spacing:1.2px;text-transform:uppercase;opacity:.9}
.ch-tl-d b{font-family:'Piazzolla',Georgia,serif;font-size:31px;line-height:1;margin:2px 0 1px;font-weight:700}
.ch-tl-d .ch-tl-ic{display:inline-flex;margin-bottom:3px;opacity:.85}
.ch-tl-d .ch-tl-ic svg{width:18px;height:18px}
.ch-tl-r b{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-family:'Piazzolla',Georgia,serif;font-size:16px;font-weight:700}
.ch-tl-r b i{font-style:normal;font-size:11px;font-weight:400;opacity:.8;margin-left:1px}
.ch-ring-bg{fill:none;stroke:rgba(26,16,8,0.16);stroke-width:4.5}
.ch-ring{fill:none;stroke:currentColor;stroke-width:4.5;stroke-linecap:round;transition:stroke-dashoffset .5s ease}
.ch-tl-box{position:relative;width:48px;height:48px;border-radius:13px;overflow:hidden;display:grid;place-items:center}
.ch-tl-box svg{width:26px;height:26px}
.ch-tl-box img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;box-shadow:inset 0 0 0 1px rgba(26,16,8,0.2)}
.ch-card.stopc .ch-tl-box img{filter:grayscale(1)}
.ch-tl-i i{margin-top:6px;font-style:normal;font-size:10px;line-height:1.15;letter-spacing:1.2px;text-transform:uppercase}
/* карточки в ответе Наставника — с золотым значком, как корешок */
.ch-mini .ic{background:linear-gradient(165deg,var(--gold-hi),var(--gold));color:var(--on-gold)}
.ch-toast{position:absolute;left:50%;bottom:calc(84px + var(--sa-sb,env(safe-area-inset-bottom,0px)));transform:translateX(-50%);z-index:30;max-width:88%;padding:9px 14px;border-radius:14px;background:var(--card);border:1px solid var(--edge-gold);
  color:var(--text);font-size:14px;line-height:1.35;box-shadow:0 8px 24px rgba(0,0,0,0.35);text-align:center;animation:chToast .3s ease both}
@keyframes chToast{from{opacity:0;transform:translate(-50%,10px)}to{opacity:1;transform:translate(-50%,0)}}
`;

const KIND = { dish: ["Блюдо", IC.dish], cocktail: ["Коктейль", IC.glass], ref: ["Справочник", IC.book], lesson: ["Урок", IC.play], quiz: ["Тест", IC.task], module: ["Тема", IC.book], brief: ["Брифинг", IC.brief] };
const OPEN = { dish: "Открыть в Меню", cocktail: "Открыть в Колоде", ref: "Открыть в Справочнике", lesson: "Открыть урок", quiz: "Открыть тест", module: "Открыть тему" };
const kindName = (k) => (KIND[k] || ["Карточка"])[0];
const kindIc = (k) => (KIND[k] || [null, IC.share])[1];
const who = (m, me) => (m && me && String(m.emp) === String(me.id) ? "ты" : bubbleName(m && m.name));
const cap = (s) => String(s || "").replace(/^./, (x) => x.toUpperCase());

// ── карточка в ленте ──
// «Билет» (владелец выбрал из трёх): слева золотой корешок — дата смены, кольцо задания, голоса опроса, значок или фото
// с подписью; справа — суть и кнопки.
function Head({ k, m, me }) {
  return <div className="ch-card-h"><span className="ch-card-k">{k}</span><span className="ch-card-w">· {who(m, me)} · {hhmm(m.at)}</span></div>;
}
function DateTile({ iso }) {
  const p = dayParts(iso);
  return <span className="ch-tl ch-tl-d" aria-hidden="true"><i>{p.wd}</i><b>{p.d}</b><i>{p.mon}</i></span>;
}
function RingTile({ n, of }) {
  const r = 21, L = 2 * Math.PI * r, f = of ? Math.min(1, n / of) : 0;
  return (
    <span className="ch-tl ch-tl-r" aria-hidden="true">
      <svg viewBox="0 0 52 52" width="52" height="52"><circle cx="26" cy="26" r={r} className="ch-ring-bg" /><circle cx="26" cy="26" r={r} className="ch-ring" strokeDasharray={L} strokeDashoffset={L * (1 - f)} transform="rotate(-90 26 26)" /></svg>
      <b>{n}<i>/{of}</i></b>
    </span>);
}
const IcoTile = ({ ic, img, cap: c }) => <span className="ch-tl ch-tl-i" aria-hidden="true"><span className="ch-tl-box">{img ? <img src={img} alt="" /> : ic}</span>{c ? <i>{c}</i> : null}</span>;
const NumTile = ({ ic, n, word }) => <span className="ch-tl ch-tl-d" aria-hidden="true"><span className="ch-tl-ic">{ic}</span><b>{n}</b><i>{word}</i></span>;
const votesWord = (n) => { const m10 = n % 10, m100 = n % 100; return m10 === 1 && m100 !== 11 ? "голос" : m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20) ? "голоса" : "голосов"; };
const St = ({ ok, wait, children, ...rest }) => <div className={"ch-card-st" + (ok ? " ok" : "")} {...rest}>{ok ? IC.check : wait ? IC.clock : null}<span>{children}</span></div>;

export function CardMsg({ row, me, app, busy, hl, showWho = false, onAct, onMenu }) {
  const m = row.m, c = m.card || {};
  const open = () => { if (!m.del) onMenu(m); };
  const act = (a, extra) => (e) => { e.stopPropagation(); vibrate("light"); onAct(m, a, extra); };
  const wrap = (cls, tile, body) => (
    <div className={"ch-row mid" + (hl ? " hl" : "")} data-chat-msg={m.id}>
      <div className={"ch-card " + cls} data-chat-card={c.t} role="group" tabIndex={0} onClick={open} onKeyDown={(e) => { if ((e.key === "Enter" || e.key === " ") && e.target === e.currentTarget) { e.preventDefault(); open(); } }}>
        <div className="ch-card-tile">{tile}</div>
        <div className="ch-card-main">{body}</div>
      </div>
    </div>);
  if (c.t === "shift") {
    const s = shiftState(c, me), swap = c.mode === "swap";
    return wrap(s.done ? "done" : "", <DateTile iso={c.date} />, <>
      <Head k={s.head} m={m} me={me} />
      <div className="ch-card-t" data-chat-shift-when="">{cap([String(c.label || "").toLowerCase(), c.time].filter(Boolean).join(" "))}</div>
      <div className="ch-card-s">{[dayLong(c.date).split(",")[0], c.pos].filter(Boolean).join(" · ")}</div>
      {swap && c.st === "open" ? <div className="ch-card-s ch-card-want" data-chat-shift-want="">{wantLine(c.want)}</div> : null}
      {c.note ? <div className="ch-card-n">«{c.note}»</div> : null}
      <St ok={c.st === "done"} wait={c.st === "open" && s.mine} data-chat-shift-st={c.st}>{s.line}</St>
      {s.act ? <div className="ch-card-acts">
        {s.act === "take" ? <button type="button" className="ch-cbtn" data-chat-take={m.id} disabled={busy} onClick={act("take")}>Забрать</button> : null}
        {s.act === "swap" ? <button type="button" className="ch-cbtn" data-chat-swap={m.id} disabled={busy} onClick={act("swap")}>Поменяться</button> : null}
        {s.act === "cancel" ? <button type="button" className="ch-cbtn ghost" data-chat-shift-cancel={m.id} disabled={busy} onClick={act("cancel")}>Отменить</button> : null}
      </div> : null}
    </>);
  }
  if (c.t === "task") {
    const it = c.item || {}, done = app && app.done ? app.done(it) : false, n = Number(c.n) || 0, of = Number(c.of) || 0, lead = !!(me && me.lead);
    return wrap(done ? "done" : "", of ? <RingTile n={n} of={of} /> : <IcoTile ic={kindIc(it.kind)} />, <>
      <Head k="Задание" m={m} me={me} />
      <div className="ch-card-t">{kindName(it.kind)} «{it.title}»</div>
      <div className="ch-card-s">{[it.mins ? it.mins + " мин" : "", it.sub, dueLine(c.due)].filter(Boolean).join(" · ")}</div>
      {of ? <div className="ch-card-st" data-chat-task-n={n}><span>{taskLine(c)}</span></div> : null}
      {lead && Array.isArray(c.left) && c.left.length && showWho ? <div className="ch-who-l" data-chat-task-left="">Ещё не прошли: <b>{c.left.map(bubbleName).join(", ")}</b></div> : null}
      <div className="ch-card-acts">
        {done ? <span className="ch-card-st ok ch-done-l" data-chat-task-done="">{IC.check}<span>Пройдено</span></span>
          : <button type="button" className="ch-cbtn" data-chat-open={it.kind} onClick={act("open", it)}>{OPEN[it.kind] || "Открыть"}</button>}
      </div>
      {lead && of && n < of ? <div className="ch-card-acts ch-acts2">
        <button type="button" className="ch-cbtn ghost sm" data-chat-remind={m.id} disabled={busy || c.reminded} onClick={act("remind")}>{c.reminded ? "Напомнили" : "Напомнить"}</button>
        {!showWho ? <button type="button" className="ch-cbtn ghost sm" data-chat-task-who={m.id} onClick={act("who")}>Кто не прошёл</button> : null}
      </div> : null}
    </>);
  }
  if (c.t === "share") {
    const it = c.item || {};
    return wrap("", <IcoTile ic={kindIc(it.kind)} img={it.img} cap={kindName(it.kind)} />, <>
      <Head k={kindName(it.kind)} m={m} me={me} />
      <div className="ch-card-t">{it.title}</div>
      {it.sub ? <div className="ch-card-s">{it.sub}</div> : null}
      {c.note ? <div className="ch-card-n">{c.note}</div> : null}
      <div className="ch-card-acts"><button type="button" className="ch-cbtn ghost" data-chat-open={it.kind} onClick={act("open", it)}>{OPEN[it.kind] || "Открыть"}</button></div>
    </>);
  }
  if (c.t === "poll") {
    const v = pollView(c, me && me.id);
    return wrap("", <NumTile ic={IC.poll} n={v.total} word={votesWord(v.total)} />, <>
      <Head k="Опрос" m={m} me={me} />
      <div className="ch-card-t">{c.q}</div>
      <div className="ch-poll" role="group" aria-label="Варианты">
        {v.opts.map((o) => (
          <button key={o.i} type="button" className="ch-po" aria-pressed={o.mine} data-chat-vote={o.i} disabled={busy} onClick={act("vote", o.i)}>
            <span className="ch-po-bar" style={{ width: o.pct + "%" }} aria-hidden="true" />
            <span className="ch-po-r"><span className="ch-po-t">{o.mine ? IC.check : null}{o.text}</span><span className="ch-po-n">{o.n}</span></span>
            {o.names.length ? <span className="ch-po-w">{o.names.join(", ")}</span> : null}
          </button>))}
      </div>
      <div className="ch-card-st" data-chat-poll-total={v.total}><span>{v.total ? "Голосов: " + v.total : "Пока никто не ответил"}{v.voted ? " · нажми на свой вариант ещё раз, чтобы снять" : ""}</span></div>
    </>);
  }
  if (c.t === "stop") {
    const off = c.st === "off", lead = !!(me && me.lead), d = c.dish || {};
    return wrap(off ? "done" : "stopc", <IcoTile ic={IC.stop} img={d.img} cap={off ? "в меню" : "стоп"} />, <>
      <Head k={off ? "Снова в меню" : "Стоп-лист"} m={m} me={me} />
      <div className="ch-card-t">{d.name}</div>
      <div className="ch-card-s">{off ? "Снова можно предлагать гостям" + (c.offBy ? " · " + bubbleName(c.offBy) : "") : "В Меню у всех помечено «в стопе»"}</div>
      <div className="ch-card-acts">
        <button type="button" className="ch-cbtn ghost" data-chat-open="dish" onClick={act("open", { kind: "dish", id: d.id, title: d.name })}>Открыть в Меню</button>
        {!off && lead ? <button type="button" className="ch-cbtn bad" data-chat-unstop={m.id} disabled={busy} onClick={act("unstop")}>Вернуть в меню</button> : null}
      </div>
    </>);
  }
  if (c.t === "brief") {
    return wrap("", <DateTile iso={c.date} />, <>
      <Head k="Брифинг смены" m={m} me={me} />
      <div className="ch-card-t">{c.title || cap(dayLong(c.date))}</div>
      <ul className="ch-brief">{(c.lines || []).slice(0, 8).map((l, i) => <li key={i}>{l}</li>)}</ul>
      <div className="ch-card-acts"><button type="button" className="ch-cbtn ghost" data-chat-open="brief" onClick={act("open", { kind: "brief", id: c.date, title: "Брифинг" })}>Открыть брифинг</button></div>
    </>);
  }
  return wrap("done", <IcoTile ic={IC.share} />, <><Head k="Карточка" m={m} me={me} /><div className="ch-card-s">Эта карточка откроется в новой версии приложения.</div></>);
}

// ── Наставник в переписке ──
export function AiMsg({ row, me, hl, onAct, onMenu }) {
  const m = row.m, cards = (m.card && Array.isArray(m.card.cards)) ? m.card.cards : [];
  return (
    <div className={"ch-row in" + (hl ? " hl" : "")} data-chat-msg={m.id} data-chat-ai="">
      <div className="ch-ai-nm" aria-hidden="true"><span className="ch-ai-d">{IC.ai}</span>{AI_NAME}</div>
      <div className="ch-b ch-in ai" role="group" tabIndex={0} data-chat-bubble="" onClick={() => onMenu(m)} aria-label={AI_NAME + ", " + hhmm(m.at) + ": " + (m.body || "")}>
        {m.reply ? <span className="ch-ai-for" data-chat-ai-q={m.reply.id}>{who(m.reply, me)}: {aiQuestion(quoteText(m.reply, me && me.id))}</span> : null}
        <span className="ch-tx">{m.body}</span>
        {cards.map((it, i) => (
          <button key={i} type="button" className="ch-mini" data-chat-open={it.kind} onClick={(e) => { e.stopPropagation(); vibrate("light"); onAct(m, "open", it); }}>
            {it.img ? <img src={it.img} alt="" /> : <span className="ic" aria-hidden="true">{kindIc(it.kind)}</span>}
            <span className="ch-mini-b"><span className="ch-mini-t">{it.title}</span><span className="ch-mini-s">{it.sub || OPEN[it.kind] || kindName(it.kind)}</span></span>
          </button>))}
        <i className="ch-sp" aria-hidden="true" />
        <span className="ch-meta" aria-hidden="true">{hhmm(m.at)}</span>
      </div>
    </div>);
}
export const AiTyping = () => <div className="ch-typing" role="status" data-chat-ai-typing="">{AI_NAME} печатает<i /><i /><i /></div>;

// ── «+»: все действия ──
const TILE_IC = { photo: IC.photo, give: IC.give, swap: IC.swap, task: IC.task, share: IC.share, poll: IC.poll, stop: IC.stop, brief: IC.brief, ai: IC.ai };
export function ActSheet({ me, chat, onPick, onClose }) {
  const tiles = actTiles(me, chat);
  return (
    <div className="ch-veil" onClick={onClose}>
      <div className="ch-sheet" role="dialog" aria-modal="true" aria-label="Действия" data-chat-acts="" onClick={stop}>
        <div className="ch-grip" aria-hidden="true" />
        <div className="ch-tiles">{tiles.map((t) => (
          <button key={t.id} type="button" className="ch-tile" data-chat-act={t.id} onClick={() => { vibrate("light"); onPick(t.id); }}>
            <span className="ch-tile-i" aria-hidden="true">{TILE_IC[t.id]}</span>{t.label}</button>))}</div>
        <div className="ch-hint">Карточки делают дело сами: смену можно забрать одним нажатием, урок открывается из чата, а {AI_NAME} отвечает прямо в переписке.</div>
      </div>
    </div>);
}
export function Suggest({ items, onPick }) {
  if (!items || !items.length) return null;
  return (
    <div className="ch-sugg" role="group" aria-label="Подсказки" data-chat-sugg="">
      {items.map((k) => <button key={k} type="button" className="ch-sg" data-chat-sg={k} onClick={() => { vibrate("light"); onPick(k); }}>{TILE_IC[k] || IC.spark}{INTENT_LABEL[k]}</button>)}
    </div>);
}

// ── листы ──
function Sheet({ title, data, onClose, children }) {
  return (
    <div className="ch-veil" onClick={onClose}>
      <div className="ch-sheet" role="dialog" aria-modal="true" aria-label={title} {...data} onClick={stop}>
        <div className="ch-grip" aria-hidden="true" />
        <div className="ch-sheet-h"><span className="ch-sheet-t">{title}</span><button type="button" className="ch-x" data-sa-back="" aria-label="Закрыть" onClick={onClose}>{IC.x}</button></div>
        {children}
      </div>
    </div>);
}
// ошибки сервера словами; not_allowed — с причиной от сервера (правила графика)
const ERR = {
  taken: "Смену уже забрали.", busy: "В этот день ты уже работаешь по графику.", already: "Эту смену ты уже предлагаешь в чате.",
  no_shift: "В этот день у тебя нет смены по графику.", not_in_schedule: "Тебя нет в графике заведения. Попроси руководителя добавить.",
  no_schedule: "График смен ещё не заполнен.", forbidden: "Это могут руководитель и старший.", no_menu: "Меню заведения ещё не опубликовано.",
  not_found: "Не нашёл: карточку удалили или блюда нет в опубликованном меню.", ai_limit: AI_NAME + " на сегодня ответил уже 30 раз. Завтра снова.",
  limit: AI_NAME + " на сегодня ответил уже много раз. Завтра снова.", no_ai: AI_NAME + " сейчас недоступен.", ai: AI_NAME + " не ответил. Спроси ещё раз.",
  too_fast: "Слишком часто. Подожди минуту.", bad_request: "Не получилось: проверь, что всё заполнено.", net: "Нет связи. Попробуй ещё раз.",
  missing: "На сервере старая версия чата. Руководителю: перезапустить этап 38.",
};
const errText = (r, ctx = "") => {
  const e = r && r.error;
  if (e === "not_allowed") return (r.why ? String(r.why).replace(/\.?$/, ".") : "Эту смену взять нельзя: другая должность или правила графика.");
  if (e === "too_fast" && ctx === "remind") return "Напоминали недавно. Следующее через 3 часа.";
  return ERR[e] || "Не получилось. Проверь связь.";
};
export { errText as smartErr };

// отдать или поменяться: моя смена из графика (и для обмена — какие дни взамен), записка
export function ShiftSheet({ api, chat, mode, onClose, onDone }) {
  const swap = mode === "swap";
  const [list, setList] = React.useState(null);
  const [pick, setPick] = React.useState(null);
  const [want, setWant] = React.useState(() => new Set());
  const [note, setNote] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState("");
  React.useEffect(() => {
    let alive = true;
    Promise.resolve(api.shiftsMine()).then((r) => { if (!alive) return; if (r && r.ok) setList(r.shifts || []); else { setList([]); setErr(errText(r)); } }).catch(() => { if (alive) { setList([]); setErr(errText({ error: "net" })); } });
    return () => { alive = false; };
  }, [api]);
  const days = React.useMemo(() => nextDays(14).filter((d) => !pick || d !== pick.date), [pick]);
  const go = () => {
    if (!pick || busy) return;
    setBusy(true); setErr("");
    Promise.resolve(api.shiftOffer(chat.id, { date: pick.date, venue: pick.venue, mode, want: swap ? [...want].sort() : [], note: note.trim() }))
      .then((r) => { setBusy(false); if (r && r.ok && r.msg) onDone(r.msg); else setErr(errText(r)); }).catch(() => { setBusy(false); setErr(errText({ error: "net" })); });
  };
  return (
    <Sheet title={swap ? "Поменяться сменой" : "Отдать смену"} data={{ "data-chat-shiftsheet": mode }} onClose={onClose}>
      <div className="ch-lbl" style={{ marginTop: 0 }}>Твоя смена</div>
      {!list ? <div className="ch-hint">Загружаю график…</div> : !list.length && !err ? <div className="ch-hint" data-chat-noshifts="">В графике на ближайший месяц у тебя нет смен.</div> : null}
      {(list || []).map((s) => (
        <button key={s.date + s.venue} type="button" className="ch-opt" aria-pressed={!!pick && pick.date === s.date && pick.venue === s.venue} data-chat-myshift={s.date} onClick={() => { vibrate("light"); setPick(s); }}>
          <span className="ch-opt-i" aria-hidden="true">{IC.give}</span>
          <span className="ch-opt-b"><span className="ch-opt-t">{cap(dayLong(s.date))}</span><span className="ch-opt-s">{[[String(s.label || "").toLowerCase(), s.time].filter(Boolean).join(" "), s.pos].filter(Boolean).join(" · ")}</span></span>
        </button>))}
      {swap && pick ? (<>
        <div className="ch-lbl">Какие дни возьмёшь взамен</div>
        <div className="ch-chips">
          <button type="button" className="ch-chip" aria-pressed={!want.size} data-chat-want="any" onClick={() => setWant(new Set())}>Любой день</button>
          {days.map((d) => <button key={d} type="button" className="ch-chip" aria-pressed={want.has(d)} data-chat-want={d} onClick={() => setWant((w) => { const n = new Set(w); if (n.has(d)) n.delete(d); else n.add(d); return n; })}>{dayShort(d)}</button>)}
        </div>
      </>) : null}
      {pick ? <input className="ch-field sa-field" value={note} maxLength={120} onChange={(e) => setNote(e.target.value)} placeholder="Пара слов коллегам (можно без них)" aria-label="Записка" data-chat-shiftnote="" /> : null}
      {err ? <div className="ch-err" role="alert" style={{ marginTop: 8 }}>{err}</div> : null}
      <button type="button" className="ch-main" data-chat-shiftgo="" disabled={!pick || busy} onClick={go}>{busy ? "Отправляю…" : swap ? "Предложить обмен" : "Предложить смену"}</button>
      <div className="ch-hint">{swap ? "Коллега той же должности выберет свою смену взамен, и график поменяется сразу. Руководитель увидит обмен." : "Кто той же должности и свободен в этот день, сможет забрать смену одним нажатием. График поменяется сразу, руководитель увидит."}</div>
    </Sheet>);
}

// «Поменяться»: моя смена взамен — из тех, что подходят (сервер проверяет даты и должность)
export function SwapSheet({ api, msg, onClose, onDone }) {
  const [list, setList] = React.useState(null);
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState("");
  React.useEffect(() => {
    let alive = true;
    Promise.resolve(api.shiftSwapOptions(msg.id)).then((r) => { if (!alive) return; if (r && r.ok) setList(r.shifts || []); else { setList([]); setErr(errText(r)); } }).catch(() => { if (alive) { setList([]); setErr(errText({ error: "net" })); } });
    return () => { alive = false; };
  }, [api, msg.id]);
  const go = (s) => {
    if (busy) return;
    setBusy(true); setErr("");
    Promise.resolve(api.shiftSwap(msg.id, s.date)).then((r) => { setBusy(false); if (r && r.ok && r.msg) onDone(r.msg); else setErr(errText(r)); }).catch(() => { setBusy(false); setErr(errText({ error: "net" })); });
  };
  const c = msg.card || {};
  return (
    <Sheet title="Поменяться" data={{ "data-chat-swapsheet": msg.id }} onClose={onClose}>
      <div className="ch-quote">{bubbleName(msg.name)} меняет: {shiftLine(c)}</div>
      <div className="ch-lbl">Твоя смена взамен</div>
      {!list ? <div className="ch-hint">Загружаю график…</div> : !list.length && !err ? <div className="ch-hint" data-chat-noswap="">Подходящих смен нет: нужны твои смены в дни, которые просят взамен.</div> : null}
      {(list || []).map((s) => (
        <button key={s.date} type="button" className="ch-opt" data-chat-swapwith={s.date} disabled={busy} onClick={() => { vibrate("light"); go(s); }}>
          <span className="ch-opt-i" aria-hidden="true">{IC.swap}</span>
          <span className="ch-opt-b"><span className="ch-opt-t">{cap(dayLong(s.date))}</span><span className="ch-opt-s">{[String(s.label || "").toLowerCase(), s.time].filter(Boolean).join(" ")}</span></span>
        </button>))}
      {err ? <div className="ch-err" role="alert" style={{ marginTop: 8 }}>{err}</div> : null}
      <div className="ch-hint">Нажми на смену, и вы поменяетесь сразу: график обновится у обоих, руководитель увидит обмен.</div>
    </Sheet>);
}

// выбор из того, что знает приложение: уроки и тесты, блюда, коктейли, справочник
export function PickSheet({ app, kinds, title, hint, data, onPick, onClose, children = null }) {
  const [q, setQ] = React.useState("");
  const items = React.useMemo(() => { try { return (app && app.search ? app.search(q, kinds) : []) || []; } catch (e) { return []; } }, [app, q, kinds]);
  return (
    <Sheet title={title} data={data} onClose={onClose}>
      {children}
      <input className="ch-field sa-field" style={{ marginTop: 0 }} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Найти по названию" aria-label="Найти по названию" data-chat-picksearch="" />
      {!items.length ? <div className="ch-hint">{q.trim() ? "Ничего не нашёл." : "Пока нечего выбрать."}</div> : null}
      {items.slice(0, 40).map((it) => (
        <button key={it.kind + ":" + it.id} type="button" className="ch-opt" data-chat-pick={it.kind + ":" + it.id} onClick={() => { vibrate("light"); onPick(it); }}>
          <span className="ch-opt-i" aria-hidden="true">{it.img ? <img src={it.img} alt="" /> : kindIc(it.kind)}</span>
          <span className="ch-opt-b"><span className="ch-opt-t">{it.title}</span><span className="ch-opt-s">{[kindName(it.kind), it.mins ? it.mins + " мин" : "", it.sub].filter(Boolean).join(" · ")}</span></span>
        </button>))}
      {hint ? <div className="ch-hint">{hint}</div> : null}
    </Sheet>);
}

// задание: что пройти и к какому сроку
export function TaskSheet({ app, api, chat, onClose, onDone }) {
  const [item, setItem] = React.useState(null);
  const [due, setDue] = React.useState("fri");
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState("");
  const kinds = React.useMemo(() => ["lesson", "quiz", "module"], []);
  if (!item) return <PickSheet app={app} kinds={kinds} title="Задание: что пройти" data={{ "data-chat-tasksheet": "" }} onPick={setItem} onClose={onClose}
    hint="Карточка покажет, кто уже прошёл, и напомнит остальным." />;
  const ch = dueChoices(), d = ch.find((x) => x[0] === due);
  const go = () => {
    setBusy(true); setErr("");
    Promise.resolve(api.cardSend(chat.id, { t: "task", item, due: d ? d[2] : null })).then((r) => { setBusy(false); if (r && r.ok && r.msg) onDone(r.msg); else setErr(errText(r)); }).catch(() => { setBusy(false); setErr(errText({ error: "net" })); });
  };
  return (
    <Sheet title="Задание" data={{ "data-chat-tasksheet": item.id }} onClose={onClose}>
      <div className="ch-opt" aria-pressed="true" style={{ marginTop: 0, cursor: "default" }}>
        <span className="ch-opt-i" aria-hidden="true">{kindIc(item.kind)}</span>
        <span className="ch-opt-b"><span className="ch-opt-t">{item.title}</span><span className="ch-opt-s">{[kindName(item.kind), item.mins ? item.mins + " мин" : "", item.sub].filter(Boolean).join(" · ")}</span></span>
      </div>
      <div className="ch-lbl">Срок</div>
      <div className="ch-chips">{ch.map(([k, label]) => <button key={k} type="button" className="ch-chip" aria-pressed={due === k} data-chat-due={k} onClick={() => setDue(k)}>{label}</button>)}</div>
      {err ? <div className="ch-err" role="alert" style={{ marginTop: 8 }}>{err}</div> : null}
      <button type="button" className="ch-main" data-chat-taskgo="" disabled={busy} onClick={go}>{busy ? "Отправляю…" : chat.kind === "dm" ? "Отправить задание" : "Отправить задание всем"}</button>
      <button type="button" className="ch-act" style={{ justifyContent: "center", color: "var(--sub)" }} onClick={() => setItem(null)}>Выбрать другое</button>
    </Sheet>);
}

// опрос: вопрос и 2–6 вариантов
export function PollSheet({ api, chat, q0 = "", onClose, onDone }) {
  const [q, setQ] = React.useState(q0);
  const [opts, setOpts] = React.useState(() => (/(выйд|выйти|выход|смен|подмен|замен|придет|придёт|будет|сможет)/i.test(q0) ? ["Я смогу", "Не смогу"] : ["", ""]));
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState("");
  const bad = pollProblem(q, opts);
  const go = () => {
    if (bad || busy) { setErr(bad); return; }
    setBusy(true); setErr("");
    Promise.resolve(api.cardSend(chat.id, { t: "poll", q: q.trim(), opts: opts.map((o) => o.trim()).filter(Boolean) })).then((r) => { setBusy(false); if (r && r.ok && r.msg) onDone(r.msg); else setErr(errText(r)); })
      .catch(() => { setBusy(false); setErr(errText({ error: "net" })); });
  };
  return (
    <Sheet title="Опрос" data={{ "data-chat-pollsheet": "" }} onClose={onClose}>
      <input className="ch-field sa-field" style={{ marginTop: 0 }} value={q} maxLength={200} onChange={(e) => setQ(e.target.value)} placeholder="Вопрос, например: кто выйдет в воскресенье?" aria-label="Вопрос" data-chat-pollq="" />
      <div className="ch-lbl">Варианты</div>
      {opts.map((o, i) => (
        <div key={i} className="ch-po-in">
          <input className="ch-field sa-field" value={o} maxLength={60} onChange={(e) => setOpts((a) => a.map((x, j) => (j === i ? e.target.value : x)))} placeholder={"Вариант " + (i + 1)} aria-label={"Вариант " + (i + 1)} data-chat-pollo={i} />
          {opts.length > 2 ? <button type="button" className="ch-x" aria-label={"Убрать вариант " + (i + 1)} onClick={() => setOpts((a) => a.filter((_, j) => j !== i))} style={{ marginTop: 8 }}>{IC.x}</button> : null}
        </div>))}
      {opts.length < POLL_MAX ? <button type="button" className="ch-act" data-chat-polladd="" onClick={() => setOpts((a) => [...a, ""])}>{IC.plus}Ещё вариант</button> : null}
      {err ? <div className="ch-err" role="alert" style={{ marginTop: 8 }}>{err}</div> : null}
      <button type="button" className="ch-main" data-chat-pollgo="" disabled={busy} onClick={go}>{busy ? "Отправляю…" : "Отправить опрос"}</button>
    </Sheet>);
}

// стоп-лист: блюдо и до какого времени
export function StopSheet({ app, api, chat, onClose, onDone }) {
  const [dish, setDish] = React.useState(null);
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState("");
  const kinds = React.useMemo(() => ["dish"], []);
  if (!dish) return <PickSheet app={app} kinds={kinds} title="Стоп-лист: какое блюдо" data={{ "data-chat-stopsheet": "" }} onPick={setDish} onClose={onClose}
    hint="Блюдо сразу пометится «в стопе» в Меню у всех, а в чате появится карточка." />;
  const go = () => {
    setBusy(true); setErr("");
    Promise.resolve(api.stopSet(chat.id, { id: dish.id, name: dish.title, img: dish.img || "" }, true)).then((r) => { setBusy(false); if (r && r.ok && r.msg) onDone(r.msg); else setErr(errText(r)); })
      .catch(() => { setBusy(false); setErr(errText({ error: "net" })); });
  };
  return (
    <Sheet title="В стоп-лист" data={{ "data-chat-stopsheet": dish.id }} onClose={onClose}>
      <div className="ch-opt" aria-pressed="true" style={{ marginTop: 0, cursor: "default" }}>
        <span className="ch-opt-i" aria-hidden="true">{dish.img ? <img src={dish.img} alt="" /> : IC.dish}</span>
        <span className="ch-opt-b"><span className="ch-opt-t">{dish.title}</span><span className="ch-opt-s">{dish.sub || "Блюдо"}</span></span>
      </div>
      <div className="ch-hint">В стопе до «Вернуть в меню»: кнопка будет на карточке в чате и у блюда в Меню.</div>
      {err ? <div className="ch-err" role="alert" style={{ marginTop: 8 }}>{err}</div> : null}
      <button type="button" className="ch-main" data-chat-stopgo="" disabled={busy} onClick={go}>{busy ? "Отправляю…" : "В стоп-лист"}</button>
      <button type="button" className="ch-act" style={{ justifyContent: "center", color: "var(--sub)" }} onClick={() => setDish(null)}>Выбрать другое блюдо</button>
    </Sheet>);
}

// брифинг смены — то, что собрал руководитель на сегодня
export function BriefSheet({ app, api, chat, onClose, onDone }) {
  const b = React.useMemo(() => { try { return app && app.brief ? app.brief() : null; } catch (e) { return null; } }, [app]);
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState("");
  const go = () => {
    setBusy(true); setErr("");
    Promise.resolve(api.cardSend(chat.id, { t: "brief", date: b.date, title: b.title || "", lines: b.lines || [] })).then((r) => { setBusy(false); if (r && r.ok && r.msg) onDone(r.msg); else setErr(errText(r)); })
      .catch(() => { setBusy(false); setErr(errText({ error: "net" })); });
  };
  return (
    <Sheet title="Брифинг в чат" data={{ "data-chat-briefsheet": "" }} onClose={onClose}>
      {!b ? <div className="ch-hint" data-chat-nobrief="">На сегодня брифинга ещё нет: собери его в «Смене» → «Брифинг смены».</div> : (<>
        <div className="ch-card" style={{ cursor: "default", maxWidth: "none" }}>
          <div className="ch-card-tile"><DateTile iso={b.date} /></div>
          <div className="ch-card-main">
            <div className="ch-card-h"><span className="ch-card-k">Брифинг смены</span></div>
            <div className="ch-card-t">{b.title || cap(dayLong(b.date))}</div>
            <ul className="ch-brief">{(b.lines || []).slice(0, 8).map((l, i) => <li key={i}>{l}</li>)}</ul>
          </div>
        </div>
        {err ? <div className="ch-err" role="alert" style={{ marginTop: 8 }}>{err}</div> : null}
        <button type="button" className="ch-main" data-chat-briefgo="" disabled={busy} onClick={go}>{busy ? "Отправляю…" : "Отправить в «Вся команда»"}</button>
      </>)}
    </Sheet>);
}

// поделиться: блюдо, коктейль, справочник, урок
export function ShareSheet({ app, api, chat, onClose, onDone }) {
  const [err, setErr] = React.useState("");
  const kinds = React.useMemo(() => ["dish", "cocktail", "ref", "lesson", "quiz"], []);
  const go = (it) => {
    Promise.resolve(api.cardSend(chat.id, { t: "share", item: it })).then((r) => { if (r && r.ok && r.msg) onDone(r.msg); else setErr(errText(r)); }).catch(() => setErr(errText({ error: "net" })));
  };
  return <PickSheet app={app} kinds={kinds} title="Поделиться" data={{ "data-chat-sharesheet": "" }} onPick={go} onClose={onClose} hint={err || "Коллеги откроют карточку из чата одним нажатием."} />;
}
