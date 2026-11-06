// ui/routine.jsx — v141 (Доп. 459): «Распорядок смены» — руководителю в «Смене», под карточкой «Руководителю смены».
// Четыре шага, как в уроке «Админ на смене»: открытие (чек-лист), брифинг с гоу-листом, закрытие (чек-лист), итог гоу-листа.
// Сделанное отмечается само (lib/routine.js), каждый шаг открывает свой экран, строка внизу — следующий шаг.
import React from "react";
import { rpc, saToken } from "../api/supabase";
import { onActivate, vibrate } from "../lib/utils";
import { labelStyle } from "./tokens";
import { frostOf } from "./home-hubs";
import { routineSteps, routineNext, routineLine, briefGo } from "../lib/routine";

const C = (a11y) => ({
  gold: a11y ? "#7A5D2A" : "#D2A85A",
  text: a11y ? "#2A1F0E" : "#EFE4C8",
  sub: a11y ? "#6B5B40" : "#A99A7C",
  line: a11y ? "rgba(139,106,48,0.28)" : "rgba(214,178,102,0.22)",
  fill: a11y ? "#8B6A30" : "#D2A85A",
});
const ymd = (d) => d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");

/** brief — брифинг дня (brief_today) или null, briefKnown — сервер уже ответил; onOpen(шаг): open | brief | close | go */
export function RoutineCard({ a11y, brief, briefKnown = true, onOpen }) {
  const c = C(a11y);
  const [cl, setCl] = React.useState(null);
  const [go, setGo] = React.useState(null);
  const today = ymd(new Date());
  React.useEffect(() => {
    let alive = true;
    rpc("checklist_get", { p_token: saToken(), p_day: today }).then((d) => { if (alive && d && d.ok) setCl(d); }).catch(() => {});
    return () => { alive = false; };
  }, [today]);
  const hasGo = briefGo(brief).length > 0;
  React.useEffect(() => {
    if (!hasGo) { setGo(null); return undefined; }
    let alive = true;
    rpc("brief_go_get", { p_token: saToken() }).then((r) => { if (alive && r && r.ok && r.go) setGo(r); }).catch(() => {});
    return () => { alive = false; };
  }, [hasGo, brief && brief.at]);   // eslint-disable-line react-hooks/exhaustive-deps
  const steps = routineSteps({ cl, brief, go, briefKnown });
  const next = routineNext(steps);
  const open = (k) => { vibrate("light"); onOpen && onOpen(k); };
  return (
    <div className="sa-card sa-pagein" data-routine="" data-lens-card="" style={{ ...frostOf(a11y), borderRadius: 18, padding: "13px 14px 12px", marginTop: 10, marginBottom: 4 }}>
      <div style={{ ...labelStyle(a11y ? 14.5 : 13.5), color: c.gold }}>Распорядок смены</div>
      <div role="list" style={{ display: "flex", alignItems: "flex-start", marginTop: 10 }}>
        {steps.map((s, i) => {
          const now = next && next.k === s.k;
          const ring = s.done ? { background: c.fill, border: `1.5px solid ${c.fill}`, color: a11y ? "#F5ECD8" : "#1A1008" }
            : { background: "transparent", border: `1.5px ${s.skip ? "dashed" : "solid"} ${now ? c.gold : c.line}`, color: now ? c.gold : c.sub };
          return (
            <div key={s.k} role="listitem" style={{ flex: 1, minWidth: 0, position: "relative", textAlign: "center" }}>
              {i > 0 ? <span aria-hidden="true" style={{ position: "absolute", top: 16, right: "calc(50% + 18px)", width: "calc(100% - 36px)", height: 1.5, background: steps[i - 1].done ? c.fill : c.line }} /> : null}
              <button type="button" data-routine-step={s.k} data-done={s.done ? "1" : "0"} data-skip={s.skip ? "1" : "0"} onClick={() => open(s.k)}
                aria-label={s.title + ": " + (s.full || (s.done ? "сделано, " + s.sub : s.sub))}
                style={{ width: 34, height: 34, borderRadius: "50%", display: "inline-grid", placeItems: "center", cursor: "pointer", fontFamily: "Georgia, serif", fontSize: 14, padding: 0, opacity: s.skip ? 0.55 : 1, ...ring }}>
                {s.done ? "✓" : s.skip ? "·" : i + 1}
              </button>
              <div style={{ fontSize: 11.5, color: s.done || now ? c.text : c.sub, marginTop: 5, lineHeight: 1.2 }}>{s.title}</div>
              <div data-routine-sub={s.k} style={{ fontSize: 10.5, color: c.sub, marginTop: 1, lineHeight: 1.25, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", padding: "0 2px" }}>{s.sub}</div>
            </div>);
        })}
      </div>
      <div data-routine-next={next ? next.k : "done"} role={next ? "button" : undefined} tabIndex={next ? 0 : undefined}
        onClick={next ? () => open(next.k) : undefined} {...(next ? onActivate(() => open(next.k)) : {})}
        style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10, paddingTop: 9, borderTop: `1px solid ${c.line}`, cursor: next ? "pointer" : "default" }}>
        <span style={{ flex: 1, minWidth: 0, fontFamily: "Georgia, serif", fontSize: 14, color: next ? c.text : c.sub }}>{routineLine(steps)}</span>
        {next ? <span aria-hidden="true" style={{ color: c.gold, fontSize: 18, lineHeight: 1 }}>›</span> : null}
      </div>
    </div>
  );
}
