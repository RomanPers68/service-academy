// ui/concept.jsx — v139 (Доп. 454): «О нас» — концепция и стандарты сети и заведения («Команда» → «О нас»).
//
// Владелец (05.11): «можно оставить редактор, чтобы каждое заведение могло вписать свою концепцию, а руководитель сети
// общую»; про стандарты: «да. Я про дресс-код, фото и т.д.»; «чтобы это было дополнением к имеющемуся. И чтобы все функции
// приложения с этим взаимодействовали».
// Сотрудник видит общую часть сети, своё заведение (блоки своего трека) и соседей по сети (их концепцию), внизу
// «Прочитал(а)», когда что-то обновили. Руководитель («Править»): блоки сети (владелец и руководящий состав) или своего
// заведения (руководящий состав — любого): вид блока, заголовок, текст, фото с подписями, «для кого», вопросы теста
// (руками или «Придумать вопросы»), «Улучшить текст», «Из документа» (текст или PDF раскладывается по блокам), порядок,
// «Сообщить команде» и «Кто прочитал». Сервер — этап 49, логика — lib/concept.js, фото — ui/concept-photo.jsx.
// Вид «Линза» (метки data-lens-*, правила ui/home-look.jsx): карточки, поля, кнопки (главные и стекло), вкладки «Вся сеть /
// заведение» капсулой (как «График / Настройки»), выбранное — плашкой, виды блока — стеклом, вопросы теста — кромкой.
// Владелец (05.11): «Добавленное все имеет эффект линзы?». Заведения для правки — все заведения сети из приложения
// (data/roles.js) и с сервера (где есть сотрудники или уже есть блоки): «в финальном будут все?».
// v191 (Доп. 516): владелец — «Добавил концепцию холдинга, а приложение тему назвало «Наш ресторан». Мы можем добавить
// возможность дописывать название блока?»; «давай сделаем удобнее добавление концепции и стандарты»; «что бы он красиво
// составлял текст, по типу того, что у нас уже собранно в уроках. А то выглядит инородно». Редактор: сверху карточка
// «Раздел в обучении» — своё название и подзаголовок (этап 57), сколько уроков и вопросов, «Открыть как сотрудник»;
// вкладки со счётом блоков; строка блока — значок вида, первая мысль, касание открывает правку; «Из документа» — PDF,
// Word или текст, план и блоки в виде уроков с вопросами, просмотр перед сохранением, заменить или добавить
// (ui/concept-import.jsx); «Оформить как в уроках» — готовые блоки тем же видом. Правка блока: «Текст / Как в уроке»,
// кнопки разметки уроков (шаги, ✅, 🚫, 📌, фраза гостю), «Оформить как урок», подсказка по виду. Текст блоков в «О нас»
// и в уроках — разметкой штатных уроков (ui/lesson-look.jsx, lib/lesson-look.js).
// v192 (Доп. 517): владелец про семь идей для «О нас»: «Ты правильно понял. Делаем все 7». Сверху обложка (название,
// заведение, фото зала, оглавление), «Что изменилось» после твоей отметки (в блоке видно, что именно), внизу
// «Ознакомлен(а)» вместо «Прочитал(а)» и раздел целиком в PDF; у блока «Рассказ гостю» — тренажёр. Руководителю: лист
// ознакомления с датами и PDF для отдела кадров, история блока с «Вернуть», удалённые блоки (ui/concept-more.jsx, этап 58).
import React from "react";
import { rpc, saToken, rpcMissing } from "../api/supabase";
import { vibrate } from "../lib/utils";
import { GOLD, labelStyle } from "./tokens";
import { TRACKS } from "../lib/tracks";
import { RESTAURANTS } from "../data/roles";
import { compressPhoto } from "../lib/chat-photo";
import { CN_KINDS, CN_LIMITS, CN_META_LIMITS, CN_SECTION, CN_SUB, kindOf, blockFor, conceptUnread, blankBlock, blockPayload, blockProblem, conceptErr, cleanQuestion, normConcept, conceptPairs,
  conceptSection, conceptAck, conceptChanges, conceptHero, conceptToc } from "../lib/concept";
import { isFemaleName } from "../lib/utils";
import { ConceptCover, ChangesCard, DiffView, AckCard, AcksPanel, HistoryPanel, GonePanel, savePdf } from "./concept-more";   // v192 (Доп. 517)
import { ConceptPhotos, conceptPhotoRemember } from "./concept-photo";
import { LessonLook } from "./lesson-look";
import { lessonize, lookInfo, markLines } from "../lib/lesson-look";
import { UI_SVG, MARKER_RE } from "./icons";
import { GREEN, RED } from "./tokens";
import { askAI } from "../lib/concept-ai";
import { ConceptImport, ConceptRestyle, KindIcon, Seg } from "./concept-import";

const P = (a11y) => (a11y
  ? { line: "rgba(139,106,48,0.22)", chip: "rgba(139,106,48,0.10)", soft: "#5C4A2A", warn: "#8B5A12", ok: "#2C6B48", field: "rgba(255,250,238,0.75)" }
  : { line: "rgba(214,178,102,0.18)", chip: "rgba(214,178,102,0.10)", soft: "rgba(232,215,180,0.72)", warn: "#E4B36A", ok: "#8AD8AF", field: "rgba(30,24,14,0.6)" });
const SERIF = "Georgia, 'Times New Roman', serif";
const TITLE = "'Piazzolla', Georgia, serif";
const trackLabel = (id) => (TRACKS.find((t) => t.id === id) || {}).label || id;
const forWhom = (b) => (b.tracks && b.tracks.length ? b.tracks.map(trackLabel).join(", ") : "Все");

/**
 * Текст блока — как в уроке (v191: ui/lesson-look.jsx): первая мысль крупно, **подзаголовок**, «• » список, ☑, ✅, 🚫, 📌,
 * шаги 1️⃣, «ёлочки» — фраза гостю; разметка приводится к виду уроков (lib/lesson-look.js). v150: неразрывные пробелы.
 */
export function BlockText({ text, T }) {
  return <LessonLook text={lessonize(String(text || ""))} T={T} bare />;
}

