// ui/ReferenceSection.jsx
// Раздел «Справочник»: хаб → курс → глава → фото-тест.
// Использует реальные токены темы приложения (T = S | A), чтобы выглядеть родным.
import React from "react";
import { Ico, renderIll, splitLeadingFlag } from "./reference-illustrations";
import { REFERENCE_COURSE, REFERENCE_WINE_COURSE } from "../data/reference";
import { onActivate } from "../lib/utils";
import { GOLD, GREEN, RED } from "./tokens";

const R = React;
const SERIF = "Georgia, 'Times New Roman', serif";
// Маркеры-иконки в стиле уроков (📌 заметка, ☑ чек, 🚫 запрет, ✅ верно, ❌ неверно)
const MARK_RE = /^(📌|☑️?|🚫|✅|❌)\s*/u;

// ── Контент главы (bold/буллеты/нумерация в стиле уроков) ──
function inlineBold(s, T) {
  return s.split("**").map((p, i) => i % 2
    ? <b key={i} style={{ color: T.bold.color, fontWeight: "bold" }}>{p}</b>
    : <R.Fragment key={i}>{p}</R.Fragment>);
}
function Content({ text, T, gold, dark }) {
  return (<div>{text.split("\n").map((ln, i) => {
    const t = ln.trim();
    if (!t) return <div key={i} style={{ height: 10 }} />;
    const im = t.match(/^\[img:(.+)\]$/);
    if (im) {
      const keys = im[1].split(",").map(x => x.trim());
      return (<div key={i} style={{ display: "flex", flexDirection: "column", gap: 8, margin: "8px 0 16px" }}>
        {keys.map((k, j) => <div key={j} style={{ display: "flex", justifyContent: "center", overflow: "hidden", borderRadius: 14 }}>{renderIll(k, gold, dark)}</div>)}
      </div>);
    }
    if (t.startsWith("**") && t.endsWith("**")) {
      const { flag, rest } = splitLeadingFlag(t.replace(/\*\*/g, ""));
      return flag
        ? <div key={i} style={{ ...T.bold, display: "flex", alignItems: "center", gap: 9 }}>{flag}<span>{rest}</span></div>
        : <div key={i} style={T.bold}>{rest}</div>;
    }
    const mk = t.match(MARK_RE);
    if (mk) {
      const m = mk[1].replace("\uFE0F", "");
      const icon = m === "✅" ? Ico.check(GREEN, 15)
        : m === "❌" ? Ico.x(RED, 15)
        : Ico.pin(gold, 15);
      const st = m === "✅" ? T.good : m === "❌" ? T.bad : T.note;
      return (<div key={i} style={{ ...(st || T.para), display: "flex", gap: 9, alignItems: "flex-start" }}>
        <span style={{ flexShrink: 0, marginTop: 3, display: "inline-flex" }}>{icon}</span>
        <span style={{ flex: 1 }}>{inlineBold(t.replace(MARK_RE, ""), T)}</span>
      </div>);
    }
    if (t.startsWith("• ")) return (<div key={i} style={{ ...T.para, display: "flex", gap: 8, marginBottom: 4 }}><span style={{ color: gold }}>•</span><span style={{ flex: 1 }}>{inlineBold(t.slice(2), T)}</span></div>);
    const num = t.match(/^(\d+)\.\s+(.*)/);
    if (num) return (<div key={i} style={{ ...T.para, display: "flex", gap: 8, marginBottom: 4 }}><b style={{ color: gold }}>{num[1]}.</b><span style={{ flex: 1 }}>{inlineBold(num[2], T)}</span></div>);
    return <div key={i} style={T.para}>{inlineBold(t, T)}</div>;
  })}</div>);
}

