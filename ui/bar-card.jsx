// ui/bar-card.jsx — v127 (Доп. 440): «Барная карта» — коктейли, вина и крепкое нашего бара под одной кнопкой.
//
// Владелец (01.11): «стоит ли сделать одну общую кнопку «Барное меню» или «Барная карта», и закинуть туда вина, коктейли,
// крепыш?», «Общая карта, вина и крепкое» и «Да, делаем». В Справочнике вместо «Нашей винной карты» и «Бар: коктейли» —
// одна «Барная карта». Наверху вкладки «Коктейли · Вина · Крепкое»; открывается та, где был в прошлый раз. Вина и крепкое —
// общий экран (ui/wine-list.jsx: список, карточка, тренировка; руководителю — редактор); коктейли — список нашего бара по
// основе, внизу — какое крепкое из нашей карты в нём; учить — «Колода бармена» и «Бар-лаборатория», как раньше.
// v128 (Доп. 441), владелец: «как мы барную карту можем сделать удобнее, проще, и красивее?» — «Делаем все». Шапка не
// уезжает (ui/bar-pin.jsx: вкладки, разделы, поиск, «наверх»); у каждого коктейля — маленький бокал в его цвете (та же
// отрисовка, что в колоде, ui/cocktail-art.jsx).
// Затем владелец: «Заходя в коктейли, нажимая на колонку, появляется тот же список. Делаешь лишние движения» — «Да,
// давай». Колода и лаборатория — две кнопки рядом, по касанию сразу туда. Касание коктейля открывает его карточку здесь же:
// бокал, состав с граммовкой, как готовить, подача, история, крепкое из нашей карты; «Учить в колоде» и «Собрать руками»;
// карточки листаются подряд; «назад» — в то же место списка. Крепкое в коктейле и коктейль в крепком открывают друг друга,
// «назад» возвращает в ту карточку, откуда пришёл.
// v129 (Доп. 442), владелец: «Что бы человек зайдя в неё не заблудился и все было интуитивно понятно?» — «Давай все».
// Каждая вкладка помнит раздел, поиск и место в списке; поиск во вкладке находит и в других («Нашлось во вкладке «Вина»»);
// в карточке, открытой из другой, сверху «Из карточки Campari»; строка «Учить» — одна во всех вкладках (ui/bar-kit.jsx).
// v130 (Доп. 443), владелец: «Давай в барную карту добавим возможность распечатать информацию. Имею ввиду, как в меню» —
// «Да, давай все». «Печать» в строке под вкладками открывает «Барную карту для печати» (ui/bar-print.jsx): вкладка, откуда
// пришёл, и то, что на ней было показано. И «Поделиться в чат» в карточках: «вина и крепкие не имеют такой возможности».
// v136 (Доп. 449), владелец (04.11): «Как думаешь, ещё удобнее и красивее барную карту можно сделать?» — «Давай все» (кроме
// «карты сразу на первом экране»: «пока не будем делать»). Коктейли: что из нашей карты — в той же строке, что метод и бокал
// («шейк · купе · Hendrick's»), строка вдвое короче; в карточке «Как готовить» свёрнуто (состав уже сверху); порядок
// «Разделы · А–Я» и «Подробно · Кратко»; «★ советуем» и раздел «Советуем»; у основы — цветная точка.
import React from "react";
import { useGoToday } from "../lib/use-go-today";   // v141
import { GOLD, labelStyle } from "./tokens";
import { onActivate, vibrate } from "../lib/utils";
import { WineListScreen, useTeamMenu, canEditWines, useInnerTop } from "./wine-list";
import { ourCocktails, findCocktails, groupByBase, cocktailsWord, GLASS_SHORT, cocktailBase } from "../lib/bar-card";
import { COCKTAILS } from "../data/cocktails";
import { COCKTAIL_STORIES } from "../data/cocktail-stories";
import { isFullCocktail } from "../lib/deck-extras";
import { buildScenario, GLASS_RU, GARNISH_RU } from "../lib/bar-lab";
import { wineRecords } from "../lib/wine";
import { spiritRecords, spiritTitle } from "../lib/spirit";
import { cocktailSpirits } from "../lib/spirit-cocktails";
import { GAME_SVG, BUILD_SVG } from "./icons";
import { CocktailArt } from "./cocktail-art";
import { Sign } from "./signs";
import { usePin, BarPin, scrollToEl, focusSearch, toTop, useBackToRow, stepsOf, PrevNext, showActiveChip } from "./bar-pin";
import { SearchField, FilterNote, EndNote, Elsewhere, LearnStrip, Chevron, useSwipe, useSection, useKeepScroll, BarHint, PrintLink, ShareChat,
  Dot, useListPref, ViewBar, PrioToggle } from "./bar-kit";   // v129; v130 — печать и «в чат»; v136 — точки, вид списка, «Советуем»
import { BarPrint } from "./bar-print";   // v130
import { BarSommelier, SomEntry } from "./bar-sommelier";   // v131: «Сомелье»
import { cocktailShareItem } from "../lib/share-items";   // v130: «Поделиться в чат» и из карточки коктейля здесь
import { WINE, SPIRIT, drinkOf } from "../lib/drinks";
import { titleParts, dotOf, sortItems } from "../lib/bar-view";
import { readSomRules, withSomRules } from "../lib/sommelier";   // v136: «Советуем» у коктейлей — та же отметка, что в «Сомелье»
import { rpc, saToken } from "../api/supabase";
import { rememberSharedMenu } from "../lib/reference-context";

