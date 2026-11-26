// ui/live-admit.jsx — v202 (Доп. 527): допуск к залу у «Новичка».
// Владелец (27.11) на предложения, как ещё упростить живую проверку: «Давай все, кроме 10-го и 2-го». Седьмое из них:
// зачёт засчитывается в допуск. Новичка допускают к залу, когда он сдал тесты и вживую сдал «Аллергии и безопасность»
// и «ЧП в зале» (lib/live-check.js, admission). У человека понятная цель, и он сам зовёт на проверку.
//   AdmitCard — новичку в «Первой неделе»: что уже есть, что осталось, «Позвать на живую проверку».
//   admitLine — руководителю в «Новичках»: «Допуск к залу: 2 из 4» по данным живой проверки (live_check_people).
import React from "react";
import { vibrate } from "../lib/utils";
import { labelStyle } from "./tokens";
import { MODULES_INDEX } from "../data/modules-index";
import { admission, tracksOf } from "../lib/live-check";
import { lcPerson, readMine, saveMine } from "../lib/live-check-api";

/** Строка руководителю: человек из live_check_people → «Допуск к залу: 2 из 4» или «Допущен(а) к залу»; не «Новичок» — "" */
export function admitLine(p) {
  if (!p || !tracksOf(p.position).includes("seasonal")) return "";
  const a = admission(MODULES_INDEX.seasonal || [], { quiz: Array.isArray(p.quiz) ? p.quiz : [], checks: Array.isArray(p.checks) ? p.checks : [] });
  return a.ok ? "Допущен(а) к залу" : "Допуск к залу: " + a.done + " из " + a.total;
}

export function AdmitCard({ T, a11y, uk = "", quizDone = {}, onLiveCheck = null, card = {} }) {
  const gold = a11y ? "#7A5D2A" : "#D9B87C", ok = a11y ? "#2C6B48" : "#8AD8AF", warn = a11y ? "#8B5A12" : "#E4B36A";
  const line = a11y ? "rgba(139,106,48,0.22)" : "rgba(214,178,102,0.18)";
  const sub = T.modSub.color, text = T.modTitle.color;
  const [mine, setMine] = React.useState(() => readMine(uk));
  React.useEffect(() => {
    let alive = true;
    lcPerson("").then((r) => { if (alive && r && r.ok) { saveMine(uk, r.checks); setMine(readMine(uk)); } });
    return () => { alive = false; };
  }, [uk]);
  const quiz = Object.keys(quizDone || {}).filter((k) => quizDone[k]);
  const a = admission(MODULES_INDEX.seasonal || [], { quiz, checks: (mine && mine.checks) || [] });
  const askable = a.rows.some((r) => r.test && !r.live);
  return (
    <div style={card} data-lens-card="" data-nb-admit={a.ok ? "ok" : a.done + "/" + a.total}>
      <div style={{ ...labelStyle(13.5), color: a.ok ? ok : gold, marginBottom: 4 }}>{a.ok ? "Допущен(а) к залу" : "Допуск к залу · " + a.done + " из " + a.total}</div>
      <div style={{ fontSize: 13, color: sub, lineHeight: 1.45, marginBottom: 6 }}>
        {a.ok ? "Тесты и живая проверка по двум главным темам сданы." : "Сдай тест в приложении и живую проверку по двум главным темам: руководитель задаст вопросы вслух."}
      </div>
      {a.rows.map((r, i) => (
        <div key={r.m} data-nb-admit-row={r.m} style={{ padding: "6px 0", borderTop: i ? "1px solid " + line : 0, fontSize: 13.5, color: text, lineHeight: 1.45 }}>
          <div style={{ fontFamily: "Georgia, serif", fontWeight: "bold" }}>{r.title}</div>
          <span style={{ color: r.test ? ok : sub }}>{r.test ? "тест сдан" : "тест не сдан"}</span>{" · "}
          <span style={{ color: r.live ? ok : r.s != null ? warn : sub }}>{r.live ? "вживую зачтено" : r.s != null ? "вживую " + r.s + "%, нужна пересдача" : "вживую не проверяли"}</span>
        </div>))}
      {!a.ok && askable && onLiveCheck ? (
        <button type="button" data-nb-admit-ask="" data-lens-btn="soft" onClick={() => { vibrate("light"); onLiveCheck(); }}
          style={{ display: "block", width: "100%", marginTop: 8, padding: "10px 12px", borderRadius: 999, border: "1px solid " + gold, background: "transparent", color: text, fontFamily: "Georgia, serif", fontSize: 14, cursor: "pointer" }}>
          Позвать на живую проверку</button>) : null}
    </div>
  );
}
