// lib/bar-lab.js — движок «Сборки руками» (Дополнение 208). Чистые функции, без React.
// Из спека коктейля (data/cocktails.js) строит сценарий: что и в каком порядке делает бармен,
// какие предметы лежат на станции (правильные + обманки), и проверяет каждое действие.

export const GLASS_RU = { rocks: "Олд фэшн (рокс)", highball: "Хайбол", martini: "Купе / мартини", sour: "Сауэр", flute: "Флюте", hurricane: "Харрикейн", shot: "Шот", irish: "Айриш-кофе", margarita: "Маргарита", red: "Бокал для вина" };
export const GARNISH_RU = { orange: "Долька апельсина", peel: "Цедра апельсина", "peel-lemon": "Цедра лимона", mint: "Веточка мяты", lime: "Долька лайма", lemon: "Долька лимона", cherry: "Вишня", cream: "Шапка сливок", salt: "Соль на кромке", onion: "Луковка", olive: "Оливка", none: "Без гарниша" };
export const TOOLS = { shake: "Шейк", stir: "Стир", strain: "Стрейнер", muddle: "Мадлер", blend: "Блендер", layer: "Слоями по ложке", swizzle: "Свизл", top: "Долить" };
export const AMOUNTS = [5, 10, 15, 20, 25, 30, 40, 45, 50, 60, 80, 90, 100, 120, 150];
/** Джиггер под коктейль: стандартный ряд плюс все объёмы его спека — собрать можно всегда */
export const jiggerFor = (c) => [...new Set([...AMOUNTS, ...(c.ing || []).filter(i => /^мл/.test(String(i[2] || "мл"))).map(i => Number(i[1])).filter(n => n > 0)])].sort((a, b) => a - b);

const norm = (s) => String(s || "").toLowerCase().replace(/ё/g, "е").trim();
const isTopper = (ing) => /доверху|стакан/.test(String(ing[2] || "")) || /содов|тоник|кола|спрайт|лимонад|игрист|энергет|просекко|шампан|пиво|эль/.test(norm(ing[0])) && (ing[1] || 0) >= 60;
const isMuddle = (ing) => /мят|лайм|сахар|ягод|базилик|огурец/.test(norm(ing[0])) && (/листьев|шт|ягод|ч\.л\./.test(String(ing[2] || "")) || /мят/.test(norm(ing[0])));
const isFloat = (ing) => /флоат|взбит/.test(String(ing[2] || ""));
const unitOf = (ing) => { const u = String(ing[2] || "мл"); return u.replace(/,.*$/, "") || "мл"; };

