// lib/golist.js — v141 (Доп. 458): гоу-лист смены.
//
// Владелец (06.11, план «Админ на смене»): гоу-лист — новым блоком брифинга. По «Стандартам холдинга» (модуль 09): две-три
// позиции, которые смена продвигает сегодня (новинка, высокая маржа, продукт, который нужно продать до конца срока);
// составляют шеф и администратор до брифинга; на брифинге называют, что это, чем хорошо, с чем предложить, и фразу гостю;
// в конце смены записывают, сколько продано. Здесь только расчёт: выбор из меню и «Барной карты», три строки из карточки,
// подсказка Наставника, строки для карточки, чата и Telegram, итог смены и гоу-лист дня на телефоне (метка в меню и
// контекст Наставника). Экран — ui/briefing.jsx, итог на сервере — этап 50 (brief_go_save, brief_go_get).
import { isBarcard, readBarcard } from "./deck-extras";
import { COCKTAILS } from "../data/cocktails";
import { COCKTAIL_STORIES } from "../data/cocktail-stories";

import { GO_MAX, GO_LIMITS, GO_KINDS, GO_KIND_WORD, cutWords, goNormalize } from "./golist-day";
export * from "./golist-day";   // всё лёгкое — оттуда же: экран брифинга берёт гоу-лист одним импортом
const KINDS = GO_KINDS.map((k) => k[0]);

const str = (v, n) => String(v == null ? "" : v).replace(/\s+/g, " ").trim().slice(0, n);
/** Первое предложение текста, не длиннее n; одна точка в конце не нужна (строка в брифинге — не предложение) */
export const firstSentence = (s, n) => { const t = String(s || "").replace(/\s+/g, " ").trim(); const m = t.match(/^.+?[.!?…](?=\s|$)/); return cutWords(m ? m[0] : t, n).replace(/([^.])\.$/, "$1"); };
const nrm = (s) => String(s || "").toLowerCase().replace(/ё/g, "е").trim();

/** Что можно выбрать: блюда, свои коктейли, вина и крепкое меню команды, классика из «Барной карты». stop — в стопе (выбрать нельзя). */
export function goCandidates(menu) {
  const out = [], seen = new Set();
  for (const d of menu || []) {
    if (!d || !d.id || !d.name || d.archived || isBarcard(d)) continue;
    const kind = KINDS.includes(d.kind) ? d.kind : "dish";
    const id = String(d.id);
    if (seen.has(id)) continue;
    seen.add(id);
    out.push({ id, name: str(d.name, GO_LIMITS.name), kind, stop: !!d.stop, src: d });
  }
  // классика — как в «Барной карте» (lib/bar-card.js, ourCocktails): карта бара не настроена — вся классика
  const card = readBarcard(menu);
  for (const cid of card || COCKTAILS.map((x) => x && x.id)) {
    const c = COCKTAILS.find((x) => x && x.id === cid);
    if (!c || seen.has(c.id)) continue;
    seen.add(c.id);
    out.push({ id: c.id, name: str(c.name, GO_LIMITS.name), kind: "cocktail", stop: false, classic: true, src: c });
  }
  return out;
}

/** Поиск по названию: слова запроса — в начале слов названия («тар» — «Тартар», «нег» — «Негрони»). */
export function goSearch(list, q) {
  const ws = nrm(q).split(/[^a-zа-я0-9]+/).filter(Boolean);
  if (!ws.length) return list;
  return list.filter((c) => { const nw = nrm(c.name).split(/[^a-zа-я0-9]+/).filter(Boolean); return ws.every((w) => nw.some((x) => x.startsWith(w))); });
}

