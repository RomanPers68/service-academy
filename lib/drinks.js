// lib/drinks.js — v127 (Доп. 440): «Барная карта» — один движок для вин и крепкого. Без React.
//
// Владелец (01.11): «Общая карта, вина и крепкое… Делаем сразу все, как у вин». Редактор, карточка, тренировка, «Кто
// выучил» написаны для вин (v120–v126); теперь им передаётся вид напитка K: что за поля, как назвать, как сложить в
// разделы, какие слова на экране. Для вин K — те же функции lib/wine.js и те же слова, что были (их проверяют тесты
// v120–v126); для крепкого — lib/spirit.js. Новый вид напитка — ещё один такой объект.
import * as W from "./wine.js";
import * as S from "./spirit.js";

const plural = (n, a, b, c) => { const m10 = n % 10, m100 = n % 100; return m10 === 1 && m100 !== 11 ? a : m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20) ? b : c; };
const filled = (v) => (Array.isArray(v) ? v.length > 0 : v !== "" && v != null && v !== false);
const s60 = (v) => String(v == null ? "" : v).replace(/\s+/g, " ").trim().slice(0, 60);

// общее для всех видов: AI дописывает только пустые поля и помечает их; правка руками снимает пометку; «Всё верно» — всё
function aiOps(AI_FIELDS, norm) {
  return {
    mergeAi: (rec, got) => { const w = { ...rec }, ai = new Set(w.ai || []); const g = norm({ ...got, name: rec.name });
      for (const f of AI_FIELDS) if (!filled(w[f]) && filled(g[f])) { w[f] = g[f]; ai.add(f); } w.ai = [...ai]; return w; },
    touched: (rec, field) => ({ ...rec, ai: (rec.ai || []).filter((f) => f !== field) }),
    confirm: (rec, who) => ({ ...rec, ai: [], checkedBy: s60(who), checkedAt: Date.now() }),
  };
}
// фото бутылок пачкой (v122): нет в карте — новая позиция с фото; есть без фото — фото и пустые поля к ней; есть с фото — заменить, если отметят
function bottleOps(K) {
  return {
    bottlePlan: (found, live) => { const m = (live || []).find((x) => !x.archived && K.same(x, found)); if (!m) return { kind: "new", keep: true, to: "" };
      return m.img ? { kind: "replace", keep: false, to: m.id } : { kind: "attach", keep: true, to: m.id }; },
    applyBottles: (shared, entries) => {
      let out = shared || [];
      for (const e of entries || []) {
        if (!e || !e.w) continue;
        const img = W.imgOf(e.url), cur = e.plan && e.plan.to ? K.records(out).find((x) => x.id === e.plan.to) : null;
        if (cur) out = K.withRec(out, K.norm({ ...K.mergeAi(cur, e.w), ...(img ? { img } : {}) }));
        else out = K.withRec(out, K.norm({ ...e.w, img, addedAt: e.w.addedAt || Date.now() }));
      }
      return out;
    },
  };
}
const gapOps = (GAPS) => ({
  GAPS, gapTest: (k) => (GAPS.find((g) => g[0] === k) || [])[2] || null,
  gapCounts: (items) => { const live = (items || []).filter((w) => w && !w.archived); return Object.fromEntries(GAPS.map(([k, , f]) => [k, live.filter(f).length])); },
});
const has = (v) => (Array.isArray(v) ? v.length > 0 : String(v == null ? "" : v).trim() !== "" && v !== false);
const partOps = (FORM_PARTS) => ({
  FORM_PARTS, partFill: (w, key) => { const p = FORM_PARTS.find((x) => x[0] === key), fields = p ? p[2](w) : []; return { n: fields.filter((f) => has(w && w[f])).length, of: fields.length }; },
});
// v134 (Доп. 447): «Заполнить по названию» знает, что уже вписано. Владелец (03.11, «Аберфелди 12» из карты: вид, страна,
// выдержка, порция и цена уже есть): «если уже что-то заполнено, то AI не может дополнить?». Может: заполненное уходит в
// запрос фактами (known), AI пишет только пустое (missing). Цены, порцию и «бокалом» AI по названию не пишет (их берут с
// листа или вписывают руками), поэтому их нет ни там, ни там. Пустого нет: запрос не нужен. aiAdded — что AI дописал сейчас.
export const NO_ASK = ["byGlass", "priceGlass", "priceBottle", "portion", "pricePortion"];
const askOps = (AI_FIELDS) => ({
  fillAsk: (rec) => {
    const known = {}, missing = [];
    for (const f of AI_FIELDS) {
      if (NO_ASK.includes(f)) continue;
      const v = rec && rec[f];
      if (!has(v)) missing.push(f);
      else known[f] = Array.isArray(v) ? v.map((x) => s60(x)).filter(Boolean).slice(0, 6) : typeof v === "number" ? v : s60(v);
    }
    return { known, missing };
  },
  aiAdded: (before, after) => AI_FIELDS.filter((f) => !filled(before && before[f]) && filled(after && after[f])),
});

