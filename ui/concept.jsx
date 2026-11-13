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
import React from "react";
import { rpc, saToken, rpcMissing } from "../api/supabase";
import { vibrate } from "../lib/utils";
import { GOLD, labelStyle } from "./tokens";
import { TRACKS } from "../lib/tracks";
import { RESTAURANTS } from "../data/roles";
import { compressPhoto } from "../lib/chat-photo";
import { CN_KINDS, CN_LIMITS, kindOf, blockFor, conceptUnread, blankBlock, blockPayload, blockProblem, conceptErr, cleanQuestion, normConcept } from "../lib/concept";
import { typo } from "../lib/typo";
import { ConceptPhotos, conceptPhotoRemember } from "./concept-photo";

const P = (a11y) => (a11y
  ? { line: "rgba(139,106,48,0.22)", chip: "rgba(139,106,48,0.10)", soft: "#5C4A2A", warn: "#8B5A12", ok: "#2C6B48", field: "rgba(255,250,238,0.75)" }
  : { line: "rgba(214,178,102,0.18)", chip: "rgba(214,178,102,0.10)", soft: "rgba(232,215,180,0.72)", warn: "#E4B36A", ok: "#8AD8AF", field: "rgba(30,24,14,0.6)" });
const SERIF = "Georgia, 'Times New Roman', serif";
const TITLE = "'Piazzolla', Georgia, serif";
const trackLabel = (id) => (TRACKS.find((t) => t.id === id) || {}).label || id;
const forWhom = (b) => (b.tracks && b.tracks.length ? b.tracks.map(trackLabel).join(", ") : "Все");

// жирное внутри строки: «**Важно**: …»
const inline = (s, st) => (s.includes("**") ? s.split(/(\*\*[^*]+\*\*)/g).filter(Boolean).map((p, k) =>
  (p.startsWith("**") && p.endsWith("**") ? <b key={k} style={{ fontWeight: "bold", color: st && st.color }}>{p.slice(2, -2)}</b> : <React.Fragment key={k}>{p}</React.Fragment>)) : s);

/** Текст блока: строки как в уроках — заголовок в звёздочках, «• » список, «ёлочки» — фраза гостю. */
export function BlockText({ text, T }) {
  return (<div>{String(text || "").split("\n").map((ln, i) => {
    const t = typo(ln.trim());   // v150 (Доп. 474): неразрывные пробелы, как в уроках
    if (!t) return <div key={i} style={{ height: 8 }} />;
    if (/^\*\*[^*]+\*\*$/.test(t)) return <div key={i} style={{ ...T.bold, marginTop: 6 }}>{t.slice(2, -2)}</div>;
    if (t.startsWith("• ")) return <div key={i} style={T.bullet}>{inline(t, T.bullet)}</div>;
    if (/^«.+»$/.test(t)) return <div key={i} style={{ ...T.para, fontStyle: "italic", borderLeft: "2px solid " + GOLD, paddingLeft: 10 }}>{t}</div>;
    return <div key={i} style={T.para}>{inline(t, T.para)}</div>;
  })}</div>);
}

function BlockCard({ b, T, a11y, c, lead, where }) {
  return (
    <div data-lens-card="" data-cn-block={b.kind} data-cn-id={b.id} style={{ ...T.modCard, display: "block", padding: "12px 14px", marginBottom: 12, cursor: "default" }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
        <div style={{ flex: 1, fontFamily: TITLE, fontSize: 17.5, color: T.modTitle.color, lineHeight: 1.3 }}>{b.title}</div>
        {where ? <span style={{ fontSize: 11.5, color: c.soft, whiteSpace: "nowrap" }}>{where}</span> : null}
      </div>
      {lead && b.tracks.length ? <div style={{ fontSize: 11.5, color: c.soft, marginTop: 2 }}>Для кого: {forWhom(b)}</div> : null}
      {b.body ? <div style={{ marginTop: 6 }}><BlockText text={b.body} T={T} /></div> : null}
      <ConceptPhotos photos={b.photos} a11y={a11y} />
    </div>);
}

// ── Помощник (тот же, что у редактора уроков: /api/lesson-assist) ──
async function askAI(mode, payload) {
  try {
    const r = await fetch("/api/lesson-assist", { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: saToken(), mode, ...payload }) });
    const d = await r.json().catch(() => null);
    if (d && d.ok) return d;
    return { ok: false, error: (d && d.error) || (r.status === 404 ? "Помощник ещё не развёрнут на Vercel (функция /api/lesson-assist)." : "Помощник не ответил. Попробуй ещё раз.") };
  } catch (e) { return { ok: false, error: "Нет связи с помощником." }; }
}

