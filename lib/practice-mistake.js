// lib/practice-mistake.js — ситуация практики → вопрос «Работы над ошибками» (Доп. 291).
// Формат тот же, что у вопросов тестов: { q, options, correct, explanation, … },
// плюс from: "practice". Одна функция и для записи ошибки, и для уборки банка в App
// (вопрос живёт, пока такая ситуация есть в программе) — тексты совпадают побуквенно.

const genreOf = (s) => (s && (s.genre || s.type)) || "action";
const stripEm = (t) => String(t || "").replace(/^[\p{Extended_Pictographic}️‍\s]+/u, "").trim();
export const tfLabel = (o) => (/невер|❌|миф/i.test(String(o)) ? { t: "Миф", s: "так только кажется" } : { t: "Правда", s: "так и есть" });

export function mistakeFromSituation(sit, lesson) {
  if (!sit || !Array.isArray(sit.options) || typeof sit.correct !== "number") return null;
  const g = genreOf(sit);
  // v87: у случая из зала «как было у нас» — отдельно (плашкой у «стола»); в «Работе над ошибками» — в конце разбора
  const real = sit._real ? stripEm(sit._real).trim() : "";
  const expl = (stripEm(sit.win) || stripEm(sit.fail)) + (real ? " Как было у нас: " + (/[.!?…][»)"]*$/.test(real) ? real : real + ".") : "");
  const base = { correct: sit.correct, explanation: expl, img: null, lessonTitle: (lesson && lesson.title) || "", lessonId: (lesson && lesson.id) || "", from: "practice" };
  if (g === "truefalse") return { ...base, q: "Правда или миф: «" + String(sit.statement || "").replace(/^«|»$/g, "") + "»", options: sit.options.map((o) => tfLabel(o).t), fixed: true };
  if (g === "complete") return { ...base, q: String(sit.start || "").trim() + " …", options: [...sit.options] };
  if (g === "quiz") return { ...base, from: "quiz", q: String(sit.question || "").trim(), options: [...sit.options] };   // Доп. 310
  const q = [sit.guestThought ? "Мысли гостя: «" + sit.guestThought + "»" : "", sit.scene || "", sit.question || ""].filter(Boolean).join(" ");
  return { ...base, q, options: [...sit.options] };
}

// Тексты вопросов всех ситуаций практик — для уборки банка
export function practiceQuestionTexts(modules) {
  const out = new Set();
  for (const m of modules || []) for (const l of (m && m.lessons) || []) {
    if (!l || l.type !== "practice") continue;
    for (const s of l.situations || []) { const x = mistakeFromSituation(s, l); if (x && x.q) out.add(x.q); }
  }
  return out;
}

// У ситуации один текст промаха (fail), а неверных вариантов несколько. Если fail
// цитирует один из вариантов («Я новенький» — гость потерял доверие) — он про этот
// вариант: показываем, только когда выбран именно он, иначе — объяснение верного
// ответа (win). Цитата не из вариантов (мысли гостя: «здесь не рады») и fail без
// цитат — общий вывод, подходит к любому промаху.
const low = (x) => String(x || "").toLowerCase().replace(/ё/g, "е");
export function failFits(fail, chosen, options) {
  const f = String(fail || "");
  if (!f.trim()) return false;
  const quotes = [...f.matchAll(/«([^»]{2,})»/g)].map((m) => low(m[1]).trim());
  const opts = (options || []).map(low);
  const own = quotes.filter((q) => opts.some((o) => o.includes(q)));
  if (!own.length) return true;
  const ch = low(chosen);
  if (!ch.trim()) return false;
  return own.some((q) => ch.includes(q));
}
// Что сказать после промаха: подходящий fail или объяснение верного ответа
export function missText(sit, chosen) {
  if (!sit) return "";
  return failFits(sit.fail, chosen, sit.options) ? (sit.fail || sit.win || "") : (sit.win || sit.fail || "");
}
