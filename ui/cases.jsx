// ui/cases.jsx — v83 (Доп. 396): случаи из нашего зала.
//
// CasesScreen — «Смена» → «Случаи из нашего зала»: тренировка на случаях заведения (тот же «стол», что практика,
//   режим cases — App открывает его по onPlay), «Рассказать случай» (что случилось, что сделал, чем закончилось, можно
//   без имени для команды), «Мои случаи» с ответом руководителя. Руководителю — ещё «Ждут разбора» и «Разобранные»:
//   разбор превращает рассказ в ситуацию (сцена, вопрос, как правильно и неверные варианты, разбор, «как было у нас»).
// Сервер — этап 33 (case_submit / case_review / case_list); без него экран честно говорит, что этапа нет.
import React from "react";
import { LineArt } from "./line-art";   // v87: рисунок золотой линией
import { vibrate } from "../lib/utils";
import { labelStyle } from "./tokens";
import { rpc, saToken, rpcMissing } from "../api/supabase";
import { CASE_OUTCOMES, CASE_LIMITS, outcomeLabel, caseDraft, draftProblem, draftToSit, casesToSits, readPlayed } from "../lib/cases";

const MONTHS = ["января", "февраля", "марта", "апреля", "мая", "июня", "июля", "августа", "сентября", "октября", "ноября", "декабря"];
const dayOf = (iso) => { const d = new Date(iso || 0); return isNaN(d) ? "" : d.getDate() + " " + MONTHS[d.getMonth()]; };
const pl = (n, a, b, c) => { const m10 = n % 10, m100 = n % 100; return m10 === 1 && m100 !== 11 ? a : m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20) ? b : c; };
const C = (a11y) => ({
  gold: a11y ? "#7A5D2A" : "#D2A85A",
  text: a11y ? "#2A1F0E" : "#EFE4C8",
  sub: a11y ? "#6B5B40" : "#A99A7C",
  line: a11y ? "rgba(139,106,48,0.28)" : "rgba(214,178,102,0.22)",
  red: a11y ? "#A0412F" : "#E08A7A",
  green: a11y ? "#2F6B45" : "#8FB890",
  field: a11y ? "rgba(255,255,255,0.6)" : "rgba(0,0,0,0.25)",
  frost: {
    background: a11y ? "rgba(250,242,222,0.62)" : "rgba(226,186,116,0.09)",
    border: a11y ? "1px solid rgba(139,106,48,0.30)" : "1px solid rgba(255,255,255,0.13)",
    boxShadow: a11y ? "inset 0 0 26px rgba(255,255,255,0.55), 0 6px 18px rgba(120,85,25,0.14)" : "inset 0 0 26px rgba(255,248,230,0.07), 0 8px 24px rgba(0,0,0,0.45)",
    borderRadius: 18,
  },
});
const STATUS = { new: "Ждёт разбора", published: "В тренировке команды", declined: "Не для тренировки" };

function Field({ c, label, hint, value, onChange, max, rows = 3, placeholder, name }) {
  const multi = rows > 1;
  const st = { width: "100%", boxSizing: "border-box", padding: "10px 12px", borderRadius: 12, border: `1px solid ${c.line}`, background: c.field, color: c.text,
    fontFamily: "Georgia, serif", fontSize: 14.5, lineHeight: 1.45, outline: "none", resize: multi ? "vertical" : "none" };
  return (
    <label style={{ display: "block", marginBottom: 12 }}>
      {label ? <span style={{ display: "block", ...labelStyle(13), color: c.gold, marginBottom: 5 }}>{label}</span> : null}
      {multi ? <textarea className="sa-field" data-case-field={name} rows={rows} value={value} maxLength={max} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} style={st} />
        : <input className="sa-field" data-case-field={name} value={value} maxLength={max} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} style={st} />}
      {hint ? <span style={{ display: "block", fontSize: 12, color: c.sub, marginTop: 4, lineHeight: 1.4 }}>{hint}</span> : null}
    </label>
  );
}

