// lib/ai-cards.js — v94 (Доп. 407): какие карточки блюд и коктейлей показать под ответом Наставника (экран «Наставник»
// и Наставник в чате). Владелец спросил про салат «Два моря», а карточкой пришёл «Краб стригун» (запись владельца): краб
// стоит в составе салата, и поиск названий по тексту ответа нашёл его. Теперь по порядку:
//   1) то, о чём спросили: название блюда или коктейля есть в вопросе (слова в любой форме: «салата два моря»);
//   2) метки модели [[dish:ID]] и [[cocktail:ID]] (из текста их убираем всегда);
//   3) ни того, ни другого: названия в тексте ответа по порядку, но не в строках состава («4. Краб Стригун»).
// То, что входит в состав уже выбранного блюда или коктейля, отдельной карточкой не показываем.
// v96 (Доп. 409): спросили про салат «Два моря» — пришёл и «Морской ёж» (запись владельца). Слова сравнивались по
// началу: у «моря» отрезали «я» и искали слова на «мор» — подошло «морской» (и подошли бы «морковь», «мороженое»).
// А «ёж» из двух букв в названии не проверялся вовсе. Теперь у слова отрезаем окончание целиком и сравниваем основы
// («салата», «салате» → «салат»; «моря» → «мор», «морской» → «морск»; «рибай», «рибая» → «риба»; с беглой гласной:
// «креветок» → «креветк», «огурец» → «огурц»), в названии считаются все слова, кроме предлогов и союзов («в», «с»,
// «на», «из»…) и чисел.

const low = (s) => String(s || "").toLowerCase().replace(/ё/g, "е");
/** Слова: строчные, «ё» как «е», без кавычек и знаков. */
export const aiWords = (s) => low(s).split(/[^a-zа-я0-9]+/).filter(Boolean);
// окончания существительных и прилагательных, длинные — первыми
const ENDS = ["иями", "ями", "ами", "ого", "его", "ому", "ему", "ыми", "ими", "ией", "ой", "ей", "ий", "ый", "ая", "яя", "ое", "ее", "ые", "ие",
  "ую", "юю", "ом", "ем", "ам", "ям", "ах", "ях", "ов", "ев", "ия", "ии", "ию", "им", "ым", "ью", "а", "я", "о", "е", "и", "ы", "у", "ю", "ь", "й"];
/** Слово и его возможные основы: без каждого подходящего окончания, не короче двух букв («рибая» → «рибая», «риб», «риба»);
 *  беглая гласная: «креветок» → «креветк» (как «креветки»), «огурец» → «огурц» (как «огурца»). */
export const aiStems = (w) => {
  const s = String(w || ""), out = [s];
  for (const e of ENDS) if (s.length - e.length >= 2 && s.endsWith(e)) out.push(s.slice(0, -e.length));
  const m = s.length >= 5 && s.match(/^(.+)[оеё]([кц])$/);
  if (m) out.push(m[1] + m[2]);
  return out;
};
/** Одно и то же слово в разных формах: совпала основа целиком (не начало: «моря» и «морской» — разные слова). */
export const sameWord = (a, b) => { if (a === b) return true; const y = aiStems(b); return aiStems(a).some((s) => y.includes(s)); };
// предлоги и союзы в названиях («Тартар из тунца», «Fish & chips») — их в вопросе можно не называть
const GLUE = new Set(["в", "во", "с", "со", "и", "на", "по", "из", "к", "ко", "у", "о", "об", "от", "до", "за", "а", "не",
  "of", "de", "la", "le", "et", "di", "da", "in", "on", "at", "to", "an", "a", "the", "and", "with"]);
/** Название есть в вопросе: каждое слово названия, кроме предлогов, союзов и чисел, есть среди слов вопроса. */
export function namedIn(name, qWords) {
  const ws = aiWords(name), sig = ws.filter((w) => !GLUE.has(w) && !/^[0-9]+$/.test(w) && w.length >= 2), need = sig.length ? sig : ws;
  return need.length > 0 && need.every((w) => (qWords || []).some((q) => sameWord(w, q)));
}
// строка состава или перечня: «4. Краб Стригун», «- лайм»
const LIST = /^\s*(?:\d+[.)]|[-•–*])\s+/;
/** Где в тексте (по словам) название подряд, слова в любой форме («салата «Два моря»» для «Салат «Два моря»»); нет — −1. */
export function phraseAt(name, tWords) {
  const nw = aiWords(name), tw = tWords || [];
  if (!nw.length) return -1;
  for (let i = 0; i + nw.length <= tw.length; i++) if (nw.every((w, k) => sameWord(w, tw[i + k]))) return i;
  return -1;
}

/**
 * → { text: ответ без меток, picks: [{ kind: "dish" | "cocktail", item }] } — не больше max, без повторов.
 * dishes и cocktails — с полями id и name.
 */
export function pickCards({ text = "", question = "", dishes = [], cocktails = [], max = 2 } = {}) {
  const ds = (dishes || []).filter((d) => d && d.id != null && d.name && !d.archived), cs = (cocktails || []).filter((c) => c && c.id != null && c.name);
  const marked = [];
  const clean = String(text || "")
    .replace(/\[\[cocktail:([^\]|]+)(?:\|[^\]]*)?\]\]/g, (_, id) => { const c = cs.find((x) => String(x.id) === id); if (c) marked.push({ kind: "cocktail", item: c }); return ""; })
    .replace(/\[\[dish:([^\]|]+)(?:\|[^\]]*)?\]\]/g, (_, id) => { const d = ds.find((x) => String(x.id) === id); if (d) marked.push({ kind: "dish", item: d }); return ""; });
  const all = [...cs.map((c) => ({ kind: "cocktail", item: c })), ...ds.map((d) => ({ kind: "dish", item: d }))];
  const out = [], seen = new Set();
  // состав уже выбранного: краб в салате «Два моря» — не повод показывать блюдо «Краб стригун»
  const ingOf = (p) => (p.kind === "dish" ? p.item.ingredients || [] : (p.item.ing || []).map((i) => (Array.isArray(i) ? i[0] : i)));
  const inside = (p) => out.some((o) => ingOf(o).some((g) => namedIn(p.item.name, aiWords(g))));
  const add = (p) => { const k = p.kind + ":" + p.item.id; if (out.length < max && !seen.has(k) && !inside(p)) { seen.add(k); out.push(p); } };
  // 1) о чём спросили: сначала самые длинные названия (точнее)
  const qw = aiWords(question);
  if (qw.length) all.filter((p) => namedIn(p.item.name, qw)).sort((a, b) => aiWords(b.item.name).length - aiWords(a.item.name).length).forEach(add);
  // 2) метки модели
  marked.forEach(add);
  // 3) названия в тексте ответа, кроме строк состава, по порядку упоминания
  if (!out.length) {
    const tw = aiWords(clean.split("\n").filter((l) => !LIST.test(l)).join("\n"));
    all.map((p) => ({ p, at: p.item.name.length >= 4 ? phraseAt(p.item.name, tw) : -1 })).filter((x) => x.at >= 0).sort((a, b) => a.at - b.at).forEach((x) => add(x.p));
  }
  return { text: clean, picks: out };
}
