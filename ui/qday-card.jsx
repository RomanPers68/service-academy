// ui/qday-card.jsx — v88 (Доп. 401): «Вопрос дня» на главной (этап 37: qday_today / qday_answer).
// Тот же вопрос, что приходит в Telegram: из ошибок, которые пора повторить, и пройденных тем. Ответ — один раз: верный
// подсвечивается золотом, разбор сразу; ошибка уходит в «Работу над ошибками». Серия — сколько дней подряд был ответ.
import React from "react";
import { vibrate, onActivate } from "../lib/utils";
import { labelStyle } from "./tokens";
import { QDAY_LETTERS, qdayStreakText, qdayVerdict } from "../lib/qday";

const P = (a11y) => ({
  gold: a11y ? "#7A5D2A" : "#D2A85A",
  text: a11y ? "#2A1F0E" : "#EFE4C8",
  sub: a11y ? "#6B5B40" : "#A99A7C",
  line: a11y ? "rgba(139,106,48,0.28)" : "rgba(214,178,102,0.22)",
  ok: a11y ? "#4F6B2E" : "#B9D58C",
  bad: a11y ? "#A0412F" : "#EBA595",
  card: {
    background: a11y ? "rgba(250,242,222,0.62)" : "rgba(226,186,116,0.09)",
    border: a11y ? "1px solid rgba(139,106,48,0.30)" : "1px solid rgba(255,255,255,0.13)",
    boxShadow: a11y
      ? "inset 0 0 26px rgba(255,255,255,0.55), inset 0 1px 0 rgba(255,255,255,0.9), 0 6px 18px rgba(120,85,25,0.14)"
      : "inset 0 0 26px rgba(255,248,230,0.07), inset 0 1px 0 rgba(255,255,255,0.12), 0 8px 24px rgba(0,0,0,0.45)",
  },
});
// для экранного диктора: «верный ответ» / «твой ответ» после ответа (у варианта-кнопки — aria-label, после ответа он
// уже не кнопка, и подпись идёт скрытым текстом)
const SR = { position: "absolute", width: 1, height: 1, margin: -1, padding: 0, overflow: "hidden", clip: "rect(0 0 0 0)", whiteSpace: "nowrap", border: 0 };
// свеча серии — тем же языком, что «свеча» дней занятий
const Flame = ({ color, size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
    <path d="M12 3c2.5 3 4.5 5.4 4.5 8.6A4.5 4.5 0 0 1 12 16a4.5 4.5 0 0 1-4.5-4.4C7.5 9 9.5 7.6 12 3z" /><path d="M9 21h6M12 16v5" /></svg>);

/** data: { item, streak } из qday_today; onAnswer(i) — ответ вариантом i; busy — ответ уходит; err — не ушёл. */
export function QdayCard({ a11y, data, busy = false, err = "", onAnswer, onMistakes }) {
  const c = P(a11y);
  const it = data && data.item;
  if (!it || !Array.isArray(it.o) || !it.o.length) return null;
  const done = Number.isInteger(it.answer);
  const streak = qdayStreakText(data.streak);
  const pick = (i) => { if (done || busy || !onAnswer) return; vibrate("light"); onAnswer(i); };
  return (
    <div data-qday-card={done ? (it.correct ? "ok" : "bad") : "ask"} style={{ margin: "0 14px 10px", borderRadius: 18, padding: "12px 14px 13px", fontFamily: "Georgia, serif", ...c.card }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 6 }}>
        <span style={{ ...labelStyle(a11y ? 14.5 : 13.5), color: c.gold }}>Вопрос дня</span>
        {it.t ? <span style={{ flex: 1, minWidth: 0, fontSize: 12, color: c.sub, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>· {it.t}</span> : <span style={{ flex: 1 }} />}
        {streak ? <span data-qday-streak={data.streak} style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 12, color: c.gold, whiteSpace: "nowrap" }}><Flame color={c.gold} size={13} />{streak}</span> : null}
      </div>
      <div data-qday-q="" style={{ fontSize: a11y ? 16.5 : 15.5, lineHeight: 1.35, color: c.text, marginBottom: 10 }}>{it.q}</div>
      <div role="group" aria-label="Варианты ответа" style={{ display: "flex", flexDirection: "column", gap: 7 }}>
        {it.o.map((o, i) => {
          const right = done && i === Number(it.c), mine = done && i === it.answer, wrong = mine && !it.correct;
          const bd = right ? c.gold : wrong ? c.bad : c.line;
          return (
            <div key={i} data-qday-opt={i} data-state={right ? "right" : wrong ? "wrong" : "idle"} onClick={() => pick(i)} {...(done ? {} : onActivate(() => pick(i)))}
              aria-disabled={!done && busy ? "true" : undefined} aria-label={done ? undefined : QDAY_LETTERS[i] + ". " + o}
              style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", borderRadius: 12, border: `1px solid ${bd}`, cursor: done || busy ? "default" : "pointer",
                background: right ? (a11y ? "rgba(139,106,48,0.14)" : "rgba(210,168,90,0.16)") : wrong ? (a11y ? "rgba(160,65,47,0.10)" : "rgba(224,138,122,0.12)") : "transparent",
                opacity: busy && !done ? 0.6 : done && !right && !wrong ? 0.65 : 1 }}>
              <span aria-hidden="true" style={{ flex: "0 0 auto", width: 24, height: 24, borderRadius: "50%", display: "grid", placeItems: "center", fontSize: 12.5,
                border: `1px solid ${right ? c.gold : wrong ? c.bad : c.line}`, color: right ? c.gold : wrong ? c.bad : c.sub }}>{QDAY_LETTERS[i]}</span>
              <span style={{ fontSize: 14.5, lineHeight: 1.35, color: c.text }}>{o}</span>
              {right || wrong ? <span style={SR}>{right ? ", верный ответ" : ", твой ответ"}</span> : null}
            </div>);
        })}
      </div>
      {done ? (
        <div data-qday-result="" role="status" style={{ marginTop: 10 }}>
          <div style={{ fontSize: 14.5, fontWeight: "bold", color: it.correct ? c.gold : c.bad }}>{qdayVerdict(it)}</div>
          {it.e ? <div style={{ fontSize: 13.5, lineHeight: 1.45, color: c.sub, marginTop: 3 }}>{it.e}</div> : null}
          <div style={{ fontSize: 12.5, color: c.sub, marginTop: 6 }}>
            {it.correct ? "Следующий вопрос завтра." : <>Вопрос ждёт в {onMistakes ? <span role="button" tabIndex={0} data-qday-mistakes="" onClick={onMistakes} {...onActivate(onMistakes)} style={{ color: c.gold, textDecoration: "underline", cursor: "pointer" }}>«Работе над ошибками»</span> : "«Работе над ошибками»"}. Следующий вопрос завтра.</>}
          </div>
        </div>) : null}
      {err ? <div role="alert" style={{ fontSize: 13, color: c.bad, marginTop: 8 }}>{err}</div> : null}
    </div>
  );
}
