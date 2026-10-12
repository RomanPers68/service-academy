// lib/peek.js — «Подсмотреть в уроке» (Доп. 299): какая карточка урока отвечает
// на ситуацию. Тот же поиск по смыслу, что подбирает ситуации к урокам
// (lib/table-pick.js), только наоборот: по тексту ситуации и верного ответа —
// лучшая карточка среди текстовых уроков раздела.
import { tokensOf, situationText } from "./table-pick";
import { lessonCards } from "./lesson-cards";

export function peekFor(sit, lessons) {
  const list = (lessons || []).filter((l) => l && l.type === "lesson" && l.content);
  if (!sit || !list.length) return null;
  const st = tokensOf(situationText(sit));
  if (!st.size) return null;
  const cards = [];
  list.forEach((l) => lessonCards(l.content).forEach((c, i) => cards.push({ lesson: l, index: i, total: 0, lines: c, tok: tokensOf(c.join(" ") + " " + l.title) })));
  list.forEach((l) => { const n = cards.filter((c) => c.lesson === l).length; cards.forEach((c) => { if (c.lesson === l) c.total = n; }); });
  const df = new Map();
  cards.forEach((c) => { for (const k of c.tok.keys()) df.set(k, (df.get(k) || 0) + 1); });
  const N = cards.length;
  let best = null;
  cards.forEach((c) => {
    let score = 0;
    for (const k of st.keys()) {
      if (!c.tok.has(k)) continue;
      const idf = Math.log((N + 1) / ((df.get(k) || 0) + 1)) + 0.15;
      score += idf * (k[0] === "4" ? 0.5 : 1) * Math.min(2, c.tok.get(k));
    }
    score = score / Math.sqrt(Math.max(1, c.tok.size) / 20 + 1);
    if (!best || score > best.score) best = { ...c, score };
  });
  if (!best || best.score <= 0) return null;
  return { lesson: best.lesson, index: best.index, total: best.total, lines: best.lines, score: best.score };
}
