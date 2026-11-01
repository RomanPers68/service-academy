// ui/bar-card.jsx — v127 (Доп. 440): «Барная карта» — коктейли, вина и крепкое нашего бара под одной кнопкой.
//
// Владелец (01.11): «стоит ли сделать одну общую кнопку «Барное меню» или «Барная карта», и закинуть туда вина, коктейли,
// крепыш?», «Общая карта, вина и крепкое» и «Да, делаем». В Справочнике вместо «Нашей винной карты» и «Бар: коктейли» —
// одна «Барная карта». Наверху вкладки «Коктейли · Вина · Крепкое»; открывается та, где был в прошлый раз. Вина и крепкое —
// общий экран (ui/wine-list.jsx: список, карточка, тренировка; руководителю — редактор); коктейли — список нашего бара по
// основе, касание открывает коктейль в «Колоде бармена», внизу — какое крепкое из нашей карты в нём; учить — «Колода
// бармена» и «Бар-лаборатория», как раньше.
import React from "react";
import { GOLD, labelStyle } from "./tokens";
import { onActivate, vibrate } from "../lib/utils";
import { WineListScreen, useTeamMenu, canEditWines } from "./wine-list";
import { ourCocktails, findCocktails, groupByBase, cocktailsWord, GLASS_SHORT } from "../lib/bar-card";
import { wineRecords } from "../lib/wine";
import { spiritRecords, spiritTitle } from "../lib/spirit";
import { cocktailSpirits } from "../lib/spirit-cocktails";
import { GAME_SVG, BUILD_SVG } from "./icons";

const SERIF = "Georgia, 'Times New Roman', serif";
const TAB_KEY = "sa_bar_tab";
const TABS = [["cocktail", "Коктейли"], ["wine", "Вина"], ["spirit", "Крепкое"]];
const readTab = () => { try { return localStorage.getItem(TAB_KEY) || ""; } catch (e) { return ""; } };
const saveTab = (t) => { try { localStorage.setItem(TAB_KEY, t); } catch (e) {} };

export function BarCardScreen({ T, a11y, profile, onBack, onEdit, startTab = null, startId = null, onOpenCocktail = null, onCocktailDeck = null, onBarLab = null, onCocktailEdit = null }) {
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
  const first = () => {
    if (startTab && avail.includes(startTab)) return startTab;
    if (startId) return String(startId).startsWith("sp-") ? "spirit" : "wine";
    const r = readTab(); return avail.includes(r) ? r : avail[0] || "cocktail";
  };
  const [tab, setTab0] = React.useState(first);
  const cur = avail.includes(tab) ? tab : avail[0] || "cocktail";
  const setTab = (k) => { setTab0(k); vibrate("light"); };
  React.useEffect(() => { saveTab(cur); }, [cur]);   // вернулся из редактора или колоды — та же вкладка
  const tabs = avail.length > 1 ? (
    <div role="tablist" aria-label="Барная карта" data-bar-tabs={avail.join(",")} data-lens-seg="flat" style={{ display: "flex", gap: 4, margin: "2px 16px 12px", padding: 3, borderRadius: 999,
      border: `1px solid ${a11y ? "rgba(139,106,48,0.35)" : "rgba(214,178,102,0.35)"}`, background: a11y ? "rgba(255,255,255,0.45)" : "rgba(255,248,230,0.05)" }}>
      {TABS.filter(([k]) => avail.includes(k)).map(([k, t]) => {
        const on = cur === k;
        return <button key={k} type="button" role="tab" aria-selected={on} aria-pressed={on} data-bar-tab={k} data-lens-btn={on ? "tab" : undefined} onClick={() => setTab(k)}
          style={{ flex: 1, padding: "8px 6px", borderRadius: 999, border: "none", cursor: "pointer", fontFamily: SERIF, fontSize: 14, whiteSpace: "nowrap",
            background: on ? `linear-gradient(180deg,#E4C88C,${gold})` : "transparent", color: on ? "#1a160f" : sub, fontWeight: on ? "bold" : "normal" }}>{t}</button>;
      })}
    </div>) : null;

  if (cur === "wine" || cur === "spirit") return (
    <WineListScreen key={cur} kind={cur} T={T} a11y={a11y} profile={profile} onBack={onBack} team={team} tabs={tabs} listTitle="Барная карта"
      startId={startId && (cur === "spirit") === String(startId).startsWith("sp-") ? startId : startId === "@train" && cur === "wine" ? startId : null}
      onEdit={onEdit ? (id) => onEdit(cur, id) : undefined} cocktails={cocktails} onOpenCocktail={onOpenCocktail} />);
  return <BarCocktails T={T} a11y={a11y} gold={gold} text={text} sub={sub} restaurant={restaurant} cocktails={cocktails} spirits={spirits} tabs={tabs} onBack={onBack}
    onOpenCocktail={onOpenCocktail} onCocktailDeck={onCocktailDeck} onBarLab={onBarLab} onCocktailEdit={edit ? onCocktailEdit : null} />;
}