/** Три строки из карточки: чем хорошо, с чем предложить, фраза гостю (чего нет в карточке — пусто). */
export function goPrefill(c, menu) {
  const d = (c && c.src) || {};
  if (!c) return { why: "", pair: "", say: "" };
  if (c.kind === "dish") return { why: firstSentence(d.desc, GO_LIMITS.why), pair: cutWords(d.pairing, GO_LIMITS.pair), say: "" };
  if (c.kind === "cocktail") {
    if (c.classic) {
      // фраза «Барной карты» для гостя: два предложения и больше — первое «чем хорош», остальное — фраза; одно — только фраза
      const g = String((COCKTAIL_STORIES[d.id] || {}).guest || "").replace(/\s+/g, " ").trim();
      const m = g.match(/^(.+?[.!?…])\s+(.+)$/);
      return { why: m ? cutWords(m[1], GO_LIMITS.why).replace(/([^.])\.$/, "$1") : "", pair: cutWords(d.pair, GO_LIMITS.pair), say: cutWords(m ? m[2] : g, GO_LIMITS.say) };
    }
    return { why: firstSentence(d.story || d.tip, GO_LIMITS.why), pair: cutWords(typeof d.pair === "string" ? d.pair : "", GO_LIMITS.pair), say: cutWords(d.short, GO_LIMITS.say) };
  }
  // вино и крепкое «Барной карты»: ноты, пара — блюда из карточки и заметка о паре, фраза — «Одной фразой гостю»
  const notes = Array.isArray(d.notes) ? d.notes.map((x) => str(x, 32)).filter(Boolean).slice(0, 3).join(", ") : str(d.notes, 60);
  const dishes = Array.isArray(d.pair) ? d.pair.map((id) => (menu || []).find((x) => x && x.id === id)).filter((x) => x && x.name && !x.archived).map((x) => str(x.name, 40)) : [];
  const pair = [dishes.slice(0, 2).join(", "), str(d.pairNote, 60)].filter(Boolean).join("; ");
  return { why: notes ? cutWords("Ноты: " + notes, GO_LIMITS.why) : firstSentence(d.story, GO_LIMITS.why), pair: cutWords(pair, GO_LIMITS.pair), say: cutWords(d.short, GO_LIMITS.say) };
}

/** Позиция гоу-листа из кандидата: id, название, вид и три строки (из карточки). */
export const goItem = (c, menu) => ({ id: c.id, name: c.name, kind: c.kind, ...goPrefill(c, menu) });


// ── Подсказка Наставника: три строки по карточке ──────────────────────────────────────────────
/** Вопрос Наставнику (ai-chat): позиция, что о ней знает карточка, и формат ответа — три строки с подписями. */
export function goAiPrompt(g, c, restaurant) {
  const d = (c && c.src) || {};
  const card = c && c.kind === "dish" ? [d.desc, Array.isArray(d.ingredients) ? "состав: " + d.ingredients.slice(0, 8).join(", ") : "", d.pairing ? "сочетание: " + d.pairing : ""]
    : c && c.kind === "cocktail" ? [d.story || d.tip, Array.isArray(d.ing) ? "состав: " + d.ing.slice(0, 6).map((i) => (Array.isArray(i) ? i[0] : i)).join(", ") : "", typeof d.pair === "string" ? "к столу: " + d.pair : ""]
    : [Array.isArray(d.notes) ? "ноты: " + d.notes.slice(0, 4).join(", ") : "", d.story, d.short];
  const facts = cutWords(card.filter(Boolean).map((x) => String(x).trim().replace(/[.!?…]+$/, "")).filter(Boolean).join("; "), 420);
  return "Гоу-лист смены ресторана «" + (restaurant || "наш ресторан") + "»: " + (GO_KIND_WORD[g.kind] || "позиция") + " «" + g.name + "»." + (facts ? " Из карточки: " + facts.replace(/[.!?…]+$/, "") + "." : "") +
    "\nНапиши для брифинга официантов три строки, ровно в таком виде, без кавычек и пояснений:\nЧем хорошо: (до 70 знаков)\nС чем предложить: (до 70 знаков)\nФраза гостю: (одно живое предложение до 140 знаков, обращение на «вы»)";
}
/** Ответ Наставника → { why, pair, say }; ничего не нашли — null. */
export function goParseAi(reply) {
  const t = String(reply || "").replace(/\[\[[^\]]*\]\]/g, "").replace(/\*\*/g, "");
  const grab = (re) => { const m = t.match(re); return m ? m[1].replace(/^[\s«"“]+|[\s»"”]+$/g, "").trim() : ""; };
  const why = grab(/Чем хорош[оа]?\s*[:：]\s*(.+)/i), pair = grab(/С чем предложить\s*[:：]\s*(.+)/i), say = grab(/Фраза гостю\s*[:：]\s*(.+)/i);
  if (!why && !pair && !say) return null;
  return { why: cutWords(why, GO_LIMITS.why), pair: cutWords(pair, GO_LIMITS.pair), say: cutWords(say, GO_LIMITS.say) };
}

