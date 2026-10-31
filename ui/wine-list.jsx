// ui/wine-list.jsx — v120 (Доп. 433): «Винная карта» заведения для команды.
//
// Вина — записи kind:"wine" в меню команды (lib/wine.js). Здесь их видят все: группы по цвету, поиск, «Бокалом»,
// карточка вина (стиль, ноты, подача, фраза гостю, к каким блюдам). Что дописал AI и ещё не подтвердили — с пометкой
// «не проверено». Руководитель (manager, senior, владелец) правит в «Редакторе вин» (ui/wine-editor.jsx).
// v122 (Доп. 435): фото бутылки — миниатюра в строке, крупно в карточке (официант узнаёт бутылку на полке).
// v123 (Доп. 436), владелец: «их учить очень сложно, особенно для новичка. Может, сделаем как в меню, с тренировками,
// викторинами» — сверху карты «Учить вина»: тренировка (ui/wine-train.jsx) только по проверенным винам.
import React from "react";
import { GOLD, labelStyle } from "./tokens";
import { onActivate, vibrate } from "../lib/utils";
import { rpc } from "../api/supabase";
import { cachedShared } from "../lib/deck-extras";
import { rememberSharedMenu, dishesOf } from "../lib/reference-context";
import { wineRecords, groupByColor, findWines, wineTitle, wineLine, winePrice, unchecked, COLOR_GROUP, COLOR_RU, FIELD_RU } from "../lib/wine";
import { trainable, newWines, allLearned, glassPath, srKey } from "../lib/wine-train";
import { WineDeck, WineQuiz, WineTrainHub, WinePairQuiz, WineDescribe60, WineTeam, useLearned, wineReport, glass as wineGlass } from "./wine-train";
import { PronounceScreen } from "./pronounce";   // v124: словарь «Как произносить» с разделом «Наша карта»
import { BUILD_SVG } from "./icons";

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
export function useInnerTop(key, listKey = "list") {
  const saved = React.useRef(0);
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
export function WineListScreen({ T, a11y, profile, onBack, onEdit, startId }) {
  const gold = a11y ? "#7A5D2A" : GOLD, text = T.modTitle.color, sub = T.modSub.color;
  const red = a11y ? "#A33A2A" : "#E07878", amber = a11y ? "#8A5A12" : "#E4B36A", green = a11y ? "#2E7D52" : "#5DBB8A";
  const restaurant = (profile && profile.restaurant) || "";
  const uk = profile ? `_${profile.name}_${profile.surname || ""}` : "";
  const edit = canEditWines(profile) && onEdit;
  const [shared] = useTeamMenu(restaurant);
  const [q, setQ] = React.useState("");
  const [only, setOnly] = React.useState("all");   // all | glass | цвет
  const train0 = startId === "@train";
  const [openId, setOpenId] = React.useState(train0 ? null : startId || null);
  const [view, setView] = React.useState(train0 ? "train" : "list");   // list | train | deck | quiz | pair | say60 | pron | team
  const [deck, setDeck] = React.useState(null);      // колода: { key, title, mode, only, focus }
  const [learnedIds, learn] = useLearned(restaurant);
  const remember = useInnerTop(openId ? "card:" + openId : view === "deck" ? "deck:" + (deck ? deck.key : "") : view);
  const all = React.useMemo(() => wineRecords(shared).filter((w) => !w.archived), [shared]);
  const colors = React.useMemo(() => groupByColor(all).map(([k]) => k).filter((k) => k !== "other"), [all]);
  const shown = React.useMemo(() => findWines(all, q).filter((w) => (only === "all" ? true : only === "glass" ? w.byGlass : w.color === only)), [all, q, only]);
  const groups = groupByColor(shown);
  const glassN = all.filter((w) => w.byGlass).length, uncheckedN = all.filter(unchecked).length;
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
  const trainHead = (title, back) => head(title, back, "Винная карта", false);
  const toDeck = (d) => { setDeck({ focus: [], ...d }); setView("deck"); vibrate("light"); };
  const openTrain = (key) => {
    if (["quiz", "pair", "say60", "pron", "team"].includes(key)) { setView(key); return; }
    toDeck(key === "new" ? { key, title: "Новые вина", mode: "quiz", only: "new" } : key === "glass" ? { key, title: "Вина бокалом", mode: "quiz", only: "glass" } : { key: "deck", title: "Колода вин", mode: "deck", only: "all" });
  };
  if (view === "train") return (
    <div style={T.screen} className="sa-screen" data-wine-train-hub="">
      {trainHead("Тренировка", () => (train0 ? onBack() : setView("list")))}
      <WineTrainHub T={T} a11y={a11y} gold={gold} green={green} wines={all} dishes={dishes} restaurant={restaurant} edit={!!edit} onOpen={openTrain} onReview={() => onEdit("@review")} />
    </div>);
  if (view === "deck" && deck) return (
    <WineDeck key={deck.key + ":" + deck.focus.join(",")} T={T} a11y={a11y} gold={gold} green={green} red={red} wines={all} dishes={dishes} restaurant={restaurant} uk={uk}
      Head={(t) => trainHead(t, () => setView("train"))} title={deck.title} initialMode={deck.mode} initialOnly={deck.only} newIds={fresh.map((x) => x.id)} focusIds={deck.focus}
      onLearned={deck.key === "new" && !allLearned(fresh, learnedIds) ? () => { learn(fresh); wineReport("passed", { ids: fresh.map((x) => x.id) }, all, restaurant); vibrate("success"); setView("train"); } : null} />);
  if (view === "quiz") return (
    <WineQuiz T={T} a11y={a11y} gold={gold} green={green} red={red} wines={all} dishes={dishes} restaurant={restaurant} uk={uk} Head={(t) => trainHead(t, () => setView("train"))}
      onRepeat={(ids) => toDeck({ key: "focus", title: "Повторить ошибки", mode: "quiz", only: "focus", focus: ids })} />);
  if (view === "pair") return <WinePairQuiz T={T} a11y={a11y} gold={gold} green={green} red={red} wines={all} dishes={dishes} restaurant={restaurant} uk={uk} Head={(t) => trainHead(t, () => setView("train"))} />;
  if (view === "say60") return <WineDescribe60 T={T} a11y={a11y} gold={gold} green={green} red={red} wines={all} dishes={dishes} restaurant={restaurant} uk={uk} Head={(t) => trainHead(t, () => setView("train"))} />;
  if (view === "team") return <WineTeam T={T} a11y={a11y} gold={gold} green={green} wines={all} restaurant={restaurant} Head={(t) => trainHead(t, () => setView("train"))} />;   // v125
  if (view === "pron") return (
    <PronounceScreen T={T} a11y={a11y} gold={gold} Head={(t) => trainHead(t, () => setView("train"))} glass={wineGlass} ownLabel="Наша карта" ownWhere="в карте:"
      dishes={trainable(all).map((x) => ({ id: x.id, name: [x.name, (x.grapes || []).join(" "), x.region].filter(Boolean).join(" "), label: wineTitle(x) }))} />);

  // ── карточка вина ──
  const w = openId ? all.find((x) => x.id === openId) : null;
  if (w) {
    const pairs = (w.pair || []).map(dishName).filter(Boolean);
    const serve = [w.temp, w.glass ? "бокал «" + w.glass + "»" : "", w.volume].filter(Boolean).join(" · ");
    const sec = (t) => <div style={{ ...labelStyle(13.5), color: gold, margin: "16px 0 6px" }}>{t}</div>;
    return (
      <div style={T.screen} className="sa-screen" data-wine-card={w.id}>
        {head(wineTitle(w), () => setOpenId(null), "Винная карта")}
        <div style={{ padding: "4px 16px 140px" }}>
          {w.img ? (
            <div data-wine-photo-big="" style={{ display: "flex", justifyContent: "center", margin: "4px 0 12px" }}>
              <img src={w.img} alt={"Бутылка: " + wineTitle(w)} decoding="async" style={{ display: "block", maxWidth: "100%", maxHeight: 300, borderRadius: 14, objectFit: "contain",
                border: `1px solid ${gold}44`, boxShadow: a11y ? "0 6px 18px rgba(120,85,25,0.18)" : "0 10px 28px rgba(0,0,0,0.45)" }} />
            </div>) : null}
          <div data-lens-card="" style={{ ...T.modCard, display: "block", padding: "14px 16px", cursor: "default" }}>
            {w.producer ? <div style={{ fontSize: 13.5, color: sub }}>{w.producer}</div> : null}
            <div style={{ fontFamily: SERIF, fontSize: 15, color: text, lineHeight: 1.45, marginTop: 4 }}>{wineLine(w) || (w.color ? COLOR_RU[w.color] : "Описание пока не заполнено")}</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
              {w.byGlass ? badge("бокалом", gold) : null}
              {w.stop ? badge("сегодня нет", red) : null}
              {w.abv ? badge(String(w.abv).replace(".", ",") + "%", sub) : null}
            </div>
            {winePrice(w) ? <div style={{ fontSize: 14, color: text, marginTop: 10 }}>{winePrice(w)}</div> : null}
          </div>
          {unchecked(w) ? <div data-wine-unchecked="" style={{ marginTop: 10, fontSize: 12.5, lineHeight: 1.5, color: amber }}>
            Не проверено: {w.ai.map((f) => FIELD_RU[f] || f).join(", ")}. Это подсказал AI, руководитель ещё не подтвердил.</div> : null}
          {w.short ? <>{sec("Одной фразой гостю")}<div style={{ fontFamily: SERIF, fontStyle: "italic", fontSize: 16, lineHeight: 1.5, color: text }}>«{w.short}»</div></> : null}
          {(w.notes || []).length ? <>{sec("Ноты")}<div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>{w.notes.map((n) => <span key={n} data-lens-tag="" style={{ ...chip(false), cursor: "default", color: text }}>{n}</span>)}</div></> : null}
          {serve ? <>{sec("Подача")}<div style={{ fontSize: 14.5, color: text, lineHeight: 1.5 }}>{serve}</div></> : null}
          {w.story ? <>{sec("О вине")}<div style={{ fontSize: 14.5, color: text, lineHeight: 1.6 }}>{w.story}</div></> : null}
          {pairs.length || w.pairNote ? <>{sec("К блюдам")}
            {pairs.length ? <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>{pairs.map((n) => <span key={n} data-lens-tag="" style={{ ...chip(false), cursor: "default", color: text }}>{n}</span>)}</div> : null}
            {w.pairNote ? <div style={{ fontSize: 13.5, color: sub, lineHeight: 1.5, marginTop: 6 }}>{w.pairNote}</div> : null}</> : null}
        </div>
      </div>
    );
  }

  return (
    <div style={T.screen} className="sa-screen" data-wine-list={all.length}>
      {head("Винная карта", onBack, "Справочник · " + restaurant)}
      <div style={{ padding: "0 16px 140px" }}>
        <div style={{ fontSize: 13.5, color: sub, margin: "2px 2px 10px" }} data-wine-sum="">
          {all.length ? winesWord(all.length) + (glassN ? " · бокалом " + glassN : "") + (edit && uncheckedN ? " · не проверено " + uncheckedN : "")
            : edit ? "Карта пока пустая. Добавь вина руками, фото страниц карты, списком или из PDF." : "Карта пока пустая."}
        </div>
        {!all.length && edit ? <button type="button" className="sa-btn" data-lens-btn="main" onClick={() => onEdit(null)}
          style={{ ...T.doneBtn, width: "100%", margin: "4px 0 0", background: gold, color: "#1A1008" }}>Добавить вина</button> : null}
        {trainN >= 2 || (edit && all.length) ? (() => {
          // v123: вход в тренировку — над картой; новые вина, которые ещё не выучены, подсвечены
          const hi = fresh.length > 0 && !allLearned(fresh, learnedIds), gp = glassPath(all, (() => { try { return JSON.parse(localStorage.getItem(srKey(restaurant)) || "{}"); } catch (e) { return {}; } })());
          const go = () => { vibrate("light"); remember(); setView("train"); };
          return (
            <div className="sa-card" role="button" tabIndex={0} data-wine-train-open={hi ? "new" : ""} data-lens-card={hi ? "hi" : ""} onClick={go} {...onActivate(go)}
              style={{ ...T.modCard, margin: "0 0 12px", ...(hi ? { border: `1px solid ${gold}AA` } : {}) }}>
              <div style={{ width: 38, height: 38, borderRadius: 12, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", background: a11y ? "rgba(200,150,50,0.14)" : "rgba(200,169,110,0.13)", marginRight: 4 }}>{BUILD_SVG.wineglass(gold, 20)}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ ...T.modTitle, display: "flex", alignItems: "center", gap: 8 }}>Учить вина{hi ? <span style={{ ...labelStyle(13), color: "#1A1008", background: gold, borderRadius: 6, padding: "1px 6px" }}>новое</span> : null}</div>
                <div style={{ ...T.modSub, whiteSpace: "normal" }}>{trainN < 2 ? "Проверь вина, чтобы команда могла их учить"
                  : hi ? "Новые вина: " + fresh.length + ". Колода, викторина, путь новичка"
                  : gp.total ? "Колода, викторина, путь новичка · бокалом выучено " + gp.known + " из " + gp.total : "Колода, викторина и «Наоборот»: вино по описанию гостя"}</div>
              </div>
              <div style={T.modArrow}>›</div>
            </div>);
        })() : null}
        {all.length ? <>
          <input data-lens-field="" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Название, регион, сорт, нота…" aria-label="Поиск по винной карте"
            style={{ width: "100%", boxSizing: "border-box", padding: "11px 14px", borderRadius: 14, border: `1px solid ${gold}55`, background: a11y ? "rgba(255,255,255,0.55)" : "rgba(0,0,0,0.22)", color: text, fontSize: 14.5, fontFamily: SERIF, outline: "none" }} />
          <div className="sa-hscroll" role="group" aria-label="Показать" style={{ display: "flex", gap: 6, overflowX: "auto", padding: "10px 0 4px" }}>
            {[["all", "Все"], ...(glassN ? [["glass", "Бокалом"]] : []), ...colors.map((k) => [k, COLOR_GROUP[k]])].map(([k, t]) => (
              <button key={k} type="button" aria-pressed={only === k} data-wine-only={k} data-lens-btn={only === k ? "tab" : "soft"} data-lens-ink="" onClick={() => { setOnly(k); vibrate("light"); }} style={chip(only === k)}>{t}</button>))}
          </div>
          {!shown.length ? <div style={{ fontSize: 14, color: sub, padding: "18px 2px" }}>Ничего не нашлось.</div> : null}
          {groups.map(([k, list]) => (
            <div key={k} data-wine-group={k}>
              <div style={{ ...labelStyle(13.5), color: gold, margin: "14px 2px 6px" }}>{COLOR_GROUP[k]} · {list.length}</div>
              {list.map((x) => {
                const open = () => { vibrate("light"); remember(); setOpenId(x.id); };
                return (
                  <div key={x.id} role="button" tabIndex={0} data-wine-row={x.id} data-lens-card="" onClick={open} {...onActivate(open)}
                    style={{ ...T.modCard, display: withPics ? "flex" : "block", gap: 12, alignItems: "center", padding: "11px 14px", marginBottom: 8, opacity: x.stop ? 0.6 : 1 }}>
                    {withPics ? <WineThumb w={x} gold={gold} a11y={a11y} /> : null}
                    <div style={withPics ? { flex: 1, minWidth: 0 } : undefined}>
                    <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                      <span style={{ flex: 1, minWidth: 0, fontFamily: SERIF, fontSize: 15.5, color: text, lineHeight: 1.3 }}>{wineTitle(x)}</span>
                      {x.byGlass ? badge("бокалом", gold) : null}
                      {x.stop ? badge("сегодня нет", red) : null}
                    </div>
                    {wineLine(x) ? <div style={{ fontSize: 12.5, color: sub, marginTop: 3, lineHeight: 1.4 }}>{wineLine(x)}</div> : null}
                    {winePrice(x) || unchecked(x) ? <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 4 }}>
                      {winePrice(x) ? <span style={{ fontSize: 12.5, color: text }}>{winePrice(x)}</span> : null}
                      {unchecked(x) ? <span style={{ fontSize: 11.5, color: amber }}>не проверено</span> : null}
                    </div> : null}
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </> : null}
      </div>
    </div>
  );
}
