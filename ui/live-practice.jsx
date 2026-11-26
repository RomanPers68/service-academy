// ui/live-practice.jsx — v202 (Доп. 527): «Повтори вслух» в «Работе над ошибками».
// Владелец (27.11) на предложения, как ещё упростить живую проверку: «Давай все, кроме 10-го и 2-го». Пятое из них:
// вопросы живой проверки и брифинга, где человек назвал не всё, попадают в «Работу над ошибками». Он отвечает вслух своими
// словами, открывает пункты и сверяется. «Назвал всё» убирает вопрос до следующей проверки (на телефоне, sa_lc_practice) и
// идёт в значок «Работа над ошибками». Пересдачу это не портит: на ней будут другие вопросы (lib/live-check.js, pickQuestions).
import React from "react";
import { vibrate } from "../lib/utils";
import { labelStyle } from "./tokens";
import { MODULES_INDEX } from "../data/modules-index";
import { LIVE_CHECK } from "../data/live-check";
import { mergeBank, menuQuestions, failedItems, lcDate, LC_MENU } from "../lib/live-check";
import { lcPerson, useLcQuestions, saveMine, readMine, practiceDone, practiceMark } from "../lib/live-check-api";

const ALL_MODS = Object.values(MODULES_INDEX).flatMap((ms) => ms || []);
const modTitle = (id) => (id === LC_MENU ? "Меню заведения" : (ALL_MODS.find((m) => m.id === id) || {}).title || "");
const plural = (n, a, b, c) => { const d = n % 10, h = n % 100; return d === 1 && h !== 11 ? a : d >= 2 && d <= 4 && (h < 12 || h > 14) ? b : c; };

export function LivePractice({ T, a11y, profile, uk = "", onFixed }) {
  const gold = a11y ? "#7A5D2A" : "#D9B87C", ok = a11y ? "#2C6B48" : "#8AD8AF", line = a11y ? "rgba(139,106,48,0.22)" : "rgba(214,178,102,0.18)";
  const sub = T.modSub.color, text = T.modTitle.color;
  const [checks, setChecks] = React.useState(() => ((readMine(uk) || {}).checks || []));
  const lq = useLcQuestions();
  const bank = React.useMemo(() => mergeBank(LIVE_CHECK, lq.rows), [lq.rows]);
  const [menuQs, setMenuQs] = React.useState([]);
  const [done, setDone] = React.useState(() => practiceDone(uk));
  const [open, setOpen] = React.useState({});
  const rest = (profile && profile.restaurant) || "";
  React.useEffect(() => {
    let alive = true;
    lcPerson("").then((r) => { if (alive && r && r.ok) { setChecks(Array.isArray(r.checks) ? r.checks : []); saveMine(uk, r.checks); } });
    return () => { alive = false; };
  }, [uk]);
  React.useEffect(() => {
    if (!rest) return undefined;
    let alive = true;
    Promise.all([import("../lib/menu-pack"), import("../lib/deck-extras")])
      .then(([mp, dx]) => { if (alive) setMenuQs(menuQuestions(mp.menuNow(rest), { label: dx.allergenLabel })); }).catch(() => {});
    return () => { alive = false; };
  }, [rest]);
  const items = failedItems(checks, bank, { menuQs, done });
  if (!items.length) return null;
  const card = { ...T.modCard, display: "block", padding: "12px 14px", marginBottom: 10, cursor: "default" };
  const ghost = { padding: "7px 12px", borderRadius: 999, border: "1px solid " + line, background: "transparent", color: text, fontSize: 13, fontFamily: "Georgia, serif", cursor: "pointer" };
  const fixed = (k) => { vibrate("success"); setDone(practiceMark(uk, k)); if (onFixed) onFixed(); };
  return (
    <div data-live-practice={items.length} style={{ padding: "10px 16px 4px" }}>
      <div style={{ ...labelStyle(13.5), color: gold, margin: "0 2px 4px" }}>{"Повтори вслух · " + items.length}</div>
      <div style={{ fontSize: 13, color: sub, lineHeight: 1.5, margin: "0 2px 10px" }}>
        {items.length + " " + plural(items.length, "вопрос", "вопроса", "вопросов") + " с живой проверки, где ты назвал не всё. Ответь вслух своими словами, потом открой, что должно прозвучать, и сверься."}
      </div>
      {items.map((it) => (
        <div key={it.k} data-live-practice-q={it.k} style={card} data-lens-card="">
          <div style={{ fontSize: 12, color: sub, marginBottom: 4 }}>{[modTitle(it.m), lcDate(it.at) ? "проверка " + lcDate(it.at) : "", "было " + it.g + " из " + it.o].filter(Boolean).join(" · ")}</div>
          <div style={{ fontFamily: "Georgia, serif", fontSize: 15.5, color: text, lineHeight: 1.45, fontWeight: "bold" }}>{it.q}</div>
          {!open[it.k] ? (
            <button type="button" data-live-practice-open={it.k} onClick={() => { vibrate("light"); setOpen((o) => ({ ...o, [it.k]: true })); }} style={{ ...ghost, display: "block", width: "100%", marginTop: 10 }}>Показать, что должно прозвучать</button>
          ) : (<>
            <ul style={{ margin: "10px 0 6px", paddingLeft: 18, color: text, fontSize: 14, lineHeight: 1.5 }}>{it.a.map((x, j) => <li key={j}>{x}</li>)}</ul>
            <div style={{ display: "flex", gap: 8 }}>
              <button type="button" data-live-practice-ok={it.k} onClick={() => fixed(it.k)} style={{ ...ghost, flex: 1, borderColor: ok, color: ok }}>Назвал всё</button>
              <button type="button" data-live-practice-later={it.k} onClick={() => setOpen((o) => ({ ...o, [it.k]: false }))} style={{ ...ghost, flex: 1, color: sub }}>Ещё повторю</button>
            </div>
          </>)}
        </div>))}
    </div>
  );
}
