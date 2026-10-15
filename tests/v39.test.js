// v39 (Доп. 352): правки по «Замечаниям к урокам» — факты в уроках (в основном бар), места, где урок и тест
// говорили разное, темы, на которых держались вопросы, и сцены практики. Плюс то, что редакторы v38 отметили
// в заметках: L.A.S.T. в тесте, «автоматизм» ядра, хвосты «а:» в правилах «Собери правило», многоточия.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { SEASONAL_MODULES } from "../data/modules-seasonal";
import { CORE_MODULES } from "../data/modules-core";
import { MANAGER_MODULES } from "../data/modules-manager";
import { SERVICE_MANAGER_MODULES } from "../data/modules-service_manager";
import { SPG_MODULES } from "../data/modules-spg";
import { BAR_MODULES } from "../data/modules-bar";
import { GLOSSARY } from "../data/glossary";
import { BUILDS } from "../data/builds";

const ALL = [SEASONAL_MODULES, CORE_MODULES, MANAGER_MODULES, SERVICE_MANAGER_MODULES, SPG_MODULES, BAR_MODULES];
const L = {};
for (const mods of ALL) for (const m of mods) for (const l of m.lessons || []) L[l.id] = l;
const text = (id) => String(L[id].content || "");
const q = (id, n) => L[id].questions[n - 1];
const p = (id, n) => L[id].situations[n - 1];
const right = (it) => it.options[it.correct];
const situations = [];
for (const mods of ALL) for (const m of mods) for (const l of m.lessons || []) (l.situations || []).forEach((s, i) => situations.push({ tag: `${l.id} P${i + 1}`, s, g: s.genre || s.type || "action" }));

describe("факты в уроках бара (Доп. 352)", () => {
  it("виски: ваниль и карамель — от бочки, дым — от торфа; вопрос больше не приписывает дым бочке", () => {
    expect(text("bar3-1")).toMatch(/дымный вкус — от торфа/);
    expect(text("bar3-1")).not.toMatch(/Отсюда ваниль, дым/);
    expect(q("bar3-q", 3).q).not.toMatch(/дым/);
    expect(right(q("bar3-q", 3))).toMatch(/Выдержка в дубовой бочке/);
  });
  it("цитрус и выдержанная база: правило смягчено, Виски сауэр и Сайдкар ему больше не противоречат", () => {
    expect(text("bar3-1")).toMatch(/С цитрусом выдержанное тоже работает — Виски сауэр, Сайдкар/);
    expect(q("bar3-q", 4).q).toMatch(/самый свежий и лёгкий/);
  });
  it("биттер — дэшами (около 1 мл), а не «пара капель»: урок, тест, «Сборка» и глоссарий говорят одно", () => {
    const bar = readFileSync("data/modules-bar.js", "utf8"), gl = readFileSync("data/glossary.js", "utf8"), bd = readFileSync("data/builds.js", "utf8");
    for (const s of [bar, gl, bd]) expect(s).not.toMatch(/пара капель биттера|капли биттера|Капли, не миллилитры|Дозировка — капли, не миллилитры/);
    expect(text("bar2-4")).toMatch(/2–3 дэша биттера/);
    expect(right(q("bar2-q", 16))).toBe("Всего 2–3 дэша ангостуры");
    expect(GLOSSARY.some((g) => g.term === "Дэш" && /около 1 мл/.test(g.def))).toBe(true);
    const of = BUILDS.find((b) => b.id === "old-fashioned").steps.find((s) => s.label === "Биттер");
    expect(of.options.find((o) => o.ok).t).toBe("2–3 дэша ангостуры");
  });
  it("стир-классика: сахар — только в олд фэшн, Мартини и Манхэттен — без льда", () => {
    const t = text("bar2-4");
    expect(t).toMatch(/\*\*Формула олд фэшн:\*\*/);
    expect(t).toMatch(/\*\*Олд фэшн и соседи по технике:\*\*/);
    expect(t).toMatch(/Мартини и Манхэттен — классически без льда, в охлаждённом бокале/);
    expect(t).not.toMatch(/☑ Лёд крупный: один кубик или сфера/);
  });
  it("джиггер — двусторонняя мерная рюмка, а не «мерный стакан» (это другой инструмент)", () => {
    expect(text("bar0-3")).toMatch(/\*\*Джиггер\*\* — двусторонняя мерная рюмка/);
    expect(text("bar0-3")).toMatch(/\*\*Мерный стакан\*\* — для больших объёмов/);
    expect(q("bar0-q", 7).explanation).not.toMatch(/мерный стакан/);
    expect(GLOSSARY.find((g) => g.term === "Джиггер").def).toMatch(/^Двусторонняя мерная рюмка/);
  });
  it("крупный кубик почти не разбавляет; лёд засыпан, краш намолот", () => {
    expect(text("bar0-4")).toMatch(/тает медленно и почти не разбавляет/);
    expect(text("bar0-2")).toMatch(/☑ Лёд засыпан и чистый, краш намолот/);
  });
  it("шейк — сок, сливки, белок, пюре; крепкое с сиропом без сока стирят; двойное процеживание — шейку без льда", () => {
    expect(text("bar1-4")).toMatch(/без сока — это стир: так готовят Олд фэшн/);
    expect(right(q("bar1-q", 12))).toBe("Сок, сливки, яичный белок, пюре");
    expect(text("bar1-5")).not.toMatch(/обязательно для подачи без льда/);
    expect(text("bar1-5")).toMatch(/Шейк-коктейль без льда в бокале — всегда через двойное процеживание/);
    expect(right(q("bar1-q", 18))).toMatch(/^Шейк без льда/);
    // сироп с крепким и биттером без сока — стир во всех уроках модуля
    expect(text("bar1-2")).toMatch(/Крепкое с сиропом и биттером без сока соединяют стиром/);
    expect(text("bar1-3")).toMatch(/биттеры и сахарный сироп/);
    expect(text("bar1-4")).not.toMatch(/жир, белок, сахар/);
  });
  it("час пик: крепкое на льду больше не «стоит без потерь», рука со стиром не «свободна»", () => {
    const t = text("bar5-1");
    expect(t).toMatch(/🟢 Сначала то, что ждёт без потерь: вино, крепкое без льда/);
    expect(t).not.toMatch(/руки свободны/);
    expect(q("bar5-q", 4).q).toMatch(/Чем занята вторая/);
    expect(text("bar5-2")).toMatch(/каждый переделанный бокал/);
    expect(text("bar5-3")).toMatch(/молочное — каждую смену/);
  });
});