export function AboutScreen({ T, a11y, profile, role, concept, onRaw, onBack, startEdit = false }) {
  const c = P(a11y);
  const lead = !!(profile && (profile.is_admin || ["manager", "senior"].includes(profile.position)));
  const [mode, setMode] = React.useState(startEdit && lead ? "edit" : "view");
  const [data, setData] = React.useState(concept || null);   // что на экране (у сети — может быть другое заведение)
  const [phase, setPhase] = React.useState(concept ? "ready" : "load");
  const [rest, setRest] = React.useState("");   // заведение, которое правит сеть ("" — своё)
  const [busy, setBusy] = React.useState(false);
  const [msg, setMsg] = React.useState("");
  const [openOther, setOpenOther] = React.useState(null);
  const mine = (concept && concept.mine) || (profile && profile.restaurant) || "";

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
    Promise.all(jobs).then(() => load("")).finally(() => setBusy(false));
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
      onRest={(r) => { setRest(r === mine ? "" : r); setPhase("load"); load(r === mine ? "" : r); }} reload={() => load()} />;
  }

  const empty = d && !d.net.blocks.length && !(d.venue && d.venue.blocks.length);
  const show = (arr) => (arr || []).filter((b) => lead || blockFor(b, role));
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
        {d && show(d.net.blocks).length ? <>{h("Вся сеть")}{show(d.net.blocks).map((b) => <BlockCard key={b.id} b={b} T={T} a11y={a11y} c={c} lead={lead} />)}</> : null}
        {d && d.venue && show(d.venue.blocks).length ? <>{h(d.venue.name)}{show(d.venue.blocks).map((b) => <BlockCard key={b.id} b={b} T={T} a11y={a11y} c={c} lead={lead} />)}</> : null}
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
        {d && unread.any ? (
          <button type="button" data-lens-btn="main" data-cn-read="" style={{ ...main, marginTop: 6 }} disabled={busy} onClick={markRead}>{busy ? "Минуту…" : "Прочитал(а)"}</button>) : null}
        {d && !empty && !unread.any && (d.net.ver || (d.venue && d.venue.ver)) ? <div data-cn-readok="" style={{ fontSize: 12.5, color: c.soft, textAlign: "center", marginTop: 6 }}>Всё прочитано. Обновят, придёт сообщение.</div> : null}
        {msg ? <div role="status" style={{ fontSize: 12.5, color: T.modTitle.color, marginTop: 8 }}>{msg}</div> : null}
      </div>
    </div>);
}