function Head({ T, title, onBack }) {
  return (<div style={T.lessHead}><button style={T.backBtn2} onClick={onBack}>‹</button><div style={T.lessHeadTitle}>{title}</div></div>);
}
function Figure({ T, children }) {
  return (<div style={{ background: T.lessGlass.bg, border: T.lessGlass.border, borderTop: T.lessGlass.borderTop, borderRadius: 18, boxShadow: T.lessGlass.shadow, padding: "14px 10px", marginBottom: 12, display: "flex", alignItems: "center", justifyContent: "center", backdropFilter: T.lessGlass.blur, WebkitBackdropFilter: T.lessGlass.blur, overflow: "hidden" }}>{children}</div>);
}

// ── Хаб ──
function Hub({ T, gold, dark, openCourse, onExit }) {
  const chapters = REFERENCE_COURSE.lessons.filter(l => l.type === "lesson").length;
  const wineChapters = REFERENCE_WINE_COURSE.lessons.filter(l => l.type === "lesson").length;
  const plural = (n) => n % 10 === 1 && n % 100 !== 11 ? "глава" : (n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20)) ? "главы" : "глав";
  const cards = [
    { id: "serving", t: "Сервировка", s: `${chapters} ${plural(chapters)} · с фото`, icon: Ico.serving, on: true },
    { id: "wine", t: "Вина", s: `${wineChapters} ${plural(wineChapters)}`, icon: Ico.wine, on: true },
    { id: "coffee", t: "Кофе", s: "скоро", icon: Ico.coffee },
    { id: "bar", t: "Бар и коктейли", s: "скоро", icon: Ico.bar },
  ];
  return (<div style={T.screen}>
    <div style={{ display: "flex", alignItems: "center", gap: 4, padding: "14px 14px 0" }}>
      <button style={T.backBtn2} onClick={onExit}>‹</button>
      <span style={{ ...T.modTag, color: gold }}>РАЗДЕЛ</span>
    </div>
    <div style={{ padding: "6px 18px 8px" }}>
      <div style={{ fontFamily: SERIF, fontSize: 27, fontWeight: "bold", color: T.modTitle.color }}>Справочник</div>
      <div style={{ color: T.modSub.color, fontSize: 14, marginTop: 6, lineHeight: 1.5 }}>Познавательные курсы для всей команды. Пополняется со временем.</div>
    </div>
    <div style={{ ...T.modList, paddingTop: 8 }}>
      {cards.map(c => (
        <div key={c.id} onClick={c.on ? () => openCourse(c.id) : undefined} {...onActivate(c.on ? () => openCourse(c.id) : undefined)} aria-label={c.t} style={{ ...T.modCard, gap: 12, cursor: c.on ? "pointer" : "default", opacity: c.on ? 1 : 0.5 }}>
          <div style={{ ...T.modBar, background: gold, opacity: c.on ? 1 : 0.4 }} />
          <div style={T.modIcon}>{c.icon(gold, 24)}</div>
          <div style={{ flex: 1 }}>
            <div style={{ ...T.modTag, color: gold }}>{c.on ? "КУРС" : "СКОРО"}</div>
            <div style={T.modTitle}>{c.t}</div>
            <div style={{ ...T.modSub, display: "flex", alignItems: "center", gap: 5 }}>{!c.on && Ico.lock(T.modSub.color, 12)}{c.s}</div>
          </div>
          <div style={T.modArrow}>{c.on ? "›" : ""}</div>
        </div>
      ))}
    </div>
  </div>);
}

