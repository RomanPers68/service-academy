// ui/gain.jsx — v109 (Доп. 422): «Что дало обучение» («Команда» → «Управление» или кнопка «Открыть итог» под сообщением бота
// 1-го числа). Итог месяца заведения: чему команда училась и что за это время изменилось в зале, по сравнению с прошлым
// месяцем (сервер — этап 43, gain_month; разбор и слова — lib/gain.js). Месяц — текущий («пока», с теми же днями прошлого) или
// прошлый. Темы — уроки, по которым сдавали тесты (названия — из уроков приложения и своих уроков заведения). Кто вырос
// больше всех и кто не занимался ни разу («Напомнить» — morning_nudge, этап 40). «Прислать в Telegram» — gain_send_now.
// v111 (Доп. 424): в виде «Линза» карточки, кружки с инициалами, кнопки и выбор месяца — линзой (метки data-lens-*, правила —
// ui/home-look.jsx): выбранный месяц — стеклянная плашка с кольцом.
import React from "react";
import { rpc, saToken, rpcMissing } from "../api/supabase";
import { vibrate } from "../lib/utils";
import { GOLD, labelStyle } from "./tokens";
import { MODULES_INDEX } from "../data/modules";
import { cmsTitleMap } from "../lib/custom-modules";
import { plural } from "../lib/morning";
import { gainModel, learnRows, hallRows, grewWhy, topicTitle, topicLine, compareLabel, monthNom, monthPrep, monthOf, deltaText, gainHeadline } from "../lib/gain";

const REPO = "https://github.com/RomanPers68/service-academy/blob/main/supabase/";
const P = (a11y) => (a11y
  ? { ok: "#2C6B48", warn: "#8B5A12", line: "rgba(139,106,48,0.22)", chip: "rgba(139,106,48,0.10)", gold: "#7A5D2A", soft: "rgba(139,106,48,0.16)" }
  : { ok: "#8AD8AF", warn: "#E4B36A", line: "rgba(214,178,102,0.18)", chip: "rgba(214,178,102,0.10)", gold: GOLD, soft: "rgba(200,169,110,0.22)" });
// названия уроков приложения: номер урока → название (тесты в итоге — по урокам)
const BASE_TITLES = (() => {
  const m = {};
  try { Object.values(MODULES_INDEX).forEach((mods) => (mods || []).forEach((md) => (md.lessons || []).forEach((l) => { if (l && l.id) m[l.id] = l.title; }))); } catch (e) { /* */ }
  return m;
})();
const openOut = (url) => {
  try { const tg = window.Telegram && window.Telegram.WebApp; if (tg && tg.initData && typeof tg.openLink === "function") { tg.openLink(url); return; } } catch (e) { /* */ }
  try { window.open(url, "_blank", "noopener"); } catch (e) { /* */ }
};
const errText = (r) => (r && r.error === "auth" ? "Сессия устарела. Войди заново." : r && r.error === "forbidden" ? "Этот экран только у руководителей."
  : r && r.error === "no_rest" ? "У тебя не указано заведение." : "Нет связи. Попробуй ещё раз.");
// v110 (Доп. 423): кружок с инициалами у «Больше всех выросли» и «Не занимались» (как в «Новичках»)
const ini = (name) => String(name || "").trim().split(/\s+/).slice(0, 2).map((w) => w[0] || "").join("").toUpperCase();
const Ava = ({ name, size = 32 }) => (
  <span aria-hidden="true" data-lens="person" style={{ width: size, height: size, borderRadius: "50%", flexShrink: 0, display: "inline-grid", placeItems: "center",
    background: "linear-gradient(135deg,#C8A96E,#7A5D2A)", color: "#fff", fontFamily: "Georgia, serif", fontWeight: "bold", fontSize: 12 }}>{ini(name)}</span>);

