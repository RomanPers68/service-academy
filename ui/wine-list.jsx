// ui/wine-list.jsx — v120 (Доп. 433): «Винная карта» заведения для команды.
//
// Вина — записи kind:"wine" в меню команды (lib/wine.js). Здесь их видят все: группы по цвету, поиск, «Бокалом»,
// карточка вина (стиль, ноты, подача, фраза гостю, к каким блюдам). Что дописал AI и ещё не подтвердили — с пометкой
// «не проверено». Руководитель (manager, senior, владелец) правит в «Редакторе вин» (ui/wine-editor.jsx).
// v122 (Доп. 435): фото бутылки — миниатюра в строке, крупно в карточке (официант узнаёт бутылку на полке).
// v123 (Доп. 436), владелец: «их учить очень сложно, особенно для новичка. Может, сделаем как в меню, с тренировками,
// викторинами» — сверху карты «Учить вина»: тренировка (ui/wine-train.jsx) только по проверенным винам.
// v127 (Доп. 440): «Барная карта» (ui/bar-card.jsx) — вкладки «Коктейли», «Вина», «Крепкое». Этот экран — общий для вин и
// крепкого (kind; вид напитка K — lib/drinks.js); у крепкого в карточке — в каких коктейлях нашего бара оно работает.
// v128 (Доп. 441), владелец: «как мы барную карту можем сделать удобнее, проще, и красивее?» — «Делаем все». Руководителю
// над картой — сколько ждёт проверки (команда учит только проверенные) и «Проверить подряд», у раздела — «Верно для
// раздела»; в строке вместо «не проверено» — тихая метка AI. Шапка не уезжает (ui/bar-pin.jsx). «Подобрать гостю»: бюджет по
// ценам своей карты и сладость. Название «Русское / Original» — в две строки (lib/bar-view.js).
// Затем: «Как ещё проще и удобнее мы можем сделать?» — «Да, давай». Карточки листаются подряд («‹ предыдущее»,
// «следующее ›»); коктейль из карточки крепкого открывается здесь же, в «Барной карте», и «назад» возвращает в крепкое;
// после «Править» и «Сохранить» — снова эта карточка.
// v129 (Доп. 442), владелец: «Что бы человек зайдя в неё не заблудился и все было интуитивно понятно?» — «Давай все».
// Сверху «Барная карта · Вина»; строка «Учить» вместо «Учить вина» (сразу «С чего начать», «Колода», «Викторина», «Ещё» —
// прежняя тренировка); «Показаны: Красные, 7 из 30 · Показать все» и конец списка; поиск смотрит и другие вкладки; золотая
// стрелка у строки; карточки листаются пальцем; вкладка помнит раздел, поиск, подбор и место (ui/bar-kit.jsx).
import React from "react";
import { GOLD, labelStyle } from "./tokens";
import { onActivate, vibrate } from "../lib/utils";
import { rpc, saToken } from "../api/supabase";
import { cachedShared } from "../lib/deck-extras";
import { rememberSharedMenu, dishesOf } from "../lib/reference-context";
import { wineRecords, groupByColor, findWines, wineTitle, wineLine, winePrice, unchecked, COLOR_GROUP, COLOR_RU, FIELD_RU } from "../lib/wine";
import { trainable, newWines, allLearned, glassPath, srKey } from "../lib/wine-train";
import { WineDeck, WineQuiz, WineTrainHub, WinePairQuiz, WineDescribe60, WineTeam, useLearned, wineReport, glass as wineGlass } from "./wine-train";
import { PronounceScreen } from "./pronounce";   // v124: словарь «Как произносить» с разделом «Наша карта»
import { wineCatchUp } from "../lib/wine-sync";   // v126: выученное до v125 — на сервер
import { drinkOf } from "../lib/drinks";   // v127: вина и крепкое
import { pathFor, srKnown } from "../lib/wine-train";
import { kKey } from "./wine-train";
import { spiritCocktails } from "../lib/spirit-cocktails";
import { BUILD_SVG, GAME_SVG, UI_SVG } from "./icons";
import { titleParts, SWEET, sweetOf, budgetPrice, budgetSteps, inBudget, budgetLabels, checkWord } from "../lib/bar-view";   // v128
import { usePin, BarPin, scrollToEl, focusSearch, useBackToRow, stepsOf, PrevNext, showActiveChip } from "./bar-pin";
import { SearchField, FilterNote, EndNote, Elsewhere, LearnStrip, Chevron, useSwipe, useSection, useKeepScroll, BarHint, PrintLink, ShareChat } from "./bar-kit";   // v129; v130 — печать и «в чат»
import { drinkShareItem } from "../lib/share-items";   // v130: «Поделиться в чат»

const SERIF = "Georgia, 'Times New Roman', serif";
export const canEditWines = (profile) => !!(profile && (profile.is_admin || ["manager", "senior"].includes(profile.position)));
const plural = (n, a, b, c) => { const m10 = n % 10, m100 = n % 100; return m10 === 1 && m100 !== 11 ? a : m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20) ? b : c; };
export const winesWord = (n) => n + " " + plural(n, "вино", "вина", "вин");

