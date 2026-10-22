// ui/content-editor.jsx — редактор контента (правка 156, просьба владельца «сделать
// удобным и красивым + ассистент, как в меню»).
//
// Формат урока и серверные функции — прежние (cms_list_lessons / cms_save_lesson /
// cms_delete_lesson): уже созданные уроки открываются и сохраняются как раньше.
// Что нового:
//   • список — по трекам и разделам, у раздела иконка и цвет трека, как у сотрудника;
//   • «Для кого» — треки в цветах палитры, добавлена хостес (раньше её не было);
//   • раздел — метками из уже созданных (без дублей из опечаток) или новый;
//   • кнопки «Ж», «• Список», «Заголовок» — без звёздочек руками;
//   • ассистент: «Урок из текста» (текст или PDF), «Улучшить текст», «Придумать
//     вопросы» — всё черновиком, сохраняет человек (серверная часть — api/lesson-assist.js);
//   • вопросы карточками: верный — тапом, пояснение, фото, порядок ↑↓;
//   • черновик сам сохраняется на телефоне и восстанавливается;
//   • «Как увидит сотрудник» — карточка раздела и текст урока, как в программе.
// v40: практика — все шесть видов, как в приложении («Что делаешь?», «Найди ошибку», «Глазами
// гостя», «Правда или миф», «Собери правило», «Быстрое решение»), у каждого свои поля и проверки;
// «Сыграть практику» и «Сыграть диалог» — настоящие экраны игры с черновиком, без записи прогресса;
// у диалога — своя фраза и заголовок, когда гость уходит (guest.walk / guest.walkTitle).
import { hintsFor } from "../data/hints";
import { useHintOnce, HintBubble } from "./widgets";
import React from "react";
import { createPortal } from "react-dom";
import { rpc, saToken } from "../api/supabase";
import { TRACKS, trackOf, customIcon } from "../lib/tracks";
import { MOD_SVG, UI_SVG } from "./icons";
import { glass as glassOf, SectionLabel, tones } from "./analytics-kit";
import { GOLD } from "./tokens";
import { SkelCards } from "./skeleton";   // v55 (Доп. 368): силуэты вместо «Загрузка…»
import { COCKTAILS } from "../data/cocktails";
import { splitExtras, sectionName, bySort, sectionSteps } from "../lib/custom-modules";
import { answerTell } from "../lib/answer-tell";   // v37: верный угадывается по длине?
import { LiveDialogue, dlgWalkText, dlgGram } from "./screens-dialogue";   // v40: проба диалога — тот же экран
import { practiceRound } from "../lib/practice-round";
import { tfLabel } from "../lib/practice-mistake";
import { vibrate } from "../lib/utils";
import { useViewport, useColumn } from "./viewport";   // v52 (Доп. 365): редактор в две панели на компьютере
import { topInsetPx } from "../lib/tg-screen";   // v69 (Доп. 382): верх экрана в полноэкранном Telegram — под его кнопками

const DRAFT_KEY = "sa_cms_draft";
const SERIF = "Georgia, 'Times New Roman', serif";
const uid = () => Math.random().toString(36).slice(2, 9);
const blankQ = () => ({ id: uid(), q: "", options: ["", ""], correct: 0, explanation: "", img: "" });

// ── v40: шесть видов практики — те же, что играет приложение (ui/table.jsx, ui/screens-learning.jsx) ──
// Формат каждой ситуации — как у штатных (data/modules-*.js): правда/миф — { statement, isTrue, correct,
// question: «Это верно?», options: [«✅ Верно», «❌ Неверно»] }; «Глазами гостя» — guestThought + scene +
// question; «Собери правило» — start, варианты — продолжения после него.
export const GENRES = [["action", "Что делаешь?"], ["find", "Найди ошибку"], ["empathy", "Глазами гостя"],
  ["truefalse", "Правда или миф"], ["complete", "Собери правило"], ["timer", "Быстрое решение"]];
const GENRE_IDS = GENRES.map(g => g[0]);
const GENRE_RU = Object.fromEntries(GENRES);
export const SIT_Q = { action: "Что делаешь?", find: "Что не так?", empathy: "Что чувствует гость и что сделать?", timer: "Что делаешь?",
  truefalse: "Это верно?", complete: "Выбери правильное продолжение:" };
// вопросы «по умолчанию» (и прежний «В чём ошибка?»): при смене вида меняются сами, свой вопрос остаётся
const SIT_Q_AUTO = new Set(["", "В чём ошибка?", ...Object.values(SIT_Q)]);
const TF_OPTS = ["✅ Верно", "❌ Неверно"];
// «Собери правило»: начало не обрывается на «а:», «в:», «он:» (как проверяет tests/v39 у штатных)
const CUT_COLON = /(^|[\s,])(а|в|он|на|о|в течение)\s*:\s*$/iu;
export const genreOfS = (x) => { const g = x && (x.genre || x.type); return GENRE_IDS.includes(g) ? g : "action"; };
// Подсказки в карточке — по docs/ОТВЕТЫ-С-ПОДВОХОМ.md (правила 4, 8, 9)
const GENRE_HINT = {
  action: "Сцена из смены — сотрудник выбирает, что сделать. Мысли сотрудника пиши прямо в сцене.",
  find: "В сцене сотрудник ошибается. Спроси, что не так, — а не «что делаешь?».",
  empathy: "Мысли гостя — только в этом виде, и они совпадают со сценой. Вопрос — про чувства гостя и про то, что их создаёт.",
  truefalse: "Утверждение, которое по уроку точно правда или точно миф, — без «иногда» и «зависит».",
  complete: "Начало и любой вариант читаются как одно предложение: без вопроса в конце начала и без двоеточия после «а», «в», «он».",
  timer: "Как «Что делаешь?», только на ответ — 12 секунд: сцена и варианты короткие.",
};
const SCENE_PH = {
  action: "Сцена: «Гость пятый раз зовёт тебя, а у тебя в руках горячее…»",
  find: "Сцена с ошибкой: «Официант ставит бокал слева от тарелки…»",
  empathy: "Сцена: «Зал полон, официант занят большим столом и не смотрит в сторону гостя»",
  timer: "Сцена, где решать надо сразу: «Гость поднял руку, а у тебя в руках горячее…»",
};
const OPT_PH = { action: "Действие", find: "Вариант", empathy: "Вариант", complete: "Продолжение", timer: "Действие" };
const isTfOpts = (o) => Array.isArray(o) && o.length === 2 && o.every(v => String(v).trim().length <= 14) && tfLabel(o[0]).t === "Правда" && tfLabel(o[1]).t === "Миф";
const unq = (s) => /^«[^«»]*»$/.test(s) ? s.slice(1, -1).trim() : s;   // «…» целиком — экран сам ставит ёлочки
const blankS = (genre = "action") => ({ id: uid(), genre, emoji: "", guestThought: "", scene: "", statement: "", start: "", isTrue: null,
  question: SIT_Q[genre], options: ["", ""], correct: 0, win: "", fail: "" });
// Ситуация с сервера, из черновика на телефоне или от ассистента → карточка редактора. В карточке — поля
// всех видов: сменил вид — набранное не пропадает; в сохранение идут только поля своего вида (sitOut).
export function toDraftSit(x) {
  const s = x || {}; const g = genreOfS(s);
  const opts = Array.isArray(s.options) ? s.options.map(o => String(o == null ? "" : o)) : [];
  const tfData = g === "truefalse" && isTfOpts(opts);   // правда/миф: варианты служебные, ответ — в isTrue
  const isTrue = typeof s.isTrue === "boolean" ? s.isTrue : tfData && (s.correct === 0 || s.correct === 1) ? s.correct === 0 : null;
  const options = tfData || !opts.length ? ["", ""] : opts.length < 2 ? [...opts, ""] : opts;
  const correct = !tfData && Number.isInteger(s.correct) && s.correct >= 0 && s.correct < options.length ? s.correct : 0;
  return { id: s.id || uid(), genre: g, emoji: s.emoji || "", guestThought: s.guestThought || "", scene: s.scene || "", statement: s.statement || "",
    start: s.start || "", isTrue, question: s.question != null ? String(s.question) : SIT_Q[g], options, correct, win: s.win || "", fail: s.fail || "" };
}
// Смена вида: вопрос по умолчанию — на вопрос нового вида, свой — остаётся; остальное не трогаем
export function switchGenre(x, g) {
  const q = String((x && x.question) || "").trim();
  return { ...x, genre: g, question: SIT_Q_AUTO.has(q) ? SIT_Q[g] : x.question };
}
// Карточка → ситуация для сервера и игры: только поля своего вида, в формате штатных
export function sitOut(x) {
  const g = genreOfS(x), t = (v) => String(v == null ? "" : v).trim();
  const head = { kind: "situation", genre: g, emoji: t(x.emoji) }, tail = { win: t(x.win), fail: t(x.fail) };
  if (g === "truefalse") {
    const isTrue = x.isTrue !== false;
    return { ...head, statement: unq(t(x.statement)), isTrue, correct: isTrue ? 0 : 1, question: SIT_Q.truefalse, options: [...TF_OPTS], ...tail };
  }
  const keep = (x.options || []).map((o, i) => ({ o: t(o), i })).filter(y => y.o);   // пустые варианты убираются, верный сдвигается вместе с ними
  const options = keep.map(y => y.o), correct = Math.max(0, keep.findIndex(y => y.i === x.correct));
  if (g === "complete") return { ...head, start: t(x.start), options, correct, question: SIT_Q.complete, ...tail };
  return { ...head, ...(g === "empathy" ? { guestThought: unq(t(x.guestThought)) } : {}), scene: t(x.scene), question: t(x.question) || SIT_Q[g], options, correct, ...tail };
}
// Что не так с ситуацией — словами для «Ситуация N: …» (null — всё заполнено)
export function sitProblem(x) {
  const g = genreOfS(x), t = (v) => String(v == null ? "" : v).trim();
  if (g === "truefalse") {
    if (!t(x.statement)) return "нужно утверждение.";
    return x.isTrue === true || x.isTrue === false ? null : "отметь, правда это или миф.";
  }
  if (g === "complete") {
    const st = t(x.start);
    if (!st) return "нужно начало правила.";
    if (/\?\s*$/.test(st)) return "начало правила — не вопрос: начало и любой вариант читаются как одно предложение.";
    const m = st.match(CUT_COLON);
    if (m) return `начало правила обрывается на «${m[2]}:» — убери двоеточие, чтобы начало и вариант читались одним предложением.`;
  } else {
    if (g === "empathy" && !t(x.guestThought)) return "нужны мысли гостя.";
    if (!t(x.scene)) return "нужна сцена.";
  }
  if ((x.options || []).filter(o => t(o)).length < 2) return "нужно хотя бы два варианта.";
  if (!t((x.options || [])[x.correct])) return "отметь верный вариант.";
  return null;
}
// Свёрнутая карточка и списки: главное поле вида и верный ответ
const sitHead = (x) => { const g = genreOfS(x); const main = g === "truefalse" ? x.statement : g === "complete" ? x.start : g === "empathy" ? (x.guestThought || x.scene) : x.scene;
  return ((x.emoji ? x.emoji + " " : "") + String(main || "").trim()).trim(); };
const sitAnswer = (x) => genreOfS(x) === "truefalse" ? ((typeof x.isTrue === "boolean" ? x.isTrue : x.correct === 0) ? "Правда" : "Миф") : ((x.options || [])[x.correct] || "");
// Проба практики (v40): то же, что App (handlePracticeChoice / handlePracticeNext) — очки, комбо, тарелки,
// итог, — но без записи: ни «Работы над ошибками», ни активности, ни звёзд
export function pvChoice(ps, idx) {
  if (!ps || ps.isAnswered || ps.done) return ps;
  const sit = (ps.situations || [])[ps.step]; if (!sit) return ps;
  const ok = idx === sit.correct, combo = ok ? (ps.combo || 0) + 1 : 0;
  return { ...ps, choice: idx, isAnswered: true, lives: ok ? ps.lives : ps.lives - 1, score: (ps.score || 0) + (ok ? (combo >= 2 ? 20 : 10) : 0), combo };
}
export function pvNext(ps) {
  const sit = ps && (ps.situations || [])[ps.step]; if (!sit) return ps;
  const ok = ps.choice === sit.correct, results = [...(ps.results || []), ok];
  if (ps.step + 1 >= ps.situations.length || (ps.lives <= 0 && !ok)) return { ...ps, results, done: true, isAnswered: false };
  return { ...ps, step: ps.step + 1, choice: null, isAnswered: false, results };
}
const blankLesson = () => ({ id: "", role: "seasonal", module: "", title: "", content: "", questions: [], situations: [], dialogue: null, build: null, review: null, skills: [], sort: 0 });
const hasWork = (d) => !!(d && ((d.title || "").trim() || (d.content || "").trim() || (d.questions || []).length || (d.situations || []).length || d.dialogue || d.build || d.review || (d.skills || []).length));
// Сборка у бара (правка 160) — одна на урок, в questions с пометкой kind: "build"
const blankBStep = () => ({ id: uid(), label: "", q: "", cost: "", options: [{ t: "", ok: true, fb: "" }, { t: "", ok: false, fb: "" }, { t: "", ok: false, fb: "" }, { t: "", ok: false, fb: "" }] });
const newBuild = () => ({ title: "", glass: "rocks", tint: "#C8A96E", win: "", lose: "", steps: [blankBStep(), blankBStep()] });
const withBIds = (b) => b ? { title: b.title || "", glass: b.glass || "rocks", tint: b.tint || "#C8A96E", win: b.win || "", lose: b.lose || "",
  steps: (b.steps || []).map(st => ({ id: uid(), label: st.label || "", q: st.q || "", cost: st.cost || "", options: (st.options || []).map(o => ({ t: o.t || "", ok: !!o.ok, fb: o.fb || "" })) })) } : null;
const GLASSES = [["high", "Хайбол"], ["rocks", "Рокс"], ["coupe", "Купе"], ["wine", "Винный"], ["pint", "Пинта"]];
const TINTS = ["#C8A96E", "#B8352A", "#E8B04A", "#8FC471", "#6FA8C8", "#EDE3CF"];
const GLASS_RU = { high: "хайбол", rocks: "рокс (олд фэшн)", coupe: "купе", wine: "винный бокал", pint: "пинта", martini: "мартини", flute: "флюте" };
// Рецепт коктейля — текстом для ассистента: дозы, бокал, лёд, метод, гарниш — как в карте бара
const recipeOf = (c) => [c.name + ".", c.glass ? "Бокал: " + (GLASS_RU[c.glass] || c.glass) + "." : "", "Лёд: " + (c.ice ? "да" : "нет") + ".",
  c.method ? "Метод: " + c.method + "." : "", Array.isArray(c.ing) && c.ing.length ? "Ингредиенты: " + c.ing.map(x => Array.isArray(x) ? `${x[0]} ${x[1]} мл` : String(x)).join(", ") + "." : "",
  c.garnish ? "Гарниш: " + c.garnish + "." : "", Array.isArray(c.steps) && c.steps.length ? "Как готовить: " + c.steps.join("; ") + "." : "", c.tip ? "Совет: " + c.tip : ""].filter(Boolean).join(" ");
// Живой диалог (правка 159) — один на урок, лежит в questions с пометкой kind: "dialogue"
const blankChoice = () => ({ id: uid(), type: "choice", prompt: "Что ответишь?", options: [
  { text: "", correct: true, feedback: "", moodDelta: 1 }, { text: "", correct: false, feedback: "", moodDelta: -1 }, { text: "", correct: false, feedback: "", moodDelta: 0 }] });
const newDialogue = () => ({ tip: "", guest: { name: "", avatar: "🙂", context: "", mood: 3 }, steps: [{ id: uid(), type: "guest", text: "" }, blankChoice()] });
const withIds = (d) => d ? { tip: d.tip || "", guest: { name: "", avatar: "🙂", context: "", mood: 3, ...(d.guest || {}) },
  steps: (d.steps || []).map(st => ({ ...st, id: st.id || uid(), options: st.options ? st.options.map(o => ({ ...o })) : undefined })) } : null;
