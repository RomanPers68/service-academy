// ui/live-check.jsx — v200 (Доп. 525): «Живая проверка». Руководитель выбирает человека и модуль, задаёт три-четыре
// вопроса вслух (data/live-check.js) и отмечает, как тот ответил: ответил, частично, не ответил. Итог (процент и
// «зачтено» от 75%) сохраняется на сервере (этап 63) и виден в отчёте по сотруднику.
// Владелец (26.11): «Тестирование это хорошо, но живая проверка тоже важна»; «официанта проверяет менеджер, управляющий
// (если менеджер не может). Менеджера проверяет управляющий. И так далее по возрастанию». Кого показать в списке, решает
// сервер по ступеням должностей (lib/live-check.js — те же правила для демо и проверок).
import React from "react";
import { vibrate } from "../lib/utils";
import { labelStyle } from "./tokens";
import { MODULES_INDEX } from "../data/modules-index";
import { ROLES } from "../data/roles";
import { LIVE_CHECK } from "../data/live-check";
import { LC_MARKS, LC_PASS, tracksOf, lastByModule, moduleApp, trackSummary, lessonsToRepeat, lcScore, lcDate, lcErr } from "../lib/live-check";
import { lcPeople, lcPerson, lcSave, lcDelete } from "../lib/live-check-api";
import { useOrg, loadOrg, useLens } from "../lib/org";
import { titleOf } from "../lib/org-model";
import { VenueLens } from "./venue-lens";

const P = (a11y) => (a11y
  ? { ok: "#2C6B48", warn: "#8B5A12", bad: "#A33A2A", line: "rgba(139,106,48,0.22)", chip: "rgba(139,106,48,0.10)", gold: "#7A5D2A", on: "rgba(139,106,48,0.18)" }
  : { ok: "#8AD8AF", warn: "#E4B36A", bad: "#E07878", line: "rgba(214,178,102,0.18)", chip: "rgba(214,178,102,0.10)", gold: "#D9B87C", on: "rgba(200,169,110,0.24)" });
const ini = (name) => String(name || "").trim().split(/\s+/).slice(0, 2).map((w) => w[0] || "").join("").toUpperCase();
const trackLabel = (id) => (ROLES.find((r) => r.id === id) || {}).label || id;
const lessonTitle = (mods, id) => { for (const m of mods || []) { const l = (m.lessons || []).find((x) => x.id === id); if (l) return l.title; } return ""; };
const plural = (n, a, b, c) => { const d = n % 10, h = n % 100; return d === 1 && h !== 11 ? a : d >= 2 && d <= 4 && (h < 12 || h > 14) ? b : c; };

