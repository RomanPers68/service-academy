// lib/utils.js
// Чистые утилиты: нормализация, перемешивание, выборка, виброотдача.
// Из App.jsx (строки 5, 4177–4217, 4234–4252).

export const normSurname = (s) => (!s || s === "EMPTY") ? "" : s;

export function shuffleArray(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}


// Лучший результат по каждому квизу для каждого игрока — перепрохождение не накручивает средний %
export function dedupeBestScores(list) {
  const best = {};
  list.forEach(s => {
    const key = `${s.name}|${s.surname}|${s.quiz_id || s.quizTitle || s.id}`;
    if (!best[key] || s.pct > best[key].pct) best[key] = s;
  });
  return Object.values(best);
}

export function pickRandom(arr, n) {
  const seen = new Set();
  const result = [];
  for (const item of shuffleArray(arr)) {
    const key = item.scene || item.statement || item.question || JSON.stringify(item).slice(0, 60);
    if (!seen.has(key)) {
      seen.add(key);
      result.push(item);
      if (result.length >= n) break;
    }
  }
  return result;
}
export function shuffleSituationOptions(sit) {
  if (sit.genre === "hotspot") return sit;
  if (sit.genre === "truefalse") return sit;
  if (!sit.options || sit.options.length === 0) return sit;
  const indexed = sit.options.map((text, i) => ({ text, isCorrect: i === sit.correct }));
  const shuffled = shuffleArray(indexed);
  return { ...sit, options: shuffled.map(o => o.text), correct: shuffled.findIndex(o => o.isCorrect) };
}

export const vibrate = (pattern) => {
  try {
    if (window.Telegram?.WebApp?.HapticFeedback) {
      // Telegram haptic API
      if (pattern === "success") window.Telegram.WebApp.HapticFeedback.notificationOccurred("success");
      else if (pattern === "error") window.Telegram.WebApp.HapticFeedback.notificationOccurred("error");
      else if (pattern === "light") window.Telegram.WebApp.HapticFeedback.impactOccurred("light");
      else if (pattern === "medium") window.Telegram.WebApp.HapticFeedback.impactOccurred("medium");
      else if (pattern === "heavy") window.Telegram.WebApp.HapticFeedback.impactOccurred("heavy");
    } else if (navigator.vibrate) {
      // Web Vibration API
      if (pattern === "success") navigator.vibrate([40, 30, 80]);
      else if (pattern === "error") navigator.vibrate([80, 40, 80, 40, 80]);
      else if (pattern === "light") navigator.vibrate(20);
      else if (pattern === "medium") navigator.vibrate(40);
      else if (pattern === "heavy") navigator.vibrate([60, 30, 60]);
    }
  } catch(e) {}
};

// Доступность: делает кликабельный элемент управляемым с клавиатуры (Enter/Space)
// и озвучиваемым скринридером как кнопка. Вид не меняется. Применение:
//   <div onClick={fn} {...onActivate(fn)} style={...}>
// Если обработчик не задан (undefined) — ничего не добавляет (элемент не фокусируется).
export const onActivate = (handler) => (handler ? {
  role: "button",
  tabIndex: 0,
  onKeyDown: (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); handler(e); } },
} : {});

// Перемешивание вариантов вопроса теста/экзамена с пересчётом индекса правильного.
// Принимает { options: [...], correct: number }, возвращает копию с новым порядком.
// Все места сверяют ответ с полем correct того же объекта, поэтому логика не ломается.
export function shuffleQuizOptions(q) {
  if (!q || !Array.isArray(q.options) || typeof q.correct !== "number" || q.options.length < 2) return q;
  const indexed = q.options.map((text, i) => ({ text, isCorrect: i === q.correct }));
  const shuffled = shuffleArray(indexed);
  return { ...q, options: shuffled.map(o => o.text), correct: shuffled.findIndex(o => o.isCorrect) };
}

// Перемешивание вариантов во всех вопросах урока-теста (для открытия урока).
export function shuffleLessonQuestions(lesson) {
  if (!lesson || lesson.type !== "quiz" || !Array.isArray(lesson.questions)) return lesson;
  return { ...lesson, questions: lesson.questions.map(shuffleQuizOptions) };
}
