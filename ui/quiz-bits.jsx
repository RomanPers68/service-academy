// ui/quiz-bits.jsx — v71: тест с правилами на виду.
// Аудит v70: правило теста нигде не было написано — третья ошибка обрывала тест «Тест завершён — много
// ошибок», и человек узнавал о правиле, только провалившись. На экране было слово «Тест» и «1 / 12».
// Теперь: тема теста в шапке, три тарелки (как в практике «у стола»: ошибся — одна разбилась),
// бусины прогресса (верно — золото, ошибка — красная), правило словами на первом вопросе и буквы у ответов.
// Правила НЕ менялись — те же, что в App.jsx (handleQuiz) и на экране результата: третья ошибка завершает
// тест, зачёт — от 70% верных.
import React from "react";
import { GOLD, RED, GREEN, CREAM, INK, MUTED_3, labelStyle } from "./tokens";

const plural = (n, one, few, many) => {
  const a = Math.abs(n) % 100, b = a % 10;
  if (a > 10 && a < 20) return many;
  if (b > 1 && b < 5) return few;
  if (b === 1) return one;
  return many;
};

export const QUIZ_LIVES = 3;   // третья ошибка завершает тест (App.jsx: newMistakes >= 3)

// Сколько верных нужно для зачёта и сколько ошибок можно себе позволить: зачёт — от 70% и без третьей ошибки.
// 12 вопросов → нужно 10, ошибиться можно дважды; 11 → 9 и дважды; 5 → 4 и один раз.
export function quizRule(n) {
  const total = Math.max(0, n | 0);
  const need = Math.min(total, Math.max(Math.ceil(total * 0.7 - 1e-9), total - (QUIZ_LIVES - 1)));
  return { need, allowed: Math.max(0, total - need) };
}

// «Тест: поведение в зале» → «Поведение в зале»; другое название — как есть
export function quizTopic(title) {
  const t = String(title || "").replace(/^\s*(финальный\s+)?тест\s*[:.—–-]\s*/i, "").trim();
  if (!t) return "Тест";
  return t.charAt(0).toUpperCase() + t.slice(1);
}

export function rulePhrase(n) {
  const { need, allowed } = quizRule(n);
  if (allowed <= 0) return "Для зачёта нужно ответить верно на все " + n + " " + plural(n, "вопрос", "вопроса", "вопросов") + ".";
  const times = allowed === 1 ? "один раз" : allowed === 2 ? "два раза" : allowed + " " + plural(allowed, "раз", "раза", "раз");
  return "Для зачёта нужно " + need + " верных из " + n + ". Можно ошибиться " + times + ", на третьей ошибке тест закончится. Пересдать можно сразу.";
}

// Тарелка — как в практике «у стола» (ui/table.jsx Plate): белая с золотой каймой; разбитая — две половинки с трещиной
function Plate({ ok, just, light, size = 24 }) {
  const rim = light ? "#8B6A30" : "#C9A867";
  const inner = light ? "#B0915A" : "#9C7B45";
  const fill = light ? "#FFFDF6" : "#EFE4C8";
  const crack = light ? "#B04440" : "#E07878";
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" data-quiz-plate={ok ? "1" : "0"}
      style={{ display: "block", overflow: "visible", animation: just ? "saPlateShake .45s" : "none", filter: ok ? (light ? "drop-shadow(0 1px 1.5px rgba(120,85,25,0.28))" : "drop-shadow(0 1px 2px rgba(0,0,0,0.5))") : "none" }}>
      {ok ? (
        <>
          <circle cx="12" cy="12" r="10" fill={fill} stroke={rim} strokeWidth="1.3" />
          <circle cx="12" cy="12" r="6" fill="none" stroke={inner} strokeWidth="1" opacity=".75" />
        </>
      ) : (
        <g opacity={light ? 0.55 : 0.5}>
          <path d="M11.4 2.05A10 10 0 0 0 10.6 21.9l1.2-4.6-2-2.6 2.3-3.5-1.6-3.1z" fill={fill} stroke={rim} strokeWidth="1.2" strokeLinejoin="round" transform="translate(-1.3 0) rotate(-6 12 12)" />
          <path d="M12.6 2.05A10 10 0 0 1 13.4 21.9l-1.2-4.6 2-2.6-2.3-3.5 1.6-3.1z" fill={fill} stroke={rim} strokeWidth="1.2" strokeLinejoin="round" transform="translate(1.3 0) rotate(6 12 12)" />
          <path d="M12 3.5l-1.2 3.4 1.6 3.4-2.2 3.4 1.9 2.9-.8 4.4" fill="none" stroke={crack} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </g>
      )}
    </svg>
  );
}

// Тарелки в шапке теста: целые — сколько ошибок ещё можно сделать до конца теста
export function QuizPlates({ mistakes = 0, light = false, justBroke = false }) {
  const left = Math.max(0, QUIZ_LIVES - mistakes);
  const can = Math.max(0, left - 1);
  return (
    <span role="img" data-quiz-plates={left}
      aria-label={can > 0 ? "Можно ошибиться ещё " + can + " " + plural(can, "раз", "раза", "раз") : left > 0 ? "Следующая ошибка завершит тест" : "Тест завершён"}
      style={{ display: "inline-flex", gap: 3, flex: "0 0 auto", alignItems: "center" }}>
      {Array.from({ length: QUIZ_LIVES }, (_, i) => <Plate key={i} ok={i < left} just={justBroke && i === left} light={light} />)}
    </span>
  );
}

