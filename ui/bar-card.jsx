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
import React from "react";
import { GOLD, labelStyle } from "./tokens";
import { onActivate, vibrate } from "../lib/utils";
import { WineListScreen, useTeamMenu, canEditWines, useInnerTop } from "./wine-list";
import { ourCocktails, findCocktails, groupByBase, cocktailsWord, GLASS_SHORT } from "../lib/bar-card";
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
import { usePin, BarPin, scrollToEl, focusSearch, toTop, useBackToRow, stepsOf, PrevNext } from "./bar-pin";

const SERIF = "Georgia, 'Times New Roman', serif";
const TAB_KEY = "sa_bar_tab";
const TABS = [["cocktail", "Коктейли"], ["wine", "Вина"], ["spirit", "Крепкое"]];
const readTab = () => { try { return localStorage.getItem(TAB_KEY) || ""; } catch (e) { return ""; } };
const saveTab = (t) => { try { localStorage.setItem(TAB_KEY, t); } catch (e) {} };

// startTab + startId — открыть карточку (вина, крепкого; со startTab "cocktail" — коктейля); note — строка под её заголовком
export function BarCardScreen({ T, a11y, profile, onBack, onEdit, startTab = null, startId = null, note = "", onOpenCocktail = null, onBuildCocktail = null, onCocktailDeck = null, onBarLab = null, onCocktailEdit = null }) {
  const gold = a11y ? "#7A5D2A" : GOLD, text = T.modTitle.color, sub = T.modSub.color;
  const restaurant = (profile && profile.restaurant) || "";
  const edit = canEditWines(profile) && !!onEdit;
  const team = useTeamMenu(restaurant);
  const shared = team[0];
  const cocktails = React.useMemo(() => ourCocktails(shared), [shared]);
  const winesN = React.useMemo(() => wineRecords(shared).filter((w) => !w.archived).length, [shared]);
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
  const setTab = (k, pin = false) => { setTab0(k); setStart({ tab: null, id: null, back: null }); vibrate("light"); if (pin) toTop(false); };   // из копии сверху — новая вкладка с начала
  const openIn = (k, id, back) => { setStart({ tab: k, id, back }); setTab0(k); };
  const jump = (k) => (id, from) => openIn(k, id, from ? { tab: cur, id: from, back: start.tab === cur ? start.back : null } : null);
  const backFor = (k) => (start.tab === k && start.back ? () => { vibrate("light"); openIn(start.back.tab, start.back.id, start.back.back); } : null);
  const startFor = (k) => (start.tab === k ? start.id : null);
  React.useEffect(() => { saveTab(cur); }, [cur]);   // вернулся из редактора или колоды — та же вкладка
  // v128: вкладки — и в копии шапки сверху (ui/bar-pin.jsx); у копии свои метки, чтобы не путать с вкладками на месте
  const tabBar = (pin) => (avail.length > 1 ? (
    <div role="tablist" aria-label="Барная карта" data-bar-tabs={pin ? undefined : avail.join(",")} data-bar-pin-tabs={pin ? avail.join(",") : undefined} data-lens-seg="flat"
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

  if (cur === "wine" || cur === "spirit") return (
    <WineListScreen key={cur} kind={cur} T={T} a11y={a11y} profile={profile} onBack={onBack} team={team} tabs={tabs} pinTabs={pinTabs} listTitle="Барная карта"
      startId={startFor(cur)} cardBack={backFor(cur)} note={startFor(cur) && startFor(cur) === startId ? note : ""}
      onEdit={onEdit ? (id) => onEdit(cur, id) : undefined} cocktails={cocktails} onOpenCocktail={cocktails.length ? jump("cocktail") : null} />);
  return <BarCocktails T={T} a11y={a11y} gold={gold} text={text} sub={sub} restaurant={restaurant} cocktails={cocktails} spirits={spirits} tabs={tabs} pinTabs={pinTabs} onBack={onBack}
    startId={startFor("cocktail")} cardBack={backFor("cocktail")} onOpenSpirit={avail.includes("spirit") ? jump("spirit") : null}
    onLearn={onOpenCocktail} onBuild={onBuildCocktail} onCocktailDeck={onCocktailDeck} onBarLab={onBarLab} onCocktailEdit={edit ? onCocktailEdit : null} />;
}

// ─────────────────────────────── КОКТЕЙЛИ НАШЕГО БАРА
const SR_KEY = "sa_cocktail_sr";   // «Знаю?» колоды бармена (ui/cocktails.jsx)
const knownOf = (list) => { try { const sr = JSON.parse(localStorage.getItem(SR_KEY) || "{}"), now = Date.now(); return list.filter((c) => { const r = sr[c.id]; return r && r.stage > 0 && r.due > now; }).length; } catch (e) { return 0; } };
const dots = (n) => "●".repeat(n) + "○".repeat(Math.max(0, 4 - n));
// граммовка: число и единица неразрывно; «доверху» — без числа
const amount = (i) => (i[1] === "" || i[1] == null ? "" : i[2] === "доверху" ? "доверху" : i[1] + " " + (i[2] || "мл"));

function BarCocktails({ T, a11y, gold, text, sub, restaurant, cocktails, spirits, tabs, pinTabs, onBack, startId, cardBack, onOpenSpirit, onLearn, onBuild, onCocktailDeck, onBarLab, onCocktailEdit }) {
  const red = a11y ? "#A33A2A" : "#E07878";
  const [q, setQ] = React.useState("");
  const [only, setOnly] = React.useState("all");
  const [openId, setOpenId] = React.useState(startId || null);   // v128: карточка коктейля — здесь же
  const found = findCocktails(cocktails, q);
  const groups = groupByBase(found);
  const shown = only === "all" ? groups : groups.filter(([k]) => k === only);
  const houseN = cocktails.filter((c) => c.house).length;
  const known = React.useMemo(() => knownOf(cocktails), [cocktails]);
  const c = openId ? cocktails.find((x) => x.id === openId) || null : null;
  const remember = useInnerTop(c ? "card:" + c.id : "list");   // список — где был, карточка — сверху
  useBackToRow(c ? c.id : null, (id) => '[data-bar-ck="' + id + '"]');
  const frameRef = React.useRef(null), chipsRef = React.useRef(null), searchRef = React.useRef(null);
  const pinBox = usePin(chipsRef, frameRef, !c && cocktails.length > 0);
  const chip = (on) => ({ flexShrink: 0, padding: "6px 12px", borderRadius: 999, fontSize: 13, fontFamily: SERIF, cursor: "pointer", whiteSpace: "nowrap",
    border: `1px solid ${on ? gold : gold + "44"}`, background: on ? (a11y ? "rgba(139,106,48,0.14)" : "rgba(214,178,102,0.16)") : "transparent", color: on ? text : sub });
  const badge = (t, col) => <span style={{ fontSize: 11.5, padding: "1px 7px", borderRadius: 999, border: `1px solid ${col}88`, color: col, whiteSpace: "nowrap" }}>{t}</span>;
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
      <div style={T.screen} className="sa-screen" data-bar-ck-card={c.id}>
        {head("Коктейли", c.name, close, c.house && onCocktailEdit ? editBtn(() => onCocktailEdit(c.full ? c.id : null, c.id), { "data-bar-ck-edit": "card" }, "Править") : null)}
        <div style={{ padding: "4px 16px 140px" }}>
          <div data-lens-card="" style={{ ...T.modCard, display: "flex", gap: 14, alignItems: "center", padding: "12px 16px", cursor: "default", opacity: c.stop ? 0.75 : 1 }}>
            {Array.isArray(c.color) ? <div data-bar-ck-art="big" aria-hidden="true" style={{ width: 76, flexShrink: 0, display: "flex", justifyContent: "center" }}><CocktailArt c={c} w={76} light={a11y} /></div> : null}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontFamily: SERIF, fontSize: 15.5, color: text, lineHeight: 1.4 }}>{[GLASS_RU[c.glass] || "", c.method || ""].filter(Boolean).join(" · ")}</div>
              {c.strength || c.sweet ? <div style={{ fontSize: 12.5, color: sub, marginTop: 4, lineHeight: 1.5 }}>
                {c.strength ? <span style={{ whiteSpace: "nowrap" }}>крепость <span style={{ color: gold, letterSpacing: 1 }}>{dots(c.strength)}</span></span> : null}
                {c.strength && c.sweet ? " · " : null}
                {c.sweet ? <span style={{ whiteSpace: "nowrap" }}>сладость <span style={{ color: gold, letterSpacing: 1 }}>{dots(c.sweet)}</span></span> : null}
              </div> : null}
              {c.house || c.stop ? <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 6 }}>{c.house ? badge("свой", gold) : null}{c.stop ? badge("сегодня нет", red) : null}</div> : null}
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
          {howTo.length ? <>{sec(seq ? "Как готовить · " + howTo.length + " шагов, как в лаборатории" : "Как готовить")}
            <ol data-bar-ck-how={howTo.length} style={{ margin: 0, paddingLeft: 22, color: text, fontSize: 14.5, lineHeight: 1.55 }}>
              {howTo.map((s, k) => <li key={k} style={{ paddingLeft: 2, marginBottom: 2 }}>{s.glyph ? <span style={{ color: gold, marginRight: 6, fontSize: 11 }}>{s.glyph}</span> : null}{s.label}</li>)}
            </ol></> : null}
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
          <PrevNext a11y={a11y} gold={gold} text={text} sub={sub} steps={nav} name={(x) => x.name} onGo={(id) => setOpenId(id)} />
        </div>
      </div>);
  }

  // v128: колода и лаборатория — две кнопки рядом, по касанию сразу туда. Ширина — по названию (min-content): не влезают оба
  // целиком (320 px в «Для чтения») — друг под другом, а не «Лаборато…»
  const learnBtn = (key, icon, title, subText, go) => go ? (
    <div className="sa-card" role="button" tabIndex={0} data-bar-learn={key} data-lens-card="" onClick={() => { vibrate("light"); go(); }} {...onActivate(() => { vibrate("light"); go(); })}
      style={{ ...T.modCard, flex: "1 1 0", minWidth: "min-content", margin: 0, padding: "10px 12px", gap: 9 }}>
      <span aria-hidden="true" style={{ flexShrink: 0, display: "flex" }}>{icon}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ ...T.modTitle, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{title}</div>
        <div style={{ ...T.modSub, whiteSpace: "normal", lineHeight: 1.35 }}>{subText}</div>
      </div>
    </div>) : null;
  const open = (x) => () => { vibrate("light"); remember(); setOpenId(x.id); };
  const chipList = (pin) => [["all", "Все"], ...groups.map(([k]) => [k, k])].map(([k, t]) => (
    <button key={k} type="button" aria-pressed={only === k} data-bar-ck-only={pin ? undefined : k} data-bar-pin-ck={pin ? k : undefined} data-lens-btn={only === k ? "tab" : "soft"} data-lens-ink=""
      onClick={() => { setOnly(k); vibrate("light"); if (pin) scrollToEl(chipsRef.current); }} style={chip(only === k)}>{t}</button>));
  return (
    <div ref={frameRef} style={T.screen} className="sa-screen" data-bar-cocktails={cocktails.length}>
      {head("Справочник · " + restaurant, "Барная карта", onBack, onCocktailEdit ? editBtn(() => onCocktailEdit(null), { "data-bar-ck-edit": "" }, "Редактор") : null)}
      {tabs}
      <BarPin box={pinBox} a11y={a11y} gold={gold} tabs={pinTabs} chips={chipList(true)} onSearch={() => focusSearch(searchRef.current)} />
      <div style={{ padding: "0 16px 140px" }}>
        <div data-bar-ck-sum="" style={{ fontSize: 13.5, color: sub, margin: "2px 2px 10px" }}>{cocktailsWord(cocktails.length) + (houseN ? " · свои " + houseN : "")}</div>
        {onCocktailDeck || onBarLab ? <div data-bar-learn-row="" style={{ display: "flex", flexWrap: "wrap", gap: 8, margin: "0 0 12px" }}>
          {learnBtn("deck", GAME_SVG.cards(gold, 20), "Колода", known ? "выучено " + known + " из " + cocktails.length : "карточки с повтором", onCocktailDeck)}
          {learnBtn("lab", BUILD_SVG.glass(gold, 20), "Лаборатория", "собрать руками", onBarLab)}
        </div> : null}
        <input ref={searchRef} data-lens-field="" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Коктейль или ингредиент" aria-label="Поиск по коктейлям"
          style={{ width: "100%", boxSizing: "border-box", padding: "11px 14px", borderRadius: 14, border: `1px solid ${gold}55`, background: a11y ? "rgba(255,255,255,0.55)" : "rgba(0,0,0,0.22)", color: text, fontSize: 14.5, fontFamily: SERIF, outline: "none", marginTop: 4 }} />
        <div ref={chipsRef} className="sa-hscroll" role="group" aria-label="Показать" style={{ display: "flex", gap: 6, overflowX: "auto", padding: "10px 0 4px" }}>
          {chipList(false)}
        </div>
        {!found.length ? <div data-bar-ck-none="" style={{ fontSize: 14, color: sub, padding: "18px 2px" }}>{cocktails.length ? "Ничего не нашлось." : "В карте бара пока нет коктейлей."}</div> : null}
        {shown.map(([k, list]) => (
          <div key={k} data-bar-ck-group={k}>
            <div style={{ ...labelStyle(13.5), color: gold, margin: "14px 2px 6px" }}>{k} · {list.length}</div>
            {list.map((x) => {
              const go = open(x);
              const ours = cocktailSpirits(x, spirits);
              const line = [x.method, GLASS_SHORT[x.glass] || ""].filter(Boolean).join(" · ");
              return (
                <div key={x.id} role="button" tabIndex={0} data-bar-ck={x.id} data-lens-card="" onClick={go} {...onActivate(go)} style={{ ...T.modCard, display: "flex", gap: 12, alignItems: "center", padding: "9px 14px 9px 10px", marginBottom: 8, opacity: x.stop ? 0.6 : 1 }}>
                  {Array.isArray(x.color) ? <div data-bar-ck-art="" aria-hidden="true" style={{ width: 40, height: 52, flexShrink: 0, display: "flex", alignItems: "flex-end", justifyContent: "center" }}><CocktailArt c={x} w={40} light={a11y} showIce={false} /></div> : null}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                      <span style={{ flex: 1, minWidth: 0, fontFamily: SERIF, fontSize: 15.5, color: text, lineHeight: 1.3 }}>{x.name}</span>
                      {x.house ? badge("свой", gold) : null}
                      {x.stop ? badge("сегодня нет", red) : null}
                    </div>
                    {line ? <div style={{ fontSize: 12.5, color: sub, marginTop: 3, lineHeight: 1.4 }}>{line}</div> : null}
                    {ours.length ? <div data-bar-ck-spirits={ours.length} style={{ fontSize: 12.5, color: text, marginTop: 3, lineHeight: 1.4 }}>Из нашей карты: {ours.slice(0, 3).map(spiritTitle).join(", ")}{ours.length > 3 ? " и ещё " + (ours.length - 3) : ""}</div> : null}
                  </div>
                  <div style={T.modArrow} aria-hidden="true">›</div>
                </div>);
            })}
          </div>))}
      </div>
    </div>);
}