function Toggle({ c, a11y, on, label, sub, onChange, disabled, name }) {
  return (
    <button type="button" role="switch" aria-checked={!!on} data-case-toggle={name} disabled={disabled} onClick={() => { vibrate("light"); onChange(!on); }}
      style={{ display: "flex", alignItems: "center", gap: 12, width: "100%", textAlign: "left", padding: "8px 0", border: 0, background: "none", cursor: disabled ? "default" : "pointer", opacity: disabled ? 0.5 : 1, marginBottom: 6 }}>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: "block", fontFamily: "Georgia, serif", fontSize: 14.5, color: c.text }}>{label}</span>
        {sub ? <span style={{ display: "block", fontSize: 12, color: c.sub, marginTop: 2, lineHeight: 1.4 }}>{sub}</span> : null}
      </span>
      <span aria-hidden="true" style={{ position: "relative", width: 40, height: 24, borderRadius: 12, border: `1px solid ${on ? c.gold : c.line}`, background: on ? (a11y ? "rgba(139,106,48,0.25)" : "rgba(200,169,110,0.35)") : "transparent", flexShrink: 0 }}>
        <span style={{ position: "absolute", top: 2, left: 2, width: 18, height: 18, borderRadius: "50%", background: on ? (a11y ? "#8B6A30" : "#E4C88C") : c.sub, transform: on ? "translateX(16px)" : "none", transition: "transform .2s" }} />
      </span>
    </button>
  );
}

const btn = (c, kind) => ({ padding: "13px 16px", borderRadius: 16, fontFamily: "Georgia, serif", fontSize: 15, cursor: "pointer",
  ...(kind === "main" ? { border: 0, background: c.gold, color: "#1A1008", fontWeight: "bold" }
    : kind === "danger" ? { border: `1px solid ${c.red}`, background: "transparent", color: c.red }
    : { border: `1px solid ${c.gold}`, background: "transparent", color: c.text }) });

