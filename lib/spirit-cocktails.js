// lib/spirit-cocktails.js — v127 (Доп. 440): в каких коктейлях нашего бара работает позиция крепкого. Без React.
//
// Карточка позиции в «Барной карте» показывает «В коктейлях нашего бара», строка коктейля — «Из нашей карты: …».
// Основа (виски, коньяк, ром, джин, текила, водка) — по слову в ингредиенте («джин», но не «джинджер»). Если ингредиент
// уточняет (бурбон, ржаной, скотч, ирландский; белый, тёмный, золотой, пряный ром; бланко, репосадо, аньехо, мескаль),
// подходит только то, что сходится по стилю, стране, региону или названию: односолодовый из Шотландии не попадёт в коктейль
// на бурбоне. Если про позицию ничего такого не известно, она подходит к любому ингредиенту своей основы. Ликёры, биттеры
// и прочее — по названию: как оно пишется и как его говорят в зале (Campari — «Кампари», словарь data/pronounce.js), и по
// частым синонимам (Cointreau — трипл сек, Kahlua — кофейный ликёр). Соки, сиропы, лёд и прочие добавки — не крепкое.
import { PRONOUNCE } from "../data/pronounce.js";
import { normName } from "./spirit.js";

// латиница без надстрочных знаков (crème — creme, añejo — anejo); кириллицу не трогаем
const lat = (t) => String(t || "").replace(/[àáâä]/g, "a").replace(/[èéêë]/g, "e").replace(/[ìíîï]/g, "i").replace(/[òóôö]/g, "o").replace(/[ùúûü]/g, "u")
  .replace(/ñ/g, "n").replace(/ç/g, "c");
const norm = (t) => lat(normName(t));
const inside = (a, b) => !!a && !!b && (" " + b + " ").includes(" " + a + " ");   // фраза a целыми словами в b

const BASE = { whisky: /виски|бурбон|скотч/, cognac: /коньяк|бренди/, rum: /(^|\s)ром(\s|$)/, gin: /(^|\s)джин(\s|$)/, agave: /текил|мескал/, vodka: /водк/ };
// уточнения основы: [что в ингредиенте, что у позиции (стиль, страна, регион, название), общее правило основы]
const SUB = {
  whisky: [
    [/бурбон/, /бурбон|bourbon|кентукки|kentucky|теннесси|tennessee|(^|\s)сша(\s|$)|америк/],
    [/ржан/, /ржан|(^|\s)rye(\s|$)/],
    [/скотч|шотланд/, /шотланд|скотч|scotch|спейсайд|speyside|айла|islay|хайленд|highland|лоуленд|lowland|кэмпбелтаун|campbeltown|односолод|single malt|торф/],
    [/ирланд/, /ирланд|irish|ireland/],
    [/японск/, /япон|japan/],
  ],
  rum: [
    [/(^|\s)бел/, /(^|\s)бел|white|blanc|silver|plata|cristal/],
    [/темн|черн/, /темн|черн|dark|black|negro|выдерж|aged|anejo/],
    [/золот/, /золот|gold|(^|\s)oro(\s|$)|dorado|amber/],
    [/прян/, /прян|spiced/],
  ],
  agave: [
    [/мескал/, /мескал|mezcal/],
    [/бланко|сильвер|серебр/, /бланко|blanco|silver|сильвер|plata|серебр/],
    [/репосадо/, /репосадо|reposado/],
    [/аньехо/, /аньехо|anejo/],
    [/текил/, /текил|tequila|бланко|blanco|silver|plata|репосадо|reposado|аньехо|anejo/, true],
  ],
};
function baseFits(cat, ing, hay) {
  const re = BASE[cat];
  if (!re || !re.test(ing)) return false;
  const rules = SUB[cat] || [], rule = rules.find(([i]) => i.test(ing));
  if (!rule) return true;
  const known = rules.some(([, p, general]) => !general && p.test(hay));
  return !known || rule[1].test(hay);
}

