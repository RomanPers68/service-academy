// ui/brief-live-check.jsx — v202 (Доп. 527): «Проверка на брифинге».
// Владелец (27.11) на предложения, как ещё упростить живую проверку: «Давай все, кроме 10-го и 2-го». Первое из них: на
// пятиминутке руководитель задаёт двоим-троим со смены по одному вопросу и отмечает пункты прямо в показе «Провести».
// Ответ сохраняется живой проверкой вида «брифинг» (этап 65; без него — блицем «Брифинг»): итог модуля он не меняет,
// но попадает в «Работу над ошибками» человека и в сводку. Команде блок не отправляется: в брифинг дня (brief_publish)
// он не входит, его видит только тот, кто проводит.
// Кого спросить: кто сегодня в графике (тот же расчёт, что «Сегодня на смене»), сначала те, кому пора; графика нет —
// из всей команды, и руководитель меняет тех, кого нет. Одному из людей — вопрос о блюде, если меню заведено.
import React from "react";
import { vibrate } from "../lib/utils";
import { labelStyle } from "./tokens";
import { MODULES_INDEX } from "../data/modules-index";
import { LIVE_CHECK } from "../data/live-check";
import { lcLevel, onShiftToday, briefPick, briefQuestion, mergeBank, menuQuestions, lcErr65, LC_MENU } from "../lib/live-check";
import { lcPeople, lcSave, newCid, useLcQuestions, useLevels } from "../lib/live-check-api";

const ALL_MODS = Object.values(MODULES_INDEX).flatMap((ms) => ms || []);
const modTitle = (id) => (ALL_MODS.find((m) => m.id === id) || {}).title || "";
const lessonTitle = (id) => { for (const m of ALL_MODS) { const l = (m.lessons || []).find((x) => x.id === id); if (l) return l.title; } return ""; };
const whereOf = (q) => (q.m === LC_MENU ? "Меню" + (q.cat ? " · " + q.cat : "") : modTitle(q.m));

/** Состояние блока: кого спросить и что, отметки и сохранение. sched — ответ schedule_load (false — не пришёл, null — грузим) */
export function useBriefLc({ profile, sched }) {
  const levels = useLevels();
  const can = lcLevel(profile, levels.ups) >= 20;
  const lq = useLcQuestions();
  const bank = React.useMemo(() => mergeBank(LIVE_CHECK, lq.rows), [lq.rows]);
  const restaurant = (profile && profile.restaurant) || "";
  const [people, setPeople] = React.useState(null);   // null — грузим
  const [menuQs, setMenuQs] = React.useState(null);
  const [items, setItems] = React.useState(null);     // [{ emp, name, short, track, q }]
  const [guess, setGuess] = React.useState(false);    // графика нет — из всей команды
  const [on, setOn] = React.useState(true);
  const [marks, setMarks] = React.useState({});       // emp → { open, got: [], busy, saved: { score, g, o }, err }
  React.useEffect(() => {
    if (!can) { setPeople([]); return undefined; }
    let alive = true;
    lcPeople(null).then((r) => { if (alive) setPeople(r && r.ok && Array.isArray(r.people) ? r.people : []); });
    Promise.all([import("../lib/menu-pack"), import("../lib/deck-extras")])
      .then(([mp, dx]) => { if (alive) setMenuQs(menuQuestions(mp.menuNow(restaurant), { label: dx.allergenLabel })); })
      .catch(() => { if (alive) setMenuQs([]); });
    return () => { alive = false; };
  }, [can, restaurant]);
  React.useEffect(() => {
    if (!people || menuQs === null || sched === null || items || !lq.loaded) return;
    const shift = sched ? onShiftToday(sched, people) : null;
    const known = !!(shift && shift.size);
    setGuess(!known);
    // вопросы о блюдах — с этапа 65 (без него ответ на брифинге уходит блицем, а там только вопросы по урокам)
    setItems(briefPick({ people, onShift: known ? shift : null, modsByTrack: MODULES_INDEX, bank, menuQs: lq.stage === false ? [] : menuQs }));
  }, [people, menuQs, sched, items, bank, lq.loaded, lq.stage]);
  const used = () => new Set((items || []).map((x) => x.q.k));
  const personOf = (emp) => (people || []).find((p) => String(p.id) === String(emp)) || null;
  const swapQ = (emp) => {
    vibrate("light");
    setItems((list) => (list || []).map((x) => {
      if (x.emp !== emp) return x;
      const q = briefQuestion(personOf(emp), { modsByTrack: MODULES_INDEX, bank, menuQs: lq.stage === false ? [] : menuQs || [], menu: x.q.m === LC_MENU, exclude: used() });
      return q ? { ...x, q } : x;
    }));
    setMarks((m) => ({ ...m, [emp]: undefined }));
  };
  const other = (emp) => {
    vibrate("light");
    const have = new Set((items || []).map((x) => String(x.emp)));
    const shift = sched ? onShiftToday(sched, people || []) : null;
    const pool = (people || []).filter((p) => !have.has(String(p.id)) && (guess || !shift || shift.has(p.id)));
    const next = briefPick({ people: pool, modsByTrack: MODULES_INDEX, bank, menuQs: [], count: 1 })[0] || null;
    setItems((list) => (next ? (list || []).map((x) => (x.emp === emp ? next : x)) : (list || []).filter((x) => x.emp !== emp)));
    setMarks((m) => ({ ...m, [emp]: undefined }));
  };
  const drop = (emp) => { vibrate("light"); setItems((list) => (list || []).filter((x) => x.emp !== emp)); };
  const put = (emp, patch) => setMarks((m) => ({ ...m, [emp]: { open: false, got: [], ...(m[emp] || {}), ...patch } }));
  const save = async (it) => {
    const mk = marks[it.emp] || { got: [] };
    if (mk.busy || mk.saved) return;
    const g = (mk.got || []).length, o = it.q.a.length;
    put(it.emp, { busy: true, err: "" });
    const rep = g < o && it.q.m !== LC_MENU && it.q.l ? [{ l: it.q.l, t: lessonTitle(it.q.l) }] : [];
    const r = await lcSave({ emp: it.emp, track: it.track, module: "brief", items: [{ k: it.q.k, g, o }], kind: "brief", cid: mk.cid || newCid(), title: "Брифинг", repeat: rep });
    if (r && r.ok) { vibrate(g === o ? "success" : "light"); put(it.emp, { busy: false, saved: { score: r.score, g, o, queued: !!r.queued } }); }
    else { vibrate("error"); put(it.emp, { busy: false, err: lcErr65(r && r.error, !!(profile && profile.is_admin)) }); }
  };
  const live = on && Array.isArray(items) ? items : [];
  return { can, people, items, guess, on, setOn, marks, put, save, swapQ, other, drop, pages: live.map((it) => ({ key: "lc:" + it.emp, title: "Вопрос · " + it.short, it })) };
}

