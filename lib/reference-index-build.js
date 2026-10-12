// Сборка индекса глав справочника из data/reference.js — общая для генератора и теста.
// Порядок глав — тот же, в котором «глава дня» перебирает их по кругу.
export function buildReferenceIndex(ref) {
  const courses = [ref.REFERENCE_COURSE, ref.REFERENCE_WINE_COURSE, ref.REFERENCE_COFFEE_COURSE, ref.REFERENCE_BAR_COURSE, ref.REFERENCE_APP_COURSE];
  const out = [];
  for (const c of courses) {
    const course = (c && (c.title || c.name)) || "Справочник";
    for (const l of (c && c.lessons) || []) {
      const row = { id: l.id, title: l.title, course };
      if (l.type) row.type = l.type;
      if (l.leaderOnly) row.leaderOnly = true;
      out.push(row);
    }
  }
  return out;
}