const SERIF = "Georgia, 'Times New Roman', serif";
const TAB_KEY = "sa_bar_tab";
const TABS = [["cocktail", "Коктейли"], ["wine", "Вина"], ["spirit", "Крепкое"]];
const readTab = () => { try { return localStorage.getItem(TAB_KEY) || ""; } catch (e) { return ""; } };
const saveTab = (t) => { try { localStorage.setItem(TAB_KEY, t); } catch (e) {} };

// startTab + startId — открыть карточку (вина, крепкого; со startTab "cocktail" — коктейля); note — строка под её заголовком
export function BarCardScreen({ T, a11y, profile, onBack, onEdit, startTab = null, startId = null, note = "", onOpenCocktail = null, onBuildCocktail = null, onCocktailDeck = null, onBarLab = null, onCocktailEdit = null, onShareChat = null }) {
  const gold = a11y ? "#7A5D2A" : GOLD, text = T.modTitle.color, sub = T.modSub.color;
  const restaurant = (profile && profile.restaurant) || "";
  const edit = canEditWines(profile) && !!onEdit;
  const team = useTeamMenu(restaurant);
  const shared = team[0];
  const cocktails = React.useMemo(() => ourCocktails(shared), [shared]);
  const wines = React.useMemo(() => wineRecords(shared).filter((w) => !w.archived), [shared]);
  const winesN = wines.length;
  const spirits = React.useMemo(() => spiritRecords(shared).filter((w) => !w.archived), [shared]);
  // вкладки: коктейли — всегда; вина и крепкое — когда в карте есть, руководителю — всегда (чтобы было куда добавить)
  const avail = TABS.filter(([k]) => k === "cocktail" ? cocktails.length > 0 : k === "wine" ? winesN > 0 || edit : spirits.length > 0 || edit).map(([k]) => k);
  // v128: какую карточку открыть на вкладке. back — откуда пришёл (карточка другой вкладки), туда вернёт «назад»
  const tabOf = (id) => (!id ? null : startTab === "cocktail" ? "cocktail" : String(id).startsWith("sp-") ? "spirit" : "wine");
  const [start, setStart] = React.useState(() => ({ tab: tabOf(startId), id: startId || null, back: null }));
  const first = () => {
    if (startTab && avail.includes(startTab)) return startTab;
    if (start.tab) return start.tab;
    const r = readTab(); return avail.includes(r) ? r : avail[0] || "cocktail";
  };
  const [tab, setTab0] = React.useState(first);
  const cur = avail.includes(tab) ? tab : avail[0] || "cocktail";
  // v129: каждая вкладка помнит раздел, поиск, подбор и место в списке, пока ты в «Барной карте» (вкладка сама отдаёт и берёт)
  const mem = React.useRef({});
  const keepOf = (k) => mem.current[k] || null;
  const onKeepOf = (k) => (st) => { mem.current[k] = { ...(mem.current[k] || {}), ...st }; };
  const setTab = (k, pin = false) => {
    if (k === cur) { if (pin) toTop(); return; }   // своя вкладка из копии сверху — к началу
    setTab0(k); setStart({ tab: null, id: null, back: null }); vibrate("light");
  };
  const openIn = (k, id, back) => { setStart({ tab: k, id, back }); setTab0(k); };
  const jump = (k) => (id, from) => openIn(k, id, from ? { tab: cur, id: from, back: start.tab === cur ? start.back : null } : null);
  // v131: карточку открыли из «Сомелье» — «назад» возвращает к подбору (он помнит просьбу и ответ)
  const backFor = (k) => (start.tab === k && start.back ? () => { vibrate("light"); if (start.back.som) { setStart({ tab: null, id: null, back: null }); setSom(true); return; } openIn(start.back.tab, start.back.id, start.back.back); } : null);
  const startFor = (k) => (start.tab === k ? start.id : null);
  // v129: поиск во вкладке смотрит всю карту — что нашлось в других вкладках (по три, и сколько всего)
  const others = (q, except) => {
    const t = String(q || "").trim(); if (t.length < 2) return [];
    const out = [];
    const add = (k, label, list, row) => { if (k !== except && avail.includes(k) && list.length) out.push({ tab: k, label, n: list.length, items: list.slice(0, 3).map(row) }); };
    add("cocktail", "Коктейли", findCocktails(cocktails, t), (c) => ({ id: c.id, title: c.name, sub: [c.method, GLASS_SHORT[c.glass] || ""].filter(Boolean).join(" · ") }));
    add("wine", "Вина", WINE.find(wines, t), (w) => ({ id: w.id, title: titleParts(WINE, w).main, sub: [WINE.line(w), WINE.price(w)].filter(Boolean).join(" · ") }));
    add("spirit", "Крепкое", SPIRIT.find(spirits, t), (w) => ({ id: w.id, title: titleParts(SPIRIT, w).main, sub: [SPIRIT.line(w), SPIRIT.price(w)].filter(Boolean).join(" · ") }));
    return out;
  };
  const onOther = (k, id, q) => { vibrate("light"); openIn(k, id, { tab: cur, id: null, q, back: null }); };   // «назад» — в поиск этой вкладки
  const onSearchIn = (k, q) => { vibrate("light"); mem.current[k] = { ...(mem.current[k] || {}), q, only: "all", pick: { b: 0, s: "" }, scroll: 0 }; setStart({ tab: null, id: null, back: null }); setTab0(k); };
  // v129: откуда пришёл — сверху карточки вместо «Барная карта · …»: туда и вернёт «назад»
  const nameOf = (k, id) => {
    if (k === "cocktail") { const x = cocktails.find((c) => c.id === id); return x ? x.name : ""; }
    const x = (k === "wine" ? wines : spirits).find((w) => w.id === id);
    return x ? titleParts(drinkOf(k), x).main : "";
  };
  const fromFor = (k) => {
    if (start.tab !== k || !start.back) return "";
    const b = start.back;
    if (b.som) return "Из подбора Сомелье";
    if (b.id) { const n = nameOf(b.tab, b.id); return n ? "Из карточки " + n : ""; }
    return b.q ? "Из поиска «" + b.q + "»" : "";
  };
  React.useEffect(() => { saveTab(cur); }, [cur]);   // вернулся из редактора или колоды — та же вкладка
  // v130: лист для печати — вместо вкладок; «назад» — в ту же вкладку, на то же место (вкладка помнит)
  const [print, setPrint] = React.useState(null);
  // v131 (Доп. 444): «Сомелье» — вместо вкладок, как печать; просьба и ответ живут, пока ты в «Барной карте»
  const [som, setSom] = React.useState(false);
  const somMem = React.useRef(null);
  const somRow = cocktails.length + wines.length + spirits.length >= 2 ? <SomEntry T={T} a11y={a11y} onClick={() => setSom(true)} /> : null;
  // v128: вкладки — и в копии шапки сверху (ui/bar-pin.jsx); у копии свои метки, чтобы не путать с вкладками на месте
  const tabBar = (pin) => (avail.length > 1 ? (
    <div role="tablist" aria-label="Барная карта" id={pin ? undefined : "sa-bar-tabs"} data-bar-tabs={pin ? undefined : avail.join(",")} data-bar-pin-tabs={pin ? avail.join(",") : undefined} data-lens-seg="flat"
      style={{ display: "flex", gap: 4, margin: pin ? 0 : "2px 16px 12px", padding: 3, borderRadius: 999,
        border: `1px solid ${a11y ? "rgba(139,106,48,0.35)" : "rgba(214,178,102,0.35)"}`, background: a11y ? "rgba(255,255,255,0.45)" : "rgba(255,248,230,0.05)" }}>
      {TABS.filter(([k]) => avail.includes(k)).map(([k, t]) => {
        const on = cur === k;
        return <button key={k} type="button" role="tab" aria-selected={on} aria-pressed={on} data-bar-tab={pin ? undefined : k} data-bar-pin-tab={pin ? k : undefined} data-lens-btn={on ? "tab" : undefined}
          onClick={() => setTab(k, pin)} style={{ flex: 1, padding: pin ? "6px 6px" : "8px 6px", borderRadius: 999, border: "none", cursor: "pointer", fontFamily: SERIF, fontSize: pin ? 13.5 : 14, whiteSpace: "nowrap",
            background: on ? `linear-gradient(180deg,#E4C88C,${gold})` : "transparent", color: on ? "#1a160f" : sub, fontWeight: on ? "bold" : "normal" }}>{t}</button>;
      })}
    </div>) : null);
  const tabs = tabBar(false), pinTabs = tabBar(true);

  if (print) return <BarPrint T={T} a11y={a11y} restaurant={restaurant} cocktails={cocktails} wines={wines} spirits={spirits} start={print} onBack={() => { vibrate("light"); setPrint(null); }} />;
  if (som) return <BarSommelier T={T} a11y={a11y} restaurant={restaurant} cocktails={cocktails} wines={wines} spirits={spirits} start={cur === "cocktail" ? "all" : cur}
    keep={somMem.current} onKeep={(st) => { somMem.current = st; }} onBack={() => { vibrate("light"); setSom(false); }} onShareChat={onShareChat}
    team={team} edit={canEditWines(profile)} who={profile ? [profile.name, profile.surname].filter(Boolean).join(" ") : ""}
    onOpen={(k, id) => { setSom(false); openIn(k, id, { som: true }); }} />;
  if (cur === "wine" || cur === "spirit") return (
    <WineListScreen key={cur} kind={cur} T={T} a11y={a11y} profile={profile} onBack={onBack} team={team} tabs={tabs} pinTabs={pinTabs} som={somRow} listTitle="Барная карта"
      startId={startFor(cur)} cardBack={backFor(cur)} note={startFor(cur) && startFor(cur) === startId ? note : ""}
      onEdit={onEdit ? (id) => onEdit(cur, id) : undefined} cocktails={cocktails} onOpenCocktail={cocktails.length ? jump("cocktail") : null}
      keep={keepOf(cur)} onKeep={onKeepOf(cur)} others={others} onOther={onOther} onSearchIn={onSearchIn} fromText={fromFor(cur)} onPrint={setPrint} onShareChat={onShareChat} />);
  return <BarCocktails T={T} a11y={a11y} gold={gold} text={text} sub={sub} restaurant={restaurant} cocktails={cocktails} spirits={spirits} tabs={tabs} pinTabs={pinTabs} som={somRow} onBack={onBack}
    startId={startFor("cocktail")} cardBack={backFor("cocktail")} onOpenSpirit={avail.includes("spirit") ? jump("spirit") : null}
    keep={keepOf("cocktail")} onKeep={onKeepOf("cocktail")} others={others} onOther={onOther} onSearchIn={onSearchIn} fromText={fromFor("cocktail")} onPrint={setPrint} onShareChat={onShareChat}
    onLearn={onOpenCocktail} onBuild={onBuildCocktail} onCocktailDeck={onCocktailDeck} onBarLab={onBarLab} onCocktailEdit={edit ? onCocktailEdit : null}
    team={team} lead={canEditWines(profile)} who={profile ? [profile.name, profile.surname].filter(Boolean).join(" ") : ""} />;
}

