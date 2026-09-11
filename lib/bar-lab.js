// lib/bar-lab.js — движок «Сборки руками» (Дополнение 208). Чистые функции, без React.
// Из спека коктейля (data/cocktails.js) строит сценарий: что и в каком порядке делает бармен,
// какие предметы лежат на станции (правильные + обманки), и проверяет каждое действие.

export const GLASS_RU = { rocks: "Рокс", highball: "Хайбол", martini: "Купе", sour: "Сауэр", flute: "Флюте", hurricane: "Харрикейн", shot: "Шот", irish: "Айриш-кофе", margarita: "Маргарита", red: "Винный бокал" }; // Доп. 234: одно короткое имя везде — на полке, на доске, в карточке
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

const stemWords = (name) => norm(name).split(/[^а-яa-z]+/).filter(w => w.length >= 3).map(w => w.slice(0, w.length > 6 ? 5 : Math.min(4, w.length))); // \b с кириллицей не работает — ищем по основам
const SYN = { "ангостура": ["биттер", "ангостур"], "содовая": ["содов", "газиров"], "сок лайма": ["лайм"], "сок лимона": ["лимон"], "сахарный сироп": ["сироп", "сахар"], "тоник": ["тоник"], "кола": ["кол"], "горячий кофе": ["кофе"], "эспрессо": ["эспрессо"], "бейлис": ["бейлис", "ликёр", "ликер"], "гран марнье": ["марнье", "гран"], "кофейный ликёр": ["кофейн"], "белок": ["белок", "белк"] };
const GARNISH_RE = /цедр|дольк|веточк|кромк|украс|похлопай|зерн|вишн|оливк|луковк|соль на|трубочк|поджиг|сверху — похлопай/;
/** Доп. 217: точная последовательность — из шагов самой карточки (c.steps), а не из шаблона метода */
export function sequenceFromSteps(c) {
  const steps = c.steps || []; if (steps.length < 2) return null;
  const method = c.method || "билд"; const ings = c.ing || [];
  const isTopper = (i) => /доверху|флоат/.test(String(i[2] || "")); // топперы и флоаты — в самый конец
  const unit = (i) => String(i[2] || "мл").replace(/,.*$/, "") || "мл";
  const ingStep = (i, where, label) => ({ kind: "ing", name: i[0], amount: i[1], unit: unit(i), where, label: label || `${i[0]} — ${i[1]} ${unit(i)}` });
  const mentionAt = (text, i) => { const t = norm(text); const stems = [...stemWords(i[0]), ...(SYN[norm(i[0])] || [])]; let best = -1; for (const st of stems) { const k = t.indexOf(st); if (k >= 0 && (best < 0 || k < best)) best = k; } return best; };
  const out = []; let vessel = method === "шейк" ? "shaker" : method === "стир" ? "mixing" : method === "блендер" ? "blender" : "glass"; const vessel0 = vessel;
  const used = new Set(); let strained = false;
  out.push({ kind: "glass", id: c.glass, label: GLASS_RU[c.glass] || c.glass });
  steps.forEach((text, si) => {
    const t = norm(text); const toks = [];
    const isGarnishStep = GARNISH_RE.test(t) && si === steps.length - 1 && c.garnish && c.garnish !== "none";
    if (!isGarnishStep) {
      if (/(^|[^а-я])все([^а-я]|$)/.test(t)) ings.filter(i => !used.has(i[0]) && !isTopper(i)).forEach(i => toks.push({ at: 0, s: ingStep(i, vessel) }));
      ings.forEach(i => { if (used.has(i[0]) || toks.some(x => x.s.kind === "ing" && x.s.name === i[0])) return; const k = mentionAt(text, i); if (k >= 0) toks.push({ at: k, s: ingStep(i, vessel, isTopper(i) ? `${i[0]} — доверху` : undefined) }); });
      const iceIsIng = ings.some(i => norm(i[0]) === "лед");
      const kIce = iceIsIng ? -1 : t.search(/(^|[^а-я])(лед(?!ян)|льд|краш|колот)/); if (kIce >= 0 && !/без льда/.test(t)) toks.push({ at: kIce, s: { kind: "ice", id: c.ice === "crushed" || /краш|колот/.test(t) ? "crushed" : "cube", where: vessel, label: text.trim() } });
      const tools = [[method === "блендер" ? "blend" : "shake", /шейк(?!ер)|взбе|встрях/], ["stir", /стир|мешай|перекат|роллинг/], ["strain", /стрейн|процед|перели/], ["muddle", /мадлер|продав|разомн|разотр/], ["blend", /блендер|взбить в/], ["swizzle", /свизл/], ["layer", /по (обратной )?(стороне )?ложк|слоем|поверх/]];
      for (const [id, re] of tools) { const k = t.search(re); if (k >= 0 && !(id === "layer" && method !== "слои")) toks.push({ at: k, s: { kind: "tool", id, label: text.trim() } }); }
    }
    toks.sort((a, b) => a.at - b.at);
    // правило бармена: лёд кладут до того, как мешать или шейкать — в одном шаге лёд идёт перед инструментом
    const iceT = toks.filter(x => x.s.kind === "ice"), toolT = toks.filter(x => x.s.kind === "tool"), other = toks.filter(x => x.s.kind !== "ice" && x.s.kind !== "tool");
    if (iceT.length && toolT.length) { toks.length = 0; toks.push(...other, ...iceT, ...toolT); }
    for (const { s: st } of toks) {
      if (st.kind === "ing") { used.add(st.name); out.push(st); }
      else if (st.kind === "tool") { const last = out[out.length - 1]; if (last && last.kind === "tool" && last.id === st.id) continue; out.push(st); if (st.id === "strain") { strained = true; vessel = "glass"; } }
      else if (st.kind === "ice") { if (st.id === "cube" && c.ice === "crushed") st.id = "crushed"; const since = out.slice(out.map(x => x.kind === "tool" && x.id === "strain").lastIndexOf(true) + 1); if (since.some(x => x.kind === "ice" && x.where === st.where)) continue; out.push(st); }
    }
    if (method === "шейк" && strained) vessel = "glass";
  });
  // ингредиенты, которых в шагах не назвали, — после последнего ингредиента; топперы — в конец перед гарнишем
  const missing = ings.filter(i => !used.has(i[0]));
  const firstAct = out.findIndex(x => x.kind === "ice" || x.kind === "tool");
  const at = firstAct > 0 ? firstAct : Math.max(...out.map((x, k) => x.kind === "ing" ? k : 0), 0) + 1;
  missing.filter(i => !isTopper(i)).reverse().forEach(i => out.splice(at, 0, ingStep(i, vessel0)));
  missing.filter(isTopper).forEach(i => out.push(ingStep(i, "glass", `${i[0]} — доверху`)));
  // стрейн, если карточка его не назвала: после шейка — всегда; после стира — только в бокал без льда (со льдом в роксе стир идёт прямо в бокале)
  if ((method === "шейк" || (method === "стир" && !c.ice)) && !out.some(x => x.kind === "tool" && x.id === "strain")) {
    const last = out.map(x => x.kind === "tool").lastIndexOf(true);
    if (last > 0) out.splice(last + 1, 0, { kind: "tool", id: "strain", label: c.ice ? "Стрейн в бокал со льдом" : "Стрейн в охлаждённый бокал" });
  }
  if (c.garnish && c.garnish !== "none") out.push({ kind: "garnish", id: c.garnish, label: GARNISH_RU[c.garnish] || c.garnish });
  // стир/шейк без льда — добавить лёд перед инструментом (в карточках это иногда подразумевается)
  if (!out.some(x => x.kind === "ice") && /шейк|стир/.test(method) && !ings.some(i => norm(i[0]) === "лед")) { const ti = out.findIndex(x => x.kind === "tool" && (x.id === "shake" || x.id === "stir")); if (ti > 0) out.splice(ti, 0, { kind: "ice", id: "cube", where: method === "шейк" ? "shaker" : "mixing", label: "Лёд" }); }
  return out;
}

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
  const exact = sequenceFromSteps(c);
  if (exact) { steps.splice(0, steps.length, ...exact); } // Доп. 217: порядок — как в карточке

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
export function rushOrders(all, mastery, n = 3, card = null) {
  const base = card && card.length >= n ? all.filter(c => card.includes(c.id)) : all; // Доп. 214: сначала своя карта бара
  const known = base.filter(c => (mastery[c.id]?.level || 0) >= 1);
  const pool = known.length >= n ? known : base.filter(c => tierOf(c) === 1).length >= n ? base.filter(c => tierOf(c) === 1) : base;
  const r = pool.slice(); for (let i = r.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [r[i], r[j]] = [r[j], r[i]]; }
  return r.slice(0, n);
}