// Бусины на нити: верно — золото, ошибка — красная, текущий вопрос — крупнее с золотой каймой
export function QuizBeads({ n, step, answers = [], pending = null, light = false }) {
  const edge = light ? "rgba(139,106,48,0.45)" : "rgba(214,178,102,0.38)";
  const track = light ? "rgba(139,106,48,0.18)" : "rgba(255,240,210,0.10)";
  const gold = light ? "#A07A2C" : GOLD;
  const bad = light ? "#C0504A" : RED;
  const done = answers.length + (pending ? 1 : 0);
  const frac = n > 1 ? Math.min(1, Math.max(0, (done - (done >= n ? 1 : 0)) / (n - 1))) : 1;
  return (
    <div data-quiz-beads={n} style={{ position: "relative", height: 14, margin: "8px 0 2px" }}>
      <span style={{ position: "absolute", left: 5, right: 5, top: 6, height: 2, borderRadius: 1, background: track }} />
      <span style={{ position: "absolute", left: 5, top: 6, height: 2, borderRadius: 1, background: gold, width: "calc((100% - 10px) * " + frac.toFixed(4) + ")", transition: "width .45s cubic-bezier(.2,.8,.2,1)" }} />
      <span style={{ position: "relative", display: "flex", justifyContent: "space-between", alignItems: "center", height: 14 }}>
        {Array.from({ length: n }, (_, k) => {
          const a = k < answers.length ? answers[k] : k === answers.length && pending ? pending : null;
          const cur = !a && k === step;
          const bg = a ? (a.isCorrect ? gold : bad) : light ? "#FBF4E4" : "#1E1910";
          return <i key={k} data-bead={a ? (a.isCorrect ? "ok" : "bad") : cur ? "cur" : ""}
            style={{ width: 10, height: 10, borderRadius: "50%", background: bg, boxShadow: a ? "none" : "inset 0 0 0 1.5px " + (cur ? gold : edge),
              transform: cur ? "scale(1.4)" : "none", transition: "background .3s, transform .3s, box-shadow .3s" }} />;
        })}
      </span>
    </div>
  );
}

// Буква варианта: А Б В Г; после ответа — ✓ у верного и ✕ у выбранного неверного
const LETTERS = ["А", "Б", "В", "Г", "Д", "Е"];
export function OptLetter({ i, state = null, light = false }) {
  const gold = light ? "#7A5A1E" : GOLD;
  const ok = light ? "#2E7D55" : GREEN, bad = light ? "#B04440" : RED;
  const c = state === "ok" ? ok : state === "bad" ? bad : gold;
  return (
    <span aria-hidden="true" style={{ width: 26, height: 26, flex: "0 0 26px", borderRadius: "50%", display: "inline-flex", alignItems: "center", justifyContent: "center",
      fontFamily: "Georgia, serif", fontSize: 13, fontWeight: "bold", color: state ? (light ? "#FFFDF6" : "#16120A") : c,
      background: state ? c : "transparent", boxShadow: state ? "none" : "inset 0 0 0 1.2px " + c + (light ? "88" : "77") }}>
      {state === "ok" ? "✓" : state === "bad" ? "✕" : LETTERS[i] || String(i + 1)}
    </span>
  );
}

// Строка над бусинами: «Вопрос 2 из 12» и «зачёт — от 10 верных»
export function QuizMeta({ n, step, light = false }) {
  const { need } = quizRule(n);
  // v73 (Доп. 386): подпись курсивом в обычном регистре (было: моноширинный капс)
  const label = labelStyle(light ? 14.5 : 13.5);
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 10 }}>
      <span data-quiz-step style={{ ...label, color: light ? "#6B5536" : MUTED_3 }}>Вопрос {Math.min(n, step + 1)} из {n}</span>
      <span data-quiz-need style={{ ...label, color: light ? "#7A5A1E" : GOLD }}>зачёт — от {need}</span>
    </div>
  );
}

// Правило словами — на первом вопросе, пока не ответил (дальше его заменяют тарелки и бусины)
export function QuizRuleNote({ n, light = false }) {
  return (
    <div data-quiz-rule role="note" style={{ display: "flex", gap: 10, alignItems: "flex-start", margin: "12px 0 4px", padding: "10px 12px", borderRadius: 12,
      background: light ? "rgba(139,106,48,0.07)" : "rgba(214,178,102,0.07)", boxShadow: "inset 0 0 0 1px " + (light ? "rgba(139,106,48,0.22)" : "rgba(214,178,102,0.20)") }}>
      <span style={{ marginTop: 1 }}><Plate ok light={light} /></span>
      <span style={{ fontSize: light ? 15 : 13, lineHeight: 1.5, color: light ? INK : CREAM, opacity: light ? 0.9 : 0.86 }}>{rulePhrase(n)}</span>
    </div>
  );
}

// анимация «тарелка треснула» — один раз на документ
let plateCss = false;
export function ensureQuizCss() {
  if (plateCss || typeof document === "undefined") return;
  plateCss = true;
  try {
    const st = document.createElement("style");
    st.setAttribute("data-quiz-css", "1");
    st.textContent = "@keyframes saPlateShake{0%,100%{transform:none}20%{transform:translateX(-2px) rotate(-6deg)}40%{transform:translateX(2px) rotate(5deg)}60%{transform:translateX(-1px) rotate(-3deg)}80%{transform:translateX(1px)}}"
      + "@media (prefers-reduced-motion: reduce){[data-quiz-plate]{animation:none!important}}";
    document.head.appendChild(st);
  } catch (e) {}
}
