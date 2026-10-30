// ui/server.jsx — v99 (Доп. 412): экран «Сервер» у владельца («Команда» → «Управление» → «Сервер»). Одним взглядом: какие
// этапы базы на месте и какой файл запустить, если нет; Telegram (бот, кнопки и ответы, последнее событие, кто подключил
// напоминания, кто входит без кода) и «Подключить бота» одной кнопкой (вместо SQL и ссылки с «<проект>»); расписания
// pg_cron; адрес приложения для кнопок бота. Сервер — этап 39 (server_check, owner_tg_setup), разбор — lib/server-check.js.
import React from "react";
import { rpc, saToken, rpcMissing, SUPABASE_URL } from "../api/supabase";
import { vibrate } from "../lib/utils";
import { GOLD, labelStyle } from "./tokens";
import { serverReport, stageFns, stageBuckets, REPO_URL } from "../lib/server-check";

const openOut = (url) => {
  try { const tg = window.Telegram && window.Telegram.WebApp; if (tg && tg.initData && typeof tg.openLink === "function") { tg.openLink(url); return; } } catch (e) { /* */ }
  try { window.open(url, "_blank", "noopener"); } catch (e) { /* */ }
};
const P = (a11y) => (a11y
  ? { ok: "#2C6B48", bad: "#A33A2A", warn: "#8B5A12", line: "rgba(139,106,48,0.22)", chip: "rgba(139,106,48,0.10)" }
  : { ok: "#8AD8AF", bad: "#E07878", warn: "#E4B36A", line: "rgba(214,178,102,0.18)", chip: "rgba(214,178,102,0.10)" });
const Mark = ({ ok, c, warn = false }) => (
  <span aria-hidden="true" style={{ flex: "0 0 auto", width: 22, height: 22, borderRadius: "50%", display: "inline-grid", placeItems: "center", marginTop: 1,
    border: "1.5px solid " + (ok ? c.ok : warn ? c.warn : c.bad), color: ok ? c.ok : warn ? c.warn : c.bad }}>
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">{ok ? <path d="M5 12.5l4.2 4.2L19 7" /> : <path d="M12 6v8M12 18.5v.5" />}</svg>
  </span>);