/** Шаг сценария: { kind, label, ...данные } */
export function buildScenario(c, all = []) {
  const steps = [];
  const method = c.method || "билд";
  const glassIce = c.ice === "crushed" ? "crushed" : c.ice ? "cube" : "none";
  const ings = c.ing || [];
  const muddleIngs = method === "мадл" || method === "билд" ? ings.filter(isMuddle) : [];
  const toppers = ings.filter(isTopper);
  const floats = ings.filter(isFloat);
  const core = ings.filter(i => !muddleIngs.includes(i) && !toppers.includes(i) && !floats.includes(i));
  const ingStep = (i) => ({ kind: "ing", name: i[0], amount: i[1], unit: unitOf(i), label: `${i[0]} — ${i[1]} ${unitOf(i)}` });

  steps.push({ kind: "glass", id: c.glass, label: GLASS_RU[c.glass] || c.glass });
  if (method === "шейк") {
    core.forEach(i => steps.push({ ...ingStep(i), where: "shaker" }));
    steps.push({ kind: "ice", id: "cube", where: "shaker", label: "Лёд в шейкер до верха" });
    if (c.foam) steps.push({ kind: "tool", id: "shake", label: "Сухой шейк, потом со льдом" });
    else steps.push({ kind: "tool", id: "shake", label: "Шейк 10–15 секунд" });
    if (glassIce !== "none") steps.push({ kind: "ice", id: glassIce, where: "glass", label: glassIce === "crushed" ? "Краш в бокал" : "Лёд в бокал" });
    steps.push({ kind: "tool", id: "strain", label: glassIce === "none" ? "Дабл-стрейн в охлаждённый бокал" : "Стрейн в бокал" });
  } else if (method === "стир") {
    core.forEach(i => steps.push({ ...ingStep(i), where: "mixing" }));
    steps.push({ kind: "ice", id: "cube", where: "mixing", label: "Лёд в смесительный стакан" });
    steps.push({ kind: "tool", id: "stir", label: "Стир 20–30 секунд, до инея" });
    if (glassIce !== "none") steps.push({ kind: "ice", id: glassIce, where: "glass", label: "Крупный лёд в бокал" });
    steps.push({ kind: "tool", id: "strain", label: "Стрейн в бокал" });
  } else if (method === "мадл" || (method === "билд" && muddleIngs.length)) {
    muddleIngs.forEach(i => steps.push({ ...ingStep(i), where: "glass" }));
    steps.push({ kind: "tool", id: "muddle", label: "Мадлер — мягко продавить" });
    if (glassIce !== "none") steps.push({ kind: "ice", id: glassIce, where: "glass", label: glassIce === "crushed" ? "Краш доверху" : "Лёд в бокал" });
    core.forEach(i => steps.push({ ...ingStep(i), where: "glass" }));
    steps.push({ kind: "tool", id: "stir", label: "Перемешать снизу вверх, один-два оборота", afterTop: true });
  } else if (method === "слои") {
    ings.forEach(i => steps.push({ ...ingStep(i), where: "glass", label: `${i[0]} — ${i[1]} мл, по ложке` }));
  } else if (method === "блендер") {
    core.forEach(i => steps.push({ ...ingStep(i), where: "blender" }));
    steps.push({ kind: "ice", id: "crushed", where: "blender", label: "Краш в блендер" });
    steps.push({ kind: "tool", id: "blend", label: "Блендер до однородности" });
  } else { // билд / свизл
    if (glassIce !== "none") steps.push({ kind: "ice", id: glassIce, where: "glass", label: glassIce === "crushed" ? "Краш доверху" : "Лёд в бокал до верха" });
    core.forEach(i => steps.push({ ...ingStep(i), where: "glass" }));
    if (method === "свизл") steps.push({ kind: "tool", id: "swizzle", label: "Свизл — растереть между ладонями", afterTop: true });
    else if (toppers.length || core.length > 1) steps.push({ kind: "tool", id: "stir", label: "Один-два оборота ложкой", afterTop: true });
  }
  // Общий хвост для любого метода: топперы (доверху) → перемешивание, помеченное afterTop → флоаты сверху
  const tail = steps.filter(s => s.afterTop); steps.splice(0, steps.length, ...steps.filter(s => !s.afterTop));
  toppers.forEach(i => steps.push({ ...ingStep(i), where: "glass", label: `${i[0]} — доверху, по ложке` }));
  tail.forEach(t => { delete t.afterTop; steps.push(t); });
  floats.forEach(i => steps.push({ ...ingStep(i), where: "glass", label: `${i[0]} — флоат сверху` }));
  if (c.garnish && c.garnish !== "none") steps.push({ kind: "garnish", id: c.garnish, label: GARNISH_RU[c.garnish] || c.garnish });

  // Станция: правильные предметы + обманки из других коктейлей
  const others = all.filter(x => x.id !== c.id);
  const pick = (arr, n, key) => { const seen = new Set(); const out = []; for (const v of arr) { const k = key(v); if (!k || seen.has(k)) continue; seen.add(k); out.push(v); if (out.length >= n) break; } return out; };
  const shuffle = (a) => { const r = a.slice(); for (let i = r.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [r[i], r[j]] = [r[j], r[i]]; } return r; };
  const myIngNames = new Set(ings.map(i => norm(i[0])));
  const foreignIngs = pick(shuffle(others.flatMap(x => x.ing.map(i => i[0]))).filter(n => !myIngNames.has(norm(n))), 3, norm);
  const station = {
    glasses: shuffle([c.glass, ...pick(shuffle(Object.keys(GLASS_RU).filter(g => g !== c.glass)), 3, x => x)]),
    ices: ["cube", "crushed", "none"],
    ings: shuffle([...ings.map(i => i[0]), ...foreignIngs]),
    tools: ["shake", "stir", "strain", "muddle", "blend", "layer", "swizzle"],
    garnishes: shuffle([...(c.garnish && c.garnish !== "none" ? [c.garnish] : []), ...pick(shuffle(Object.keys(GARNISH_RU).filter(g => g !== c.garnish && g !== "none")), 3, x => x)]),
  };
  return { id: c.id, name: c.name, steps, station, spec: c };
}