// ── Редактор: блоки сети или заведения ──
function ConceptEditor({ T, a11y, c, data, mine, rest, head, ghost, main, h, onRest, reload }) {
  const can = data.can;
  const venueName = data.venue ? data.venue.name : rest || mine;
  const [scope, setScope] = React.useState(can.venue ? "venue" : "net");   // "net" | "venue"
  const [edit, setEdit] = React.useState(null);   // блок в правке
  const [pick, setPick] = React.useState(false);   // выбор вида нового блока
  const [doc, setDoc] = React.useState(null);   // «Из документа»: { text, pdf, busy, err, blocks, picked }
  const [busy, setBusy] = React.useState(false);
  const [msg, setMsg] = React.useState("");
  const [reads, setReads] = React.useState(null);
  const [delAsk, setDelAsk] = React.useState(null);
  const sc = scope === "net" ? "" : venueName;
  const blocks = (scope === "net" ? data.net.blocks : (data.venue ? data.venue.blocks : [])).slice().sort((a, b) => (a.sort - b.sort) || (a.id - b.id));
  const canHere = scope === "net" ? can.net : can.venue;

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
  const loadReads = () => {
    vibrate("light");
    rpc("concept_reads", { p_token: saToken(), p_restaurant: venueName || null }).then((r) => setReads(r && r.ok ? r : { ok: false })).catch(() => setReads({ ok: false }));
  };

  if (edit) return <BlockEditor T={T} a11y={a11y} c={c} block={edit} head={head} ghost={ghost} main={main} h={h} where={scope === "net" ? "Вся сеть" : venueName}
    onClose={(saved) => { setEdit(null); if (saved) { say("Сохранено. Команда увидит после «Сообщить команде» или сама, с отметкой «новое»."); reload(); } }} />;

  const addDoc = async () => {
    const list = (doc.blocks || []).filter((_, i) => doc.picked[i]);
    if (!list.length || busy) return;
    setBusy(true);
    let ok = 0, err = "";
    for (const b of list) {
      const r = await rpc("concept_save", { p_token: saToken(), p_block: blockPayload({ ...blankBlock(b.kind, sc), title: b.title || kindOf(b.kind).title, body: b.body }) }).catch(() => null);
      if (r && r.ok) ok++; else err = conceptErr(r && r.error);
    }
    setBusy(false); setDoc(null);
    say(ok ? "Добавлено блоков: " + ok + (err ? ". Остальные: " + err : ".") : err);
    reload();
  };
  const runDoc = async () => {
    setDoc((x) => ({ ...x, busy: true, err: "" }));
    const r = await askAI("concept", { role: "seasonal", title: sc || "Вся сеть", text: doc.text || "", pdfBase64: doc.pdf ? doc.pdf.b64 : "" });
    if (!r.ok) { setDoc((x) => ({ ...x, busy: false, err: r.error })); return; }
    const bl = (r.blocks || []).filter((b) => b && kindOf(b.kind).kind === b.kind && (b.body || "").trim());
    setDoc((x) => ({ ...x, busy: false, blocks: bl, picked: Object.fromEntries(bl.map((_, i) => [i, true])) }));
  };
  const pdfPick = (file) => {
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) { setDoc((x) => ({ ...x, err: "PDF больше 10 МБ. Сократи его или вставь текст." })); return; }
    const fr = new FileReader();
    fr.onload = () => setDoc((x) => ({ ...x, pdf: { name: file.name, b64: String(fr.result).split(",")[1] }, err: "" }));
    fr.readAsDataURL(file);
  };
  const field = { width: "100%", boxSizing: "border-box", padding: "10px 12px", borderRadius: 12, border: "1px solid " + c.line, background: c.field, color: T.modTitle.color, fontFamily: SERIF, fontSize: 14, outline: "none" };
  // все заведения сети: своё первым, потом список приложения, потом что знает сервер
  const venueList = [...new Set([mine, ...RESTAURANTS, ...(data.venues || [])].filter(Boolean))];
  const tab = (on) => ({ flex: 1, minWidth: 0, padding: "8px 10px", borderRadius: 999, border: "none", cursor: "pointer", fontFamily: SERIF, fontSize: 13.5,
    whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", background: on ? "linear-gradient(180deg,#E4C88C," + GOLD + ")" : "transparent",
    color: on ? "#1A1008" : c.soft, fontWeight: on ? "bold" : "normal" });

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
          {can.net ? <button type="button" role="tab" aria-selected={scope === "net"} data-cn-tab="net" data-lens-btn={scope === "net" ? "tab" : undefined} style={tab(scope === "net")} onClick={() => { setScope("net"); setReads(null); setMsg(""); }}>Вся сеть</button> : null}
          {can.venue ? <button type="button" role="tab" aria-selected={scope === "venue"} data-cn-tab="venue" data-lens-btn={scope === "venue" ? "tab" : undefined} style={tab(scope === "venue")} onClick={() => { setScope("venue"); setReads(null); setMsg(""); }}>{venueName || "Заведение"}</button> : null}
        </div>
        <div style={{ fontSize: 12.5, color: c.soft, lineHeight: 1.5, marginBottom: 10 }}>{scope === "net" ? "Общее для всех заведений: видят все сотрудники сети." : "Только для «" + venueName + "»: сотрудники видят это под общей частью сети."} Блоки сразу попадают в раздел «Наш ресторан» в начале каждого трека: урок и тест по вопросам блоков.</div>

        {blocks.map((b, i) => (
          <div key={b.id} data-lens-card="" data-cn-row={b.kind} style={{ ...T.modCard, display: "block", padding: "10px 12px", marginBottom: 10, cursor: "default" }}>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: TITLE, fontSize: 16.5, color: T.modTitle.color, lineHeight: 1.3 }}>{b.title}</div>
                <div style={{ fontSize: 12, color: c.soft, marginTop: 2 }}>{kindOf(b.kind).title !== b.title ? kindOf(b.kind).title + " · " : ""}для кого: {forWhom(b)}{b.photos.length ? " · фото: " + b.photos.length : ""}{b.questions.length ? " · вопросов: " + b.questions.length : ""}</div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                <button type="button" aria-label="Выше" data-lens-btn="soft" disabled={busy || i === 0} onClick={() => move(i, -1)} style={{ ...ghost, padding: "2px 9px", opacity: i === 0 ? 0.35 : 1 }}>↑</button>
                <button type="button" aria-label="Ниже" data-lens-btn="soft" disabled={busy || i === blocks.length - 1} onClick={() => move(i, 1)} style={{ ...ghost, padding: "2px 9px", opacity: i === blocks.length - 1 ? 0.35 : 1 }}>↓</button>
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
              <button type="button" data-lens-btn="soft" data-cn-open={b.kind} style={ghost} onClick={() => { vibrate("light"); setMsg(""); setEdit({ ...b }); }}>Править</button>
              {delAsk === b.id
                ? <><button type="button" data-lens-btn="soft" data-cn-delyes="" style={{ ...ghost, color: c.warn, borderColor: c.warn }} onClick={() => del(b)}>Удалить блок</button>
                    <button type="button" data-lens-btn="soft" style={ghost} onClick={() => setDelAsk(null)}>Не надо</button></>
                : <button type="button" data-lens-btn="soft" data-cn-del="" style={ghost} onClick={() => setDelAsk(b.id)}>Удалить</button>}
            </div>
          </div>))}
        {!blocks.length ? <div style={{ ...T.para, textAlign: "center", padding: "10px 0 14px" }}>Пока пусто.</div> : null}

        {canHere && !pick && !doc ? <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button type="button" data-lens-btn="main" data-cn-add="" style={{ ...main, flex: "1 1 180px" }} onClick={() => { vibrate("light"); setPick(true); setMsg(""); }}>Добавить блок</button>
          <button type="button" data-lens-btn="soft" data-cn-doc="" style={{ ...ghost, flex: "1 1 140px", padding: "11px 14px" }} onClick={() => { setDoc({ text: "", pdf: null, busy: false, err: "", blocks: null, picked: {} }); setMsg(""); }}>Из документа</button>
        </div> : null}

        {pick ? <>
          {h("Какой блок", <button type="button" data-lens-btn="soft" style={{ ...ghost, padding: "3px 10px", fontSize: 12 }} onClick={() => setPick(false)}>Отмена</button>)}
          <div data-cn-kinds="" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            {CN_KINDS.map((k) => {
              const has = k.kind !== "own" && blocks.some((b) => b.kind === k.kind);
              return (
                <button key={k.kind} type="button" data-cn-kind={k.kind} data-lens-opt="" onClick={() => { vibrate("light"); setPick(false); setEdit(blankBlock(k.kind, sc)); }}
                  style={{ textAlign: "left", padding: "10px 12px", borderRadius: 14, border: "1px solid " + (has ? c.line : GOLD + "66"), background: c.chip, cursor: "pointer", opacity: has ? 0.7 : 1 }}>
                  <div style={{ fontFamily: SERIF, fontWeight: "bold", fontSize: 13.5, color: T.modTitle.color, lineHeight: 1.3 }}>{k.title}</div>
                  <div style={{ fontSize: 11.5, color: c.soft, lineHeight: 1.35, marginTop: 3 }}>{has ? "Уже есть, можно второй" : k.hint}</div>
                </button>);
            })}
          </div>
        </> : null}

        {doc ? <div data-lens-card="" data-cn-docbox="" style={{ ...T.modCard, display: "block", padding: "12px 14px", marginTop: 4, cursor: "default" }}>
          <div style={{ fontFamily: TITLE, fontSize: 17, color: T.modTitle.color }}>Из документа</div>
          <div style={{ fontSize: 12.5, color: c.soft, lineHeight: 1.5, margin: "4px 0 8px" }}>Вставь текст или прикрепи PDF: помощник разложит его по блокам. Сохраняешь ты, выбрав нужные.</div>
          {!doc.blocks ? <>
            <textarea data-lens-field="" data-cn-doctext="" rows={6} value={doc.text} onChange={(e) => setDoc((x) => ({ ...x, text: e.target.value }))} placeholder="Концепция, стандарты, памятка новичку…" style={{ ...field, resize: "vertical" }} />
            <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 8, flexWrap: "wrap" }}>
              <label data-lens-btn="soft" style={{ ...ghost, display: "inline-block", cursor: "pointer" }}>{doc.pdf ? "PDF: " + doc.pdf.name : "Прикрепить PDF"}
                <input type="file" accept="application/pdf" style={{ display: "none" }} onChange={(e) => pdfPick(e.target.files && e.target.files[0])} /></label>
              <button type="button" data-lens-btn="main" data-cn-docrun="" style={{ ...main, width: "auto", flex: 1, padding: "10px 14px" }} disabled={doc.busy || (!doc.text.trim() && !doc.pdf)} onClick={runDoc}>{doc.busy ? "Раскладываю…" : "Разложить"}</button>
              <button type="button" data-lens-btn="soft" style={ghost} onClick={() => setDoc(null)}>Отмена</button>
            </div>
          </> : <>
            {doc.blocks.length ? doc.blocks.map((b, i) => (
              <label key={i} data-cn-docblock={b.kind} style={{ display: "flex", gap: 10, padding: "8px 0", borderTop: "1px solid " + c.line, cursor: "pointer" }}>
                <input type="checkbox" checked={!!doc.picked[i]} onChange={() => setDoc((x) => ({ ...x, picked: { ...x.picked, [i]: !x.picked[i] } }))} style={{ marginTop: 3, accentColor: GOLD }} />
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: "block", fontFamily: SERIF, fontWeight: "bold", fontSize: 14, color: T.modTitle.color }}>{b.title || kindOf(b.kind).title}</span>
                  <span style={{ display: "block", fontSize: 12.5, color: c.soft, lineHeight: 1.45 }}>{(b.body || "").replace(/\*\*/g, "").slice(0, 160)}{(b.body || "").length > 160 ? "…" : ""}</span>
                </span>
              </label>)) : <div style={{ ...T.para }}>В документе не нашлось ничего для блоков. Попробуй другой текст.</div>}
            <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
              {doc.blocks.length ? <button type="button" data-lens-btn="main" data-cn-docadd="" style={{ ...main, width: "auto", flex: 1, padding: "10px 14px" }} disabled={busy || !Object.values(doc.picked).some(Boolean)} onClick={addDoc}>{busy ? "Сохраняю…" : "Добавить выбранные"}</button> : null}
              <button type="button" data-lens-btn="soft" style={ghost} onClick={() => setDoc(null)}>Отмена</button>
            </div>
          </>}
          {doc.err ? <div role="status" style={{ fontSize: 12.5, color: c.warn, marginTop: 8 }}>{doc.err}</div> : null}
        </div> : null}

        {blocks.length && canHere ? <>
          {h("Команде")}
          <div data-lens-card="" style={{ ...T.modCard, display: "block", padding: "10px 14px", cursor: "default" }}>
            <div style={{ fontSize: 12.5, color: c.soft, lineHeight: 1.5 }}>{scope === "net" ? "Сообщение всем сотрудникам сети" : "Сообщение сотрудникам «" + venueName + "»"} в Telegram и на телефон, не чаще раза в день. У кого не дошло, увидят отметку «новое».</div>
            <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
              <button type="button" data-lens-btn="soft" data-cn-notify="" style={ghost} disabled={busy} onClick={notify}>{busy ? "Минуту…" : "Сообщить команде"}</button>
              {venueName ? <button type="button" data-lens-btn="soft" data-cn-reads="" style={ghost} onClick={loadReads}>Кто прочитал</button> : null}
            </div>
            {reads && reads.ok ? (() => {
              const all = reads.rows || [], ok = all.filter((x) => x.net && x.venue);
              return (<div data-cn-readlist={ok.length + "/" + all.length} style={{ marginTop: 8 }}>
                <div style={{ fontFamily: SERIF, fontSize: 14, color: T.modTitle.color }}>Прочитали {ok.length} из {all.length}</div>
                {all.filter((x) => !(x.net && x.venue)).length ? <div style={{ fontSize: 12.5, color: c.soft, lineHeight: 1.5, marginTop: 4 }}>Ещё нет: {all.filter((x) => !(x.net && x.venue)).map((x) => x.name).join(", ")}</div> : null}
              </div>);
            })() : reads ? <div style={{ fontSize: 12.5, color: c.warn, marginTop: 8 }}>Не получилось узнать. Попробуй ещё раз.</div> : null}
          </div>
        </> : null}
        {msg ? <div role="status" data-cn-msg="" style={{ fontSize: 13, color: T.modTitle.color, lineHeight: 1.5, marginTop: 10 }}>{msg}</div> : null}
      </div>
    </div>);
}