// не крепкое: в эти ингредиенты позиция по своему названию не попадает
const MIXER = /(^|\s)(сок|сироп|пюре|содовая|морс|лимонад|тоник|кола|вода|лед|соль|перец|сахар|белок|сливки|молоко|кофе|эспрессо|чай|мята|базилик|клубника|лайм|лимон|апельсин|спрайт|табаско|соус|гренадин|оржа|энергетик|пиво|мед)(\s|$)/;
// синонимы: как то, что в названии позиции, пишут в рецепте коктейля
const ALIAS = [
  [/cointreau|куантро|triple sec|трипл сек/, "трипл сек"], [/grand marnier|гран марнье/, "гран марнье"], [/curacao|кюрасао/, "кюрасао"],
  [/baileys|бейлис/, "бейлис"], [/kahlua|калуа|tia maria|тиа мария/, "кофейный ликер"], [/disaronno|amaretto|амаретто/, "амаретто"],
  [/luxardo|maraschino|мараскино/, "мараскино"], [/midori|мидори/, "мидори"], [/sambuca|самбука/, "самбука"], [/absinth|абсент/, "абсент"],
  [/cachaca|кашаса/, "кашаса"], [/pisco|писко/, "писко"], [/aperol|апероль/, "апероль"], [/campari|кампари/, "кампари"],
  [/angostura|ангостура/, "ангостура"], [/drambuie|драмбуи/, "драмбуи"], [/cassis|кассис/, "крем де кассис"], [/creme de cacao|крем де какао/, "крем де какао"],
  [/creme de menthe|крем де мент/, "крем де мент"], [/violette|виолет/, "крем де виолет"], [/creme de mure|крем де мюр/, "крем де мюр"],
  [/peach|персиков/, "персиковый ликер"], [/cherry|heering|вишнев/, "вишневый ликер"], [/vermouth|вермут|martini|мартини|cinzano|чинзано/, "вермут"],
];
// вермут: в «красный» — не сухой и не белый, в «сухой» — не красный
const VERM = [[/красн/, /(^|\s)(dry|extra|bianco|blanc|бьянко|сух|бел)/], [/сух/, /rosso|россо|красн|rouge|rojo|bianco|бьянко/]];
const vermOk = (ing, hay) => !/вермут/.test(ing) || !VERM.some(([i, bad]) => i.test(ing) && bad.test(hay));

const PRON = PRONOUNCE.filter((p) => p.cat === "bar" && p.o).map((p) => [norm(p.o), norm(String(p.w).replace(/\+/g, ""))]);
/** Как позицию могут написать в рецепте: само название, как его говорят в зале (словарь), синонимы. */
export function spiritKeys(w) {
  const name = norm(w && w.name);
  if (!name) return [];
  const hay = norm([w.name, w.producer].join(" ")), keys = [name];
  for (const [o, ru] of PRON) if (inside(o, hay)) keys.push(ru);
  for (const [re, key] of ALIAS) if (re.test(hay)) keys.push(key);
  return [...new Set(keys)];
}
const ingNames = (c) => (c && Array.isArray(c.ing) ? c.ing.map((i) => norm(Array.isArray(i) ? i[0] : i && i.name)).filter(Boolean) : []);
/** Работает ли позиция в коктейле: по основе с уточнением или по названию. */
export function usesSpirit(c, w) {
  if (!c || !w || !w.name) return false;
  const ings = ingNames(c);
  if (!ings.length) return false;
  const hay = norm([w.style, w.country, w.region, w.name, w.producer].join(" ")), name = norm(w.name), keys = spiritKeys(w);
  return ings.some((ing) => baseFits(w.cat, ing, hay) || ((keys.some((k) => inside(k, ing)) || (!MIXER.test(ing) && inside(ing, name))) && vermOk(ing, hay)));
}
/** Коктейли (из своей карты бара), где работает позиция. */
export const spiritCocktails = (w, cocktails) => (cocktails || []).filter((c) => usesSpirit(c, w));
/** Позиции крепкого (живые), что работают в коктейле. */
export const cocktailSpirits = (c, items) => (items || []).filter((w) => w && !w.archived && usesSpirit(c, w));