// ─────────────────────────────── КОКТЕЙЛИ НАШЕГО БАРА
function BarCocktails({ T, a11y, gold, text, sub, restaurant, cocktails, spirits, tabs, onBack, onOpenCocktail, onCocktailDeck, onBarLab, onCocktailEdit }) {
  const red = a11y ? "#A33A2A" : "#E07878";
  const [q, setQ] = React.useState("");
  const [only, setOnly] = React.useState("all");
  const found = findCocktails(cocktails, q);
  const groups = groupByBase(found);
  const shown = only === "all" ? groups : groups.filter(([k]) => k === only);
  const houseN = cocktails.filter((c) => c.house).length;
  const chip = (on) => ({ flexShrink: 0, padding: "6px 12px", borderRadius: 999, fontSize: 13, fontFamily: SERIF, cursor: "pointer", whiteSpace: "nowrap",
    border: `1px solid ${on ? gold : gold + "44"}`, background: on ? (a11y ? "rgba(139,106,48,0.14)" : "rgba(214,178,102,0.16)") : "transparent", color: on ? text : sub });
  const badge = (t, c) => <span style={{ fontSize: 11.5, padding: "1px 7px", borderRadius: 999, border: `1px solid ${c}88`, color: c, whiteSpace: "nowrap" }}>{t}</span>;
  const iconBox = { width: 38, height: 38, borderRadius: 12, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", background: a11y ? "rgba(200,150,50,0.14)" : "rgba(200,169,110,0.13)", marginRight: 4 };
  const learnRow = (key, icon, title, subText, go) => go ? (
    <div className="sa-card" role="button" tabIndex={0} data-bar-learn={key} data-lens-card="" onClick={() => { vibrate("light"); go(); }} {...onActivate(() => { vibrate("light"); go(); })} style={{ ...T.modCard, margin: "0 0 10px" }}>
      <div style={iconBox}>{icon}</div>
      <div style={{ flex: 1, minWidth: 0 }}><div style={T.modTitle}>{title}</div><div style={{ ...T.modSub, whiteSpace: "normal" }}>{subText}</div></div>
      <div style={T.modArrow}>›</div>
    </div>) : null;
  return (
    <div style={T.screen} className="sa-screen" data-bar-cocktails={cocktails.length}>
      <div style={{ padding: "16px 16px 6px", display: "flex", alignItems: "center", gap: 10 }}>
        <button className="sa-btn" data-lens="back" onClick={onBack} {...onActivate(onBack)} aria-label="Назад" style={{ border: "none", background: "transparent", color: gold, fontSize: 21, cursor: "pointer", padding: "4px 8px 4px 0" }}>‹</button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ ...labelStyle(13.5), color: gold }}>Справочник · {restaurant}</div>
          <div style={{ fontFamily: SERIF, fontSize: 21, color: text, lineHeight: 1.15 }}>Барная карта</div>
        </div>
        {onCocktailEdit ? <button type="button" className="sa-btn" data-lens-btn="soft" data-bar-ck-edit="" onClick={() => { vibrate("light"); onCocktailEdit(); }}
          style={{ flexShrink: 0, padding: "7px 13px", borderRadius: 999, border: `1px solid ${gold}77`, background: "transparent", color: text, fontFamily: SERIF, fontSize: 13, cursor: "pointer" }}>Редактор</button> : null}
      </div>
      {tabs}
      <div style={{ padding: "0 16px 140px" }}>
        <div data-bar-ck-sum="" style={{ fontSize: 13.5, color: sub, margin: "2px 2px 10px" }}>{cocktailsWord(cocktails.length) + (houseN ? " · свои " + houseN : "")}</div>
        {learnRow("deck", GAME_SVG.cards(gold, 20), "Колода бармена", "Состав, метод и история; «Знаю?» с повтором", onCocktailDeck)}
        {learnRow("lab", BUILD_SVG.glass(gold, 20), "Бар-лаборатория", "Собери коктейль руками: бокал, лёд, порции", onBarLab)}
        <input data-lens-field="" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Коктейль или ингредиент" aria-label="Поиск по коктейлям"
          style={{ width: "100%", boxSizing: "border-box", padding: "11px 14px", borderRadius: 14, border: `1px solid ${gold}55`, background: a11y ? "rgba(255,255,255,0.55)" : "rgba(0,0,0,0.22)", color: text, fontSize: 14.5, fontFamily: SERIF, outline: "none", marginTop: 4 }} />
        <div className="sa-hscroll" role="group" aria-label="Показать" style={{ display: "flex", gap: 6, overflowX: "auto", padding: "10px 0 4px" }}>
          {[["all", "Все"], ...groups.map(([k]) => [k, k])].map(([k, t]) => (
            <button key={k} type="button" aria-pressed={only === k} data-bar-ck-only={k} data-lens-btn={only === k ? "tab" : "soft"} data-lens-ink="" onClick={() => { setOnly(k); vibrate("light"); }} style={chip(only === k)}>{t}</button>))}
        </div>
        {!found.length ? <div data-bar-ck-none="" style={{ fontSize: 14, color: sub, padding: "18px 2px" }}>{cocktails.length ? "Ничего не нашлось." : "В карте бара пока нет коктейлей."}</div> : null}
        {shown.map(([k, list]) => (
          <div key={k} data-bar-ck-group={k}>
            <div style={{ ...labelStyle(13.5), color: gold, margin: "14px 2px 6px" }}>{k} · {list.length}</div>
            {list.map((c) => {
              const go = () => { if (onOpenCocktail) { vibrate("light"); onOpenCocktail(c.id); } };
              const ours = cocktailSpirits(c, spirits);
              const line = [c.method, GLASS_SHORT[c.glass] || ""].filter(Boolean).join(" · ");
              return (
                <div key={c.id} role="button" tabIndex={0} data-bar-ck={c.id} data-lens-card="" onClick={go} {...onActivate(go)} style={{ ...T.modCard, display: "block", padding: "11px 14px", marginBottom: 8, opacity: c.stop ? 0.6 : 1 }}>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                    <span style={{ flex: 1, minWidth: 0, fontFamily: SERIF, fontSize: 15.5, color: text, lineHeight: 1.3 }}>{c.name}</span>
                    {c.house ? badge("свой", gold) : null}
                    {c.stop ? badge("сегодня нет", red) : null}
                  </div>
                  {line ? <div style={{ fontSize: 12.5, color: sub, marginTop: 3, lineHeight: 1.4 }}>{line}</div> : null}
                  {ours.length ? <div data-bar-ck-spirits={ours.length} style={{ fontSize: 12.5, color: text, marginTop: 3, lineHeight: 1.4 }}>Из нашей карты: {ours.slice(0, 3).map(spiritTitle).join(", ")}{ours.length > 3 ? " и ещё " + (ours.length - 3) : ""}</div> : null}
                </div>);
            })}
          </div>))}
      </div>
    </div>);
}
