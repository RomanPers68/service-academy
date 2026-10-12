// lib/live-guest.js — Доп. 312: «Живой гость».
//
// ИИ играет гостя за столом (у бара, у входа): характер, повод, то, о чём он сам не скажет,
// пока не спросят. Заказывает из настоящего меню ресторана, а блюдо из стоп-листа может
// попросить нарочно. Сотрудник отвечает голосом или текстом. В конце — «чек разбора»:
// оценки по пяти пунктам, что получилось, что поправить, какой фразой стоило сказать и какие
// уроки повторить; вопросы тестов этих уроков уходят в «Работу над ошибками».
// Без ИИ (не подключён, лимит, нет сети) — гость по сценарию: ситуации практики трека «у стола».
//
// Здесь — чистая логика без React: персонажи, выбор гостя, разбор ответов модели, история.
// v31: у персонажа — «шёпот наставника» (whisper: одна подсказка за разговор) и сколько человек
// за столом (seats — для рисунка стола сверху); свои гости заведения (их пишет руководитель,
// хранит сервер — этап 25) смешиваются со встроенными; «было/стало» по прошлому разговору.

export const GUEST_RUNS_KEY = "sa_guest_runs";

// Персонажи. visible — что видно сотруднику на карточке стола; hidden — что гость держит в голове
// и скажет, только если его спросят или заметят (по этому видно внимание сотрудника).
const HALL = [
  { id: "rush", name: "Ирина", age: 34, icon: "clock", tags: ["торопится"], mood: 3,
    who: "Пришла пообедать одна, через 50 минут поезд", occasion: "обычный обед",
    hidden: "Очень торопится — важно, чтобы предложили что-то быстрое и сразу принесли счёт; если не спросят про время, начнёт нервничать",
    open: "Здравствуйте. Можно меню? Только у меня совсем мало времени.",
    whisper: "Спроси, сколько у гостя времени, — и предложи то, что готовится быстро.", seats: 1 },
  { id: "allergy", name: "Олег", age: 41, icon: "alert", tags: ["выбирает долго"], mood: 3,
    who: "Ужинает с женой", occasion: "просто вечер вдвоём",
    hidden: "У жены аллергия на орехи — скажет об этом, только если спросят про аллергии; если посоветуют блюдо с орехами и не предупредят — расстроится",
    open: "Добрый вечер. Мы ещё не решили — что у вас сегодня хорошее?",
    whisper: "Прежде чем советовать блюдо, спроси про аллергии — за обоих гостей.", seats: 2 },
  { id: "party", name: "Светлана", age: 29, icon: "sparkle", tags: ["праздник"], mood: 4,
    who: "Компания из четырёх подруг", occasion: "день рождения подруги",
    hidden: "Хочет, чтобы имениннице сделали маленький сюрприз (свеча в десерт, поздравление) — намекнёт один раз",
    open: "Привет! У нас тут сегодня праздник, мы надолго. С чего посоветуете начать?",
    whisper: "Прислушайся к поводу: вдруг за столом есть кого поздравить?", seats: 4 },
  { id: "late", name: "Андрей", age: 52, icon: "upset", tags: ["недоволен"], mood: 2,
    who: "Бизнесмен, ждёт горячее уже 25 минут", occasion: "деловой обед",
    hidden: "Раздражён ожиданием; успокоится, если перед ним честно извинятся, узнают точное время на кухне и предложат что-то пока; оправдания злят",
    open: "Извините! Мы горячее ждём уже почти полчаса. Это нормально?",
    whisper: "Не оправдывайся: извинись, узнай точное время на кухне и предложи что-то пока.", seats: 2 },
  { id: "doubt", name: "Мария Петровна", age: 67, icon: "thought", tags: ["сомневается"], mood: 3,
    who: "Пришла с внуком-подростком", occasion: "семейный обед",
    hidden: "Плохо видит мелкий шрифт меню и стесняется сказать; рада, если помогут выбрать и расскажут про блюда простыми словами",
    open: "Здравствуйте… Ой, тут столько всего. Подскажете что-нибудь не очень острое?",
    whisper: "Помоги выбрать сам: расскажи про пару блюд простыми словами, не отсылай к меню.", seats: 2 },
  { id: "regular", name: "Константин", age: 45, icon: "smile", tags: ["постоянный гость"], mood: 4,
    who: "Бывает каждую пятницу", occasion: "пятничный ужин",
    hidden: "Любит, когда его узнают и помнят, что он берёт; хочет попробовать новое, если предложат с душой, без давления",
    open: "Добрый вечер! Ну что, есть сегодня что-нибудь новенькое?",
    whisper: "Покажи, что узнаёшь гостя, и предложи новинку — без давления.", seats: 1 },
  { id: "kid", name: "Анастасия", age: 31, icon: "family", tags: ["с ребёнком"], mood: 3,
    who: "Мама с сыном 5 лет", occasion: "обед после прогулки",
    hidden: "Ребёнок голоден и капризничает — нужен детский стул, что-то быстрое для ребёнка и раскраска/салфетки; заметит, если предложат сами",
    open: "Здравствуйте. Нам бы побыстрее что-то для ребёнка, он уже голодный.",
    whisper: "Начни с ребёнка: детский стул, что-то быстрое и чем его занять — предложи сам.", seats: 2 },
  { id: "complain", name: "Виктор", age: 38, icon: "upset", tags: ["претензия"], mood: 2,
    who: "Ужинает с другом", occasion: "встреча друзей",
    hidden: "В салате попался волос — хочет, чтобы извинились без споров, заменили блюдо и проследили лично; если начнут спорить — потребует менеджера",
    open: "Извините, можно вас? Посмотрите, что у меня в салате.",
    whisper: "Не спорь: извинись, забери блюдо, предложи замену и проследи лично.", seats: 2 },
];
const DOOR = [
  { id: "nobook", name: "Денис", age: 36, icon: "team", tags: ["без брони", "пик"], mood: 3,
    who: "Компания из шести человек в пятницу вечером", occasion: "встреча друзей",
    hidden: "Брони нет, зал полный; согласится подождать 20 минут у бара, если честно скажут время и предложат что-то, иначе уйдёт",
    open: "Добрый вечер! Нас шестеро, найдёте местечко?",
    whisper: "Честно назови время ожидания и предложи, где подождать.", seats: 6 },
  { id: "booked", name: "Елена", age: 44, icon: "clock", tags: ["бронь", "опоздала"], mood: 3,
    who: "Опоздала на 25 минут к своей брони", occasion: "ужин с мужем",
    hidden: "Переживает, что стол отдали; благодарна, если встретят спокойно и найдут решение без упрёков",
    open: "Здравствуйте, у нас бронь на семь… Мы немного опоздали, извините.",
    whisper: "Без упрёков: успокой, что бронь помнят, и предложи решение.", seats: 2 },
  { id: "vip", name: "Роман", age: 58, icon: "smile", tags: ["важный гость"], mood: 4,
    who: "Пришёл с партнёрами, просит тихий стол", occasion: "деловой ужин",
    hidden: "Важно уединение и чтобы гостей провели без ожидания; оценит, если запомнят имя и предложат гардероб",
    open: "Добрый вечер. Нас трое, нужен спокойный стол — поговорить.",
    whisper: "Обратись по имени, проводи без ожидания и предложи гардероб.", seats: 3 },
];
const BAR = [
  { id: "strong", name: "Максим", age: 33, icon: "glass", tags: ["у стойки"], mood: 3,
    who: "Сел у бара один после работы", occasion: "расслабиться",
    hidden: "Хочет что-то крепкое и необычное, но не знает названий; не любит сладкое — скажет, если спросят про вкусы",
    open: "Привет. Сделайте что-нибудь интересное, на ваш вкус.",
    whisper: "Спроси про вкусы — что любит и чего не любит, — прежде чем советовать.", seats: 1 },
  { id: "driver", name: "Алина", age: 27, icon: "alert", tags: ["за рулём"], mood: 3,
    who: "Ждёт подругу у бара", occasion: "встреча с подругой",
    hidden: "Приехала на машине — алкоголь нельзя; обрадуется вкусному безалкогольному коктейлю, если предложат без нравоучений",
    open: "Здравствуйте! А что у вас есть такого… праздничного?",
    whisper: "Узнай, пьёт ли гость сегодня алкоголь, — и предложи безалкогольное без нравоучений.", seats: 1 },
  { id: "tipsy", name: "Геннадий", age: 49, icon: "upset", tags: ["навеселе"], mood: 3,
    who: "Уже выпил несколько коктейлей и громко разговаривает", occasion: "отмечает сделку",
    hidden: "Просит ещё два крепких подряд; если вежливо и твёрдо предложить воду/паузу без нотаций — согласится, если отказывать грубо — разозлится",
    open: "Бармен! Ещё два таких же, и покрепче!",
    whisper: "Вежливо и твёрдо: предложи воду или паузу, без нотаций.", seats: 1 },
];