// ── Разбор случая руководителем ─────────────────────────────────────────────────
function Review({ c, a11y, item, onDone, onCancel }) {
  const [d, setD] = React.useState(() => caseDraft(item));
  const [busy, setBusy] = React.useState("");
  const [err, setErr] = React.useState("");
  const [declineOpen, setDeclineOpen] = React.useState(false);
  const [note, setNote] = React.useState(item.note || "");
  const [sure, setSure] = React.useState(false);
  const set = (k) => (v) => { setErr(""); setD((x) => ({ ...x, [k]: v })); };
  const setWrong = (i) => (v) => { setErr(""); setD((x) => { const w = [...x.wrong]; w[i] = v; return { ...x, wrong: w }; }); };
  const problem = draftProblem(d);
  const published = item.status === "published";
  const send = (action) => {
    if (busy) return;
    if (action === "publish" && problem) { setErr(problem); return; }
    setBusy(action); setErr("");
    rpc("case_review", { p_token: saToken(), p_id: item.id, p_action: action, p_sit: action === "publish" ? draftToSit(d) : null, p_note: note.trim() }).then((r) => {
      setBusy("");
      if (r && r.ok) { vibrate("success"); onDone(action === "publish" ? (published ? "Правка сохранена: команда тренируется на новой версии." : "Опубликовано: случай в тренировке команды.")
        : action === "delete" ? "Случай удалён." : published ? "Снято с тренировки." : "Ответ автору отправлен: случай не для тренировки."); }
      else if (r && r.error === "bad_sit") setErr("Сервер не принял разбор: проверь варианты и разбор.");
      else if (r && r.error === "not_found") setErr("Случая уже нет: его удалили.");
      else if (rpcMissing(r)) setErr("На сервере ещё нет этапа 33 (supabase-stage33-cases.sql).");
      else setErr("Не получилось. Проверь связь и попробуй ещё раз.");
    }).catch(() => { setBusy(""); setErr("Нет связи. Попробуй ещё раз."); });
  };
  return (
    <div data-case-review={item.id}>
      <div style={{ ...c.frost, padding: "12px 14px", marginBottom: 14 }}>
        <div style={{ ...labelStyle(13), color: c.gold }}>Рассказ · {item.author || "сотрудник"}{item.anon ? " · без имени для команды" : ""} · {dayOf(item.at)}</div>
        <div style={{ fontFamily: "Georgia, serif", fontSize: 15, color: c.text, lineHeight: 1.5, marginTop: 6 }}>{item.story}</div>
        {item.did ? <div style={{ fontSize: 13.5, color: c.text, marginTop: 8, lineHeight: 1.45 }}><span style={{ color: c.sub }}>Что сделал(а): </span>{item.did}</div> : null}
        {item.outcome ? <div style={{ fontSize: 13, color: c.sub, marginTop: 6 }}>Итог: {outcomeLabel(item.outcome).toLowerCase()}</div> : null}
      </div>
      <div style={{ ...labelStyle(15), color: c.gold, margin: "4px 2px 10px" }}>Ситуация для команды</div>
      <Field c={c} name="scene" label="Что происходит" value={d.scene} onChange={set("scene")} max={CASE_LIMITS.scene} rows={4} hint="Без имён гостей и лишних подробностей: так, чтобы любой из команды узнал ситуацию." />
      <Field c={c} name="question" label="Вопрос" value={d.question} onChange={set("question")} max={CASE_LIMITS.question} rows={1} />
      <Field c={c} name="right" label="Как правильно" value={d.right} onChange={set("right")} max={CASE_LIMITS.option} rows={2} placeholder="Извиниться, предложить плед и первый освободившийся стол" />
      {[0, 1, 2].map((i) => (
        <Field key={i} c={c} name={"wrong" + i} label={i === 0 ? "Неверные варианты" : ""} value={d.wrong[i] || ""} onChange={setWrong(i)} max={CASE_LIMITS.option} rows={1}
          placeholder={i === 0 ? "Сказать, что мест нет" : i === 1 ? "Ещё вариант (можно оставить пустым)" : "Ещё один (можно оставить пустым)"}
          hint={i === 0 && item.outcome && (item.outcome === "bad" || item.outcome === "unsure") && item.did ? "Сюда уже подставлено то, что сделали в зале: поправь, если нужно." : ""} />))}
      <Field c={c} name="why" label="Разбор" value={d.why} onChange={set("why")} max={CASE_LIMITS.why} rows={3} placeholder="Почему так правильно: что важно гостю и что сделать первым" />
      <Field c={c} name="real" label="Как было у нас" value={d.real} onChange={set("real")} max={CASE_LIMITS.real} rows={3} hint="Команда увидит это после ответа, если включено ниже." />
      <Toggle c={c} a11y={a11y} name="real" on={d.showReal} onChange={set("showReal")} label="Показывать команде, как было" />
      <Toggle c={c} a11y={a11y} name="author" on={d.showAuthor && !item.anon} disabled={!!item.anon} onChange={set("showAuthor")} label="Показывать, кто рассказал"
        sub={item.anon ? "Автор попросил без имени: команда его не увидит." : "Команда увидит имя под разбором."} />
      {declineOpen ? <Field c={c} name="note" label="Ответ автору" value={note} onChange={setNote} max={CASE_LIMITS.note} rows={2} placeholder="Спасибо, что рассказал(а). В тренировку не берём: …" /> : null}
      {!declineOpen && !published ? <Field c={c} name="note" label="Слово автору (по желанию)" value={note} onChange={setNote} max={CASE_LIMITS.note} rows={2} placeholder="Спасибо, хороший пример" /> : null}
      {err ? <div role="alert" style={{ fontSize: 13, color: c.red, margin: "2px 2px 10px", lineHeight: 1.45 }}>{err}</div> : null}
      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 6 }}>
        {!declineOpen ? <button type="button" data-case-publish="" onClick={() => send("publish")} disabled={!!busy} style={{ ...btn(c, "main"), opacity: busy || problem ? 0.6 : 1 }}>
          {busy === "publish" ? "Публикую…" : published ? "Сохранить правку" : "Опубликовать для команды"}</button> : null}
        {!declineOpen ? (
          <button type="button" data-case-decline="" onClick={() => { vibrate("light"); if (published) send("decline"); else setDeclineOpen(true); }} disabled={!!busy} style={btn(c)}>
            {busy === "decline" ? "Снимаю…" : published ? "Снять с тренировки" : "Не для тренировки"}</button>
        ) : (
          <div style={{ display: "flex", gap: 10 }}>
            <button type="button" onClick={() => setDeclineOpen(false)} style={{ ...btn(c), flex: 1 }}>Назад к разбору</button>
            <button type="button" data-case-decline-send="" onClick={() => send("decline")} disabled={!!busy} style={{ ...btn(c, "main"), flex: 1.3 }}>{busy === "decline" ? "Отправляю…" : "Ответить автору"}</button>
          </div>
        )}
        <button type="button" data-case-delete="" onClick={() => { if (!sure) { vibrate("light"); setSure(true); return; } send("delete"); }} disabled={!!busy} style={btn(c, "danger")}>
          {sure ? "Точно удалить? Нажми ещё раз" : "Удалить случай"}</button>
        <button type="button" onClick={onCancel} style={{ ...btn(c), border: 0, color: c.sub }}>Отмена</button>
      </div>
    </div>
  );
}