/** Блок в списке брифинга (руководителю, до показа) */
export function BriefLcBlock({ lc, c, a11y }) {
  if (!lc || !lc.can) return null;
  const items = lc.items || [];
  const has = items.length > 0;
  const btn = { border: 0, background: "none", padding: 0, color: c.sub, fontSize: 12.5, textDecoration: "underline", cursor: "pointer", fontFamily: "Georgia, serif" };
  return (
    <div data-brief-block="lc" data-on={lc.on ? "1" : "0"} data-lens-card="" style={{ ...c.frost, padding: "12px 14px", marginBottom: 10, opacity: has && !lc.on ? 0.55 : 1 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
        <div style={{ ...labelStyle(13.5), color: c.gold, flex: 1 }}>Проверка на брифинге</div>
        {has ? <button type="button" role="switch" aria-checked={lc.on} aria-label={(lc.on ? "Убрать из брифинга: " : "Включить в брифинг: ") + "проверка на брифинге"} onClick={() => { vibrate("light"); lc.setOn(!lc.on); }}
          style={{ position: "relative", width: 40, height: 24, borderRadius: 12, border: `1px solid ${lc.on ? c.gold : c.line}`, background: lc.on ? (a11y ? "rgba(139,106,48,0.25)" : "rgba(200,169,110,0.35)") : "transparent", cursor: "pointer", flexShrink: 0 }}>
          <span style={{ position: "absolute", top: 2, left: 2, width: 18, height: 18, borderRadius: "50%", background: lc.on ? (a11y ? "#8B6A30" : "#E4C88C") : c.sub, transform: lc.on ? "translateX(16px)" : "none", transition: "transform .2s" }} />
        </button> : null}
      </div>
      <div style={{ fontSize: 12.5, color: c.sub, lineHeight: 1.45, marginBottom: has ? 8 : 0 }}>
        {lc.items === null ? "Собираю, кого спросить…"
          : !has ? "Спросить некого: в графике на сегодня нет тех, кого ты проверяешь."
          : "По вопросу " + (items.length === 1 ? "одному человеку" : items.length + " людям") + " со смены. Пункты отмечаешь в «Провести», команде этот блок не отправляется." + (lc.guess ? " Графика на сегодня нет: выбрал из всей команды, замени тех, кого нет." : "")}
      </div>
      {items.map((it, i) => (
        <div key={it.emp} data-brief-lc={it.emp} data-brief-lc-key={it.q.k} style={{ padding: "8px 0", borderTop: i ? `1px solid ${c.line}` : 0 }}>
          <div style={{ fontFamily: "Georgia, serif", fontSize: 14.5, color: c.text }}><b>{it.name}</b> <span style={{ fontSize: 12, color: c.sub }}>· {whereOf(it.q)}</span></div>
          <div style={{ fontSize: 13.5, color: c.text, lineHeight: 1.45, marginTop: 2 }}>{it.q.q}</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 14, marginTop: 6 }}>
            <button type="button" data-brief-lc-swap={it.emp} onClick={() => lc.swapQ(it.emp)} style={btn}>Другой вопрос</button>
            <button type="button" data-brief-lc-other={it.emp} onClick={() => lc.other(it.emp)} style={btn}>Другой человек</button>
            <button type="button" data-brief-lc-drop={it.emp} onClick={() => lc.drop(it.emp)} style={btn}>Убрать</button>
          </div>
        </div>))}
    </div>
  );
}

