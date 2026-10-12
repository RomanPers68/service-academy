// lib/lesson-cards.js — как текст урока делится на карточки (Этап 3).
// Вынесено из LessonScreen без изменений (Доп. 299): тем же делением пользуется
// «Подсмотреть в уроке» — показывает ровно ту карточку, которую человек видел.
// Новые карточки начинаются на заголовках/стикерах, лимит ~700 знаков,
// короткие «хвосты» приклеиваются к предыдущей — мысль не обрывается.

export function lessonCards(content) {
  const lines = (content || "").split("\n");
  const blocks = []; let cur = [];
  for (const ln of lines) { if (!ln.trim()) { if (cur.length) { blocks.push(cur); cur = []; } } else cur.push(ln); }
  if (cur.length) blocks.push(cur);
  const blockLen = (b) => b.join(" ").length;
  const isHeader = (b) => {
    const t = (b[0] || "").trim();
    if (t.startsWith("**") && t.endsWith("**")) return true;
    if (t.startsWith("[mm:")) return true;
    return /^[\p{Extended_Pictographic}\s️‍]+$/u.test(t) && t.length <= 12;
  };
  const out = []; let acc = []; let len = 0;
  for (const b of blocks) {
    const L = blockLen(b);
    if (acc.length && (len + L > 700 || (isHeader(b) && len > 250))) { out.push(acc); acc = []; len = 0; }
    acc = acc.concat(acc.length ? [""] : [], b); len += L;
  }
  if (acc.length) out.push(acc);
  for (let i = out.length - 1; i > 0; i--) {
    if (out[i].join(" ").length < 140) { out[i - 1] = out[i - 1].concat([""], out[i]); out.splice(i, 1); }
  }
  if (out.length > 1 && out[0].join(" ").length < 140) { out[1] = out[0].concat([""], out[1]); out.splice(0, 1); }
  return out.length ? out : [lines];
}