// v122 (Доп. 435): фото бутылки. Силуэт — вместо фото, когда его нет (своя простая форма), чтобы строки с фото и без
// стояли ровно; миниатюра — в строках карты и редактора, крупно — в карточке вина.
export const BottleGlyph = ({ color, w = 22 }) => (
  <svg width={w} height={Math.round(w * 2.2)} viewBox="0 0 20 44" aria-hidden="true" fill="none" stroke={color} strokeWidth="1.4" strokeLinejoin="round">
    <path d="M8 2h4v9c0 2 4 4 4 9v20a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V20c0-5 4-7 4-9z" /><path d="M4.6 25h10.8M4.6 34h10.8" opacity="0.6" />
  </svg>);
export const WineThumb = ({ w, gold, a11y, onClick = null }) => (
  <div data-wine-thumb={w.img ? "photo" : "none"} aria-hidden="true" onClick={onClick || undefined}
    style={{ width: 38, height: 52, flexShrink: 0, borderRadius: 8, overflow: "hidden", display: "grid", placeItems: "center", cursor: onClick ? "pointer" : undefined,
      border: `1px ${w.img ? "solid" : "dashed"} ${gold}${w.img ? "55" : "40"}`, background: a11y ? "rgba(139,106,48,0.06)" : "rgba(255,248,230,0.04)" }}>
    {w.img ? <img src={w.img} alt="" loading="lazy" decoding="async" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
      : <BottleGlyph color={gold + "80"} w={14} />}
  </div>);

// v124: экран внутри экрана (карточка вина, форма, тренировка) открывается сверху, а список возвращается туда, где его
// оставили. Прокручивается корень приложения (#root): без этого длинная форма вина, открытая из середины списка, начиналась
// с середины. remember() — перед уходом со списка (касание строки), key — что сейчас на экране, listKey — сам список.
// v129: initial — где был список этой вкладки в прошлый раз («Барная карта» помнит место вкладки)
export function useInnerTop(key, listKey = "list", initial = 0) {
  const saved = React.useRef(initial || 0);
  const el = () => (typeof document !== "undefined" ? document.getElementById("root") || document.scrollingElement : null);
  const remember = () => { try { saved.current = el().scrollTop; } catch (e) {} };
  React.useEffect(() => { try { const x = el(); if (x) x.scrollTop = key === listKey ? saved.current : 0; } catch (e) {} }, [key]);   // eslint-disable-line react-hooks/exhaustive-deps
  return remember;
}

/** Меню команды: сначала кэш телефона, потом сервер (как у коктейлей). */
export function useTeamMenu(restaurant) {
  const [shared, setShared] = React.useState(() => cachedShared(restaurant));
  const [loaded, setLoaded] = React.useState(false);
  React.useEffect(() => {
    if (!restaurant) return undefined;
    let alive = true;
    rpc("menu_get", { p_restaurant: restaurant }).then((res) => {
      const arr = typeof res === "string" ? JSON.parse(res) : res;
      if (alive && Array.isArray(arr)) { setShared(arr); rememberSharedMenu(restaurant, arr); }
      if (alive) setLoaded(true);
    }).catch(() => { if (alive) setLoaded(true); });
    return () => { alive = false; };
  }, [restaurant]);
  return [shared, setShared, loaded];
}

