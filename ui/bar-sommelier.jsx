// ui/bar-sommelier.jsx — v131 (Доп. 444): «Сомелье» в «Барной карте».
//
// Владелец (02.11): «как ты смотришь на то, что бы добавить AI-Сомелье?» — на концепт «Да делаем». Вход — строка «Сомелье»
// под вкладками «Барной карты». Официант пишет или говорит, что хочет гость; быстрые просьбы одним касанием (к блюду из
// меню, бокалом, бюджет, похоже на…, аперитив, к десерту, дижестив) ставят фразу в поле: видно, что уйдёт Наставнику.
// В ответе 2–3 позиции только из нашей карты (не из стопа, в бюджете): почему подходит и фраза гостю; касание — карточка
// в «Барной карте», «назад» — сюда же. Дальше «Ещё варианты», «Подешевле», «Поделиться в чат». Работает через Наставника
// (функция ai-chat, лимит общий: подбор считается как вопрос); нет лимита, связи или ИИ — подбор по карте без пояснений.
// Что понято из просьбы и кто из карты годится — lib/sommelier.js.
// v132 (Доп. 445), владелец: «Как мы сомелье можем сделать умнее?» — на одиннадцать предложений «Берём все»:
// • Наставник видит всю подходящую карту (режим «Сомелье» на сервере, ответ JSON); старый сервер — как в v131;
// • блюдо целиком (описание, состав, «сочетание» из меню), вкус вина по шкалам, правила сочетаний — и без ИИ;
// • размытая просьба — сначала вопрос с кнопками; после ответа — «Полегче», «Насыщеннее», «Посуше», «Послаще»,
//   «Другая страна», «Подороже»; на стол из нескольких блюд — одна бутылка на всех или бокал к каждому;
// • правила дома и «советуем первым» от руководителя; «Гость взял / Не взял» — сомелье учится (этап 47, а без него —
//   на телефоне), руководителю — итог; у позиции — подача, как произносить и «Послушать», фраза гостю на выбор.
import React from "react";
import { onActivate, vibrate } from "../lib/utils";
import { GOLD, labelStyle } from "./tokens";
import { SUPABASE_URL, SUPABASE_KEY, saToken, rpc, rpcMissing } from "../api/supabase";
import { WINE, SPIRIT } from "../lib/drinks";
import { dishesOf, rememberSharedMenu } from "../lib/reference-context";
import { drinkShareItem, cocktailShareItem } from "../lib/share-items";
import { SOM_WHAT, SOM_KIND_RU, SOM_OCC, somAsk, askEmpty, somPool, somShortlist, somPrompt, promptCount, parseSom, localPicks, cheaperThan, somToggle, somOn,
  budgetPhrase, somBudgetSteps, dishOptions, likeOptions, kindsFor, posWord, needsClarify, SOM_REFINE, refineOf, refineAvail, readSomRules, withSomRules,
  statsIndex, statsFromLog, statsText, somPayload, parseSomJson, tableLists, localTable, assignTable } from "../lib/sommelier";
import { normTaste, tasteN } from "../lib/taste";
import { findPronounce, stressText, plainText } from "../lib/pronounce";
import { canSpeak, speakText } from "../lib/speech";
import { MicButton } from "./mic";
import { CocktailArt } from "./cocktail-art";
import { WineThumb } from "./wine-list";
import { Chevron, ShareChat } from "./bar-kit";
import { TasteBars } from "./taste";

const SERIF = "Georgia, 'Times New Roman', serif";
const H = () => ({ apikey: SUPABASE_KEY, Authorization: "Bearer " + SUPABASE_KEY });
const keyOf = (c) => c.kind + ":" + c.id;
const plural = (n, a, b, c) => { const m10 = n % 10, m100 = n % 100; return m10 === 1 && m100 !== 11 ? a : m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20) ? b : c; };
const cutName = (t, n = 26) => (String(t).length > n ? String(t).slice(0, n - 1).trimEnd() + "…" : String(t));
// без Наставника: почему подбор по карте и что делать
const LOCAL_WHY = {
  daily_limit: "На сегодня вопросы к Наставнику закончились: подобрал по карте сам, без его пояснений. Завтра снова с Наставником.",
  not_configured: "Наставник на сервере ещё не подключён: подобрал по карте сам, по совпадению с просьбой.",
  net: "Нет связи с Наставником: подобрал по карте сам, по совпадению с просьбой.",
  none: "Наставник не выбрал из списка: вот что ближе всего по карте.",
};
const LOCAL_ANY = "Наставник сейчас не ответил: подобрал по карте сам. Можно спросить ещё раз.";
const REFINE_LABEL = Object.fromEntries(SOM_REFINE);

/** Спросить Наставника: → { reply, remaining, som } или { error }. som — вся карта для режима «Сомелье» (новый сервер),
 *  messages — короткий список для сервера постарше (он режим не знает и отвечает как Наставник). */
async function askMentor(prompt, som) {
  try {
    const r = await fetch(SUPABASE_URL + "/functions/v1/ai-chat", { method: "POST", headers: { "Content-Type": "application/json", ...H() },
      body: JSON.stringify({ token: saToken(), mode: "sommelier", messages: [{ role: "user", content: prompt }], som }) });
    const j = await r.json();
    if (j && j.ok && j.reply) return { reply: String(j.reply), remaining: typeof j.remaining === "number" ? j.remaining : -1, som: j.som === 1 };
    return { error: (j && j.error) || "ai" };
  } catch (e) { return { error: "net" }; }
}