const GUEST_AVATARS = ["🙂", "👔", "👩", "🧔", "👵", "👩‍💼", "🙋", "👨‍👩‍👧"];
const MOODS = ["😠", "😕", "😐", "🙂", "😊"];
// Сервер хранит у урока текст и вопросы; отдельного места для ситуаций нет. Чтобы не
// трогать серверные функции, ситуации лежат в том же списке questions с пометкой
// kind: "situation" (правка 158); приложение и редактор разделяют их при чтении.
const isSit = (q) => !!(q && q.kind === "situation");
const fromServer = (l) => {
  const all = Array.isArray(l.questions) ? l.questions : [];
  return JSON.parse(JSON.stringify({ ...blankLesson(), ...l,
    questions: all.filter(q => !isSit(q) && !(q && (q.kind === "dialogue" || q.kind === "build" || q.kind === "review" || q.kind === "skill"))).map(q => ({ id: uid(), ...q })),
    situations: all.filter(isSit).map(({ kind, ...x }) => toDraftSit(x)),
    dialogue: withIds(all.find(q => q && q.kind === "dialogue")), build: withBIds(all.find(q => q && q.kind === "build")) }));
};
// Общие части раздела (правка 161): практика, диалог, сборка и тест — одни на весь раздел,
// лежат на первом уроке раздела; собираются со всех уроков раздела (старые разделы, где
// части лежали на разных уроках, редактор при сохранении соберёт на первый урок).
const sectionRecs = (lessons, role, module) => lessons.filter(l => (l.role || "seasonal") === role && sectionName(l) === ((module || "").trim() || "Свой раздел")).sort(bySort);
const sectionExtras = (recs) => {
  const parts = recs.map(r => splitExtras(r.questions));
  const withIdsQ = (q) => ({ id: uid(), ...q });
  return {
    questions: parts.flatMap(x => x.quiz).map(withIdsQ),
    situations: parts.flatMap(x => x.sits).map(toDraftSit),   // v40: все виды — в поля карточки
    dialogue: withIds((parts.find(x => x.dlg) || {}).dlg),
    build: withBIds((parts.find(x => x.bld) || {}).bld),
    // страница книги отзывов (правка 166)
    review: (() => { const rv = (parts.find(x => x.review) || {}).review; return rv ? { guest: rv.guest || "", table: rv.table || "", text: rv.text || "" } : null; })(),
    // навыки для «Подтверждения в зале» (Доп. 310)
    skills: parts.flatMap(x => x.skills || []).map(s => ({ id: uid(), sid: s.sid || uid(), label: s.label || "", hint: s.hint || "" })),
  };
};
const noExtras = () => ({ questions: [], situations: [], dialogue: null, build: null, review: null, skills: [] });
const SIT_EMOJI = ["🔥", "💬", "🍷", "🙋", "⚠️", "🤝", "🍽", "⏱"];
const readDraft = () => { try { return JSON.parse(localStorage.getItem(DRAFT_KEY) || "null"); } catch (e) { return null; } };
const writeDraft = (v) => { try { v ? localStorage.setItem(DRAFT_KEY, JSON.stringify(v)) : localStorage.removeItem(DRAFT_KEY); } catch (e) {} };
const hhmm = (t) => { const d = new Date(t); return String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0"); };

const ico = {
  pencil: (c) => (<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M4 20l1-4L16.5 4.5a2.12 2.12 0 0 1 3 3L8 19l-4 1z" /><path d="M14.5 6.5l3 3" /></svg>),
  trash: (c, s) => (<svg width={s || 17} height={s || 17} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18" /><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m2 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" /></svg>),
  plus: (c, s) => (<svg width={s || 18} height={s || 18} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14" /></svg>),
  up: (c) => (<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 15l6-6 6 6" /></svg>),
  down: (c) => (<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9l6 6 6-6" /></svg>),
  photo: (c) => (<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><path d="M21 15l-5-5L5 21" /></svg>),
  file: (c) => (<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" /><path d="M14 3v5h5M9 13h6M9 17h4" /></svg>),
  check: (c) => (<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg>),
  play: (c, s) => (<svg width={s || 13} height={s || 13} viewBox="0 0 24 24" fill={c} stroke={c} strokeWidth="1.6" strokeLinejoin="round" aria-hidden="true"><path d="M7 4.8v14.4L19 12z" /></svg>),
};

// Текст урока — по тем же правилам, что рисует экран урока (ui/screens-learning.jsx):
// строка **целиком** — заголовок, «•» — пункт, «…» — цитата, ✅/❌ — хорошо/плохо,
// **жирное** внутри строки.
function Rich({ text, T, color, a11y }) {
  const TN = tones(a11y);
  const inline = (s) => !s.includes("**") ? s : s.split(/(\*\*[^*]+\*\*)/g).filter(Boolean).map((p, k) =>
    p.startsWith("**") && p.endsWith("**") ? <b key={k} style={{ color: T.bold && T.bold.color, fontWeight: "bold" }}>{p.slice(2, -2)}</b> : <React.Fragment key={k}>{p}</React.Fragment>);
  const row = (style, icon, line, i) => (
    <div key={i} style={{ ...style, display: "flex", gap: 8, alignItems: "flex-start" }}>
      <span style={{ flexShrink: 0, marginTop: 2, display: "inline-flex" }}>{icon}</span><span style={{ flex: 1 }}>{inline(line.replace(/^(✅|❌)\s*/, ""))}</span>
    </div>);
  return (String(text || "")).split("\n").map((line, i) => {
    if (!line.trim()) return <div key={i} style={{ height: 10 }} />;
    if (line.startsWith("**") && line.endsWith("**") && line.length > 4) return <div key={i} style={T.bold}>{line.replace(/\*\*/g, "")}</div>;
    if (line.startsWith("•")) return <div key={i} style={T.bullet}>{inline(line)}</div>;
    if (line.startsWith("✅")) return row(T.good || T.para, UI_SVG.checkCircle(TN.good, 14), line, i);
    if (line.startsWith("❌")) return row(T.bad || T.para, UI_SVG.xCircle(TN.bad, 14), line, i);
    if (line.startsWith("«") && line.includes("»")) return <div key={i} style={{ ...(T.quote || T.para), borderLeftColor: color }}>{line}</div>;
    return <div key={i} style={T.para}>{inline(line)}</div>;
  });
}

// Живой диалог: что не так — словами (null — можно сохранять и играть)
export function dlgProblem(dl) {
  if (!dl) return null;
  if (!((dl.guest && dl.guest.name) || "").trim()) return "Живой диалог: как зовут гостя?";
  if (!dl.steps.some(st => st.type === "choice")) return "Живой диалог: нужен хотя бы один выбор.";
  for (let i = 0; i < dl.steps.length; i++) {
    const st = dl.steps[i];
    if (st.type !== "choice" && !(st.text || "").trim()) return `Живой диалог, шаг ${i + 1}: пустой текст.`;
    if (st.type === "choice") {
      const filled = st.options.filter(o => (o.text || "").trim());
      if (!(st.prompt || "").trim()) return `Живой диалог, шаг ${i + 1}: нужен вопрос.`;
      if (filled.length < 2) return `Живой диалог, шаг ${i + 1}: нужно хотя бы два ответа.`;
      if (!st.options.some(o => o.correct && (o.text || "").trim())) return `Живой диалог, шаг ${i + 1}: отметь верный ответ.`;
    }
  }
  return null;
}

// Общие части раздела → список questions, как их хранит сервер (правка 161)
export function serializeExtras(draft) {
  const tidy = ({ id, ...q }) => {   // пустые варианты убираются, верный сдвигается вместе с ними
    const keep = q.options.map((o, i) => ({ o: (o || "").trim(), i })).filter(x => x.o);
    return { ...q, options: keep.map(x => x.o), correct: Math.max(0, keep.findIndex(x => x.i === q.correct)) };
  };
  // v40: уход гостя — своя фраза и заголовок (guest.walk / guest.walkTitle), только если написаны
  const guestOut = (gs) => { const { walk, walkTitle, ...g } = gs || {}; const w = (walk || "").trim(), wt = (walkTitle || "").trim();
    return { ...g, name: (g.name || "").trim(), context: (g.context || "").trim(), ...(w ? { walk: w } : {}), ...(wt ? { walkTitle: wt } : {}) }; };
  const dlgOut = draft.dialogue ? [{ kind: "dialogue", tip: (draft.dialogue.tip || "").trim(), guest: guestOut(draft.dialogue.guest),
    steps: draft.dialogue.steps.map(st => st.type === "choice"
      ? { type: "choice", prompt: st.prompt.trim(), options: st.options.filter(o => (o.text || "").trim()).map(o => ({ text: o.text.trim(), correct: !!o.correct, feedback: (o.feedback || "").trim(), moodDelta: o.moodDelta | 0 })) }
      : { type: st.type, text: st.text.trim() }) }] : [];
  const bldOut = draft.build ? [{ kind: "build", title: draft.build.title.trim(), glass: draft.build.glass, tint: draft.build.tint, win: (draft.build.win || "").trim(), lose: (draft.build.lose || "").trim(),
    steps: draft.build.steps.map(st => ({ label: (st.label || "").trim() || "Шаг", q: st.q.trim(), cost: (st.cost || "").trim(),
      options: st.options.filter(o => (o.t || "").trim()).map(o => o.ok ? { t: o.t.trim(), ok: true, fb: (o.fb || "").trim() } : { t: o.t.trim(), fb: (o.fb || "").trim() }) })) }] : [];
  const rvOut = draft.review && (draft.review.text || "").trim() ? [{ kind: "review", guest: (draft.review.guest || "").trim(), table: (draft.review.table || "").trim(), text: draft.review.text.trim() }] : [];
  const skOut = (draft.skills || []).filter(s => (s.label || "").trim()).map(s => ({ kind: "skill", sid: s.sid || uid(), label: s.label.trim(), hint: (s.hint || "").trim() }));
  const questions = [...draft.questions.map(tidy), ...(draft.situations || []).map(sitOut), ...dlgOut, ...bldOut, ...rvOut, ...skOut];
  return questions;
}

// v52 (Доп. 365): от этой ширины (без вырезов и полей) редактор урока — в две панели
export const ED2_MIN = 1000;

export function ContentEditorScreen({ T, a11y, onBack }) {
  // Подсказка экрана — один раз при первом входе (правка 171)
  const [ceHint, ceHintDone] = useHintOnce("contentEditor");
  const [ceStep, setCEStep] = React.useState(0);
  const ceSteps = hintsFor("contentEditor");
  const dark = !a11y;
  const TN = tones(a11y);
  const gold = dark ? GOLD : "#6B4E14";
  const txt = dark ? "#EFE4C8" : "#2A2113";
  const muted = dark ? "#BFAE8A" : "#5E4E30";
  const brd = dark ? "rgba(214,178,102,0.30)" : "rgba(107,78,20,0.28)";
  const G = (extra) => glassOf(null, a11y, extra);
  const token = saToken();
  const trackInk = (t) => dark ? t.color : t.ink;

  const [lessons, setLessons] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [loadErr, setLoadErr] = React.useState(false);
  const [view, setView] = React.useState("list");
  const [draft, setDraft] = React.useState(null);
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState(null);
  const [confirmDel, setConfirmDel] = React.useState(null);
  const [draftNote, setDraftNote] = React.useState(null);   // «восстановлен черновик от …»
  const [savedAt, setSavedAt] = React.useState(null);
  const [newSection, setNewSection] = React.useState(false);
  const [base, setBase] = React.useState("");   // общие части раздела при открытии (как их хранит сервер)
  // Сжатие длинной формы (правка 162): карточки свёрнуты в строку, раскрыта одна в разделе;
  // навигатор по разделам; текст урока — до половины экрана; предпросмотр — по кнопке;
  // «Сохранить» — закреплена внизу и уезжает, пока печатаешь.
  const [openCard, setOpenCard] = React.useState({});   // { sit, q, st, bst }: номер раскрытой карточки
  const [showPreview, setShowPreview] = React.useState(false);
  const [textFull, setTextFull] = React.useState(false);
  const [textTall, setTextTall] = React.useState(false);
  const [typingEd, setTypingEd] = React.useState(false);
  // v52 (Доп. 365): широкий экран — список уроков в две колонки; компьютер — редактор в две панели:
  // форма слева, справа — как урок увидит сотрудник (предпросмотр открыт всегда, листается сам по себе)
  const vpE = useViewport();
  const two = vpE.wide && view === "edit" && vpE.w - vpE.safe.l - vpE.safe.r - 24 >= ED2_MIN;
  useColumn(two ? 1200 : vpE.wide && view === "list" ? 940 : 0);
  const pvRef = React.useRef(null);
  const edWrap = (cls, ref, kids) => (two ? <div className={cls} ref={ref} data-ed2={cls}>{kids}</div> : kids);
  // обёртки экрана режут край по горизонтали (overflow-x: hidden) и потому сами считаются «прокруткой» —
  // липкий предпросмотр в две панели к ним не прилипает: там обрезка без прокрутки (clip, класс sa-edon).
  // v54 (Доп. 367): полоска разделов «Урок · Практика · …» больше не position: sticky — на iPhone липкое внутри
  // прокрутки приложения дрожало (запись владельца, v53). Уехала вверх — сверху встаёт её копия в слое поверх
  // экрана (position: fixed не дрожит), как прилипшие номера тем в треке (Доп. 308)
  const edOpen = view === "edit";
  React.useLayoutEffect(() => {
    if (!two || typeof document === "undefined") return undefined;
    const el = document.documentElement; el.classList.add("sa-edon");
    return () => { el.classList.remove("sa-edon"); };
  }, [two]);
  const navRef = React.useRef(null);
  const [navPin, setNavPin] = React.useState(null);   // { left, width } — копия полоски сверху, пока сама уехала
  React.useEffect(() => {
    const el = navRef.current;
    if (!edOpen || !el || typeof IntersectionObserver === "undefined") { setNavPin(null); return undefined; }
    const box = () => { const b = el.getBoundingClientRect(); return { left: Math.round(b.left), width: Math.round(b.width) }; };
    const io = new IntersectionObserver((ents) => {
      const en = ents[ents.length - 1]; if (!en) return;
      const b = en.boundingClientRect;
      // верх полоски ушёл под край прокрутки (или вся она выше экрана) — показываем копию
      const up = en.isIntersecting ? en.intersectionRect.top > b.top + 0.5 : b.top < topInsetPx();   // v69: верх — под кнопками Telegram
      setNavPin(up ? box() : null);
    }, { threshold: [0, 1] });
    io.observe(el);
    const onR = () => setNavPin((p) => (p ? box() : p));
    window.addEventListener("resize", onR);
    return () => { io.disconnect(); window.removeEventListener("resize", onR); };
  }, [edOpen, two]);
  const secRef = { lesson: React.useRef(null), sit: React.useRef(null), dlg: React.useRef(null), bld: React.useRef(null), q: React.useRef(null), prev: React.useRef(null) };
  const toggleCard = (sec, id) => setOpenCard(o => ({ ...o, [sec]: o[sec] === id ? null : id }));
  const jump = (k) => {
    const pv = pvRef.current;
    if (k === "prev" && two && pv) {   // предпросмотр и так на экране — к его началу, с подсветкой
      try { pv.scrollTo({ top: 0, behavior: "smooth" }); } catch (e) { pv.scrollTop = 0; }
      pv.classList.remove("sa-ed2-flash"); void pv.offsetWidth; pv.classList.add("sa-ed2-flash"); return;
    }
    const el = secRef[k] && secRef[k].current; if (!el) return;
    el.scrollIntoView({ block: "start" }); const r = document.getElementById("root"); if (r) r.scrollTop -= 58 + ((vpE.safe && vpE.safe.t) || 0); };   // под копию полоски сверху
  React.useEffect(() => {
    if (view !== "edit") return;
    const isField = (el) => !!(el && /^(TEXTAREA|INPUT)$/.test(el.tagName) && el.type !== "file");
    const on = (e) => { if (isField(e.target)) setTypingEd(true); };
    const off = () => setTimeout(() => setTypingEd(isField(document.activeElement)), 80);
    document.addEventListener("focusin", on); document.addEventListener("focusout", off);
    return () => { document.removeEventListener("focusin", on); document.removeEventListener("focusout", off); };
  }, [view]);
  const [ai, setAi] = React.useState({ mode: null, busy: false, err: null, material: "", pdf: null, result: null, picked: {} });
  const taRef = React.useRef(null);
  // v40: проба — настоящий экран игры поверх редактора: { kind: "sit", lesson, mod, ps, profile } | { kind: "dlg", dialogue }
  const [play, setPlay] = React.useState(null);
  const [playMsg, setPlayMsg] = React.useState(null);
  const [playBusy, setPlayBusy] = React.useState(false);
  const tbRef = React.useRef(null);   // модуль «у стола» (ui/table.jsx) — грузится по первой пробе
  React.useEffect(() => { setPlayMsg(null); }, [draft]);

  const load = React.useCallback(async () => {
    setLoading(true); setLoadErr(false);
    try { const res = await rpc("cms_list_lessons", { p_token: token }); if (Array.isArray(res)) setLessons(res); else { setLessons([]); setLoadErr(true); } }
    catch (e) { setLessons([]); setLoadErr(true); }
    setLoading(false);
  }, [token]);
  React.useEffect(() => { load(); }, [load]);

  // ── Черновик: сам сохраняется на телефоне через полсекунды после правки ──
  React.useEffect(() => {
    if (view !== "edit" || !draft) return;
    const t = setTimeout(() => { if (hasWork(draft)) { const at = Date.now(); writeDraft({ forId: draft.id || "new", at, draft }); setSavedAt(at); } }, 600);
    return () => clearTimeout(t);
  }, [draft, view]);
  // поле текста растёт вместе с текстом
  React.useEffect(() => { const el = taRef.current; if (!el) return;
    el.style.height = "auto"; const full = Math.max(140, el.scrollHeight), cap = Math.round(window.innerHeight * 0.45);
    el.style.height = (textFull ? full : Math.min(full, cap)) + "px"; el.style.overflowY = !textFull && full > cap ? "auto" : "hidden";
    setTextTall(full > cap); }, [draft && draft.content, view, textFull]);

  const open = (base) => {
    const stored = readDraft();
    const forId = base.id || "new";
    if (stored && stored.forId === forId && hasWork(stored.draft)) {
      setDraft({ ...base, ...stored.draft, questions: (stored.draft.questions || []).map(q => ({ id: uid(), ...q })),
        situations: (stored.draft.situations || []).map(toDraftSit), dialogue: withIds(stored.draft.dialogue), build: withBIds(stored.draft.build) });
      setDraftNote(`Восстановлен черновик от ${hhmm(stored.at)}`);
    } else { setDraft(base); setDraftNote(null); }
    // «было при открытии» — чтобы не перезаписывать первый урок раздела без изменений
    setBase(JSON.stringify(serializeExtras({ ...noExtras(), ...base, ...(stored && stored.forId === forId && hasWork(stored.draft) ? {} : {}) })));
    setOpenCard({}); setShowPreview(false); setTextFull(false); setPlay(null);
    setErr(null); setSavedAt(null); setNewSection(false); setAi({ mode: null, busy: false, err: null, material: "", pdf: null, result: null, picked: {} });
    setView("edit");
  };
  const lessonOnly = (l) => ({ id: l.id, role: l.role || "seasonal", module: l.module || "", title: l.title || "", content: l.content || "", sort: l.sort || 0 });
  const startNew = () => open(blankLesson());
  // новый урок сразу в раздел: видит общие части раздела, встаёт последним
  const startNewIn = (role, module) => { const recs = sectionRecs(lessons, role, module);
    open({ ...blankLesson(), role, module, sort: recs.reduce((m, r) => Math.max(m, r.sort || 0), 0) + 1, ...sectionExtras(recs) }); };
  const startEdit = (l) => open({ ...blankLesson(), ...lessonOnly(l), ...sectionExtras(sectionRecs(lessons, l.role || "seasonal", l.module)) });
  // «Начать заново»: черновик стирается, урок — как на сервере (или пустой)
  const discardDraft = () => {
    writeDraft(null); setDraftNote(null);
    setDraft(d => { const orig = d && d.id ? lessons.find(l => l.id === d.id) : null;
      return orig ? { ...blankLesson(), ...lessonOnly(orig), ...sectionExtras(sectionRecs(lessons, orig.role || "seasonal", orig.module)) } : blankLesson(); });
  };
  const leave = () => { setPlay(null); setView("list"); setDraft(null); };                 // ‹ — черновик остаётся
  const cancel = () => { setPlay(null); writeDraft(null); setView("list"); setDraft(null); }; // «Отменить» — черновик стирается

  const patch = (f) => setDraft(d => ({ ...d, ...f }));
  const toSection = (role, module) => setDraft(d => { const recs = sectionRecs(lessons, role, module);
    return { ...d, role, module, ...(recs.length ? sectionExtras(recs) : noExtras()), sort: recs.reduce((m, r) => Math.max(m, r.sort || 0), 0) + 1 }; });
  const setQ = (qid, f) => setDraft(d => ({ ...d, questions: d.questions.map(q => q.id === qid ? { ...q, ...f } : q) }));
  const addQ = () => { const q = blankQ(); setDraft(d => ({ ...d, questions: [...d.questions, q] })); setOpenCard(o => ({ ...o, q: q.id })); };
  const delQ = (qid) => setDraft(d => ({ ...d, questions: d.questions.filter(q => q.id !== qid) }));
  const setS = (sid, f) => setDraft(d => ({ ...d, situations: d.situations.map(x => x.id === sid ? { ...x, ...f } : x) }));
  const addS = () => { const x = blankS(); setDraft(d => ({ ...d, situations: [...(d.situations || []), x] })); setOpenCard(o => ({ ...o, sit: x.id })); };
  const delS = (sid) => setDraft(d => ({ ...d, situations: d.situations.filter(x => x.id !== sid) }));
  const moveS = (i, dir) => setDraft(d => { const j = i + dir; if (j < 0 || j >= d.situations.length) return d; const xs = [...d.situations]; [xs[i], xs[j]] = [xs[j], xs[i]]; return { ...d, situations: xs }; });
  const setDlg = (f) => setDraft(d => ({ ...d, dialogue: typeof f === "function" ? f(d.dialogue) : f }));
  const setGuest = (f) => setDlg(dl => ({ ...dl, guest: { ...dl.guest, ...f } }));
  const setStep = (sid, f) => setDlg(dl => ({ ...dl, steps: dl.steps.map(st => st.id === sid ? { ...st, ...f } : st) }));
  const addStep = (type) => { const st = type === "choice" ? blankChoice() : { id: uid(), type, text: "" }; setDlg(dl => ({ ...dl, steps: [...dl.steps, st] })); setOpenCard(o => ({ ...o, st: st.id })); };
  const delStep = (sid) => setDlg(dl => ({ ...dl, steps: dl.steps.filter(st => st.id !== sid) }));
  const moveStep = (i, dir) => setDlg(dl => { const j = i + dir; if (j < 0 || j >= dl.steps.length) return dl; const xs = [...dl.steps]; [xs[i], xs[j]] = [xs[j], xs[i]]; return { ...dl, steps: xs }; });
  const setOpt = (sid, oi, f) => setDlg(dl => ({ ...dl, steps: dl.steps.map(st => st.id !== sid ? st : { ...st, options: st.options.map((o, k) => k === oi ? { ...o, ...f } : o) }) }));
  const markRight = (sid, oi) => setDlg(dl => ({ ...dl, steps: dl.steps.map(st => st.id !== sid ? st : { ...st, options: st.options.map((o, k) => ({ ...o, correct: k === oi, moodDelta: k === oi ? 1 : (o.correct ? 0 : o.moodDelta) })) }) }));
  const setBld = (f) => setDraft(d => ({ ...d, build: typeof f === "function" ? f(d.build) : f }));
  const setBStep = (sid, f) => setBld(b => ({ ...b, steps: b.steps.map(st => st.id === sid ? { ...st, ...f } : st) }));
  const moveBStep = (i, dir) => setBld(b => { const j = i + dir; if (j < 0 || j >= b.steps.length) return b; const xs = [...b.steps]; [xs[i], xs[j]] = [xs[j], xs[i]]; return { ...b, steps: xs }; });
  const setBOpt = (sid, oi, f) => setBld(b => ({ ...b, steps: b.steps.map(st => st.id !== sid ? st : { ...st, options: st.options.map((o, k) => k === oi ? { ...o, ...f } : o) }) }));
  const markBOk = (sid, oi) => setBld(b => ({ ...b, steps: b.steps.map(st => st.id !== sid ? st : { ...st, options: st.options.map((o, k) => ({ ...o, ok: k === oi })) }) }));
  // коктейли для сборки: штатные и свои из карты бара ресторана
  const [barShared, setBarShared] = React.useState([]);
  const [ckQuery, setCkQuery] = React.useState("");
  React.useEffect(() => {
    let restaurant = ""; try { restaurant = (JSON.parse(localStorage.getItem("sa_profile") || "{}") || {}).restaurant || ""; } catch (e) {}
    if (!restaurant) return; let alive = true;
    rpc("menu_get", { p_restaurant: restaurant }).then(res => { const arr = typeof res === "string" ? JSON.parse(res) : res;
      if (alive && Array.isArray(arr)) setBarShared(arr.filter(x => x && x.name && Array.isArray(x.ing))); }).catch(() => {});
    return () => { alive = false; };
  }, []);
  const moveQ = (i, dir) => setDraft(d => { const j = i + dir; if (j < 0 || j >= d.questions.length) return d; const qs = [...d.questions]; [qs[i], qs[j]] = [qs[j], qs[i]]; return { ...d, questions: qs }; });

  // ── Кнопки форматирования: работают с выделением в поле текста ──
  const fmt = (kind) => {
    const ta = taRef.current; const v = (draft && draft.content) || "";
    const s = ta ? ta.selectionStart : v.length, e = ta ? ta.selectionEnd : v.length;
    let nv, ns, ne;
    if (kind === "bold") {
      const sel = v.slice(s, e) || "текст"; nv = v.slice(0, s) + "**" + sel + "**" + v.slice(e); ns = s + 2; ne = ns + sel.length;
    } else {
      const lineStart = s === 0 ? 0 : v.lastIndexOf("\n", s - 1) + 1;
      let le = v.indexOf("\n", e); if (le < 0) le = v.length;
      const block = v.slice(lineStart, le).split("\n");
      const nb = kind === "list"
        ? (block.every(x => x.startsWith("• ")) ? block.map(x => x.slice(2)) : block.map(x => x.startsWith("• ") ? x : "• " + x.replace(/^•\s*/, "")))
        : block.map(x => /^\*\*.+\*\*$/.test(x) ? x.slice(2, -2) : "**" + (x.replace(/^\*\*|\*\*$/g, "").replace(/^•\s*/, "") || "Заголовок") + "**");
      const out = nb.join("\n"); nv = v.slice(0, lineStart) + out + v.slice(le); ns = lineStart; ne = lineStart + out.length;
    }
    patch({ content: nv });
    requestAnimationFrame(() => { const t = taRef.current; if (t) { t.focus(); try { t.setSelectionRange(ns, ne); } catch (x) {} } });
  };

  // ── Ассистент ──
  const callAI = async (mode, payload) => {
    setAi(a => ({ ...a, mode, busy: true, err: null, result: null }));
    try {
      const r = await fetch("/api/lesson-assist", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, mode, role: draft.role, title: draft.title, ...payload }) });
      const d = await r.json().catch(() => null);
      // всё предложенное — сразу отмечено (и вопросы, и ситуации)
      const list = d && (d.questions || d.situations);
      if (d && d.ok) setAi(a => ({ ...a, busy: false, result: d, picked: list ? Object.fromEntries(list.map((_, i) => [i, true])) : {} }));
      else setAi(a => ({ ...a, busy: false, err: (d && d.error) || (r.status === 404 ? "Ассистент ещё не развёрнут: залей архив на Vercel (функция /api/lesson-assist)." : "Ассистент не ответил — попробуй ещё раз.") }));
    } catch (e) { setAi(a => ({ ...a, busy: false, err: "Нет связи с ассистентом." })); }
  };
  const aiClose = () => setAi(a => ({ ...a, mode: null, busy: false, err: null, result: null }));
  const pickPdf = (file) => {
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) { setAi(a => ({ ...a, err: "PDF больше 10 МБ — сократи или вставь текст" })); return; }
    const fr = new FileReader();
    fr.onload = () => setAi(a => ({ ...a, pdf: { name: file.name, b64: String(fr.result).split(",")[1] }, err: null }));
    fr.readAsDataURL(file);
  };

  // ── Сохранение: проверки понятными словами ──
  const problems = () => {
    if (!draft.title.trim()) return "Нужно название урока.";
    // v40: у каждого вида свои обязательные поля (sitProblem)
    for (let i = 0; i < (draft.situations || []).length; i++) {
      const sp = sitProblem(draft.situations[i]);
      if (sp) return `Ситуация ${i + 1}: ${sp}`;
    }
    if (draft.review && !(draft.review.text || "").trim() && ((draft.review.guest || "").trim() || (draft.review.table || "").trim()))
      return "Книга отзывов: напиши сам отзыв гостя.";
    if (draft.build) {
      const b = draft.build;
      if (!(b.title || "").trim()) return "Сборка: как называется напиток?";
      if (b.steps.length < 2) return "Сборка: нужно хотя бы два шага.";
      for (let i = 0; i < b.steps.length; i++) {
        const st = b.steps[i];
        if (!(st.q || "").trim()) return `Сборка, шаг ${i + 1}: нужен вопрос.`;
        if (st.options.filter(o => (o.t || "").trim()).length < 2) return `Сборка, шаг ${i + 1}: нужно хотя бы два варианта.`;
        if (!st.options.some(o => o.ok && (o.t || "").trim())) return `Сборка, шаг ${i + 1}: отметь верный вариант.`;
      }
    }
    if (draft.dialogue) { const dp = dlgProblem(draft.dialogue); if (dp) return dp; }
    for (let i = 0; i < draft.questions.length; i++) {
      const q = draft.questions[i]; const opts = q.options.filter(o => (o || "").trim());
      if (!(q.q || "").trim()) return `Вопрос ${i + 1}: нужен текст вопроса.`;
      if (opts.length < 2) return `Вопрос ${i + 1}: нужно хотя бы два варианта ответа.`;
      if (!(q.options[q.correct] || "").trim()) return `Вопрос ${i + 1}: отметь верный ответ.`;
    }
    return null;
  };
  const save = async () => {
    const p = problems();
    if (p) {
      setErr(p);
      const n = (re) => { const m = p.match(re); return m ? parseInt(m[1], 10) - 1 : -1; };
      const tgt = [[/^Ситуация (\d+):/, "sit", draft.situations], [/^Вопрос (\d+):/, "q", draft.questions],
        [/^Живой диалог, шаг (\d+):/, "st", draft.dialogue && draft.dialogue.steps], [/^Сборка, шаг (\d+):/, "bst", draft.build && draft.build.steps]]
        .map(([re, sec, arr]) => ({ sec, i: n(re), arr })).find(x => x.i >= 0 && x.arr && x.arr[x.i]);
      if (tgt) { setOpenCard(o => ({ ...o, [tgt.sec]: tgt.arr[tgt.i].id })); setTimeout(() => jump(tgt.sec === "st" ? "dlg" : tgt.sec === "bst" ? "bld" : tgt.sec), 60); }
      else if (/^Живой диалог/.test(p)) setTimeout(() => jump("dlg"), 60);
      else if (/^Сборка/.test(p)) setTimeout(() => jump("bld"), 60);
      else setTimeout(() => jump("lesson"), 60);
      return;
    }
    if (busy) return; setBusy(true); setErr(null);
    const questions = serializeExtras(draft);
    // общие части — на первый урок раздела; сам урок — свой текст
    const recs = sectionRecs(lessons, draft.role, draft.module).filter(r => r.id !== draft.id);
    const anchorIsMe = !recs.length || (draft.id && sectionRecs(lessons, draft.role, draft.module)[0].id === draft.id);
    const me = { id: draft.id, role: draft.role, module: draft.module.trim(), title: draft.title.trim(), content: draft.content, sort: draft.sort || 0, questions: anchorIsMe ? questions : [] };
    const fail = (res) => setErr(res && res.error === "forbidden" ? "Недостаточно прав." : `Не удалось сохранить${res && (res.error || res.message) ? ": " + (res.error || res.message) : "."}`);
    try {
      let res = await rpc("cms_save_lesson", { p_token: token, p_lesson: me });
      if (!(res && res.ok)) { fail(res); setBusy(false); return; }
      // первый урок раздела — общие части (если это не я и они поменялись)
      const anchor = anchorIsMe ? null : recs[0];
      // перезаписываем первый урок, только если общие части изменились или лежали на других уроках
      const scattered = recs.slice(1).some(r => (r.questions || []).length);
      if (anchor && (JSON.stringify(questions) !== base || scattered)) {
        res = await rpc("cms_save_lesson", { p_token: token, p_lesson: { ...anchor, questions } });
        if (!(res && res.ok)) { fail(res); setBusy(false); return; }
      }
      // остальные уроки раздела — только текст (старые разделы: части лежали на разных уроках)
      for (const r of recs.slice(anchorIsMe ? 0 : 1)) if ((r.questions || []).length) await rpc("cms_save_lesson", { p_token: token, p_lesson: { ...r, questions: [] } });
      writeDraft(null); await load(); setView("list"); setDraft(null);
    } catch (e) { setErr("Нет связи. Черновик сохранён на телефоне — попробуй ещё раз."); }
    setBusy(false);
  };
  const remove = async (id) => {
    if (busy) return; setBusy(true); setErr(null);
    try {
      const l = lessons.find(x => x.id === id);
      if (l && (l.questions || []).length) {
        const recs = sectionRecs(lessons, l.role || "seasonal", l.module).filter(r => r.id !== id);
        if (recs.length) await rpc("cms_save_lesson", { p_token: token, p_lesson: { ...recs[0], questions: [...(l.questions || []), ...(recs[0].questions || [])] } });
      }
      const res = await rpc("cms_delete_lesson", { p_token: token, p_id: id });
      if (res && res.ok) {
        // следы шагов урока на сервере (этап 20): ответы, выходы, ключи, результаты
        await rpc("admin_wipe_lesson_traces", { p_token: token, p_ids: ["cms-l-" + id, "cms-p-" + id, "cms-d-" + id, "cms-b-" + id, "cms-q-" + id] }).catch(() => {});
        await load();
      } else setErr("Не удалось удалить.");
    }
    catch (e) { setErr("Нет связи."); }
    setBusy(false); setConfirmDel(null);
  };

  // Светлая тема (правка 160, «выглядит не очень»): поля — тёплое полупрозрачное стекло с
  // бликом по кромке, как у остальных светлых экранов, а не серо-белые плоские коробки.
  const input = { width: "100%", boxSizing: "border-box", borderRadius: 12, padding: "12px 14px", fontFamily: SERIF, fontSize: 14, outline: "none",
    background: dark ? "rgba(20,14,6,0.55)" : "linear-gradient(180deg, rgba(255,252,245,0.82), rgba(250,243,228,0.78))",
    border: `1px solid ${dark ? brd : "rgba(139,106,48,0.26)"}`, color: txt,
    boxShadow: dark ? "none" : "inset 0 1px 0 rgba(255,255,255,0.95), inset 0 2px 6px rgba(120,90,30,0.05)" };
  const iconBtn = { background: "transparent", border: "none", cursor: "pointer", padding: 6, display: "flex", alignItems: "center", flexShrink: 0 };
  const fieldLab = { color: muted, fontFamily: "monospace", fontSize: dark ? 10.5 : 11, letterSpacing: 1.4, fontWeight: "bold", margin: "2px 2px 5px" };   // v40: поле вида
  // Выбранная метка в светлой теме — тонированная в свой цвет, с чёткой рамкой (раньше —
  // тяжёлая заливка, «Новичок» становился тёмно-зелёным пятном)
  const pill = (on, c) => dark
    ? ({ padding: "8px 13px", borderRadius: 12, fontFamily: SERIF, fontSize: 14, cursor: "pointer",
        background: on ? c : "transparent", color: on ? "#1A1008" : c, border: `1px solid ${on ? c : c + "66"}`, fontWeight: on ? "bold" : "normal" })
    : ({ padding: "8px 13px", borderRadius: 12, fontFamily: SERIF, fontSize: 14, cursor: "pointer",
        background: on ? `linear-gradient(180deg, ${c}26, ${c}14)` : "rgba(255,252,245,0.6)", color: c,
        border: `${on ? 1.5 : 1}px solid ${on ? c : c + "55"}`, fontWeight: on ? "bold" : "normal",
        boxShadow: on ? `inset 0 1px 0 rgba(255,255,255,0.9), 0 2px 6px ${c}22` : "inset 0 1px 0 rgba(255,255,255,0.9)" });
  const primary = { width: "100%", padding: "14px", borderRadius: 14, border: "none", cursor: "pointer", fontFamily: SERIF, fontSize: 15, fontWeight: "bold",
    color: "#1F160A", background: "linear-gradient(135deg, #E2C487, #A67C3A)", boxShadow: "inset 0 1px 0 rgba(255,255,255,0.45), 0 6px 18px rgba(166,124,58,0.3)" };
  const ghost = dark
    ? { width: "100%", padding: "13px", borderRadius: 14, cursor: "pointer", fontFamily: SERIF, fontSize: 14, background: "transparent", color: muted, border: `1px solid ${brd}` }
    : { width: "100%", padding: "13px", borderRadius: 14, cursor: "pointer", fontFamily: SERIF, fontSize: 14, color: gold,
        background: "linear-gradient(180deg, rgba(255,252,245,0.7), rgba(248,240,222,0.6))", border: "1px solid rgba(139,106,48,0.32)",
        boxShadow: "inset 0 1px 0 rgba(255,255,255,0.95), 0 2px 8px rgba(120,90,30,0.08)" };
  const aiBtn = { display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 12px", borderRadius: 12, cursor: "pointer", fontFamily: SERIF, fontSize: 13,
    background: dark ? "rgba(214,178,102,0.10)" : "linear-gradient(180deg, rgba(255,250,238,0.85), rgba(244,232,206,0.8))", color: gold,
    border: `1px solid ${dark ? gold + "55" : "rgba(139,106,48,0.38)"}`, boxShadow: dark ? "none" : "inset 0 1px 0 rgba(255,255,255,0.95)" };
  const header = (title, back) => (
    <div style={T.lessHead}><button style={T.backBtn2} onClick={back} aria-label="Назад">‹</button><div style={T.lessHeadTitle}>{title}</div></div>);

  // ═════ СПИСОК ═════
  if (view === "list") {
    const groups = TRACKS.map(t => {
      const mine = lessons.filter(l => (l.role || "seasonal") === t.id);
      const secs = {}; mine.forEach(l => { const k = (l.module || "").trim() || "Свой раздел"; (secs[k] = secs[k] || []).push(l); });
      return { t, mine, secs: Object.entries(secs) };
    }).filter(g => g.mine.length);
    return (
      <div style={T.screen}>
      {ceHint && ceSteps.length ? (
        <HintBubble a11y={a11y} text={ceSteps[ceStep]} arrow="up"
          step={ceStep + 1} total={ceSteps.length}
          onNext={ceStep >= ceSteps.length - 1 ? null : () => setCEStep(v => v + 1)}
          onClose={ceHintDone} />
      ) : null}
        {header("Редактор контента", onBack)}
        <div style={{ ...T.lessBody, flex: 1, overflowY: "auto", padding: "12px 16px 44px" }}>
          <div style={{ color: muted, fontSize: 13, lineHeight: 1.5, marginBottom: 6 }}>Свои уроки под твой ресторан — сотрудники увидят их в своём треке рядом со штатными.</div>
          {loading ? <SkelCards a11y={!!T.a11y} rows={3} h={74} style={{ padding: "12px 0" }} />
          : loadErr ? <div style={{ textAlign: "center", padding: "40px 0", color: muted }}>Не удалось загрузить. <span onClick={load} style={{ color: gold, cursor: "pointer" }}>Повторить</span></div>
          : groups.length === 0 ? (
            <div style={{ ...G({ padding: "34px 22px", marginTop: 12 }), textAlign: "center" }}>
              <div style={{ display: "flex", justifyContent: "center", marginBottom: 10 }}>{MOD_SVG["📘"](gold, 34)}</div>
              <div style={{ color: txt, fontFamily: SERIF, fontWeight: "bold", fontSize: 16, marginBottom: 6 }}>Пока ни одного своего урока</div>
              <div style={{ color: muted, fontSize: 13, lineHeight: 1.5 }}>Добавь первый — можно вставить регламент, и ассистент соберёт из него урок.</div>
            </div>
          ) : groups.map(({ t, mine, secs }) => (
            <div key={t.id}>
              <SectionLabel a11y={a11y} right={`${mine.length} ${mine.length === 1 ? "урок" : mine.length < 5 ? "урока" : "уроков"}`}>{t.label.toUpperCase()}</SectionLabel>
              <div className="sa-g2">{secs.map(([name, ls]) => {
                const ic = customIcon(name);
                return (
                  <div key={name} style={G({ padding: "12px 12px 6px", marginBottom: 10, borderLeft: `3px solid ${t.color}` })}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
                      <span style={{ width: 34, height: 34, borderRadius: 10, display: "grid", placeItems: "center", flexShrink: 0, border: `1px solid ${t.color}55`, background: `${t.color}14` }}>{MOD_SVG[ic] ? MOD_SVG[ic](trackInk(t), 22) : null}</span>
                      <span style={{ flex: 1, minWidth: 0 }}>
                        <span style={{ display: "block", color: txt, fontFamily: SERIF, fontSize: 15, fontWeight: "bold" }}>{name}</span>
                        <span style={{ display: "block", color: muted, fontSize: 11.5 }}>{(() => { const ex = sectionExtras(sectionRecs(lessons, t.id, name));
                          return [`уроков ${ls.length}`, ex.situations.length ? `практика ${ex.situations.length}` : "", ex.dialogue ? "диалог" : "", ex.build ? "сборка" : "", ex.questions.length ? `тест ${ex.questions.length} вопр.` : "без теста"].filter(Boolean).join(" · "); })()}</span>
                      </span>
                    </div>
                    {ls.map(l => {
                      const allQ = Array.isArray(l.questions) ? l.questions : [];
                      const hasDlg = allQ.some(q => q && q.kind === "dialogue"), hasBld = allQ.some(q => q && q.kind === "build");
                      const nq = allQ.filter(q => !isSit(q) && !(q && (q.kind === "dialogue" || q.kind === "build"))).length, ns = allQ.filter(isSit).length;
                      const asking = confirmDel === l.id;
                      return (
                        <div key={l.id} style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 0 8px 44px", borderTop: `1px solid ${brd}` }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ color: txt, fontSize: 14, fontFamily: SERIF }}>{l.title || "Без названия"}</div>
                            <div style={{ color: muted, fontSize: 11.5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{(l.content || "").replace(/\*\*/g, "").replace(/\s+/g, " ").trim().slice(0, 60) || "текст не написан"}</div>
                          </div>
                          {asking ? (<>
                            <button onClick={() => remove(l.id)} disabled={busy} style={{ ...iconBtn, color: TN.bad, fontFamily: SERIF, fontSize: 13 }}>Удалить</button>
                            <button onClick={() => setConfirmDel(null)} style={{ ...iconBtn, color: muted, fontFamily: SERIF, fontSize: 13 }}>Нет</button>
                          </>) : (<>
                            <button onClick={() => startEdit(l)} style={iconBtn} aria-label="Изменить">{ico.pencil(muted)}</button>
                            <button onClick={() => setConfirmDel(l.id)} style={iconBtn} aria-label="Удалить">{ico.trash(TN.bad)}</button>
                          </>)}
                        </div>);
                    })}
                    <button onClick={() => startNewIn(t.id, name)} style={{ ...iconBtn, color: gold, fontFamily: SERIF, fontSize: 13, gap: 5, padding: "8px 0 6px 44px" }}>{ico.plus(gold, 14)} Урок в раздел</button>
                  </div>);
              })}</div>
            </div>
          ))}
          {err && <div style={{ color: TN.bad, fontSize: 12.5, margin: "6px 0 10px", textAlign: "center" }}>{err}</div>}
          {!loading && !loadErr && <button onClick={startNew} style={{ ...primary, marginTop: 14, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>{ico.plus("#1F160A")} Новый урок</button>}
        </div>
      </div>
    );
  }

  // ═════ УРОК ═════
  const track = trackOf(draft.role);
  const sections = [...new Set(lessons.filter(l => (l.role || "seasonal") === draft.role).map(l => (l.module || "").trim()).filter(Boolean))];
  const typingNew = newSection || (draft.module && !sections.includes(draft.module.trim()));
  const secIcon = customIcon(draft.module);
  const nPicked = Object.values(ai.picked || {}).filter(Boolean).length;
  const editing = !!draft.id;
  // свёрнутая карточка: номер и вид, начало текста, ✓ «заполнено» / «!» — нет; порядок — прямо в строке
  const cardRow = (sec, id, label, text, ok, i, len, move) => (
    <div key={id} data-card={sec} onClick={() => toggleCard(sec, id)} role="button" aria-label={label + " — раскрыть"}
      style={{ ...G({ padding: "9px 10px 9px 12px", marginBottom: 6 }), display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ color: gold, fontFamily: "monospace", fontSize: 10.5, letterSpacing: 1.4, fontWeight: "bold" }}>{label}</div>
        <div style={{ color: text ? txt : muted, fontFamily: SERIF, fontSize: 13.5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginTop: 2 }}>{text || "не заполнено"}</div>
      </div>
      <span title={ok ? "заполнено" : "не заполнено"} style={{ width: 20, height: 20, borderRadius: "50%", flexShrink: 0, display: "grid", placeItems: "center", fontSize: 11, fontWeight: "bold",
        color: ok ? TN.good : TN.mid, border: `1px solid ${ok ? TN.good : TN.mid}88` }}>{ok ? "✓" : "!"}</span>
      <button onClick={e => { e.stopPropagation(); move(i, -1); }} disabled={i === 0} style={{ ...iconBtn, padding: 4, opacity: i === 0 ? 0.3 : 1 }} aria-label="Выше">{ico.up(muted)}</button>
      <button onClick={e => { e.stopPropagation(); move(i, 1); }} disabled={i === len - 1} style={{ ...iconBtn, padding: 4, opacity: i === len - 1 ? 0.3 : 1 }} aria-label="Ниже">{ico.down(muted)}</button>
    </div>);
  const filled = (opts, isOk) => opts.filter(o => ((o.t != null ? o.t : o.text != null ? o.text : o) || "").trim()).length >= 2 && opts.some((o, k) => isOk(o, k) && ((o.t != null ? o.t : o.text != null ? o.text : o) || "").trim());
  const navItems = [["lesson", "Урок"], ["sit", "Практика" + ((draft.situations || []).length ? " " + draft.situations.length : "")],
    ["dlg", "Диалог" + (draft.dialogue ? " " + draft.dialogue.steps.length : "")], ...(draft.role === "bar" || draft.build ? [["bld", "Сборка" + (draft.build ? " " + draft.build.steps.length : "")]] : []),
    ["q", "Тест" + (draft.questions.length ? " " + draft.questions.length : "")], ["prev", "Просмотр"]];
  // полоска разделов — одна разметка для неё самой и для её копии сверху (v54)
  const navBg = { background: dark ? "rgba(23,18,9,0.94)" : "rgba(242,233,212,0.94)", WebkitBackdropFilter: "blur(10px)", backdropFilter: "blur(10px)", borderBottom: `1px solid ${brd}` };
  const navRow = navItems.map(([k, l]) => { const m = l.match(/^(\S+)(?: (\d+))?$/) || [l, l, ""]; return (
    <button key={k} onClick={() => jump(k)} style={{ ...aiBtn, flex: "1 1 0", minWidth: 0, padding: "5px 0", flexDirection: "column", gap: 0, justifyContent: "center", lineHeight: 1.15, borderRadius: 10 }}>
      <span data-navlabel="1" style={{ fontSize: 10.5, letterSpacing: -0.2, maxWidth: "100%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m[1]}</span>
      <span style={{ fontSize: 10.5, color: muted, fontFamily: "monospace" }}>{m[2] || "·"}</span>
    </button>); });
  const otherRecs = sectionRecs(lessons, draft.role, draft.module).filter(r => r.id !== draft.id);
  const sectionText = [...otherRecs.map(r => r.content || ""), draft.content].join("\n\n").trim();
  const secLabel = (draft.module || "").trim() || "Свой раздел";
  // ── v40: проба — те же экраны, что у сотрудника, с черновиком; без записи прогресса, ошибок,
  // активности и без сервера: состояние раунда — здесь же (pvChoice / pvNext), колбэки — пустые ──
  const sitsAll = draft.situations || [];
  const sitsOk = sitsAll.filter(x => !sitProblem(x));
  // шаги раздела — как их соберёт приложение (lib/custom-modules.js): тот же формат, что уйдёт на сервер
  const playSteps = (sits) => {
    const me = { id: draft.id || "new", title: draft.title.trim() || "Этот урок", content: draft.content || "", sort: draft.sort || 0 };
    const recs = [...otherRecs.map(r => ({ ...r, questions: [] })), me].sort(bySort);
    recs[0] = { ...recs[0], questions: serializeExtras({ ...draft, situations: sits }) };
    return sectionSteps(secLabel, recs, draft.role, track.color);
  };
  const playPractice = async () => {
    if (playBusy) return;
    if (!sitsOk.length) { const i = sitsAll.findIndex(x => sitProblem(x)); setPlayMsg(i >= 0 ? `Ситуация ${i + 1}: ${sitProblem(sitsAll[i])}` : "Сначала добавь ситуацию."); return; }
    let m = tbRef.current;
    if (!m) { setPlayBusy(true); try { m = await import("./table"); tbRef.current = m; } catch (e) { m = null; } setPlayBusy(false); }
    if (!m || !m.TablePractice) { setPlayMsg("Не удалось открыть игру — проверь связь и попробуй ещё раз."); return; }
    const steps = playSteps(sitsOk);
    const lesson = steps.find(s => s.type === "practice");
    let profile = null; try { profile = JSON.parse(localStorage.getItem("sa_profile") || "null"); } catch (e) {}
    setPlayMsg(null);
    setPlay({ kind: "sit", key: Date.now(), lesson, mod: { id: "cms-preview", title: secLabel, color: track.color, lessons: steps }, profile,
      ps: { ...practiceRound(lesson.situations, []), isAnswered: false } });   // как в игре: до 6 случайных, варианты перемешаны
  };
  const playDialogue = () => {
    const p = dlgProblem(draft.dialogue);
    if (p) { setPlayMsg(p); return; }
    const st = playSteps([]).find(s => s.type === "dialogue");   // с итоговым шагом result — как в программе
    if (st) { setPlayMsg(null); setPlay({ kind: "dlg", key: Date.now(), dialogue: st.dialogue }); }
  };
  const closePlay = () => setPlay(null);
  const setPlayPs = (v) => setPlay(p => p && p.kind === "sit" ? { ...p, ps: typeof v === "function" ? v(p.ps) : v } : p);
  const playPick = (i) => {
    const ps = play && play.ps; const sit = ps && !ps.isAnswered ? (ps.situations || [])[ps.step] : null;
    if (sit) vibrate(i === sit.correct ? ((ps.combo || 0) + 1 >= 2 ? "medium" : "light") : "error");
    setPlayPs(x => pvChoice(x, i));
  };
  const playNext = () => setPlayPs(x => pvNext(x));
  return (
    <div style={T.screen} className="sa-edscreen">
      {header(editing ? "Изменить урок" : "Новый урок", leave)}
      <div style={{ ...T.lessBody, flex: 1, overflowY: "visible", padding: "0 16px 150px" }} className={two ? "sa-ed2" : undefined}>
        {edWrap("sa-ed2-f", null, <>
        {/* навигатор по разделам — закреплён сверху при прокрутке (правка 162) */}
        {/* все метки — в одну строку без прокрутки (правка 164: у бара «Просмотр» уезжал за край) */}
        <div data-ednav="" ref={navRef} style={{ position: "relative", zIndex: 6, margin: "0 -16px 6px", padding: "7px 8px", display: "flex", gap: 3, ...navBg }}>
          {navRow}
        </div>
        {navPin && typeof document !== "undefined" ? createPortal(
          <div data-ednav-pin="" className="sa-ednav-pin" style={{ left: navPin.left, width: navPin.width, ...navBg }}>{navRow}</div>, document.body) : null}
        {draftNote ? (
          <div style={{ ...G({ padding: "9px 12px", marginBottom: 6 }), display: "flex", alignItems: "center", gap: 8, color: muted, fontSize: 12.5 }}>
            <span style={{ flex: 1 }}>{draftNote}</span>
            <button onClick={discardDraft} style={{ ...iconBtn, color: gold, fontFamily: SERIF, fontSize: 12.5, padding: 2 }}>Начать заново</button>
          </div>) : null}

        <SectionLabel a11y={a11y}>ДЛЯ КОГО</SectionLabel>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {TRACKS.map(t => <button key={t.id} disabled={!!draft.id} onClick={() => { toSection(t.id, ""); setNewSection(false); }} style={{ ...pill(draft.role === t.id, trackInk(t)), opacity: draft.id && draft.role !== t.id ? 0.4 : 1 }}>{t.label}</button>)}
        </div>

        <SectionLabel a11y={a11y}>РАЗДЕЛ</SectionLabel>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: typingNew ? 8 : 0 }}>
          {sections.map(s => <button key={s} disabled={!!draft.id} onClick={() => { toSection(draft.role, s); setNewSection(false); }} style={{ ...pill(!typingNew && draft.module.trim() === s, trackInk(track)), opacity: draft.id && draft.module.trim() !== s ? 0.4 : 1 }}>{s}</button>)}
          {!draft.id ? <button onClick={() => { setNewSection(true); toSection(draft.role, ""); }} style={{ ...pill(typingNew, gold), display: "inline-flex", alignItems: "center", gap: 4 }}>{ico.plus(typingNew && dark ? "#1A1008" : gold, 14)} Новый</button> : null}
        </div>
        {typingNew && !draft.id ? <input style={input} value={draft.module} onChange={e => patch({ module: e.target.value })} placeholder="Напр. «Наше вино»" autoFocus={newSection} /> : null}
        {draft.id ? <div style={{ color: muted, fontSize: 11.5, marginTop: 6 }}>Урок остаётся в своём разделе: практика, диалог и тест — общие для раздела.</div> : null}
        {draft.module.trim() ? (
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8, color: muted, fontSize: 12 }}>
            {MOD_SVG[secIcon] ? MOD_SVG[secIcon](trackInk(track), 18) : null}<span>так раздел будет выглядеть у сотрудников — иконка по смыслу названия, цвет трека</span>
          </div>) : null}

        <SectionLabel a11y={a11y}>НАЗВАНИЕ УРОКА</SectionLabel>
        <input style={input} value={draft.title} onChange={e => patch({ title: e.target.value })} placeholder="Напр. «Базовые сорта белого»" />

        <div ref={secRef.lesson} />
        <SectionLabel a11y={a11y}>ТЕКСТ УРОКА</SectionLabel>
        <div style={{ display: "flex", gap: 6, marginBottom: 8, flexWrap: "wrap" }}>
          <button onClick={() => fmt("bold")} style={{ ...aiBtn, color: txt, borderColor: brd, background: "transparent", fontWeight: "bold" }} aria-label="Жирный">Ж</button>
          <button onClick={() => fmt("list")} style={{ ...aiBtn, color: txt, borderColor: brd, background: "transparent" }}>• Список</button>
          <button onClick={() => fmt("head")} style={{ ...aiBtn, color: txt, borderColor: brd, background: "transparent" }}>Заголовок</button>
        </div>
        <textarea ref={taRef} style={{ ...input, minHeight: 140, resize: "none", lineHeight: 1.6, overflow: "hidden" }} value={draft.content}
          onChange={e => patch({ content: e.target.value })} placeholder={"Напиши текст урока — или собери его ассистентом из регламента ниже.\n\n**Заголовок**\n• пункт списка"} />
        {textTall ? <button onClick={() => setTextFull(v => !v)} style={{ ...iconBtn, color: gold, fontFamily: SERIF, fontSize: 12.5, padding: "6px 2px" }}>{textFull ? "Свернуть текст ▴" : "Показать текст целиком ▾"}</button> : null}

        {/* Ассистент */}
        <div style={G({ padding: "12px 12px", marginTop: 10 })}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
            {UI_SVG.sparkle ? UI_SVG.sparkle(gold, 17) : null}
            <span style={{ color: gold, fontFamily: "monospace", fontSize: 10.5, letterSpacing: 1.8, fontWeight: "bold" }}>АССИСТЕНТ</span>
            <span style={{ color: muted, fontSize: 11.5 }}>· всё черновиком, сохраняешь ты</span>
          </div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            <button onClick={() => setAi(a => ({ ...a, mode: "lesson", err: null, result: null }))} style={aiBtn}>Урок из текста</button>
            <button onClick={() => callAI("improve", { text: draft.content })} style={{ ...aiBtn, opacity: draft.content.trim().length >= 40 ? 1 : 0.45 }} disabled={draft.content.trim().length < 40}>Улучшить текст</button>
            <button onClick={() => callAI("situations", { text: sectionText })} style={{ ...aiBtn, opacity: sectionText.length >= 40 ? 1 : 0.45 }} disabled={sectionText.length < 40}>Придумать ситуации</button>
            <button onClick={() => setAi(a => ({ ...a, mode: "dialogue", err: null, result: null }))} style={{ ...aiBtn, opacity: sectionText.length >= 40 ? 1 : 0.45 }} disabled={sectionText.length < 40}>Собрать диалог</button>
            <button onClick={() => callAI("questions", { text: sectionText })} style={{ ...aiBtn, opacity: sectionText.length >= 40 ? 1 : 0.45 }} disabled={sectionText.length < 40}>Придумать вопросы</button>
          </div>
          {ai.mode === "lesson" && !ai.result ? (
            <div style={{ marginTop: 10 }}>
              <textarea style={{ ...input, minHeight: 110, lineHeight: 1.5, fontSize: 13 }} value={ai.material} onChange={e => setAi(a => ({ ...a, material: e.target.value }))}
                placeholder="Вставь регламент, заметки или список правил — ассистент сделает из этого урок в стиле приложения" />
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
                <label style={{ ...aiBtn, background: "transparent" }}>{ico.file(gold)} {ai.pdf ? ai.pdf.name.slice(0, 24) : "Прикрепить PDF"}
                  <input type="file" accept="application/pdf" style={{ display: "none" }} onChange={e => pickPdf(e.target.files && e.target.files[0])} /></label>
                <button onClick={() => callAI("lesson", { text: ai.material, pdfBase64: ai.pdf ? ai.pdf.b64 : "" })} disabled={ai.busy || (!ai.material.trim() && !ai.pdf)}
                  style={{ ...primary, width: "auto", padding: "9px 14px", fontSize: 13.5, opacity: ai.busy || (!ai.material.trim() && !ai.pdf) ? 0.5 : 1 }}>{ai.busy ? "Пишу урок…" : "Собрать урок"}</button>
                <button onClick={aiClose} style={{ ...iconBtn, color: muted, fontFamily: SERIF, fontSize: 13 }}>Отмена</button>
              </div>
            </div>) : null}
          {ai.mode === "dialogue" && !ai.result && !ai.busy ? (
            <div style={{ marginTop: 10 }}>
              <input style={{ ...input, fontSize: 13 }} value={ai.idea || ""} onChange={e => setAi(a => ({ ...a, idea: e.target.value }))} placeholder="О чём разговор (необязательно): «гость пришёл первым и ждёт коллегу»" />
              <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                <button onClick={() => callAI("dialogue", { text: sectionText, idea: ai.idea || "" })} style={{ ...primary, width: "auto", padding: "9px 14px", fontSize: 13.5 }}>Собрать диалог</button>
                <button onClick={aiClose} style={{ ...iconBtn, color: muted, fontFamily: SERIF, fontSize: 13 }}>Отмена</button>
              </div>
            </div>) : null}
          {ai.busy && ai.mode !== "lesson" ? <div style={{ color: muted, fontSize: 13, marginTop: 10 }}>{ai.mode === "improve" ? "Улучшаю текст…" : ai.mode === "situations" ? "Придумываю ситуации…" : ai.mode === "dialogue" ? "Собираю диалог…" : ai.mode === "build" ? "Собираю сборку по рецепту…" : ai.mode === "review" ? "Пишу отзыв гостя…" : "Придумываю вопросы…"}</div> : null}
          {ai.result && ai.mode === "review" ? (
            <div style={{ marginTop: 10, borderTop: `1px solid ${brd}`, paddingTop: 10 }}>
              <div style={{ color: txt, fontFamily: SERIF, fontStyle: "italic", fontSize: 13.5, lineHeight: 1.5 }}>«{ai.result.review.text}»</div>
              <div style={{ color: muted, fontSize: 12, marginTop: 4 }}>— {ai.result.review.guest}{ai.result.review.table ? ", " + ai.result.review.table : ""}</div>
              <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                <button onClick={() => { patch({ review: { ...ai.result.review } }); aiClose(); }} style={{ ...primary, width: "auto", padding: "9px 14px", fontSize: 13.5 }}>{draft.review ? "Заменить отзыв" : "Взять в раздел"}</button>
                <button onClick={aiClose} style={{ ...iconBtn, color: muted, fontFamily: SERIF, fontSize: 13 }}>Отмена</button>
              </div>
            </div>) : null}
          {ai.result && ai.mode === "build" ? (
            <div style={{ marginTop: 10, borderTop: `1px solid ${brd}`, paddingTop: 10 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                <span style={{ width: 16, height: 16, borderRadius: 5, background: ai.result.build.tint, border: `1px solid ${brd}` }} />
                <span style={{ color: txt, fontFamily: SERIF, fontSize: 14.5, fontWeight: "bold" }}>{ai.result.build.title}</span>
                <span style={{ color: muted, fontSize: 12 }}>· {(GLASSES.find(g => g[0] === ai.result.build.glass) || ["", ""])[1]} · шагов: {ai.result.build.steps.length}</span>
              </div>
              {ai.result.build.steps.map((st, i) => <div key={i} style={{ color: muted, fontSize: 12.5, lineHeight: 1.45 }}>{i + 1}. <b style={{ color: txt }}>{st.label}</b> — {(st.options.find(o => o.ok) || {}).t}</div>)}
              <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                <button onClick={() => { setBld(withBIds(ai.result.build)); aiClose(); }} style={{ ...primary, width: "auto", padding: "9px 14px", fontSize: 13.5 }}>{draft.build ? "Заменить сборку" : "Взять в урок"}</button>
                <button onClick={aiClose} style={{ ...iconBtn, color: muted, fontFamily: SERIF, fontSize: 13 }}>Отмена</button>
              </div>
            </div>) : null}
          {ai.result && ai.mode === "dialogue" ? (
            <div style={{ marginTop: 10, borderTop: `1px solid ${brd}`, paddingTop: 10 }}>
              <div style={{ color: txt, fontFamily: SERIF, fontSize: 14, fontWeight: "bold", marginBottom: 6 }}>{ai.result.dialogue.guest.avatar} {ai.result.dialogue.guest.name} · {MOODS[ai.result.dialogue.guest.mood - 1]}</div>
              <div style={{ color: muted, fontSize: 12.5, marginBottom: 8 }}>{ai.result.dialogue.guest.context}</div>
              <div style={{ color: muted, fontSize: 12.5 }}>{ai.result.dialogue.steps.length} шагов · выборов: {ai.result.dialogue.steps.filter(x => x.type === "choice").length}</div>
              <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                <button onClick={() => { setDlg(withIds(ai.result.dialogue)); aiClose(); }} style={{ ...primary, width: "auto", padding: "9px 14px", fontSize: 13.5 }}>{draft.dialogue ? "Заменить диалог" : "Взять в урок"}</button>
                <button onClick={aiClose} style={{ ...iconBtn, color: muted, fontFamily: SERIF, fontSize: 13 }}>Отмена</button>
              </div>
            </div>) : null}
          {ai.err ? <div style={{ color: TN.bad, fontSize: 12.5, marginTop: 10, lineHeight: 1.45 }}>{ai.err}</div> : null}
          {ai.result && ai.mode === "lesson" ? (
            <div style={{ marginTop: 10, borderTop: `1px solid ${brd}`, paddingTop: 10 }}>
              <div style={{ color: txt, fontFamily: SERIF, fontWeight: "bold", fontSize: 15, marginBottom: 6 }}>{ai.result.title || "Урок"}</div>
              <div style={{ maxHeight: 260, overflowY: "auto" }}><Rich text={ai.result.content} T={T} color={track.color} a11y={a11y} /></div>
              <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
                <button onClick={() => { patch({ content: ai.result.content, title: draft.title.trim() ? draft.title : (ai.result.title || "") }); aiClose(); }} style={{ ...primary, width: "auto", padding: "9px 14px", fontSize: 13.5 }}>{draft.content.trim() ? "Заменить текст" : "Взять в урок"}</button>
                {draft.content.trim() ? <button onClick={() => { patch({ content: draft.content.replace(/\s+$/, "") + "\n\n" + ai.result.content }); aiClose(); }} style={{ ...aiBtn }}>Добавить в конец</button> : null}
                <button onClick={aiClose} style={{ ...iconBtn, color: muted, fontFamily: SERIF, fontSize: 13 }}>Отмена</button>
              </div>
            </div>) : null}
          {ai.result && ai.mode === "improve" ? (
            <div style={{ marginTop: 10, borderTop: `1px solid ${brd}`, paddingTop: 10 }}>
              <div style={{ color: gold, fontFamily: "monospace", fontSize: 10.5, letterSpacing: 1.6, fontWeight: "bold", marginBottom: 6 }}>СТАЛО</div>
              <div style={{ maxHeight: 260, overflowY: "auto" }}><Rich text={ai.result.content} T={T} color={track.color} a11y={a11y} /></div>
              <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                <button onClick={() => { patch({ content: ai.result.content }); aiClose(); }} style={{ ...primary, width: "auto", padding: "9px 14px", fontSize: 13.5 }}>Принять</button>
                <button onClick={aiClose} style={{ ...aiBtn }}>Оставить как было</button>
              </div>
            </div>) : null}
          {ai.result && ai.mode === "situations" ? (
            <div style={{ marginTop: 10, borderTop: `1px solid ${brd}`, paddingTop: 6 }}>
              {ai.result.situations.map((x, i) => { const g = genreOfS(x); return (
                <div key={i} data-ai-sit={g} onClick={() => setAi(a => ({ ...a, picked: { ...a.picked, [i]: !a.picked[i] } }))} style={{ display: "flex", gap: 9, padding: "8px 0", cursor: "pointer", borderBottom: `1px solid ${brd}` }}>
                  <span style={{ width: 20, height: 20, borderRadius: 6, flexShrink: 0, marginTop: 1, display: "grid", placeItems: "center",
                    border: `1.5px solid ${ai.picked[i] ? TN.good : brd}`, background: ai.picked[i] ? TN.good : "transparent" }}>{ai.picked[i] ? ico.check(dark ? "#1A1008" : "#fff") : null}</span>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ color: gold, fontFamily: "monospace", fontSize: dark ? 10.5 : 11, letterSpacing: 1.4, fontWeight: "bold" }}>{GENRE_RU[g].toUpperCase()}</div>
                    {g === "empathy" && x.guestThought ? <div style={{ color: muted, fontFamily: SERIF, fontStyle: "italic", fontSize: dark ? 12.5 : 13, lineHeight: 1.35, marginBottom: 2 }}>Мысли гостя: «{unq(String(x.guestThought).trim())}»</div> : null}
                    <div style={{ color: txt, fontFamily: SERIF, fontSize: 13.5, lineHeight: 1.35 }}>{x.emoji ? x.emoji + " " : ""}{g === "truefalse" ? "«" + unq(String(x.statement || "").trim()) + "»" : g === "complete" ? x.start + " …" : x.scene}</div>
                    <div style={{ color: TN.good, fontSize: dark ? 12 : 13, marginTop: 2 }}>верно: {g === "complete" ? "… " : ""}{sitAnswer(x)}</div>
                  </div>
                </div>); })}
              <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                <button disabled={!nPicked} onClick={() => { const add = ai.result.situations.filter((_, i) => ai.picked[i]).map(x => toDraftSit({ ...x, id: uid() })); setDraft(d => ({ ...d, situations: [...(d.situations || []), ...add] })); aiClose(); }}
                  style={{ ...primary, width: "auto", padding: "9px 14px", fontSize: 13.5, opacity: nPicked ? 1 : 0.5 }}>Добавить выбранные ({nPicked})</button>
                <button onClick={aiClose} style={{ ...iconBtn, color: muted, fontFamily: SERIF, fontSize: 13 }}>Отмена</button>
              </div>
            </div>) : null}
          {ai.result && ai.mode === "questions" ? (
            <div style={{ marginTop: 10, borderTop: `1px solid ${brd}`, paddingTop: 6 }}>
              {ai.result.questions.map((q, i) => (
                <div key={i} onClick={() => setAi(a => ({ ...a, picked: { ...a.picked, [i]: !a.picked[i] } }))} style={{ display: "flex", gap: 9, padding: "8px 0", cursor: "pointer", borderBottom: `1px solid ${brd}` }}>
                  <span style={{ width: 20, height: 20, borderRadius: 6, flexShrink: 0, marginTop: 1, display: "grid", placeItems: "center",
                    border: `1.5px solid ${ai.picked[i] ? TN.good : brd}`, background: ai.picked[i] ? TN.good : "transparent" }}>{ai.picked[i] ? ico.check(dark ? "#1A1008" : "#fff") : null}</span>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ color: txt, fontFamily: SERIF, fontSize: 13.5, fontWeight: "bold", lineHeight: 1.35 }}>{q.q}</div>
                    <div style={{ color: TN.good, fontSize: 12, marginTop: 2 }}>верно: {q.options[q.correct]}</div>
                  </div>
                </div>))}
              <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                <button disabled={!nPicked} onClick={() => { const add = ai.result.questions.filter((_, i) => ai.picked[i]).map(q => ({ id: uid(), img: "", ...q })); setDraft(d => ({ ...d, questions: [...d.questions, ...add] })); aiClose(); }}
                  style={{ ...primary, width: "auto", padding: "9px 14px", fontSize: 13.5, opacity: nPicked ? 1 : 0.5 }}>Добавить выбранные ({nPicked})</button>
                <button onClick={aiClose} style={{ ...iconBtn, color: muted, fontFamily: SERIF, fontSize: 13 }}>Отмена</button>
              </div>
            </div>) : null}
        </div>

        {/* Общие части раздела (правка 161): одни на весь раздел, сотрудник проходит их после всех уроков */}
        <div style={{ margin: "22px 0 4px", padding: "12px 14px", borderRadius: 14, border: `1px solid ${track.color}66`, background: `${track.color}12` }}>
          <div style={{ color: dark ? track.color : track.ink, fontFamily: "monospace", fontSize: 10.5, letterSpacing: 1.6, fontWeight: "bold" }}>РАЗДЕЛ «{secLabel.toUpperCase()}» — ДЛЯ ВСЕХ УРОКОВ</div>
          <div style={{ color: muted, fontSize: 12.5, lineHeight: 1.45, marginTop: 4 }}>
            Практика, диалог{draft.role === "bar" ? ", сборка" : ""} и тест — общие для раздела: сотрудник проходит их после всех уроков.{otherRecs.length ? ` В разделе ещё ${otherRecs.length} ${otherRecs.length === 1 ? "урок" : otherRecs.length < 5 ? "урока" : "уроков"} — ассистент учтёт их текст.` : ""}
          </div>
        </div>
        {/* Практика ситуаций — между текстом и тестом, как шаги в программе (правка 158) */}
        <div ref={secRef.sit} />
        <SectionLabel a11y={a11y} right={(draft.situations || []).length ? `${draft.situations.length}` : "необязательно"}>ПРАКТИКА СИТУАЦИЙ</SectionLabel>
        {!(draft.situations || []).length ? <div style={{ color: muted, fontSize: dark ? 12.5 : 13, lineHeight: 1.45, margin: "-2px 2px 8px" }}>Шесть видов, как в штатных уроках: «Что делаешь?», «Найди ошибку», «Глазами гостя», «Правда или миф», «Собери правило», «Быстрое решение». В игре — до 6 случайных, со звёздами.</div> : null}
        {(draft.situations || []).map((x, si) => { const g = genreOfS(x); return openCard.sit !== x.id
          ? cardRow("sit", x.id, `СИТУАЦИЯ ${si + 1} · ${GENRE_RU[g].toUpperCase()}`, sitHead(x), !sitProblem(x), si, draft.situations.length, moveS)
          : (
          <div key={x.id} data-sit-card={g} style={G({ padding: "12px 12px", marginBottom: 10 })}>
            <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 8 }}>
              <span style={{ color: gold, fontFamily: "monospace", fontSize: 10.5, letterSpacing: 1.6, fontWeight: "bold", flex: 1 }} onClick={() => toggleCard("sit", x.id)} role="button">СИТУАЦИЯ {si + 1} ▴</span>
              <button onClick={() => moveS(si, -1)} disabled={si === 0} style={{ ...iconBtn, opacity: si === 0 ? 0.3 : 1 }} aria-label="Ситуацию выше">{ico.up(muted)}</button>
              <button onClick={() => moveS(si, 1)} disabled={si === draft.situations.length - 1} style={{ ...iconBtn, opacity: si === draft.situations.length - 1 ? 0.3 : 1 }} aria-label="Ситуацию ниже">{ico.down(muted)}</button>
              <button onClick={() => delS(x.id)} style={iconBtn} aria-label="Удалить ситуацию">{ico.trash(TN.bad, 16)}</button>
            </div>
            {/* v40: шесть видов; сменил вид — набранное остаётся в карточке, лишнее для вида не сохраняется */}
            <div style={{ display: "flex", gap: 6, marginBottom: 7, flexWrap: "wrap" }} role="group" aria-label="Вид ситуации">
              {GENRES.map(([gg, lab]) => (
                <button key={gg} onClick={() => { const p = switchGenre(x, gg); setS(x.id, { genre: p.genre, question: p.question }); }} aria-pressed={g === gg}
                  style={{ ...pill(g === gg, gold), padding: "6px 11px", fontSize: dark ? 12.5 : 13 }}>{lab}</button>))}
            </div>
            <div data-genre-hint={g} style={{ color: muted, fontSize: dark ? 11.5 : 13, lineHeight: 1.45, margin: "0 2px 9px" }}>{GENRE_HINT[g]}</div>
            <div style={{ display: "flex", gap: 4, marginBottom: 8, flexWrap: "wrap" }} aria-label="Эмодзи сцены">
              {SIT_EMOJI.map(e => <button key={e} onClick={() => setS(x.id, { emoji: x.emoji === e ? "" : e })}
                style={{ width: 34, height: 34, borderRadius: 10, cursor: "pointer", fontSize: 17, background: x.emoji === e ? `${gold}22` : "transparent", border: `1px solid ${x.emoji === e ? gold : brd}` }}>{e}</button>)}
            </div>
            {g === "empathy" ? (<>
              <div style={fieldLab}>МЫСЛИ ГОСТЯ</div>
              <textarea style={{ ...input, minHeight: 52, lineHeight: 1.5, marginBottom: 8, resize: "vertical", fontStyle: "italic" }} value={x.guestThought || ""} onChange={e => setS(x.id, { guestThought: e.target.value })}
                placeholder="От лица гостя: «Я уже десять минут сижу без меню…»" aria-label="Мысли гостя" />
            </>) : null}
            {g === "truefalse" ? (<>
              <div style={fieldLab}>УТВЕРЖДЕНИЕ</div>
              <textarea style={{ ...input, minHeight: 56, lineHeight: 1.5, marginBottom: 8, resize: "vertical" }} value={x.statement || ""} onChange={e => setS(x.id, { statement: e.target.value })}
                placeholder="Напр. «Приборы можно выносить к столу голыми руками, если быстро»" aria-label="Утверждение" />
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6, flexWrap: "wrap" }} role="group" aria-label="Правда или миф">
                <span style={{ color: muted, fontSize: dark ? 12.5 : 13, marginRight: 2 }}>По уроку это:</span>
                <button onClick={() => setS(x.id, { isTrue: true })} aria-pressed={x.isTrue === true} style={{ ...pill(x.isTrue === true, TN.good), padding: "6px 14px", fontSize: 13 }}>Правда</button>
                <button onClick={() => setS(x.id, { isTrue: false })} aria-pressed={x.isTrue === false} style={{ ...pill(x.isTrue === false, TN.bad), padding: "6px 14px", fontSize: 13 }}>Миф</button>
              </div>
              <div style={{ color: muted, fontSize: dark ? 11 : 13, lineHeight: 1.45, margin: "0 2px 9px" }}>Сотрудник нажмёт одну из двух кнопок: «Правда — так и есть» или «Миф — так только кажется».</div>
            </>) : g === "complete" ? (<>
              <div style={fieldLab}>НАЧАЛО ПРАВИЛА</div>
              <textarea style={{ ...input, minHeight: 52, lineHeight: 1.5, marginBottom: 8, resize: "vertical" }} value={x.start || ""} onChange={e => setS(x.id, { start: e.target.value })}
                placeholder="Напр. «Если сомневаешься, подходить ли к гостю, —»" aria-label="Начало правила" />
              <div style={fieldLab}>ПРОДОЛЖЕНИЯ</div>
            </>) : (<>
              <textarea style={{ ...input, minHeight: 64, lineHeight: 1.5, marginBottom: 8, resize: "vertical" }} value={x.scene || ""} onChange={e => setS(x.id, { scene: e.target.value })}
                placeholder={SCENE_PH[g]} aria-label="Сцена" />
              <input style={{ ...input, marginBottom: 8 }} value={x.question || ""} onChange={e => setS(x.id, { question: e.target.value })} placeholder={"Вопрос: «" + SIT_Q[g] + "»"} aria-label="Вопрос" />
            </>)}
            {g !== "truefalse" ? (<>
              {x.options.map((opt, oi) => { const right = x.correct === oi; return (
                <div key={oi} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 7 }}>
                  <button onClick={() => setS(x.id, { correct: oi })} aria-label="Верный вариант" style={{ flexShrink: 0, width: 26, height: 26, borderRadius: "50%", border: `2px solid ${right ? TN.good : brd}`, background: right ? TN.good : "transparent", cursor: "pointer", display: "grid", placeItems: "center", padding: 0 }}>{right ? ico.check(dark ? "#1A1008" : "#fff") : null}</button>
                  <input style={{ ...input, padding: "10px 12px", border: `1px solid ${right ? TN.good + "88" : brd}` }} value={opt} onChange={e => setS(x.id, { options: x.options.map((o, k) => k === oi ? e.target.value : o) })} placeholder={`${OPT_PH[g]} ${oi + 1}`} />
                  {x.options.length > 2 ? <button onClick={() => setS(x.id, { options: x.options.filter((_, k) => k !== oi), correct: x.correct === oi ? 0 : x.correct > oi ? x.correct - 1 : x.correct })} style={iconBtn} aria-label="Убрать вариант">{ico.trash(muted, 15)}</button> : null}
                </div>); })}
              <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "2px 0 8px" }}>
                {x.options.length < 4 ? <button onClick={() => setS(x.id, { options: [...x.options, ""] })} style={{ ...iconBtn, color: gold, fontFamily: SERIF, fontSize: dark ? 12.5 : 13, gap: 4, padding: 2 }}>{ico.plus(gold, 14)} вариант</button> : null}
                <span style={{ color: muted, fontSize: dark ? 11 : 13 }}>зелёный кружок — верный; неверные — ошибки по уроку</span>
              </div>
              {answerTell(x.options, x.correct) ? <div data-len-tell="sit" style={{ color: TN.mid, fontSize: dark ? 11.5 : 13, lineHeight: 1.45, margin: "-2px 2px 8px" }}>Верный вариант заметно длиннее остальных — его угадают по длине. Допиши неверные до той же длины: правдоподобно, но с ошибкой.</div> : null}
              {g === "complete" && String(x.start || "").trim() && String(x.options[x.correct] || "").trim()
                ? <div data-reads="" style={{ color: muted, fontSize: dark ? 12 : 13, lineHeight: 1.45, margin: "-2px 2px 8px" }}>Читается так: <span style={{ color: txt, fontFamily: SERIF }}>«{String(x.start).trim()} {String(x.options[x.correct]).trim()}»</span></div> : null}
            </>) : null}
            <input style={{ ...input, fontSize: 13.5, marginBottom: 8 }} value={x.win || ""} onChange={e => setS(x.id, { win: e.target.value })} placeholder="Если верно — реакция: «🎯 Точно! …»" />
            <input style={{ ...input, fontSize: 13.5 }} value={x.fail || ""} onChange={e => setS(x.id, { fail: e.target.value })} placeholder="Если мимо — к любому неверному: «💡 …»" />
          </div>); })}
        <button onClick={addS} style={{ ...ghost, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>{ico.plus(gold)} Добавить ситуацию</button>

        {/* Живой диалог — после практики, перед тестом (правка 159) */}
        <div ref={secRef.dlg} />
        <SectionLabel a11y={a11y} right={draft.dialogue ? `${draft.dialogue.steps.length} шагов` : "необязательно"}>ЖИВОЙ ДИАЛОГ</SectionLabel>
        {!draft.dialogue ? (
          <div style={G({ padding: "12px 12px", marginBottom: 6 })}>
            <div style={{ color: muted, fontSize: 12.5, lineHeight: 1.45, marginBottom: 10 }}>Разговор с гостем по шагам: гость говорит — сотрудник выбирает ответ — настроение гостя меняется. Как штатные «Живые диалоги».</div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button onClick={() => setAi(a => ({ ...a, mode: "dialogue", err: null, result: null }))} disabled={sectionText.length < 40} style={{ ...aiBtn, opacity: sectionText.length >= 40 ? 1 : 0.45 }}>Собрать с ассистентом</button>
              <button onClick={() => setDlg(newDialogue())} style={{ ...aiBtn, color: txt, borderColor: brd, background: "transparent" }}>Составить самому</button>
            </div>
          </div>
        ) : (<>
          <div style={G({ padding: "12px 12px", marginBottom: 10 })}>
            <div style={{ color: gold, fontFamily: "monospace", fontSize: 10.5, letterSpacing: 1.6, fontWeight: "bold", marginBottom: 8 }}>ГОСТЬ</div>
            <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 8 }} aria-label="Аватар гостя">
              {GUEST_AVATARS.map(a => <button key={a} onClick={() => setGuest({ avatar: a })} style={{ width: 34, height: 34, borderRadius: 10, cursor: "pointer", fontSize: 17, background: draft.dialogue.guest.avatar === a ? `${gold}22` : "transparent", border: `1px solid ${draft.dialogue.guest.avatar === a ? gold : brd}` }}>{a}</button>)}
            </div>
            <input style={{ ...input, marginBottom: 8 }} value={draft.dialogue.guest.name} onChange={e => setGuest({ name: e.target.value })} placeholder="Имя гостя: «Михаил»" />
            <textarea style={{ ...input, minHeight: 56, lineHeight: 1.5, marginBottom: 8, resize: "vertical" }} value={draft.dialogue.guest.context} onChange={e => setGuest({ context: e.target.value })} placeholder="Кто он и зачем пришёл: «Деловой ужин, ждёт коллегу, устал»" />
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ color: muted, fontSize: 12 }}>Настроение в начале:</span>
              {MOODS.map((m, k) => <button key={k} onClick={() => setGuest({ mood: k + 1 })} aria-label={`Настроение ${k + 1}`} style={{ width: 32, height: 32, borderRadius: 10, cursor: "pointer", fontSize: 16, background: draft.dialogue.guest.mood === k + 1 ? `${gold}22` : "transparent", border: `1px solid ${draft.dialogue.guest.mood === k + 1 ? gold : brd}` }}>{m}</button>)}
            </div>
            <input style={{ ...input, marginTop: 8, fontSize: 13.5 }} value={draft.dialogue.tip || ""} onChange={e => setDlg(dl => ({ ...dl, tip: e.target.value }))} placeholder="Итог разговора — главная мысль, покажется в конце" />
            {/* v40: уход гостя — своя фраза и заголовок (guest.walk / guest.walkTitle), как у штатных сценариев */}
            {(() => { const gn = (draft.dialogue.guest.name || "").trim() || "Гость"; const gr = dlgGram(gn); return (<>
              <div style={{ ...fieldLab, marginTop: 12 }}>ЕСЛИ ГОСТЬ УЙДЁТ · НЕОБЯЗАТЕЛЬНО</div>
              <textarea style={{ ...input, minHeight: 48, lineHeight: 1.5, marginBottom: 8, resize: "vertical", fontSize: 13.5 }} value={draft.dialogue.guest.walk || ""} maxLength={240}
                onChange={e => setGuest({ walk: e.target.value })} placeholder={"Что происходит: «" + dlgWalkText(gn) + "»"} aria-label="Что происходит, когда гость уходит" />
              <input style={{ ...input, fontSize: 13.5 }} value={draft.dialogue.guest.walkTitle || ""} maxLength={60} onChange={e => setGuest({ walkTitle: e.target.value })}
                placeholder={"Заголовок в конце: «" + gn + " " + (gr === "pl" ? "ушли" : gr === "f" ? "ушла" : "ушёл") + "»"} aria-label="Заголовок, когда гость ушёл" />
              <div style={{ color: muted, fontSize: dark ? 11 : 13, lineHeight: 1.45, margin: "6px 2px 0" }}>Гость уходит, если после неверного ответа его настроение падает до 😠. Не заполнишь — будет то, что написано серым.</div>
            </>); })()}
          </div>
          {draft.dialogue.steps.map((st, i) => openCard.st !== st.id
            ? cardRow("st", st.id, `${i + 1} · ${st.type === "choice" ? "ВЫБОР СОТРУДНИКА" : st.type === "guest" ? "ГОСТЬ ГОВОРИТ" : "ДЕЙСТВИЕ"}`, st.type === "choice" ? st.prompt : st.text,
                st.type === "choice" ? !!(st.prompt || "").trim() && filled(st.options, o => o.correct) : !!(st.text || "").trim(), i, draft.dialogue.steps.length, moveStep)
            : (
            <div key={st.id} style={G({ padding: "11px 12px", marginBottom: 8, borderLeft: `3px solid ${st.type === "choice" ? gold : st.type === "guest" ? track.color : brd}` })}>
              <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 7 }}>
                <span style={{ color: st.type === "choice" ? gold : muted, fontFamily: "monospace", fontSize: 10.5, letterSpacing: 1.4, fontWeight: "bold", flex: 1 }} onClick={() => toggleCard("st", st.id)} role="button">{i + 1} · {st.type === "choice" ? "ВЫБОР СОТРУДНИКА" : st.type === "guest" ? "ГОСТЬ ГОВОРИТ" : "ДЕЙСТВИЕ"} ▴</span>
                <button onClick={() => moveStep(i, -1)} disabled={i === 0} style={{ ...iconBtn, opacity: i === 0 ? 0.3 : 1 }} aria-label="Шаг выше">{ico.up(muted)}</button>
                <button onClick={() => moveStep(i, 1)} disabled={i === draft.dialogue.steps.length - 1} style={{ ...iconBtn, opacity: i === draft.dialogue.steps.length - 1 ? 0.3 : 1 }} aria-label="Шаг ниже">{ico.down(muted)}</button>
                <button onClick={() => delStep(st.id)} style={iconBtn} aria-label="Удалить шаг">{ico.trash(TN.bad, 16)}</button>
              </div>
              {st.type !== "choice" ? (
                <textarea style={{ ...input, minHeight: 48, lineHeight: 1.5, resize: "vertical" }} value={st.text} onChange={e => setStep(st.id, { text: e.target.value })}
                  placeholder={st.type === "guest" ? "Реплика гостя: «Добрый вечер. Нас двое, жду коллегу.»" : "Что происходит: «Ты провожаешь гостя к столу»"} />
              ) : (<>
                <input style={{ ...input, marginBottom: 8 }} value={st.prompt} onChange={e => setStep(st.id, { prompt: e.target.value })} placeholder="Вопрос сотруднику: «Что ответишь?»" />
                {st.options.map((o, oi) => (
                  <div key={oi} style={{ border: `1px solid ${o.correct ? TN.good + "88" : brd}`, borderRadius: 12, padding: "8px 8px 6px", marginBottom: 7 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <button onClick={() => markRight(st.id, oi)} aria-label="Верный ответ" style={{ flexShrink: 0, width: 26, height: 26, borderRadius: "50%", border: `2px solid ${o.correct ? TN.good : brd}`, background: o.correct ? TN.good : "transparent", cursor: "pointer", display: "grid", placeItems: "center", padding: 0 }}>{o.correct ? ico.check(dark ? "#1A1008" : "#fff") : null}</button>
                      <input style={{ ...input, padding: "9px 11px" }} value={o.text} onChange={e => setOpt(st.id, oi, { text: e.target.value })} placeholder={`Ответ ${oi + 1}`} />
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 6, paddingLeft: 34 }}>
                      <input style={{ ...input, padding: "7px 10px", fontSize: 12.5 }} value={o.feedback || ""} onChange={e => setOpt(st.id, oi, { feedback: e.target.value })} placeholder="Почему так" />
                      {[-1, 0, 1].map(dv => <button key={dv} onClick={() => setOpt(st.id, oi, { moodDelta: dv })} aria-label={`Настроение ${dv}`}
                        style={{ flexShrink: 0, minWidth: 34, height: 30, borderRadius: 9, cursor: "pointer", fontSize: 12.5, fontFamily: SERIF, color: dv > 0 ? TN.good : dv < 0 ? TN.bad : muted,
                          background: (o.moodDelta | 0) === dv ? (dv > 0 ? TN.good : dv < 0 ? TN.bad : muted) + "22" : "transparent", border: `1px solid ${(o.moodDelta | 0) === dv ? (dv > 0 ? TN.good : dv < 0 ? TN.bad : muted) : brd}` }}>{dv > 0 ? "+1" : dv < 0 ? "−1" : "0"}</button>)}
                    </div>
                  </div>))}
                <div style={{ color: muted, fontSize: 11, paddingLeft: 2 }}>зелёный — верный ответ · ±1 — как ответ меняет настроение гостя</div>
                {answerTell(st.options) ? <div data-len-tell="" style={{ color: TN.mid, fontSize: 11.5, lineHeight: 1.45, padding: "5px 2px 0" }}>Верный ответ заметно длиннее остальных — его угадают по длине. Сделай неверные такими же подробными: вежливо, уверенно, но с одной ошибкой.</div> : null}
              </>)}
            </div>
          ))}
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 6 }}>
            <button onClick={() => addStep("guest")} style={{ ...aiBtn, color: txt, borderColor: brd, background: "transparent" }}>{ico.plus(gold, 14)} Гость говорит</button>
            <button onClick={() => addStep("action")} style={{ ...aiBtn, color: txt, borderColor: brd, background: "transparent" }}>{ico.plus(gold, 14)} Действие</button>
            <button onClick={() => addStep("choice")} style={{ ...aiBtn, color: txt, borderColor: brd, background: "transparent" }}>{ico.plus(gold, 14)} Выбор</button>
          </div>
          <button onClick={() => setDlg(null)} style={{ ...iconBtn, color: TN.bad, fontFamily: SERIF, fontSize: 12.5, padding: "2px 0 6px" }}>Убрать диалог из урока</button>
        </>)}

        {/* Сборка — только в треке бара (правка 160) */}
        {draft.role === "bar" || draft.build ? (<>
        <div ref={secRef.bld} />
        <SectionLabel a11y={a11y} right={draft.build ? `${draft.build.steps.length} шагов` : "необязательно"}>СБОРКА</SectionLabel>
        {!draft.build ? (
          <div style={G({ padding: "12px 12px", marginBottom: 6 })}>
            <div style={{ color: muted, fontSize: 12.5, lineHeight: 1.45, marginBottom: 8 }}>Собрать напиток по шагам: бокал, лёд, дозы, метод, гарниш — бокал на экране наполняется, ошибка тянет за собой вкус. Как штатные «Сборки».</div>
            <input style={{ ...input, fontSize: 13.5 }} value={ckQuery} onChange={e => setCkQuery(e.target.value)} placeholder="Найти коктейль из карты бара: «негрони»" />
            {ckQuery.trim().length >= 2 ? (() => {
              const qq = ckQuery.trim().toLowerCase().replace(/ё/g, "е");
              const found = [...barShared.map(c => ({ ...c, own: true })), ...COCKTAILS].filter(c => (c.name || "").toLowerCase().replace(/ё/g, "е").includes(qq)).slice(0, 6);
              return found.length ? found.map((c, i) => (
                <div key={i} onClick={() => { setCkQuery(""); callAI("build", { text: recipeOf(c) }); }} style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 4px", cursor: "pointer", borderBottom: `1px solid ${brd}` }}>
                  <span style={{ width: 14, height: 14, borderRadius: 4, flexShrink: 0, background: Array.isArray(c.color) ? c.color[0] : GOLD }} />
                  <span style={{ flex: 1, color: txt, fontFamily: SERIF, fontSize: 14 }}>{c.name}</span>
                  <span style={{ color: muted, fontSize: 11.5 }}>{c.own ? "своё · " : ""}{GLASS_RU[c.glass] || ""}</span>
                </div>)) : <div style={{ color: muted, fontSize: 12.5, padding: "8px 2px" }}>Не нашёл — проверь название или составь вручную.</div>;
            })() : null}
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
              <button onClick={() => setBld(newBuild())} style={{ ...aiBtn, color: txt, borderColor: brd, background: "transparent" }}>Составить самому</button>
            </div>
          </div>
        ) : (<>
          <div style={G({ padding: "12px 12px", marginBottom: 10 })}>
            <div style={{ color: gold, fontFamily: "monospace", fontSize: 10.5, letterSpacing: 1.6, fontWeight: "bold", marginBottom: 8 }}>НАПИТОК</div>
            <input style={{ ...input, marginBottom: 8 }} value={draft.build.title} onChange={e => setBld(b => ({ ...b, title: e.target.value }))} placeholder="Название: «Негрони»" />
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
              {GLASSES.map(([g, lab]) => <button key={g} onClick={() => setBld(b => ({ ...b, glass: g }))} style={{ ...pill(draft.build.glass === g, gold), padding: "6px 11px", fontSize: 12.5 }}>{lab}</button>)}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
              <span style={{ color: muted, fontSize: 12 }}>Цвет напитка:</span>
              {TINTS.map(c => <button key={c} onClick={() => setBld(b => ({ ...b, tint: c }))} aria-label={"Цвет " + c} style={{ width: 26, height: 26, borderRadius: 8, cursor: "pointer", background: c, border: `2px solid ${draft.build.tint === c ? txt : brd}` }} />)}
            </div>
            <input style={{ ...input, marginBottom: 8, fontSize: 13.5 }} value={draft.build.win} onChange={e => setBld(b => ({ ...b, win: e.target.value }))} placeholder="Если собрано чисто: «Негрони как надо — и завтра такой же»" />
            <input style={{ ...input, fontSize: 13.5 }} value={draft.build.lose} onChange={e => setBld(b => ({ ...b, lose: e.target.value }))} placeholder="Если были ошибки: «Одна ошибка тянет за собой вкус»" />
          </div>
          {draft.build.steps.map((st, i) => openCard.bst !== st.id
            ? cardRow("bst", st.id, `ШАГ ${i + 1}${st.label ? " · " + st.label.toUpperCase() : ""}`, st.q, !!(st.q || "").trim() && filled(st.options, o => o.ok), i, draft.build.steps.length, moveBStep)
            : (
            <div key={st.id} style={G({ padding: "11px 12px", marginBottom: 8, borderLeft: `3px solid ${draft.build.tint}` })}>
              <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 7 }}>
                <span style={{ color: gold, fontFamily: "monospace", fontSize: 10.5, letterSpacing: 1.4, fontWeight: "bold", flex: 1 }} onClick={() => toggleCard("bst", st.id)} role="button">ШАГ {i + 1} ▴</span>
                <button onClick={() => moveBStep(i, -1)} disabled={i === 0} style={{ ...iconBtn, opacity: i === 0 ? 0.3 : 1 }} aria-label="Шаг сборки выше">{ico.up(muted)}</button>
                <button onClick={() => moveBStep(i, 1)} disabled={i === draft.build.steps.length - 1} style={{ ...iconBtn, opacity: i === draft.build.steps.length - 1 ? 0.3 : 1 }} aria-label="Шаг сборки ниже">{ico.down(muted)}</button>
                <button onClick={() => setBld(b => ({ ...b, steps: b.steps.filter(x => x.id !== st.id) }))} style={iconBtn} aria-label="Удалить шаг сборки">{ico.trash(TN.bad, 16)}</button>
              </div>
              <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                <input style={{ ...input, flex: "0 0 34%", padding: "10px 11px" }} value={st.label} onChange={e => setBStep(st.id, { label: e.target.value })} placeholder="Бокал" />
                <input style={{ ...input, padding: "10px 11px" }} value={st.q} onChange={e => setBStep(st.id, { q: e.target.value })} placeholder="Вопрос: «С чего начинаешь?»" />
              </div>
              {st.options.map((o, oi) => (
                <div key={oi} style={{ border: `1px solid ${o.ok ? TN.good + "88" : brd}`, borderRadius: 12, padding: "7px 8px 6px", marginBottom: 6 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <button onClick={() => markBOk(st.id, oi)} aria-label="Верный вариант сборки" style={{ flexShrink: 0, width: 24, height: 24, borderRadius: "50%", border: `2px solid ${o.ok ? TN.good : brd}`, background: o.ok ? TN.good : "transparent", cursor: "pointer", display: "grid", placeItems: "center", padding: 0 }}>{o.ok ? ico.check(dark ? "#1A1008" : "#fff") : null}</button>
                    <input style={{ ...input, padding: "8px 10px", fontSize: 13.5 }} value={o.t} onChange={e => setBOpt(st.id, oi, { t: e.target.value })} placeholder={`Вариант ${oi + 1}`} />
                  </div>
                  <input style={{ ...input, padding: "7px 10px", fontSize: 12.5, marginTop: 6 }} value={o.fb} onChange={e => setBOpt(st.id, oi, { fb: e.target.value })} placeholder="Почему так" />
                </div>))}
              <input style={{ ...input, padding: "8px 10px", fontSize: 12.5 }} value={st.cost} onChange={e => setBStep(st.id, { cost: e.target.value })} placeholder="Цена ошибки: «напиток выдохнется до второго глотка»" />
            </div>
          ))}
          <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 6 }}>
            <button onClick={() => (() => { const st = blankBStep(); setBld(b => ({ ...b, steps: [...b.steps, st] })); setOpenCard(o => ({ ...o, bst: st.id })); })()} style={{ ...aiBtn, color: txt, borderColor: brd, background: "transparent" }}>{ico.plus(gold, 14)} Шаг</button>
            <button onClick={() => setBld(null)} style={{ ...iconBtn, color: TN.bad, fontFamily: SERIF, fontSize: 12.5 }}>Убрать сборку из урока</button>
          </div>
        </>)}
        </>) : null}

        <div ref={secRef.q} />
        <SectionLabel a11y={a11y} right={draft.questions.length ? `${draft.questions.length}` : "необязательно"}>ВОПРОСЫ ТЕСТА</SectionLabel>
        {draft.questions.map((q, qi) => openCard.q !== q.id
          ? cardRow("q", q.id, `ВОПРОС ${qi + 1}`, q.q, !!(q.q || "").trim() && filled(q.options, (o, k) => k === q.correct), qi, draft.questions.length, moveQ)
          : (
          <div key={q.id} style={G({ padding: "12px 12px", marginBottom: 10 })}>
            <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 8 }}>
              <span style={{ color: gold, fontFamily: "monospace", fontSize: 10.5, letterSpacing: 1.6, fontWeight: "bold", flex: 1 }} onClick={() => toggleCard("q", q.id)} role="button">ВОПРОС {qi + 1} ▴</span>
              <button onClick={() => moveQ(qi, -1)} disabled={qi === 0} style={{ ...iconBtn, opacity: qi === 0 ? 0.3 : 1 }} aria-label="Выше">{ico.up(muted)}</button>
              <button onClick={() => moveQ(qi, 1)} disabled={qi === draft.questions.length - 1} style={{ ...iconBtn, opacity: qi === draft.questions.length - 1 ? 0.3 : 1 }} aria-label="Ниже">{ico.down(muted)}</button>
              <button onClick={() => delQ(q.id)} style={iconBtn} aria-label="Удалить вопрос">{ico.trash(TN.bad, 16)}</button>
            </div>
            <input style={{ ...input, marginBottom: 8 }} value={q.q} onChange={e => setQ(q.id, { q: e.target.value })} placeholder="Текст вопроса" />
            {q.options.map((opt, oi) => { const right = q.correct === oi; return (
              <div key={oi} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 7 }}>
                <button onClick={() => setQ(q.id, { correct: oi })} aria-label="Верный ответ" style={{ flexShrink: 0, width: 26, height: 26, borderRadius: "50%", border: `2px solid ${right ? TN.good : brd}`, background: right ? TN.good : "transparent", cursor: "pointer", display: "grid", placeItems: "center", padding: 0 }}>{right ? ico.check(dark ? "#1A1008" : "#fff") : null}</button>
                <input style={{ ...input, padding: "10px 12px", border: `1px solid ${right ? TN.good + "88" : brd}` }} value={opt} onChange={e => setQ(q.id, { options: q.options.map((o, k) => k === oi ? e.target.value : o) })} placeholder={`Вариант ${oi + 1}`} />
                {q.options.length > 2 ? <button onClick={() => setQ(q.id, { options: q.options.filter((_, k) => k !== oi), correct: q.correct === oi ? 0 : q.correct > oi ? q.correct - 1 : q.correct })} style={iconBtn} aria-label="Убрать вариант">{ico.trash(muted, 15)}</button> : null}
              </div>); })}
            <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "2px 0 8px" }}>
              {q.options.length < 4 ? <button onClick={() => setQ(q.id, { options: [...q.options, ""] })} style={{ ...iconBtn, color: gold, fontFamily: SERIF, fontSize: 12.5, gap: 4, padding: 2 }}>{ico.plus(gold, 14)} вариант</button> : null}
              <span style={{ color: muted, fontSize: 11 }}>зелёный кружок — верный ответ</span>
            </div>
            {answerTell(q.options, q.correct) ? <div data-len-tell="" style={{ color: TN.mid, fontSize: 11.5, lineHeight: 1.45, margin: "-2px 2px 8px" }}>Верный вариант заметно длиннее остальных — его угадают по длине. Допиши неверные до той же длины: правдоподобно, но с ошибкой.</div> : null}
            <input style={{ ...input, fontSize: 13.5 }} value={q.explanation || ""} onChange={e => setQ(q.id, { explanation: e.target.value })} placeholder="Пояснение: почему верно именно так" />
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8 }}>
              <span style={{ flexShrink: 0 }}>{ico.photo(muted)}</span>
              <input style={{ ...input, padding: "9px 12px", fontSize: 12.5 }} value={q.img || ""} onChange={e => setQ(q.id, { img: e.target.value })} placeholder="Ссылка на фото (необязательно)" />
            </div>
            {q.img ? <img src={q.img} alt="" loading="lazy" decoding="async" style={{ width: "100%", maxHeight: 150, objectFit: "cover", borderRadius: 9, marginTop: 8, display: "block" }} /> : null}
          </div>
        ))}
        <button onClick={addQ} style={{ ...ghost, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>{ico.plus(gold)} Добавить вопрос</button>

        {/* Как увидит сотрудник */}
        {/* Страница в книге отзывов — общая для раздела (правка 166): откроется, когда раздел пройден */}
        <SectionLabel a11y={a11y} right={draft.review ? "есть" : "необязательно"}>КНИГА ОТЗЫВОВ</SectionLabel>
        {!draft.review ? (
          <div style={G({ padding: "12px 12px", marginBottom: 6 })}>
            <div style={{ color: muted, fontSize: 12.5, lineHeight: 1.45, marginBottom: 10 }}>Отзыв гостя — страница в «Книге отзывов», как у штатных модулей: откроется сотруднику, когда он пройдёт весь раздел.</div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button onClick={() => callAI("review", { text: sectionText, title: secLabel })} disabled={sectionText.length < 40} style={{ ...aiBtn, opacity: sectionText.length >= 40 ? 1 : 0.45 }}>Написать с ассистентом</button>
              <button onClick={() => patch({ review: { guest: "", table: "", text: "" } })} style={{ ...aiBtn, color: txt, borderColor: brd, background: "transparent" }}>Написать самому</button>
            </div>
          </div>
        ) : (
          <div style={G({ padding: "12px 12px", marginBottom: 6 })}>
            <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
              <input style={{ ...input, flex: 1.6, padding: "10px 11px" }} value={draft.review.guest} onChange={e => patch({ review: { ...draft.review, guest: e.target.value } })} placeholder="Кто гость: «Пара на годовщине»" />
              <input style={{ ...input, flex: 1, padding: "10px 11px" }} value={draft.review.table} onChange={e => patch({ review: { ...draft.review, table: e.target.value } })} placeholder="стол 7" />
            </div>
            <textarea style={{ ...input, minHeight: 84, lineHeight: 1.5, resize: "vertical" }} value={draft.review.text} onChange={e => patch({ review: { ...draft.review, text: e.target.value } })}
              placeholder="Отзыв от лица гостя: что сотрудник сделал так, что захотелось вернуться" />
            {(draft.review.text || "").trim() ? (
              <div style={{ margin: "10px 2px 2px", padding: "10px 12px", borderRadius: 12, borderLeft: `3px solid ${track.color}`, background: `${track.color}10` }}>
                <div style={{ color: txt, fontFamily: SERIF, fontStyle: "italic", fontSize: 13.5, lineHeight: 1.5 }}>«{draft.review.text.trim()}»</div>
                <div style={{ color: muted, fontSize: 11.5, marginTop: 4 }}>— {(draft.review.guest || "").trim() || "Гость"}{(draft.review.table || "").trim() ? ", " + draft.review.table.trim() : ""}</div>
              </div>) : null}
            <button onClick={() => patch({ review: null })} style={{ ...iconBtn, color: TN.bad, fontFamily: SERIF, fontSize: 12.5, padding: "8px 0 0" }}>Убрать страницу</button>
          </div>
        )}
        {/* Доп. 310: навыки раздела — наставник подтверждает их в зале, как штатные */}
        <SectionLabel a11y={a11y} right={(draft.skills || []).length ? String((draft.skills || []).length) : "необязательно"}>НАВЫКИ В ЗАЛЕ</SectionLabel>
        <div style={G({ padding: "12px 12px", marginBottom: 6 })}>
          <div style={{ color: muted, fontSize: 12.5, lineHeight: 1.45, marginBottom: (draft.skills || []).length ? 10 : 8 }}>Что старший должен увидеть своими глазами в зале. Навык появится в «Наставничестве» у сотрудников этого трека: «Отправить старшему» или PIN — как у штатных навыков.</div>
          {(draft.skills || []).map((sk, i) => (
            <div key={sk.id} style={{ display: "flex", gap: 8, alignItems: "flex-start", marginBottom: 8 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <input style={{ ...input, padding: "10px 11px" }} value={sk.label} maxLength={80} onChange={e => setDraft(d => ({ ...d, skills: d.skills.map(x => x.id === sk.id ? { ...x, label: e.target.value } : x) }))} placeholder={"Навык " + (i + 1) + ": «Подача фирменного десерта»"} aria-label={"Навык " + (i + 1)} />
                <input style={{ ...input, padding: "9px 11px", fontSize: 12.5, marginTop: 6 }} value={sk.hint} maxLength={140} onChange={e => setDraft(d => ({ ...d, skills: d.skills.map(x => x.id === sk.id ? { ...x, hint: e.target.value } : x) }))} placeholder="Как понять, что получилось (необязательно)" aria-label={"Признак навыка " + (i + 1)} />
              </div>
              <button onClick={() => setDraft(d => ({ ...d, skills: d.skills.filter(x => x.id !== sk.id) }))} style={{ ...iconBtn, padding: "10px 4px" }} aria-label={"Убрать навык " + (i + 1)}>{ico.trash(TN.bad)}</button>
            </div>
          ))}
          {(draft.skills || []).length < 8 ? <button onClick={() => setDraft(d => ({ ...d, skills: [...(d.skills || []), { id: uid(), sid: uid(), label: "", hint: "" }] }))} style={{ ...ghost, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>{ico.plus(gold)} Добавить навык</button> : null}
        </div>
        </>)}
        {edWrap("sa-ed2-pv", pvRef, <>
        <div ref={secRef.prev} />
        <SectionLabel a11y={a11y}>КАК УВИДИТ СОТРУДНИК</SectionLabel>
        {/* v40: проба на настоящих экранах игры — с черновиком, без записи прогресса */}
        <div data-play-card="" style={G({ padding: "12px 12px", marginBottom: 10 })}>
          <div style={{ color: muted, fontSize: dark ? 12.5 : 13, lineHeight: 1.45, marginBottom: 10 }}>Пройди практику и диалог так, как их пройдёт сотрудник, — на тех же экранах. Это проба: звёзды, ошибки и прогресс не записываются.</div>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={playPractice} disabled={!sitsAll.length || playBusy} style={{ ...aiBtn, flex: 1, minWidth: 0, justifyContent: "center", padding: "10px 6px", fontSize: 13.5, opacity: sitsAll.length ? 1 : 0.45 }}>{ico.play(gold)} {playBusy ? "Открываю…" : "Сыграть практику"}</button>
            <button onClick={playDialogue} disabled={!draft.dialogue} style={{ ...aiBtn, flex: 1, minWidth: 0, justifyContent: "center", padding: "10px 6px", fontSize: 13.5, opacity: draft.dialogue ? 1 : 0.45 }}>{ico.play(gold)} Сыграть диалог</button>
          </div>
          {!sitsAll.length && !draft.dialogue ? <div style={{ color: muted, fontSize: dark ? 11.5 : 13, lineHeight: 1.45, marginTop: 8 }}>Добавь ситуации или диалог выше — их можно будет сыграть здесь.</div>
            : sitsOk.length && sitsOk.length < sitsAll.length ? <div style={{ color: muted, fontSize: dark ? 11.5 : 13, lineHeight: 1.45, marginTop: 8 }}>В пробу попадут заполненные ситуации: {sitsOk.length} из {sitsAll.length}.</div> : null}
          {playMsg ? <div role="status" data-play-msg="" style={{ color: TN.bad, fontSize: dark ? 12.5 : 13, lineHeight: 1.45, marginTop: 8 }}>{playMsg}</div> : null}
        </div>
        {showPreview || two ? (<>
        <div style={{ ...T.modCard, margin: "0 0 10px" }}>
          <div style={{ ...T.modBar, background: track.color }} />
          <div style={{ ...T.modIcon, display: "flex", alignItems: "center", justifyContent: "center" }}>{MOD_SVG[secIcon] ? MOD_SVG[secIcon](track.color, 28) : null}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ ...T.modTag, color: track.color }}>СВОЁ · {track.label.toUpperCase()}</div>
            <div style={T.modTitle}>{draft.module.trim() || "Свой раздел"}</div>
            <div style={T.modSub}>Раздел вашего ресторана</div>
          </div>
        </div>
        <div style={G({ padding: "14px 14px", marginBottom: 16 })}>
          <div style={{ color: txt, fontFamily: SERIF, fontWeight: "bold", fontSize: 17, marginBottom: 8 }}>{draft.title.trim() || "Название урока"}</div>
          {draft.content.trim() ? <Rich text={draft.content} T={T} color={track.color} a11y={a11y} /> : <div style={{ color: muted, fontSize: 13 }}>Здесь появится текст урока.</div>}
          {draft.questions.length ? <div style={{ color: muted, fontSize: 12, marginTop: 10 }}>В конце — тест: {draft.questions.length} вопр.</div> : null}
        </div>

        {(draft.situations || []).length ? (() => { const x = draft.situations[0]; const g = genreOfS(x); return (
          <div style={G({ padding: "14px 14px", marginBottom: 16 })}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8 }}>
              <span style={{ color: track.color, fontFamily: "monospace", fontSize: dark ? 10.5 : 11, letterSpacing: 1.6, fontWeight: "bold" }}>{GENRE_RU[g].toUpperCase()}</span>
              <span style={{ color: muted, fontSize: 11.5 }}>практика · {draft.situations.length}</span>
            </div>
            {g === "empathy" && String(x.guestThought || "").trim() ? <div style={{ color: muted, fontFamily: SERIF, fontStyle: "italic", fontSize: 13.5, lineHeight: 1.5, marginBottom: 6 }}>Мысли гостя: «{unq(String(x.guestThought).trim())}»</div> : null}
            <div style={{ color: txt, fontFamily: SERIF, fontSize: 14.5, lineHeight: 1.5, marginBottom: 8 }}>{x.emoji ? <span style={{ marginRight: 6 }}>{x.emoji}</span> : null}
              {g === "truefalse" ? "«" + (unq(String(x.statement || "").trim()) || "Утверждение") + "»" : g === "complete" ? (String(x.start || "").trim() || "Начало правила") + " ___" : (x.scene || "Сцена ситуации")}</div>
            <div style={{ color: txt, fontFamily: SERIF, fontWeight: "bold", fontSize: 14, marginBottom: 8 }}>{g === "truefalse" ? "Правда или миф?" : g === "complete" ? SIT_Q.complete : (x.question || SIT_Q[g])}</div>
            {(g === "truefalse" ? ["Правда", "Миф"] : x.options.filter(o => (o || "").trim())).map((o, k) => <div key={k} style={{ padding: "9px 12px", borderRadius: 12, marginBottom: 6, border: `1px solid ${brd}`, color: txt, fontSize: 13.5, fontFamily: SERIF }}>{o}</div>)}
            <div style={{ color: muted, fontSize: 11.5, marginTop: 6 }}>В игре — до 6 случайных ситуаций, варианты перемешаны, 3 жизни и звёзды.</div>
          </div>); })() : null}
        {draft.dialogue ? (
          <div style={G({ padding: "14px 14px", marginBottom: 16 })}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8 }}>
              <span style={{ color: track.color, fontFamily: "monospace", fontSize: 10.5, letterSpacing: 1.6, fontWeight: "bold" }}>ЖИВОЙ ДИАЛОГ</span>
              <span style={{ fontSize: 16 }}>{MOODS[(draft.dialogue.guest.mood || 3) - 1]}</span>
            </div>
            <div style={{ color: txt, fontFamily: SERIF, fontWeight: "bold", fontSize: 14.5 }}>{draft.dialogue.guest.avatar} {draft.dialogue.guest.name || "Гость"}</div>
            {draft.dialogue.guest.context ? <div style={{ color: muted, fontSize: 12.5, fontStyle: "italic", margin: "3px 0 8px" }}>{draft.dialogue.guest.context}</div> : null}
            {draft.dialogue.steps.slice(0, 4).map(st => st.type === "action"
              ? <div key={st.id} style={{ color: muted, fontSize: 12.5, fontStyle: "italic", margin: "6px 0" }}>{st.text}</div>
              : st.type === "guest"
              ? <div key={st.id} style={{ display: "inline-block", maxWidth: "85%", background: `${track.color}1c`, border: `1px solid ${track.color}44`, borderRadius: "14px 14px 14px 4px", padding: "8px 11px", margin: "4px 0", color: txt, fontSize: 13.5, fontFamily: SERIF }}>{st.text || "…"}</div>
              : <div key={st.id} style={{ margin: "8px 0" }}>
                  <div style={{ color: gold, fontSize: 12.5, fontWeight: "bold", marginBottom: 5 }}>{st.prompt}</div>
                  {st.options.filter(o => (o.text || "").trim()).map((o, k) => <div key={k} style={{ padding: "7px 11px", borderRadius: 12, marginBottom: 5, border: `1px solid ${brd}`, color: txt, fontSize: 13, fontFamily: SERIF }}>{o.text}</div>)}
                </div>)}
            <div style={{ color: muted, fontSize: 11.5, marginTop: 6 }}>В игре варианты перемешаны; после выбора — объяснение, настроение гостя меняется, при плохом — он уходит.</div>
          </div>) : null}
        {draft.build ? (
          <div style={G({ padding: "14px 14px", marginBottom: 16, display: "flex", gap: 12, alignItems: "center" })}>
            <span style={{ width: 34, height: 46, borderRadius: draft.build.glass === "coupe" || draft.build.glass === "wine" ? "4px 4px 16px 16px" : 6, flexShrink: 0,
              background: `linear-gradient(180deg, transparent 22%, ${draft.build.tint}cc 22%)`, border: `2px solid ${brd}` }} />
            <div style={{ minWidth: 0 }}>
              <div style={{ color: track.color, fontFamily: "monospace", fontSize: 10.5, letterSpacing: 1.6, fontWeight: "bold" }}>СБОРКА</div>
              <div style={{ color: txt, fontFamily: SERIF, fontWeight: "bold", fontSize: 14.5 }}>{draft.build.title || "Напиток"}</div>
              <div style={{ color: muted, fontSize: 12 }}>{(GLASSES.find(g => g[0] === draft.build.glass) || ["", ""])[1]} · шагов: {draft.build.steps.length} · бокал наполняется по ходу, звёзды за чистую сборку</div>
            </div>
          </div>) : null}
          {two ? null : <button onClick={() => setShowPreview(false)} style={{ ...ghost, marginBottom: 12 }}>Скрыть предпросмотр ▴</button>}
        </>) : <button onClick={() => setShowPreview(true)} style={{ ...ghost, marginBottom: 12 }}>Показать, как увидит сотрудник ▾</button>}
        {(() => {
          const extrasQ = [...draft.questions, ...(draft.situations || []).map(x => ({ kind: "situation", ...x })), ...(draft.dialogue ? [{ kind: "dialogue", ...draft.dialogue }] : []), ...(draft.build ? [{ kind: "build", ...draft.build }] : [])];
          const me = { id: draft.id || "new", title: draft.title || "Этот урок", sort: draft.sort || 0 };
          const recs = [...otherRecs.map(r => ({ ...r, questions: [] })), me].sort(bySort);
          recs[0] = { ...recs[0], questions: extrasQ };
          const order = sectionSteps(secLabel, recs, draft.role, track.color);
          return (
            <div style={G({ padding: "12px 14px", marginBottom: 16 })}>
              <div style={{ color: track.color, fontFamily: "monospace", fontSize: 10.5, letterSpacing: 1.6, fontWeight: "bold", marginBottom: 6 }}>ПОРЯДОК ШАГОВ РАЗДЕЛА</div>
              {order.map((st, i) => <div key={i} style={{ display: "flex", gap: 8, padding: "3px 0", color: st.id === "cms-l-" + (draft.id || "new") ? txt : muted, fontWeight: st.id === "cms-l-" + (draft.id || "new") ? "bold" : "normal", fontSize: 13, fontFamily: SERIF }}>
                <span style={{ width: 18, color: muted }}>{i + 1}</span><span>{st.title}</span></div>)}
            </div>);
        })()}
        </>)}
        {/* «Сохранить» — закреплена внизу; пока печатаешь — уезжает, чтобы не закрывать поле (правка 162) */}
        <div className="sa-colbar" style={{ position: "fixed", left: 0, right: 0, bottom: 0, zIndex: 30, padding: "8px 16px calc(10px + env(safe-area-inset-bottom, 0px))",
          transform: typingEd ? "translateY(120%)" : "none", transition: "transform .25s ease",
          background: dark ? "rgba(21,17,11,0.94)" : "rgba(245,238,222,0.94)", borderTop: `1px solid ${gold}33`, WebkitBackdropFilter: "blur(8px)", backdropFilter: "blur(8px)" }}>
          {err && <div style={{ color: TN.bad, fontSize: 12.5, marginBottom: 6, textAlign: "center", lineHeight: 1.4 }}>{err}</div>}
          <div style={{ display: "flex", gap: 10 }}>
            <button onClick={cancel} style={{ ...ghost, width: "auto", flex: 1, padding: "12px" }}>Отменить</button>
            <button onClick={save} disabled={busy} style={{ ...primary, flex: 1.6, padding: "12px", opacity: busy ? 0.6 : 1 }}>{busy ? "Сохраняю…" : "Сохранить урок"}</button>
          </div>
          <div style={{ color: muted, fontSize: 11, textAlign: "center", marginTop: 6 }}>{savedAt ? `Черновик сохранён на телефоне · ${hhmm(savedAt)}` : "Черновик сохраняется на телефоне сам"}</div>
        </div>
      </div>
      {/* v40: проба — настоящие экраны поверх редактора; закрыл — снова редактор, черновик на месте.
          Практика «у стола» (ui/table.jsx) рисует себя слоем в body сама; диалог — порталом, как в App.
          preview — без обещаний записи: «Выйти из пробы?», в чеке «Проба — результат не записывается»,
          без серии, цели дня, Наставника и микрофона */}
      {play && play.kind === "sit" && tbRef.current ? (() => { const TP = tbRef.current.TablePractice; return (
        <TP key={play.key} lesson={play.lesson} mod={play.mod} color={track.color} a11y={!!a11y} practiceState={play.ps} setPracticeState={setPlayPs}
          onPracticeChoice={playPick} onPracticeNext={playNext} onBack={closePlay} onComplete={closePlay} streak={null} profile={play.profile} preview />); })() : null}
      {play && play.kind === "dlg" ? createPortal(<LiveDialogue key={play.key} inline={play.dialogue} T={T} color={track.color} pro onClose={closePlay} />, document.body) : null}
    </div>
  );
}
