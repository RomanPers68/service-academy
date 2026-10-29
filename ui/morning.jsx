// ui/morning.jsx — v106 (Доп. 419): экран «Утро руководителя» («Смена» → «Утро руководителя» или кнопка «Открыть утро»
// под сообщением бота). Та же сводка, что приходит в Telegram (сервер — этап 40, morning_brief; разбор и слова —
// lib/morning.js), только каждая строка ведёт туда, где с ней работают: дыры и заявки в график и в чат, брифинг в
// редактор брифинга, стоп-лист в меню, «спасибо» в отзывы гостей, занятия в отчёты. Плюс вчерашние чек-листы
// (checklist_get за вчера), «Напомнить» тем, кто давно не занимался (morning_nudge), и настройки: присылать ли сводку
// в Telegram и во сколько (morning_set), «Прислать сейчас» (morning_send_now).
import React from "react";
import { rpc, saToken, rpcMissing } from "../api/supabase";
import { vibrate } from "../lib/utils";
import { lateMinText } from "../lib/late";
import { GOLD, labelStyle } from "./tokens";
import { DEFAULT_CHECKLISTS, CL_KINDS } from "./screens-admin";
import { morningModel, dLong, dShort, hh, holesText, weekHoleDays, posAcc, thanksPeople, daysText, plural, upFirst, isoAdd, MORNING_HOURS, hourLabel } from "../lib/morning";

const REPO = "https://github.com/RomanPers68/service-academy/blob/main/supabase/";
const P = (a11y) => (a11y
  ? { ok: "#2C6B48", warn: "#8B5A12", line: "rgba(139,106,48,0.22)", chip: "rgba(139,106,48,0.10)", gold: "#7A5D2A", soft: "rgba(139,106,48,0.16)" }
  : { ok: "#8AD8AF", warn: "#E4B36A", line: "rgba(214,178,102,0.18)", chip: "rgba(214,178,102,0.10)", gold: GOLD, soft: "rgba(200,169,110,0.22)" });