// ── Один блок: вид, заголовок, текст, фото, «для кого», вопросы теста ──
function BlockEditor({ T, a11y, c, block, head, ghost, main, h, where, onClose }) {
  const [b, setB] = React.useState(() => ({ ...block, photos: [...(block.photos || [])], tracks: [...(block.tracks || [])], questions: (block.questions || []).map((q) => ({ ...q, options: [...q.options] })) }));
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState("");
  const [ai, setAi] = React.useState("");   // "questions" | "improve" — помощник думает
  const [up, setUp] = React.useState(0);   // сколько фото загружается
  const taRef = React.useRef(null);
  const k = kindOf(b.kind);
  const patch = (p) => setB((x) => ({ ...x, ...p }));
  const field = { width: "100%", boxSizing: "border-box", padding: "10px 12px", borderRadius: 12, border: "1px solid " + c.line, background: c.field, color: T.modTitle.color, fontFamily: SERIF, fontSize: 14, outline: "none" };

  // кнопки форматирования — как в редакторе уроков: с выделением в поле текста
  const fmt = (kind) => {
    const ta = taRef.current; const v = b.body || "";
    const s = ta ? ta.selectionStart : v.length, e = ta ? ta.selectionEnd : v.length;
    let nv, ns, ne;
    if (kind === "bold") { const sel = v.slice(s, e) || "текст"; nv = v.slice(0, s) + "**" + sel + "**" + v.slice(e); ns = s + 2; ne = ns + sel.length; }
    else {
      const ls = s === 0 ? 0 : v.lastIndexOf("\n", s - 1) + 1;
      let le = v.indexOf("\n", e); if (le < 0) le = v.length;
      const lines = v.slice(ls, le).split("\n");
      const nl = kind === "list"
        ? (lines.every((x) => x.startsWith("• ")) ? lines.map((x) => x.slice(2)) : lines.map((x) => (x.startsWith("• ") ? x : "• " + x.replace(/^•\s*/, ""))))
        : lines.map((x) => (/^\*\*.+\*\*$/.test(x) ? x.slice(2, -2) : "**" + (x.replace(/^\*\*|\*\*$/g, "").replace(/^•\s*/, "") || "Заголовок") + "**"));
      const out = nl.join("\n"); nv = v.slice(0, ls) + out + v.slice(le); ns = ls; ne = ls + out.length;
    }
    patch({ body: nv.slice(0, CN_LIMITS.body) });
    requestAnimationFrame(() => { const t = taRef.current; if (t) { t.focus(); try { t.setSelectionRange(ns, ne); } catch (x) { /* */ } } });
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
    const r = await askAI(mode, { role: b.tracks[0] || "seasonal", title: b.title, text: b.body });
    setAi("");
    if (!r.ok) { setErr(r.error); return; }
    if (mode === "improve" && r.content) patch({ body: String(r.content).slice(0, CN_LIMITS.body) });
    if (mode === "questions") {
      const add = (r.questions || []).map(cleanQuestion).filter(Boolean);
      setB((x) => ({ ...x, questions: [...x.questions, ...add].slice(0, CN_LIMITS.questions) }));
    }
  };
  const save = () => {
    const prob = blockProblem(b);
    if (prob) { setErr(prob); return; }
    const bad = b.questions.filter((q) => !cleanQuestion(q)).length;
    if (bad) { setErr("Вопрос без текста, без вариантов или без верного ответа: допиши или удали его."); return; }
    if (busy || up) return;
    vibrate("light"); setBusy(true); setErr("");
    rpc("concept_save", { p_token: saToken(), p_block: blockPayload(b) }).then((r) => {
      setBusy(false);
      if (r && r.ok) onClose(true); else setErr(conceptErr(r && r.error));
    }).catch(() => { setBusy(false); setErr("Нет связи. Попробуй ещё раз."); });
  };
  const fb = { ...ghost, padding: "5px 11px", fontSize: 12.5 };
  return (
    <div style={T.screen} className="sa-screen" data-about="block" data-cn-kind-edit={b.kind}>
      {head(b.id ? "Блок" : "Новый блок", null, () => onClose(false))}
      <div style={{ flex: 1, padding: "14px 16px 28px" }}>
        <div style={{ fontSize: 12.5, color: c.soft, marginBottom: 10 }}>{where} · {k.title}{k.kind !== "own" ? ": " + k.hint.toLowerCase() : ""}</div>
        {h("Заголовок")}
        <input data-lens-field="" data-cn-title="" value={b.title} maxLength={CN_LIMITS.title} onChange={(e) => patch({ title: e.target.value })} placeholder={k.kind === "own" ? "Например, «Музыка в зале»" : k.title} style={field} />
        {h("Текст")}
        <div style={{ display: "flex", gap: 6, marginBottom: 6, flexWrap: "wrap" }}>
          <button type="button" data-lens-btn="soft" aria-label="Жирный" style={{ ...fb, fontWeight: "bold" }} onClick={() => fmt("bold")}>Ж</button>
          <button type="button" data-lens-btn="soft" style={fb} onClick={() => fmt("list")}>• Список</button>
          <button type="button" data-lens-btn="soft" style={fb} onClick={() => fmt("head")}>Заголовок</button>
          <button type="button" data-lens-btn="soft" style={{ ...fb, marginLeft: "auto" }} disabled={!!ai} data-cn-improve="" onClick={() => think("improve")}>{ai === "improve" ? "Улучшаю…" : "Улучшить текст"}</button>
        </div>
        <textarea ref={taRef} data-lens-field="" data-cn-body="" rows={9} value={b.body} maxLength={CN_LIMITS.body} onChange={(e) => patch({ body: e.target.value })}
          placeholder={k.hint} style={{ ...field, resize: "vertical", lineHeight: 1.5 }} />

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
        <div style={{ fontSize: 12, color: c.soft, marginTop: 4 }}>Ничего не выбрано: блок видят все. Выбрал треки: только они, в «О нас» и в разделе «Наш ресторан».</div>

        {h("Вопросы теста", <span style={{ fontSize: 12, color: c.soft }}>{b.questions.length} из {CN_LIMITS.questions}</span>)}
        <div style={{ fontSize: 12, color: c.soft, marginBottom: 6 }}>Из них раздел «Наш ресторан» собирает тест; вопросы попадают и в вопрос дня, и в брифинг.</div>
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

        {err ? <div role="status" data-cn-err="" style={{ fontSize: 13, color: c.warn, lineHeight: 1.5, marginTop: 12 }}>{err}</div> : null}
        <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
          <button type="button" data-lens-btn="main" data-cn-save="" style={{ ...main, flex: 1 }} disabled={busy || !!up} onClick={save}>{busy ? "Сохраняю…" : up ? "Фото загружается…" : "Сохранить"}</button>
          <button type="button" data-lens-btn="soft" style={{ ...ghost, padding: "11px 16px" }} onClick={() => onClose(false)}>Отмена</button>
        </div>
      </div>
    </div>);
}