describe("факты в уроках остальных ролей (Доп. 352)", () => {
  it("четыре стадии изменений — модель Скотта и Джаффе, цитата — «приписывают Друкеру», без мифа про 55%", () => {
    expect(q("sm5-q", 6).q).toMatch(/Скотта и Джаффе/);
    expect(readFileSync("data/modules-service_manager.js", "utf8")).not.toMatch(/Кюблер/);
    expect(q("sm4-q", 1).q).toMatch(/приписывают Друкеру/);
    expect(readFileSync("data/modules-core.js", "utf8")).not.toMatch(/55\s?%/);
  });
  it("якорная цена — первая названная цена, с которой гость сравнивает остальные", () => {
    expect(right(q("c3-q", 5))).toBe("Первой назвать цену, с которой гость сравнит остальные");
    expect(text("c3-1")).toMatch(/\*\*Якорная цена\*\* — первая названная цена становится точкой отсчёта/);
  });
});

describe("урок и тест больше не говорят разное (Доп. 352)", () => {
  it("«Вам всё понравилось?» плох тем, что закрытый; «нет» запрещено без альтернативы, а не само слово", () => {
    expect(q("c1-q", 9).q).toBe("«Вам всё понравилось?» хуже, чем «Как вам сегодня?», потому что:");
    expect(right(q("c1-q", 9))).toMatch(/закрытый/);
    expect(text("c1-5")).toMatch(/Закрытый вопрос/);
    expect(right(q("c1-q", 19))).toBe("Отказ закрывает разговор — сразу предлагай замену");
  });
  it("up-selling — классом выше, cross-selling — дополнение; оба термина есть в уроке", () => {
    expect(right(q("s7-q", 3))).toMatch(/классом выше/);
    expect(right(q("s7-q", 16))).toMatch(/в дополнение к заказу/);
    expect(text("s7-1")).toMatch(/Up-selling — вариант классом выше/);
    expect(text("s7-1")).toMatch(/Cross-selling — дополнение к заказу/);
    // первый шаг — заметить за 10 секунд; check-back — открытым вопросом, как учит урок «Язык и стандарты»
    expect(text("s7-1")).toMatch(/1\. Встреча — заметить гостя за 10 секунд/);
    expect(text("s7-1")).toMatch(/Check Back — через несколько минут после подачи: «Как вам блюдо\?»/);
    expect(GLOSSARY.find((g) => g.term === "Check Back").def).not.toMatch(/Вам понравилось/);
  });
  it("посуду убирают, когда все закончили; стол перекрывают после ухода гостей", () => {
    expect(text("s7-2")).not.toMatch(/убирается сразу/);
    expect(text("s7-2")).toMatch(/когда все за столом закончили/);
    expect(text("c4-2")).not.toMatch(/пока гость не вышел/);
    expect(text("c4-2")).toMatch(/Стол перекрывают только после того, как гости вышли из зала/);
  });
  it("ЧП: скорую сразу, если не приходит в сознание; аллергическая реакция началась — скорая немедленно", () => {
    expect(right(q("s-er-q", 6))).toMatch(/не приходит в сознание/);
    expect(text("s-er-2")).toMatch(/гость не приходит в сознание/);
    expect(right(q("s5-q", 11))).toBe("Немедленно вызываю скорую и зову менеджера");
  });
  it("сдача: не забирай папку сразу — и урок, и практика", () => {
    for (const id of ["s6-2", "c3-4"]) {
      expect(text(id)).not.toMatch(/подожди, не уходи сразу/);
      expect(text(id)).toMatch(/не забирай папку сразу/);
    }
    expect(right(p("s6-p", 1))).toMatch(/^Тихо отхожу/);
    expect(right(p("c3-p", 10))).toBe("Спрашиваю: «Позвольте забрать папку?»");
    expect(text("c3-4")).toMatch(/Гость оставил часть сдачи и смотрит на тебя — не благодари за чаевые, а спроси: «Позвольте забрать папку\?»/);
    expect(q("c3-q", 22).q).not.toMatch(/уже принесено/);
  });
  it("обратная связь — каждый день, после смены один на один; фиксация ЧП — после людей", () => {
    expect(right(q("m2-q", 14))).toBe("Каждый день, пока ситуация свежа в памяти");
    expect(right(p("m2-p", 1))).toMatch(/^После смены один на один/);
    expect(q("m5-q", 11).q).not.toMatch(/сразу/);
    expect(text("m5-5")).toMatch(/Сначала — люди/);
  });
  it("скандал на публику — демонстративный гость, тактика урока «предложи отойти»", () => {
    expect(p("m4-p", 7).scene).toMatch(/на публику/);
    expect(right(p("m4-p", 7))).toMatch(/перейти в спокойное место/);
  });
  it("продукт сервис-менеджера — система, которая обучает людей сама; сроки и встречи в «Роли и инструментах» сходятся", () => {
    expect(right(q("sm0-q", 13))).toMatch(/^Система и культура/);
    const sm1 = ["sm1-1", "sm1-2", "sm1-3", "sm1-4"].map(text).join("\n");
    expect(sm1).not.toMatch(/7–10 дней/);
    expect(sm1).not.toMatch(/раз в 2 недели/);
    expect(text("sm1-3")).toMatch(/Занятие с наставниками — каждую неделю/);
  });
  it("хостес: признание присутствия — второй этап Формулы; опираться — на записи, а не на одну память", () => {
    expect(text("spg-1-3")).toMatch(/второй этап Формулы встречи/);
    expect(text("spg-7-2")).toMatch(/опираться на записи не стыдно/);
  });
  it("заметки редакторов: L.A.S.T. в тесте как в уроке, ядро отличается мышлением, а не «автоматизмом»", () => {
    expect(right(q("s4-q", 2))).toBe("Выслушать → извиниться → решить → поблагодарить");
    expect(right(q("c0-q", 2))).toMatch(/что чувствует гость/);
  });
});