// ── «Гость взял / Не взял»: на сервер (этап 47), а пока его нет — в журнал телефона ──
const LOG_KEY = (rest) => "sa_som_log_" + rest;
const readLog = (rest) => { try { const a = JSON.parse(localStorage.getItem(LOG_KEY(rest)) || "[]"); return Array.isArray(a) ? a : []; } catch (e) { return []; } };
const writeLog = (rest, row) => { try { const a = readLog(rest).filter((r) => !(row.ev !== "run" && r.item === row.item && r.ev !== "run" && row.t - r.t < 600e3)); a.push(row); localStorage.setItem(LOG_KEY(rest), JSON.stringify(a.slice(-500))); } catch (e) {} };
function logSom(rest, ev, item, dishes, ask, srv) {
  const row = { ev, item: item || "", dishes: (dishes || []).map(String).slice(0, 6), ask: String(ask || "").slice(0, 300), t: Date.now() };
  if (srv === "local") { writeLog(rest, row); return Promise.resolve("local"); }
  return rpc("som_log_add", { p_token: saToken(), p_ev: ev, p_item: row.item, p_dishes: row.dishes, p_ask: row.ask })
    .then((res) => { if (res && res.ok === true) return "server"; writeLog(rest, row); return "local"; })
    .catch(() => { writeLog(rest, row); return "local"; });
}
function loadStats(rest) {
  return rpc("som_stats", { p_token: saToken() }).then((res) => {
    if (res && res.ok === true) return { src: "server", raw: res };
    return { src: rpcMissing(res) ? "local" : "local", raw: statsFromLog(readLog(rest)) };
  }).catch(() => ({ src: "local", raw: statsFromLog(readLog(rest)) }));
}

/** Значок строки «Сомелье»: бокал и искра. */
export const SOM_IC = (c, s = 18) => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
    <path d="M6.5 3h8l-.5 5a3.5 3.5 0 0 1-7 0z" /><path d="M10.5 11.5V19M7.5 21h6" /><path d="M19 3.5v4M17 5.5h4" /></svg>);

/** Строка «Сомелье» под вкладками «Барной карты». */
export function SomEntry({ T, a11y, onClick }) {
  const gold = a11y ? "#7A5D2A" : GOLD, text = T.modTitle.color, sub = T.modSub.color;
  const go = () => { vibrate("light"); onClick(); };
  return (
    <div style={{ padding: "0 16px 12px" }}>
      <div role="button" tabIndex={0} data-bar-som-open="" data-lens-card="" onClick={go} {...onActivate(go)}
        style={{ ...T.modCard, display: "flex", alignItems: "center", gap: 12, padding: "10px 12px 10px 12px", margin: 0, cursor: "pointer",
          border: `1px solid ${gold}${a11y ? "77" : "66"}`, background: a11y ? "rgba(139,106,48,0.07)" : "linear-gradient(135deg, rgba(214,178,102,0.16), rgba(255,248,230,0.03) 70%)",
          boxShadow: a11y ? "none" : "0 0 22px rgba(214,178,102,0.10)" }}>
        <span aria-hidden="true" style={{ width: 36, height: 36, flexShrink: 0, borderRadius: 999, display: "grid", placeItems: "center", border: `1px solid ${gold}55`,
          background: a11y ? "rgba(139,106,48,0.08)" : "radial-gradient(circle at 50% 40%, rgba(214,178,102,0.22), rgba(214,178,102,0.04))" }}>{SOM_IC(gold, 19)}</span>
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{ display: "block", fontFamily: SERIF, fontSize: 15.5, color: text, lineHeight: 1.25 }}>Сомелье</span>
          <span style={{ display: "block", fontSize: 12.5, color: sub, lineHeight: 1.35, marginTop: 2 }}>Подберу гостю из нашей карты</span>
        </span>
        <Chevron gold={gold} />
      </div>
    </div>);
}

// «на стол: «A», «B»» и «бокал к каждому» — фразы в поле, как у быстрых просьб
const TABLE_RE = /(?:,\s*)?на стол:\s*((?:«[^»]+»\s*,?\s*)+)/i, EACH_RE = /(?:,\s*)?бокал к каждому/i;
const tidy = (t) => String(t || "").replace(/\s+,/g, ",").replace(/,\s*,/g, ",").replace(/^\s*,\s*|\s*,\s*$/g, "").replace(/\s{2,}/g, " ").trim();
const tableNames = (t) => { const m = String(t || "").match(TABLE_RE); return m ? [...m[1].matchAll(/«([^»]+)»/g)].map((x) => x[1]) : []; };
function withTable(t, names, each) {
  const rest = tidy(String(t || "").replace(TABLE_RE, "").replace(EACH_RE, ""));
  if (!names.length) return rest;
  const ph = "на стол: " + names.map((n) => "«" + n + "»").join(", ") + (each && names.length > 1 ? ", бокал к каждому" : "");
  return rest ? rest + ", " + ph : ph;
}

