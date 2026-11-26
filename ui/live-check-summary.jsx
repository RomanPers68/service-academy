// ui/live-check-summary.jsx — v200 (Доп. 525): раздел «Живая проверка» в отчёте по сотруднику (ui/report.jsx): последние
// итоги по модулям и «Проверить вживую». Отдельно от экрана проверки, чтобы отчёт не тянул вопросы (data/live-check.js).
import React from "react";
import { MODULES_INDEX } from "../data/modules-index";
import { lastByModule, lcDate } from "../lib/live-check";

/** Раздел отчёта по сотруднику (ui/report.jsx): последние итоги по модулям. data — ответ live_check_person;
 *  onCheck — «Проверить вживую» (если смотрящий может проверять этого человека) */
export function LiveCheckSummary({ data, onCheck = null }) {
  if (!data || !data.ok) return null;
  const last = lastByModule(data.checks);
  const rows = Object.values(last).sort((x, y) => String(y.at || "").localeCompare(String(x.at || "")));
  const titleOfModule = (t, m) => ((MODULES_INDEX[t] || []).find((x) => x.id === m) || {}).title || m;
  const passed = rows.filter((r) => r.p).length;
  return (
    <section className="rp-sec" data-rp-live={rows.length}>
      <h3>Живая проверка<span>{rows.length ? "зачтено " + passed + " из " + rows.length : ""}</span></h3>
      {!rows.length ? <div className="rp-empty">Вживую по урокам ещё не проверяли.</div> : null}
      {rows.slice(0, 12).map((r) => (
        <div key={r.m} className="rp-li" data-rp-live-row={r.m}>
          {titleOfModule(r.t, r.m)} · <span className={r.p ? "ok" : "bad"}>{r.p ? "зачтено" : "не зачтено"}, {r.s}%</span>
          <small>{[lcDate(r.at), r.by, r.note].filter(Boolean).join(" · ")}</small>
        </div>))}
      {onCheck && data.can ? <button type="button" className="rp-chip" data-rp-live-go="" onClick={onCheck} style={{ marginTop: 8 }}>Проверить вживую</button> : null}
    </section>
  );
}