// v192: chg — { type: "edit" | "new", was } (что поменялось после отметки), diff — показать, что именно; onPitch — тренажёр
function BlockCard({ b, T, a11y, c, lead, where, chg = null, diff = false, onDiff = null, onPitch = null }) {
  return (
    <div data-lens-card="" data-cn-block={b.kind} data-cn-id={b.id} data-cn-chgd={chg ? chg.type : undefined}
      style={{ ...T.modCard, display: "block", padding: "12px 14px", marginBottom: 12, cursor: "default", scrollMarginTop: 70, ...(chg ? { borderColor: GOLD + "aa" } : {}) }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
        <div style={{ flex: 1, fontFamily: TITLE, fontSize: 17.5, color: T.modTitle.color, lineHeight: 1.3 }}>{b.title}</div>
        {chg ? <span data-cn-badge={chg.type} style={{ fontSize: 11.5, padding: "1px 8px", borderRadius: 999, border: "1px solid " + GOLD + "99", color: GOLD, whiteSpace: "nowrap" }}>{chg.type === "new" ? "новый" : "изменён"}</span> : null}
        {where ? <span style={{ fontSize: 11.5, color: c.soft, whiteSpace: "nowrap" }}>{where}</span> : null}
      </div>
      {lead && b.tracks.length ? <div style={{ fontSize: 11.5, color: c.soft, marginTop: 2 }}>Для кого: {forWhom(b)}</div> : null}
      {chg && chg.type === "edit" && onDiff ? <button type="button" data-lens-btn="soft" data-cn-difftoggle={diff ? "1" : "0"} onClick={() => { vibrate("light"); onDiff(); }}
        style={{ marginTop: 8, padding: "5px 12px", borderRadius: 999, border: "1px solid " + c.line, background: c.chip, color: T.modTitle.color, fontFamily: SERIF, fontSize: 12.5, cursor: "pointer" }}>
        {diff ? "Как сейчас" : "Что поменялось"}</button> : null}
      {diff && chg && chg.was ? <div style={{ marginTop: 8 }}><DiffView T={T} c={c} was={chg.was} now={b} /></div>
        : b.body ? <div style={{ marginTop: 6 }}><BlockText text={b.body} T={T} /></div> : null}
      <ConceptPhotos photos={b.photos} a11y={a11y} />
      {onPitch && b.kind === "pitch" ? <button type="button" data-lens-btn="main" data-cn-pitch="" onClick={() => { vibrate("light"); onPitch(); }}
        style={{ marginTop: 10, width: "100%", padding: "10px", borderRadius: 999, border: 0, cursor: "pointer", fontFamily: SERIF, fontSize: 14, fontWeight: "bold", color: "#1A1008",
          background: "linear-gradient(180deg,#E4C88C,#C8A96E)" }}>Потренироваться: рассказ за 30 секунд</button> : null}
    </div>);
}

// Помощник — /api/lesson-assist (lib/concept-ai.js, askAI), тот же, что у редактора уроков.

export function AboutScreen({ T, a11y, profile, role, concept, onRaw, onBack, startEdit = false, onOpenSection = null, onPitch = null }) {
  const c = P(a11y);
  const lead = !!(profile && (profile.is_admin || ["manager", "senior"].includes(profile.position)));
  const [mode, setMode] = React.useState(startEdit && lead ? "edit" : "view");
  const [data, setData] = React.useState(concept || null);   // что на экране (у сети — может быть другое заведение)
  const [phase, setPhase] = React.useState(concept ? "ready" : "load");
  const [rest, setRest] = React.useState("");   // заведение, которое правит сеть ("" — своё)
  const [busy, setBusy] = React.useState(false);
  const [msg, setMsg] = React.useState("");
  const [openOther, setOpenOther] = React.useState(null);
  const [diffs, setDiffs] = React.useState({});     // v192: у каких блоков открыто «Что поменялось»
  const [printing, setPrinting] = React.useState(false);
  const mine = (concept && concept.mine) || (profile && profile.restaurant) || "";
  const female = profile && profile.name ? isFemaleName(profile.name, profile.surname) : null;

  const load = React.useCallback((r = rest) => {
    return rpc("concept_get", { p_token: saToken(), p_restaurant: r || null }).then((raw) => {
      if (rpcMissing(raw)) { setPhase("missing"); return null; }
      const n = normConcept(raw);
      if (!n) { setPhase(raw && raw.error === "auth" ? "auth" : "error"); return null; }
      setData(n); setPhase("ready");
      if (!r || r === mine) onRaw && onRaw(raw);   // своё — в приложение и в кэш
      return n;
    }).catch(() => { setPhase((p) => (p === "ready" ? p : "error")); return null; });
  }, [rest, mine, onRaw]);
  React.useEffect(() => { load(""); }, []);   // eslint-disable-line react-hooks/exhaustive-deps
  React.useEffect(() => { if (concept && !rest) setData(concept); }, [concept, rest]);

  const d = data;
  const unread = conceptUnread(d && (!rest || rest === mine) ? d : null);
  const markRead = () => {
    if (busy || !d) return;
    vibrate("light"); setBusy(true);
    const jobs = [];
    if (unread.net) jobs.push(rpc("concept_read", { p_token: saToken(), p_scope: "" }));
    if (unread.venue && d.venue) jobs.push(rpc("concept_read", { p_token: saToken(), p_scope: d.venue.name }));
    Promise.all(jobs).then(() => load("")).then(() => vibrate("success")).finally(() => setBusy(false));
  };
  // v192: к блоку из оглавления или «Что изменилось»; diff — сразу показать, что поменялось
  const jump = (id, diff = false) => {
    if (diff) setDiffs((x) => ({ ...x, [id]: true }));
    requestAnimationFrame(() => { try { const el = document.querySelector('[data-cn-id="' + id + '"]'); if (el) el.scrollIntoView({ behavior: "smooth", block: "start" }); } catch (e) { /* */ } });
  };
  const print = async () => {
    if (printing || !d) return;
    vibrate("light"); setPrinting(true); setMsg("");
    const t = await savePdf("concept_pdf", d, { track: role, all: lead });
    setPrinting(false); setMsg(t);
  };

  // назад: из блока — к списку блоков (back), из правки — к «О нас», из «О нас» — откуда пришли
  const head = (title, right = null, back = null) => (
    <div style={T.lessHead}>
      <button className="sa-hit" style={T.backBtn2} data-lens="back" aria-label="Вернуться" onClick={back || (mode === "view" || !lead ? onBack : () => { setMode("view"); setMsg(""); if (rest) { setRest(""); load(""); } })}>‹</button>
      <div style={T.lessHeadTitle}>{title}</div>
      {right}
    </div>);
  const ghost = { padding: "7px 14px", borderRadius: 999, border: "1px solid " + c.line, background: c.chip, color: T.modTitle.color, fontSize: 13, fontFamily: SERIF, cursor: "pointer" };
  const main = { width: "100%", padding: "12px", borderRadius: 999, border: 0, cursor: "pointer", fontFamily: SERIF, fontSize: 14.5, fontWeight: "bold", color: "#1A1008",
    background: "linear-gradient(180deg,#E4C88C,#C8A96E)" };
  const h = (t, extra = null) => <div style={{ ...labelStyle(13.5), color: GOLD, margin: "6px 2px 8px", display: "flex", alignItems: "baseline", gap: 8 }}><span style={{ flex: 1 }}>{t}</span>{extra}</div>;

  if (mode === "edit" && lead && d) {
    return <ConceptEditor T={T} a11y={a11y} c={c} data={d} mine={mine} rest={rest} head={head} ghost={ghost} main={main} h={h}
      onRest={(r) => { setRest(r === mine ? "" : r); setPhase("load"); load(r === mine ? "" : r); }} reload={() => load()}
      onOpenSection={onOpenSection && !rest ? onOpenSection : null} />;
  }

  const empty = d && !d.net.blocks.length && !(d.venue && d.venue.blocks.length);
  const show = (arr) => (arr || []).filter((b) => lead || blockFor(b, role));
  // v192: обложка, «Что изменилось», «Ознакомлен(а)» — у своего заведения (сеть, открывшая чужое, правит, а не читает)
  const own = d && (!rest || rest === mine);
  const ack = own ? conceptAck(d) : { has: false, need: false, at: "", edition: "" };
  const chg = own ? conceptChanges(d, role, lead) : { at: "", items: [] };
  const chgOf = (b) => { const x = chg.items.find((y) => y.id === b.id && y.type !== "gone"); return x ? { type: x.type, was: x.was } : null; };
  const card = (b) => <BlockCard key={b.id} b={b} T={T} a11y={a11y} c={c} lead={lead} chg={chgOf(b)} diff={!!diffs[b.id]}
    onDiff={() => setDiffs((x) => ({ ...x, [b.id]: !x[b.id] }))} onPitch={onPitch && b.kind === "pitch" ? () => onPitch(role) : null} />;
  return (
    <div style={T.screen} className="sa-screen" data-about={phase} data-about-unread={unread.any ? "1" : "0"}>
      {head("О нас", lead && d && (d.can.net || d.can.venue) ? <button type="button" data-lens-btn="soft" data-cn-edit="" style={{ ...ghost, marginLeft: "auto" }} onClick={() => { vibrate("light"); setMode("edit"); }}>Править</button> : null)}
      <div style={{ flex: 1, padding: "14px 16px 28px" }}>
        {phase === "load" && !d ? <div style={{ ...T.para, textAlign: "center", padding: "30px 0" }}>Загружаю…</div> : null}
        {phase === "missing" && !d ? <div style={{ ...T.para, textAlign: "center", padding: "30px 0" }}>{lead ? "Нужен этап 49 на сервере: supabase-stage49-concept.sql. Владелец увидит его в «Сервере»." : "Скоро здесь появится концепция и стандарты. Их пишут руководители."}</div> : null}
        {(phase === "error" || phase === "auth") && !d ? <div style={{ ...T.para, textAlign: "center", padding: "30px 0" }}>{phase === "auth" ? "Сессия устарела. Войди заново." : "Нет связи. Попробуй ещё раз."}</div> : null}
        {d && empty ? (
          <div data-lens-card="" data-cn-empty="" style={{ ...T.modCard, display: "block", padding: "14px 16px", cursor: "default" }}>
            <div style={{ fontFamily: TITLE, fontSize: 18, color: T.modTitle.color }}>Здесь будет концепция и стандарты</div>
            <div style={{ ...T.para, marginTop: 6 }}>{lead ? "Начни с концепции и рассказа гостю за 30 секунд. Можно вставить готовый документ: помощник разложит его по блокам." : "Их пишут руководители сети и заведения. Как появятся, придёт сообщение."}</div>
            {lead && (d.can.net || d.can.venue) ? <button type="button" data-lens-btn="main" style={{ ...main, marginTop: 12 }} onClick={() => setMode("edit")}>Начать</button> : null}
          </div>) : null}
        {d && !empty ? <ConceptCover T={T} a11y={a11y} c={c} sec={conceptSection(d)} where={d.venue ? d.venue.name : ""} hero={conceptHero(d, lead ? "" : role)}
          ack={ack} chg={chg} toc={conceptToc(d, role, lead)} female={female} onJump={(id) => jump(id)} /> : null}
        {d && !empty ? <ChangesCard T={T} c={c} chg={chg} onJump={jump} /> : null}
        {d && show(d.net.blocks).length ? <>{h("Вся сеть")}{show(d.net.blocks).map(card)}</> : null}
        {d && d.venue && show(d.venue.blocks).length ? <>{h(d.venue.name)}{show(d.venue.blocks).map(card)}</> : null}
        {d && d.others.length ? <>
          {h("Соседи по сети")}
          {d.others.map((o) => (
            <div key={o.name} data-lens-card="" data-cn-other={o.name} style={{ ...T.modCard, display: "block", padding: "10px 14px", marginBottom: 10, cursor: "default" }}>
              <button type="button" className="sa-hit" onClick={() => setOpenOther((x) => (x === o.name ? null : o.name))} aria-expanded={openOther === o.name}
                style={{ display: "flex", width: "100%", alignItems: "center", gap: 8, background: "transparent", border: 0, padding: "4px 0", cursor: "pointer", textAlign: "left" }}>
                <span style={{ flex: 1, fontFamily: TITLE, fontSize: 16.5, color: T.modTitle.color }}>{o.name}</span>
                <span style={{ color: GOLD, fontSize: 13 }}>{openOther === o.name ? "Свернуть" : "Открыть"}</span>
              </button>
              {openOther === o.name ? o.blocks.map((b) => (
                <div key={b.id} style={{ borderTop: "1px solid " + c.line, padding: "8px 0" }}>
                  <div style={{ fontFamily: SERIF, fontWeight: "bold", fontSize: 14.5, color: T.modTitle.color }}>{b.title}</div>
                  {b.body ? <BlockText text={b.body} T={T} /> : null}
                  <ConceptPhotos photos={b.photos} a11y={a11y} h={120} />
                </div>)) : null}
            </div>))}
        </> : null}
        {d && !empty ? <AckCard T={T} c={c} ack={ack} busy={busy} onAck={markRead} female={female} main={main} onPrint={print} printing={printing} /> : null}
        {msg ? <div role="status" style={{ fontSize: 12.5, color: T.modTitle.color, marginTop: 8 }}>{msg}</div> : null}
      </div>
    </div>);
}


// ── Редактор: блоки сети или заведения ──
const TAB_KEY = "sa_cn_tab";   // v191: какая вкладка была открыта — на время сеанса
/** v191: с какой вкладки начать — запомненная; иначе где уже есть блоки; у сети и пустого заведения — «Вся сеть». */
export function firstTab(data, saved = "") {
  const can = data.can;
  if ((saved === "net" && can.net) || (saved === "venue" && can.venue)) return saved;
  if (!can.net) return "venue";
  if (!can.venue) return "net";
  return data.net.blocks.length || !(data.venue && data.venue.blocks.length) ? "net" : "venue";
}
const plural = (n, a, b, c) => (n % 10 === 1 && n % 100 !== 11 ? a : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20) ? b : c);
// первая мысль блока для строки списка: первая строка текста без разметки
export const leadOf = (body) => {
  const first = lessonize(body || "").split("\n").map((x) => x.trim()).find((x) => x && !/^\*\*.*\*\*$/.test(x)) || "";
  const t = first.replace(/\*\*/g, "").replace(/^•\s*/, "").replace(MARKER_RE, "");
  return t.length > 110 ? t.slice(0, 108).replace(/\s+\S*$/, "") + "…" : t;
};