export function BarSommelier({ T, a11y, restaurant, cocktails, wines, spirits, start = "all", keep = null, onKeep, onBack, onOpen, onShareChat, team = null, edit = false, who = "" }) {
  const gold = a11y ? "#7A5D2A" : GOLD, ink = T.modTitle.color, sub = T.modSub.color;
  const red = a11y ? "#9A3A2A" : "#E08A7A", ok = a11y ? "#2E6B3A" : "#8FC79A";
  const dishes = React.useMemo(() => { try { return dishesOf(restaurant) || []; } catch (e) { return []; } }, [restaurant]);
  const dishName = (id) => (dishes.find((d) => d && String(d.id) === String(id)) || {}).name || "";
  const pool = React.useMemo(() => somPool({ wines, spirits, cocktails }), [wines, spirits, cocktails]);
  const has = { wine: pool.some((c) => c.kind === "wine"), spirit: pool.some((c) => c.kind === "spirit"), cocktail: pool.some((c) => c.kind === "cocktail") };
  const kindsN = ["wine", "spirit", "cocktail"].filter((k) => has[k]).length;
  const whats = SOM_WHAT.filter(([k]) => (k === "all" ? kindsN > 1 : has[k])).map(([k]) => k);
  const first = whats.includes(start) ? start : whats[0] || "all";
  const shared = team ? team[0] : [], setShared = team ? team[1] : null;
  const rules = React.useMemo(() => readSomRules(shared), [shared]);
  const k0 = keep || {};
  const [text, setText0] = React.useState(k0.text || "");
  const [what, setWhat] = React.useState(k0.what && whats.includes(k0.what) ? k0.what : first);
  const [sub2, setSub] = React.useState("");          // открытый ряд: dish | table | budget | like
  const [res, setRes] = React.useState(k0.res || null);
  const [seen, setSeen] = React.useState(k0.seen || []);
  const [marks, setMarks] = React.useState(k0.marks || {});
  const [vars, setVars] = React.useState({});         // фраза гостю: short | say | story
  const [busy, setBusy] = React.useState("");
  const [msg, setMsg] = React.useState("");
  const [stats, setStats] = React.useState(null);     // { src, raw, idx }
  const [rulesEdit, setRulesEdit] = React.useState(null);
  const [saveMsg, setSaveMsg] = React.useState("");
  const [fill, setFill] = React.useState("");
  const taRef = React.useRef(null);
  const textRef = React.useRef(text); textRef.current = text;
  const ctx = { dishes, wines, spirits };
  React.useEffect(() => { if (onKeep) onKeep({ text, what, res, seen, marks }); }, [text, what, res, seen, marks]);
  React.useEffect(() => { let alive = true; loadStats(restaurant).then((s) => { if (alive) setStats({ ...s, idx: statsIndex(s.raw) }); }); return () => { alive = false; }; }, [restaurant]);
  // в просьбе названо одно («виски», «красное») — вид переключается сам; можно поменять руками
  const setText = (v, typed = true) => {
    setText0(v); setMsg("");
    if (!typed) return;
    const a = somAsk(v, ctx);
    if (a.kinds.length === 1 && whats.includes(a.kinds[0])) setWhat(a.kinds[0]);
    else if (a.kinds.length > 1 && whats.includes("all")) setWhat("all");
  };
  const on = somOn(text);
  const ask = React.useMemo(() => somAsk(text, ctx), [text, dishes, wines, spirits]);
  const steps = React.useMemo(() => somBudgetSteps(pool, what, ask.glass), [pool, what, ask.glass]);
  const dishOpts = React.useMemo(() => dishOptions(dishes, pool), [dishes, pool]);
  const likeOpts = React.useMemo(() => likeOptions(pool), [pool]);
  const kinds = kindsFor(what, ask);
  const glassOk = kinds.includes("wine") && pool.some((c) => c.kind === "wine" && c.byGlass);
  const tNames = tableNames(text), tEach = EACH_RE.test(text);
  const toggle = (key, phrase) => { vibrate("light"); setText(somToggle(text, key, phrase), key === "glass"); };
  const chip = (on2) => ({ padding: "7px 12px", borderRadius: 999, fontSize: 13, cursor: "pointer", border: `1px solid ${on2 ? gold : gold + "44"}`, background: on2 ? "rgba(214,178,102,0.16)" : "transparent",
    color: on2 ? ink : sub, whiteSpace: "nowrap", fontFamily: SERIF, lineHeight: 1.2 });
  const btn = (main) => ({ ...T.doneBtn, margin: 0, padding: "10px 16px", fontSize: 14, flex: main ? "1 1 0" : "0 0 auto", width: "auto", minWidth: 0, background: main ? gold : "transparent", color: main ? "#1A1008" : ink,
    border: main ? "none" : `1px solid ${gold}55`, cursor: "pointer" });
  const small = (on2) => ({ display: "inline-flex", alignItems: "center", gap: 5, padding: "6px 11px", borderRadius: 999, border: `1px solid ${on2 ? gold : gold + "55"}`, background: on2 ? "rgba(214,178,102,0.16)" : "transparent",
    color: on2 ? ink : sub, fontFamily: SERIF, fontSize: 12.5, cursor: "pointer", lineHeight: 1.2 });

  // подбор: new — с начала, more — без показанных, cheaper — дешевле показанного, refine — уточнение (refKey)
  const run = async (how = "new", refKey = "", textIn = null) => {
    if (busy) return;
    const tx = textIn != null ? textIn : text;
    const a0 = somAsk(tx, ctx);
    if (askEmpty(a0)) { setMsg("Напиши, что хочет гость, или выбери подсказку ниже."); if (taRef.current) taRef.current.focus(); return; }
    vibrate("light"); setMsg(""); setSub("");
    // размытая просьба («что-нибудь хорошее») — сначала один вопрос с кнопками, без запроса к Наставнику
    if (how === "new" && needsClarify(a0) && !(res && res.mode === "clarify" && res.text === a0.text)) {
      setRes({ how, text: a0.text, what, mode: "clarify", picks: [], total: 0, at: Date.now() }); return;
    }
    const prio = new Set(rules.prio);
    const refine = how === "refine" && res ? refineOf(refKey, res.picks, a0.glass) : null;
    const a = { ...a0, prio, stats: stats ? stats.idx : null, refine };
    const exclude = how === "new" ? [] : seen;
    const below = how === "cheaper" && res ? cheaperThan(res.picks, a.glass) : 0;
    const groups = a.table && a.table.each ? tableLists(pool, a, { what, exclude }) : null;
    const sl = somShortlist(pool, a, { what, exclude, below, limit: 120 });
    const full = groups ? groups.flatMap((g) => g.list).filter((c, i, arr) => arr.findIndex((x) => keyOf(x) === keyOf(c)) === i) : sl.list;
    const base = { how, refKey, text: a.text, what, total: groups ? full.length : sl.total, glass: a.glass, at: Date.now(),
      table: a.table ? { each: !!a.table.each, dishes: a.table.dishes.map((d) => ({ id: String(d.id), name: d.name })) } : null, dishIds: a.dishes.map((d) => String(d.id)) };
    if (!full.length) { setRes({ ...base, picks: [], none: sl.none || "Под эту просьбу в нашей карте ничего нет.", mode: "none" }); return; }
    const short = full.slice(0, 10);
    const prompt = somPrompt(a, short, { restaurant, dishName });
    const sent = short.slice(0, promptCount(prompt));
    const payload = somPayload(a, full, { dishName, rules: rules.text, prev: how === "new" || !res ? [] : res.picks, refine, stats: stats ? statsText(a, stats.idx, pool) : "", prio, groups });
    setBusy(how + ":" + full.length);
    const r = await askMentor(prompt, payload);
    setBusy("");
    const max = groups ? groups.length : 3;
    let out;
    if (r.reply) {
      const pj = r.som ? parseSomJson(r.reply, full, max) : null;
      const p = pj || parseSom(r.reply, r.som ? full : sent);
      out = p.picks.length ? { ...base, picks: p.picks, mode: "ai", remaining: r.remaining }
        : { ...base, picks: groups ? localTable(groups) : localPicks(r.som ? full : sent), mode: "local", err: "none", note: p.note, remaining: r.remaining };
    } else out = { ...base, picks: groups ? localTable(groups) : localPicks(full), mode: "local", err: r.error };
    // бокал к каждому: блюдо у позиции — от Наставника, а нет — то, к чьему списку она ближе
    if (groups) out.picks = assignTable(out.picks, groups);
    setSeen((s) => [...(how === "new" ? [] : s), ...out.picks.map(keyOf)]);
    setRes(out); setMarks({}); setVars({});
    logSom(restaurant, "run", "", out.dishIds, out.text, stats && stats.src);
    vibrate(out.mode === "ai" ? "success" : "light");
  };
  const reset = () => { vibrate("light"); setText0(""); setRes(null); setSeen([]); setMarks({}); setMsg(""); setSub(""); if (taRef.current) taRef.current.focus(); };
  // есть ли ещё что показать, дешевле и что уточнить — по той же просьбе
  const more = React.useMemo(() => {
    if (!res || !res.picks || !res.picks.length) return { more: 0, cheaper: 0, refine: {} };
    const a = { ...somAsk(res.text, ctx), prio: new Set(rules.prio) };
    if (a.table && a.table.each) return { more: 0, cheaper: 0, refine: {} };
    const m = somShortlist(pool, a, { what: res.what, exclude: seen }).total;
    const cap = cheaperThan(res.picks, a.glass);
    const ch = cap ? somShortlist(pool, a, { what: res.what, below: cap }).total : 0;
    return { more: m, cheaper: ch, refine: refineAvail(pool, a, res.what, res.picks, seen) };
  }, [res, seen, pool, rules]);
  // «Гость взял / Не взял»: второе касание того же — снять отметку на экране (на сервере остаётся последняя)
  const mark = (p, ev) => {
    vibrate(ev === "taken" ? "success" : "light");
    setMarks((m) => ({ ...m, [keyOf(p)]: m[keyOf(p)] === ev ? "" : ev }));
    logSom(restaurant, ev, keyOf(p), res && res.dishIds, res && res.text, stats && stats.src).then((src) => {
      setStats((s) => { const raw = src === "local" ? statsFromLog(readLog(restaurant)) : s && s.raw; return raw ? { src, raw, idx: statsIndex(raw) } : s; });
      if (src === "server") loadStats(restaurant).then((s) => setStats({ ...s, idx: statsIndex(s.raw) }));
    });
  };
  // правила дома и «советуем первым» — запись в меню команды (как настройка карты бара)
  const saveRules = (next) => {
    if (!setShared) return Promise.resolve(false);
    const arr = withSomRules(shared, { ...rules, ...next, by: who, at: Date.now() });
    setSaveMsg("");
    return rpc("menu_set", { p_token: saToken(), p_restaurant: restaurant, p_dishes: JSON.stringify(arr) }).then((r) => {
      if (r && r.ok === true) { setShared(arr); rememberSharedMenu(restaurant, arr); return true; }
      setSaveMsg("Не сохранилось. Проверь связь и права"); vibrate("error"); return false;
    }).catch(() => { setSaveMsg("Нет связи"); vibrate("error"); return false; });
  };
  const togglePrio = (p) => { vibrate("light"); const k = keyOf(p), has2 = rules.prio.includes(k); saveRules({ prio: has2 ? rules.prio.filter((x) => x !== k) : [...rules.prio, k] }); };
  // вкус по шкалам через ИИ: у кого шкал нет — пачками по 20 (api/wine-import, mode "taste"); пометка «от ИИ» до проверки
  const noTaste = [...wines.map((w) => [WINE, w]), ...spirits.map((w) => [SPIRIT, w])].filter(([, w]) => !w.archived && !tasteN(w.taste, w.kind));
  const fillTaste = async () => {
    if (fill === "busy" || !noTaste.length || !setShared) return;
    vibrate("light"); setFill("busy");
    let arr = shared, got = 0;
    try {
      for (const K of [WINE, SPIRIT]) {
        const list = noTaste.filter(([k]) => k === K).map(([, w]) => w);
        for (let i = 0; i < list.length; i += 20) {
          const part = list.slice(i, i + 20);
          const r = await fetch("/api/wine-import", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token: saToken(), kind: K.kind, mode: "taste",
            items: part.map((w) => ({ name: w.name, producer: w.producer, country: w.country, region: w.region, grapes: w.grapes, color: w.color, sweet: w.sweet, cat: w.cat, style: w.style, age: w.age, abv: w.abv })) }) }).then((x) => x.json());
          for (const t of (r && r.tastes) || []) {
            const w = part[Number(t.i)], tt = w && normTaste({ ...t, ai: 1 }, K.kind);
            if (tt) { arr = K.withRec(arr, K.norm({ ...w, taste: tt })); got++; }
          }
        }
      }
      if (!got) { setFill("Шкалы не пришли: попробуй ещё раз или заполни в карточке руками."); return; }
      const r = await rpc("menu_set", { p_token: saToken(), p_restaurant: restaurant, p_dishes: JSON.stringify(arr) });
      if (r && r.ok === true) { setShared(arr); rememberSharedMenu(restaurant, arr); setFill("Готово: шкалы у " + got + " " + plural(got, "позиции", "позиций", "позиций") + ". Они помечены «от ИИ», проверь в карточках."); vibrate("success"); }
      else setFill("Не сохранилось. Проверь связь и права");
    } catch (e) { setFill("Нет связи с ИИ: функция /api/wine-import не ответила."); }
  };

  const busyN = busy ? Number(busy.split(":")[1]) || 0 : 0;
  const Pick = ({ p }) => {
    const K = p.kind === "spirit" ? SPIRIT : WINE;
    const k = keyOf(p), m = marks[k] || "", star = rules.prio.includes(k);
    const open = () => { vibrate("light"); onOpen(p.kind, p.id); };
    const share = onShareChat ? () => onShareChat(p.kind === "cocktail" ? cocktailShareItem(p.rec) : drinkShareItem(K, p.rec)) : null;
    const phr = { short: p.short || "", say: p.say || "", story: p.story || "" };
    const vOpts = [["short", "Коротко"], ["say", "Обычно"], ["story", "С историей"]].filter(([x]) => phr[x]);
    const v = vars[k] && phr[vars[k]] ? vars[k] : phr.say ? "say" : vOpts.length ? vOpts[0][0] : "";
    const serve = p.serveAi || p.serve || "";
    const pron = p.kind !== "cocktail" ? findPronounce(p.title + " " + (p.orig || ""), 1)[0] : null;
    return (
      <div data-som-pick={k} data-som-marked={m || undefined} data-lens-card="" style={{ ...T.modCard, display: "block", cursor: "default", padding: "12px 14px", margin: "0 0 10px" }}>
        <div data-som-open={k} onClick={open} {...onActivate(open)} style={{ cursor: "pointer" }}>
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            {p.kind === "cocktail" ? (Array.isArray(p.rec.color) ? <div aria-hidden="true" style={{ width: 38, height: 52, flexShrink: 0, display: "flex", alignItems: "flex-end", justifyContent: "center" }}><CocktailArt c={p.rec} w={38} light={a11y} showIce={false} /></div> : null)
              : <WineThumb w={p.rec} gold={gold} a11y={a11y} />}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ ...labelStyle(12), color: gold, marginBottom: 1 }}>{SOM_KIND_RU[p.kind]}{star ? " · советуем первым" : ""}</div>
              <div style={{ fontFamily: SERIF, fontSize: 16, color: ink, lineHeight: 1.28 }}>{p.title}</div>
              {p.orig ? <div style={{ fontFamily: SERIF, fontStyle: "italic", fontSize: 12.5, color: sub, lineHeight: 1.35 }}>{p.orig}</div> : null}
              {p.line ? <div style={{ fontSize: 12.5, color: sub, lineHeight: 1.4, marginTop: 2 }}>{p.line}</div> : null}
              {p.priceText ? <div data-som-price="" style={{ fontSize: 13, color: gold, lineHeight: 1.4, marginTop: 2 }}>{p.priceText}</div> : null}
            </div>
            <Chevron gold={gold} />
          </div>
          {p.taste ? <div data-som-taste=""><TasteBars t={p.taste} kind={p.kind} gold={gold} text={ink} sub={sub} compact /></div> : null}
          {p.why ? <div data-som-why="" style={{ fontSize: 13.5, color: ink, lineHeight: 1.5, marginTop: 9 }}><span style={{ ...labelStyle(13.5), color: gold }}>Почему: </span>{p.why}</div> : null}
        </div>
        {v ? <div data-som-say={v} style={{ fontFamily: SERIF, fontStyle: "italic", fontSize: 14, color: ink, lineHeight: 1.5, marginTop: 7, padding: "8px 11px", borderRadius: 10,
          background: a11y ? "rgba(139,106,48,0.07)" : "rgba(214,178,102,0.08)", borderLeft: `2px solid ${gold}99` }}>{"Гостю: «" + phr[v] + "»"}</div> : null}
        {vOpts.length > 1 ? <div role="group" aria-label="Фраза гостю" style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 6 }}>
          {vOpts.map(([x, label]) => <button key={x} type="button" className="sa-btn" data-som-var={x} aria-pressed={v === x} data-lens-btn={v === x ? "tab" : "soft"} data-lens-ink=""
            onClick={() => { vibrate("light"); setVars((s) => ({ ...s, [k]: x })); }} style={small(v === x)}>{label}</button>)}
        </div> : null}
        {serve ? <div data-som-serve="" style={{ fontSize: 13, color: ink, lineHeight: 1.5, marginTop: 8 }}><span style={{ ...labelStyle(13), color: gold }}>Подача: </span>{serve}</div> : null}
        {pron ? <div data-som-name={stressText(pron.w)} style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", fontSize: 13, color: ink, lineHeight: 1.5, marginTop: 4 }}>
          <span><span style={{ ...labelStyle(13), color: gold }}>Как сказать: </span>{stressText(pron.w)}</span>
          {canSpeak() ? <button type="button" className="sa-btn" data-som-listen="" data-lens-btn="soft" data-lens-ink="" onClick={() => { vibrate("light"); speakText(plainText(pron.w), { cancelBefore: true, rate: 0.9 }); }} style={small(false)}>Послушать</button> : null}
        </div> : null}
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 10, alignItems: "center" }}>
          <button type="button" className="sa-btn" data-som-mark="taken" aria-pressed={m === "taken"} data-lens-btn={m === "taken" ? "tab" : "soft"} data-lens-ink="" onClick={() => mark(p, "taken")} style={small(m === "taken")}>{m === "taken" ? "Гость взял ✓" : "Гость взял"}</button>
          <button type="button" className="sa-btn" data-som-mark="declined" aria-pressed={m === "declined"} data-lens-btn={m === "declined" ? "tab" : "soft"} data-lens-ink="" onClick={() => mark(p, "declined")} style={small(m === "declined")}>{m === "declined" ? "Не взял ✓" : "Не взял"}</button>
        </div>
        {share || (edit && setShared) ? <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8, alignItems: "center" }}>
          {share ? <ShareChat id={k} onClick={share} gold={gold} text={ink} /> : null}
          {edit && setShared ? <button type="button" className="sa-btn" data-som-prio={star ? "on" : "off"} aria-pressed={star} aria-label={star ? "Советуем первым: снять" : "Советовать первым"} data-lens-btn={star ? "tab" : "soft"} data-lens-ink=""
            onClick={() => togglePrio(p)} style={small(star)}>{star ? "★ Первым" : "☆ Первым"}</button> : null}
        </div> : null}
      </div>);
  };
  const subRow = (key, items, multi = false) => (
    <div role="group" aria-label={key === "dish" ? "К блюду" : key === "table" ? "На стол" : key === "budget" ? "Бюджет" : "Похоже на"} data-som-sub={key} style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8, padding: "8px 0 0", borderTop: `1px dashed ${gold}33` }}>
      {items.map(([label, phrase, sel0, act]) => { const sel = sel0 != null ? sel0 : new RegExp("(^|,\\s*)" + phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "(\\s*,|$)", "i").test(text);
        return <button key={phrase} type="button" className="sa-btn" data-som-opt={phrase} aria-pressed={sel} data-lens-btn={sel ? "tab" : "soft"} data-lens-ink="" onClick={act || (() => { toggle(key, phrase); if (!sel && !multi) setSub(""); })} style={chip(sel)}>{label}</button>; })}
    </div>);
  const tableRow = () => subRow("table", [
    ...dishOpts.map((d) => [cutName(d.name), "стол:" + d.name, tNames.includes(d.name), () => { vibrate("light"); const n = tNames.includes(d.name) ? tNames.filter((x) => x !== d.name) : [...tNames, d.name].slice(0, 4); setText(withTable(text, n, tEach), false); }]),
    ["Одна бутылка на всех", "стол:one", tNames.length > 1 && !tEach, () => { vibrate("light"); setText(withTable(text, tNames, false), false); }],
    ["Бокал к каждому", "стол:each", tNames.length > 1 && tEach, () => { vibrate("light"); setText(withTable(text, tNames, true), false); }],
  ], true);
  const quick = [
    dishOpts.length ? ["dish", "К блюду", on.dish, () => { vibrate("light"); setSub((s) => (s === "dish" ? "" : "dish")); }] : null,
    dishOpts.length > 1 ? ["table", "На стол", tNames.length > 0, () => { vibrate("light"); setSub((s) => (s === "table" ? "" : "table")); }] : null,
    glassOk ? ["glass", "Бокалом", on.glass, () => toggle("glass", "бокалом")] : null,
    steps ? ["budget", "Бюджет", on.budget, () => { vibrate("light"); setSub((s) => (s === "budget" ? "" : "budget")); }] : null,
    kinds.includes("wine") && has.wine ? ["like", "Похоже на…", on.like, () => { vibrate("light"); setSub((s) => (s === "like" ? "" : "like")); }] : null,
    ...SOM_OCC.map(([k, label]) => ["occ-" + k, label, text.toLowerCase().includes(label.toLowerCase()), () => toggle("occasion", label.toLowerCase())]),
  ].filter(Boolean);
  // уточнение: кнопка ставит фразу и сразу подбирает
  const clarGo = (phrase) => { const t2 = tidy((text ? text + ", " : "") + phrase); setText(t2); run("new", "", t2); };
  const clarGroups = res && res.mode === "clarify" ? [
    kinds.includes("wine") && has.wine ? ["Какое вино?", [["Белое", "белое"], ["Красное", "красное"], ["Розовое", "розовое"], ["Игристое", "игристое"]]] : null,
    ["По вкусу?", [["Лёгкое", "лёгкое"], ["Насыщенное", "насыщенное"]]],
    steps ? ["Бюджет?", [0, 1, 2].map((i) => [budgetPhrase(i, steps), budgetPhrase(i, steps)])] : null,
    ["Повод?", [["Аперитив", "аперитив"], ["К десерту", "к десерту"], ["Дижестив", "дижестив"]]],
  ].filter(Boolean) : [];
  const leftN = res && typeof res.remaining === "number" && res.remaining >= 0 ? res.remaining : -1;
  const label = !res ? "" : res.mode === "ai" ? (res.how === "cheaper" ? "Подешевле" : res.how === "more" ? "Ещё варианты" : res.how === "refine" ? REFINE_LABEL[res.refKey] || "Сомелье советует" : "Сомелье советует") : "Ближе всего по карте";
  const groupsOf = (picks) => (res && res.table && res.table.each ? res.table.dishes.map((d, i) => ({ d, i, picks: picks.filter((p) => p.dish === i + 1) })) : [{ d: null, i: 0, picks }]);
  const st = stats && stats.raw;
  const titleOf = (k) => { const c = pool.find((x) => keyOf(x) === k); return c ? c.title : ""; };
  const top = st ? (st.items || []).filter((x) => x.taken > 0 && titleOf(x.item)).slice(0, 4).map((x) => titleOf(x.item) + " (" + x.taken + ")") : [];
  const tasteHave = wines.filter((w) => !w.archived).length + spirits.filter((w) => !w.archived).length - noTaste.length;
  return (
    <div style={T.screen} className="sa-screen" data-som={what}>
      <div style={{ padding: "16px 16px 6px", display: "flex", alignItems: "center", gap: 10 }}>
        <button className="sa-btn" data-lens="back" onClick={onBack} {...onActivate(onBack)} aria-label="Назад" style={{ border: "none", background: "transparent", color: gold, fontSize: 21, cursor: "pointer", padding: "4px 8px 4px 0" }}>‹</button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ ...labelStyle(13.5), color: gold }}>Барная карта · Наставник</div>
          <div style={{ fontFamily: SERIF, fontSize: 21, color: ink, lineHeight: 1.15 }}>Сомелье</div>
        </div>
      </div>
      <div style={{ padding: "0 16px 140px" }}>
        <div style={{ fontSize: 13.5, color: sub, lineHeight: 1.5, margin: "2px 2px 12px" }}>Напиши или скажи, что хочет гость. Подберу 2–3 позиции только из нашей карты: не из стопа и в бюджете.</div>
        {whats.length > 1 ? (
          <div role="group" aria-label="Что подобрать" data-som-whats={whats.join(",")} style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
            {whats.map((k) => <button key={k} type="button" className="sa-btn" data-som-what={k} aria-pressed={what === k} data-lens-btn={what === k ? "tab" : "soft"} data-lens-ink=""
              onClick={() => { vibrate("light"); setWhat(k); }} style={chip(what === k)}>{(SOM_WHAT.find(([x]) => x === k) || [])[1]}</button>)}
          </div>) : null}
        <div data-lens-card="" onClick={() => taRef.current && taRef.current.focus()} style={{ ...T.modCard, display: "flex", alignItems: "flex-end", gap: 8, padding: "8px 8px 8px 13px", margin: 0, cursor: "text" }}>
          <textarea ref={taRef} data-som-text="" rows={2} value={text} maxLength={300} aria-label="Что хочет гость" placeholder={"Например: к рибаю, сухое красное, до 5 000"}
            onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); run("new"); } }}
            style={{ flex: 1, minWidth: 0, resize: "none", border: "none", outline: "none", background: "transparent", color: ink, fontFamily: SERIF, fontSize: 15.5, lineHeight: 1.45, padding: "4px 0", minHeight: 46 }} />
          <MicButton a11y={a11y} size={38} sttUrl={SUPABASE_URL + "/functions/v1/stt"} headers={H()} onText={(x) => { const a = String(textRef.current || "").trim(), b = String(x || "").trim(); setText((a && b ? a + " " + b : a || b).slice(0, 300)); }} onError={(m) => setMsg(m)} />
        </div>
        <div role="group" aria-label="Быстрые просьбы" data-som-chips="" style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 10 }}>
          {quick.map(([k, lab, sel, act]) => <button key={k} type="button" className="sa-btn" data-som-chip={k} aria-pressed={!!sel} aria-expanded={k === "dish" || k === "table" || k === "budget" || k === "like" ? sub2 === k : undefined}
            data-lens-btn={sel || sub2 === k ? "tab" : "soft"} data-lens-ink="" onClick={act} style={chip(sel || sub2 === k)}>{lab}</button>)}
        </div>
        {sub2 === "dish" ? subRow("dish", dishOpts.map((d) => [cutName(d.name), "к «" + d.name + "»"])) : null}
        {sub2 === "table" ? tableRow() : null}
        {sub2 === "budget" && steps ? subRow("budget", [0, 1, 2].map((i) => [budgetPhrase(i, steps), budgetPhrase(i, steps)])) : null}
        {sub2 === "like" ? subRow("like", likeOpts.map((nm) => [nm, "похоже на " + nm])) : null}
        <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
          <button type="button" className="sa-btn" data-lens-btn="main" data-som-go="" onClick={() => run("new")} disabled={!!busy} style={{ ...btn(true), opacity: busy ? 0.65 : 1 }}>{busy && busy.startsWith("new") ? "Подбираю…" : "Подобрать"}</button>
          {text || res ? <button type="button" className="sa-btn" data-lens-btn="soft" data-lens-ink="" data-som-new="" onClick={reset} disabled={!!busy} style={btn(false)}>Заново</button> : null}
        </div>
        {msg ? <div role="status" data-som-msg="" style={{ fontSize: 13, color: red, lineHeight: 1.5, margin: "10px 2px 0" }}>{msg}</div> : null}
        {busy ? <div role="status" data-som-busy={busyN} style={{ fontSize: 13, color: gold, lineHeight: 1.5, margin: "12px 2px 0" }}>{"Наставник выбирает из " + posWord(busyN) + " нашей карты…"}</div> : null}
        {res && res.mode === "clarify" && !busy ? (
          <div data-som-clar="" data-lens-card="" style={{ ...T.modCard, display: "block", cursor: "default", padding: "12px 14px", marginTop: 16 }}>
            <div style={{ fontFamily: SERIF, fontSize: 15.5, color: ink, lineHeight: 1.35 }}>Уточню, чтобы попасть точнее</div>
            <div style={{ fontSize: 12.5, color: sub, lineHeight: 1.45, marginTop: 2 }}>Одно касание, и сразу подберу. Можно и без уточнения.</div>
            {clarGroups.map(([q, opts]) => (
              <div key={q} style={{ marginTop: 10 }}>
                <div style={{ ...labelStyle(13), color: gold, marginBottom: 6 }}>{q}</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>{opts.map(([lab, ph]) => <button key={ph} type="button" className="sa-btn" data-som-clar-opt={ph} data-lens-btn="soft" data-lens-ink="" onClick={() => clarGo(ph)} style={chip(false)}>{lab}</button>)}</div>
              </div>))}
            <button type="button" className="sa-btn" data-som-clar-go="" data-lens-btn="soft" data-lens-ink="" onClick={() => run("new", "", text)} style={{ ...btn(false), marginTop: 12 }}>Подобрать как есть</button>
          </div>) : null}
        {res && res.mode !== "clarify" && !busy ? (
          <div data-som-res={res.mode} data-som-n={res.picks.length} data-som-at={res.at || 0} style={{ marginTop: 18 }}>
            {res.mode === "none" ? <div data-som-none="" data-lens-card="" style={{ ...T.modCard, display: "block", cursor: "default", padding: "12px 14px", fontSize: 14, color: ink, lineHeight: 1.5 }}>{res.none}</div> : <>
              <div data-som-label="" style={{ ...labelStyle(14), color: gold, margin: "0 2px 8px" }}>{label}</div>
              {res.mode === "local" ? <div data-som-err={res.err || ""} style={{ fontSize: 12.5, color: sub, lineHeight: 1.5, margin: "0 2px 10px" }}>
                {res.err === "none" && res.note ? <span data-som-note="">{"Наставник: «" + res.note + "» "}</span> : null}{LOCAL_WHY[res.err] || LOCAL_ANY}</div> : null}
              {groupsOf(res.picks).map((g) => <React.Fragment key={g.i}>
                {g.d ? <div data-som-group={g.i + 1} style={{ fontFamily: SERIF, fontSize: 14.5, color: ink, margin: "6px 2px 8px" }}>{"К «" + g.d.name + "»"}</div> : null}
                {g.picks.map((p) => <Pick key={keyOf(p)} p={p} />)}
              </React.Fragment>)}
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 4 }}>
                {more.more ? <button type="button" className="sa-btn" data-lens-btn="soft" data-lens-ink="" data-som-more={more.more} onClick={() => run("more")} style={btn(false)}>Ещё варианты</button> : null}
                {more.cheaper ? <button type="button" className="sa-btn" data-lens-btn="soft" data-lens-ink="" data-som-cheaper={more.cheaper} onClick={() => run("cheaper")} style={btn(false)}>Подешевле</button> : null}
              </div>
              {SOM_REFINE.some(([k]) => more.refine[k]) ? <div role="group" aria-label="Уточнить" data-som-refines="" style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 10 }}>
                {SOM_REFINE.filter(([k]) => more.refine[k]).map(([k, lab]) => <button key={k} type="button" className="sa-btn" data-som-refine={k} data-lens-btn="soft" data-lens-ink="" onClick={() => run("refine", k)} style={chip(false)}>{lab}</button>)}
              </div> : null}
            </>}
            <div data-som-foot="" style={{ fontSize: 12.5, color: sub, lineHeight: 1.5, margin: "12px 2px 0" }}>
              {"Под просьбу в нашей карте: " + posWord(res.total) + ". Стоп и архив не предлагаю."}
              {leftN >= 0 ? <span data-som-left={leftN}>{" У Наставника сегодня осталось " + leftN + " " + plural(leftN, "вопрос", "вопроса", "вопросов") + ": подбор считается как вопрос."}</span> : null}
            </div>
          </div>) : null}
        {/* правила дома: руководитель пишет, остальные видят; итог «взяли / не взяли»; вкус по шкалам через ИИ */}
        {edit && setShared ? (
          <div data-som-admin="" data-lens-card="" style={{ ...T.modCard, display: "block", cursor: "default", padding: "12px 14px", marginTop: 22 }}>
            <div style={{ fontFamily: SERIF, fontSize: 15.5, color: ink }}>Настройка сомелье</div>
            <div style={{ ...labelStyle(13), color: gold, margin: "10px 0 4px" }}>Как у нас принято</div>
            {rulesEdit == null ? <>
              <div data-som-rules-view="" style={{ fontSize: 13.5, color: rules.text ? ink : sub, lineHeight: 1.5, whiteSpace: "pre-wrap" }}>{rules.text || "Правил пока нет. Например: «К стейкам сначала Мальбек», «Бароло бокалом не продаём», «На этой неделе советуем Гави»."}</div>
              <button type="button" className="sa-btn" data-som-rules-open="" data-lens-btn="soft" data-lens-ink="" onClick={() => { vibrate("light"); setRulesEdit(rules.text); setSaveMsg(""); }} style={{ ...small(false), marginTop: 8 }}>{rules.text ? "Изменить" : "Написать правила"}</button>
            </> : <>
              <textarea data-som-rules-text="" rows={4} maxLength={800} value={rulesEdit} onChange={(e) => setRulesEdit(e.target.value)} placeholder="Каждое правило с новой строки"
                style={{ width: "100%", boxSizing: "border-box", resize: "vertical", padding: "9px 11px", borderRadius: 12, border: `1px solid ${gold}55`, background: "transparent", color: ink, fontFamily: SERIF, fontSize: 14, lineHeight: 1.45, outline: "none" }} />
              <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                <button type="button" className="sa-btn" data-som-rules-save="" data-lens-btn="main" onClick={() => { vibrate("light"); saveRules({ text: rulesEdit }).then((x) => { if (x) { setRulesEdit(null); setSaveMsg("Сохранено: сомелье учтёт правила у всех"); } }); }} style={btn(true)}>Сохранить</button>
                <button type="button" className="sa-btn" data-lens-btn="soft" data-lens-ink="" onClick={() => setRulesEdit(null)} style={btn(false)}>Отмена</button>
              </div>
            </>}
            {saveMsg ? <div role="status" data-som-rules-msg="" style={{ fontSize: 12.5, color: /^Сохранено/.test(saveMsg) ? ok : red, marginTop: 6 }}>{saveMsg}</div> : null}
            <div style={{ fontSize: 12.5, color: sub, lineHeight: 1.45, marginTop: 8 }}>{"Советуем первым: " + (rules.prio.length ? rules.prio.map(titleOf).filter(Boolean).join(", ") : "пока никого") + ". Отметка: «☆ Первым» в карточке подбора."}</div>
            <div style={{ ...labelStyle(13), color: gold, margin: "12px 0 4px" }}>Что берут гости</div>
            <div data-som-stats={stats ? stats.src : "wait"} style={{ fontSize: 13.5, color: ink, lineHeight: 1.5 }}>
              {!st ? "Загружаю…" : st.runs || st.taken || st.declined ? "За 90 дней: подборов " + st.runs + ", гости взяли " + st.taken + ", не взяли " + st.declined + "." + (top.length ? " Чаще всего берут: " + top.join(", ") + "." : "")
                : "Пока нет отметок. Официант отмечает в подборе «Гость взял» или «Не взял», и сомелье поднимает выше то, что у вас берут."}
              {stats && stats.src === "local" ? <div style={{ fontSize: 12.5, color: sub, marginTop: 4 }}>Этап 47 на сервере не запущен: сомелье учится только на этом телефоне (supabase-stage47-sommelier.sql).</div> : null}
            </div>
            <div style={{ ...labelStyle(13), color: gold, margin: "12px 0 4px" }}>Вкус по шкалам</div>
            <div data-som-taste-n={tasteHave} style={{ fontSize: 13.5, color: ink, lineHeight: 1.5 }}>{"Есть у " + tasteHave + " из " + (tasteHave + noTaste.length) + ". По шкалам (тело, кислотность, танины, сладость, дуб) сомелье подбирает пару точнее, даже без ИИ."}</div>
            {noTaste.length ? <button type="button" className="sa-btn" data-som-taste-fill="" data-lens-btn="soft" data-lens-ink="" onClick={fillTaste} disabled={fill === "busy"} style={{ ...small(false), marginTop: 8 }}>{fill === "busy" ? "ИИ заполняет…" : "Заполнить через ИИ: " + noTaste.length}</button> : null}
            {fill && fill !== "busy" ? <div role="status" data-som-taste-msg="" style={{ fontSize: 12.5, color: /^Готово/.test(fill) ? ok : red, lineHeight: 1.45, marginTop: 6 }}>{fill}</div> : null}
          </div>) : rules.text ? (
          <div data-som-rules-view="" data-lens-card="" style={{ ...T.modCard, display: "block", cursor: "default", padding: "12px 14px", marginTop: 22 }}>
            <div style={{ ...labelStyle(13), color: gold, marginBottom: 4 }}>Как у нас принято</div>
            <div style={{ fontSize: 13.5, color: ink, lineHeight: 1.5, whiteSpace: "pre-wrap" }}>{rules.text}</div>
          </div>) : null}
      </div>
    </div>);
}