describe("темы, на которых держались вопросы, теперь есть в уроках (Доп. 352)", () => {
  it("новичок: 10 секунд и 2 минуты, вынос приборов, способ оплаты, 1 минута на стол, аллергены", () => {
    expect(text("s0-3")).toMatch(/в первые 10 секунд, подход к столу — не позже 2 минут/);
    expect(text("s0-3")).toMatch(/только на подносе или в салфетке/);
    expect(text("s3-1")).toMatch(/Подход к столу — не позже 2 минут после посадки/);
    expect(text("s6-2")).toMatch(/уточняй ещё при приёме заказа/);
    expect(text("s6-2")).toMatch(/Стол перекрывают за 1 минуту/);
    expect(text("s5-1")).toMatch(/информация об аллергенах должна быть доступна/);
  });
  it("ядро и менеджер: отзывы в сети, приёмы продаж, расстановка, оплата, личные цели, L.A.S.T.", () => {
    expect(text("c5-1")).toMatch(/\*\*Отзывы в интернете и рейтинг:\*\*/);
    expect(text("c5-1")).toMatch(/Блогер получает тот же стандарт/);
    // площадку подсказываем, только если гость не знает где (иначе спорит с тестом: «Отзыв напишу» → без подсказок)
    expect(text("c5-1")).toMatch(/Гость хочет написать отзыв, но не знает где, — подскажи главную площадку/);
    expect(text("c5-1")).toMatch(/Если просто обещает написать — поблагодари и пригласи снова/);
    for (const k of ["Похвали выбор", "Якорная цена", "Метод сэндвича"]) expect(text("c3-1")).toMatch(new RegExp(k));
    expect(text("c4-1")).toMatch(/Зачем сервировать заранее/);
    expect(text("m3-1")).toMatch(/\*\*Расстановка на смену:\*\*/);
    expect(text("m3-1")).toMatch(/Узнай личные цели каждого/);
    expect(text("m3-2")).toMatch(/Разница в оплате допустима/);
    expect(text("m2-1")).toMatch(/алгоритм L\.A\.S\.T\. мало выучить/);
  });
});