// ── v191: «Раздел в обучении» — как называется раздел в треках, что в нём, как его видит сотрудник ──
function SectionCard({ T, c, ghost, main, field, data, scope, venueName, canHere, onSaved, onOpenSection }) {
  const m = data.meta;   // null — на сервере нет этапа 57
  const net = (m && m.net) || { title: "", sub: "" }, ven = (m && m.venue) || { title: "", sub: "" };
  const own = scope === "net" ? net : ven;
  const shown = scope === "net" ? { title: net.title || CN_SECTION, sub: net.sub || CN_SUB }
    : { title: ven.title || net.title || CN_SECTION, sub: ven.sub || net.sub || CN_SUB };
  const [edit, setEdit] = React.useState(false);
  const [t, setT] = React.useState(own.title), [sb, setSb] = React.useState(own.sub);
  const [busy, setBusy] = React.useState(false), [note, setNote] = React.useState("");
  React.useEffect(() => { setEdit(false); setNote(""); }, [scope, venueName]);
  // что видят сотрудники заведения: блоки сети и заведения вместе (как раздел в треке)
  const pairs = conceptPairs(data, null);
  const qs = [...data.net.blocks, ...(data.venue ? data.venue.blocks : [])].reduce((a, b) => a + b.questions.length, 0);
  // v191: как проходить раздел — «для ознакомления» (по умолчанию) или «в зачёт»; у заведения ещё «как у сети»
  const mode = scope === "net" ? net.mode || "info" : ven.mode || net.mode || "info";
  const put = (title, sub, md = null) => {
    if (busy) return;
    vibrate("light"); setBusy(true); setNote("");
    rpc("concept_meta_set", { p_token: saToken(), p_scope: scope === "net" ? "" : venueName, p_title: title, p_sub: sub, p_mode: md }).then((r) => {
      if (rpcMissing(r)) { setNote("Это появится после этапа 57 на сервере: supabase-stage57-concept-title.sql."); return; }
      if (!r || !r.ok) { setNote(conceptErr(r && r.error)); return; }
      if (md != null) { onSaved(md === "credit" ? "Раздел теперь в зачёт: он в прогрессе трека, отчёте и экзамене." : md === "info" ? "Раздел теперь для ознакомления: в прогресс трека и отчёт не идёт, тест стал самопроверкой." : "Как проходить раздел, теперь решает сеть."); return; }
      setEdit(false); onSaved(title || sub ? "Название раздела сохранено. В треках оно уже новое." : "Название раздела снова прежнее.");
    }).catch(() => setNote("Нет связи. Попробуй ещё раз.")).finally(() => setBusy(false));
  };
  const sub = { fontSize: 12.5, color: c.soft, lineHeight: 1.5 };
  return (
    <div data-lens-card="" data-cn-section={shown.title} style={{ ...T.modCard, display: "block", padding: "12px 14px", marginBottom: 12, cursor: "default" }}>
      <div style={{ ...labelStyle(11.5), color: GOLD, letterSpacing: 1.2 }}>Раздел в обучении · О нас</div>
      {!edit ? <>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 8, marginTop: 4 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div data-cn-sectitle="" style={{ fontFamily: TITLE, fontSize: 20, fontWeight: 700, color: T.modTitle.color, lineHeight: 1.25 }}>{shown.title}</div>
            <div style={{ fontFamily: SERIF, fontStyle: "italic", fontSize: 13.5, color: c.soft, marginTop: 2 }}>{shown.sub}</div>
          </div>
          {canHere ? <button type="button" data-lens-btn="soft" data-cn-secedit="" style={{ ...ghost, padding: "5px 12px", fontSize: 12.5, flexShrink: 0 }}
            onClick={() => { vibrate("light"); setT(own.title); setSb(own.sub); setNote(""); setEdit(true); }}>Переименовать</button> : null}
        </div>
        <div data-cn-secstat={pairs.length + "/" + qs} style={{ ...sub, marginTop: 6 }}>
          {pairs.length ? pairs.length + " " + plural(pairs.length, "урок", "урока", "уроков") + " · " : ""}
          {pairs.length ? (qs ? (mode === "info" ? "самопроверка: " : "тест: ") + qs + " " + plural(qs, "вопрос", "вопроса", "вопросов") : <span style={{ color: c.warn }}>теста нет: добавь блокам вопросы</span>) : "пока без уроков"}
          {" · первым в каждом треке"}{scope === "venue" && venueName ? ", у «" + venueName + "» вместе с блоками сети" : ""}</div>
        <div data-cn-modebox={mode} style={{ marginTop: 10 }}>
          <div style={{ ...sub, marginBottom: 5 }}>Как проходить</div>
          {canHere && m ? <Seg c={c} label="Как проходить раздел" mark="data-cn-mode" value={scope === "net" ? net.mode || "info" : ven.mode || ""} onPick={(v) => put(null, null, v)} wrap={scope !== "net"}
            items={scope === "net" ? [["info", "Для ознакомления"], ["credit", "В зачёт"]] : [["", "Как у сети"], ["info", "Для ознакомления"], ["credit", "В зачёт"]]} />
            : <div style={{ fontFamily: SERIF, fontSize: 14, color: T.modTitle.color }}>{mode === "info" ? "Для ознакомления" : "В зачёт"}</div>}
          <div style={{ ...sub, marginTop: 5 }}>{mode === "info" ? "В прогресс трека, отчёт руководителя и экзамен не идёт, тест становится самопроверкой. Кто прочитал, видно ниже." : "Как обычная тема: в прогрессе трека, отчёте, экзамене и «Вопросе дня»."} Пройденное засчитывается только в той роли, где его прошли.</div>
        </div>
        {onOpenSection && pairs.length ? <button type="button" data-lens-btn="soft" data-cn-secopen="" style={{ ...ghost, marginTop: 10 }} onClick={() => { vibrate("light"); onOpenSection(); }}>Открыть как сотрудник</button> : null}
      </> : m ? <>
        <div style={{ ...sub, margin: "6px 0 4px" }}>Название в треках</div>
        <input data-lens-field="" data-cn-sectin="" value={t} maxLength={CN_META_LIMITS.title} onChange={(e) => setT(e.target.value)}
          placeholder={scope === "net" ? CN_SECTION : net.title || CN_SECTION} style={field} />
        <div style={{ ...sub, margin: "8px 0 4px" }}>Подзаголовок</div>
        <input data-lens-field="" data-cn-secsub="" value={sb} maxLength={CN_META_LIMITS.sub} onChange={(e) => setSb(e.target.value)}
          placeholder={scope === "net" ? CN_SUB : net.sub || CN_SUB} style={field} />
        <div style={{ ...sub, marginTop: 6 }}>{scope === "net" ? "Например, название холдинга: «Marin Resto Group». Если пусто, будет «" + CN_SECTION + "»." : "Только для «" + venueName + "». Если пусто, как у сети: «" + (net.title || CN_SECTION) + "»."}</div>
        <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
          <button type="button" data-lens-btn="main" data-cn-secsave="" style={{ ...main, width: "auto", flex: 1, padding: "10px 14px" }} disabled={busy} onClick={() => put(t.trim(), sb.trim())}>{busy ? "Сохраняю…" : "Сохранить"}</button>
          {own.title || own.sub ? <button type="button" data-lens-btn="soft" data-cn-secreset="" style={ghost} disabled={busy} onClick={() => put("", "")}>Как было</button> : null}
          <button type="button" data-lens-btn="soft" style={ghost} onClick={() => setEdit(false)}>Отмена</button>
        </div>
      </> : <>
        <div role="status" data-cn-secneed="" style={{ ...T.para, marginTop: 6 }}>Своё название появится, когда на сервере будет этап 57: supabase-stage57-concept-title.sql. Владелец увидит его в «Сервере».</div>
        <button type="button" data-lens-btn="soft" style={{ ...ghost, marginTop: 8 }} onClick={() => setEdit(false)}>Понятно</button>
      </>}
      {note ? <div role="status" data-cn-secnote="" style={{ ...sub, color: c.warn, marginTop: 8 }}>{note}</div> : null}
    </div>);
}