// кружок-отметка слева от строки: всё хорошо — галочка, нужно внимание — восклицательный знак, просто сведения — точка
const Mark = ({ kind, c }) => {
  const col = kind === "ok" ? c.ok : kind === "warn" ? c.warn : c.gold;
  return (
    <span aria-hidden="true" style={{ flex: "0 0 auto", width: 22, height: 22, borderRadius: "50%", display: "inline-grid", placeItems: "center", marginTop: 1, border: "1.5px solid " + col, color: col }}>
      {kind === "info" ? <span style={{ width: 6, height: 6, borderRadius: "50%", background: col }} />
        : <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">{kind === "ok" ? <path d="M5 12.5l4.2 4.2L19 7" /> : <path d="M12 6v8M12 18.5v.5" />}</svg>}
    </span>);
};
const openOut = (url) => {
  try { const tg = window.Telegram && window.Telegram.WebApp; if (tg && tg.initData && typeof tg.openLink === "function") { tg.openLink(url); return; } } catch (e) { /* */ }
  try { window.open(url, "_blank", "noopener"); } catch (e) { /* */ }
};
const errText = (r) => (r && r.error === "auth" ? "Сессия устарела. Войди заново." : r && r.error === "forbidden" ? "Этот экран только у руководителей." : "Нет связи. Попробуй ещё раз.");

/** onGo(куда, что): schedule | brief | menu | thanks | report | checklist | chat ({ chat, msg }); onRemind — подключить Telegram. */
export function MorningScreen({ T, a11y, profile, onBack, onGo = () => {}, onRemind = null }) {
  const c = P(a11y);
  const [st, setSt] = React.useState({ phase: "load" });
  const [cl, setCl] = React.useState(null);           // вчерашние чек-листы: { kind: { log, total } } или null
  const [prefs, setPrefs] = React.useState(null);
  const [busy, setBusy] = React.useState("");
  const [note, setNote] = React.useState("");         // ответ на «Прислать сейчас» и настройки
  const [nudged, setNudged] = React.useState({});     // кому уже напомнили: id → "sent" | текст ошибки
  const load = React.useCallback(() => {
    setSt((x) => (x.phase === "ready" ? { ...x, again: true } : { phase: "load" }));
    rpc("morning_brief", { p_token: saToken() }).then((r) => {
      if (rpcMissing(r)) { setSt({ phase: "missing" }); return; }
      if (!r || r.ok === false) { setSt({ phase: "error", text: errText(r) }); return; }
      const b = morningModel(r);
      setSt({ phase: "ready", b });
      setPrefs(r.prefs && typeof r.prefs === "object" ? r.prefs : null);
      if (b.day) {
        rpc("checklist_get", { p_token: saToken(), p_day: isoAdd(b.day, -1) }).then((d) => {
          if (!d || !d.ok) { setCl(null); return; }
          const out = {};
          CL_KINDS.forEach(([k]) => {
            const t = d.templates && Array.isArray(d.templates[k]) && d.templates[k].length ? d.templates[k] : DEFAULT_CHECKLISTS[k] || [];
            out[k] = { log: (d.today && d.today[k]) || {}, total: t.length, ids: t.map((x) => x.id) };
          });
          setCl(out);
        }).catch(() => setCl(null));
      }
    }).catch(() => setSt({ phase: "error", text: "Нет связи. Попробуй ещё раз." }));
  }, []);
  React.useEffect(() => { load(); }, [load]);

  const savePrefs = (on, hour) => {
    if (busy) return;
    const was = prefs;
    vibrate("light"); setBusy("prefs"); setNote("");
    setPrefs((p) => ({ ...(p || {}), ...(on == null ? {} : { on }), ...(hour == null ? {} : { hour }) }));
    rpc("morning_set", { p_token: saToken(), p_on: on, p_hour: hour }).then((r) => {
      setBusy("");
      if (r && r.ok && r.prefs) setPrefs(r.prefs); else { setPrefs(was); setNote("Не сохранилось. Попробуй ещё раз."); }
    }).catch(() => { setBusy(""); setPrefs(was); setNote("Нет связи. Попробуй ещё раз."); });
  };
  const sendNow = () => {
    if (busy) return;
    vibrate("light"); setBusy("send"); setNote("");
    rpc("morning_send_now", { p_token: saToken() }).then((r) => {
      setBusy("");
      setNote(r && r.ok ? "Отправил в Telegram: открой чат с ботом." : r && r.error === "too_fast" ? "Только что отправлял. Через минуту можно ещё раз."
        : r && r.error === "not_linked" ? "Telegram не подключён." : r && r.error === "no_bot" ? "Бот на сервере не подключён." : "Не получилось. Попробуй ещё раз.");
    }).catch(() => { setBusy(""); setNote("Нет связи. Попробуй ещё раз."); });
  };
  const nudge = (id) => {
    if (nudged[id]) return;
    vibrate("light"); setNudged((x) => ({ ...x, [id]: "busy" }));
    rpc("morning_nudge", { p_token: saToken(), p_emp: id }).then((r) => {
      setNudged((x) => ({ ...x, [id]: r && r.ok ? "sent" : r && r.error === "already" ? "already" : r && r.error === "no_tg" ? "no_tg" : "fail" }));
    }).catch(() => setNudged((x) => ({ ...x, [id]: "fail" })));
  };

  const card = { ...T.modCard, display: "block", padding: "4px 14px 10px", marginBottom: 12, cursor: "default" };
  const sub = T.modSub.color, text = T.modTitle.color;
  const h = (t, n = null, key = "") => (
    <div data-mo-h={key} style={{ ...labelStyle(13.5), color: c.gold, margin: "6px 2px 8px", display: "flex", gap: 8, alignItems: "baseline" }}>
      <span style={{ flex: 1 }}>{t}</span>{n != null ? <span style={{ color: sub, fontStyle: "normal" }}>{n}</span> : null}
    </div>);
  const ghost = { flex: "0 0 auto", alignSelf: "center", padding: "6px 12px", borderRadius: 999, border: "1px solid " + c.line, background: c.chip, color: text,
    fontSize: 12.5, fontFamily: "Georgia, serif", cursor: "pointer", whiteSpace: "nowrap" };
  const main = { marginTop: 8, width: "100%", padding: "11px", borderRadius: 999, border: 0, cursor: "pointer", fontFamily: "Georgia, serif", fontSize: 14.5,
    fontWeight: "bold", color: "#1A1008", background: "linear-gradient(180deg,#E4C88C,#C8A96E)" };
  // строка: отметка, текст, подпись, справа — кнопка; вся строка — переход (go), если он есть
  const row = (key, kind, title, opt = {}) => {
    const { sub: s = null, go = null, act = null, first = false, extra = null } = opt;
    const on = go ? () => { vibrate("light"); go(); } : null;
    return (
      <div key={key} data-mo-row={key} data-mo-kind={kind} role={on ? "button" : undefined} tabIndex={on ? 0 : undefined} onClick={on || undefined}
        onKeyDown={on ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); on(); } } : undefined}
        style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "9px 0", borderTop: first ? 0 : "1px solid " + c.line, cursor: on ? "pointer" : "default" }}>
        <Mark kind={kind} c={c} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: "Georgia, serif", fontSize: 14.5, color: text, lineHeight: 1.4 }}>{title}</div>
          {s ? <div style={{ fontSize: 12.5, color: sub, lineHeight: 1.45, marginTop: 2 }}>{s}</div> : null}
          {extra}
        </div>
        {act}
        {on && !act ? <span aria-hidden="true" style={{ flex: "0 0 auto", alignSelf: "center", color: sub, fontSize: 18, lineHeight: 1 }}>›</span> : null}
      </div>);
  };

  const b = st.b;
  const first = String((profile && profile.name) || "").trim().split(/\s+/)[0];
  return (
    <div style={T.screen} className="sa-screen" data-morning={st.phase}>
      <div style={T.lessHead}>
        <button className="sa-hit" style={T.backBtn2} data-lens="back" aria-label="Вернуться" onClick={onBack}>‹</button>
        <div style={T.lessHeadTitle}>Утро</div>
        {st.phase === "ready" ? <button type="button" style={{ ...ghost, alignSelf: "auto" }} data-mo-again="" onClick={() => { vibrate("light"); load(); }}>{st.again ? "Обновляю…" : "Обновить"}</button> : null}
      </div>
      <div style={{ flex: 1, padding: "14px 16px 28px" }}>
        {st.phase === "load" ? <div style={{ ...T.para, textAlign: "center", padding: "30px 0" }}>Собираю утро…</div> : null}
        {st.phase === "missing" ? (
          <div style={card} data-mo-missing="">
            {row("stage", "warn", "Нужен этап 40 на сервере", { first: true, sub: profile && profile.is_admin
              ? "Supabase → SQL Editor → New query → вставь supabase-stage40-morning.sql → Run. После этого здесь будет сводка, а бот начнёт присылать её по утрам."
              : "Сводка появится, когда владелец обновит сервер (этап 40).",
              act: profile && profile.is_admin ? <button type="button" style={ghost} onClick={() => openOut(REPO + "supabase-stage40-morning.sql")}>Файл</button> : null })}
          </div>) : null}
        {st.phase === "error" ? <div style={{ ...T.para, textAlign: "center", padding: "30px 0" }}>{st.text}
          <div><button type="button" style={{ ...ghost, marginTop: 10 }} onClick={() => { vibrate("light"); load(); }}>Ещё раз</button></div></div> : null}
        {st.phase === "ready" && b ? (<>
          <div style={{ margin: "0 2px 14px" }} data-mo-hello="">
            <div style={{ fontFamily: "'Piazzolla', Georgia, serif", fontWeight: 700, fontSize: 21, color: text, lineHeight: 1.25 }}>Доброе утро{first ? ", " + first : ""}</div>
            <div style={{ fontSize: 13, color: sub, marginTop: 3 }}>{upFirst(dLong(b.day))}{b.rest ? " · " + b.rest : ""}</div>
          </div>

          {h("Сегодня", b.sched && b.count ? "в смене " + b.count : null, "today")}
          <div style={card} data-mo-sec="today">
            {!b.sched ? row("nosched", "info", "Графика пока нет", { first: true, sub: "Составь его в «Графике», и здесь будет видно, кто сегодня в смене.", go: () => onGo("schedule") }) : null}
            {b.sched && !b.shifts.length ? row("noshift", "info", "По графику сегодня смен нет", { first: true, go: () => onGo("schedule") }) : null}
            {b.shifts.map((g, i) => row("sh-" + g.k, "info", g.people.map((p) => p.n).join(", "), { first: i === 0, sub: g.name + " · " + hh(g.from) + "–" + hh(g.to), go: () => onGo("schedule") }))}
            {b.late.map((x) => row("late-" + (x.id || x.n), "warn", x.n + " опаздывает на " + lateMinText(x.min), { sub: x.eta ? "Будет в " + x.eta : null, go: () => onGo("schedule") }))}
            {holesText(b, b.day) ? row("hole-today", "warn", "Не хватает: " + holesText(b, b.day), { sub: "Найди замену в «Графике» или позови в чате", go: () => onGo("schedule") }) : null}
            {b.brief.done ? row("brief", "ok", "Брифинг отправлен" + (b.brief.at ? " в " + b.brief.at : ""), { go: () => onGo("brief") })
              : row("brief", "warn", "Брифинг на сегодня ещё не собран", { sub: "Стоп-лист, акценты дня, брони: соберёшь за пару минут, команда получит в Telegram.",
                extra: <button type="button" style={main} data-mo-brief="" onClick={(e) => { e.stopPropagation(); vibrate("light"); onGo("brief"); }}>Собрать брифинг</button> })}
          </div>

          {b.sched || b.open.length ? (<>
            {h("На неделе", null, "week")}
            <div style={card} data-mo-sec="week">
              {weekHoleDays(b).map((d, i) => row("hole-" + d, "warn", dShort(d) + ": не хватает " + holesText(b, d), { first: i === 0, go: () => onGo("schedule") }))}
              {b.open.map((o, i) => row("open-" + (o.id || i), "warn",
                o.mode === "give" ? o.who + " отдаёт смену" : o.mode === "swap" ? o.who + " ищет обмен" : "Ищем в смену " + posAcc(o.pos, o.n),
                { first: i === 0 && !weekHoleDays(b).length, sub: upFirst(dLong(o.day)) + (o.mode === "need" ? "" : ". Пока никто не взял"), go: () => onGo("chat", { chat: o.chat, msg: o.id }) }))}
              {!weekHoleDays(b).length && !b.open.length ? row("week-ok", "ok", "Людей хватает, открытых заявок нет", { first: true }) : null}
            </div>
          </>) : null}

          {h("Стоп-лист", b.stop.n || null, "stop")}
          <div style={card} data-mo-sec="stop">
            {b.stop.n ? row("stop", "info", b.stop.names.join(", ") + (b.stop.n > b.stop.names.length ? " и ещё " + (b.stop.n - b.stop.names.length) : ""), { first: true, go: () => onGo("menu") })
              : row("stop", "ok", "Стоп-лист пуст", { first: true })}
          </div>

          {(() => {
            const rows = [];
            if (b.thanks) rows.push(row("thanks", "info", b.thanks.n === 1 ? "Гость сказал спасибо: " + thanksPeople(b.thanks) : "Гости сказали спасибо " + b.thanks.n + " " + plural(b.thanks.n, "раз", "раза", "раз") + ": " + thanksPeople(b.thanks),
              { first: !rows.length, go: () => onGo("thanks"), extra: b.thanks.quote ? <div style={{ fontSize: 13, color: sub, fontStyle: "italic", lineHeight: 1.45, marginTop: 4 }}>«{b.thanks.quote}»{b.thanks.by ? " · " + b.thanks.by : ""}</div> : null }));
            if (b.ybrief) rows.push(row("yreads", "info", "Брифинг прочитали " + b.ybrief.reads + (b.ybrief.of ? " из " + b.ybrief.of + " в смене" : ""), { first: !rows.length }));
            if (b.learn) rows.push(row("learn", b.learn.done ? "info" : "warn", "Занимались " + b.learn.done + " из " + b.learn.of + ", кто был в смене", { first: !rows.length, go: () => onGo("report") }));
            if (cl) CL_KINDS.forEach(([k, t]) => {
              const x = cl[k], ch = (x.log.checked || []).filter((id) => x.ids.includes(id)).length;
              const at = x.log.done_at ? new Date(x.log.done_at) : null;
              const done = !!(at && !isNaN(at));
              rows.push(row("cl-" + k, done ? "ok" : "warn", t + ": " + (done ? String(at.getHours()).padStart(2, "0") + ":" + String(at.getMinutes()).padStart(2, "0") + (x.log.by_name ? " · " + x.log.by_name : "")
                : ch ? "отмечено " + ch + " из " + x.total : "не отмечено"), { first: !rows.length, go: () => onGo("checklist") }));
            });
            return rows.length ? (<>{h("Вчера", null, "yday")}<div style={card} data-mo-sec="yday">{rows}</div></>) : null;
          })()}

          {b.idle.list.length ? (<>
            {h("Давно не занимались", null, "idle")}
            <div style={card} data-mo-sec="idle">
              {b.idle.list.map((x, i) => {
                const s = nudged[x.id];
                const act = !x.tg ? <span style={{ flex: "0 0 auto", alignSelf: "center", fontSize: 12, color: sub, fontStyle: "italic" }}>нет Telegram</span>
                  : <button type="button" style={{ ...ghost, opacity: s && s !== "fail" ? 0.6 : 1 }} data-mo-nudge={x.id} disabled={!!s && s !== "fail"}
                      onClick={(e) => { e.stopPropagation(); nudge(x.id); }}>{s === "sent" ? "Напомнили" : s === "already" ? "Уже сегодня" : s === "busy" ? "Минуту…" : s === "fail" ? "Ещё раз" : "Напомнить"}</button>;
                return row("idle-" + x.id, "warn", x.n, { first: i === 0, sub: x.days == null ? "Ещё ни разу не занимались" : daysText(x.days) + " без занятий", act });
              })}
              {b.idle.more ? row("idle-more", "info", "И ещё " + b.idle.more, { go: () => onGo("report") }) : null}
            </div>
          </>) : null}

          {h("Каждое утро в Telegram", null, "tg")}
          <div style={card} data-mo-sec="tg">
            {prefs ? (<>
              <button type="button" role="switch" aria-checked={!!prefs.on} data-mo-on={prefs.on ? "1" : "0"} disabled={busy === "prefs"} onClick={() => savePrefs(!prefs.on, null)}
                style={{ display: "flex", alignItems: "center", gap: 12, width: "100%", textAlign: "left", padding: "10px 0", border: 0, background: "none", cursor: "pointer", color: text }}>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: "block", fontFamily: "Georgia, serif", fontSize: 14.5 }}>Присылать эту сводку</span>
                  <span style={{ display: "block", fontSize: 12.5, lineHeight: 1.4, color: sub }}>{prefs.on ? "Каждое утро в " + hourLabel(prefs.hour) + " по часам заведения" : "Выключено: сводка только здесь"}</span>
                </span>
                <span aria-hidden="true" style={{ flex: "0 0 auto", position: "relative", width: 40, height: 24, borderRadius: 12, border: "1px solid " + (prefs.on ? c.gold : c.line), background: prefs.on ? c.soft : "transparent" }}>
                  <span style={{ position: "absolute", top: 2, left: 2, width: 18, height: 18, borderRadius: "50%", background: prefs.on ? (a11y ? "#8B6A30" : "#E4C88C") : sub, transform: prefs.on ? "translateX(16px)" : "none", transition: "transform .2s" }} />
                </span>
              </button>
              {prefs.on ? (
                <div role="group" aria-label="Во сколько присылать" data-mo-hours={prefs.hour} style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 6, padding: "4px 0 10px" }}>
                  {MORNING_HOURS.map((x) => { const sel = prefs.hour === x;
                    return <button key={x} type="button" aria-pressed={sel} data-mo-hour={x} disabled={busy === "prefs"} onClick={() => { if (!sel) savePrefs(null, x); }}
                      style={{ padding: "5px 10px", borderRadius: 999, border: "1px solid " + (sel ? c.gold : c.line), background: sel ? c.soft : "transparent", color: sel ? text : sub,
                        fontFamily: "Georgia, serif", fontSize: 12.5, cursor: "pointer" }}>{hourLabel(x)}</button>; })}
                </div>) : null}
              {!prefs.bot ? row("nobot", "warn", "Бот на сервере не подключён", { sub: "Пока сводка только здесь. Подключает владелец: «Команда» → «Сервер»." })
                : !prefs.linked ? row("nolink", "warn", "Telegram не подключён", { sub: "Включи «Напоминания в Telegram», и сводка начнёт приходить каждое утро.",
                    act: onRemind ? <button type="button" style={ghost} data-mo-link="" onClick={(e) => { e.stopPropagation(); vibrate("light"); onRemind(); }}>Подключить</button> : null })
                : <button type="button" style={{ ...ghost, display: "block", width: "100%", padding: "10px 12px", marginTop: 2 }} data-mo-send="" disabled={busy === "send"} onClick={sendNow}>{busy === "send" ? "Отправляю…" : "Прислать сейчас"}</button>}
            </>) : row("prefs", "info", "Настройки появятся вместе с этапом 40 на сервере", { first: true })}
            {note ? <div role="status" data-mo-note="" style={{ fontSize: 12.5, color: text, lineHeight: 1.5, marginTop: 8 }}>{note}</div> : null}
          </div>
        </>) : null}
      </div>
    </div>
  );
}
