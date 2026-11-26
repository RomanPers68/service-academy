// ui/live-check.jsx — v200 (Доп. 525): «Живая проверка». Руководитель выбирает человека и модуль и задаёт вопросы вслух
// (data/live-check.js); итог сохраняется на сервере (этап 63) и виден в отчёте по сотруднику.
// Владелец (26.11): «Тестирование это хорошо, но живая проверка тоже важна»; «официанта проверяет менеджер, управляющий
// (если менеджер не может). Менеджера проверяет управляющий. И так далее по возрастанию». Кого показать в списке, решает
// сервер по ступеням должностей (lib/live-check.js — те же правила для демо и проверок).
// v201 (Доп. 526), владелец на десять предложений: «Да, давай сделаем все».
//   • Один вопрос на экране, «что должно прозвучать» открывается касанием: человек рядом не подсмотрит.
//   • Отмечаются пункты, которые человек назвал сам; процент — названо из всех пунктов (этап 64).
//   • Четыре вопроса из восьми, не те, что спрашивали недавно; ситуация последней.
//   • Блиц: три вопроса из уже пройденного. «Сегодня»: кто на смене по графику и что проверить, пересдачи.
//   • Пометки: «тест сдал, вживую нет», «пора повторить» (зачтено больше месяца назад), «пересдача».
//   • Без сети проверка ждёт на телефоне и уходит сама. «Сводка»: заведения, кто проверяет, что чаще не сдают.
import React from "react";
import { vibrate } from "../lib/utils";
import { labelStyle } from "./tokens";
import { MODULES_INDEX } from "../data/modules-index";
import { ROLES } from "../data/roles";
import { LIVE_CHECK } from "../data/live-check";
import { LC_PASS, tracksOf, lastByModule, moduleApp, trackSummary, lcDate, lcErr64, pickQuestions, blitzPick, recentKeys,
  pointsScore, repeatFromItems, moduleFlags, suggestFor, suggestText, onShiftToday, isSituation } from "../lib/live-check";
import { lcPeople, lcPerson, lcSave, lcDelete, lcFlush, lcQueued, lcSummary, lcSchedule, newCid } from "../lib/live-check-api";
import { useOrg, loadOrg, useLens } from "../lib/org";
import { titleOf } from "../lib/org-model";
import { VenueLens } from "./venue-lens";
import { LiquidSegment } from "./widgets";

const P = (a11y) => (a11y
  ? { ok: "#2C6B48", warn: "#8B5A12", bad: "#A33A2A", line: "rgba(139,106,48,0.22)", chip: "rgba(139,106,48,0.10)", gold: "#7A5D2A", on: "rgba(139,106,48,0.18)" }
  : { ok: "#8AD8AF", warn: "#E4B36A", bad: "#E07878", line: "rgba(214,178,102,0.18)", chip: "rgba(214,178,102,0.10)", gold: "#D9B87C", on: "rgba(200,169,110,0.24)" });
const ini = (name) => String(name || "").trim().split(/\s+/).slice(0, 2).map((w) => w[0] || "").join("").toUpperCase();
const trackLabel = (id) => (ROLES.find((r) => r.id === id) || {}).label || id;
const ALL_MODS = Object.entries(MODULES_INDEX).flatMap(([t, ms]) => (ms || []).map((m) => ({ ...m, track: t })));
const modOf = (id) => ALL_MODS.find((m) => m.id === id) || null;
const lessonTitle = (id) => { for (const m of ALL_MODS) { const l = (m.lessons || []).find((x) => x.id === id); if (l) return l.title; } return ""; };
const qByKey = (k) => { const [m, n] = String(k || "").split("#"); return ((LIVE_CHECK[m] || []).find((q) => String(q.n) === n)) || null; };
const plural = (n, a, b, c) => { const d = n % 10, h = n % 100; return d === 1 && h !== 11 ? a : d >= 2 && d <= 4 && (h < 12 || h > 14) ? b : c; };