/** month — открыть этот месяц («ГГГГ-ММ», из кнопки бота); onGo("report") — «Отчёты по сотрудникам»; onRemind — подключить Telegram. */
export function GainScreen({ T, a11y, profile, month: month0 = "", onBack, onGo = () => {}, onRemind = null }) {
  const c = P(a11y);
  const [month, setMonth] = React.useState(month0 || "");
  const [st, setSt] = React.useState({ phase: "load" });
  const [titles, setTitles] = React.useState(BASE_TITLES);
  const [busy, setBusy] = React.useState(false);
  const [note, setNote] = React.useState("");
  const [nudged, setNudged] = React.useState({});      // кому уже напомнили: id → "sent" | "already" | "no_tg" | "fail"
  const load = React.useCallback((m) => {
    setSt((x) => (x.phase === "ready" ? { ...x, again: true } : { phase: "load" }));
    rpc("gain_month", { p_token: saToken(), p_month: m || null }).then((r) => {
      if (rpcMissing(r)) { setSt({ phase: "missing" }); return; }
      if (!r || r.ok === false) { setSt({ phase: "error", text: errText(r) }); return; }
      setSt({ phase: "ready", m: gainModel(r), tg: r.tg && typeof r.tg === "object" ? r.tg : null });
    }).catch(() => setSt({ phase: "error", text: "Нет связи. Попробуй ещё раз." }));
  }, []);
  React.useEffect(() => { load(month); }, [load, month]);
  // свои уроки заведения: их названия, а не служебные номера
  React.useEffect(() => {
    let live = true;
    rpc("cms_list_lessons", { p_token: saToken() }).then((ls) => { if (live && Array.isArray(ls)) setTitles({ ...BASE_TITLES, ...cmsTitleMap(ls) }); }).catch(() => {});
    return () => { live = false; };
  }, []);

  const pick = (x) => { if (x === (st.m && st.m.month)) return; vibrate("light"); setNote(""); setNudged({}); setMonth(x); };
  const send = () => {
    if (busy || !st.m) return;
    vibrate("light"); setBusy(true); setNote("");
    rpc("gain_send_now", { p_token: saToken(), p_month: st.m.month }).then((r) => {
      setBusy(false);
      setNote(r && r.ok ? "Отправил в Telegram: открой чат с ботом." : r && r.error === "too_fast" ? "Только что отправлял. Через минуту можно ещё раз."
        : r && r.error === "not_linked" ? "Telegram не подключён." : r && r.error === "no_bot" ? "Бот на сервере не подключён." : "Не получилось. Попробуй ещё раз.");
    }).catch(() => { setBusy(false); setNote("Нет связи. Попробуй ещё раз."); });
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
    <div data-gain-h={key} style={{ ...labelStyle(13.5), color: c.gold, margin: "6px 2px 8px", display: "flex", gap: 8, alignItems: "baseline" }}>
      <span style={{ flex: 1 }}>{t}</span>{n != null ? <span style={{ color: sub, fontStyle: "normal" }}>{n}</span> : null}
    </div>);
  const ghost = { flex: "0 0 auto", alignSelf: "center", padding: "6px 12px", borderRadius: 999, border: "1px solid " + c.line, background: c.chip, color: text,
    fontSize: 12.5, fontFamily: "Georgia, serif", cursor: "pointer", whiteSpace: "nowrap" };
  // v110: разница цифрой («+44» зелёным, хуже — жёлтым), «было» рядом мельче (было: «было 30» и стрелка)
  const dcol = (x) => (x.good == null ? sub : x.good ? c.ok : c.warn);
  const delta = (x, attrs = {}) => { const d = deltaText(x); return d ? <span {...attrs} style={{ color: dcol(x), fontWeight: "bold" }}>{d}</span> : null; };
  const was = (x) => (x.was == null ? null : <span style={{ fontSize: 12.5, color: sub }}>{"было " + x.wasText}</span>);
  // строка: слева что и «было», справа значение; act — кнопка справа вместо значения
  const row = (key, title, opt = {}) => {
    const { sub: s = null, value = null, act = null, first = false, go = null, attrs = {}, ava = "", vsub = null } = opt;
    const on = go ? () => { vibrate("light"); go(); } : null;
    return (
      <div key={key} data-gain-row={key} {...attrs} role={on ? "button" : undefined} tabIndex={on ? 0 : undefined} onClick={on || undefined}
        onKeyDown={on ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); on(); } } : undefined}
        style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 0", borderTop: first ? 0 : "1px solid " + c.line, cursor: on ? "pointer" : "default" }}>
        {ava ? <Ava name={ava} /> : null}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: "Georgia, serif", fontSize: 14.5, color: text, lineHeight: 1.4 }}>{title}</div>
          {s ? <div style={{ fontSize: 12.5, color: sub, lineHeight: 1.45, marginTop: 2 }}>{s}</div> : null}
        </div>
        {value != null ? <div style={{ flex: "0 0 auto", textAlign: "right" }}>
          <div style={{ fontFamily: "Georgia, serif", fontSize: 20, color: text, lineHeight: 1.2 }}>{value}</div>
          {vsub ? <div style={{ fontSize: 12.5, lineHeight: 1.3 }}>{vsub}</div> : null}
        </div> : null}
        {act}
        {on && !act ? <span aria-hidden="true" style={{ flex: "0 0 auto", color: sub, fontSize: 18, lineHeight: 1 }}>›</span> : null}
      </div>);
  };

  const m = st.m;
  const topics = m ? m.topics.map((t) => ({ ...t, title: topicTitle(t.id, titles) })).filter((t) => t.title) : [];
  const lr = m ? learnRows(m) : [], hr = m ? hallRows(m) : [];
  const hd = m ? gainHeadline(m) : { learn: "", hall: "", tone: "" };
  const quiet = m && !m.learn.people && !m.learn.days;
  return (
    <div style={T.screen} className="sa-screen" data-gain={st.phase}>
      <div style={T.lessHead}>
        <button className="sa-hit" style={T.backBtn2} data-lens="back" aria-label="Вернуться" onClick={onBack}>‹</button>
        <div style={T.lessHeadTitle}>Что дало обучение</div>
      </div>
      <div style={{ flex: 1, padding: "14px 16px 28px" }}>
        {st.phase === "load" ? <div style={{ ...T.para, textAlign: "center", padding: "30px 0" }}>Собираю итог месяца…</div> : null}
        {st.phase === "missing" ? (
          <div style={card} data-lens-card="" data-gain-missing="">
            {row("stage", "Нужен этап 43 на сервере", { first: true, sub: profile && profile.is_admin
              ? "Supabase → SQL Editor → New query → вставь supabase-stage43-gain.sql → Run. После этого здесь будет итог месяца, а 1-го числа его пришлёт бот."
              : "Итог появится, когда владелец обновит сервер (этап 43).",
              act: profile && profile.is_admin ? <button type="button" style={ghost} data-lens-btn="soft" onClick={() => openOut(REPO + "supabase-stage43-gain.sql")}>Файл</button> : null })}
          </div>) : null}
        {st.phase === "error" ? <div style={{ ...T.para, textAlign: "center", padding: "30px 0" }}>{st.text}
          <div><button type="button" style={{ ...ghost, marginTop: 10 }} data-lens-btn="soft" onClick={() => { vibrate("light"); load(month); }}>Ещё раз</button></div></div> : null}
        {st.phase === "ready" && m ? (<>
          {m.months.length > 1 ? (
            <div role="group" aria-label="Месяц" style={{ display: "flex", flexWrap: "wrap", gap: 8, margin: "0 2px 10px" }}>
              {m.months.map((x, i) => { const sel = x === m.month;
                return <button key={x} type="button" aria-pressed={sel} data-lens-btn={sel ? "main" : "soft"} data-gain-month={x} onClick={() => pick(x)} disabled={!!st.again && !sel}
                  style={{ padding: "7px 14px", borderRadius: 999, border: "1px solid " + (sel ? c.gold : c.line), background: sel ? c.soft : "transparent",
                    color: sel ? text : sub, fontFamily: "Georgia, serif", fontSize: 13.5, cursor: "pointer" }}>{monthNom(x) + (i === 0 ? " пока" : "")}</button>; })}
            </div>) : null}
          <div data-gain-period="" style={{ fontSize: 13, color: sub, lineHeight: 1.45, margin: "0 2px 14px" }}>
            {[m.rest, compareLabel(m)].filter(Boolean).join(" · ")}{st.again ? " · обновляю…" : ""}
          </div>
          {/* v110 (Доп. 423): главное одной строкой — как в образце, который выбрал владелец */}
          {hd.learn || hd.hall ? (
            <div style={{ margin: "-4px 2px 16px" }} data-gain-head="">
              {hd.learn ? <div style={{ fontFamily: "'Piazzolla', Georgia, serif", fontWeight: 700, fontSize: 19, color: text, lineHeight: 1.3 }} data-gain-head-learn="">{hd.learn}</div> : null}
              {hd.hall ? <div style={{ fontSize: 14, marginTop: 4, color: hd.tone === "good" ? c.ok : hd.tone === "bad" ? c.warn : text }} data-gain-head-hall={hd.tone}>{hd.hall}</div> : null}
            </div>) : null}

          {h("Чему учились", null, "learn")}
          <div style={{ ...card, padding: "12px 10px" }} data-lens-card="" data-gain-sec="learn">
            <div style={{ display: "flex", textAlign: "center" }}>
              {lr.map((x) => (
                <div key={x.key} data-gain-stat={x.key} style={{ flex: 1, minWidth: 0, padding: "0 4px" }}>
                  <div style={{ fontFamily: "Georgia, serif", fontSize: 26, color: text, lineHeight: 1.15 }}>{x.text}</div>
                  <div style={{ fontSize: 12, color: sub, marginTop: 2 }}>{x.key === "lessons" ? plural(x.now, "урок", "урока", "уроков") : x.key === "tests" ? plural(x.now, "тест", "теста", "тестов") : "занимались"}</div>
                  {x.was != null ? <div style={{ marginTop: 4, fontSize: 12.5 }}>{delta(x, { "data-gain-delta": x.key })}{deltaText(x) ? <span style={{ color: sub }}> · </span> : null}{was(x)}</div> : null}
                </div>))}
            </div>
            {quiet ? <div style={{ fontSize: 12.5, color: sub, lineHeight: 1.45, marginTop: 10, textAlign: "center" }} data-gain-quiet="">
              {m.partial ? "В этом месяце пока никто не занимался." : "В этом месяце никто не занимался."}</div> : null}
            {!m.plearn ? <div style={{ fontSize: 12.5, color: sub, lineHeight: 1.45, marginTop: 10, textAlign: "center" }} data-gain-nolearn="">
              {"Занятия в " + monthPrep(monthOf(m.pfrom)) + " уже не сравнить: телефоны хранят журнал занятий 75 дней."}</div> : null}
          </div>

          {h("Что изменилось в зале", null, "hall")}
          <div style={card} data-lens-card="" data-gain-sec="hall">
            {hr.length ? hr.map((x, i) => row(x.key, x.label, { first: i === 0, value: x.text, sub: was(x), vsub: delta(x, { "data-gain-delta": x.key }), attrs: { "data-gain-good": x.good == null ? "" : x.good ? "1" : "0" } }))
              : row("none", "Пока сравнивать нечего", { first: true, sub: "Здесь будут «спасибо» гостей и коллег, ошибки в тестах и самостоятельные смены новичков." })}
          </div>

          {topics.length ? (<>
            {h("Темы месяца", m.topicsN ? m.topicsN + " " + plural(m.topicsN, "тема", "темы", "тем") : null, "topics")}
            <div style={card} data-lens-card="" data-gain-sec="topics">
              {topics.map((t, i) => row("t-" + t.id, t.title, { first: i === 0, sub: topicLine(t), attrs: { "data-gain-topic": t.id } }))}
            </div>
          </>) : null}

          {m.grew.length ? (<>
            {h("Больше всех выросли", null, "grew")}
            <div style={card} data-lens-card="" data-gain-sec="grew">
              {m.grew.map((g, i) => row("g-" + g.id, g.n, { first: i === 0, sub: grewWhy(g), ava: g.n, attrs: { "data-gain-grew": g.id } }))}
            </div>
          </>) : null}

          {m.idle.length ? (<>
            {h("Не занимались в " + monthPrep(m.month), m.idle.length + m.idleMore, "idle")}
            <div style={card} data-lens-card="" data-gain-sec="idle">
              {m.idle.map((x, i) => {
                const s = nudged[x.id];
                const act = s === "no_tg" ? <span style={{ flex: "0 0 auto", fontSize: 12, color: sub, fontStyle: "italic" }}>нет Telegram</span>
                  : <button type="button" style={{ ...ghost, opacity: s && s !== "fail" ? 0.6 : 1 }} data-lens-btn="soft" data-gain-nudge={x.id} disabled={!!s && s !== "fail"}
                      onClick={(e) => { e.stopPropagation(); nudge(x.id); }}>{s === "sent" ? "Напомнили" : s === "already" ? "Уже сегодня" : s === "busy" ? "Минуту…" : s === "fail" ? "Ещё раз" : "Напомнить"}</button>;
                return row("i-" + x.id, x.n, { first: i === 0, act, ava: x.n, attrs: { "data-gain-idle": x.id } });
              })}
              {m.idleMore ? row("idle-more", "И ещё " + m.idleMore, { go: () => onGo("report") }) : null}
            </div>
          </>) : null}

          {h("1-го числа в Telegram", null, "tg")}
          <div style={card} data-lens-card="" data-gain-sec="tg">
            {!st.tg ? row("tg", "Итог прошлого месяца бот присылает 1-го числа", { first: true })
              : !st.tg.bot ? row("nobot", "Бот на сервере не подключён", { first: true, sub: "Итог пока только здесь. Подключает владелец: «Команда» → «Сервер»." })
              : !st.tg.linked ? row("nolink", "Telegram не подключён", { first: true, sub: "Включи «Напоминания в Telegram», и 1-го числа итог прошлого месяца придёт туда.",
                  act: onRemind ? <button type="button" style={ghost} data-lens-btn="soft" data-gain-link="" onClick={(e) => { e.stopPropagation(); vibrate("light"); onRemind(); }}>Подключить</button> : null })
              : (<>
                {row("tg", "Итог прошлого месяца бот присылает 1-го числа в 10:00", { first: true, sub: "С кнопкой «Открыть итог»: она ведёт сюда." })}
                <button type="button" style={{ ...ghost, display: "block", width: "100%", padding: "10px 12px", marginTop: 4 }} data-lens-btn="soft" data-gain-send="" disabled={busy} onClick={send}>
                  {busy ? "Отправляю…" : "Прислать этот итог в Telegram"}</button>
              </>)}
            {note ? <div role="status" data-gain-note="" style={{ fontSize: 12.5, color: text, lineHeight: 1.5, marginTop: 8 }}>{note}</div> : null}
          </div>
        </>) : null}
      </div>
    </div>
  );
}