// ── вина: всё как в v120–v126 ──
export const WINE = {
  kind: "wine", prefix: "wn-",
  records: W.wineRecords, isRec: W.isWineRec, withRec: W.withWine, withRecs: W.withWines, without: W.withoutWine, norm: W.normWine,
  title: W.wineTitle, line: W.wineLine, price: W.winePrice, find: W.findWines, same: W.sameWine,
  groups: W.groupByColor, groupKey: (w) => w.color, GROUP: W.COLOR_GROUP, oneLabel: (w) => W.COLOR_GROUP[w.color] || W.COLOR_GROUP.other,
  AI_FIELDS: W.AI_FIELDS, FIELD_RU: W.FIELD_RU, mergeAi: W.mergeAi, touched: W.touched, confirm: W.confirmWine, unchecked: W.unchecked,
  uncheckedQueue: W.uncheckedQueue, reviewRows: W.reviewRows, fieldHints: W.fieldHints,
  // путь новичка и бейдж в списке: вина бокалом
  pathTest: (w) => !!w.byGlass,
  serveText: (w) => [w.temp, w.glass ? "бокал «" + w.glass + "»" : ""].filter(Boolean).join(" · "),
  cardServe: (w) => [w.temp, w.glass ? "бокал «" + w.glass + "»" : "", w.volume].filter(Boolean).join(" · "),
  sayText: (w) => [w.name, (w.grapes || []).join(" "), w.region].filter(Boolean).join(" "),
  keys: { learned: "sa_wine_learned_", sr: "sa_wine_sr_", sync: "sa_wine_sync_" },
  rpc: { set: "wine_progress_set", team: "wine_progress_team", stage: "44", sql: "supabase/supabase-stage44-wines.sql" },
  word: (n) => n + " " + plural(n, "вино", "вина", "вин"),
  t: {
    // v129: kicker — где ты: «Барная карта · Вина» (было «Винная карта» — имя до v127); showAll — в конце списка с фильтром
    tab: "Вина", kicker: "Барная карта · Вина", showAll: "Показать все вина", editor: "Редактор вин", learn: "Учить вина", empty: "Карта пока пустая.",
    emptyEdit: "Карта пока пустая. Добавь вина руками, фото страниц карты, списком или из PDF.", add: "Добавить вина",
    searchPh: "Название, регион, сорт, нота…", searchAria: "Поиск по винной карте", pathChip: "Бокалом", pathBadge: "бокалом", pathSum: "бокалом",
    trainCheck: "Проверь вина, чтобы команда могла их учить", trainNew: (n) => "Новые вина: " + n + ". Колода, викторина, путь новичка",
    trainPath: (k, n) => "Колода, викторина, путь новичка · бокалом выучено " + k + " из " + n, trainPlain: "Колода, викторина и «Наоборот»: вино по описанию гостя",
    noDesc: (w) => (w.color ? W.COLOR_RU[w.color] : "Описание пока не заполнено"), about: "О вине",
    deck: "Колода вин", newOnes: "Новые вина", pathTitle: "Вина бокалом", learned: "Выучил новые вина ✓",
    deckPh: "Вино, регион, сорт, нота…", deckAria: "Найти вино в колоде", reverseNeed: "Для «Наоборот» у вина нужны хотя бы две подсказки: регион, сорт, стиль или ноты.",
    whatIs: "Что за вино? · ", frontHint: "Вспомни, откуда оно, сорт, стиль и как описать гостю. Потом переверни и сверься.",
    reverseHint: "Так гость и описывает, что хочет. Вспомни, какое это вино в карте, и переверни.",
    quiz: "Викторина по винам", quizNeed: "Для викторины нужно хотя бы два проверенных вина с регионом, сортом или стилем.",
    quizMid: "Неплохо. Вина с ошибками вернулись в «Знаю?».", quizLow: "Пройди колоду и возвращайся. Вина с ошибками уже в «Знаю?».",
    pair: "Вино к блюду", pairNeed: "Нужны хотя бы два блюда, к которым в карте отмечены вина. Отмечают в «Редакторе вин», раздел «К блюдам».",
    pairLow: "Повтори пары: на обороте карточки вина есть «К блюдам».",
    sayNeed: "Нужны проверенные вина, где в карточке есть хотя бы регион, сорт и стиль.",
    sayAsk: "Гость спрашивает: «а что это за вино?». У тебя минута. Расскажи вслух, как в зале: откуда оно, из какого винограда, какое на вкус, к чему подать. И закончи фразой, после которой хочется заказать.",
    sayNext: "Следующее вино →",
    team: "Кто выучил новые вина", teamWhat: "выучены ли новые вина", teamSql: "сколько вин выучено в «Знаю?», вина бокалом и викторина", teamNew: "Новые вина: ", teamNone: "Новых вин сейчас нет",
    teamDone: "Новые вина выучены ✓", teamLearning: "Новые вина: учит, осталось ", teamNot: "Новые вина не открыты", teamNo: "Тренировки по винам пока нет", teamPath: "бокалом ",
    hubNone: "Проверенных вин пока нет.", hubNew: "Новые вина", hubPath: "С чего начать: вина бокалом",
    hubPathDone: (n) => "Бокалом выучены все " + n + ". Дальше: вся карта в колоде", hubDeckSub: "Карточки с поиском и фильтрами, режимы «Знаю?» и «Наоборот»: вино по описанию гостя",
    hubQuizSub: "10 вопросов по своей карте: откуда, сорт, стиль, бокалом или нет, к какому блюду", hubSaySub: "Расскажи о вине вслух за минуту и сверься с карточкой",
    hubPronSub: "Вина, сорта и регионы: ударение, по слогам, послушать в оригинале",
    hubTeamSub: (fresh) => (fresh ? "Кто выучил, кто учит и кто не открывал; «Знаю?», вина бокалом и викторина каждого" : "Как каждый учит карту: «Знаю?», вина бокалом, викторина"),
    hubPairsHint: "«Вино к блюду» появится, когда хотя бы у двух блюд будут отмечены вина: «Редактор вин», раздел «К блюдам».",
    hubNeed: "Для тренировки нужно хотя бы два проверенных вина.", hubNeedEdit: " Проверь, что дописал AI, и вина появятся здесь.",
    // редактор
    newOne: "Новое вино", editOne: "Правка вина", addOne: "＋ Новое вино", findOne: "Найти вино", namePh: "Например: Шабли Премьер Крю, Domaine Laroche",
    picHint: "Сними бутылку этикеткой к камере: фото будет в карте, а AI прочитает название, регион, год и сорт",
    picFail: ". Вино сохранится без него.", picOk: "Фото загружено, сохранится вместе с вином", notesPh: "Через запятую: зелёное яблоко, мел, цитрус",
    bottlesSub: "Сними бутылки этикеткой к камере, можно все сразу: каждая станет вином с фото",
    pastePh: "По одному вину в строке:\nШабли, Domaine Laroche 2021\nКьянти Классико, Castello di Ama\nПросекко DOC Brut",
    namesAi: "AI допишет сорт, регион, стиль, ноты и подачу, ты проверишь.", sheetNone: "На листе не нашлось ни одного вина",
    attach: "в карте без фото: фото и пустые поля с этикетки добавятся к нему", reviewNone: "Не проверенных вин нет",
    reviewSkip: "Где не так, «Исправить»: откроется форма, сохранишь и пойдём дальше. «Пропустить» оставит вино в «Не проверено».",
  },
};
WINE.bottlePlan = W.bottlePlan; WINE.applyBottles = W.applyBottles;
Object.assign(WINE, gapOps(W.GAPS), partOps(W.FORM_PARTS), askOps(W.AI_FIELDS));