// ─────────────────────────────── КОКТЕЙЛИ НАШЕГО БАРА
const SR_KEY = "sa_cocktail_sr";   // «Знаю?» колоды бармена (ui/cocktails.jsx)
const knownOf = (list) => { try { const sr = JSON.parse(localStorage.getItem(SR_KEY) || "{}"), now = Date.now(); return list.filter((c) => { const r = sr[c.id]; return r && r.stage > 0 && r.due > now; }).length; } catch (e) { return 0; } };
const dots = (n) => "●".repeat(n) + "○".repeat(Math.max(0, 4 - n));
// v136: «шаг, шага, шагов»
const stepsWord = (n) => { const m10 = n % 10, m100 = n % 100; return n + " " + (m10 === 1 && m100 !== 11 ? "шаг" : m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20) ? "шага" : "шагов"); };
const rubC = (n) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, "\u00a0") + "\u00a0₽";
// граммовка: число и единица неразрывно; «доверху» — без числа
const amount = (i) => (i[1] === "" || i[1] == null ? "" : i[2] === "доверху" ? "доверху" : i[1] + " " + (i[2] || "мл"));

function BarCocktails({ T, a11y, gold, text, sub, restaurant, cocktails, spirits, tabs, pinTabs, som = null, onBack, startId, cardBack, onOpenSpirit, onLearn, onBuild, onCocktailDeck, onBarLab, onCocktailEdit,
  keep = null, onKeep = null, others = null, onOther = null, onSearchIn = null, fromText = "", onPrint = null, onShareChat = null, team = null, lead = false, who = "" }) {
  const red = a11y ? "#A33A2A" : "#E07878";
  const k0 = keep || {};   // v129: вкладка помнит поиск, основу и место в списке
  const [q, setQ] = React.useState(k0.q || "");
  const [only, setOnly] = React.useState(k0.only || "all");
  const [openId, setOpenId] = React.useState(startId || null);   // v128: карточка коктейля — здесь же
  // v136: «Советуем» (отметка руководителя, как «☆ Первым» в «Сомелье»), порядок и вид списка
  const [shared, setShared, teamLoaded] = team || [[], null, false];
  const rules = React.useMemo(() => readSomRules(shared), [shared]);
  const prio = React.useMemo(() => new Set(rules.prio), [rules]);
  const isPrio = (x) => prio.has("cocktail:" + x.id);
  const prioN = cocktails.filter(isPrio).length;
  const { sort, setSort, short, setShort } = useListPref("cocktail");
  const priced = cocktails.some((x) => Number(x.price) > 0);
  const sorts = [["sec", "Разделы"], ...(priced ? [["price", "Цена"]] : []), ["az", "А–Я"]];
  const sortNow = sorts.some(([k]) => k === sort) ? sort : "sec";
  const [howOpen, setHowOpen] = React.useState(false);   // v136: «Как готовить» в карточке — свёрнуто (состав уже сверху)
  React.useEffect(() => { setHowOpen(false); }, [openId]);
  const [busy, setBusy] = React.useState(false), [prioMsg, setPrioMsg] = React.useState("");
  const togglePrio = (x) => {
    if (busy || !setShared || !teamLoaded) return;   // меню с сервера ещё не пришло: в копии телефона нет фото data:
    const k = "cocktail:" + x.id, next = prio.has(k) ? rules.prio.filter((y) => y !== k) : [...rules.prio, k];
    const arr = withSomRules(shared, { ...rules, prio: next, by: who, at: Date.now() });
    setBusy(true); setPrioMsg("");
    rpc("menu_set", { p_token: saToken(), p_restaurant: restaurant, p_dishes: JSON.stringify(arr) }).then((res) => {
      setBusy(false);
      if (res && res.ok === true) { setShared(arr); rememberSharedMenu(restaurant, arr); vibrate("success"); }
      else { setPrioMsg("Не сохранилось. Проверь связь и права"); vibrate("error"); }
    }).catch(() => { setBusy(false); setPrioMsg("Нет связи"); vibrate("error"); });
  };
  const found = findCocktails(cocktails, q);
  const groups = groupByBase(found);
  const byOnly = only === "all" ? groups : only === "prio" ? groups.map(([k, l]) => [k, l.filter(isPrio)]).filter(([, l]) => l.length) : groups.filter(([k]) => k === only);
  // v136: по разделам — как было; «Цена» и «А–Я» — один список без заголовков
  const shown = sortNow === "sec" ? byOnly : [["", sortItems(byOnly.flatMap(([, l]) => l), sortNow, { price: (x) => Number(x.price) || 0, title: (x) => x.name })]];
  const houseN = cocktails.filter((c) => c.house).length;
  const known = React.useMemo(() => knownOf(cocktails), [cocktails]);
  const c = openId ? cocktails.find((x) => x.id === openId) || null : null;
  const remember = useInnerTop(c ? "card:" + c.id : "list", "list", k0.scroll);   // список — где был, карточка — сверху
  useKeepScroll(!c, k0.scroll, (y) => { if (onKeep) onKeep({ scroll: y }); });
  React.useEffect(() => { if (onKeep) onKeep({ q, only }); }, [q, only]);   // eslint-disable-line react-hooks/exhaustive-deps
  useBackToRow(c ? c.id : null, (id) => '[data-bar-ck="' + id + '"]');
  const frameRef = React.useRef(null), chipsRef = React.useRef(null), searchRef = React.useRef(null);
  const pinBox = usePin(chipsRef, frameRef, !c && cocktails.length > 0);
  const secNow = useSection(!c && cocktails.length > 0, "[data-bar-ck-group]", "data-bar-ck-group");   // v129: раздел под копией шапки
  React.useLayoutEffect(() => { showActiveChip(chipsRef.current); }, [only, openId]);   // eslint-disable-line react-hooks/exhaustive-deps
  const swipe = useSwipe();
  const [slide, setSlide] = React.useState("");
  const chip = (on) => ({ flexShrink: 0, padding: "6px 12px", borderRadius: 999, fontSize: 13, fontFamily: SERIF, cursor: "pointer", whiteSpace: "nowrap",
    border: `1px solid ${on ? gold : gold + "44"}`, background: on ? (a11y ? "rgba(139,106,48,0.14)" : "rgba(214,178,102,0.16)") : "transparent", color: on ? text : sub });
  const badge = (t, col) => <span style={{ fontSize: 11.5, padding: "1px 7px", borderRadius: 999, border: `1px solid ${col}88`, color: col, whiteSpace: "nowrap" }}>{t}</span>;
  const inGo = useGoToday(restaurant);   // v141 (Доп. 458): «гоу-лист» — смена советует это сегодня
  const head = (kicker, title, back, right) => (
    <div style={{ padding: "16px 16px 6px", display: "flex", alignItems: "center", gap: 10 }}>
      <button className="sa-btn" data-lens="back" onClick={back} {...onActivate(back)} aria-label="Назад" style={{ border: "none", background: "transparent", color: gold, fontSize: 21, cursor: "pointer", padding: "4px 8px 4px 0" }}>‹</button>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ ...labelStyle(13.5), color: gold }}>{kicker}</div>
        <div style={{ fontFamily: SERIF, fontSize: 21, color: text, lineHeight: 1.15 }}>{title}</div>
      </div>
      {right}
    </div>);
  const editBtn = (go, attr, label) => <button type="button" className="sa-btn" data-lens-btn="soft" {...attr} onClick={() => { vibrate("light"); go(); }}
    style={{ flexShrink: 0, padding: "7px 13px", borderRadius: 999, border: `1px solid ${gold}77`, background: "transparent", color: text, fontFamily: SERIF, fontSize: 13, cursor: "pointer" }}>{label}</button>;

  // ── v128: карточка коктейля ──
  if (c) {
    const close = cardBack || (() => setOpenId(null));
    const nav = stepsOf(c.id, shown.flatMap(([, l]) => l), groups.flatMap(([, l]) => l));
    const goCard = (id, dir) => { setSlide(dir); setOpenId(id); };   // v129: и пальцем; въезжает с той стороны, куда листаешь
    const ours = cocktailSpirits(c, spirits);
    const story = COCKTAIL_STORIES[c.id] || (c.house && (c.story || c.short) ? { story: c.story, guest: c.short } : null);
    const seq = !c.house ? buildScenario(c, COCKTAILS).steps : null;   // как в колоде и бар-лаборатории (один источник)
    const glyph = (s) => (s.kind === "glass" ? "▽" : s.kind === "ice" ? <Sign n="ice" s={11} sw={2.2} style={{ verticalAlign: "-1px" }} /> : s.kind === "tool" ? "▸"
      : s.kind === "garnish" ? <Sign n="garnish" s={12} sw={2.2} style={{ verticalAlign: "-1px" }} /> : "●");
    const howTo = seq ? seq.map((s) => ({ glyph: glyph(s), label: s.label })) : (c.steps || []).filter(Boolean).map((s) => ({ glyph: null, label: s }));
    const ing = (c.ing || []).filter((i) => Array.isArray(i) && i[0]);
    const canBuild = !!onBuild && (!c.house || (isFullCocktail(c) && !c.stop));   // свои — со спеком и не в стопе, как в бар-лаборатории
    // гарниш — отдельной строкой у своих коктейлей (у классики он последним шагом «Как готовить»)
    const garnish = !seq && c.garnish && c.garnish !== "none" && GARNISH_RU[c.garnish] ? GARNISH_RU[c.garnish] : "";
    const sec = (t) => <div style={{ ...labelStyle(13.5), color: gold, margin: "18px 0 6px" }}>{t}</div>;
    const { marginTop: _mt, ...btnBase } = T.doneBtn || {};   // свой marginTop кнопки спорил бы с margin: 0 (как в редакторе вин)
    const bigBtn = (attr, label, go, main) => <button type="button" className="sa-btn" data-lens-btn={main ? "main" : "soft"} {...attr} onClick={() => { vibrate("light"); go(c.id); }}
      style={{ ...btnBase, width: "auto", flex: "1 1 0", minWidth: "min-content", whiteSpace: "nowrap", margin: 0, padding: "11px 12px", fontSize: 14.5, fontFamily: SERIF, cursor: "pointer",
        ...(main ? { background: gold, color: "#1A1008", border: "none" } : { background: "transparent", color: text, border: `1px solid ${gold}77` }) }}>{label}</button>;
    return (
      <div style={T.screen} className="sa-screen" data-bar-ck-card={c.id} {...swipe(nav.prev ? () => goCard(nav.prev.id, "l") : null, nav.next ? () => goCard(nav.next.id, "r") : null)}>
        {head(fromText || "Барная карта · Коктейли", c.name, close, c.house && onCocktailEdit ? editBtn(() => onCocktailEdit(c.full ? c.id : null, c.id), { "data-bar-ck-edit": "card" }, "Править") : null)}
        <div key={c.id} className={slide === "l" ? "sa-cardpage-l" : slide === "r" ? "sa-cardpage-r" : undefined} style={{ padding: "4px 16px 140px" }}>
          <div data-lens-card="" style={{ ...T.modCard, display: "flex", gap: 14, alignItems: "center", padding: "12px 16px", cursor: "default", opacity: c.stop ? 0.75 : 1 }}>
            {Array.isArray(c.color) ? <div data-bar-ck-art="big" aria-hidden="true" style={{ width: 76, flexShrink: 0, display: "flex", justifyContent: "center" }}><CocktailArt c={c} w={76} light={a11y} /></div> : null}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontFamily: SERIF, fontSize: 15.5, color: text, lineHeight: 1.4 }}>{[GLASS_RU[c.glass] || "", c.method || ""].filter(Boolean).join(" · ")}</div>
              {c.strength || c.sweet ? <div style={{ fontSize: 12.5, color: sub, marginTop: 4, lineHeight: 1.5 }}>
                {c.strength ? <span style={{ whiteSpace: "nowrap" }}>крепость <span style={{ color: gold, letterSpacing: 1 }}>{dots(c.strength)}</span></span> : null}
                {c.strength && c.sweet ? " · " : null}
                {c.sweet ? <span style={{ whiteSpace: "nowrap" }}>сладость <span style={{ color: gold, letterSpacing: 1 }}>{dots(c.sweet)}</span></span> : null}
              </div> : null}
              {c.house || c.stop || (isPrio(c) && !(lead && setShared)) ? <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 6 }}>{isPrio(c) && !(lead && setShared) ? badge("★ советуем", gold) : null}{c.house ? badge("свой", gold) : null}{c.stop ? badge("сегодня нет", red) : null}</div> : null}
              {Number(c.price) > 0 ? <div data-bar-ck-price="" style={{ fontSize: 14, color: text, marginTop: 6 }}>{rubC(c.price)}</div> : null}
              {onShareChat || (lead && setShared) ? <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 10 }}>
                {onShareChat ? <ShareChat id={"cocktail:" + c.id} onClick={() => onShareChat(cocktailShareItem(c))} gold={gold} text={text} /> : null}
                {lead && setShared ? <PrioToggle on={isPrio(c)} busy={busy || !teamLoaded} onClick={() => togglePrio(c)} gold={gold} text={text} /> : null}
              </div> : null}
              {prioMsg ? <div style={{ fontSize: 13, color: red, marginTop: 6 }}>{prioMsg}</div> : null}
            </div>
          </div>
          {ing.length ? <>{sec("Состав")}
            <div data-bar-ck-ing={ing.length} data-lens-card="" style={{ ...T.modCard, display: "block", cursor: "default", padding: "4px 14px" }}>
              {ing.map((i, k) => (
                <div key={k} style={{ display: "flex", alignItems: "baseline", gap: 10, padding: "8px 0", borderTop: k ? `1px dashed ${gold}33` : "none" }}>
                  <span style={{ flex: 1, minWidth: 0, fontFamily: SERIF, fontSize: 15, color: text, lineHeight: 1.35 }}>{i[0]}</span>
                  {amount(i) ? <span style={{ flexShrink: 0, fontFamily: "ui-monospace, Menlo, monospace", fontSize: 13.5, color: gold }}>{amount(i)}</span> : null}
                </div>))}
            </div></> : null}
          {ours.length ? <>{sec("Из нашей карты")}
            <div data-bar-ck-ours={ours.length} style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>{ours.map((x) => {
              const go = () => { if (onOpenSpirit) { vibrate("light"); onOpenSpirit(x.id, c.id); } };
              return <span key={x.id} role="button" tabIndex={0} data-lens-tag="" data-bar-ck-spirit={x.id} onClick={go} {...onActivate(go)} style={{ ...chip(false), color: text, cursor: onOpenSpirit ? "pointer" : "default" }}>{spiritTitle(x)}</span>; })}
            </div></> : null}
          {/* v136: «Как готовить» свёрнуто: состав с граммовкой уже сверху, официанту главное — состав, подача и фраза гостю */}
          {howTo.length ? <>
            <button type="button" data-bar-ck-how-toggle={howOpen ? "open" : "closed"} aria-expanded={howOpen} onClick={() => { vibrate("light"); setHowOpen((v) => !v); }}
              style={{ ...labelStyle(13.5), color: gold, margin: "18px 0 6px", padding: "2px 0", background: "transparent", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 6, textAlign: "left" }}>
              <span>{"Как готовить · " + stepsWord(howTo.length) + (seq ? ", как в лаборатории" : "")}</span><span aria-hidden="true" style={{ fontStyle: "normal", fontSize: 15 }}>{howOpen ? "▾" : "›"}</span></button>
            {howOpen ? <ol data-bar-ck-how={howTo.length} style={{ margin: 0, paddingLeft: 22, color: text, fontSize: 14.5, lineHeight: 1.55 }}>
              {howTo.map((s, k) => <li key={k} style={{ paddingLeft: 2, marginBottom: 2 }}>{s.glyph ? <span style={{ color: gold, marginRight: 6, fontSize: 11 }}>{s.glyph}</span> : null}{s.label}</li>)}
            </ol> : null}</> : null}
          {c.tip || c.pair || garnish || c.note ? <>{sec("Подача")}
            {garnish ? <div style={{ fontSize: 14, color: text, lineHeight: 1.5 }}>{"Гарниш: " + garnish.toLowerCase()}</div> : null}
            {c.tip ? <div style={{ fontFamily: SERIF, fontStyle: "italic", fontSize: 14.5, color: text, lineHeight: 1.55, marginTop: garnish ? 6 : 0 }}>{c.tip}</div> : null}
            {c.pair ? <div style={{ fontSize: 13.5, color: sub, lineHeight: 1.5, marginTop: 6 }}>К столу: {c.pair}</div> : null}
            {c.note ? <div style={{ marginTop: 8, padding: "7px 10px", borderRadius: 9, border: `1px dashed ${gold}66`, color: sub, fontSize: 13, lineHeight: 1.5 }}>{c.note}</div> : null}</> : null}
          {story ? <>{sec("История")}
            {story.story ? <div data-bar-ck-story="" style={{ fontSize: 14.5, color: text, lineHeight: 1.6 }}>{story.story}</div> : null}
            {story.guest ? <div style={{ fontFamily: SERIF, fontStyle: "italic", fontSize: 14, color: sub, lineHeight: 1.5, marginTop: 8 }}>Гостю: «{story.guest}»</div> : null}</> : null}
          {onLearn || canBuild ? <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 22 }}>
            {onLearn ? bigBtn({ "data-bar-ck-learn": c.id }, "Учить в колоде", onLearn, true) : null}
            {canBuild ? bigBtn({ "data-bar-ck-build": c.id }, "Собрать руками", onBuild, !onLearn) : null}
          </div> : null}
          <PrevNext a11y={a11y} gold={gold} text={text} sub={sub} steps={nav} name={(x) => x.name} onGo={(id) => goCard(id, nav.prev && id === nav.prev.id ? "l" : "r")} />
        </div>
      </div>);
  }

  // v129: строка «Учить» — та же, что у вин и крепкого (ui/bar-kit.jsx); по касанию сразу в колоду или лабораторию
  const learnItems = [
    onCocktailDeck ? { key: "deck", icon: GAME_SVG.cards(gold, 18), title: "Колода", sub: known ? "выучено " + known + " из " + cocktails.length : "карточки с повтором", go: onCocktailDeck } : null,
    onBarLab ? { key: "lab", icon: BUILD_SVG.glass(gold, 18), title: "Лаборатория", sub: "собрать руками", go: onBarLab } : null,
  ].filter(Boolean);
  // v129: что показано («Показаны: Ром, 6 из 57 · Показать все»), конец списка, что нашлось в других вкладках
  const qt = q.trim(), filtered = only !== "all" || !!qt, shownN = shown.reduce((n, [, l]) => n + l.length, 0);
  const resetAll = () => { setQ(""); setOnly("all"); vibrate("light"); };
  const filterNote = (compact) => <FilterNote parts={[only === "prio" ? "советуем" : only !== "all" ? only : "", qt ? "по запросу «" + qt + "»" : ""].filter(Boolean)} n={shownN} total={cocktails.length}
    onReset={resetAll} gold={gold} text={text} sub={sub} a11y={a11y} compact={compact} />;
  const secList = secNow ? shown.find(([k]) => k === secNow) : null;
  const pinLine = filtered ? filterNote(true) : secList ? <div data-bar-pin-sec={secNow} style={{ ...labelStyle(13), color: a11y ? "#6B4E1A" : gold, marginTop: 5 }}>{secNow + " · " + secList[1].length}</div> : null;
  const elsewhere = others && onOther && qt.length >= 2 ? others(qt, "cocktail") : [];
  const firstId = shown.length && shown[0][1].length ? shown[0][1][0].id : null;
  const open = (x) => () => { vibrate("light"); remember(); setSlide(""); setOpenId(x.id); };
  const chipList = (pin) => [["all", "Все"], ...(prioN ? [["prio", "★ Советуем"]] : []), ...groups.map(([k]) => [k, k])].map(([k, t]) => {
    const dot = dotOf("cocktail", k);
    return <button key={k} type="button" aria-pressed={only === k} data-bar-ck-only={pin ? undefined : k} data-bar-pin-ck={pin ? k : undefined} data-lens-btn={only === k ? "tab" : "soft"} data-lens-ink=""
      onClick={() => { setOnly(k); vibrate("light"); if (pin) scrollToEl(chipsRef.current); }} style={{ ...chip(only === k), ...(dot ? { display: "inline-flex", alignItems: "center", gap: 6 } : {}) }}>{dot ? <Dot c={dot} a11y={a11y} /> : null}{t}</button>;
  });
  return (
    <div ref={frameRef} style={T.screen} className="sa-screen" data-bar-cocktails={cocktails.length}>
      {head("Справочник · " + restaurant, "Барная карта", onBack, onCocktailEdit ? editBtn(() => onCocktailEdit(null), { "data-bar-ck-edit": "" }, "Редактор") : null)}
      {tabs}
      {som}
      <BarPin box={pinBox} a11y={a11y} gold={gold} tabs={pinTabs} chips={chipList(true)} onSearch={() => focusSearch(searchRef.current)} line={pinLine} active={only} />
      <div style={{ padding: "0 16px 140px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "2px 2px 10px" }}>
          <div data-bar-ck-sum="" style={{ flex: 1, minWidth: 0, fontSize: 13.5, color: sub }}>{cocktailsWord(cocktails.length) + (houseN ? " · свои " + houseN : "")}</div>
          {onPrint && cocktails.length ? <PrintLink gold={gold} text={text} a11y={a11y} onClick={() => { remember(); onPrint(filtered && shownN ? { kind: "cocktail", ids: shown.flatMap(([, l]) => l.map((x) => x.id)),
            label: [only !== "all" ? only : "", qt ? "по запросу «" + qt + "»" : ""].filter(Boolean).join(", ") } : { kind: "cocktail" }); }} /> : null}
        </div>
        <LearnStrip T={T} items={learnItems} gold={gold} />
        <SearchField inputRef={searchRef} value={q} onChange={setQ} placeholder="Коктейль или ингредиент" aria="Поиск по коктейлям" a11y={a11y} gold={gold} text={text} style={{ marginTop: 4 }} />
        <div ref={chipsRef} className="sa-hscroll" role="group" aria-label="Показать" style={{ display: "flex", gap: 6, overflowX: "auto", padding: "10px 0 4px" }}>
          {chipList(false)}
        </div>
        {filtered ? filterNote(false) : null}
        {shownN ? <ViewBar sorts={sorts} sort={sortNow} onSort={setSort} short={short} onShort={setShort} gold={gold} text={text} sub={sub} a11y={a11y} /> : null}
        {!found.length || !shownN ? <div data-bar-ck-none={elsewhere.length ? "here" : "all"} style={{ fontSize: 14, color: sub, padding: elsewhere.length ? "14px 2px 2px" : "18px 2px" }}>{!cocktails.length ? "В карте бара пока нет коктейлей." : elsewhere.length ? "Здесь не нашлось." : "Ничего не нашлось."}</div> : null}
        {shown.map(([k, list]) => {
          const rows = list.map((x) => {
            const go = open(x);
            const ours = cocktailSpirits(x, spirits);
            const line = [x.method, GLASS_SHORT[x.glass] || ""].filter(Boolean).join(" · ");
            const pr = isPrio(x);
            // v136: «Кратко» — одна строка: точка основы, название, отметки, цена
            if (short) return (
              <div key={x.id} id={x.id === firstId ? "sa-bar-row1" : undefined} role="button" tabIndex={0} data-bar-ck={x.id} data-bar-ck-short="" data-lens-card="" onClick={go} {...onActivate(go)}
                style={{ ...T.modCard, display: "flex", gap: 9, alignItems: "center", padding: "9px 10px 9px 13px", marginBottom: 6, opacity: x.stop ? 0.6 : 1 }}>
                <Dot c={dotOf("cocktail", cocktailBase(x))} a11y={a11y} />
                <span style={{ flex: 1, minWidth: 0, fontFamily: SERIF, fontSize: 15, color: text, lineHeight: 1.3, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{x.name}</span>
                {pr ? <span data-bar-ck-prio="" aria-label="советуем" style={{ color: a11y ? "#6B4E1A" : gold, fontSize: 13, flexShrink: 0 }}>★</span> : null}
                {x.stop ? badge("сегодня нет", red) : x.house ? badge("свой", gold) : null}
                {Number(x.price) > 0 ? <span style={{ flexShrink: 0, fontSize: 13, color: text, whiteSpace: "nowrap" }}>{rubC(x.price)}</span> : null}
                <Chevron gold={gold} />
              </div>);
            return (
              <div key={x.id} id={x.id === firstId ? "sa-bar-row1" : undefined} role="button" tabIndex={0} data-bar-ck={x.id} data-lens-card="" onClick={go} {...onActivate(go)} style={{ ...T.modCard, display: "flex", gap: 12, alignItems: "center", padding: "9px 12px 9px 10px", marginBottom: 8, opacity: x.stop ? 0.6 : 1 }}>
                {Array.isArray(x.color) ? <div data-bar-ck-art="" aria-hidden="true" style={{ width: 40, height: 52, flexShrink: 0, display: "flex", alignItems: "flex-end", justifyContent: "center" }}><CocktailArt c={x} w={40} light={a11y} showIce={false} /></div> : null}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                    <span style={{ flex: 1, minWidth: 0, fontFamily: SERIF, fontSize: 15.5, color: text, lineHeight: 1.3 }}>{x.name}</span>
                    {pr ? badge("★ советуем", gold) : null}
                    {x.house ? badge("свой", gold) : null}
                    {x.stop ? badge("сегодня нет", red) : null}
                    {!x.stop && inGo(x) ? <span data-go-badge="">{badge("гоу-лист", gold)}</span> : null}
                  </div>
                  {/* v136: что из нашей карты — в той же строке, что метод и бокал */}
                  {line || ours.length ? <div style={{ fontSize: 12.5, color: sub, marginTop: 3, lineHeight: 1.4 }}>{line}{line && ours.length ? " · " : ""}{ours.length ? <span data-bar-ck-spirits={ours.length} style={{ color: text }}>{ours.slice(0, 3).map(spiritTitle).join(", ")}{ours.length > 3 ? " и ещё " + (ours.length - 3) : ""}</span> : null}</div> : null}
                  {Number(x.price) > 0 ? <div style={{ fontSize: 12.5, color: text, marginTop: 3 }}>{rubC(x.price)}</div> : null}
                </div>
                <Chevron gold={gold} />
              </div>);
          });
          if (!k) return <div key="flat" data-bar-ck-flat={sortNow}>{rows}</div>;
          return (
            <div key={k} data-bar-ck-group={k}>
              <div style={{ ...labelStyle(13.5), color: gold, margin: "14px 2px 6px", display: "flex", alignItems: "center", gap: 7 }}><Dot c={dotOf("cocktail", k)} a11y={a11y} />{k} · {list.length}</div>
              {rows}
            </div>);
        })}
        {filtered && shownN ? <EndNote text={only !== "all" && only !== "prio" && !qt ? "Это весь раздел «" + only + "»" : "Это всё, что нашлось"} button="Показать все коктейли" onClick={resetAll} gold={gold} sub={sub} a11y={a11y} /> : null}
        <Elsewhere groups={elsewhere} none={!shownN} onOpen={(tab, id) => onOther(tab, id, qt)} onAll={(tab) => onSearchIn(tab, qt)} T={T} gold={gold} text={text} sub={sub} />
        <BarHint a11y={a11y} ready={shownN > 0} has={{ tabs: !!tabs, row: !!firstId, learn: learnItems.length > 0 }} />
      </div>
    </div>);
}