// ── Рассказать случай ───────────────────────────────────────────────────────────
function Tell({ c, a11y, onSent }) {
  const [f, setF] = React.useState({ story: "", did: "", outcome: "", anon: false });
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState("");
  const set = (k) => (v) => { setErr(""); setF((x) => ({ ...x, [k]: v })); };
  const short = f.story.trim().length < CASE_LIMITS.storyMin;
  const send = () => {
    if (busy) return;
    if (short) { setErr("Расскажи чуть подробнее: что случилось и с кем (без имён гостей)."); return; }
    setBusy(true); setErr("");
    rpc("case_submit", { p_token: saToken(), p_story: f.story.trim(), p_did: f.did.trim(), p_outcome: f.outcome, p_anon: f.anon }).then((r) => {
      setBusy(false);
      if (r && r.ok) { vibrate("success"); setF({ story: "", did: "", outcome: "", anon: false }); onSent(); }
      else if (r && r.error === "limit") setErr("На сегодня это уже пятый случай. Остальные расскажи завтра.");
      else if (r && r.error === "short") setErr("Расскажи чуть подробнее: что случилось и с кем.");
      else if (r && r.error === "no_restaurant") setErr("В профиле не указано заведение: случай некому разобрать.");
      else if (rpcMissing(r)) setErr("На сервере ещё нет этапа 33 (supabase-stage33-cases.sql). Скажи руководителю.");
      else setErr("Не отправилось. Проверь связь и попробуй ещё раз.");
    }).catch(() => { setBusy(false); setErr("Нет связи. Текст останется здесь, отправишь позже."); });
  };
  return (
    <div data-case-tell="">
      <Field c={c} name="story" label="Что случилось" value={f.story} onChange={set("story")} max={CASE_LIMITS.story} rows={4}
        placeholder="Гость за шестым столом попросил пересадить: дует из окна, а свободных столов нет…" hint="Без имён и фамилий гостей." />
      <Field c={c} name="did" label="Что ты сделал(а)" value={f.did} onChange={set("did")} max={CASE_LIMITS.did} rows={2} placeholder="Предложил(а) плед и пересадил(а), когда освободился стол" />
      <div style={{ ...labelStyle(13), color: c.gold, marginBottom: 6 }}>Чем закончилось</div>
      <div role="radiogroup" aria-label="Чем закончилось" style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
        {CASE_OUTCOMES.map(([k, label]) => {
          const on = f.outcome === k;
          return <button key={k} type="button" role="radio" aria-checked={on} data-case-outcome={k} onClick={() => { vibrate("light"); setF((x) => ({ ...x, outcome: on ? "" : k })); }}
            style={{ padding: "7px 12px", borderRadius: 999, border: `1px solid ${on ? c.gold : c.line}`, background: on ? (a11y ? "rgba(139,106,48,0.18)" : "rgba(200,169,110,0.22)") : "transparent",
              color: on ? c.text : c.sub, fontFamily: "Georgia, serif", fontSize: 13.5, cursor: "pointer" }}>{label}</button>;
        })}
      </div>
      <Toggle c={c} a11y={a11y} name="anon" on={f.anon} onChange={set("anon")} label="Без моего имени для команды" sub="Руководитель увидит, кто рассказал, а команда не увидит." />
      {err ? <div role="alert" style={{ fontSize: 13, color: c.red, margin: "2px 2px 10px", lineHeight: 1.45 }}>{err}</div> : null}
      <button type="button" data-case-send="" onClick={send} disabled={busy} style={{ ...btn(c, "main"), width: "100%", opacity: busy || short ? 0.6 : 1 }}>{busy ? "Отправляю…" : "Отправить руководителю"}</button>
    </div>
  );
}

