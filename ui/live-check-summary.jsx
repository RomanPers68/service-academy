// ui/live-check-summary.jsx — v200 (Доп. 525): раздел «Живая проверка» в отчёте по сотруднику (ui/report.jsx): последние
// итоги по модулям и «Проверить вживую». Отдельно от экрана проверки, чтобы отчёт не тянул вопросы (data/live-check.js).
// v201 (Доп. 526): пометки «тест сдал, вживую нет» и «пора повторить», последний блиц; карточка «Итог живой проверки»
// для самого сотрудника на вкладке «Смена» (LiveResultCard): процент, что повторить, «Открыть урок».
import React from "react";
import { MODULES_INDEX } from "../data/modules-index";
import { lastByModule, lcDate, moduleFlags } from "../lib/live-check";

const modOf = (t, m) => (MODULES_INDEX[t] || []).find((x) => x.id === m) || Object.values(MODULES_INDEX).flat().find((x) => x.id === m) || null;

/** Раздел отчёта по сотруднику (ui/report.jsx): последние итоги по модулям. data — ответ live_check_person;
 *  onCheck — «Проверить вживую» (если смотрящий может проверять этого человека) */
export function LiveCheckSummary({ data, onCheck = null }) {
  if (!data || !data.ok) return null;
  const all = Array.isArray(data.checks) ? data.checks : [];
  const last = lastByModule(all.filter((x) => x.k !== "blitz" && x.m !== "blitz"));
  const blitz = all.find((x) => x.k === "blitz" || x.m === "blitz") || null;
  const rows = Object.values(last).sort((x, y) => String(y.at || "").localeCompare(String(x.at || "")));
  const passed = rows.filter((r) => r.p).length;
  return (
    <section className="rp-sec" data-rp-live={rows.length}>
      <h3>Живая проверка<span>{rows.length ? "зачтено " + passed + " из " + rows.length : ""}</span></h3>
      {!rows.length && !blitz ? <div className="rp-empty">Вживую по урокам ещё не проверяли.</div> : null}
      {rows.slice(0, 12).map((r) => {
        const mod = modOf(r.t, r.m);
        const f = mod ? moduleFlags(mod, r, { quiz: data.quiz || [], tests: data.tests || {} }) : {};
        const extra = f.gap ? "тест в приложении " + (f.testPct != null ? f.testPct + "%" : "сдан") : f.recheck ? "пора повторить" : "";
        return (
          <div key={r.m} className="rp-li" data-rp-live-row={r.m} data-rp-live-flag={f.gap ? "gap" : f.recheck ? "recheck" : ""}>
            {(mod && mod.title) || r.m} · <span className={r.p ? "ok" : "bad"}>{r.p ? "зачтено" : "не зачтено"}, {r.s}%</span>
            <small>{[lcDate(r.at), r.by, extra, r.note].filter(Boolean).join(" · ")}</small>
          </div>);
      })}
      {blitz ? <div className="rp-li" data-rp-live-blitz={blitz.s}>Блиц · <span className={blitz.p ? "ok" : "bad"}>{blitz.s}%</span>
        <small>{[lcDate(blitz.at), blitz.by].filter(Boolean).join(" · ")}</small></div> : null}
      {onCheck && data.can ? <button type="button" className="rp-chip" data-rp-live-go="" onClick={onCheck} style={{ marginTop: 8 }}>Проверить вживую</button> : null}
    </section>
  );
}

/** Новый итог живой проверки, который человек ещё не видел: последний за 14 дней с id больше просмотренного */
export function freshResult(checks, seen = 0, now = Date.now()) {
  const list = (Array.isArray(checks) ? checks : []).filter((c) => c && Number(c.id) > Number(seen || 0) && now - Date.parse(c.at || "") < 14 * 864e5);
  return list.sort((a, b) => Number(b.id) - Number(a.id))[0] || null;
}

/** Карточка на вкладке «Смена»: тебя проверили вживую — процент, что повторить, «Открыть урок» */
export function LiveResultCard({ a11y, check, onLesson = null, onOpen = null, onHide = null }) {
  if (!check) return null;
  const gold = a11y ? "#7A5D2A" : "#D9B87C", text = a11y ? "#2A1F0E" : "#EFE4C8", sub = a11y ? "#6B5B40" : "#A99B7E";
  const ok = a11y ? "#2C6B48" : "#8AD8AF", warn = a11y ? "#8B5A12" : "#E4B36A";
  const mod = check.k === "blitz" || check.m === "blitz" ? null : modOf(check.t, check.m);
  const title = check.k === "blitz" || check.m === "blitz" ? "Блиц" : check.ti || (mod && mod.title) || check.m;
  const rep = Array.isArray(check.rp) ? check.rp.filter((x) => x && x.l) : [];
  const btn = { flex: 1, padding: "9px 12px", borderRadius: 999, border: "1px solid " + (a11y ? "rgba(139,106,48,0.35)" : "rgba(214,178,102,0.3)"),
    background: a11y ? "rgba(139,106,48,0.08)" : "rgba(214,178,102,0.08)", color: text, fontFamily: "Georgia, serif", fontSize: 13.5, cursor: "pointer" };
  return (
    <div data-lc-mine={check.id} className="sa-card" data-lens-card="" style={{ position: "relative", margin: "12px 0 0", padding: "14px 16px", borderRadius: 18,
      border: "1px solid " + (a11y ? "rgba(139,106,48,0.3)" : "rgba(214,178,102,0.22)"), background: a11y ? "rgba(255,252,244,0.7)" : "rgba(255,250,238,0.04)" }}>
      {onHide ? <button type="button" data-lc-mine-x="" aria-label="Скрыть" onClick={onHide}
        style={{ position: "absolute", top: 8, right: 10, border: 0, background: "none", color: sub, fontSize: 18, cursor: "pointer", padding: 6 }}>×</button> : null}
      <div style={{ fontStyle: "italic", fontFamily: "Georgia, serif", fontSize: 13, color: gold }}>Живая проверка</div>
      <div style={{ fontFamily: "Georgia, serif", fontSize: 16, color: text, marginTop: 4, paddingRight: 24 }}>
        «{title}»: <b style={{ color: check.p ? ok : warn }}>{check.s}%</b>, {check.p ? "зачтено" : "не зачтено"}</div>
      <div style={{ fontSize: 12.5, color: sub, marginTop: 4 }}>{[lcDate(check.at), check.by].filter(Boolean).join(" · ")}</div>
      {rep.length ? <div data-lc-mine-rep="" style={{ fontSize: 13.5, color: text, marginTop: 8, lineHeight: 1.45 }}>Повторить: {rep.map((x) => "«" + (x.t || x.l) + "»").join(", ")}</div> : null}
      <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
        {rep.length && onLesson ? <button type="button" data-lc-mine-lesson={rep[0].l} onClick={() => onLesson(rep[0].l)} style={btn}>Открыть урок</button> : null}
        {onOpen ? <button type="button" data-lc-mine-open="" onClick={onOpen} style={btn}>Мои проверки</button> : null}
      </div>
    </div>
  );
}