/** startEmp — сразу открыть человека (из отчёта по сотруднику) */
export function LiveCheckScreen({ T, a11y, profile, onBack, startEmp = null }) {
  const c = P(a11y);
  const org = useOrg();
  React.useEffect(() => { loadOrg(); }, []);
  const lens = useLens(profile);   // сеть выбирает заведение; остальным — своё
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

  const [list, setList] = React.useState({ phase: "load" });     // load | ready | error
  const [emp, setEmp] = React.useState(startEmp);                  // открытый человек
  const [per, setPer] = React.useState(() => (startEmp ? { phase: "load", id: startEmp } : { phase: "idle" }));
  const [track, setTrack] = React.useState(null);
  const [mod, setMod] = React.useState(null);                      // открытый модуль (проверка)
  const [marks, setMarks] = React.useState([]);
  const [memo, setMemo] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [res, setRes] = React.useState(null);                      // итог только что сохранённой проверки
  const [msg, setMsg] = React.useState("");
  const [allTracks, setAllTracks] = React.useState(false);       // показать все шесть курсов, а не только по должности
  const top = React.useRef(null);
  const toTop = () => { try { if (top.current && top.current.scrollIntoView) top.current.scrollIntoView({ block: "start" }); } catch (e) { /* */ } };

  const loadList = React.useCallback(() => {
    setList((x) => (x.phase === "ready" ? x : { phase: "load" }));
    lcPeople(lens.network ? lens.venue : null).then((r) => {
      if (r && r.ok) setList({ phase: "ready", people: Array.isArray(r.people) ? r.people : [], restaurant: r.restaurant || "" });
      else setList({ phase: "error", code: (r && r.error) || "net" });
    });
  }, [lens.network, lens.venue]);
  React.useEffect(() => { loadList(); }, [loadList]);

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

  const back = () => {
    vibrate("light"); setMsg("");
    if (res) { setRes(null); setMod(null); toTop(); return; }
    if (mod) { setMod(null); toTop(); return; }
    if (emp && !startEmp) { setEmp(null); setTrack(null); setAllTracks(false); setPer({ phase: "idle" }); loadList(); toTop(); return; }
    onBack();
  };
  const view = res ? "result" : mod ? "module" : emp ? "person" : "list";

  const person = per.phase === "ready" ? per.person : null;
  const pname = person ? (person.name + " " + (person.surname || "")).trim() : "";
  const last = per.phase === "ready" ? lastByModule(per.checks) : {};
  const mods = track ? MODULES_INDEX[track] || [] : [];
  const lessons = per.phase === "ready" ? new Set(per.lessons || []) : new Set();
  const quiz = per.phase === "ready" ? new Set(per.quiz || []) : new Set();
  const qs = mod ? LIVE_CHECK[mod.id] || [] : [];
  const preview = marks.length === qs.length && qs.length ? lcScore(marks) : null;

  const openModule = (m) => { vibrate("light"); setMsg(""); setMod(m); setMarks([]); setMemo(""); toTop(); };
  const mark = (i, v) => { vibrate("light"); setMarks((x) => { const n = [...x]; n[i] = v; return n; }); };
  const save = async () => {
    if (busy || !mod || marks.length !== qs.length || marks.some((v) => v == null)) { setMsg(lcErr("bad_request")); return; }
    setBusy(true); setMsg("");
    const r = await lcSave({ emp, track, module: mod.id, marks, note: memo.trim() });
    setBusy(false);
    if (r && r.ok) {
      vibrate(r.passed ? "success" : "light");
      setRes({ id: r.id, score: r.score, passed: !!r.passed, repeat: lessonsToRepeat(qs, marks) });
      loadPerson(emp); toTop();
    } else { vibrate("error"); setMsg(lcErr(r && r.error, admin)); }
  };
  const undo = async () => {
    if (busy || !res) return;
    setBusy(true);
    const r = await lcDelete(res.id);
    setBusy(false);
    if (r && r.ok) { setRes(null); setMod(null); setMsg("Проверка убрана. Модуль можно проверить заново."); loadPerson(emp); toTop(); }
    else setMsg(lcErr(r && r.error, admin));
  };
  const nextMod = () => {
    const i = mods.findIndex((m) => mod && m.id === mod.id);
    const nx = mods.slice(i + 1).find((m) => !(last[m.id] && last[m.id].p)) || null;
    setRes(null);
    if (nx) openModule(nx); else { setMod(null); toTop(); }
  };

  const titleLine = view === "list" ? "Живая проверка" : pname || "Живая проверка";
  return (
    <div style={T.screen} className="sa-screen" data-lc={view} ref={top}>
      <div style={T.lessHead}>
        <button className="sa-hit" style={T.backBtn2} data-lens="back" aria-label="Вернуться" onClick={back}>‹</button>
        <div style={{ ...T.lessHeadTitle, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{titleLine}</div>
      </div>
      <div style={{ flex: 1, padding: "14px 16px 28px" }}>

        {view === "list" ? (<>
          <div style={{ fontSize: 13.5, color: sub, lineHeight: 1.55, margin: "0 2px 10px" }}>
            Спроси по урокам вслух: по три-четыре вопроса на модуль. Человек отвечает своими словами, ты отмечаешь, как он ответил. Так видно, читал ли он уроки.
          </div>
          <VenueLens a11y={a11y} lens={lens} style={{ margin: "0 0 10px" }} />
          {list.phase === "load" ? note("Загружаю, кого можно проверить…", "load") : null}
          {list.phase === "error" ? note(lcErr(list.code, admin), list.code) : null}
          {list.phase === "ready" && !list.people.length ? note("Пока некого проверять. Здесь появятся те, кого ты проверяешь по должности.", "empty") : null}
          {list.phase === "ready" && list.people.length ? (<>
            {h("Кого проверить", list.people.length, "people")}
            <div style={{ ...card, padding: "2px 14px" }} data-lens-card="">
              {list.people.map((p, i) => {
                const n = (p.name + " " + (p.surname || "")).trim();
                const ch = Array.isArray(p.checks) ? p.checks : [];
                const ok = ch.filter((x) => x.p).length;
                const lastAt = ch.reduce((a, x) => (String(x.at || "") > a ? String(x.at || "") : a), "");
                const go = () => { vibrate("light"); setEmp(p.id); setTrack(null); toTop(); };
                return (
                  <div key={p.id} data-lc-person={p.id} role="button" tabIndex={0} onClick={go} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); go(); } }}
                    style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 0", borderTop: i ? "1px solid " + c.line : 0, cursor: "pointer" }}>
                    <span aria-hidden="true" data-lens="person" style={{ width: 38, height: 38, borderRadius: "50%", flexShrink: 0, display: "inline-grid", placeItems: "center",
                      background: "linear-gradient(135deg,#C8A96E,#7A5D2A)", color: "#fff", fontFamily: "Georgia, serif", fontWeight: "bold", fontSize: 13 }}>{ini(n)}</span>
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ display: "block", fontFamily: "Georgia, serif", fontSize: 15, color: text, fontWeight: "bold" }}>{n}</span>
                      <span style={{ display: "block", fontSize: 12.5, color: sub, lineHeight: 1.4 }}>
                        {[titleOf(org, { id: p.id, position: p.position, job_title: p.title }),
                          ch.length ? "зачтено " + ok + " " + plural(ok, "модуль", "модуля", "модулей") + " из " + ch.length + ", последняя " + lcDate(lastAt) : "ещё не проверяли"].filter(Boolean).join(" · ")}
                      </span>
                    </span>
                    <span aria-hidden="true" style={{ color: sub, fontSize: 18 }}>›</span>
                  </div>);
              })}
            </div>
          </>) : null}
        </>) : null}

        {view === "person" ? (<>
          {per.phase === "load" ? note("Загружаю…", "load") : null}
          {per.phase === "error" ? note(lcErr(per.code, admin), per.code) : null}
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
            {!per.can ? <div style={{ fontSize: 12.5, color: sub, margin: "0 2px 10px" }}>Проверять этого сотрудника может руководитель ступенью выше. Здесь только итоги.</div> : null}
            <div style={{ ...card, padding: "2px 14px" }} data-lens-card="">
              {mods.map((m, i) => {
                const a = moduleApp(m, lessons, quiz), l = last[m.id], can = per.can && (LIVE_CHECK[m.id] || []).length > 0;
                const go = can ? () => openModule(m) : null;
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
                    </span>
                    {l ? <span data-lc-chip={l.p ? "pass" : "fail"} style={{ flex: "0 0 auto", fontSize: 13, fontWeight: "bold", fontFamily: "Georgia, serif", color: l.p ? c.ok : c.warn }}>{(l.p ? "зачтено " : "") + l.s + "%"}</span>
                      : go ? <span style={{ flex: "0 0 auto", fontSize: 12.5, color: c.gold }}>Проверить</span> : null}
                    {go ? <span aria-hidden="true" style={{ color: sub, fontSize: 18 }}>›</span> : null}
                  </div>);
              })}
            </div>
          </>) : null}
        </>) : null}

        {view === "module" ? (<>
          <div style={{ fontSize: 13, color: sub, margin: "0 2px 4px" }}>{trackLabel(track)} · {mod.title}</div>
          <div style={{ fontSize: 13.5, color: text, lineHeight: 1.55, margin: "0 2px 12px" }}>
            Задай вопрос вслух и дай человеку ответить своими словами. Ниже, что должно прозвучать: не дословно, а по смыслу.
          </div>
          {qs.map((q, i) => {
            const lt = lessonTitle(mods, q.l);
            return (
              <div key={i} data-lc-q={i} style={card} data-lens-card="">
                <div style={{ fontSize: 12, color: sub, marginBottom: 4 }}>Вопрос {i + 1} из {qs.length}{lt ? " · урок «" + lt + "»" : ""}</div>
                <div style={{ fontFamily: "Georgia, serif", fontSize: 16, color: text, lineHeight: 1.45, fontWeight: "bold" }}>{q.q}</div>
                <div style={{ fontSize: 12.5, color: c.gold, margin: "10px 0 4px" }}>Что должно прозвучать</div>
                <ul style={{ margin: 0, paddingLeft: 18, color: text, fontSize: 13.5, lineHeight: 1.5 }}>
                  {q.a.map((x, k) => <li key={k} data-lc-a="">{x}</li>)}
                </ul>
                <div role="group" aria-label={"Как ответил на вопрос " + (i + 1)} style={{ display: "flex", gap: 6, marginTop: 12 }}>
                  {LC_MARKS.map((mk) => {
                    const on = marks[i] === mk.v;
                    const col = mk.v === 2 ? c.ok : mk.v === 1 ? c.warn : c.bad;
                    return <button key={mk.v} type="button" data-lc-mark={i + ":" + mk.v} aria-pressed={on} onClick={() => mark(i, mk.v)}
                      style={{ flex: 1, minWidth: 0, padding: "9px 4px", borderRadius: 12, cursor: "pointer", fontFamily: "Georgia, serif", fontSize: 13,
                        border: "1px solid " + (on ? col : c.line), background: on ? c.on : "transparent", color: on ? col : text, fontWeight: on ? "bold" : "normal" }}>{mk.label}</button>;
                  })}
                </div>
              </div>);
          })}
          <textarea data-lc-note="" data-lens-field="" value={memo} maxLength={500} placeholder="Заметка, по желанию: что запомнилось, что подтянуть"
            onChange={(e) => setMemo(e.target.value)} rows={2}
            style={{ width: "100%", boxSizing: "border-box", padding: "10px 12px", borderRadius: 12, border: "1px solid " + c.line, background: c.chip, color: text,
              fontFamily: "Georgia, serif", fontSize: 14, lineHeight: 1.45, resize: "vertical" }} />
          {msg ? <div role="status" data-lc-err="" style={{ fontSize: 13, color: c.bad, marginTop: 8 }}>{msg}</div> : null}
          <button type="button" data-lc-save="" data-lens-btn="main" disabled={busy} onClick={save} style={main(busy || marks.filter((v) => v != null).length !== qs.length)}>
            {busy ? "Сохраняю…" : preview ? "Сохранить · " + preview.score + "%" : "Сохранить проверку"}</button>
          <div style={{ fontSize: 12, color: sub, textAlign: "center", marginTop: 8 }}>Зачтено от {LC_PASS}%: ответил за два балла, частично за один.</div>
        </>) : null}

        {view === "result" ? (<>
          <div data-lc-result={res.passed ? "pass" : "fail"} style={{ ...card, textAlign: "center", padding: "18px 14px" }} data-lens-card="">
            <div style={{ fontFamily: "Georgia, serif", fontSize: 34, fontWeight: "bold", color: res.passed ? c.ok : c.warn }}>{res.score}%</div>
            <div style={{ fontFamily: "Georgia, serif", fontSize: 17, color: text, marginTop: 4 }}>{res.passed ? "Зачтено" : "Не зачтено"}</div>
            <div style={{ fontSize: 13, color: sub, marginTop: 6, lineHeight: 1.5 }}>{pname} · {mod.title}</div>
          </div>
          {res.repeat.length ? (<>
            {h("Что повторить", res.repeat.length, "repeat")}
            <div style={{ ...card, padding: "6px 14px" }} data-lc-repeat="" data-lens-card="">
              {res.repeat.map((id, i) => <div key={id} style={{ padding: "8px 0", borderTop: i ? "1px solid " + c.line : 0, fontSize: 14, color: text }}>{lessonTitle(mods, id) || id}</div>)}
            </div>
            <div style={{ fontSize: 12.5, color: sub, margin: "-4px 2px 12px", lineHeight: 1.45 }}>Скажи об этом сотруднику: уроки открыты у него в приложении. Модуль можно проверить ещё раз позже.</div>
          </>) : null}
          {msg ? note(msg, "info") : null}
          <button type="button" data-lc-next="" data-lens-btn="main" onClick={nextMod} style={main(false)}>Следующий модуль</button>
          <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
            <button type="button" data-lc-tomods="" data-lens-btn="soft" onClick={() => { setRes(null); setMod(null); toTop(); }} style={{ ...ghost, flex: 1, padding: "10px 12px" }}>К модулям</button>
            <button type="button" data-lc-undo="" data-lens-btn="soft" disabled={busy} onClick={undo} style={{ ...ghost, flex: 1, padding: "10px 12px", color: sub }}>Убрать проверку</button>
          </div>
        </>) : null}
      </div>
    </div>
  );
}