/**
 * Проверка действия. Порядок строгий по «фазам», но ингредиенты одной фазы можно добавлять в любом порядке.
 * action: { kind:"glass"|"ice"|"ing"|"tool"|"garnish", id?, name?, amount?, unit? }
 * Возвращает { ok, done, expected, why }.
 */
export function checkAction(scenario, doneIdx, action) {
  const steps = scenario.steps;
  const remaining = steps.map((s, i) => ({ s, i })).filter(x => !doneIdx.includes(x.i));
  if (!remaining.length) return { ok: false, done: true, why: "Коктейль уже собран." };
  // фаза = непрерывный блок одинакового kind в начале оставшихся (ингредиенты — в любом порядке внутри блока)
  const first = remaining[0].s;
  const phase = [];
  for (const r of remaining) { if (r.s.kind === first.kind && (first.kind === "ing" ? r.s.where === first.where : true)) phase.push(r); else break; }
  const match = (s) => {
    if (s.kind !== action.kind) return false;
    if (s.kind === "ing") return norm(s.name) === norm(action.name);
    return s.id === action.id;
  };
  const hit = phase.find(r => match(r.s));
  if (!hit) {
    const anyLater = remaining.find(r => match(r.s));
    const why = anyLater
      ? `Рано: сначала ${first.label.toLowerCase()}.`
      : action.kind === "ing" ? `«${action.name}» в этом коктейле нет.` : action.kind === "glass" ? `Не тот бокал: нужен ${first.kind === "glass" ? first.label.toLowerCase() : GLASS_RU[scenario.spec.glass].toLowerCase()}.` : `Сейчас нужно: ${first.label.toLowerCase()}.`;
    return { ok: false, done: false, expected: first, why };
  }
  if (hit.s.kind === "ing" && hit.s.unit === "мл" && action.amount != null && Number(action.amount) !== Number(hit.s.amount)) {
    return { ok: false, done: false, expected: hit.s, why: `${hit.s.name}: ${hit.s.amount} мл, а не ${action.amount}.`, amountMiss: true };
  }
  const nextDone = [...doneIdx, hit.i];
  return { ok: true, done: nextDone.length === steps.length, expected: remaining[1] ? remaining[1].s : null, idx: hit.i, doneIdx: nextDone };
}

// ── Мастерство: 0 — не собирал · 1 — с подсказками · 2 — по памяти · 3 — трижды подряд без ошибок
export const MASTERY_LABEL = ["не собирал", "с подсказками", "по памяти", "мастер"];
export function loadMastery(uk) { try { return JSON.parse(localStorage.getItem("sa_bar_mastery" + (uk || "")) || "{}"); } catch (e) { return {}; } }
export function saveMastery(uk, m) { try { localStorage.setItem("sa_bar_mastery" + (uk || ""), JSON.stringify(m)); } catch (e) {} }
/** Записать результат: mode "hint"|"memory", clean — без ошибок */
export function recordRun(m, id, mode, clean) {
  const cur = m[id] || { level: 0, streak: 0, runs: 0 };
  let level = cur.level, streak = cur.streak;
  if (mode === "hint") { level = Math.max(level, 1); streak = 0; }
  else if (clean) { streak = (cur.streak || 0) + 1; level = Math.max(level, streak >= 3 ? 3 : 2); }
  else { streak = 0; level = Math.max(level, 1); }
  return { ...m, [id]: { level, streak, runs: (cur.runs || 0) + 1, at: Date.now() } };
}

// ── Лестница: базовые (≤3 ингредиента) → классика (4) → сложные (5+)
export function tierOf(c) { const n = (c.ing || []).length; return n <= 3 ? 1 : n === 4 ? 2 : 3; }
export const TIER_LABEL = { 1: "Базовые", 2: "Классика", 3: "Сложные" };

// ── Коктейль дня — один и тот же для всех, меняется в полночь
export function dailyPick(all, date = new Date()) {
  if (!all.length) return null;
  const day = Math.floor((Date.UTC(date.getFullYear(), date.getMonth(), date.getDate())) / 86400000);
  return all[(day * 7) % all.length];
}

// ── Час пик: набор заказов
export function rushOrders(all, mastery, n = 3) {
  const known = all.filter(c => (mastery[c.id]?.level || 0) >= 1);
  const pool = known.length >= n ? known : all.filter(c => tierOf(c) === 1);
  const r = pool.slice(); for (let i = r.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [r[i], r[j]] = [r[j], r[i]]; }
  return r.slice(0, n);
}