// ── Курс ──
function Course({ T, gold, course, openLesson, onBack }) {
  return (<div style={T.screen}>
    <Head T={T} title="Справочник" onBack={onBack} />
    <div style={{ padding: "14px 18px 4px" }}>
      <div style={{ fontFamily: SERIF, fontSize: 24, fontWeight: "bold", color: T.modTitle.color }}>{course.title}</div>
      <div style={{ color: T.modSub.color, fontSize: 13, marginTop: 5, lineHeight: 1.5 }}>{course.subtitle}</div>
    </div>
    <div style={T.secTitle}>ПРОГРАММА</div>
    <div style={T.lessList}>
      {course.lessons.map((l, i) => {
        const isQuiz = l.type === "quiz";
        return (<div key={l.id} style={T.lessCard} onClick={() => openLesson(l)} {...onActivate(() => openLesson(l))} aria-label={l.title}>
          <div style={{ ...T.lessNum, color: isQuiz ? gold : (T.lessNumColor || "#C8B898"), fontWeight: T.lessNumColor ? "bold" : "normal", border: isQuiz ? "1.5px solid rgba(200,169,110,0.5)" : (T.lessNumBorder || "1.5px solid rgba(200,185,152,0.35)") }}>
            {isQuiz ? Ico.cam(gold, 15) : i + 1}
          </div>
          <div style={{ ...T.lessInfo, display: "flex", flexDirection: "column", justifyContent: "center" }}>
            <div style={{ ...T.lessTitle, marginBottom: 0, color: isQuiz ? gold : T.lessTitle.color }}>{l.title}</div>
            <div style={{ fontSize: 10, letterSpacing: 1, fontFamily: "monospace", color: isQuiz ? gold : "#7C9E87", marginTop: 2 }}>{isQuiz ? "ФОТО-ТЕСТ" : "ГЛАВА"}</div>
          </div>
          <div style={T.lessArrow}>›</div>
        </div>);
      })}
    </div>
  </div>);
}

// ── Глава ──
function Lesson({ T, gold, dark, lesson, onBack, onNext, nextLabel }) {
  const bodyRef = R.useRef(null);
  R.useEffect(() => {
    if (typeof window !== "undefined") { try { window.scrollTo(0, 0); } catch (e) {} }
    if (bodyRef.current) bodyRef.current.scrollTop = 0;
  }, [lesson.id]);
  return (<div style={T.screen}>
    <Head T={T} title={lesson.title} onBack={onBack} />
    <div ref={bodyRef} style={{ ...T.lessBody, padding: "14px 14px 40px" }}>
      {lesson.images && lesson.images.map((k, i) => <Figure key={i} T={T}>{renderIll(k, gold, dark)}</Figure>)}
      <div style={{ background: T.lessGlass.bg, border: T.lessGlass.border, borderTop: T.lessGlass.borderTop, borderRadius: 22, boxShadow: T.lessGlass.shadow, padding: "20px 18px", backdropFilter: T.lessGlass.blur, WebkitBackdropFilter: T.lessGlass.blur }}>
        <Content text={lesson.content} T={T} gold={gold} dark={dark} />
      </div>
      {onNext
        ? <button style={{ ...T.doneBtn, background: gold }} onClick={onNext}>{nextLabel} →</button>
        : <button style={{ ...T.doneBtn, background: gold }} onClick={onBack}>К программе курса</button>}
    </div>
  </div>);
}