function ConceptEditor({ T, a11y, c, data, mine, rest, head, ghost, main, h, onRest, reload, onOpenSection }) {
  const can = data.can;
  const venueName = data.venue ? data.venue.name : rest || mine;
  const [scope, setScope0] = React.useState(() => { let sv = ""; try { sv = sessionStorage.getItem(TAB_KEY) || ""; } catch (e) { /* */ } return firstTab(data, sv); });   // "net" | "venue"
  const setScope = (v) => { setScope0(v); try { sessionStorage.setItem(TAB_KEY, v); } catch (e) { /* */ } };
  const [edit, setEdit] = React.useState(null);   // блок в правке
  const [pick, setPick] = React.useState(false);   // выбор вида нового блока
  const [doc, setDoc] = React.useState(false);     // «Из документа»
  const [restyle, setRestyle] = React.useState(false);   // «Оформить как в уроках»
  const [busy, setBusy] = React.useState(false);
  const [msg, setMsg] = React.useState("");
  const [delAsk, setDelAsk] = React.useState(null);
  const sc = scope === "net" ? "" : venueName;
  const blocks = (scope === "net" ? data.net.blocks : (data.venue ? data.venue.blocks : [])).slice().sort((a, b) => (a.sort - b.sort) || (a.id - b.id));
  const canHere = scope === "net" ? can.net : can.venue;
  const nNet = data.net.blocks.length, nVen = data.venue ? data.venue.blocks.length : 0;

  const say = (t) => { setMsg(t); };
  const move = (i, dir) => {
    const j = i + dir;
    if (busy || j < 0 || j >= blocks.length) return;
    vibrate("light"); setBusy(true);
    const ids = blocks.map((b) => b.id); [ids[i], ids[j]] = [ids[j], ids[i]];
    rpc("concept_order", { p_token: saToken(), p_scope: sc, p_ids: ids }).then((r) => { if (!r || !r.ok) say(conceptErr(r && r.error)); return reload(); }).finally(() => setBusy(false));
  };
  const del = (b) => {
    if (busy) return;
    vibrate("light"); setBusy(true); setDelAsk(null);
    rpc("concept_delete", { p_token: saToken(), p_id: b.id }).then((r) => { say(r && r.ok ? "Блок удалён." : conceptErr(r && r.error)); return reload(); }).finally(() => setBusy(false));
  };
  const notify = () => {
    if (busy) return;
    vibrate("light"); setBusy(true); say("");
    rpc("concept_notify", { p_token: saToken(), p_scope: sc }).then((r) => {
      if (!r || !r.ok) { say(conceptErr(r && r.error)); return; }
      say(!r.bot ? "Бот не подключён: сообщение не ушло. Команда увидит отметку «новое» в «Команде»."
        : r.sent ? "Сообщение ушло: " + r.sent + " из " + r.people + ". Остальным сегодня уже писали или у них выключены напоминания."
        : "Сегодня всем уже писали или у них выключены напоминания. Команда увидит отметку «новое» в «Команде».");
    }).finally(() => setBusy(false));
  };
  const openBlock = (b) => { vibrate("light"); setMsg(""); setEdit({ ...b }); };

  if (edit) return <BlockEditor T={T} a11y={a11y} c={c} block={edit} head={head} ghost={ghost} main={main} h={h} where={scope === "net" ? "Вся сеть" : venueName}
    onClose={(saved, text) => { setEdit(null); if (saved) { say(text || "Сохранено. Команда увидит после «Сообщить команде» или сама, с отметкой «новое»."); reload(); } }} />;

  const field = { width: "100%", boxSizing: "border-box", padding: "10px 12px", borderRadius: 12, border: "1px solid " + c.line, background: c.field, color: T.modTitle.color, fontFamily: SERIF, fontSize: 14, outline: "none" };
  // все заведения сети: своё первым, потом список приложения, потом что знает сервер
  const venueList = [...new Set([mine, ...RESTAURANTS, ...(data.venues || [])].filter(Boolean))];
  const tab = (on) => ({ flex: 1, minWidth: 0, padding: "8px 10px", borderRadius: 999, border: "none", cursor: "pointer", fontFamily: SERIF, fontSize: 13.5,
    whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", background: on ? "linear-gradient(180deg,#E4C88C," + GOLD + ")" : "transparent",
    color: on ? "#1A1008" : c.soft, fontWeight: on ? "bold" : "normal" });
  const count = (n) => <span data-cn-tabn={n} style={{ fontWeight: "normal", opacity: 0.8 }}>{" · " + n}</span>;
  const busyPanel = pick || doc || restyle;
  const docDone = (where, text) => { setDoc(false); if (where !== scope) setScope(where); say(text); reload(); };

  return (
    <div style={T.screen} className="sa-screen" data-about="edit" data-cn-scope={scope}>
      {head("Концепция и стандарты")}
      <div style={{ flex: 1, padding: "14px 16px 28px" }}>
        {can.net ? (
          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 12.5, color: c.soft, marginBottom: 6 }}>Заведение для правки</div>
            <select data-lens-field="" data-cn-rest={venueList.length} value={venueName} onChange={(e) => onRest(e.target.value)} style={field}>
              {venueList.map((v) => <option key={v} value={v}>{v}</option>)}
            </select>
          </div>) : null}
        <div role="tablist" aria-label="Что правим" data-cn-tabs="" data-lens-seg="" style={{ display: "flex", gap: 2, padding: 3, marginBottom: 12, borderRadius: 999,
          border: "1px solid " + c.line, background: c.chip }}>
          {can.net ? <button type="button" role="tab" aria-selected={scope === "net"} data-cn-tab="net" data-lens-btn={scope === "net" ? "tab" : undefined} style={tab(scope === "net")} onClick={() => { setScope("net"); setMsg(""); setDoc(false); setRestyle(false); setPick(false); }}>Вся сеть{count(nNet)}</button> : null}
          {can.venue ? <button type="button" role="tab" aria-selected={scope === "venue"} data-cn-tab="venue" data-lens-btn={scope === "venue" ? "tab" : undefined} style={tab(scope === "venue")} onClick={() => { setScope("venue"); setMsg(""); setDoc(false); setRestyle(false); setPick(false); }}>{venueName || "Заведение"}{count(nVen)}</button> : null}
        </div>
        <div style={{ fontSize: 12.5, color: c.soft, lineHeight: 1.5, marginBottom: 12 }}>{scope === "net" ? "Общее для всех заведений: видят все сотрудники сети." : "Только для «" + venueName + "»: сотрудники видят это под общей частью сети."} Каждый блок становится уроком раздела в начале каждого трека, а вопросы блоков собираются в его тест.</div>

        <SectionCard T={T} c={c} ghost={ghost} main={main} field={field} data={data} scope={scope} venueName={venueName} canHere={canHere}
          onSaved={(t) => { say(t); reload(); }} onOpenSection={onOpenSection} />

        {blocks.map((b, i) => {
          const lead = leadOf(b.body);
          return (
            <div key={b.id} data-lens-card="" data-cn-row={b.kind} style={{ ...T.modCard, display: "block", padding: "10px 12px", marginBottom: 10, cursor: "default" }}>
              <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                <div data-cn-rowtap="" onClick={() => openBlock(b)} style={{ flex: 1, minWidth: 0, display: "flex", gap: 10, cursor: "pointer" }}>
                  <span style={{ marginTop: 3 }}><KindIcon kind={b.kind} /></span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontFamily: TITLE, fontSize: 16.5, color: T.modTitle.color, lineHeight: 1.3 }}>{b.title}</div>
                    <div style={{ fontSize: 12, color: c.soft, marginTop: 2 }}>{kindOf(b.kind).title !== b.title ? kindOf(b.kind).title + " · " : ""}для кого: {forWhom(b)}{b.photos.length ? " · фото: " + b.photos.length : ""}{b.questions.length ? " · вопросов: " + b.questions.length : ""}</div>
                    {lead ? <div data-cn-lead="" style={{ fontSize: 12.5, color: T.modTitle.color, opacity: 0.78, marginTop: 5, lineHeight: 1.45, fontFamily: SERIF, fontStyle: "italic" }}>{lead}</div> : null}
                  </div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                  <button type="button" aria-label="Выше" data-lens-btn="soft" disabled={busy || i === 0} onClick={() => move(i, -1)} style={{ ...ghost, padding: "2px 9px", opacity: i === 0 ? 0.35 : 1 }}>↑</button>
                  <button type="button" aria-label="Ниже" data-lens-btn="soft" disabled={busy || i === blocks.length - 1} onClick={() => move(i, 1)} style={{ ...ghost, padding: "2px 9px", opacity: i === blocks.length - 1 ? 0.35 : 1 }}>↓</button>
                </div>
              </div>
              <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                <button type="button" data-lens-btn="soft" data-cn-open={b.kind} style={ghost} onClick={() => openBlock(b)}>Править</button>
                {delAsk === b.id
                  ? <><button type="button" data-lens-btn="soft" data-cn-delyes="" style={{ ...ghost, color: c.warn, borderColor: c.warn }} onClick={() => del(b)}>Удалить блок</button>
                      <button type="button" data-lens-btn="soft" style={ghost} onClick={() => setDelAsk(null)}>Не надо</button></>
                  : <button type="button" data-lens-btn="soft" data-cn-del="" style={ghost} onClick={() => setDelAsk(b.id)}>Удалить</button>}
              </div>
            </div>);
        })}

        {!blocks.length && !busyPanel ? (
          <div data-lens-card="" data-cn-empty="" style={{ ...T.modCard, display: "block", padding: "14px 16px", marginBottom: 10, cursor: "default" }}>
            <div style={{ fontFamily: TITLE, fontSize: 17, color: T.modTitle.color }}>Пока пусто.</div>
            <div style={{ ...T.para, marginTop: 4 }}>{canHere ? "Быстрее всего начать с документа: PDF, Word или текст. Помощник разложит его по блокам и оформит каждый как наши уроки, с вопросами для теста." : "Блоков здесь пока нет."}</div>
          </div>) : null}

        {canHere && !busyPanel ? <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {blocks.length ? <>
            <button type="button" data-lens-btn="main" data-cn-add="" style={{ ...main, flex: "1 1 180px" }} onClick={() => { vibrate("light"); setPick(true); setMsg(""); }}>Добавить блок</button>
            <button type="button" data-lens-btn="soft" data-cn-doc="" style={{ ...ghost, flex: "1 1 140px", padding: "11px 14px" }} onClick={() => { vibrate("light"); setDoc(true); setMsg(""); }}>Из документа</button>
            <button type="button" data-lens-btn="soft" data-cn-restyle-go="" style={{ ...ghost, flex: "1 1 100%", padding: "10px 14px" }} onClick={() => { vibrate("light"); setRestyle(true); setMsg(""); }}>Оформить всё как в уроках</button>
          </> : <>
            <button type="button" data-lens-btn="main" data-cn-doc="" style={{ ...main, flex: "1 1 180px" }} onClick={() => { vibrate("light"); setDoc(true); setMsg(""); }}>Из документа</button>
            <button type="button" data-lens-btn="soft" data-cn-add="" style={{ ...ghost, flex: "1 1 140px", padding: "11px 14px" }} onClick={() => { vibrate("light"); setPick(true); setMsg(""); }}>Добавить блок</button>
          </>}
        </div> : null}

        {pick ? <>
          {h("Какой блок", <button type="button" data-lens-btn="soft" style={{ ...ghost, padding: "3px 10px", fontSize: 12 }} onClick={() => setPick(false)}>Отмена</button>)}
          <div data-cn-kinds="" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            {CN_KINDS.map((k) => {
              const has = k.kind !== "own" && blocks.some((b) => b.kind === k.kind);
              return (
                <button key={k.kind} type="button" data-cn-kind={k.kind} data-lens-opt="" onClick={() => { vibrate("light"); setPick(false); setEdit(blankBlock(k.kind, sc)); }}
                  style={{ textAlign: "left", padding: "10px 12px", borderRadius: 14, border: "1px solid " + (has ? c.line : GOLD + "66"), background: c.chip, cursor: "pointer", opacity: has ? 0.7 : 1 }}>
                  <div style={{ display: "flex", gap: 6, alignItems: "center" }}><KindIcon kind={k.kind} s={15} />
                    <span style={{ fontFamily: SERIF, fontWeight: "bold", fontSize: 13.5, color: T.modTitle.color, lineHeight: 1.3 }}>{k.title}</span></div>
                  <div style={{ fontSize: 11.5, color: c.soft, lineHeight: 1.35, marginTop: 3 }}>{has ? "Уже есть, можно второй" : k.hint}</div>
                </button>);
            })}
          </div>
        </> : null}

        {doc ? <ConceptImport T={T} a11y={a11y} c={c} ghost={ghost} main={main} field={field} data={data} scope={scope} venueName={venueName}
          onDone={docDone} onCancel={() => setDoc(false)} /> : null}
        {restyle ? <ConceptRestyle T={T} a11y={a11y} c={c} ghost={ghost} main={main} blocks={blocks}
          onDone={(t) => { setRestyle(false); say(t); reload(); }} onCancel={() => setRestyle(false)} /> : null}

        {blocks.length && canHere && !busyPanel ? <>
          {h("Команде")}
          <div data-lens-card="" style={{ ...T.modCard, display: "block", padding: "10px 14px", cursor: "default" }}>
            <div style={{ fontSize: 12.5, color: c.soft, lineHeight: 1.5 }}>{scope === "net" ? "Сообщение всем сотрудникам сети" : "Сообщение сотрудникам «" + venueName + "»"} в Telegram и на телефон, не чаще раза в день. У кого не дошло, увидят отметку «новое».</div>
            <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
              <button type="button" data-lens-btn="soft" data-cn-notify="" style={ghost} disabled={busy} onClick={notify}>{busy ? "Минуту…" : "Сообщить команде"}</button>
            </div>
            {/* v192 (Доп. 517): лист ознакомления — у каждого дата отметки, PDF для отдела кадров; раздел целиком в PDF */}
            {venueName ? <AcksPanel T={T} c={c} ghost={ghost} data={data} venueName={venueName} /> : null}
          </div>
        </> : null}
        {/* v192: удалённые блоки этой части — можно вернуть */}
        {canHere && !busyPanel ? <GonePanel key={scope + "|" + blocks.length} T={T} c={c} ghost={ghost} scope={sc} onRestored={(t) => { say(t); reload(); }} /> : null}
        {msg ? <div role="status" data-cn-msg="" style={{ fontSize: 13, color: T.modTitle.color, lineHeight: 1.5, marginTop: 10 }}>{msg}</div> : null}
      </div>
    </div>);
}