export const PERSONAS = { hall: HALL, door: DOOR, bar: BAR };
export const placeOf = (role, position) => (role === "spg" || position === "hostess" ? "door" : role === "bar" || /bartender/.test(position || "") ? "bar" : "hall");
const PLACE_WORD = { hall: "стол", door: "вход", bar: "бар" };
export const POS_WORD = { hall: "официант", door: "хостес", bar: "бармен" };

function rng(seed) {
  let h = 2166136261 >>> 0; const s = String(seed);
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return () => { h += 0x6D2B79F5; let t = h; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

// Свой гость заведения (строка с сервера, этап 25) → персонаж в том же виде, что встроенные
export function normPersona(row) {
  if (!row || typeof row !== "object" || !row.id || !row.name || !row.open) return null;
  const place = ["hall", "door", "bar"].includes(row.place) ? row.place : "hall";
  const tags = (Array.isArray(row.tags) ? row.tags : []).map((t) => String(t || "").trim()).filter(Boolean).slice(0, 3);
  return {
    id: String(row.id), place, name: String(row.name).slice(0, 40), age: Math.max(16, Math.min(90, Number(row.age) || 35)),
    mood: Math.max(1, Math.min(5, Number(row.mood) || 3)), icon: "guest", tags: tags.length ? tags : ["гость заведения"],
    who: String(row.who || "").slice(0, 200), occasion: String(row.occasion || "").slice(0, 120), hidden: String(row.hidden || "").slice(0, 300),
    open: String(row.open).slice(0, 200), whisper: String(row.whisper || "").slice(0, 160), seats: place === "bar" ? 1 : 2, custom: true,
  };
}

// Гость на этот раз: персонаж (не тот же, что в прошлый раз), стол, меню и стоп-лист.
// v31: extra — свои гости заведения (их место — то же, что у сотрудника; выпадают чаще:
// руководитель добавил их не просто так); prefer — сыграть с конкретным гостем ещё раз.
export function pickGuest({ role, position, dishes = [], drinks = [], seed = Date.now(), lastId = "", extra = [], prefer = "" } = {}) {
  const place = placeOf(role, position);
  const own = (extra || []).map(normPersona).filter((x) => x && x.place === place);
  const list = PERSONAS[place].concat(own);
  const r = rng(seed);
  let p = prefer ? list.find((x) => x.id === prefer) : null;
  if (!p) {
    const fromOwn = own.length && r() < 0.5;
    const from = fromOwn ? own : list;
    p = from[Math.floor(r() * from.length)];
    if (p.id === lastId && list.length > 1) { const k = list.indexOf(p); p = list[(k + 1) % list.length]; }
  }
  const pool = place === "bar" ? drinks : dishes;
  const live = (pool || []).filter((d) => d && d.name && !d.archived);
  const stop = live.filter((d) => d.stop).map((d) => d.name).slice(0, 5);
  const menu = live.filter((d) => !d.stop).slice(0, 30).map((d) => d.name + (Array.isArray(d.allergens) && d.allergens.length ? " (аллергены: " + d.allergens.slice(0, 4).join(", ") + ")" : ""));
  const table = place === "hall" ? 2 + Math.floor(r() * 14) : 0;
  return {
    id: p.id, place, name: p.name, age: p.age, icon: p.icon, tags: p.tags, mood: p.mood,
    who: p.who, occasion: p.occasion, hidden: p.hidden, open: p.open,
    whisper: p.whisper || "", seats: p.seats || (place === "bar" ? 1 : 2), custom: !!p.custom,
    table, menu, stop,
    line: (place === "hall" ? "стол " + table : PLACE_WORD[place]) + " · " + p.tags.join(" · "),
  };
}

// v31: прошлый разговор для «было/стало» — с этим же гостем, иначе прошлый живой (ИИ) разговор
export function previousRun(runs, personaId) {
  const list = (Array.isArray(runs) ? runs : []).filter((x) => x && typeof x.s === "number");
  for (let i = list.length - 1; i >= 0; i--) if (list[i].p === personaId) return { ...list[i], same: true };
  for (let i = list.length - 1; i >= 0; i--) if (list[i].ai) return { ...list[i], same: false };
  return null;
}

// v31: текст ответа, пока он ещё идёт потоком, — без служебных меток (и их начала)
export function streamText(raw) {
  return String(raw || "").replace(/\[\[[\s\S]*$/, "").replace(/\[$/, "").trimEnd();
}

// Ответ гостя: текст без служебных меток, настроение, ушёл ли
export function parseGuestReply(text) {
  const raw = String(text || "");
  const m = raw.match(/\[\[\s*mood\s*:\s*([1-5])\s*\]\]/i);
  const end = /\[\[\s*end\s*\]\]/i.test(raw);
  const clean = raw.replace(/\[\[[^\]]*\]\]/g, "").replace(/\n{3,}/g, "\n\n").trim();
  return { text: clean, mood: m ? Number(m[1]) : null, end };
}

const clamp5 = (v, d = 3) => { const n = Math.round(Number(v)); return n >= 1 && n <= 5 ? n : d; };
const strs = (a, max, len) => (Array.isArray(a) ? a : []).map((x) => String(x || "").trim()).filter(Boolean).slice(0, max).map((x) => x.slice(0, len));
export const CRITERIA = [
  ["contact", "Контакт и встреча"], ["menu", "Знание меню"], ["care", "Забота о госте"], ["sales", "Рекомендации"], ["calm", "Спокойствие"],
];

// Чек разбора из ответа модели (JSON где-то в тексте). Уроки — только из известных номеров.
export function parseReceipt(text, knownLesson = () => true) {
  const raw = String(text || "");
  const a = raw.indexOf("{"), b = raw.lastIndexOf("}");
  if (a < 0 || b <= a) return null;
  let j = null;
  try { j = JSON.parse(raw.slice(a, b + 1)); } catch (e) { return null; }
  if (!j || typeof j !== "object") return null;
  const sc = j.scores && typeof j.scores === "object" ? j.scores : {};
  const scores = {}; CRITERIA.forEach(([k]) => { scores[k] = clamp5(sc[k]); });
  const avg = Math.round((CRITERIA.reduce((s, [k]) => s + scores[k], 0) / CRITERIA.length) * 10) / 10;
  return {
    score: clamp5(j.score, Math.round(avg)), scores, avg,
    good: strs(j.good, 3, 160), fix: strs(j.fix, 3, 160),
    phrase: String(j.phrase || "").trim().slice(0, 220),
    lessons: strs(j.lessons, 2, 30).filter((id) => knownLesson(id)),
  };
}

// Вопросы тестов из уроков, которые советует разбор, — в «Работу над ошибками» (не больше двух)
export function mistakesForLessons(lessonIds, modules, bank = [], now = Date.now()) {
  const have = new Set((bank || []).map((m) => m && m.q));
  const out = [];
  (lessonIds || []).forEach((id) => {
    if (out.length >= 2) return;
    const mod = (modules || []).find((m) => (m.lessons || []).some((l) => l.id === id));
    if (!mod) return;
    const lesson = mod.lessons.find((l) => l.id === id);
    const quiz = mod.lessons.find((l) => l.type === "quiz" && Array.isArray(l.questions) && l.questions.length);
    if (!quiz) return;
    const q = quiz.questions.find((x) => x && !x.kind && x.q && !have.has(x.q) && Array.isArray(x.options) && typeof x.correct === "number");
    if (!q) return;
    have.add(q.q);
    out.push({ q: q.q, options: q.options, correct: q.correct, explanation: q.explanation || "", img: q.img || null,
      lessonTitle: (lesson && lesson.title) || quiz.title || mod.title, lessonId: quiz.id, stage: 0, due: now, from: "guest" });
  });
  return out;
}

// История разговоров (для отчёта руководителя и «Итогов месяца»)
export function readGuestRuns(uk, storage) {
  try { const s = storage || localStorage; const v = JSON.parse(s.getItem(GUEST_RUNS_KEY + (uk || "")) || "[]"); return Array.isArray(v) ? v : []; } catch (e) { return []; }
}
export function saveGuestRun(uk, run, storage) {
  const list = readGuestRuns(uk, storage).concat([run]).slice(-30);
  try { (storage || localStorage).setItem(GUEST_RUNS_KEY + (uk || ""), JSON.stringify(list)); } catch (e) {}
  return list;
}

// Ошибка сервера → что сказать человеку и можно ли продолжить по сценарию
export function guestErrorText(err) {
  if (err === "not_configured") return "ИИ-гость ещё не подключён на сервере — сыграем по сценарию.";
  if (err === "daily_limit") return "На сегодня живые разговоры закончились — завтра лимит обновится. Пока — гость по сценарию.";
  if (err === "rate_limit") return "Сервер ИИ сейчас занят — попробуй через минуту или сыграй по сценарию.";
  if (err === "network") return "Нет связи — гость по сценарию работает и без интернета.";
  return "Гость не ответил — можно продолжить по сценарию.";
}