// ── крепкое ──
export const SPIRIT = {
  kind: "spirit", prefix: "sp-",
  records: S.spiritRecords, isRec: S.isSpiritRec, withRec: S.withSpirit, withRecs: S.withSpirits, without: S.withoutSpirit, norm: S.normSpirit,
  title: S.spiritTitle, line: S.spiritLine, price: S.spiritPrice, find: S.findSpirits, same: S.sameSpirit,
  groups: S.groupByCat, groupKey: (w) => w.cat, GROUP: S.CAT_GROUP, oneLabel: (w) => S.CAT_RU[w.cat] || S.CAT_RU.other,
  AI_FIELDS: S.AI_FIELDS_SP, FIELD_RU: S.FIELD_RU_SP, unchecked: W.unchecked,
  reviewRows: S.reviewRowsSp, fieldHints: S.fieldHintsSp,
  // путь новичка и бейдж: «ходовое» (отмечает руководитель: учить первым)
  pathTest: (w) => !!w.hot,
  serveText: S.spiritServe, cardServe: (w) => [S.spiritServe(w), w.volume].filter(Boolean).join(" · "),
  sayText: (w) => [w.name, w.producer, w.style, w.region].filter(Boolean).join(" "),
  keys: { learned: "sa_spirit_learned_", sr: "sa_spirit_sr_", sync: "sa_spirit_sync_" },
  rpc: { set: "spirit_progress_set", team: "spirit_progress_team", stage: "45", sql: "supabase/supabase-stage45-spirits.sql" },
  word: (n) => n + " " + plural(n, "позиция", "позиции", "позиций"),
  t: {
    tab: "Крепкое", kicker: "Барная карта · Крепкое", showAll: "Показать всё крепкое", editor: "Редактор крепкого", learn: "Учить крепкое", empty: "Крепкого в карте пока нет.",
    emptyEdit: "Крепкого в карте пока нет. Добавь руками, фото страниц барной карты, списком или из PDF.", add: "Добавить крепкое",
    searchPh: "Название, вид, страна, нота…", searchAria: "Поиск по крепкому", pathChip: "Ходовое", pathBadge: "ходовое", pathSum: "ходовое",
    trainCheck: "Проверь позиции, чтобы команда могла их учить", trainNew: (n) => "Новинки: " + n + ". Колода, викторина, путь новичка",
    trainPath: (k, n) => "Колода, викторина, путь новичка · ходовое выучено " + k + " из " + n, trainPlain: "Колода, викторина и «Наоборот»: напиток по описанию гостя",
    noDesc: (w) => (w.cat ? S.CAT_RU[w.cat] : "Описание пока не заполнено"), about: "О напитке",
    deck: "Колода крепкого", newOnes: "Новинки", pathTitle: "Ходовое", learned: "Выучил новинки ✓",
    deckPh: "Напиток, вид, страна, нота…", deckAria: "Найти в колоде", reverseNeed: "Для «Наоборот» нужны хотя бы две подсказки: страна, вид, выдержка или ноты.",
    whatIs: "Что за напиток? · ", frontHint: "Вспомни, что это и откуда, выдержку и как подать. Потом переверни и сверься.",
    reverseHint: "Так гость и описывает, что хочет. Вспомни, что это из нашей карты, и переверни.",
    quiz: "Викторина по крепкому", quizNeed: "Для викторины нужно хотя бы две проверенные позиции с видом, страной или выдержкой.",
    quizMid: "Неплохо. Позиции с ошибками вернулись в «Знаю?».", quizLow: "Пройди колоду и возвращайся. Позиции с ошибками уже в «Знаю?».",
    pair: "Крепкое к блюду", pairNeed: "Нужны хотя бы два блюда, к которым в карте отмечено крепкое. Отмечают в «Редакторе крепкого», раздел «К блюдам».",
    pairLow: "Повтори пары: на обороте карточки есть «К блюдам».",
    sayNeed: "Нужны проверенные позиции, где в карточке есть хотя бы страна, вид и выдержка или ноты.",
    sayAsk: "Гость спрашивает: «а что это?». У тебя минута. Расскажи вслух, как в зале: что это и откуда, какая выдержка, какое на вкус, как подать. И закончи фразой, после которой хочется заказать.",
    sayNext: "Следующий напиток →",
    team: "Кто выучил новинки крепкого", teamWhat: "выучены ли новинки", teamSql: "сколько позиций выучено в «Знаю?», ходовое и викторина", teamNew: "Новинки: ", teamNone: "Новинок сейчас нет",
    teamDone: "Новинки выучены ✓", teamLearning: "Новинки: учит, осталось ", teamNot: "Новинки не открыты", teamNo: "Тренировки по крепкому пока нет", teamPath: "ходовое ",
    hubNone: "Проверенных позиций пока нет.", hubNew: "Новинки", hubPath: "С чего начать: ходовое",
    hubPathDone: (n) => "Ходовое выучено, все " + n + ". Дальше: вся карта в колоде", hubDeckSub: "Карточки с поиском и фильтрами, режимы «Знаю?» и «Наоборот»: напиток по описанию гостя",
    hubQuizSub: "10 вопросов по своей карте: что это, откуда, выдержка, как подать, к какому блюду", hubSaySub: "Расскажи о напитке вслух за минуту и сверься с карточкой",
    hubPronSub: "Марки, дома и регионы: ударение, по слогам, послушать в оригинале",
    hubTeamSub: (fresh) => (fresh ? "Кто выучил, кто учит и кто не открывал; «Знаю?», ходовое и викторина каждого" : "Как каждый учит карту: «Знаю?», ходовое, викторина"),
    hubPairsHint: "«Крепкое к блюду» появится, когда хотя бы у двух блюд будет отмечено крепкое: «Редактор крепкого», раздел «К блюдам».",
    hubNeed: "Для тренировки нужно хотя бы две проверенные позиции.", hubNeedEdit: " Проверь, что дописал AI, и позиции появятся здесь.",
    newOne: "Новая позиция", editOne: "Правка позиции", addOne: "＋ Новая позиция", findOne: "Найти позицию", namePh: "Например: Glenfiddich 12, Hennessy VS",
    picHint: "Сними бутылку этикеткой к камере: фото будет в карте, а AI прочитает название, вид, выдержку и крепость",
    picFail: ". Позиция сохранится без него.", picOk: "Фото загружено, сохранится вместе с позицией", notesPh: "Через запятую: ваниль, дуб, сухофрукты",
    bottlesSub: "Сними бутылки этикеткой к камере, можно все сразу: каждая станет позицией с фото",
    pastePh: "По одной позиции в строке:\nGlenfiddich 12\nHennessy VS\nBeefeater London Dry",
    namesAi: "AI допишет вид, страну, выдержку, ноты и подачу, ты проверишь.", sheetNone: "На листе не нашлось ни одной позиции",
    attach: "в карте без фото: фото и пустые поля с этикетки добавятся к ней", reviewNone: "Не проверенных позиций нет",
    reviewSkip: "Где не так, «Исправить»: откроется форма, сохранишь и пойдём дальше. «Пропустить» оставит позицию в «Не проверено».",
  },
};
Object.assign(SPIRIT, aiOps(S.AI_FIELDS_SP, S.normSpirit), gapOps(S.GAPS_SP), partOps(S.FORM_PARTS_SP), askOps(S.AI_FIELDS_SP));
SPIRIT.uncheckedQueue = (items) => S.groupByCat((items || []).filter((w) => w && !w.archived && W.unchecked(w))).flatMap(([, ws]) => ws.map((w) => w.id));
Object.assign(SPIRIT, bottleOps(SPIRIT));

export const DRINKS = { wine: WINE, spirit: SPIRIT };
export const drinkOf = (kind) => DRINKS[kind] || WINE;
/** Записи напитков в меню команды (вина, крепкое, коктейли): не блюда — меню блюд их не показывает, а при публикации меню они
 *  должны остаться (иначе тренажёр меню, сохраняя блюда, стёр бы карту бара). */
export const isBarRec = (d) => !!(d && (d.kind === "cocktail" || d.kind === "wine" || d.kind === "spirit"));