describe("сцены практики (Доп. 352)", () => {
  it("«мысли гостя» — только в жанре «глазами гостя», и там они есть всегда", () => {
    for (const { tag, s, g } of situations) {
      if (g === "empathy") expect(Boolean(s.guestThought), tag).toBe(true);
      else expect(s.guestThought, tag).toBeUndefined();
    }
  });
  it("мысль сотрудника — в сцене, жанр «в зале»; «найди ошибку» с вопросом «что делаешь?» — тоже «в зале»", () => {
    for (const [id, n] of [["m5-p", 6], ["sm6-p", 5], ["s-prod-p", 6], ["s-er-p", 7], ["s-pos-p", 7]]) expect(p(id, n).genre, id).toBe("action");
    expect(p("m5-p", 6).scene).toMatch(/Он тихо говорит: «Я всё сделал правильно/);
    expect(p("sm6-p", 5).scene).toMatch(/огнетушитель просрочен/);
  });
  it("«глазами гостя»: вопрос про чувства гостя, мысль совпадает со сценой", () => {
    for (const [id, n] of [["s1-p", 5], ["s-dg-p", 2], ["s3-p", 5]]) expect(p(id, n).question, id).toMatch(/чувству(е|ю)т/);
    expect(p("s7-p", 8).guestThought).toMatch(/забирает тарелку/);
    expect(p("s6-p", 5).guestThought).not.toMatch(/выпроводить/);
    expect(p("s3-p", 5).guestThought).toMatch(/^Только сели/);
    expect(p("s-al-p", 7).scene).toMatch(/с аллергией/);
  });
  it("«Собери правило»: начало не обрывается на «а:», «в:», «он:» или на вопросе", () => {
    for (const { tag, s, g } of situations) {
      if (g !== "complete") continue;
      expect(s.start, tag).not.toMatch(/(^|[\s,])(а|в|он|на|о|в течение)\s*:\s*$/u);
      expect(s.start, tag).not.toMatch(/\?\s*$/u);
    }
  });
  it("многоточие — один знак «…», а не три точки", () => {
    for (const mods of ALL) for (const m of mods) for (const l of m.lessons || []) {
      expect(String(l.content || ""), l.id).not.toMatch(/\.\.\./);
      for (const it of [...(l.questions || []), ...(l.situations || [])]) for (const k of ["q", "scene", "guestThought", "statement", "start", "question", "explanation", "win", "fail"]) expect(String(it[k] || ""), l.id).not.toMatch(/\.\.\./);
    }
  });
});

describe("проверка контента (Доп. 352)", () => {
  it("стандарты времени ищутся и в уроках ролей, а не только в ленивом modules.js", () => {
    const src = readFileSync("scripts/check-content.mjs", "utf8");
    expect(src).toMatch(/for \(const f of \["modules-seasonal\.js", "modules-core\.js"/);
    expect(src).toMatch(/line\.split\("\\\\n"\)/);
  });
});