/** Страница показа: вопрос человеку, пункты по касанию, «Записать» */
export function BriefLcPage({ lc, it, c }) {
  const mk = (lc.marks && lc.marks[it.emp]) || { open: false, got: [] };
  const got = mk.got || [];
  const toggle = (j) => { if (mk.saved) return; vibrate("light"); lc.put(it.emp, { got: got.includes(j) ? got.filter((x) => x !== j) : [...got, j].sort() }); };
  const big = { fontFamily: "Georgia, serif", fontSize: 21, color: c.text, lineHeight: 1.45 };
  return (
    <div data-brief-lc-page={it.emp}>
      <div style={{ ...labelStyle(16), color: c.text, marginBottom: 4 }}>{it.name}</div>
      <div style={{ fontSize: 14, color: c.sub, marginBottom: 12 }}>{whereOf(it.q)}{it.q.l && lessonTitle(it.q.l) ? " · урок «" + lessonTitle(it.q.l) + "»" : ""}</div>
      <div data-brief-lc-q={it.q.k} style={big}>{it.q.q}</div>
      {!mk.open ? (<>
        <div style={{ fontSize: 15, color: c.sub, lineHeight: 1.5, marginTop: 14 }}>Дай ответить своими словами. Что должно прозвучать, открой, когда человек закончит.</div>
        <button type="button" data-brief-lc-reveal="" onClick={() => { vibrate("light"); lc.put(it.emp, { open: true }); }} data-lens-btn="soft"
          style={{ marginTop: 14, padding: "10px 18px", borderRadius: 999, border: `1px solid ${c.gold}`, background: "transparent", color: c.gold, fontFamily: "Georgia, serif", fontSize: 15, cursor: "pointer" }}>Показать, что должно прозвучать</button>
      </>) : (<>
        <div style={{ fontSize: 15, color: c.gold, margin: "16px 0 8px" }}>Что назвал сам · {got.length} из {it.q.a.length}</div>
        {it.q.a.map((x, j) => {
          const onp = got.includes(j);
          return <button key={j} type="button" data-brief-lc-pt={j} aria-pressed={onp} onClick={() => toggle(j)} disabled={!!mk.saved}
            style={{ display: "flex", alignItems: "flex-start", gap: 10, width: "100%", textAlign: "left", margin: "0 0 8px", padding: "12px 14px", borderRadius: 14, cursor: mk.saved ? "default" : "pointer",
              border: `1px solid ${onp ? c.gold : c.line}`, background: onp ? (c.a11y ? "rgba(139,106,48,0.16)" : "rgba(200,169,110,0.20)") : "transparent", color: c.text, fontFamily: "Georgia, serif", fontSize: 17, lineHeight: 1.4 }}>
            <span aria-hidden="true" style={{ width: 20, flexShrink: 0, textAlign: "center", color: onp ? c.gold : c.sub, fontWeight: "bold" }}>{onp ? "✓" : "○"}</span>
            <span>{x}</span>
          </button>;
        })}
        {mk.saved ? <div data-brief-lc-saved={mk.saved.score} role="status" style={{ fontSize: 15, color: c.text, marginTop: 8 }}>
          {"Записано: " + mk.saved.g + " из " + mk.saved.o + (mk.saved.queued ? ". Связи нет, уйдёт сама." : ".")}</div>
          : <button type="button" data-brief-lc-save="" disabled={!!mk.busy} onClick={() => lc.save(it)} data-lens-btn="soft"
              style={{ marginTop: 8, padding: "11px 18px", borderRadius: 999, border: `1px solid ${c.gold}`, background: "transparent", color: c.gold, fontFamily: "Georgia, serif", fontSize: 15, cursor: "pointer", opacity: mk.busy ? 0.6 : 1 }}>
              {mk.busy ? "Записываю…" : "Записать ответ"}</button>}
        {mk.err ? <div role="status" style={{ fontSize: 14, color: c.red, marginTop: 8 }}>{mk.err}</div> : null}
      </>)}
    </div>
  );
}
