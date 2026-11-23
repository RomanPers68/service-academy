// lib/text-diff.js — v192 (Доп. 517): «Что изменилось» в «О нас» — чем текст блока сейчас отличается от того, что человек
// видел, когда отметил «Ознакомлен(а)». Без React и без библиотек.
//
// Сначала строки (абзацы, пункты списков) — что осталось, что добавили, что убрали; строку, которую переписали, —
// по словам: добавленные слова и убранные. Длинные куски без изменений экран сворачивает (foldSame).

const lines = (s) => String(s == null ? "" : s).replace(/\r/g, "").split("\n").map((x) => x.replace(/\s+$/, "")).filter((x) => x.trim());

// общая подпоследовательность: для каждой пары — длина хвоста; потом проход сначала
function lcsOps(a, b, eq = (x, y) => x === y) {
  const n = a.length, m = b.length;
  const w = m + 1, L = new Uint16Array((n + 1) * w);
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) L[i * w + j] = eq(a[i], b[j]) ? L[(i + 1) * w + j + 1] + 1 : Math.max(L[(i + 1) * w + j], L[i * w + j + 1]);
  const out = [];
  let i = 0, j = 0;
  while (i < n && j < m) {
    if (eq(a[i], b[j])) { out.push({ t: "same", a: a[i], b: b[j] }); i++; j++; }
    else if (L[(i + 1) * w + j] >= L[i * w + j + 1]) { out.push({ t: "del", a: a[i] }); i++; }
    else { out.push({ t: "add", b: b[j] }); j++; }
  }
  while (i < n) out.push({ t: "del", a: a[i++] });
  while (j < m) out.push({ t: "add", b: b[j++] });
  return out;
}

const WORDS_MAX = 400;   // строка длиннее — целиком «было / стало», без разбора по словам
const toks = (s) => String(s).split(/(\s+|[.,;:!?«»"()])/).filter((x) => x !== "");   // знаки препинания — отдельно от слов

/** Слова одной строки: [{ t: "same" | "add" | "del", s }] — соседние куски одного вида склеены. */
export function diffWords(a, b) {
  const A = toks(a), B = toks(b);
  const segs = [];
  const push = (t, s) => { const last = segs[segs.length - 1]; if (last && last.t === t) last.s += s; else segs.push({ t, s }); };
  if (A.length > WORDS_MAX || B.length > WORDS_MAX) { push("del", String(a)); push("add", String(b)); return segs; }
  // пробелы сравниваем как пробелы: «рыба  и» и «рыба и» — одно
  const norm = (x) => (/^\s+$/.test(x) ? " " : x);
  for (const o of lcsOps(A, B, (x, y) => norm(x) === norm(y))) {
    if (o.t === "same") push("same", o.b);
    else if (o.t === "del") push("del", o.a);
    else push("add", o.b);
  }
  // убранный и добавленный пробел между словами — один пробел
  return segs.filter((x) => !(x.t !== "same" && /^\s+$/.test(x.s)));
}

// похожи ли строки настолько, чтобы показывать их как одну переписанную (иначе — «убрали» и «добавили»)
function close(a, b) {
  const A = new Set(String(a).toLowerCase().split(/[^a-zа-яё0-9]+/).filter((x) => x.length > 2));
  const B = String(b).toLowerCase().split(/[^a-zа-яё0-9]+/).filter((x) => x.length > 2);
  if (!A.size || !B.length) return false;
  const common = B.filter((x) => A.has(x)).length;
  return common / Math.max(A.size, B.length) >= 0.34;
}

/**
 * Текст «было» → «стало» по строкам: [{ t: "same", s } | { t: "add", s } | { t: "del", s } | { t: "mod", segs }].
 * Подряд идущие «убрали» и «добавили» с похожими строками — «mod» с разбором по словам.
 */
export function diffText(was, now) {
  const ops = lcsOps(lines(was), lines(now));
  const out = [];
  for (let k = 0; k < ops.length;) {
    if (ops[k].t === "same") { out.push({ t: "same", s: ops[k].b }); k++; continue; }
    const dels = [], adds = [];
    while (k < ops.length && ops[k].t !== "same") { if (ops[k].t === "del") dels.push(ops[k].a); else adds.push(ops[k].b); k++; }
    // строка «добавили» берёт себе похожую «убрали» — это одна переписанная строка
    const usedDel = new Set();
    const pairOf = adds.map((x) => { const j = dels.findIndex((d, i) => !usedDel.has(i) && close(d, x)); if (j >= 0) usedDel.add(j); return j; });
    dels.forEach((d, i) => { if (!usedDel.has(i)) out.push({ t: "del", s: d }); });
    adds.forEach((x, i) => out.push(pairOf[i] >= 0 ? { t: "mod", segs: diffWords(dels[pairOf[i]], x) } : { t: "add", s: x }));
  }
  return out;
}

/** Сколько изменений: { add, del, mod } — по строкам. */
export function diffCount(d) {
  const c = { add: 0, del: 0, mod: 0 };
  for (const x of d || []) if (c[x.t] != null) c[x.t]++;
  return c;
}

/**
 * Свернуть длинные куски без изменений: вокруг изменений остаётся ctx строк, остальное — { t: "fold", n } («ещё n строк
 * без изменений»). Если изменений нет — один { t: "fold", n: все }.
 */
export function foldSame(d, ctx = 1) {
  const keep = d.map((x) => x.t !== "same");
  const near = d.map((x, i) => keep[i] || keep.slice(Math.max(0, i - ctx), i + ctx + 1).some(Boolean));
  const out = [];
  let run = 0;
  d.forEach((x, i) => {
    if (near[i]) { if (run) { out.push({ t: "fold", n: run }); run = 0; } out.push(x); }
    else run++;
  });
  if (run) out.push({ t: "fold", n: run });
  return out;
}