// ── Один блок: вид, заголовок, текст, фото, «для кого», вопросы теста ──
// v191: разметка уроков — кнопками (lib/lesson-look.js, markLines); «Текст / Как в уроке»; «Оформить как урок» (помощник, смысл тот же, «Вернуть»)
function BlockEditor({ T, a11y, c, block, head, ghost, main, h, where, onClose }) {
  const [b, setB] = React.useState(() => ({ ...block, photos: [...(block.photos || [])], tracks: [...(block.tracks || [])], questions: (block.questions || []).map((q) => ({ ...q, options: [...q.options] })) }));
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState("");
  const [ai, setAi] = React.useState("");   // "questions" | "improve" — помощник думает
  const [up, setUp] = React.useState(0);   // сколько фото загружается
  const [view, setView] = React.useState("text");   // v191: "text" | "look"
  const [undo, setUndo] = React.useState(null);     // v191: текст до «Оформить как урок»
  const [hist, setHist] = React.useState(false);    // v192: история блока
  const taRef = React.useRef(null);
  const k = kindOf(b.kind);
  const patch = (p) => setB((x) => ({ ...x, ...p }));
  const field = { width: "100%", boxSizing: "border-box", padding: "10px 12px", borderRadius: 12, border: "1px solid " + c.line, background: c.field, color: T.modTitle.color, fontFamily: SERIF, fontSize: 14, outline: "none" };

  // кнопки разметки — как в редакторе уроков: с выделением в поле текста
  const fmt = (kind) => {
    if (view !== "text") setView("text");
    const ta = taRef.current; const v = b.body || "";
    const s = ta ? ta.selectionStart : v.length, e = ta ? ta.selectionEnd : v.length;
    const r = markLines(v, s, e, kind);
    patch({ body: r.v.slice(0, CN_LIMITS.body) });
    requestAnimationFrame(() => { const t = taRef.current; if (t) { t.focus(); try { t.setSelectionRange(r.s, r.e); } catch (x) { /* */ } } });
  };
  const addPhotos = async (files) => {
    const list = Array.from(files || []).slice(0, CN_LIMITS.photos - b.photos.length);
    if (!list.length) return;
    setErr("");
    for (const f of list) {
      setUp((n) => n + 1);
      try {
        const ph = await compressPhoto(f);
        const r = await rpc("concept_photo_put", { p_token: saToken(), p_scope: b.scope || "", p_full: ph.full, p_thumb: ph.thumb, p_w: ph.w, p_h: ph.h });
        if (r && r.ok && r.id) { conceptPhotoRemember(r.id, ph.thumbUrl, ph.fullUrl); setB((x) => ({ ...x, photos: [...x.photos, { id: r.id, cap: "" }].slice(0, CN_LIMITS.photos) })); }
        else setErr(conceptErr(r && r.error));
      } catch (e) { setErr(e && e.message === "type" ? "Это не фото." : "Фото не получилось сжать. Попробуй другое."); }
      setUp((n) => n - 1);
    }
  };
  const toggleTrack = (t) => setB((x) => ({ ...x, tracks: x.tracks.includes(t) ? x.tracks.filter((y) => y !== t) : [...x.tracks, t] }));
  const setQ = (i, p) => setB((x) => ({ ...x, questions: x.questions.map((q, j) => (j === i ? { ...q, ...p } : q)) }));
  const think = async (mode) => {
    if (ai || (b.body || "").trim().length < 40) { if (!ai) setErr("Сначала текст: хотя бы пара предложений."); return; }
    setAi(mode); setErr("");
    // v191: «Оформить как урок» — режим concept_style (вид уроков, смысл и факты те же); вопросы — как раньше
    const r = mode === "improve" ? await askAI("concept_style", { kind: b.kind, title: b.title, text: b.body })
      : await askAI(mode, { role: b.tracks[0] || "seasonal", title: b.title, text: b.body });
    setAi("");
    if (!r.ok) { setErr(r.error); return; }
    if (mode === "improve" && (r.body || r.content)) { setUndo(b.body); patch({ body: lessonize(String(r.body || r.content)).slice(0, CN_LIMITS.body) }); setView("look"); }
    if (mode === "questions") {
      const add = (r.questions || []).map(cleanQuestion).filter(Boolean);
      setB((x) => ({ ...x, questions: [...x.questions, ...add].slice(0, CN_LIMITS.questions) }));
    }
  };
  const save = () => {
    const nb = { ...b, body: lessonize(b.body || "") };   // v191: в базу — уже разметкой уроков
    const prob = blockProblem(nb);
    if (prob) { setErr(prob); return; }
    const bad = b.questions.filter((q) => !cleanQuestion(q)).length;
    if (bad) { setErr("Вопрос без текста, без вариантов или без верного ответа: допиши или удали его."); return; }
    if (busy || up) return;
    vibrate("light"); setBusy(true); setErr("");
    rpc("concept_save", { p_token: saToken(), p_block: blockPayload(nb) }).then((r) => {
      setBusy(false);
      if (r && r.ok) onClose(true); else setErr(conceptErr(r && r.error));
    }).catch(() => { setBusy(false); setErr("Нет связи. Попробуй ещё раз."); });
  };
  const fb = { ...ghost, padding: "5px 11px", fontSize: 12.5 };
  const fbi = { ...fb, display: "inline-flex", alignItems: "center", gap: 5 };
  const info = lookInfo(lessonize(b.body || ""));
  const tip = !info.words ? "" : !info.lead ? "Начни с главной мысли в 1–2 предложения: урок покажет её крупно."
    : info.cards === 1 && info.words > 220 ? "Раздели текст на части подзаголовками или пустой строкой: урок листается карточками."
    : !info.pins && info.words > 120 ? "В конце добавь вывод кнопкой «Вывод»: так заканчиваются наши уроки." : "";
  return (
    <div style={T.screen} className="sa-screen" data-about="block" data-cn-kind-edit={b.kind}>
      {head(b.id ? "Блок" : "Новый блок", null, () => onClose(false))}
      <div style={{ flex: 1, padding: "14px 16px 28px" }}>
        <div style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 12.5, color: c.soft, marginBottom: 10 }}><KindIcon kind={b.kind} s={16} /><span>{where} · {k.title}{k.kind !== "own" ? ": " + k.hint.toLowerCase() : ""}</span></div>
        {h("Заголовок")}
        <input data-lens-field="" data-cn-title="" value={b.title} maxLength={CN_LIMITS.title} onChange={(e) => patch({ title: e.target.value })} placeholder={k.kind === "own" ? "Например, «Музыка в зале»" : k.title} style={field} />
        {h("Текст")}
        <div style={{ marginBottom: 8 }}><Seg c={c} label="Текст или как в уроке" mark="data-cn-view" value={view} onPick={setView} items={[["text", "Текст"], ["look", "Как в уроке"]]} /></div>
        <div data-cn-tools="" style={{ display: "flex", gap: 6, marginBottom: 6, flexWrap: "wrap" }}>
          <button type="button" data-lens-btn="soft" aria-label="Жирный" style={{ ...fb, fontWeight: "bold" }} onClick={() => fmt("bold")}>Ж</button>
          <button type="button" data-lens-btn="soft" style={fb} onClick={() => fmt("head")}>Заголовок</button>
          <button type="button" data-lens-btn="soft" style={fb} onClick={() => fmt("list")}>• Список</button>
          <button type="button" data-lens-btn="soft" data-cn-mk="steps" style={fbi} onClick={() => fmt("steps")}><span aria-hidden="true" style={{ width: 16, height: 16, borderRadius: 8, border: "1.3px solid " + GOLD, color: GOLD, display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 10.5, fontWeight: "bold" }}>1</span>Шаги</button>
          <button type="button" data-lens-btn="soft" data-cn-mk="good" style={fbi} onClick={() => fmt("good")}>{UI_SVG.checkCircle(GREEN, 13)}Как надо</button>
          <button type="button" data-lens-btn="soft" data-cn-mk="ban" style={fbi} onClick={() => fmt("ban")}>{UI_SVG.ban(RED, 13)}Нельзя</button>
          <button type="button" data-lens-btn="soft" data-cn-mk="pin" style={fbi} onClick={() => fmt("pin")}>{UI_SVG.pin(GOLD, 13)}Вывод</button>
          <button type="button" data-lens-btn="soft" data-cn-mk="quote" style={fb} onClick={() => fmt("quote")}>«Фраза гостю»</button>
        </div>
        {view === "text"
          ? <textarea ref={taRef} data-lens-field="" data-cn-body="" rows={10} value={b.body} maxLength={CN_LIMITS.body} onChange={(e) => patch({ body: e.target.value })}
              placeholder={k.hint + ". Начни с главной мысли, дальше части с подзаголовками."} style={{ ...field, resize: "vertical", lineHeight: 1.5 }} />
          : <div data-cn-look="">{(b.body || "").trim() ? <LessonLook text={lessonize(b.body)} T={T} title={b.title} cards compact /> : <div style={{ ...T.para, padding: "8px 2px" }}>Пока нет текста.</div>}</div>}
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginTop: 6 }}>
          <span data-cn-info={info.words + "/" + info.cards} style={{ fontSize: 12, color: c.soft }}>{info.words ? info.words + " " + plural(info.words, "слово", "слова", "слов") + " · " + info.cards + " " + plural(info.cards, "карточка", "карточки", "карточек") : ""}</span>
          {undo != null ? <button type="button" data-lens-btn="soft" data-cn-undo="" style={{ ...fb, padding: "4px 10px" }} onClick={() => { patch({ body: undo }); setUndo(null); }}>Вернуть как было</button> : null}
          <button type="button" data-lens-btn="soft" style={{ ...fb, marginLeft: "auto" }} disabled={!!ai} data-cn-improve="" onClick={() => think("improve")}>{ai === "improve" ? "Оформляю…" : "Оформить как урок"}</button>
        </div>
        {tip ? <div data-cn-tip="" style={{ fontSize: 12, color: c.soft, lineHeight: 1.45, marginTop: 4, fontStyle: "italic" }}>{tip}</div> : null}

        {k.photo || b.photos.length ? <>
          {h("Фото", <span style={{ fontSize: 12, color: c.soft }}>{b.photos.length} из {CN_LIMITS.photos}</span>)}
          {b.photos.map((p, i) => (
            <div key={p.id} data-cn-ph={p.id} style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8 }}>
              <div style={{ width: 72, flex: "0 0 auto" }}><ConceptPhotos photos={[{ id: p.id, cap: "" }]} a11y={a11y} h={52} /></div>
              <input data-lens-field="" value={p.cap} maxLength={CN_LIMITS.cap} placeholder="Подпись: что на фото" onChange={(e) => setB((x) => ({ ...x, photos: x.photos.map((y, j) => (j === i ? { ...y, cap: e.target.value } : y)) }))} style={{ ...field, flex: 1 }} />
              <button type="button" aria-label="Убрать фото" data-lens-x="" style={{ ...fb, padding: "5px 9px", position: "relative" }} onClick={() => setB((x) => ({ ...x, photos: x.photos.filter((_, j) => j !== i) }))}>×</button>
            </div>))}
          {b.photos.length < CN_LIMITS.photos ? <label data-lens-btn="soft" style={{ ...ghost, display: "inline-block", cursor: "pointer" }} data-cn-addph="">{up ? "Загружаю фото…" : "Добавить фото"}
            <input type="file" accept="image/*" multiple style={{ display: "none" }} onChange={(e) => { addPhotos(e.target.files); e.target.value = ""; }} /></label> : null}
        </> : null}

        {h("Для кого", <span style={{ fontSize: 12, color: c.soft }}>{b.tracks.length ? "" : "все треки"}</span>)}
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }} data-cn-tracks={b.tracks.join(",")}>
          {TRACKS.map((t) => { const on = b.tracks.includes(t.id); return (
            <button key={t.id} type="button" aria-pressed={on} data-cn-track={t.id} data-lens-btn={on ? "tab" : "soft"} onClick={() => toggleTrack(t.id)}
              style={{ ...fb, borderColor: on ? GOLD : c.line, background: on ? GOLD + "33" : c.chip, fontWeight: on ? "bold" : "normal" }}>{t.label}</button>); })}
        </div>
        <div style={{ fontSize: 12, color: c.soft, marginTop: 4 }}>Ничего не выбрано: блок видят все. Выбрал треки: только они, в «О нас» и в разделе обучения.</div>

        {h("Вопросы теста", <span style={{ fontSize: 12, color: c.soft }}>{b.questions.length} из {CN_LIMITS.questions}</span>)}
        <div style={{ fontSize: 12, color: c.soft, marginBottom: 6 }}>Из них раздел обучения собирает тест; вопросы попадают и в вопрос дня, и в брифинг.</div>
        {b.questions.map((q, i) => (
          <div key={i} data-cn-q={i} data-lens-edge="" style={{ border: "1px solid " + c.line, borderRadius: 14, padding: "8px 10px", marginBottom: 8 }}>
            <textarea data-lens-field="" rows={2} value={q.q} maxLength={400} placeholder="Вопрос" onChange={(e) => setQ(i, { q: e.target.value })} style={{ ...field, resize: "vertical" }} />
            {q.options.map((o, j) => (
              <div key={j} style={{ display: "flex", gap: 6, alignItems: "center", marginTop: 6 }}>
                <button type="button" aria-label={q.correct === j ? "Верный ответ" : "Сделать верным"} aria-pressed={q.correct === j} data-cn-right={q.correct === j ? "1" : "0"} onClick={() => setQ(i, { correct: j })}
                  style={{ flexShrink: 0, width: 26, height: 26, borderRadius: "50%", border: "2px solid " + (q.correct === j ? c.ok : c.line), background: q.correct === j ? c.ok : "transparent",
                    cursor: "pointer", display: "grid", placeItems: "center", padding: 0 }}>{q.correct === j ? <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={a11y ? "#fff" : "#1A1008"} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg> : null}</button>
                <input data-lens-field="" value={o} maxLength={200} placeholder={"Вариант " + (j + 1)} onChange={(e) => setQ(i, { options: q.options.map((y, m) => (m === j ? e.target.value : y)) })} style={{ ...field, flex: 1, padding: "7px 10px", border: "1px solid " + (q.correct === j ? c.ok + "88" : c.line) }} />
                {q.options.length > 2 ? <button type="button" aria-label="Убрать вариант" data-lens-x="" style={{ ...fb, padding: "4px 8px", position: "relative" }} onClick={() => setQ(i, { options: q.options.filter((_, m) => m !== j), correct: q.correct === j ? 0 : q.correct > j ? q.correct - 1 : q.correct })}>×</button> : null}
              </div>))}
            <input data-lens-field="" value={q.explanation || ""} maxLength={500} placeholder="Пояснение: почему верно" onChange={(e) => setQ(i, { explanation: e.target.value })} style={{ ...field, marginTop: 6, padding: "7px 10px", fontSize: 13 }} />
            <div style={{ display: "flex", gap: 6, marginTop: 6, alignItems: "center", flexWrap: "wrap" }}>
              {q.options.length < 4 ? <button type="button" data-lens-btn="soft" style={fb} onClick={() => setQ(i, { options: [...q.options, ""] })}>Ещё вариант</button> : null}
              <span style={{ fontSize: 11.5, color: c.soft }}>зелёный кружок: верный ответ</span>
              <button type="button" data-lens-btn="soft" style={{ ...fb, marginLeft: "auto" }} onClick={() => setB((x) => ({ ...x, questions: x.questions.filter((_, m) => m !== i) }))}>Удалить вопрос</button>
            </div>
          </div>))}
        {b.questions.length < CN_LIMITS.questions ? <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button type="button" data-lens-btn="soft" style={ghost} data-cn-qadd="" onClick={() => setB((x) => ({ ...x, questions: [...x.questions, { q: "", options: ["", ""], correct: 0, explanation: "" }] }))}>Добавить вопрос</button>
          <button type="button" data-lens-btn="soft" style={ghost} data-cn-qai="" disabled={!!ai} onClick={() => think("questions")}>{ai === "questions" ? "Придумываю…" : "Придумать вопросы"}</button>
        </div> : null}

        {/* v192 (Доп. 517): прежние версии блока — посмотреть, что поменялось, и вернуть */}
        {b.id ? (hist
          ? <HistoryPanel T={T} c={c} ghost={ghost} block={block} onClose={() => setHist(false)} onReverted={(nb, text) => onClose(true, text)} />
          : <button type="button" data-lens-btn="soft" data-cn-hist="" style={{ ...ghost, marginTop: 14 }} onClick={() => { vibrate("light"); setHist(true); }}>История блока</button>) : null}
        {err ? <div role="status" data-cn-err="" style={{ fontSize: 13, color: c.warn, lineHeight: 1.5, marginTop: 12 }}>{err}</div> : null}
        <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
          <button type="button" data-lens-btn="main" data-cn-save="" style={{ ...main, flex: 1 }} disabled={busy || !!up} onClick={save}>{busy ? "Сохраняю…" : up ? "Фото загружается…" : "Сохранить"}</button>
          <button type="button" data-lens-btn="soft" style={{ ...ghost, padding: "11px 16px" }} onClick={() => onClose(false)}>Отмена</button>
        </div>
      </div>
    </div>);
}