// startId: id вина — сразу его карточка; "@train" — сразу тренировка (вход из тренажёра меню)
// v128: cardBack — «назад» из карточки, открытой из карточки другой вкладки (крепкое ↔ коктейль): вернуться в ту; note —
// строка под заголовком карточки, открытой из редактора после «Сохранить»
// v129: keep — что вкладка помнит (q, only, pick, scroll), onKeep — запомнить; others(q) — что поиск нашёл в других вкладках,
// onOther(вкладка, id, q) — открыть там карточку, onSearchIn(вкладка, q) — та вкладка с этим поиском; fromText — откуда пришёл
// v130: onPrint({ kind, ids, label }) — лист для печати (что показано, если выбран раздел, поиск или подбор); onShareChat(item) —
// «Поделиться в чат» из карточки
export function WineListScreen({ T, a11y, profile, onBack, onEdit, startId, kind = "wine", tabs = null, som = null, pinTabs = null, listTitle = "Винная карта", cocktails = [], onOpenCocktail = null, team = null, cardBack = null, note = "",
  keep = null, onKeep = null, others = null, onOther = null, onSearchIn = null, fromText = "", onPrint = null, onShareChat = null }) {
  const K = drinkOf(kind);
  const gold = a11y ? "#7A5D2A" : GOLD, text = T.modTitle.color, sub = T.modSub.color;
  const red = a11y ? "#A33A2A" : "#E07878", amber = a11y ? "#8A5A12" : "#E4B36A", green = a11y ? "#2E7D52" : "#5DBB8A";
  const restaurant = (profile && profile.restaurant) || "";
  const uk = profile ? `_${profile.name}_${profile.surname || ""}` : "";
  const edit = canEditWines(profile) && onEdit;
  // v127: «Барная карта» отдаёт меню команды готовым (один запрос на все вкладки); сам — только без неё
  const own = useTeamMenu(team ? "" : restaurant);
  const [shared, setShared, menuLoaded] = team || own;
  const who = profile ? [profile.name, profile.surname].filter(Boolean).join(" ") : "";
  const k0 = keep || {};
  const [q, setQ] = React.useState(k0.q || "");
  const [only, setOnly] = React.useState(k0.only || "all");   // all | glass | цвет
  const train0 = startId === "@train";
  const [openId, setOpenId] = React.useState(train0 ? null : startId || null);
  const [view, setView] = React.useState(train0 ? "train" : "list");   // list | train | deck | quiz | pair | say60 | pron | team
  const [deck, setDeck] = React.useState(null);      // колода: { key, title, mode, only, focus }
  const [learnedIds, learn] = useLearned(restaurant, K);
  const remember = useInnerTop(openId ? "card:" + openId : view === "deck" ? "deck:" + (deck ? deck.key : "") : view, "list", k0.scroll);
  useKeepScroll(view === "list" && !openId, k0.scroll, (y) => { if (onKeep) onKeep({ scroll: y }); });   // v129: вкладка помнит место
  const [trainFrom, setTrainFrom] = React.useState("train");   // v129: тренировка из строки «Учить» — «назад» в карту
  useBackToRow(openId, (id) => '[data-wine-row="' + id + '"]');   // v128: листал карточки — строка последней в поле зрения
  const [saved, setSaved] = React.useState(note);   // v128: «Сохранено» под заголовком карточки после редактора
  React.useEffect(() => { if (!saved) return undefined; const t = setTimeout(() => setSaved(""), 6000); return () => clearTimeout(t); }, [saved]);
  const all = React.useMemo(() => K.records(shared).filter((w) => !w.archived), [shared, K]);
  // v126 (Доп. 439): выученное до v125 — на сервер, когда карта пришла с сервера (lib/wine-sync.js; что ушло — не повторит);
  // v127: только вина — крепкого до v127 не было
  React.useEffect(() => { if (menuLoaded && K.kind === "wine") wineCatchUp({ restaurant, uk, wines: all }); }, [menuLoaded]);   // eslint-disable-line react-hooks/exhaustive-deps
  // v128: карточки нет (убрали в архив, удалили) — список, когда карта пришла с сервера
  React.useEffect(() => { if (menuLoaded && openId && !all.some((x) => x.id === openId)) setOpenId(null); }, [menuLoaded, all]);   // eslint-disable-line react-hooks/exhaustive-deps
  const colors = React.useMemo(() => K.groups(all).map(([k]) => k).filter((k) => k !== "other"), [all, K]);
  // v128: «Подобрать гостю» — бюджет (ступени по ценам своей карты; в «Бокалом» — цена бокала) и сладость вина
  const [pick, setPick] = React.useState(k0.pick || { b: 0, s: "" });
  const [pickOpen, setPickOpen] = React.useState(false);
  const glassOnly = only === "glass" && K.kind === "wine";
  const steps = React.useMemo(() => budgetSteps(all.map((w) => budgetPrice(K, w, glassOnly))), [all, K, glassOnly]);
  const sweets = React.useMemo(() => (K.kind === "wine" ? SWEET.filter(([g]) => all.some((w) => sweetOf(w) === g)) : []), [all, K]);
  const pickN = (pick.b && steps ? 1 : 0) + (pick.s ? 1 : 0);
  const shown = React.useMemo(() => K.find(all, q).filter((w) => (only === "all" ? true : only === "glass" ? K.pathTest(w) : K.groupKey(w) === only))
    .filter((w) => inBudget(budgetPrice(K, w, glassOnly), pick.b, steps) && (!pick.s || sweetOf(w) === pick.s)), [all, q, only, K, pick, steps, glassOnly]);
  const groups = K.groups(shown);
  const glassN = all.filter(K.pathTest).length, uncheckedN = all.filter(unchecked).length;
  // v128: «Верно для раздела» — первое касание переспрашивает, второе подтверждает то, что в разделе видно (с поиском — найденное)
  const [secSure, setSecSure] = React.useState("");
  const [checkMsg, setCheckMsg] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  React.useEffect(() => { if (!secSure) return undefined; const t = setTimeout(() => setSecSure(""), 6000); return () => clearTimeout(t); }, [secSure]);
  React.useEffect(() => { setSecSure(""); }, [q, only, pick]);
  React.useEffect(() => { if (onKeep) onKeep({ q, only, pick }); }, [q, only, pick]);   // eslint-disable-line react-hooks/exhaustive-deps
  const confirmSection = (k, list) => {
    const ids = list.filter(unchecked).map((x) => x.id);
    if (!ids.length || busy) return;
    if (secSure !== k) { setSecSure(k); vibrate("light"); return; }
    setSecSure(""); setBusy(true); setCheckMsg("");
    const recs = all.filter((x) => ids.includes(x.id)).map((x) => K.norm(K.confirm(x, who)));
    const next = K.withRecs(shared, recs);
    rpc("menu_set", { p_token: saToken(), p_restaurant: restaurant, p_dishes: JSON.stringify(next) }).then((res) => {
      setBusy(false);
      if (res && res.ok === true) { if (setShared) setShared(next); rememberSharedMenu(restaurant, next); setCheckMsg("Проверено: " + K.word(recs.length) + ". Команда уже может их учить."); vibrate("success"); }
      else { setCheckMsg("Не сохранилось. Проверь связь и права"); vibrate("error"); }
    }).catch(() => { setBusy(false); setCheckMsg("Нет связи"); vibrate("error"); });
  };
  // v128: шапка не уезжает — строка разделов ушла вверх, сверху её копия
  const frameRef = React.useRef(null), chipsRef = React.useRef(null), searchRef = React.useRef(null);
  const pinBox = usePin(chipsRef, frameRef, view === "list" && !openId && all.length > 0);
  // v129: под копией шапки — в каком разделе ты сейчас; выбранный раздел — в видимой части ленты
  const secNow = useSection(view === "list" && !openId && all.length > 0, "[data-wine-group]", "data-wine-group");
  React.useLayoutEffect(() => { showActiveChip(chipsRef.current); }, [only, view, openId]);   // eslint-disable-line react-hooks/exhaustive-deps
  const swipe = useSwipe();
  const [slide, setSlide] = React.useState("");   // карточка въезжает с той стороны, куда листаешь
  const withPics = all.some((w) => w.img);
  const dishes = React.useMemo(() => { try { return dishesOf(restaurant) || []; } catch (e) { return []; } }, [restaurant, shared]);
  const dishName = (id) => (dishes.find((d) => d && d.id === id) || {}).name || "";
  const head = (title, back, kicker, withEdit = true) => (
    <div style={{ padding: "16px 16px 6px", display: "flex", alignItems: "center", gap: 10 }}>
      <button className="sa-btn" data-lens="back" onClick={back} {...onActivate(back)} aria-label="Назад"
        style={{ border: "none", background: "transparent", color: gold, fontSize: 21, cursor: "pointer", padding: "4px 8px 4px 0" }}>‹</button>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ ...labelStyle(13.5), color: gold }}>{kicker}</div>
        <div style={{ fontFamily: SERIF, fontSize: 21, color: text, lineHeight: 1.15, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{title}</div>
      </div>
      {edit && withEdit ? <button type="button" className="sa-btn" data-lens-btn="soft" data-wine-edit="" onClick={() => { vibrate("light"); onEdit(openId); }}
        style={{ flexShrink: 0, padding: "7px 13px", borderRadius: 999, border: `1px solid ${gold}77`, background: "transparent", color: text, fontFamily: SERIF, fontSize: 13, cursor: "pointer" }}>
        {openId ? "Править" : "Редактор"}</button> : null}
    </div>
  );
  const chip = (on) => ({ flexShrink: 0, padding: "6px 12px", borderRadius: 999, fontSize: 13, fontFamily: SERIF, cursor: "pointer", whiteSpace: "nowrap",
    border: `1px solid ${on ? gold : gold + "44"}`, background: on ? (a11y ? "rgba(139,106,48,0.14)" : "rgba(214,178,102,0.16)") : "transparent", color: on ? text : sub });
  const badge = (t, c) => <span style={{ fontSize: 11.5, padding: "1px 7px", borderRadius: 999, border: `1px solid ${c}88`, color: c, whiteSpace: "nowrap" }}>{t}</span>;

  // ── v123: тренировка ──
  const fresh = React.useMemo(() => newWines(all), [all]);
  const trainN = React.useMemo(() => trainable(all).length, [all]);
  const trainHead = (title, back) => head(title, back, K.t.kicker, false);
  const backTrain = () => setView(trainFrom);   // v129: из строки «Учить» — в карту, из «Ещё» — в тренировку
  const toDeck = (d) => { setDeck({ focus: [], ...d }); setView("deck"); vibrate("light"); };
  const openTrain = (key) => {
    if (["quiz", "pair", "say60", "pron", "team"].includes(key)) { setView(key); return; }
    toDeck(key === "new" ? { key, title: K.t.newOnes, mode: "quiz", only: "new" } : key === "glass" ? { key, title: K.t.pathTitle, mode: "quiz", only: "glass" } : { key: "deck", title: K.t.deck, mode: "deck", only: "all" });
  };
  if (view === "train") return (
    <div style={T.screen} className="sa-screen" data-wine-train-hub="">
      {trainHead("Тренировка", () => (train0 ? onBack() : setView("list")))}
      <WineTrainHub T={T} a11y={a11y} gold={gold} green={green} wines={all} dishes={dishes} restaurant={restaurant} edit={!!edit} onOpen={(key) => { setTrainFrom("train"); openTrain(key); }} onReview={() => onEdit("@review")} K={K} />
    </div>);
  if (view === "deck" && deck) return (
    <WineDeck key={deck.key + ":" + deck.focus.join(",")} K={K} T={T} a11y={a11y} gold={gold} green={green} red={red} wines={all} dishes={dishes} restaurant={restaurant} uk={uk}
      Head={(t) => trainHead(t, backTrain)} title={deck.title} initialMode={deck.mode} initialOnly={deck.only} newIds={fresh.map((x) => x.id)} focusIds={deck.focus}
      onLearned={deck.key === "new" && !allLearned(fresh, learnedIds) ? () => { learn(fresh); wineReport("passed", { ids: fresh.map((x) => x.id) }, all, restaurant, null, K); vibrate("success"); setView(trainFrom); } : null} />);
  if (view === "quiz") return (
    <WineQuiz K={K} T={T} a11y={a11y} gold={gold} green={green} red={red} wines={all} dishes={dishes} restaurant={restaurant} uk={uk} Head={(t) => trainHead(t, backTrain)}
      onRepeat={(ids) => toDeck({ key: "focus", title: "Повторить ошибки", mode: "quiz", only: "focus", focus: ids })} />);
  if (view === "pair") return <WinePairQuiz K={K} T={T} a11y={a11y} gold={gold} green={green} red={red} wines={all} dishes={dishes} restaurant={restaurant} uk={uk} Head={(t) => trainHead(t, backTrain)} />;
  if (view === "say60") return <WineDescribe60 K={K} T={T} a11y={a11y} gold={gold} green={green} red={red} wines={all} dishes={dishes} restaurant={restaurant} uk={uk} Head={(t) => trainHead(t, backTrain)} />;
  if (view === "team") return <WineTeam K={K} T={T} a11y={a11y} gold={gold} green={green} wines={all} restaurant={restaurant} Head={(t) => trainHead(t, backTrain)} />;   // v125
  if (view === "pron") return (
    <PronounceScreen T={T} a11y={a11y} gold={gold} Head={(t) => trainHead(t, backTrain)} glass={wineGlass} ownLabel="Наша карта" ownWhere="в карте:"
      dishes={trainable(all).map((x) => ({ id: x.id, name: K.sayText(x), label: K.title(x) }))} />);

  // ── карточка вина ──
  const w = openId ? all.find((x) => x.id === openId) : null;
  if (w) {
    const pairs = (w.pair || []).map(dishName).filter(Boolean);
    const serve = K.cardServe(w);
    const inCocktails = K.kind === "spirit" ? spiritCocktails(w, cocktails) : [];   // v127: в каких коктейлях нашего бара
    const tp = titleParts(K, w);   // v128: «Русское / Original» — заголовок и строка оригинала
    const sec = (t) => <div style={{ ...labelStyle(13.5), color: gold, margin: "16px 0 6px" }}>{t}</div>;
    // v128: листать подряд — в порядке списка на экране (поиск, раздел, подбор)
    const nav = stepsOf(w.id, groups.flatMap(([, l]) => l), K.groups(all).flatMap(([, l]) => l));
    // v129: листать и пальцем; карточка въезжает с той стороны, куда листаешь
    const goCard = (id, dir) => { setSlide(dir); setOpenId(id); };
    return (
      <div style={T.screen} className="sa-screen" data-wine-card={w.id} {...swipe(nav.prev ? () => goCard(nav.prev.id, "l") : null, nav.next ? () => goCard(nav.next.id, "r") : null)}>
        {head(tp.main, cardBack || (() => setOpenId(null)), fromText || K.t.kicker)}
        <div key={w.id} className={slide === "l" ? "sa-cardpage-l" : slide === "r" ? "sa-cardpage-r" : undefined} style={{ padding: "4px 16px 140px" }}>
          {saved && w.id === startId ? <div role="status" data-wine-saved="" style={{ fontSize: 13.5, color: a11y ? "#2F6B45" : green, lineHeight: 1.45, margin: "0 2px 10px" }}>{saved}</div> : null}
          {w.img ? (
            <div data-wine-photo-big="" style={{ display: "flex", justifyContent: "center", margin: "4px 0 12px" }}>
              <img src={w.img} alt={"Бутылка: " + K.title(w)} decoding="async" style={{ display: "block", maxWidth: "100%", maxHeight: 300, borderRadius: 14, objectFit: "contain",
                border: `1px solid ${gold}44`, boxShadow: a11y ? "0 6px 18px rgba(120,85,25,0.18)" : "0 10px 28px rgba(0,0,0,0.45)" }} />
            </div>) : null}
          <div data-lens-card="" style={{ ...T.modCard, display: "block", padding: "14px 16px", cursor: "default" }}>
            {tp.orig ? <div data-wine-orig="" style={{ fontFamily: SERIF, fontStyle: "italic", fontSize: 14, color: sub, lineHeight: 1.4, marginBottom: 4 }}>{tp.orig}</div> : null}
            {w.producer ? <div style={{ fontSize: 13.5, color: sub }}>{w.producer}</div> : null}
            <div style={{ fontFamily: SERIF, fontSize: 15, color: text, lineHeight: 1.45, marginTop: 4 }}>{K.line(w) || K.t.noDesc(w)}</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
              {K.pathTest(w) ? badge(K.t.pathBadge, gold) : null}
              {w.stop ? badge("сегодня нет", red) : null}
              {w.abv && K.kind !== "spirit" ? badge(String(w.abv).replace(".", ",") + "%", sub) : null}
            </div>
            {K.price(w) ? <div style={{ fontSize: 14, color: text, marginTop: 10 }}>{K.price(w)}</div> : null}
            {onShareChat ? <div style={{ marginTop: 12 }}><ShareChat id={K.kind + ":" + w.id} onClick={() => onShareChat(drinkShareItem(K, w))} gold={gold} text={text} /></div> : null}
          </div>
          {unchecked(w) ? <div data-wine-unchecked="" style={{ marginTop: 10, fontSize: 12.5, lineHeight: 1.5, color: amber }}>
            Не проверено: {w.ai.map((f) => K.FIELD_RU[f] || f).join(", ")}. Это подсказал AI, руководитель ещё не подтвердил.</div> : null}
          {w.short ? <>{sec("Одной фразой гостю")}<div style={{ fontFamily: SERIF, fontStyle: "italic", fontSize: 16, lineHeight: 1.5, color: text }}>«{w.short}»</div></> : null}
          {(w.notes || []).length ? <>{sec("Ноты")}<div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>{w.notes.map((n) => <span key={n} data-lens-tag="" style={{ ...chip(false), cursor: "default", color: text }}>{n}</span>)}</div></> : null}
          {serve ? <>{sec("Подача")}<div style={{ fontSize: 14.5, color: text, lineHeight: 1.5 }}>{serve}</div></> : null}
          {w.story ? <>{sec(K.t.about)}<div style={{ fontSize: 14.5, color: text, lineHeight: 1.6 }}>{w.story}</div></> : null}
          {inCocktails.length ? <>{sec("В коктейлях нашего бара")}<div data-spirit-cocktails={inCocktails.length} style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>{inCocktails.map((c) => {
            const go = () => { if (onOpenCocktail) { vibrate("light"); onOpenCocktail(c.id, w.id); } };   // v128: карточка коктейля здесь же, «назад» вернёт сюда
            return <span key={c.id} role="button" tabIndex={0} data-lens-tag="" data-spirit-cocktail={c.id} onClick={go} {...onActivate(go)} style={{ ...chip(false), color: text, cursor: onOpenCocktail ? "pointer" : "default" }}>{c.name}</span>; })}</div></> : null}
          {pairs.length || w.pairNote ? <>{sec("К блюдам")}
            {pairs.length ? <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>{pairs.map((n) => <span key={n} data-lens-tag="" style={{ ...chip(false), cursor: "default", color: text }}>{n}</span>)}</div> : null}
            {w.pairNote ? <div style={{ fontSize: 13.5, color: sub, lineHeight: 1.5, marginTop: 6 }}>{w.pairNote}</div> : null}</> : null}
          <PrevNext a11y={a11y} gold={gold} text={text} sub={sub} steps={nav} name={(x) => titleParts(K, x).main} onGo={(id) => goCard(id, nav.prev && id === nav.prev.id ? "l" : "r")} />
        </div>
      </div>
    );
  }

  const chipList = (pin) => [["all", "Все"], ...(glassN ? [["glass", K.t.pathChip]] : []), ...colors.map((k) => [k, K.GROUP[k]])].map(([k, t]) => (
    <button key={k} type="button" aria-pressed={only === k} data-wine-only={pin ? undefined : k} data-wine-pin-only={pin ? k : undefined} data-lens-btn={only === k ? "tab" : "soft"} data-lens-ink=""
      onClick={() => { setOnly(k); vibrate("light"); if (pin) scrollToEl(chipsRef.current); }} style={chip(only === k)}>{t}</button>));
  const okText = a11y ? "#2F6B45" : green;
  // v129: что прячет часть карты — строкой под разделами и в копии шапки; «Показать все» сбрасывает раздел, поиск и подбор
  const qt = q.trim(), filtered = only !== "all" || !!qt || pickN > 0;
  const onlyLabel = only === "all" ? "" : only === "glass" ? K.t.pathChip : K.GROUP[only] || "";
  const resetAll = () => { setQ(""); setOnly("all"); setPick({ b: 0, s: "" }); setPickOpen(false); vibrate("light"); };
  const filterNote = (compact) => <FilterNote parts={[onlyLabel, qt ? "по запросу «" + qt + "»" : "", pickN ? "подбор гостю" : ""].filter(Boolean)} n={shown.length} total={all.length}
    onReset={resetAll} gold={gold} text={text} sub={sub} a11y={a11y} compact={compact} />;
  const secList = secNow ? groups.find(([k]) => k === secNow) : null;
  const pinLine = filtered ? filterNote(true) : secList ? <div data-bar-pin-sec={secNow} style={{ ...labelStyle(13), color: a11y ? "#6B4E1A" : gold, marginTop: 5 }}>{K.GROUP[secNow] + " · " + secList[1].length}</div> : null;
  const elsewhere = others && onOther && qt.length >= 2 ? others(qt, K.kind) : [];   // v129: поиск смотрит всю карту
  const firstId = groups.length ? groups[0][1][0].id : null;
  // v129: строка «Учить» — как у коктейлей: каждая кнопка сразу в дело; всё остальное — «Ещё» (прежняя «Тренировка»)
  const learnItems = (() => {
    if (!(trainN >= 2 || (edit && all.length))) return [];
    const hub = () => { remember(); setTrainFrom("train"); setView("train"); };
    const go = (key) => () => { remember(); setTrainFrom("list"); openTrain(key); };
    const hi = fresh.length > 0 && !allLearned(fresh, learnedIds);
    if (trainN < 2) return [{ key: "more", icon: (K.kind === "spirit" ? BUILD_SVG.glass : BUILD_SVG.wineglass)(gold, 18), title: K.t.learn, sub: K.t.trainCheck, wide: true, go: hub, attrs: { "data-wine-train-open": "" } }];
    const sr = (() => { try { return JSON.parse(localStorage.getItem(kKey(K, "sr", restaurant)) || "{}"); } catch (e) { return {}; } })();
    const gp = pathFor(K, all, sr), knownN = trainable(all).filter((x) => srKnown(sr, x.id)).length;
    return [
      hi ? { key: "new", icon: UI_SVG.star(gold, 18), title: K.t.newOnes, sub: K.word(fresh.length) + " за месяц", hi: true, go: go("new") } : null,
      gp.total ? { key: "glass", icon: (K.kind === "spirit" ? BUILD_SVG.glass : BUILD_SVG.wineglass)(gold, 18), title: "С чего начать",
        sub: K.t.pathSum + (gp.known >= gp.total ? ": выучено ✓" : ": " + gp.known + " из " + gp.total), go: go("glass") } : null,
      { key: "deck", icon: GAME_SVG.cards(gold, 18), title: "Колода", sub: knownN ? "выучено " + knownN + " из " + trainN : "карточки с повтором", go: go("deck") },
      { key: "quiz", icon: UI_SVG.quiz(gold, 18), title: "Викторина", sub: "10 вопросов", go: go("quiz") },
      { key: "more", icon: UI_SVG.gradcap(gold, 18), title: "Ещё", sub: "все тренировки", go: hub, attrs: { "data-wine-train-open": hi ? "new" : "" } },
    ].filter(Boolean);
  })();
  return (
    <div ref={frameRef} style={T.screen} className="sa-screen" data-wine-list={all.length} data-drink-kind={K.kind}>
      {head(listTitle, onBack, "Справочник · " + restaurant)}
      {tabs}
      {som}
      <BarPin box={pinBox} a11y={a11y} gold={gold} tabs={pinTabs} chips={chipList(true)} onSearch={() => focusSearch(searchRef.current)} line={pinLine} active={only} />
      <div style={{ padding: "0 16px 140px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "2px 2px 10px" }}>
          <div style={{ flex: 1, minWidth: 0, fontSize: 13.5, color: sub }} data-wine-sum="">
            {all.length ? K.word(all.length) + (glassN ? " · " + K.t.pathSum + " " + glassN : "")
              : edit ? K.t.emptyEdit : K.t.empty}
          </div>
          {onPrint && all.length ? <PrintLink gold={gold} text={text} a11y={a11y}
            onClick={() => { remember(); onPrint(filtered && shown.length ? { kind: K.kind, ids: shown.map((x) => x.id), label: [onlyLabel, qt ? "по запросу «" + qt + "»" : "", pickN ? "подбор гостю" : ""].filter(Boolean).join(", ") } : { kind: K.kind }); }} /> : null}
        </div>
        {saved && startId && !all.some((x) => x.id === startId) ? <div role="status" data-wine-saved="" style={{ fontSize: 13.5, color: okText, lineHeight: 1.45, margin: "0 2px 10px" }}>{saved}</div> : null}
        {!all.length && edit ? <button type="button" className="sa-btn" data-lens-btn="main" onClick={() => onEdit(null)}
          style={{ ...T.doneBtn, width: "100%", margin: "4px 0 0", background: gold, color: "#1A1008" }}>{K.t.add}</button> : null}
        {/* v128: руководителю — сколько ждёт проверки: команда учит только проверенные */}
        {edit && uncheckedN ? (
          <div className="sa-card" data-lens-card="" data-wine-check-banner={uncheckedN} style={{ ...T.modCard, display: "block", cursor: "default", margin: "0 0 12px", padding: "13px 15px", border: `1px solid ${amber}88` }}>
            <div style={{ fontFamily: SERIF, fontSize: 16, color: text, lineHeight: 1.3 }}>{checkWord(K, uncheckedN)}</div>
            <div style={{ fontSize: 13, color: sub, lineHeight: 1.5, marginTop: 4 }}>Команда учит только проверенные: сейчас {K.word(trainN)} из {all.length}. Проверь подряд или раздел целиком: «Верно для раздела» у его названия.</div>
            <button type="button" className="sa-btn" data-lens-btn="main" data-wine-check-go="" onClick={() => { vibrate("light"); onEdit("@review"); }}
              style={{ ...T.doneBtn, width: "100%", margin: "10px 0 0", background: gold, color: "#1A1008", padding: "10px 12px", fontSize: 14 }}>Проверить подряд</button>
          </div>) : null}
        {checkMsg ? <div data-wine-check-msg="" style={{ fontSize: 13.5, lineHeight: 1.45, color: /^Проверено/.test(checkMsg) ? okText : red, margin: "0 2px 10px" }}>{checkMsg}</div> : null}
        <LearnStrip T={T} items={learnItems} gold={gold} />
        {all.length ? <>
          <div style={{ display: "flex", gap: 8, alignItems: "stretch" }}>
            <SearchField inputRef={searchRef} value={q} onChange={setQ} placeholder={K.t.searchPh} aria={K.t.searchAria} a11y={a11y} gold={gold} text={text} />
            {steps || sweets.length ? <button type="button" className="sa-btn" data-wine-pick-open={pickN} aria-pressed={pickOpen} aria-expanded={pickOpen} data-lens-btn={pickOpen || pickN ? "tab" : "soft"} data-lens-ink=""
              onClick={() => { setPickOpen((v) => !v); vibrate("light"); }} style={{ ...chip(pickOpen || pickN > 0), flexShrink: 0, padding: "0 14px", fontSize: 13.5 }}>{pickN ? "Подобрать · " + pickN : "Подобрать"}</button> : null}
          </div>
          {pickOpen ? (
            <div data-wine-pick="" data-lens-card="" style={{ ...T.modCard, display: "block", cursor: "default", margin: "10px 0 0", padding: "10px 13px 12px" }}>
              <div style={{ fontFamily: SERIF, fontSize: 15, color: text, margin: "2px 0 2px" }}>Подобрать гостю</div>
              {steps ? <>
                <div style={{ ...labelStyle(13), color: gold, margin: "8px 0 6px" }}>{K.kind === "spirit" ? "Бюджет за порцию" : glassOnly ? "Бюджет за бокал" : "Бюджет за бутылку"}</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>{budgetLabels(steps).map((t, i) => (
                  <button key={i} type="button" data-wine-budget={i + 1} aria-pressed={pick.b === i + 1} data-lens-btn={pick.b === i + 1 ? "tab" : "soft"} data-lens-ink=""
                    onClick={() => { setPick((p) => ({ ...p, b: p.b === i + 1 ? 0 : i + 1 })); vibrate("light"); }} style={chip(pick.b === i + 1)}>{t}</button>))}</div></> : null}
              {sweets.length ? <>
                <div style={{ ...labelStyle(13), color: gold, margin: "10px 0 6px" }}>Сладость</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>{sweets.map(([g, t]) => (
                  <button key={g} type="button" data-wine-sweet={g} aria-pressed={pick.s === g} data-lens-btn={pick.s === g ? "tab" : "soft"} data-lens-ink=""
                    onClick={() => { setPick((p) => ({ ...p, s: p.s === g ? "" : g })); vibrate("light"); }} style={chip(pick.s === g)}>{t}</button>))}</div></> : null}
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 10 }}>
                <span data-wine-pick-n={pickN ? shown.length : ""} style={{ flex: 1, fontSize: 13.5, color: pickN ? text : sub }}>{pickN ? "Нашлось: " + K.word(shown.length) : "Выбери бюджет" + (sweets.length ? " или сладость" : "")}</span>
                {pickN ? <button type="button" className="sa-btn" data-wine-pick-reset="" data-lens-btn="soft" data-lens-ink="" onClick={() => { setPick({ b: 0, s: "" }); vibrate("light"); }} style={{ ...chip(false), color: text }}>Сбросить</button> : null}
              </div>
            </div>) : null}
          <div ref={chipsRef} className="sa-hscroll" role="group" aria-label="Показать" style={{ display: "flex", gap: 6, overflowX: "auto", padding: "10px 0 4px" }}>
            {chipList(false)}
          </div>
          {filtered ? filterNote(false) : null}
          {!shown.length ? <div data-bar-none={elsewhere.length ? "here" : "all"} style={{ fontSize: 14, color: sub, padding: elsewhere.length ? "14px 2px 2px" : "18px 2px" }}>{elsewhere.length ? "Здесь не нашлось." : "Ничего не нашлось."}</div> : null}
          {groups.map(([k, list]) => {
            const un = edit ? list.filter(unchecked).length : 0;
            return (
            <div key={k} data-wine-group={k}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "14px 2px 6px" }}>
                <div style={{ ...labelStyle(13.5), color: gold, flex: 1, minWidth: 0 }}>{K.GROUP[k]} · {list.length}</div>
                {un ? <button type="button" className="sa-btn" data-wine-sec-ok={k} data-wine-sec-sure={secSure === k ? "1" : undefined} data-lens-btn={secSure === k ? "main" : "soft"} data-lens-ink="" disabled={busy}
                  onClick={() => confirmSection(k, list)} style={{ ...chip(secSure === k), flexShrink: 0, padding: "4px 11px", fontSize: 12.5, ...(secSure === k ? { color: text, borderColor: gold } : {}) }}>
                  {secSure === k ? "Подтвердить " + un + "? Коснись ещё раз" : "Верно для раздела: " + un}</button> : null}
              </div>
              {list.map((x) => {
                const open = () => { vibrate("light"); remember(); setSlide(""); setOpenId(x.id); };
                const tp = titleParts(K, x);
                return (
                  <div key={x.id} id={x.id === firstId ? "sa-bar-row1" : undefined} role="button" tabIndex={0} data-wine-row={x.id} data-lens-card="" onClick={open} {...onActivate(open)}
                    style={{ ...T.modCard, display: "flex", gap: 12, alignItems: "center", padding: "11px 12px 11px 14px", marginBottom: 8, opacity: x.stop ? 0.6 : 1 }}>
                    {withPics ? <WineThumb w={x} gold={gold} a11y={a11y} /> : null}
                    <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                      <span style={{ flex: 1, minWidth: 0 }}>
                        <span style={{ display: "block", fontFamily: SERIF, fontSize: 15.5, color: text, lineHeight: 1.3 }}>{tp.main}</span>
                        {tp.orig ? <span data-wine-orig="" style={{ display: "block", fontFamily: SERIF, fontStyle: "italic", fontSize: 12.5, color: sub, lineHeight: 1.35, marginTop: 1 }}>{tp.orig}</span> : null}
                      </span>
                      {K.pathTest(x) ? badge(K.t.pathBadge, gold) : null}
                      {x.stop ? badge("сегодня нет", red) : null}
                    </div>
                    {K.line(x) ? <div style={{ fontSize: 12.5, color: sub, marginTop: 3, lineHeight: 1.4 }}>{K.line(x)}</div> : null}
                    {K.price(x) || unchecked(x) ? <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 4 }}>
                      {K.price(x) ? <span style={{ fontSize: 12.5, color: text }}>{K.price(x)}</span> : null}
                      {unchecked(x) ? <span data-wine-ai-tag="" title="Это дописал AI, руководитель ещё не проверил" style={{ fontSize: 11, lineHeight: 1.45, padding: "0 6px", borderRadius: 999, border: `1px solid ${sub}88`, color: sub }}>AI</span> : null}
                    </div> : null}
                    </div>
                    <Chevron gold={gold} />
                  </div>
                );
              })}
            </div>);
          })}
          {filtered && shown.length ? <EndNote text={only !== "all" && !qt && !pickN ? "Это весь раздел «" + onlyLabel + "»" : "Это всё, что нашлось"} button={K.t.showAll} onClick={resetAll} gold={gold} sub={sub} a11y={a11y} /> : null}
          <Elsewhere groups={elsewhere} none={!shown.length} onOpen={(tab, id) => onOther(tab, id, qt)} onAll={(tab) => onSearchIn(tab, qt)} T={T} gold={gold} text={text} sub={sub} />
          <BarHint a11y={a11y} ready={shown.length > 0} has={{ tabs: !!tabs, row: !!firstId, learn: learnItems.length > 0 }} />
        </> : null}
      </div>
    </div>
  );
}