/** startEmp — сразу открыть человека (из отчёта по сотруднику или свои проверки) */
export function LiveCheckScreen({ T, a11y, profile, onBack, startEmp = null }) {
  const c = P(a11y);
  const org = useOrg();
  React.useEffect(() => { loadOrg(); }, []);
  const lens = useLens(profile);                    // список «кого проверить»: сеть выбирает заведение, остальным — своё
  const lensAll = useLens(profile, { all: true });  // сводка: у сети ещё «Вся сеть»
  const sub = T.modSub.color, text = T.modTitle.color;
  const card = { ...T.modCard, display: "block", padding: "12px 14px", marginBottom: 12, cursor: "default" };
  const ghost = { flex: "0 0 auto", padding: "7px 12px", borderRadius: 999, border: "1px solid " + c.line, background: c.chip, color: text,
    fontSize: 13, fontFamily: "Georgia, serif", cursor: "pointer", whiteSpace: "nowrap" };
  const main = (off) => ({ display: "block", width: "100%", marginTop: 12, padding: 12, borderRadius: 999, border: 0, cursor: off ? "default" : "pointer",
    fontFamily: "Georgia, serif", fontSize: 15, fontWeight: "bold", color: "#1A1008", background: "linear-gradient(180deg,#E4C88C,#C8A96E)", opacity: off ? 0.55 : 1 });
  const h = (t, n = null, key = "") => (
    <div data-lc-h={key} style={{ ...labelStyle(13.5), color: c.gold, margin: "8px 2px 8px", display: "flex", gap: 8, alignItems: "baseline" }}>
      <span style={{ flex: 1 }}>{t}</span>{n != null ? <span style={{ color: sub, fontStyle: "normal" }}>{n}</span> : null}
    </div>);
  const note = (t, key = "") => <div data-lc-msg={key} role="status" style={{ ...card, fontSize: 14, lineHeight: 1.5, color: text }}>{t}</div>;
  const admin = !!(profile && profile.is_admin);

  const [tab, setTab] = React.useState("check");                 // check | sum
  const [list, setList] = React.useState({ phase: "load" });     // load | ready | error
  const [emp, setEmp] = React.useState(startEmp);                  // открытый человек
  const [per, setPer] = React.useState(() => (startEmp ? { phase: "load", id: startEmp } : { phase: "idle" }));
  const [track, setTrack] = React.useState(null);
  const [run, setRun] = React.useState(null);                      // идёт проверка: { kind, mod, qs, step, open, got, memo }
  const [pend, setPend] = React.useState(null);                    // из «Сегодня»: какой модуль открыть, когда человек загрузится
  const [busy, setBusy] = React.useState(false);
  const [res, setRes] = React.useState(null);                      // итог только что сохранённой проверки
  const [msg, setMsg] = React.useState("");
  const [allTracks, setAllTracks] = React.useState(false);        // показать все шесть курсов, а не только по должности
  const [shift, setShift] = React.useState(null);                  // кто сегодня на смене: Set id | null (не знаем)
  const [sum, setSum] = React.useState({ phase: "idle" });
  const [queued, setQueued] = React.useState(lcQueued);
  const top = React.useRef(null);
  const toTop = () => { try { if (top.current && top.current.scrollIntoView) top.current.scrollIntoView({ block: "start" }); } catch (e) { /* */ } };

  const loadList = React.useCallback(() => {
    setList((x) => (x.phase === "ready" ? x : { phase: "load" }));
    lcPeople(lens.network ? lens.venue : null).then((r) => {
      if (r && r.ok) setList({ phase: "ready", people: Array.isArray(r.people) ? r.people : [], restaurant: r.restaurant || "", me: r.me || null });
      else setList({ phase: "error", code: (r && r.error) || "net" });
    });
  }, [lens.network, lens.venue]);
  React.useEffect(() => { if (!startEmp) loadList(); }, [loadList, startEmp]);

  // без сети проверки ждут на телефоне: при открытии экрана и когда связь вернулась — отправить
  React.useEffect(() => {
    const go = () => lcFlush().then((n) => { setQueued(lcQueued()); if (n) { setMsg("Отправили проверки, которые ждали связи: " + n + "."); if (!startEmp) loadList(); } });
    go();
    window.addEventListener("online", go);
    return () => window.removeEventListener("online", go);
  }, []);   // eslint-disable-line react-hooks/exhaustive-deps

  // кто сегодня на смене: график заведения на этот месяц (тот же запрос, что у экрана «График»)
  React.useEffect(() => {
    if (list.phase !== "ready" || !list.restaurant) return undefined;
    let alive = true;
    lcSchedule(list.restaurant).then((r) => { if (alive) setShift(r ? onShiftToday(r, list.people) : null); });
    return () => { alive = false; };
  }, [list.phase, list.restaurant, list.people]);

  const loadPerson = React.useCallback((id) => {
    setPer((x) => (x.phase === "ready" && x.id === id ? x : { phase: "load", id }));
    lcPerson(id).then((r) => {
      if (r && r.ok && r.person) {
        setPer({ phase: "ready", id, ...r });
        setTrack((t) => t || tracksOf(r.person.position)[0] || "seasonal");
      } else setPer({ phase: "error", id, code: (r && r.error) || "net" });
    });
  }, []);
  React.useEffect(() => { if (emp) loadPerson(emp); }, [emp, loadPerson]);

  const sumVenue = lensAll.network ? (lensAll.all ? null : lensAll.venue) : null;
  React.useEffect(() => {
    if (tab !== "sum") return undefined;
    let alive = true;
    setSum((x) => ({ ...x, phase: "load" }));
    lcSummary(sumVenue).then((r) => { if (alive) setSum(r && r.ok ? { phase: "ready", data: r } : { phase: "error", code: (r && r.error) || "net" }); });
    return () => { alive = false; };
  }, [tab, sumVenue]);

  const person = per.phase === "ready" ? per.person : null;
  const self = !!(person && profile && String(person.id) === String(profile.id));
  const pname = person ? (person.name + " " + (person.surname || "")).trim() : "";
  const checks = per.phase === "ready" ? (per.checks || []) : [];
  const last = lastByModule(checks.filter((x) => x.k !== "blitz" && x.m !== "blitz"));
  const lastBlitz = checks.find((x) => x.k === "blitz" || x.m === "blitz") || null;
  const mods = track ? MODULES_INDEX[track] || [] : [];
  const lessons = per.phase === "ready" ? new Set(per.lessons || []) : new Set();
  const quiz = per.phase === "ready" ? (per.quiz || []) : [];
  const tests = per.phase === "ready" ? (per.tests || {}) : {};
  const myTracks = person ? [...new Set([...tracksOf(person.position), ...(track ? [track] : [])])] : [];
  const doneMods = myTracks.flatMap((t) => (MODULES_INDEX[t] || []).filter((m) => moduleApp(m, lessons, new Set(quiz)).state === "done" || (last[m.id] && last[m.id].p)).map((m) => m.id));

  const startRun = (kind, mod) => {
    vibrate("light"); setMsg("");
    const recent = recentKeys(checks);
    const qs = kind === "blitz" ? blitzPick(LIVE_CHECK, doneMods, recent) : pickQuestions(LIVE_CHECK[mod.id] || [], mod.id, recent);
    if (!qs.length) { setMsg("Для блица нужно хотя бы один модуль, пройденный в приложении."); return; }
    setRun({ kind, mod, qs, step: 0, open: qs.map(() => false), got: qs.map(() => []), memo: "", cid: newCid() });
    toTop();
  };
  // из «Сегодня»: человек загрузился — сразу проверка модуля
  React.useEffect(() => {
    if (!pend || per.phase !== "ready" || per.id !== pend.emp) return;
    const m = modOf(pend.m);
    setPend(null);
    if (m && per.can) { setTrack(m.track); startRun("module", m); }
  }, [pend, per]);   // eslint-disable-line react-hooks/exhaustive-deps

  const back = () => {
    vibrate("light"); setMsg("");
    if (res) { setRes(null); setRun(null); toTop(); return; }
    if (run && run.step > 0) { setRun({ ...run, step: run.step - 1 }); return; }
    if (run) { setRun(null); toTop(); return; }
    if (emp && !startEmp) { setEmp(null); setTrack(null); setAllTracks(false); setPer({ phase: "idle" }); loadList(); toTop(); return; }
    onBack();
  };
  const view = res ? "result" : run ? (run.kind === "blitz" ? "blitz" : "module") : emp ? "person" : tab === "sum" ? "sum" : "list";

  // ── проверка: вопрос на экране, пункты галочками ──
  const setQ = (patch) => setRun((r) => ({ ...r, ...patch }));
  const reveal = (i) => { vibrate("light"); setRun((r) => ({ ...r, open: r.open.map((v, j) => (j === i ? true : v)) })); };
  const togglePt = (i, j) => { vibrate("light"); setRun((r) => ({ ...r, got: r.got.map((g, k) => (k !== i ? g : g.includes(j) ? g.filter((x) => x !== j) : [...g, j].sort())) })); };
  const allPts = (i, on) => { vibrate("light"); setRun((r) => ({ ...r, got: r.got.map((g, k) => (k !== i ? g : on ? r.qs[i].a.map((_, j) => j) : [])) })); };
  const items = run ? run.qs.map((q, i) => ({ k: q.k, g: run.got[i].length, o: q.a.length })) : [];
  const preview = run && run.step >= run.qs.length ? pointsScore(items) : null;
  const save = async () => {
    if (busy || !run || !preview) return;
    setBusy(true); setMsg("");
    const rep = repeatFromItems(run.qs, run.got);
    const r = await lcSave({ emp, track: run.kind === "blitz" ? (tracksOf(person && person.position)[0] || track || "seasonal") : track,
      module: run.kind === "blitz" ? "blitz" : run.mod.id, items, note: run.memo.trim(), kind: run.kind, cid: run.cid,
      title: run.kind === "blitz" ? "Блиц" : run.mod.title, repeat: rep.map((l) => ({ l, t: lessonTitle(l) })) });
    setBusy(false);
    if (r && r.ok) {
      vibrate(r.passed ? "success" : "light");
      setRes({ id: r.id, score: r.score, passed: !!r.passed, repeat: rep, queued: !!r.queued, kind: run.kind, title: run.kind === "blitz" ? "Блиц" : run.mod.title });
      setQueued(lcQueued());
      if (!r.queued) loadPerson(emp);
      toTop();
    } else { vibrate("error"); setMsg(lcErr64(r && r.error, admin)); }
  };
  const undo = async () => {
    if (busy || !res || !res.id) return;
    setBusy(true);
    const r = await lcDelete(res.id);
    setBusy(false);
    if (r && r.ok) { setRes(null); setRun(null); setMsg("Проверка убрана. Модуль можно проверить заново."); loadPerson(emp); toTop(); }
    else setMsg(lcErr64(r && r.error, admin));
  };
  const nextMod = () => {
    const i = mods.findIndex((m) => run && run.mod && m.id === run.mod.id);
    const nx = mods.slice(i + 1).find((m) => !(last[m.id] && last[m.id].p) && (LIVE_CHECK[m.id] || []).length) || null;
    setRes(null); setRun(null);
    if (nx) startRun("module", nx); else toTop();
  };

  // ── «Сегодня»: на смене и что проверить; пересдачи ──
  const people = list.phase === "ready" ? list.people : [];
  const sugg = people.map((p) => ({ p, s: suggestFor(p, MODULES_INDEX) }));
  const today = shift ? sugg.filter((x) => shift.has(x.p.id)) : [];
  const retakes = sugg.filter((x) => x.s.retake.length && !(shift && shift.has(x.p.id)));
  const ideas = !shift || !today.length ? sugg.filter((x) => x.s.top && x.s.top.kind !== "recheck").slice(0, 5) : [];
  const canSum = !!(admin || (list.me && list.me.level >= 30));
  const openPerson = (id, m = null) => { vibrate("light"); setEmp(id); setTrack(null); setPend(m ? { emp: id, m } : null); toTop(); };
  const sugRow = ({ p, s }, i, key) => {
    const n = (p.name + " " + (p.surname || "")).trim();
    const go = () => openPerson(p.id, s.top && s.top.kind !== "recheck" ? s.top.m : null);
    return (
      <div key={p.id + key} data-lc-sug={p.id} data-lc-sug-kind={s.top ? s.top.kind : ""} role="button" tabIndex={0} onClick={go}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); go(); } }}
        style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 0", borderTop: i ? "1px solid " + c.line : 0, cursor: "pointer" }}>
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{ display: "block", fontFamily: "Georgia, serif", fontSize: 14.5, color: text, fontWeight: "bold" }}>{n}</span>
          <span style={{ display: "block", fontSize: 12.5, color: s.top && s.top.kind === "retake" ? c.warn : sub, lineHeight: 1.4 }}>{s.top ? suggestText(s.top) : (p.checks || []).length ? "всё зачтено, можно блиц" : "в приложении пока ничего не пройдено"}</span>
        </span>
        <span style={{ flex: "0 0 auto", fontSize: 12.5, color: c.gold }}>{s.top && s.top.kind !== "recheck" ? "Проверить" : "Открыть"}</span>
        <span aria-hidden="true" style={{ color: sub, fontSize: 18 }}>›</span>
      </div>);
  };

  const titleLine = view === "list" || view === "sum" ? "Живая проверка" : pname || "Живая проверка";
  const runQ = run && run.step < run.qs.length ? run.qs[run.step] : null;
  return (
    <div style={T.screen} className="sa-screen" data-lc={view} ref={top}>
      <div style={T.lessHead}>
        <button className="sa-hit" style={T.backBtn2} data-lens="back" aria-label="Вернуться" onClick={back}>‹</button>
        <div style={{ ...T.lessHeadTitle, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{titleLine}</div>
      </div>
      <div style={{ flex: 1, padding: "14px 16px 28px" }}>

        {(view === "list" || view === "sum") && canSum ? (
          <div data-lc-tabs="" style={{ margin: "0 0 12px" }}>
            <LiquidSegment a11y={a11y} equal activeId={tab} onSelect={(id) => { vibrate("light"); setTab(id); }}
              items={[{ id: "check", label: "Проверить", render: () => <span data-lc-tab="check">Проверить</span> },
                { id: "sum", label: "Сводка", render: () => <span data-lc-tab="sum">Сводка</span> }]} />
          </div>) : null}

        {view === "list" ? (<>
          <div style={{ fontSize: 13.5, color: sub, lineHeight: 1.55, margin: "0 2px 10px" }}>
            Спроси по урокам вслух: по четыре вопроса на модуль. Человек отвечает своими словами, ты отмечаешь, что он назвал сам. Так видно, читал ли он уроки.
          </div>
          <VenueLens a11y={a11y} lens={lens} style={{ margin: "0 0 10px" }} />
          {msg ? note(msg, "info") : null}
          {queued ? note("Ждут связи: " + queued + " " + plural(queued, "проверка", "проверки", "проверок") + ". Отправим, когда появится сеть.", "queued") : null}
          {list.phase === "load" ? note("Загружаю, кого можно проверить…", "load") : null}
          {list.phase === "error" ? note(lcErr64(list.code, admin), list.code) : null}
          {list.phase === "ready" && !list.people.length ? note("Пока некого проверять. Здесь появятся те, кого ты проверяешь по должности.", "empty") : null}
          {list.phase === "ready" && today.length ? (<>
            {h("Сегодня на смене", today.length, "today")}
            <div style={{ ...card, padding: "2px 14px" }} data-lc-today={today.length} data-lens-card="">{today.map((x, i) => sugRow(x, i, "t"))}</div>
          </>) : null}
          {list.phase === "ready" && ideas.length ? (<>
            {h("Кого проверить", ideas.length, "ideas")}
            <div style={{ ...card, padding: "2px 14px" }} data-lc-ideas={ideas.length} data-lens-card="">{ideas.map((x, i) => sugRow(x, i, "i"))}</div>
          </>) : null}
          {list.phase === "ready" && retakes.length ? (<>
            {h("Пересдача", retakes.length, "retake")}
            <div style={{ ...card, padding: "2px 14px" }} data-lc-retakes={retakes.length} data-lens-card="">
              {retakes.map(({ p, s }, i) => sugRow({ p, s: { ...s, top: { kind: "retake", ...s.retake[0] } } }, i, "r"))}
            </div>
          </>) : null}
          {list.phase === "ready" && list.people.length ? (<>
            {h("Все, кого можно проверить", list.people.length, "people")}
            <div style={{ ...card, padding: "2px 14px" }} data-lens-card="">
              {list.people.map((p, i) => {
                const n = (p.name + " " + (p.surname || "")).trim();
                const ch = (Array.isArray(p.checks) ? p.checks : []).filter((x) => x.k !== "blitz" && x.m !== "blitz");
                const ok = ch.filter((x) => x.p).length;
                const lastAt = ch.reduce((a, x) => (String(x.at || "") > a ? String(x.at || "") : a), "");
                const s = sugg[i] ? sugg[i].s : null;
                const go = () => openPerson(p.id);
                return (
                  <div key={p.id} data-lc-person={p.id} role="button" tabIndex={0} onClick={go} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); go(); } }}
                    style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 0", borderTop: i ? "1px solid " + c.line : 0, cursor: "pointer" }}>
                    <span aria-hidden="true" data-lens="person" style={{ width: 38, height: 38, borderRadius: "50%", flexShrink: 0, display: "inline-grid", placeItems: "center",
                      background: "linear-gradient(135deg,#C8A96E,#7A5D2A)", color: "#fff", fontFamily: "Georgia, serif", fontWeight: "bold", fontSize: 13 }}>{ini(n)}</span>
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ display: "block", fontFamily: "Georgia, serif", fontSize: 15, color: text, fontWeight: "bold" }}>{n}{shift && shift.has(p.id) ? <span data-lc-onshift="" style={{ fontWeight: "normal", fontSize: 12, color: c.gold }}> · на смене</span> : null}</span>
                      <span style={{ display: "block", fontSize: 12.5, color: sub, lineHeight: 1.4 }}>
                        {[titleOf(org, { id: p.id, position: p.position, job_title: p.title }),
                          ch.length ? "зачтено " + ok + " " + plural(ok, "модуль", "модуля", "модулей") + " из " + ch.length + ", последняя " + lcDate(lastAt) : "ещё не проверяли",
                          s && s.gap.length ? "тест сдал, вживую нет: " + s.gap.length : ""].filter(Boolean).join(" · ")}
                      </span>
                    </span>
                    <span aria-hidden="true" style={{ color: sub, fontSize: 18 }}>›</span>
                  </div>);
              })}
            </div>
          </>) : null}
        </>) : null}

        {view === "sum" ? (<>
          <VenueLens a11y={a11y} lens={lensAll} style={{ margin: "0 0 10px" }} />
          {sum.phase === "load" || sum.phase === "idle" ? note("Собираю сводку…", "load") : null}
          {sum.phase === "error" ? note(lcErr64(sum.code, admin), sum.code) : null}
          {sum.phase === "ready" ? (() => {
            const d = sum.data, tt = d.totals || {};
            if (!tt.checks && !tt.blitz) return note("За " + d.days + " " + plural(d.days, "день", "дня", "дней") + " живых проверок ещё не было.", "sum-empty");
            return (<>
              <div data-lc-sum-tot="" style={{ ...card, fontSize: 14, lineHeight: 1.6, color: text }}>
                <div style={{ fontSize: 12.5, color: sub }}>{(d.restaurant || "Вся сеть") + " · за " + d.days + " " + plural(d.days, "день", "дня", "дней")}</div>
                <div>Проверок: <b>{tt.checks}</b>{tt.blitz ? ", блицев " + tt.blitz : ""} · людей {tt.people}</div>
                <div>Зачтено: <b>{tt.passed}</b> из {tt.checks} · средний результат <b>{tt.avg}%</b></div>
              </div>
              {(d.venues || []).length ? (<>
                {h("По заведениям", d.venues.length, "venues")}
                <div style={{ ...card, padding: "2px 14px" }} data-lens-card="">
                  {d.venues.map((v, i) => (
                    <div key={v.name} data-lc-sum-venue={v.name} style={{ padding: "10px 0", borderTop: i ? "1px solid " + c.line : 0 }}>
                      <div style={{ fontFamily: "Georgia, serif", fontSize: 14.5, color: text, fontWeight: "bold" }}>{v.name || "Без заведения"}</div>
                      <div style={{ fontSize: 12.5, color: sub, lineHeight: 1.45 }}>проверок {v.checks} · зачтено {v.passed} · средний {v.avg}%{v.blitz ? " · блицев " + v.blitz : ""}</div>
                      {(v.checkers || []).length ? <div data-lc-sum-checkers="" style={{ fontSize: 12.5, color: sub, lineHeight: 1.45 }}>Проверяли: {v.checkers.map((x) => x.name + " " + x.n).join(", ")}</div> : null}
                    </div>))}
                </div>
              </>) : null}
              {(d.modules || []).length ? (<>
                {h("Чаще не сдают", d.modules.length, "weak-mods")}
                <div style={{ ...card, padding: "2px 14px" }} data-lens-card="">
                  {d.modules.map((m, i) => {
                    const mm = modOf(m.m);
                    return (
                      <div key={m.t + m.m} data-lc-sum-mod={m.m} style={{ padding: "10px 0", borderTop: i ? "1px solid " + c.line : 0 }}>
                        <div style={{ fontFamily: "Georgia, serif", fontSize: 14.5, color: text }}>{mm ? mm.title : m.m}</div>
                        <div style={{ fontSize: 12.5, color: sub }}>{trackLabel(m.t)} · средний {m.avg}% · не зачтено {m.failed} из {m.n}</div>
                      </div>);
                  })}
                </div>
              </>) : null}
              {(d.questions || []).length ? (<>
                {h("Вопросы, на которых чаще молчат", d.questions.length, "weak-qs")}
                <div style={{ ...card, padding: "2px 14px" }} data-lens-card="">
                  {d.questions.map((q, i) => {
                    const qq = qByKey(q.k), mm = modOf(String(q.k).split("#")[0]);
                    return (
                      <div key={q.k} data-lc-sum-q={q.k} style={{ padding: "10px 0", borderTop: i ? "1px solid " + c.line : 0 }}>
                        <div style={{ fontSize: 14, color: text, lineHeight: 1.45 }}>{qq ? qq.q : q.k}</div>
                        <div style={{ fontSize: 12.5, color: sub }}>{mm ? mm.title : ""} · назвали {q.pct}% пунктов · ответов {q.n}</div>
                      </div>);
                  })}
                </div>
                <div style={{ fontSize: 12.5, color: sub, margin: "-4px 2px 12px", lineHeight: 1.45 }}>Если на вопрос часто молчат, урок не читают или он непонятный: стоит разобрать его на брифинге.</div>
              </>) : null}
            </>);
          })() : null}
        </>) : null}

        {view === "person" ? (<>
          {per.phase === "load" ? note("Загружаю…", "load") : null}
          {per.phase === "error" ? note(lcErr64(per.code, admin), per.code) : null}
          {person ? (<>
            <div style={{ fontSize: 13, color: sub, margin: "0 2px 10px" }}>
              {[titleOf(org, { id: person.id, position: person.position, job_title: person.title }), person.restaurant].filter(Boolean).join(" · ")}
            </div>
            {msg ? note(msg, "info") : null}
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12 }} role="group" aria-label="Курс">
              {[...new Set([...tracksOf(person.position), "seasonal", "core", "spg", "bar", "manager", "service_manager"])].map((t) => {
                const own = tracksOf(person.position).includes(t);
                if (!own && t !== track && !allTracks) return null;
                const on = t === track;
                return <button key={t} type="button" data-lc-track={t} aria-pressed={on} onClick={() => { vibrate("light"); setTrack(t); }}
                  style={{ ...ghost, background: on ? c.on : c.chip, borderColor: on ? c.gold : c.line, fontWeight: on ? "bold" : "normal" }}>{trackLabel(t)}</button>;
              })}
              {!allTracks ? <button type="button" data-lc-tracks-all="" onClick={() => setAllTracks(true)} style={{ ...ghost, color: sub }}>Другие курсы</button> : null}
            </div>
            {(() => {
              const s = trackSummary(mods, last);
              return <div data-lc-sum={s.passed + "/" + s.total} style={{ fontSize: 14, color: text, margin: "0 2px 10px" }}>
                Зачтено модулей: <b>{s.passed}</b> из {s.total}{s.checked > s.passed ? ", не зачтено " + (s.checked - s.passed) : ""}</div>;
            })()}
            {per.can ? (
              <div style={{ ...card, display: "flex", alignItems: "center", gap: 12 }} data-lens-card="">
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: "block", fontFamily: "Georgia, serif", fontSize: 14.5, color: text, fontWeight: "bold" }}>Блиц на 2 минуты</span>
                  <span data-lc-blitz-last="" style={{ display: "block", fontSize: 12.5, color: sub, lineHeight: 1.4 }}>
                    {lastBlitz ? "Последний " + lcDate(lastBlitz.at) + ": " + lastBlitz.s + "%" : "Три вопроса из того, что уже пройдено"}</span>
                </span>
                <button type="button" data-lc-blitz="" disabled={!doneMods.length} onClick={() => startRun("blitz", null)}
                  style={{ ...ghost, opacity: doneMods.length ? 1 : 0.5, cursor: doneMods.length ? "pointer" : "default" }}>Начать</button>
              </div>) : null}
            {!per.can ? <div data-lc-note-self={self ? "1" : "0"} style={{ fontSize: 12.5, color: sub, margin: "0 2px 10px", lineHeight: 1.45 }}>
              {self ? "Здесь твои живые проверки. Проверяет руководитель: он задаёт вопросы по урокам и отмечает, что ты назвал сам." : "Проверять этого сотрудника может руководитель ступенью выше. Здесь только итоги."}</div> : null}
            <div style={{ ...card, padding: "2px 14px" }} data-lens-card="">
              {mods.map((m, i) => {
                const a = moduleApp(m, lessons, new Set(quiz)), l = last[m.id], can = per.can && (LIVE_CHECK[m.id] || []).length > 0;
                const f = moduleFlags(m, l, { quiz, tests });
                const go = can ? () => startRun("module", m) : null;
                const flag = f.retake ? ["retake", "пересдача"] : f.gap ? ["gap", "тест " + (f.testPct != null ? f.testPct + "%" : "сдан") + ", вживую нет"] : f.recheck ? ["recheck", "пора повторить"] : null;
                return (
                  <div key={m.id} data-lc-module={m.id} data-lc-res={l ? String(l.s) : ""} role={go ? "button" : undefined} tabIndex={go ? 0 : undefined} onClick={go || undefined}
                    onKeyDown={go ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); go(); } } : undefined}
                    style={{ display: "flex", alignItems: "center", gap: 10, padding: "11px 0", borderTop: i ? "1px solid " + c.line : 0, cursor: go ? "pointer" : "default" }}>
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ display: "block", fontFamily: "Georgia, serif", fontSize: 14.5, color: text, lineHeight: 1.35 }}>{m.title}</span>
                      <span style={{ display: "block", fontSize: 12, color: sub, marginTop: 2 }}>
                        {a.state === "done" ? "в приложении пройден" : a.state === "part" ? "в приложении уроков " + a.done + " из " + a.lessons : "в приложении не начат"}
                        {l ? " · проверка " + lcDate(l.at) + (l.by ? ", " + l.by : "") : ""}
                      </span>
                      {flag ? <span data-lc-flag={flag[0]} style={{ display: "block", fontSize: 12, color: flag[0] === "recheck" ? c.gold : c.warn, marginTop: 2 }}>{flag[1]}</span> : null}
                    </span>
                    {l ? <span data-lc-chip={l.p ? "pass" : "fail"} style={{ flex: "0 0 auto", fontSize: 13, fontWeight: "bold", fontFamily: "Georgia, serif", color: l.p ? c.ok : c.warn }}>{(l.p ? "зачтено " : "") + l.s + "%"}</span>
                      : go ? <span style={{ flex: "0 0 auto", fontSize: 12.5, color: c.gold }}>Проверить</span> : null}
                    {go ? <span aria-hidden="true" style={{ color: sub, fontSize: 18 }}>›</span> : null}
                  </div>);
              })}
            </div>
          </>) : null}
        </>) : null}

        {(view === "module" || view === "blitz") && runQ ? (() => {
          const i = run.step, open = run.open[i], got = run.got[i];
          const mm = run.kind === "blitz" ? modOf(runQ.m) : run.mod;
          return (<>
            <div style={{ fontSize: 13, color: sub, margin: "0 2px 6px" }}>{run.kind === "blitz" ? "Блиц" : trackLabel(track) + " · " + run.mod.title}</div>
            <div data-lc-dots="" style={{ display: "flex", gap: 6, margin: "0 2px 12px" }}>
              {run.qs.map((_, j) => <span key={j} style={{ flex: 1, height: 4, borderRadius: 4, background: j < i ? c.gold : j === i ? c.on : c.line }} />)}
            </div>
            <div data-lc-q={i} data-lc-key={runQ.k} style={{ ...card, padding: "16px 14px" }} data-lens-card="">
              <div style={{ fontSize: 12, color: sub, marginBottom: 6 }}>Вопрос {i + 1} из {run.qs.length}
                {run.kind === "blitz" && mm ? " · " + mm.title : ""}{lessonTitle(runQ.l) ? " · урок «" + lessonTitle(runQ.l) + "»" : ""}</div>
              <div style={{ fontFamily: "Georgia, serif", fontSize: 17, color: text, lineHeight: 1.45, fontWeight: "bold" }}>{runQ.q}</div>
              {!open ? (<>
                <div style={{ fontSize: 13, color: sub, lineHeight: 1.5, marginTop: 12 }}>Задай вопрос и дай человеку ответить своими словами. Ответ открой, когда он закончит.</div>
                <button type="button" data-lc-reveal="" onClick={() => reveal(i)} style={{ ...ghost, display: "block", width: "100%", marginTop: 12, padding: "11px 12px", whiteSpace: "normal" }}>Показать, что должно прозвучать</button>
              </>) : (<>
                <div style={{ fontSize: 12.5, color: c.gold, margin: "14px 0 6px" }}>Что назвал сам · {got.length} из {runQ.a.length}</div>
                {runQ.a.map((x, j) => {
                  const on = got.includes(j);
                  return <button key={j} type="button" data-lc-pt={i + ":" + j} aria-pressed={on} onClick={() => togglePt(i, j)}
                    style={{ display: "flex", alignItems: "flex-start", gap: 10, width: "100%", textAlign: "left", margin: "0 0 6px", padding: "10px 12px", borderRadius: 12, cursor: "pointer",
                      border: "1px solid " + (on ? c.ok : c.line), background: on ? c.on : "transparent", color: text, fontFamily: "Georgia, serif", fontSize: 14, lineHeight: 1.4 }}>
                    <span aria-hidden="true" style={{ width: 18, flexShrink: 0, textAlign: "center", color: on ? c.ok : sub, fontWeight: "bold" }}>{on ? "✓" : "○"}</span>
                    <span>{x}</span>
                  </button>;
                })}
                <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
                  <button type="button" data-lc-all="" onClick={() => allPts(i, true)} style={{ ...ghost, flex: 1 }}>Назвал всё</button>
                  <button type="button" data-lc-none="" onClick={() => allPts(i, false)} style={{ ...ghost, flex: 1, color: sub }}>Ничего</button>
                </div>
              </>)}
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              {i > 0 ? <button type="button" data-lc-prev="" onClick={() => setQ({ step: i - 1 })} style={{ ...ghost, padding: "11px 14px" }}>‹ Назад</button> : null}
              <button type="button" data-lc-next-q="" data-lens-btn="main" disabled={!open} onClick={() => { vibrate("light"); setQ({ step: i + 1 }); toTop(); }}
                style={{ ...main(!open), marginTop: 0, flex: 1 }}>{i + 1 < run.qs.length ? "Дальше" : "К итогу"}</button>
            </div>
            {isSituation(runQ) ? <div style={{ fontSize: 12, color: sub, textAlign: "center", marginTop: 8 }}>Ситуация: важно, что человек сделает, а не дословные слова.</div> : null}
          </>);
        })() : null}

        {(view === "module" || view === "blitz") && run && !runQ ? (<>
          <div style={{ fontSize: 13, color: sub, margin: "0 2px 8px" }}>{run.kind === "blitz" ? "Блиц" : trackLabel(track) + " · " + run.mod.title} · итог</div>
          <div data-lc-preview={preview ? preview.score : ""} style={{ ...card, textAlign: "center", padding: "16px 14px" }} data-lens-card="">
            <div style={{ fontFamily: "Georgia, serif", fontSize: 30, fontWeight: "bold", color: preview && preview.passed ? c.ok : c.warn }}>{preview ? preview.score : 0}%</div>
            <div style={{ fontSize: 13, color: sub, marginTop: 2 }}>{preview && preview.passed ? "будет зачтено" : "пока не зачтено"}: названо {items.reduce((a, x) => a + x.g, 0)} из {items.reduce((a, x) => a + x.o, 0)} пунктов</div>
          </div>
          <div style={{ ...card, padding: "4px 14px" }} data-lens-card="">
            {run.qs.map((q, j) => (
              <div key={q.k} role="button" tabIndex={0} data-lc-back-to={j} onClick={() => setQ({ step: j })} onKeyDown={(e) => { if (e.key === "Enter") setQ({ step: j }); }}
                style={{ display: "flex", gap: 10, padding: "9px 0", borderTop: j ? "1px solid " + c.line : 0, cursor: "pointer" }}>
                <span style={{ flex: 1, fontSize: 13.5, color: text, lineHeight: 1.4 }}>{j + 1}. {q.q}</span>
                <span style={{ flex: "0 0 auto", fontSize: 13, fontWeight: "bold", color: run.got[j].length === q.a.length ? c.ok : run.got[j].length ? c.warn : c.bad }}>{run.got[j].length}/{q.a.length}</span>
              </div>))}
          </div>
          <textarea data-lc-note="" data-lens-field="" value={run.memo} maxLength={500} placeholder="Заметка, по желанию: что запомнилось, что подтянуть"
            onChange={(e) => setQ({ memo: e.target.value })} rows={2}
            style={{ width: "100%", boxSizing: "border-box", padding: "10px 12px", borderRadius: 12, border: "1px solid " + c.line, background: c.chip, color: text,
              fontFamily: "Georgia, serif", fontSize: 14, lineHeight: 1.45, resize: "vertical" }} />
          {msg ? <div role="status" data-lc-err="" style={{ fontSize: 13, color: c.bad, marginTop: 8 }}>{msg}</div> : null}
          <button type="button" data-lc-save="" data-lens-btn="main" disabled={busy || !preview} onClick={save} style={main(busy || !preview)}>
            {busy ? "Сохраняю…" : "Сохранить · " + (preview ? preview.score : 0) + "%"}</button>
          <div style={{ fontSize: 12, color: sub, textAlign: "center", marginTop: 8, lineHeight: 1.45 }}>Зачтено от {LC_PASS}%: процент считается по пунктам, которые человек назвал сам.</div>
        </>) : null}

        {view === "result" ? (<>
          <div data-lc-result={res.passed ? "pass" : "fail"} style={{ ...card, textAlign: "center", padding: "18px 14px" }} data-lens-card="">
            <div style={{ fontFamily: "Georgia, serif", fontSize: 34, fontWeight: "bold", color: res.passed ? c.ok : c.warn }}>{res.score}%</div>
            <div style={{ fontFamily: "Georgia, serif", fontSize: 17, color: text, marginTop: 4 }}>{res.passed ? "Зачтено" : "Не зачтено"}</div>
            <div style={{ fontSize: 13, color: sub, marginTop: 6, lineHeight: 1.5 }}>{pname} · {res.title}</div>
          </div>
          {res.queued ? note("Связи нет: проверка сохранена на телефоне и уйдёт сама, когда появится сеть.", "queued") : null}
          {res.repeat.length ? (<>
            {h("Что повторить", res.repeat.length, "repeat")}
            <div style={{ ...card, padding: "6px 14px" }} data-lc-repeat="" data-lens-card="">
              {res.repeat.map((id, i) => <div key={id} style={{ padding: "8px 0", borderTop: i ? "1px solid " + c.line : 0, fontSize: 14, color: text }}>{lessonTitle(id) || id}</div>)}
            </div>
            <div style={{ fontSize: 12.5, color: sub, margin: "-4px 2px 12px", lineHeight: 1.45 }}>Человеку придёт итог и уроки для повтора, если у него включены напоминания. Модуль можно проверить ещё раз позже.</div>
          </>) : null}
          {msg ? note(msg, "info") : null}
          {res.kind === "module" ? <button type="button" data-lc-next="" data-lens-btn="main" onClick={nextMod} style={main(false)}>Следующий модуль</button> : null}
          <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
            <button type="button" data-lc-tomods="" data-lens-btn="soft" onClick={() => { setRes(null); setRun(null); toTop(); }} style={{ ...ghost, flex: 1, padding: "10px 12px" }}>К модулям</button>
            {res.id ? <button type="button" data-lc-undo="" data-lens-btn="soft" disabled={busy} onClick={undo} style={{ ...ghost, flex: 1, padding: "10px 12px", color: sub }}>Убрать проверку</button> : null}
          </div>
        </>) : null}
      </div>
    </div>
  );
}