// ── Фото-тест ──
function Quiz({ T, gold, dark, lesson, onBack, onNext, nextLabel }) {
  const [step, setStep] = R.useState(0);
  const [pick, setPick] = R.useState(null);
  const [score, setScore] = R.useState(0);
  const [done, setDone] = R.useState(false);
  const qs = lesson.questions; const q = qs[step]; const last = step === qs.length - 1;
  if (done) return (<div style={T.screen}>
    <Head T={T} title={lesson.title} onBack={onBack} />
    <div style={T.resultWrap}>
      <div style={{ ...T.resultCircle, borderColor: GREEN }}>
        <div style={{ ...T.resultScore, color: GREEN }}>{score}/{qs.length}</div>
      </div>
      <div style={T.resultTxt}>{score === qs.length ? "Отлично! Всё верно" : "Неплохо — повтори главу"}</div>
      <button style={{ ...T.doneBtn, background: gold, marginTop: 4 }} onClick={onNext || onBack}>{onNext ? nextLabel + " →" : "К программе курса"}</button>
    </div>
  </div>);
  return (<div style={T.screen}>
    <Head T={T} title={lesson.title} onBack={onBack} />
    <div style={T.quizWrap}>
      <div style={T.quizProgress}>Вопрос {step + 1} / {qs.length}</div>
      {q.img && <div style={{ marginBottom: 16 }}><Figure T={T}>{renderIll(q.img, gold, dark)}</Figure></div>}
      <div style={T.quizQ}>{q.q}</div>
      {q.options.map((opt, i) => {
        let st = { ...T.quizOpt }; let ic = null;
        if (pick !== null) {
          if (i === q.correct) { st = { ...st, background: "rgba(93,187,138,0.15)", border: "1px solid #5DBB8A", color: T.bold.color }; ic = Ico.check(GREEN, 17); }
          else if (i === pick) { st = { ...st, background: "rgba(224,120,120,0.15)", border: "1px solid #E07878", color: T.bold.color }; ic = Ico.x(RED, 17); }
          else st = { ...st, opacity: 0.5 };
        }
        const choose = () => { if (pick === null) { setPick(i); if (i === q.correct) setScore(s => s + 1); } };
        return (<div key={i} onClick={choose} {...onActivate(pick === null ? choose : undefined)} aria-label={opt} style={{ ...st, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, cursor: pick === null ? "pointer" : "default" }}><span>{opt}</span>{ic && <span style={{ flexShrink: 0 }}>{ic}</span>}</div>);
      })}
      {pick !== null && <div style={{ ...T.explain, borderLeftColor: gold }}>{q.explanation}</div>}
      {pick !== null && <button style={{ ...T.doneBtn, background: gold, marginTop: 14 }} onClick={() => { if (last) setDone(true); else { setStep(s => s + 1); setPick(null); } }}>{last ? "Завершить" : "Дальше →"}</button>}
    </div>
  </div>);
}

// ── Корень раздела ──
export function ReferenceSection({ T, a11y, onExit, startLessonId }) {
  const gold = a11y ? "#8B6A30" : GOLD;
  const dark = !a11y;
  const COURSES = { serving: REFERENCE_COURSE, wine: REFERENCE_WINE_COURSE };
  let startCourseId = "serving", startIdx = -1;
  if (startLessonId) {
    for (const cid of Object.keys(COURSES)) {
      const i = COURSES[cid].lessons.findIndex(l => l.id === startLessonId);
      if (i >= 0) { startCourseId = cid; startIdx = i; break; }
    }
  }
  const [courseId, setCourseId] = R.useState(startCourseId);
  const course = COURSES[courseId] || REFERENCE_COURSE;
  const lessons = course.lessons;
  const [view, setView] = R.useState(startIdx >= 0 ? "read" : "hub");
  const [idx, setIdx] = R.useState(startIdx >= 0 ? startIdx : 0);
  const lesson = lessons[idx];
  const openCourse = (cid) => { setCourseId(cid); setIdx(0); setView("course"); };
  const openLesson = (l) => { setIdx(lessons.indexOf(l)); setView("read"); };
  const next = idx < lessons.length - 1 ? lessons[idx + 1] : null;
  const goNext = next ? () => { setIdx(idx + 1); setView("read"); } : null;
  const nextLabel = next ? (next.type === "quiz" ? "К фото-вопросам" : "Следующая глава") : null;

  if (view === "hub") return <Hub T={T} gold={gold} dark={dark} openCourse={openCourse} onExit={onExit} />;
  if (view === "course") return <Course T={T} gold={gold} course={course} openLesson={openLesson} onBack={() => setView("hub")} />;
  const back = (startIdx >= 0 && idx === startIdx) ? onExit : () => setView("course");
  if (lesson.type === "quiz") return <Quiz T={T} gold={gold} dark={dark} lesson={lesson} onBack={back} onNext={goNext} nextLabel={nextLabel} />;
  return <Lesson T={T} gold={gold} dark={dark} lesson={lesson} onBack={back} onNext={goNext} nextLabel={nextLabel} />;
}

// Задание дня из Справочника: одна глава/тест, меняется по дате (seed).
ReferenceSection.dailyTask = (seed) => {
  const ls = [...REFERENCE_COURSE.lessons, ...REFERENCE_WINE_COURSE.lessons];
  return ls[((seed % ls.length) + ls.length) % ls.length];
};