// ── Экран ───────────────────────────────────────────────────────────────────────
export function CasesScreen({ T, a11y, profile, uk = "", playedVer = 0, onBack, onPlay, onOpened }) {
  const c = C(a11y);
  const [st, setSt] = React.useState({ status: "loading" });
  const [review, setReview] = React.useState(null);
  const [tell, setTell] = React.useState(false);
  const [msg, setMsg] = React.useState("");
  const load = React.useCallback(() => {
    rpc("case_list", { p_token: saToken(), p_mode: "full" }).then((r) => {
      if (rpcMissing(r)) setSt({ status: "missing" });
      else if (r && r.ok) setSt({ status: "ok", ...r });
      else setSt({ status: "error" });
    }).catch(() => setSt((s) => (s.status === "ok" ? s : { status: "offline" })));
  }, []);
  React.useEffect(() => { load(); if (onOpened) onOpened(); }, [load]);   // eslint-disable-line react-hooks/exhaustive-deps
  const ok = st.status === "ok";
  const lead = ok ? !!st.lead : false;
  const team = ok ? st.team || [] : [];
  // сыгранные — на телефоне; playedVer растёт, когда раунд случаев закончился (App), — «новые» пересчитываются
  const played = React.useMemo(() => readPlayed(uk), [uk, st, playedVer]);   // eslint-disable-line react-hooks/exhaustive-deps
  const fresh = team.filter((x) => !played[x.id]).length;
  const back = () => { if (review) { setReview(null); return; } onBack(); };
  const done = (text) => { setReview(null); setMsg(text); load(); try { window.scrollTo(0, 0); } catch (e) {} };
  const card = { ...c.frost, padding: "12px 14px", marginBottom: 10 };
  const sectionT = (t, n) => <div style={{ ...labelStyle(15), color: c.gold, margin: "18px 2px 10px" }}>{t}{n != null ? " · " + n : ""}</div>;
  const play = () => { const sits = casesToSits(team, played); if (sits.length) { vibrate("medium"); onPlay(sits, team); } };
  return (
    <div style={T.screen} className="sa-screen">
      <div style={T.lessHead}>
        <button className="sa-hit" style={T.backBtn2} aria-label="Вернуться" onClick={back}>‹</button>
        <div style={T.lessHeadTitle}>{review ? "Разбор случая" : "Случаи из нашего зала"}</div>
      </div>
      <div style={{ padding: "4px 16px 110px" }}>
        {review ? <Review c={c} a11y={a11y} item={review} onDone={done} onCancel={() => setReview(null)} /> : <>
          {msg ? <div role="status" style={{ ...card, fontSize: 13.5, color: c.text, lineHeight: 1.45 }}>{msg}</div> : null}
          {st.status === "loading" ? <div style={{ fontSize: 13, color: c.sub, padding: "6px 2px" }}>Загружаю случаи…</div> : null}
          {st.status === "missing" ? <div style={{ ...card, fontSize: 13.5, color: c.text, lineHeight: 1.5 }}>На сервере ещё нет этапа 33 (supabase-stage33-cases.sql). Когда руководитель его добавит, здесь можно будет рассказывать случаи и тренироваться на них.</div> : null}
          {st.status === "offline" || st.status === "error" ? <div style={{ ...card, fontSize: 13.5, color: c.text, lineHeight: 1.5 }}>Случаи не загрузились. Проверь связь.
            <button type="button" onClick={() => { setSt({ status: "loading" }); load(); }} style={{ ...btn(c), display: "block", marginTop: 10, padding: "9px 14px", fontSize: 14 }}>Ещё раз</button></div> : null}
          {ok ? <>
            {/* тренировка */}
            <div data-case-train="" style={{ ...card, padding: "14px 16px" }}>
              <div style={{ ...labelStyle(13.5), color: c.gold }}>Тренировка на наших случаях</div>
              {team.length ? <>
                <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginTop: 6 }}>
                  <span style={{ fontFamily: "Georgia, serif", fontSize: 28, color: c.text }}>{team.length}</span>
                  <span style={{ fontSize: 13.5, color: c.sub }}>{pl(team.length, "случай", "случая", "случаев")} из зала{fresh ? " · новых для тебя " + fresh : ""}</span>
                </div>
                <div style={{ fontSize: 13, color: c.sub, marginTop: 4, lineHeight: 1.45 }}>Ситуация, вопрос и разбор от руководителя. После ответа видно, как было у нас.</div>
                <button type="button" data-case-play="" onClick={play} style={{ ...btn(c, "main"), width: "100%", marginTop: 12 }}>{fresh ? "Разобрать новые" : "Разобрать ещё раз"}</button>
              </> : <>
                <LineArt kind="tray" color={c.gold} size={130} style={{ margin: "10px auto 2px" }} />
                <div style={{ fontSize: 13.5, color: c.text, marginTop: 6, lineHeight: 1.5 }}>Пока ни одного. Расскажи случай со смены: руководитель разберёт его, и команда потренируется на живой истории.</div>
              </>}
            </div>
            {/* руководителю: ждут разбора */}
            {lead ? <>
              {sectionT("Ждут разбора", (st.inbox || []).length)}
              {(st.inbox || []).length ? (st.inbox || []).map((x) => (
                <div key={x.id} data-case-inbox={x.id} role="button" tabIndex={0} onClick={() => { vibrate("light"); setMsg(""); setReview(x); }}
                  onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setReview(x); } }} style={{ ...card, cursor: "pointer" }}>
                  <div style={{ ...labelStyle(12.5), color: c.gold }}>{x.author || "сотрудник"}{x.anon ? " (без имени для команды)" : ""} · {dayOf(x.at)}{x.outcome ? " · " + outcomeLabel(x.outcome).toLowerCase() : ""}</div>
                  <div style={{ fontFamily: "Georgia, serif", fontSize: 14.5, color: c.text, marginTop: 5, lineHeight: 1.45, display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{x.story}</div>
                  <div style={{ fontSize: 12.5, color: c.gold, marginTop: 6 }}>Разобрать ›</div>
                </div>)) : <div style={{ fontSize: 13, color: c.sub, padding: "0 2px" }}>Новых случаев нет.</div>}
            </> : null}
            {/* рассказать */}
            {sectionT("Рассказать случай")}
            <div style={card}>
              {tell ? <Tell c={c} a11y={a11y} onSent={() => { setTell(false); setMsg("Отправлено. Руководитель разберёт случай, и команда потренируется на нём."); load(); }} />
                : <>
                  <div style={{ fontSize: 13.5, color: c.text, lineHeight: 1.5 }}>Был непростой гость или ты нашёл(ла) хороший выход? Расскажи: руководитель превратит историю в ситуацию для тренировки.</div>
                  <button type="button" data-case-tell-open="" onClick={() => { vibrate("light"); setMsg(""); setTell(true); }} style={{ ...btn(c), width: "100%", marginTop: 12 }}>Рассказать случай</button>
                </>}
            </div>
            {/* мои */}
            {(st.mine || []).length ? <>
              {sectionT("Мои случаи", (st.mine || []).length)}
              {(st.mine || []).map((x) => (
                <div key={x.id} data-case-mine={x.id} data-status={x.status} style={card}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ ...labelStyle(12.5), color: x.status === "published" ? c.green : x.status === "declined" ? c.sub : c.gold, flex: 1 }}>{STATUS[x.status] || x.status} · {dayOf(x.at)}</span>
                    {x.status === "new" ? <MineDelete c={c} id={x.id} onDone={() => { setMsg("Случай удалён."); load(); }} /> : null}
                  </div>
                  <div style={{ fontSize: 14, color: c.text, marginTop: 5, lineHeight: 1.45, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{x.story}</div>
                  {x.note ? <div style={{ fontSize: 13, color: c.text, marginTop: 6, lineHeight: 1.45 }}><span style={{ color: c.sub }}>{x.reviewer || "Руководитель"}: </span>«{x.note}»</div> : null}
                </div>))}
            </> : null}
            {/* руководителю: разобранные */}
            {lead && (st.done || []).length ? <>
              {sectionT("Разобранные", (st.done || []).length)}
              {(st.done || []).map((x) => (
                <div key={x.id} data-case-done={x.id} data-status={x.status} role="button" tabIndex={0} onClick={() => { vibrate("light"); setMsg(""); setReview(x); }}
                  onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setReview(x); } }} style={{ ...card, cursor: "pointer", opacity: x.status === "declined" ? 0.7 : 1 }}>
                  <div style={{ ...labelStyle(12.5), color: x.status === "published" ? c.green : c.sub }}>{STATUS[x.status]} · {x.author || "сотрудник"} · {dayOf(x.reviewed_at || x.at)}</div>
                  <div style={{ fontSize: 14, color: c.text, marginTop: 5, lineHeight: 1.45, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{(x.sit && x.sit.scene) || x.story}</div>
                </div>))}
            </> : null}
            {team.length ? <LineArt kind="tray" color={c.gold} size={150} style={{ margin: "34px auto 0", opacity: 0.4 }} /> : null}
          </> : null}
        </>}
      </div>
    </div>
  );
}

function MineDelete({ c, id, onDone }) {
  const [sure, setSure] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  return <button type="button" data-case-mine-delete={id} disabled={busy} onClick={() => {
    if (!sure) { setSure(true); return; }
    setBusy(true);
    rpc("case_review", { p_token: saToken(), p_id: id, p_action: "delete", p_sit: null, p_note: "" }).then((r) => { setBusy(false); if (r && r.ok) onDone(); else setSure(false); }).catch(() => { setBusy(false); setSure(false); });
  }} style={{ border: 0, background: "none", color: sure ? c.red : c.sub, fontSize: 12.5, cursor: "pointer", padding: "2px 0", fontFamily: "Georgia, serif" }}>{sure ? "Удалить? Ещё раз" : "Удалить"}</button>;
}