export function ServerScreen({ T, a11y, profile, onBack }) {
  const c = P(a11y);
  const [st, setSt] = React.useState({ phase: "load" });
  const [all, setAll] = React.useState(false);
  const [tgBusy, setTgBusy] = React.useState(false);
  const [tgMsg, setTgMsg] = React.useState("");
  const check = React.useCallback(() => {
    setSt((x) => (x.phase === "ready" ? { ...x, again: true } : { phase: "load" }));
    rpc("server_check", { p_token: saToken(), p_fns: stageFns().concat(["server_check"]), p_buckets: stageBuckets(), p_url: SUPABASE_URL }).then((r) => {
      if (rpcMissing(r)) { setSt({ phase: "missing" }); return; }
      if (!r || !r.ok) { setSt({ phase: "error", text: r && r.error === "forbidden" ? "Этот экран только у владельца." : r && r.error === "auth" ? "Сессия устарела. Войди заново." : "Сервер не ответил. Попробуй ещё раз." }); return; }
      setSt({ phase: "ready", rep: serverReport(r), at: Date.now() });
    }).catch(() => setSt({ phase: "error", text: "Нет связи. Попробуй ещё раз." }));
  }, []);
  React.useEffect(() => { check(); }, [check]);
  const tgSetup = () => {
    if (tgBusy) return;
    vibrate("light"); setTgBusy(true); setTgMsg("");
    rpc("owner_tg_setup", { p_token: saToken(), p_app: typeof window !== "undefined" ? window.location.origin : "" }).then((r) => {
      setTgBusy(false);
      if (r && r.ok && r.code) {
        openOut(SUPABASE_URL.replace(/\/+$/, "") + "/functions/v1/tg-bot?setup=" + encodeURIComponent(r.code));
        setTgMsg("Открылась страница бота: там написано, что подключилось. Если пишет, что функции нет, сначала обнови функцию tg-bot в Supabase. Ссылка живёт 30 минут.");
        setTimeout(check, 4000);
      } else setTgMsg(r && r.error === "no_bot" ? "Сначала токен бота в Supabase Vault (этап 22б)." : rpcMissing(r) ? "Сначала этап 39 (supabase-stage39-everyday.sql)." : "Не получилось. Попробуй ещё раз.");
    }).catch(() => { setTgBusy(false); setTgMsg("Нет связи. Попробуй ещё раз."); });
  };
  const card = { ...T.modCard, display: "block", padding: "12px 14px", marginBottom: 12, cursor: "default" };
  const h = (t, n = null) => <div style={{ ...labelStyle(13.5), color: GOLD, margin: "4px 2px 8px", display: "flex", gap: 8 }}><span style={{ flex: 1 }}>{t}</span>{n}</div>;
  const row = (key, ok, title, sub = null, extra = null, warn = false) => (
    <div key={key} data-srv-row={key} data-srv-ok={ok ? "1" : "0"} style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "8px 0", borderTop: "1px solid " + c.line }}>
      <Mark ok={ok} c={c} warn={warn} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: "Georgia, serif", fontSize: 14.5, color: T.modTitle.color, lineHeight: 1.35 }}>{title}</div>
        {sub ? <div style={{ fontSize: 12.5, color: T.modSub.color, lineHeight: 1.45, marginTop: 2 }}>{sub}</div> : null}
        {extra}
      </div>
    </div>);
  const btn = { marginTop: 10, width: "100%", padding: "12px", borderRadius: 999, border: 0, cursor: "pointer", fontFamily: "Georgia, serif", fontSize: 14.5, fontWeight: "bold", color: "#1A1008", background: "linear-gradient(180deg,#E4C88C,#C8A96E)" };
  const ghost = { marginTop: 6, padding: "6px 12px", borderRadius: 999, border: "1px solid " + c.line, background: c.chip, color: T.modTitle.color, fontSize: 12.5, fontFamily: "Georgia, serif", cursor: "pointer" };
  const rep = st.rep;
  return (
    <div style={T.screen} className="sa-screen" data-server={st.phase}>
      <div style={T.lessHead}>
        <button className="sa-hit" style={T.backBtn2} data-lens="back" aria-label="Вернуться" onClick={onBack}>‹</button>
        <div style={T.lessHeadTitle}>Сервер</div>
      </div>
      <div style={{ flex: 1, padding: "14px 16px 28px" }}>
        {st.phase === "load" ? <div style={{ ...T.para, textAlign: "center", padding: "30px 0" }}>Проверяю сервер…</div> : null}
        {st.phase === "missing" ? (
          <div data-lens-card="" style={card} data-srv-missing="">
            {row("39", false, "Нужен этап 39", "Supabase → SQL Editor → New query → вставь supabase-stage39-everyday.sql → Run. После этого экран покажет всё остальное.",
              <button type="button" data-lens-btn="soft" style={ghost} onClick={() => openOut(REPO_URL + "supabase-stage39-everyday.sql")}>Файл на GitHub</button>)}
          </div>) : null}
        {st.phase === "error" ? <div style={{ ...T.para, textAlign: "center", padding: "30px 0" }}>{st.text}</div> : null}
        {st.phase === "ready" && rep ? (<>
          <div data-lens-card={rep.todo ? "warn" : "ok"} style={{ ...card, borderColor: rep.todo ? c.warn : c.ok }} data-srv-todo={rep.todo}>
            <div style={{ fontFamily: "'Piazzolla', Georgia, serif", fontSize: 19, color: T.modTitle.color }}>{rep.todo ? "Нужно сделать: " + rep.todo : "Всё на месте"}</div>
            <div style={{ fontSize: 12.5, color: T.modSub.color, marginTop: 3 }}>{rep.todo ? "Ниже по пунктам: что запустить и где." : "Этапы базы, бот и расписания работают."} Проверено {new Date(st.at).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}.</div>
            <button type="button" data-lens-btn="soft" style={ghost} data-srv-again="" onClick={() => { vibrate("light"); check(); }}>{st.again ? "Проверяю…" : "Проверить ещё раз"}</button>
          </div>

          {h("База данных", <span style={{ color: T.modSub.color }}>{rep.stages.length - rep.missing.length} из {rep.stages.length}</span>)}
          <div data-lens-card="" style={card} data-srv-db="">
            {rep.missing.map((s) => row("st" + s.n, false, "Этап " + s.n + ": " + s.what, "Запусти в SQL Editor: " + s.file,
              <button type="button" data-lens-btn="soft" style={ghost} onClick={() => openOut(REPO_URL + s.file)}>Файл на GitHub</button>))}
            {!rep.missing.length ? row("db", true, "Все этапы на месте", "Последний: " + rep.stages[rep.stages.length - 1].n + ", " + rep.stages[rep.stages.length - 1].what.replace(/^./, (x) => x.toLowerCase())) : null}
            <button type="button" data-lens-btn="soft" style={{ ...ghost, marginTop: 8 }} data-srv-all="" onClick={() => setAll((x) => !x)}>{all ? "Скрыть список" : "Все этапы"}</button>
            {all ? <div style={{ marginTop: 6 }}>{rep.stages.map((s) => row("a" + s.n, s.ok, s.n + " · " + s.what, s.ok ? null : s.file))}</div> : null}
          </div>

          {h("Telegram")}
          <div data-lens-card="" style={card} data-srv-tg="">
            {row("bot", rep.tg.bot, rep.tg.bot ? "Бот на месте" + (rep.tg.name ? ": @" + rep.tg.name : "") : "Бота нет", rep.tg.bot ? null : "Токен бота от BotFather в Supabase Vault (этап 22б). Без него нет напоминаний, кнопок и входа через Telegram.")}
            {rep.tg.bot ? row("hook", rep.tg.hook && !!rep.tg.last, rep.tg.hook ? "Кнопки и ответы в чат: подключены" : "Кнопки и ответы в чат: не подключены",
              rep.tg.last ? "Последнее событие от Telegram: " + rep.tg.ago + "." : rep.tg.hook ? "Событий от Telegram ещё не было: нажми кнопку под сообщением бота или напиши ему /start." : "Нажми «Подключить бота»: вебхук, кнопка «Академия» у поля ввода и команды /smena, /start.",
              null, rep.tg.hook && !rep.tg.last) : null}
            {rep.tg.bot ? row("linked", rep.tg.linked > 0, "Напоминания в Telegram включили: " + rep.tg.linked + (rep.tg.staff ? " из " + rep.tg.staff : ""), "Включает каждый сам: «Смена» → «Напоминания в Telegram».", null, rep.tg.linked === 0) : null}
            {rep.tg.bot ? row("auth", true, "Входят без кода через Telegram: " + rep.tg.auth, "Кто хоть раз вошёл по коду в Telegram или включил напоминания. Остальных Telegram узнает после первого входа.") : null}
            {rep.tg.bot ? <button type="button" data-lens-btn="main" style={btn} data-srv-tgsetup="" disabled={tgBusy} onClick={tgSetup}>{tgBusy ? "Минуту…" : rep.tg.hook ? "Подключить бота заново" : "Подключить бота"}</button> : null}
            {tgMsg ? <div role="status" style={{ fontSize: 12.5, color: T.modTitle.color, lineHeight: 1.5, marginTop: 8 }}>{tgMsg}</div> : null}
          </div>

          {h("Расписания")}
          <div data-lens-card="" style={card} data-srv-cron="">
            {!rep.cron ? row("cron", false, "pg_cron не включён", "Без него бот не присылает напоминания и вопрос дня по времени. Supabase → Database → Extensions → pg_cron, потом перезапусти этапы 22б, 25 и 31.")
              : rep.cron.map((j) => row("cron-" + j.name, j.ok && j.on, j.what, j.ok ? (j.on ? null : "Задача выключена (" + j.name + ").") : "Нет задачи " + j.name + ": перезапусти этап " + j.n + "."))}
            {row("net", rep.net, rep.net ? "Отправка сообщений (pg_net): есть" : "pg_net не включён", rep.net ? null : "Supabase → Database → Extensions → pg_net. Без него бот молчит.")}
          </div>

          {h("Приложение")}
          <div data-lens-card="" style={card} data-srv-app="">
            {row("app", !!rep.app, rep.app ? "Адрес для кнопок бота: " + rep.app : "Адрес для кнопок бота не задан", rep.app ? null : "Кнопки в сообщениях бота открывают приложение через t.me. «Подключить бота» запишет адрес этого приложения.", null, !rep.app)}
            {rep.tz ? row("tz", true, "Часовой пояс заведения: " + rep.tz) : null}
          </div>
        </>) : null}
      </div>
    </div>
  );
}
