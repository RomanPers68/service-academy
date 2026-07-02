// lib/assistant.js — Этап 5 (СПЯЩИЙ): клиентская обвязка AI-наставника.
// Пока её никто не импортирует — это корень. Когда включим ассистента,
// экран чата возьмёт отсюда две функции и заработает.
//
// buildAssistantContext — отбирает из базы знаний только релевантные вопросу куски
// (та же нормализация, что в глобальном поиске), чтобы запрос был дешёвым и точным.
// askAssistant — ходит в /api/assistant (см. api/assistant.js).

const norm = (s) => (s || "").toLowerCase().replace(/ё/g, "е");

// Слова вопроса длиной от 4 букв — грубые «ключи» для отбора фрагментов
const keywords = (q) => norm(q).split(/[^a-zа-я0-9]+/i).filter(w => w.length >= 4);

const scoreText = (text, keys) => {
  const t = norm(text);
  return keys.reduce((s, k) => s + (t.includes(k) ? 1 : 0), 0);
};

/**
 * Собирает текстовый контекст для ассистента.
 * @param {string} question — вопрос сотрудника
 * @param {Array} modules — модули роли (MODULES[role] + кастомные)
 * @param {Array} glossary — GLOSSARY
 * @param {Array} dishes — блюда ресторана сотрудника (из меню-тренажёра)
 * @returns {string} — компактный контекст (~6–10 тыс. знаков максимум)
 */
export function buildAssistantContext(question, modules = [], glossary = [], dishes = []) {
  const keys = keywords(question);
  const parts = [];

  // 1. Блюда: самые релевантные карточки целиком — аллергены должны быть точными
  const scoredDishes = dishes
    .map(d => ({ d, s: scoreText(`${d.name} ${(d.ingredients || []).join(" ")} ${(d.allergens || []).join(" ")} ${d.note || ""} ${d.desc || ""} ${d.cat || ""}`, keys) }))
    .filter(x => x.s > 0).sort((a, b) => b.s - a.s).slice(0, 4);
  for (const { d } of scoredDishes) {
    parts.push(`БЛЮДО: ${d.name} (${d.cat || "—"}). Состав: ${(d.ingredients || []).join(", ")}. Аллергены: ${(d.allergens || []).join(", ") || "нет из большой восьмёрки"}. ${d.note ? "Важно: " + d.note : ""} ${d.desc ? "Описание гостю: " + d.desc : ""}`);
  }

  // 2. Глоссарий: точные термины
  const terms = glossary
    .map(g => ({ g, s: scoreText(g.term + " " + g.def, keys) }))
    .filter(x => x.s > 0).sort((a, b) => b.s - a.s).slice(0, 4);
  for (const { g } of terms) parts.push(`ТЕРМИН: ${g.term} — ${g.def}`);

  // 3. Уроки: релевантные фрагменты (окно вокруг совпадения, не весь урок)
  const frags = [];
  outer:
  for (const m of modules) {
    for (const l of (m.lessons || [])) {
      if (l.type !== "lesson" || !l.content) continue;
      const s = scoreText(l.title + " " + l.content, keys);
      if (s >= 2) {
        const plain = l.content.replace(/\s+/g, " ");
        const i = keys.map(k => norm(plain).indexOf(k)).filter(x => x >= 0).sort((a, b) => a - b)[0] || 0;
        frags.push(`УРОК «${l.title}» (модуль «${m.title}»): …${plain.slice(Math.max(0, i - 200), i + 800)}…`);
        if (frags.length >= 3) break outer;
      }
    }
  }
  parts.push(...frags);

  return parts.join("\n\n").slice(0, 11000);
}

/**
 * Запрос к серверному ассистенту.
 * @param {string} question
 * @param {string} context — из buildAssistantContext
 * @param {Array} history — [{role:"user"|"assistant", content:"..."}], хранить на устройстве
 * @returns {Promise<{answer?:string, error?:string}>}
 */
export async function askAssistant(question, context, history = []) {
  try {
    const r = await fetch("/api/assistant", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question, context, history }),
    });
    return await r.json();
  } catch (e) {
    return { error: "Сеть недоступна" };
  }
}
