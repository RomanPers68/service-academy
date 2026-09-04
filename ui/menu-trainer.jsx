// ui/menu-trainer.jsx
// Этап 2 — меню-тренажёр. Три режима:
//   1) Флеш-карточки — вспомни состав и аллергены, переверни, оцени себя
//   2) Викторина — авто-вопросы по аллергенам, составу и сочетаниям
//   3) «Опиши за 60 секунд» — расскажи о блюде вслух, сравни с эталоном
// Плюс редактор блюд для менеджеров (localStorage: sa_menu_custom).

import React from "react";
import { rememberSharedMenu } from "../lib/reference-context";
import { CAT_ORDER, normCat, groupByCat, dishMatches, suggestAllergens } from "../lib/menu-sections";
import { MenuDeck } from "./menu-deck";
import { RESTAURANT_MENUS, ALLERGENS_LIST } from "../data/menu";
import { RESTAURANTS } from "../data/roles";
import { onActivate, shuffleArray, vibrate } from "../lib/utils";
import { rpc, rpcSync, saToken, SUPABASE_URL, SUPABASE_KEY } from "../api/supabase";
import { GAME_SVG, UI_SVG } from "./icons";
import { TimerBar, LiquidSegment } from "./widgets";

const CUSTOM_KEY = "sa_menu_custom";     // { [restaurant]: Dish[] }
const HIDE_SAMPLES_KEY = "sa_menu_hide_samples"; // { [restaurant]: true|false } (нет ключа — авто: скрыты, если есть меню команды)
const HIDDEN_IDS_KEY = "sa_menu_hidden_samples";   // Доп. 154: { [restaurant]: [id примера, …] } — удалённые поштучно
const DELETED_KEY = "sa_menu_deleted";             // Доп. 154: { [restaurant]: [id серверного блюда, …] } — до публикации
const loadJson = (k) => { try { return JSON.parse(localStorage.getItem(k) || "{}"); } catch (e) { return {}; } };
const saveJson = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };

const loadCustom = () => { try { return JSON.parse(localStorage.getItem(CUSTOM_KEY) || "{}"); } catch (e) { return {}; } };
const saveCustom = (obj) => { try { localStorage.setItem(CUSTOM_KEY, JSON.stringify(obj)); } catch (e) {} };
const loadHide = () => { try { return JSON.parse(localStorage.getItem(HIDE_SAMPLES_KEY) || "{}"); } catch (e) { return {}; } };
const saveHide = (obj) => { try { localStorage.setItem(HIDE_SAMPLES_KEY, JSON.stringify(obj)); } catch (e) {} };

// Фирменная «стеклянная» плашка — те же токены, что у карточек уроков (обе темы)
const glass = (T) => ({
  background: T.lessGlass?.bg || "rgba(255,250,238,0.05)",
  border: T.lessGlass?.border || "1px solid rgba(150,112,42,0.38)",
  borderTop: T.lessGlass?.borderTop || "1px solid rgba(215,170,68,0.46)",
  boxShadow: T.lessGlass?.shadow || "0 6px 22px rgba(0,0,0,0.50), 0 2px 0 rgba(200,160,60,0.18) inset, 0 -2px 4px rgba(0,0,0,0.38) inset",
  backdropFilter: T.lessGlass?.blur || "none",
  WebkitBackdropFilter: T.lessGlass?.blur || "none",
  borderRadius: 18,
});

// Фото блюда в карточках
const DishPhoto = ({ src, h = 170 }) => src ? (
  <img src={src} alt="" loading="lazy" decoding="async"
    style={{ width: "calc(100% + 36px)", margin: "-22px -18px 14px", height: h, objectFit: "cover", borderRadius: "17px 17px 0 0", display: "block" }} />
) : null;

// Сжатие фото с телефона перед сохранением (localStorage не резиновый)
const readPhoto = (file, cb) => {
  try {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const max = 700;
      const k = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement("canvas");
      c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
      c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      let data = c.toDataURL("image/jpeg", 0.72);
      if (data.length > 400000) data = c.toDataURL("image/jpeg", 0.55); // крупные — жмём сильнее
      cb(data);
    };
    img.onerror = () => { URL.revokeObjectURL(url); };
    img.src = url;
  } catch (e) {}
};

export function MenuTrainerScreen({ T, a11y, profile, onBack }) {
  const gold = a11y ? "#8B6A30" : "#C8A96E";
  const green = "#5DBB8A";
  const red = "#E07878";
  const textColor = a11y ? "#2e211a" : "#F5EFE2";
  const canEdit = ["manager", "senior"].includes(profile?.position) || profile?.is_admin;

  const [restaurant, setRestaurant] = React.useState(() =>
    RESTAURANTS.includes(profile?.restaurant) ? profile.restaurant : null);
  const [mode, setMode] = React.useState(null); // null | "cards" | "quiz" | "60sec" | "edit" | "team"
  const [custom, setCustom] = React.useState(loadCustom);
  const [hideSamples, setHideSamples] = React.useState(loadHide);
  const [hiddenIds, setHiddenIds] = React.useState(() => loadJson(HIDDEN_IDS_KEY)); // Доп. 154
  const [deleted, setDeleted] = React.useState(() => loadJson(DELETED_KEY));        // Доп. 154

  // ── Этап 4: общее меню ресторана с сервера (публикует менеджер) ────────────
  // Если RPC menu_get ещё не создан (supabase/supabase-stage4.sql) — тихо работаем как раньше, только локально.
  const [shared, setShared] = React.useState([]);
  const [shareErr, setShareErr] = React.useState(null); // текст ошибки загрузки меню команды
  const [focusNew, setFocusNew] = React.useState(false);
  React.useEffect(() => {
    if (!restaurant) return;
    let alive = true;
    setShareErr(null);
    rpc("menu_get", { p_restaurant: restaurant }).then(res => {
      if (!alive) return;
      const arr = typeof res === "string" ? JSON.parse(res) : res;
      if (Array.isArray(arr)) { setShared(arr); rememberSharedMenu(restaurant, arr); } // кэш для ассистента (Доп. 129)
      else setShareErr(String((res && (res.message || res.error)) || "неожиданный ответ сервера").slice(0, 140));
    }).catch(() => { if (alive) setShareErr("нет связи с сервером"); });
    return () => { alive = false; };
  }, [restaurant]);

  const dishes = React.useMemo(() => {
    if (!restaurant) return [];
    const ownAll = custom[restaurant] || [];
    const ownIds = new Set(ownAll.map(d => d.id));
    const own = ownAll.filter(d => !d.archived); // Доп. 167: архив в тренажёре не показываем
    const del = new Set(deleted[restaurant] || []);
    const team = shared.filter(d => d && d.id && !ownIds.has(d.id) && !del.has(d.id) && !d.archived); // своя правка важнее серверной; удалённое — до публикации не показываем
    // Доп. 154: примеры-заготовки видны, пока нет меню команды (или если включены вручную);
    // отредактированный пример живёт в «своих», удалённый — в скрытых.
    const hs = hideSamples[restaurant];
    const showSamples = hs === false ? true : hs === true ? false : shared.length === 0;
    const hid = new Set(hiddenIds[restaurant] || []);
    const samples = showSamples ? (RESTAURANT_MENUS[restaurant] || []).filter(d => !ownIds.has(d.id) && !hid.has(d.id)) : [];
    return [...own, ...team, ...samples];
  }, [restaurant, custom, shared, hideSamples, hiddenIds, deleted]);

  // Новые позиции: помечены isNew и добавлены за последние 30 дней
  const newDishes = React.useMemo(() =>
    dishes.filter(d => d.isNew && d.addedAt && Date.now() - d.addedAt < 30 * 864e5), [dishes]);
  const wave = React.useMemo(() =>
    String(newDishes.reduce((m, d) => Math.max(m, d.addedAt || 0), 0)), [newDishes]);
  const [learnedWave, setLearnedWave] = React.useState(() => { try { return localStorage.getItem("sa_menu_learned_" + (restaurant || "")) || ""; } catch (e) { return ""; } });
  React.useEffect(() => { try { setLearnedWave(localStorage.getItem("sa_menu_learned_" + (restaurant || "")) || ""); } catch (e) {} }, [restaurant]);
  const learned = wave !== "0" && learnedWave === wave;

  const startNew = () => {
    setFocusNew(true); setMode("cards");
    if (saToken()) rpcSync("menu_progress_set", { p_token: saToken(), p_restaurant: restaurant, p_wave: wave, p_status: "opened", p_score: null });
  };
  const markLearned = () => {
    try { localStorage.setItem("sa_menu_learned_" + restaurant, wave); } catch (e) {}
    setLearnedWave(wave);
    if (saToken()) rpcSync("menu_progress_set", { p_token: saToken(), p_restaurant: restaurant, p_wave: wave, p_status: "passed", p_score: null });
    vibrate("light"); setMode(null); setFocusNew(false);
  };

  const Head = (title) => (
    <div style={T.lessHead}>
      <button style={T.backBtn2} onClick={() => { if (mode) { setMode(null); setFocusNew(false); } else if (restaurant && !RESTAURANTS.includes(profile?.restaurant)) setRestaurant(null); else onBack(); }}>‹</button>
      <div style={T.lessHeadTitle}>{title}</div>
    </div>
  );

  // ── Выбор ресторана ────────────────────────────────────────────────────────
  if (!restaurant) return (
    <div style={T.screen} className="sa-screen">
      {Head("Меню ресторана")}
      <div style={{ ...T.secTitle }}>Выбери ресторан</div>
      <div style={{ padding: "0 14px" }}>
        {RESTAURANTS.map(r => (
          <div key={r} className="sa-card" style={{ ...T.modCard, margin: "0 0 10px" }} onClick={() => setRestaurant(r)} {...onActivate(() => setRestaurant(r))}>
            <div style={{ ...T.modBar, background: gold }} />
            <div style={{ ...T.modTitle, flex: 1 }}>{r}</div>
            <div style={T.modArrow}>›</div>
          </div>
        ))}
      </div>
    </div>
  );

  // ── Режимы тренировки ──────────────────────────────────────────────────────
  if (mode === "list") return <MenuList T={T} gold={gold} red={red} dishes={dishes} Head={Head} restaurant={restaurant} a11y={a11y} />;
  if (mode === "cards") return <MenuDeck T={T} a11y={a11y} gold={gold} green={green} red={red} dishes={focusNew ? newDishes : dishes} restaurant={restaurant} Head={Head}
    DishPhoto={DishPhoto} DishBack={DishBack} glass={glass} onLearned={focusNew && !learned ? markLearned : null} />; // Доп. 161: механика Колоды бармена
  if (mode === "quiz") return <MenuQuiz T={T} gold={gold} green={green} red={red} dishes={dishes} Head={Head} restaurant={restaurant} />;
  if (mode === "60sec") return <Describe60 T={T} gold={gold} green={green} dishes={dishes} Head={Head} restaurant={restaurant} a11y={a11y} />;
  if (mode === "team") return <TeamProgress T={T} gold={gold} green={green} Head={Head} restaurant={restaurant} />;
  if (mode === "edit") return (
    <MenuEditor T={T} gold={gold} red={red} green={green} textColor={textColor} a11y={a11y} Head={Head} restaurant={restaurant}
      custom={custom} setCustom={(v) => { setCustom(v); saveCustom(v); }}
      shared={shared} onPublished={(d) => setShared(d)}
      hideSamples={hideSamples} setHideSamples={(v) => { setHideSamples(v); saveHide(v); }}
      hiddenIds={hiddenIds} setHiddenIds={(v) => { setHiddenIds(v); saveJson(HIDDEN_IDS_KEY, v); }}
      deleted={deleted} setDeleted={(v) => { setDeleted(v); saveJson(DELETED_KEY, v); }} />
  );

  // ── Главная тренажёра ──────────────────────────────────────────────────────
  const modes = [
    { key: "list", icon: (c) => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 6h16M4 12h16M4 18h10"/><circle cx="20" cy="18" r="1.2" fill={c}/></svg>, title: "Меню по разделам", sub: "Все блюда с поиском: закуски, салаты, супы, горячее…" },
    { key: "cards", icon: (c) => GAME_SVG.cards(c, 20), title: "Колода меню", sub: "Свайп, переворот, «Знаю?» — как у Колоды бармена" },
    { key: "quiz", icon: (c) => UI_SVG.quiz(c, 20), title: "Викторина по меню", sub: "Автоматические вопросы по блюдам ресторана" },
    { key: "60sec", icon: (c) => GAME_SVG.clock(c, 20), title: "Опиши за 60 секунд", sub: "Расскажи о блюде вслух, сравни с эталоном" },
  ];
  const iconBox = { width: 38, height: 38, borderRadius: 11, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", background: a11y ? "rgba(200,150,50,0.14)" : "rgba(200,169,110,0.13)", marginRight: 4 };
  return (
    <div style={T.screen} className="sa-screen">
      {Head(restaurant)}
      {/* Быстрая смена ресторана — «линза» скользит по чипсам */}
      <div style={{ padding: "10px 14px 0" }}>
        <LiquidSegment a11y={a11y} equal={false} scroll accent={gold} muted={T.modSub.color}
          itemStyle={{ fontSize: 12, padding: "7px 12px" }}
          items={RESTAURANTS.map(r => ({ id: r, label: r }))}
          activeId={restaurant}
          onSelect={(r) => { vibrate("light"); setRestaurant(r); setFocusNew(false); }} />
      </div>
      <div style={{ padding: "8px 18px 0", color: T.modSub.color, fontSize: 13, lineHeight: 1.5 }}>
        В базе: <b style={{ color: gold }}>{dishes.length}</b> блюд{shared.length > 0 ? <> · с сервера команды: <b style={{ color: green }}>{shared.length}</b></> : null}{canEdit ? " · ты можешь редактировать меню" : ""} <span style={{ opacity: 0.55, fontSize: 11 }}>· сборка v17</span>
        {shareErr && <div style={{ color: red, fontSize: 12, marginTop: 4 }}>⚠ Меню команды не загрузилось: {shareErr}</div>}
      </div>
      <div style={{ ...T.secTitle }}>Тренировка</div>
      <div style={{ padding: "0 14px" }}>
        {newDishes.length > 0 && (
          <div className="sa-card" style={{ ...T.modCard, margin: "0 0 12px", border: `1px solid ${learned ? green : gold}${learned ? "77" : "AA"}` }}
            onClick={startNew} {...onActivate(startNew)}>
            <div style={{ ...T.modBar, background: learned ? green : gold }} />
            <div style={{ ...iconBox, background: learned ? "rgba(93,187,138,0.14)" : iconBox.background }}>{learned ? UI_SVG.checkCircle(green, 20) : GAME_SVG.cards(gold, 20)}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ ...T.modTitle, display: "flex", alignItems: "center", gap: 8 }}>Новые позиции{!learned && <span style={{ fontSize: 9.5, letterSpacing: 1.5, fontFamily: "monospace", color: "#1c1206", background: gold, borderRadius: 6, padding: "2px 6px" }}>NEW</span>}</div>
              <div style={{ ...T.modSub, whiteSpace: "normal" }}>{learned ? `Выучено ✓ · ${newDishes.length} блюд — повтори при желании` : `${newDishes.length} блюд · выучи к смене`}</div>
            </div>
            <div style={T.modArrow}>›</div>
          </div>
        )}
        {modes.map(m => (
          <div key={m.key} className="sa-card" style={{ ...T.modCard, margin: "0 0 10px", opacity: dishes.length ? 1 : 0.45 }}
            onClick={() => dishes.length && setMode(m.key)} {...onActivate(() => dishes.length && setMode(m.key))}>
            <div style={{ ...T.modBar, background: gold }} />
            <div style={iconBox}>{m.icon(gold)}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={T.modTitle}>{m.title}</div>
              <div style={{ ...T.modSub, whiteSpace: "normal" }}>{m.sub}</div>
            </div>
            <div style={T.modArrow}>›</div>
          </div>
        ))}
        {canEdit && (
          <div className="sa-card" style={{ ...T.modCard, margin: "14px 0 10px", border: `1px dashed ${gold}88` }}
            onClick={() => setMode("edit")} {...onActivate(() => setMode("edit"))}>
            <div style={{ ...iconBox, marginLeft: 2 }}>{UI_SVG.pencil(gold, 19)}</div>
            <div style={{ flex: 1 }}>
              <div style={T.modTitle}>Редактор меню</div>
              <div style={{ ...T.modSub, whiteSpace: "normal" }}>Добавь реальные блюда ресторана и скрой примеры</div>
            </div>
            <div style={T.modArrow}>›</div>
          </div>
        )}
        {canEdit && (
          <div className="sa-card" style={{ ...T.modCard, margin: "0 0 10px" }}
            onClick={() => setMode("team")} {...onActivate(() => setMode("team"))}>
            <div style={{ ...T.modBar, background: gold }} />
            <div style={iconBox}>{UI_SVG.eye(gold, 19)}</div>
            <div style={{ flex: 1 }}>
              <div style={T.modTitle}>Кто выучил новинки</div>
              <div style={{ ...T.modSub, whiteSpace: "normal" }}>Открыл · выучил — картина по команде</div>
            </div>
            <div style={T.modArrow}>›</div>
          </div>
        )}
        {!dishes.length && <div style={{ textAlign: "center", padding: "20px", color: T.modSub.color, fontSize: 13 }}>Меню пустое — попроси менеджера добавить блюда в редакторе.</div>}
      </div>
    </div>
  );
}

// ── Этап 4: картина по команде — кто открыл и выучил новинки ─────────────────
function TeamProgress({ T, gold, green, Head, restaurant }) {
  const [rows, setRows] = React.useState(null); // null=грузим, []=пусто, [...]=данные
  const [err, setErr] = React.useState(false);
  React.useEffect(() => {
    let alive = true;
    rpc("menu_progress_list", { p_restaurant: restaurant })
      .then(res => { if (!alive) return; Array.isArray(res) ? setRows(res) : setErr(true); })
      .catch(() => alive && setErr(true));
    return () => { alive = false; };
  }, [restaurant]);
  const fmtDate = (ts) => { try { return new Date(ts).toLocaleDateString("ru-RU", { day: "numeric", month: "short" }); } catch (e) { return ""; } };
  return (
    <div style={T.screen} className="sa-screen">
      {Head("Кто выучил новинки")}
      {err && (
        <div style={{ textAlign: "center", padding: "44px 24px" }}>
          <div style={{ fontSize: 38, marginBottom: 12 }}>🔌</div>
          <div style={{ fontSize: 14, lineHeight: 1.6, color: T.para?.color }}>Серверная часть ещё не подключена. Выполни <b style={{ color: gold }}>supabase/supabase-stage4.sql</b> в Supabase → SQL Editor (5 минут, см. docs/UPGRADE_NOTES.md) — и здесь появится картина по каждому сотруднику.</div>
        </div>
      )}
      {!err && rows === null && <div style={{ textAlign: "center", padding: "44px", color: T.modSub.color }}>Загружаю…</div>}
      {!err && rows && !rows.length && (
        <div style={{ textAlign: "center", padding: "44px 24px", color: T.para?.color, fontSize: 14, lineHeight: 1.6 }}>Пока никто не открывал новинки. Скажи команде на брифинге: «Зайдите в приложение — выучите новые позиции» 😉</div>
      )}
      {!err && rows && rows.length > 0 && (
        <div style={{ padding: "10px 14px" }}>
          {rows.map((r, i) => (
            <div key={i} className="sa-card" style={{ ...T.modCard, margin: "0 0 10px" }}>
              <div style={{ ...T.modBar, background: r.status === "passed" ? green : gold }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={T.modTitle}>{r.employee || "Сотрудник"}</div>
                <div style={{ ...T.modSub, whiteSpace: "normal" }}>{r.status === "passed" ? "Выучил ✓" : "Открыл, ещё учит"} · {fmtDate(r.ts)}</div>
              </div>
              <div style={{ fontSize: 18 }}>{r.status === "passed" ? UI_SVG.checkCircle(green, 20) : UI_SVG.eye(gold, 18)}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Доп. 156: «Меню по разделам» — поиск, разделы, список, карточка блюда ───────
function MenuList({ T, gold, red, dishes, Head, restaurant, a11y }) {
  const [q, setQ] = React.useState("");
  const [cat, setCat] = React.useState("");
  const [open, setOpen] = React.useState(null); // блюдо в карточке
  const filtered = React.useMemo(() => dishes.filter(d => dishMatches(d, q) && (!cat || normCat(d.cat) === cat)), [dishes, q, cat]);
  const groups = React.useMemo(() => groupByCat(filtered), [filtered]);
  const allGroups = React.useMemo(() => groupByCat(dishes.filter(d => dishMatches(d, q))), [dishes, q]);
  const sub = T.modSub.color, text = T.modTitle.color;
  const pill = (on) => ({ padding: "5px 11px", borderRadius: 999, fontSize: 12, cursor: "pointer", flexShrink: 0, whiteSpace: "nowrap",
    border: `1px solid ${on ? gold : gold + "55"}`, background: on ? `linear-gradient(180deg,#E4C88C,${gold})` : "transparent",
    color: on ? "#1a160f" : sub, fontWeight: on ? "bold" : "normal" });

  if (open) {
    const flat = filtered; const i = flat.findIndex(d => d.id === open.id);
    const go = (k) => { const n = flat[(i + k + flat.length) % flat.length]; if (n) { setOpen(n); vibrate("light"); } };
    return (
      <div style={T.screen} className="sa-screen">
        {Head(open.cat || "Блюдо")}
        <div style={{ padding: "8px 16px 100px" }}>
          <div className="sa-card sa-cardpage-r" style={{ ...glass(T), padding: "22px 18px", overflow: "hidden" }}>
            <DishPhoto src={open.img} h={190} />
            <div style={{ fontFamily: "Georgia, serif", fontSize: 22, color: text, lineHeight: 1.2 }}>{open.name}</div>
            {open.desc && <div style={{ fontSize: 14, color: T.para?.color || text, lineHeight: 1.55, margin: "8px 0 4px", fontStyle: "italic" }}>{open.desc}</div>}
            <div style={{ marginTop: 10 }}><DishBack d={open} T={T} gold={gold} /></div>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 12 }}>
            <button className="sa-btn" style={{ ...T.doneBtn, background: "transparent", border: `1px solid ${gold}88`, color: gold, padding: "9px 16px" }} onClick={() => go(-1)}>‹ назад</button>
            <span style={{ fontSize: 11, color: sub, fontFamily: "monospace" }}>{i + 1} / {flat.length}</span>
            <button className="sa-btn" style={{ ...T.doneBtn, background: "transparent", border: `1px solid ${gold}88`, color: gold, padding: "9px 16px" }} onClick={() => go(1)}>дальше ›</button>
          </div>
          <button className="sa-btn" style={{ ...T.doneBtn, width: "100%", marginTop: 10, background: "transparent", border: `1px solid ${gold}55`, color: sub }} onClick={() => setOpen(null)}>К списку</button>
        </div>
      </div>
    );
  }

  return (
    <div style={T.screen} className="sa-screen">
      {Head("Меню по разделам")}
      <div style={{ padding: "8px 16px 0" }}>
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="Блюдо, ингредиент, аллерген…"
          style={{ width: "100%", boxSizing: "border-box", padding: "10px 13px", borderRadius: 12, border: `1px solid ${gold}66`, background: a11y ? "rgba(255,255,255,0.5)" : "rgba(255,248,230,0.05)", color: text, fontFamily: "Georgia, serif", fontSize: 14, outline: "none" }} />
        <div className="sa-hscroll" style={{ display: "flex", gap: 6, overflowX: "auto", padding: "10px 0 4px", WebkitOverflowScrolling: "touch" }}>
          <span style={pill(!cat)} onClick={() => setCat("")}>Все · {dishes.filter(d => dishMatches(d, q)).length}</span>
          {allGroups.map(g => <span key={g.cat} style={pill(cat === g.cat)} onClick={() => setCat(cat === g.cat ? "" : g.cat)}>{g.cat} · {g.items.length}</span>)}
        </div>
      </div>
      <div style={{ padding: "4px 16px 100px" }}>
        {!groups.length && <div style={{ color: sub, fontSize: 13, padding: "20px 4px", textAlign: "center" }}>Ничего не нашлось — попробуй другое слово</div>}
        {groups.map(g => (
          <div key={g.cat} style={{ marginTop: 14 }}>
            <div style={{ fontSize: 10.5, letterSpacing: 1.6, color: gold, fontFamily: "monospace", margin: "0 2px 8px" }}>{g.cat.toUpperCase()} · {g.items.length}</div>
            {g.items.map(d => (
              <div key={d.id} className="sa-card" onClick={() => { setOpen(d); vibrate("light"); }} {...onActivate(() => setOpen(d))}
                style={{ ...glass(T), display: "flex", alignItems: "center", gap: 12, padding: "10px 12px", marginBottom: 8, cursor: "pointer" }}>
                {d.img
                  ? <img src={d.img} alt="" loading="lazy" decoding="async" style={{ width: 54, height: 54, objectFit: "cover", borderRadius: 12, flexShrink: 0 }} />
                  : <div style={{ width: 54, height: 54, borderRadius: 12, flexShrink: 0, border: `1px dashed ${gold}55`, display: "flex", alignItems: "center", justifyContent: "center", color: gold, fontSize: 18 }}>🍽</div>}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ ...T.modTitle, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{d.name}{d.stop ? <span style={{ color: red, fontSize: 10.5, marginLeft: 8, letterSpacing: 1 }}>В СТОПЕ</span> : null}</div>
                  <div style={{ fontSize: 12, color: sub, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{(d.ingredients || []).slice(0, 4).join(", ") || "состав не указан"}</div>
                  {(d.allergens || []).length > 0 && <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginTop: 4 }}>{d.allergens.slice(0, 4).map((a, i) => <span key={i} style={{ fontSize: 10, padding: "1px 6px", borderRadius: 999, border: `1px solid ${red}77`, color: red }}>{a}</span>)}</div>}
                </div>
                <span style={{ color: gold, opacity: 0.7 }}>›</span>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Карточка блюда (обратная сторона) ────────────────────────────────────────
function DishBack({ d, T, gold }) {
  const Row = ({ label, children }) => (
    <div style={{ marginBottom: 10 }}>
      <div style={{ fontSize: 10, letterSpacing: 1.5, color: gold, fontFamily: "monospace", marginBottom: 3 }}>{label}</div>
      <div style={{ fontSize: 14, lineHeight: 1.5, color: T.para?.color }}>{children}</div>
    </div>
  );
  return (
    <div>
      <Row label="СОСТАВ">{(d.ingredients || []).join(", ") || "—"}</Row>
      <Row label="АЛЛЕРГЕНЫ">{(d.allergens || []).length ? (d.allergens || []).map(a => (
        <span key={a} style={{ display: "inline-block", padding: "2px 8px", borderRadius: 8, border: "1px solid #E0787866", color: "#E07878", fontSize: 12, margin: "0 5px 5px 0" }}>{a}</span>
      )) : <span style={{ color: "#5DBB8A" }}>нет из «большой восьмёрки»</span>}</Row>
      {d.desc && <Row label="КАК ОПИСАТЬ ГОСТЮ">{d.desc}</Row>}
      {d.pairing && <Row label="СОЧЕТАНИЕ">{d.pairing}</Row>}
      {d.note && <Row label="ВАЖНО ЗНАТЬ">{d.note}</Row>}
    </div>
  );
}

// ── Режим 1: флеш-карточки ───────────────────────────────────────────────────
function FlashCards({ T, gold, green, red, dishes, Head, restaurant, onLearned }) {
  const [deck, setDeck] = React.useState(() => shuffleArray(dishes));
  const [flipped, setFlipped] = React.useState(false);
  const [known, setKnown] = React.useState(0);
  const [repeats, setRepeats] = React.useState(0);
  const total = dishes.length;

  if (!deck.length) return (
    <div style={T.screen} className="sa-screen">
      {Head("Флеш-карточки")}
      <div style={{ textAlign: "center", padding: "60px 24px" }}>
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 14 }}>
          <div style={{ width: 76, height: 76, borderRadius: "50%", background: `${gold}1F`, border: `1px solid ${gold}55`, display: "flex", alignItems: "center", justifyContent: "center" }}>{UI_SVG.trophy(gold, 38)}</div>
        </div>
        <div style={{ ...T.bold, marginBottom: 8 }}>Колода пройдена!</div>
        <div style={{ color: T.modSub.color, fontSize: 14, marginBottom: 20 }}>Знал сразу: {known} из {total}{repeats ? ` · повторов: ${repeats}` : ""}</div>
        {onLearned && (
          <button className="sa-btn sa-btn-pulse" style={{ ...T.doneBtn, background: green, width: "100%", marginBottom: 10 }} onClick={onLearned}>Выучил новинки ✓</button>
        )}
        <button className="sa-btn" style={{ ...T.doneBtn, background: onLearned ? "transparent" : gold, border: onLearned ? `1px solid ${gold}88` : "none", color: onLearned ? (T.para?.color || "#F5EFE2") : (T.doneBtn?.color || "#fff"), padding: "13px 30px", width: "100%" }} onClick={() => { setDeck(shuffleArray(dishes)); setKnown(0); setRepeats(0); setFlipped(false); }}>Ещё раз</button>
      </div>
    </div>
  );

  const d = deck[0];
  const answer = (ok) => {
    vibrate(ok ? "light" : "error");
    setFlipped(false);
    if (ok) { setKnown(k => k + 1); setDeck(dk => dk.slice(1)); }
    else { setRepeats(r => r + 1); setDeck(dk => [...dk.slice(1), d]); } // не знал → карта в конец колоды
  };

  return (
    <div style={T.screen} className="sa-screen">
      {Head("Флеш-карточки")}
      <div style={{ padding: "6px 18px", color: T.modSub.color, fontSize: 12 }}>Осталось в колоде: {deck.length} · {restaurant}</div>
      <div style={{ padding: "8px 16px" }}>
        <div key={`${deck.length}_${d.name || ""}`} className="sa-card sa-cardpage-r" onClick={() => !flipped && setFlipped(true)} {...(!flipped ? onActivate(() => setFlipped(true)) : {})} style={{ ...glass(T), padding: "22px 18px", minHeight: 220, cursor: !flipped ? "pointer" : "default", overflow: "hidden" }}>
          <DishPhoto src={d.img} h={flipped ? 120 : 175} />
          <div style={{ fontSize: 11, letterSpacing: 2, color: gold, fontFamily: "monospace", marginBottom: 6 }}>{d.cat || "БЛЮДО"}</div>
          <div style={{ fontSize: 21, fontWeight: "bold", marginBottom: 14, color: T.bold?.color }}>{d.name}</div>
          {!flipped ? (
            <div style={{ color: T.para?.color, fontSize: 14, lineHeight: 1.6 }}>
              Вспомни: состав, аллергены, как описать гостю и с чем сочетать. Потом переверни и сверься.
            </div>
          ) : <DishBack d={d} T={T} gold={gold} />}
        </div>
      </div>
      <div style={{ padding: "4px 16px 20px", display: "flex", gap: 10 }}>
        {!flipped ? (
          <button className="sa-btn" style={{ ...T.doneBtn, background: gold, flex: 1 }} onClick={() => setFlipped(true)}>Развернуть ↻</button>
        ) : (
          <>
            <button className="sa-btn" style={{ ...T.doneBtn, background: red, flex: 1 }} onClick={() => answer(false)}>Не знал ↻</button>
            <button className="sa-btn" style={{ ...T.doneBtn, background: green, flex: 1 }} onClick={() => answer(true)}>Знал ✓</button>
          </>
        )}
      </div>
    </div>
  );
}

// ── Режим 2: викторина (вопросы генерируются из данных меню) ─────────────────
function buildQuiz(dishes) {
  const qs = [];
  const others = (d) => dishes.filter(x => x.id !== d.id);
  // Тип А: у какого блюда есть аллерген X
  ALLERGENS_LIST.forEach(al => {
    const withAl = dishes.filter(d => (d.allergens || []).includes(al));
    const without = dishes.filter(d => !(d.allergens || []).includes(al));
    if (withAl.length && without.length >= 3) {
      const target = withAl[Math.floor(Math.random() * withAl.length)];
      const opts = shuffleArray([target, ...shuffleArray(without).slice(0, 3)]);
      qs.push({ q: `В каком блюде есть аллерген «${al}»?`, options: opts.map(o => o.name), correct: opts.indexOf(target), explanation: `${target.name}: ${(target.ingredients || []).join(", ")}` });
    }
  });
  // Тип Б: что входит в состав блюда
  const _n = (s) => String(s || "").toLowerCase().replace(/ё/g, "е").trim();
  dishes.forEach(d => {
    const own = d.ingredients || [];
    // Правильный ответ — простой ингредиент (без скобок и длинных составных описаний)
    const simpleOwn = own.filter(i => i.length <= 34 && !i.includes("("));
    const pool = simpleOwn.length ? simpleOwn : own;
    const ing = pool[Math.floor(Math.random() * pool.length)];
    if (!ing) return;
    const dText = _n(own.join(" · ")); // весь состав одной строкой, включая содержимое скобок
    const seen = new Set([_n(ing)]);
    const foreign = shuffleArray([...new Set(others(d).flatMap(x => x.ingredients || []))])
      .filter(i => {
        const n = _n(i);
        if (!n || n.length > 34 || i.includes("(")) return false; // только простые варианты
        if (seen.has(n)) return false;                             // без дублей (в т.ч. по регистру)
        if (dText.includes(n)) return false;                       // компонент есть в блюде (даже внутри составного) → не годится как «неправильный»
        seen.add(n);
        return true;
      })
      .slice(0, 3);
    if (foreign.length < 3) return;
    const opts = shuffleArray([ing, ...foreign]);
    qs.push({ q: `Что входит в состав блюда «${d.name}»?`, options: opts, correct: opts.indexOf(ing), explanation: `Полный состав: ${(d.ingredients || []).join(", ")}` });
  });
  // Тип В: сочетание
  dishes.filter(d => d.pairing).forEach(d => {
    const foreign = shuffleArray(others(d).filter(x => x.pairing && x.pairing !== d.pairing)).slice(0, 3);
    if (foreign.length < 3) return;
    const opts = shuffleArray([d, ...foreign]);
    qs.push({ q: `К какому блюду рекомендуем: «${d.pairing}»?`, options: opts.map(o => o.name), correct: opts.indexOf(d), explanation: d.desc || "" });
  });
  return shuffleArray(qs).slice(0, 10);
}

function MenuQuiz({ T, gold, green, red, dishes, Head, restaurant }) {
  const [questions, setQuestions] = React.useState(() => buildQuiz(dishes));
  const [step, setStep] = React.useState(0);
  const [pick, setPick] = React.useState(null);
  const [score, setScore] = React.useState(0);

  if (!questions.length) return (
    <div style={T.screen} className="sa-screen">{Head("Викторина")}
      <div style={{ textAlign: "center", padding: "50px 24px", color: T.modSub.color, fontSize: 14 }}>Для викторины нужно минимум 4 блюда в меню. Добавь блюда в редакторе.</div>
    </div>
  );

  if (step >= questions.length) {
    const pct = Math.round((score / questions.length) * 100);
    return (
      <div style={T.screen} className="sa-screen">
        {Head("Викторина")}
        <div style={{ textAlign: "center", padding: "60px 24px" }}>
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 14 }}>
            <div style={{ width: 76, height: 76, borderRadius: "50%", background: `${pct >= 80 ? gold : pct >= 50 ? green : red}1F`, border: `1px solid ${pct >= 80 ? gold : pct >= 50 ? green : red}55`, display: "flex", alignItems: "center", justifyContent: "center" }}>
              {pct >= 80 ? UI_SVG.trophy(gold, 38) : pct >= 50 ? UI_SVG.target(green, 36) : UI_SVG.book(red, 36)}
            </div>
          </div>
          <div style={{ ...T.bold, fontSize: 20, marginBottom: 8 }}>{score} из {questions.length}</div>
          <div style={{ color: T.modSub.color, fontSize: 14, marginBottom: 20 }}>{pct >= 80 ? "Отлично знаешь меню!" : pct >= 50 ? "Неплохо, но повтори флеш-карточки." : "Пройди флеш-карточки — и возвращайся."}</div>
          <button className="sa-btn" style={{ ...T.doneBtn, background: gold, padding: "13px 30px" }} onClick={() => { setQuestions(buildQuiz(dishes)); setStep(0); setScore(0); setPick(null); }}>Ещё раз</button>
        </div>
      </div>
    );
  }

  const q = questions[step];
  const answer = (i) => { if (pick !== null) return; setPick(i); vibrate(i === q.correct ? "light" : "error"); if (i === q.correct) setScore(s => s + 1); };
  return (
    <div style={T.screen} className="sa-screen">
      {Head("Викторина")}
      <div key={step} className="sa-cardpage-r" style={T.quizWrap}>
        <div style={T.quizProgress}>Вопрос {step + 1} из {questions.length} · {restaurant}</div>
        <div style={T.quizQ}>{q.q}</div>
        {q.options.map((opt, i) => {
          let st = { ...T.quizOpt, cursor: pick === null ? "pointer" : "default" };
          if (pick !== null) {
            if (i === q.correct) st = { ...st, background: "rgba(93,187,138,0.15)", border: `1px solid ${green}` };
            else if (i === pick) st = { ...st, background: "rgba(224,120,120,0.15)", border: `1px solid ${red}` };
            else st = { ...st, opacity: 0.5 };
          }
          return <div key={i} className="sa-opt" style={st} onClick={() => answer(i)} {...onActivate(() => answer(i))}>{opt}</div>;
        })}
        {pick !== null && q.explanation && <div style={{ ...T.note, fontStyle: "normal", borderLeft: `2px solid ${gold}`, paddingLeft: 10, marginTop: 12 }}>{q.explanation}</div>}
        {pick !== null && <button className="sa-btn" style={{ ...T.doneBtn, background: gold, width: "100%", marginTop: 14 }} onClick={() => { setPick(null); setStep(s => s + 1); }}>Дальше →</button>}
      </div>
    </div>
  );
}

// ── Режим 3: «Опиши за 60 секунд» ────────────────────────────────────────────
function Describe60({ T, gold, green, dishes, Head, restaurant, a11y }) {
  const [dish, setDish] = React.useState(() => dishes[Math.floor(Math.random() * dishes.length)]);
  const [phase, setPhase] = React.useState("ready"); // ready | speaking | compare
  const [timerKey, setTimerKey] = React.useState(0);

  const nextDish = () => {
    const rest = dishes.filter(d => d.id !== dish.id);
    setDish(rest.length ? rest[Math.floor(Math.random() * rest.length)] : dish);
    setPhase("ready"); setTimerKey(k => k + 1);
  };

  return (
    <div style={T.screen} className="sa-screen">
      {Head("Опиши за 60 секунд")}
      <div style={{ padding: "8px 16px" }}>
        <div key={dish.name} className="sa-cardpage-r" style={{ ...glass(T), padding: "22px 18px", overflow: "hidden" }}>
          <DishPhoto src={dish.img} h={165} />
          <div style={{ fontSize: 11, letterSpacing: 2, color: gold, fontFamily: "monospace", marginBottom: 6 }}>{dish.cat || "БЛЮДО"} · {restaurant}</div>
          <div style={{ fontSize: 22, fontWeight: "bold", marginBottom: 12, color: T.bold?.color }}>{dish.name}</div>

          {phase === "ready" && (
            <div style={{ color: T.para?.color, fontSize: 14, lineHeight: 1.65 }}>
              Представь: гость спрашивает «а что это за блюдо?». У тебя минута, чтобы описать его так, чтобы захотелось заказать.
              <br /><br />Говори <b style={{ color: gold }}>вслух</b> — как в зале. Про вкус, текстуру и подачу, а не только про состав.
            </div>
          )}

          {phase === "speaking" && (
            <div>
              <TimerBar key={timerKey} duration={60} color={gold} onExpire={() => setPhase("compare")} />
              <div style={{ color: T.para?.color, fontSize: 14, lineHeight: 1.6, marginTop: 12 }}>
                🎙 Говори! Вкус → текстура → из чего → с чем сочетается.
              </div>
            </div>
          )}

          {phase === "compare" && (
            <div>
              <div style={{ fontSize: 10, letterSpacing: 1.5, color: green, fontFamily: "monospace", marginBottom: 4 }}>ЭТАЛОННОЕ ОПИСАНИЕ</div>
              <div style={{ fontSize: 14.5, lineHeight: 1.6, marginBottom: 14, fontStyle: "italic", color: T.para?.color }}>{dish.desc || "Эталон не задан — добавь описание в редакторе меню."}</div>
              <DishBack d={{ ...dish, desc: "" }} T={T} gold={gold} />
              <div style={{ color: T.modSub.color, fontSize: 13, lineHeight: 1.55, marginTop: 4 }}>
                Сравни: упомянул(а) вкус? текстуру? сочетание? Чего не хватило — то и запомни.
              </div>
            </div>
          )}
        </div>
      </div>
      <div style={{ padding: "4px 16px 20px", display: "flex", gap: 10 }}>
        {phase === "ready" && <button className="sa-btn" style={{ ...T.doneBtn, background: gold, flex: 1 }} onClick={() => setPhase("speaking")}>Старт ›</button>}
        {phase === "speaking" && <button className="sa-btn" style={{ ...T.doneBtn, background: green, flex: 1 }} onClick={() => setPhase("compare")}>Я закончил(а)</button>}
        {phase === "compare" && <button className="sa-btn" style={{ ...T.doneBtn, background: gold, flex: 1 }} onClick={nextDish}>Следующее блюдо →</button>}
      </div>
    </div>
  );
}

// ── Редактор меню (для менеджеров) ───────────────────────────────────────────
// ── Доп. 162: поле редактора блюда — многострочное, растёт под текст, «✕» очищает разом.
// Объявлен на уровне модуля: компонент внутри рендера пересоздавался бы и терял фокус.
function EditorField({ value, onChange, placeholder, rows = 1, style, inputSt, textColor, a11y }) {
  const ref = React.useRef(null);
  React.useEffect(() => { const el = ref.current; if (!el) return; el.style.height = "auto"; el.style.height = Math.min(el.scrollHeight, 220) + "px"; }, [value]);
  return (
    <div style={{ position: "relative", marginBottom: 10 }}>
      <textarea ref={ref} className="sa-field" rows={rows} value={value || ""} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        style={{ ...inputSt, marginBottom: 0, paddingRight: value ? 38 : 13, resize: "none", overflow: "hidden", lineHeight: 1.45, fontFamily: "inherit", ...style }} />
      {value ? <span onClick={() => { onChange(""); vibrate("light"); ref.current && ref.current.focus(); }} {...onActivate(() => onChange(""))} aria-label="Очистить"
        style={{ position: "absolute", right: 10, top: 9, width: 24, height: 24, borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, color: textColor, background: a11y ? "rgba(0,0,0,0.08)" : "rgba(255,255,255,0.10)", cursor: "pointer" }}>✕</span> : null}
    </div>
  );
}

// Доп. 166: карточка блюда как в Колоде — для предпросмотра из редактора (лицо/оборот по тапу)
function PreviewCard({ d, T, gold, red, glass }) {
  const [back, setBack] = React.useState(false);
  const text = T.modTitle.color;
  return (
    <div className="sa-card" onClick={() => setBack(b => !b)} style={{ ...glass(T), padding: "18px 18px 16px", minHeight: 300, cursor: "pointer", position: "relative", overflow: "hidden" }}>
      {d.stop && <div style={{ position: "absolute", top: 14, right: -34, transform: "rotate(35deg)", background: red, color: "#fff", fontSize: 10, letterSpacing: 1.5, padding: "4px 40px" }}>СЕГОДНЯ НЕТ</div>}
      {!back ? (<>
        <DishPhoto src={d.img} h={190} />
        <div style={{ fontSize: 11, letterSpacing: 2, color: gold, fontFamily: "monospace", marginBottom: 6 }}>{(d.cat || "БЛЮДО").toUpperCase()}</div>
        <div style={{ fontFamily: "Georgia, serif", fontSize: 22, color: text, lineHeight: 1.2 }}>{d.name || "Без названия"}</div>
        <div style={{ marginTop: 14, fontSize: 11.5, color: gold, fontStyle: "italic", textAlign: "center" }}>тапни — состав ✦</div>
      </>) : (<>
        <div style={{ fontSize: 11, letterSpacing: 2, color: gold, fontFamily: "monospace", marginBottom: 4 }}>{(d.cat || "БЛЮДО").toUpperCase()}</div>
        <div style={{ fontFamily: "Georgia, serif", fontSize: 19, color: text, marginBottom: 8 }}>{d.name || "Без названия"}</div>
        {d.desc ? <div style={{ fontSize: 13.5, color: T.para?.color || text, lineHeight: 1.55, fontStyle: "italic", marginBottom: 8 }}>{d.desc}</div> : <div style={{ fontSize: 13, color: T.modSub.color, fontStyle: "italic", marginBottom: 8 }}>Описания для гостя пока нет — официанту придётся импровизировать.</div>}
        <DishBack d={d} T={T} gold={gold} />
      </>)}
    </div>
  );
}

function MenuEditor({ T, gold, red, green, textColor, a11y, Head, restaurant, custom, setCustom, shared = [], onPublished, hideSamples, setHideSamples, hiddenIds = {}, setHiddenIds, deleted = {}, setDeleted }) {
  const empty = { name: "", cat: "", ingredients: "", allergens: [], desc: "", pairing: "", note: "", img: "" };
  const [form, setForm] = React.useState(null); // null | { ...dish, ingredients: "строка" }
  const list = (custom[restaurant] || []).filter(d => !d.archived);
  const archived = (custom[restaurant] || []).filter(d => d.archived);
  // Блюда, опубликованные на сервере, которых нет в локальном редакторе, — их нельзя
  // ни поправить, ни удалить, пока не «заберёшь» в редактор
  const delSet = new Set(deleted[restaurant] || []);
  const orphanShared = (shared || []).filter(s => s && s.id && !(custom[restaurant] || []).some(d => d.id === s.id) && !delSet.has(s.id)); // Доп. 168: любая своя версия (и архивная) важнее серверной
  const hidSet = new Set(hiddenIds[restaurant] || []);
  const hs = hideSamples[restaurant];
  const samplesShown = hs === false ? true : hs === true ? false : (shared || []).length === 0;
  const sampleList = samplesShown ? (RESTAURANT_MENUS[restaurant] || []).filter(d => !(custom[restaurant] || []).some(x => x.id === d.id) && !hidSet.has(d.id)) : [];
  // Доп. 154: править чужое = забрать копию в свои (та же id — своя версия побеждает); удалить серверное = пометить до публикации; удалить пример = скрыть id
  const srvById = new Map((shared || []).filter(x => x && x.id).map(x => [x.id, x]));
  // jsonb на сервере переставляет ключи — сравниваем в каноническом виде (ключи по алфавиту)
  const canon = (o) => o ? JSON.stringify(o, Object.keys(o).sort()) : "";
  const sameAsServer = (d) => canon(d) === canon(srvById.get(d.id));
  const unpublished = [...list, ...archived].filter(d => !sameAsServer(d)).length + (deleted[restaurant] || []).length;
  const editForeign = (d) => setForm({ img: "", ...d, ingredients: (d.ingredients || []).join(", ") });
  const deleteServer = (id) => { const d = orphanShared.find(x => x.id === id); if (!d) return; setCustom({ ...custom, [restaurant]: [{ ...d, archived: true, archivedAt: Date.now(), stop: null }, ...(custom[restaurant] || [])] }); vibrate("light"); };
  const hideSample = (id) => { setHiddenIds({ ...hiddenIds, [restaurant]: [...(hiddenIds[restaurant] || []), id] }); vibrate("light"); };
  const inputSt = { width: "100%", boxSizing: "border-box", padding: "11px 13px", borderRadius: 12, border: `1px solid ${gold}88`, borderTop: `1px solid ${gold}55`, background: a11y ? "rgba(255,255,255,0.55)" : "rgba(0,0,0,0.25)", boxShadow: "0 2px 6px rgba(0,0,0,0.12) inset", color: textColor, fontSize: 15, outline: "none", marginBottom: 10 };

  // ── Этап 4: AI-импорт из PDF (серверная функция /api/menu-import + ключ в Vercel) ──
  const [importing, setImporting] = React.useState(false);
  const [importErr, setImportErr] = React.useState("");
  const [preview, setPreview] = React.useState(null); // список блюд из PDF на подтверждение
  const onPdf = (e) => {
    const file = e.target.files && e.target.files[0]; e.target.value = "";
    if (!file) return;
    setImportErr(""); setImporting(true);
    const fr = new FileReader();
    fr.onload = () => {
      const pdfBase64 = String(fr.result).split(",")[1];
      fetch("/api/menu-import", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ pdfBase64, token: saToken() }) })
        .then(r => r.json().then(j => ({ ok: r.ok, j })))
        .then(({ ok, j }) => {
          setImporting(false);
          if (!ok || !Array.isArray(j.dishes)) { setImportErr(j.error || "Не получилось разобрать PDF. Настроен ли OPENROUTER_API_KEY в Vercel? (см. docs/UPGRADE_NOTES.md)"); return; }
          setPreview(j.dishes);
        })
        .catch(() => { setImporting(false); setImportErr("Сеть недоступна или функция /api/menu-import не развёрнута."); });
    };
    fr.readAsDataURL(file);
  };
  const acceptImport = () => {
    const now = Date.now();
    const added = (preview || []).map((d, i) => ({
      img: "", pairing: "", note: "", cat: "", desc: "", ...d,
      ingredients: Array.isArray(d.ingredients) ? d.ingredients : String(d.ingredients || "").split(",").map(s => s.trim()).filter(Boolean),
      allergens: Array.isArray(d.allergens) ? d.allergens.filter(a => ALLERGENS_LIST.includes(a)) : [],
      id: "i" + now + "_" + i, isNew: true, addedAt: now,
    }));
    setCustom({ ...custom, [restaurant]: [...added, ...list] });
    setPreview(null); vibrate("light");
  };

  // ── Этап 4: публикация меню всей команде — честный вызов с ответом сервера ──
  const [pubBusy, setPubBusy] = React.useState(false);
  const [pubMsg, setPubMsg] = React.useState(null); // { ok, text }
  const _showPub = (ok, text) => { setPubMsg({ ok, text }); setTimeout(() => setPubMsg(null), 8000); };
  const publishList = (dishesToPublish) => {
    if (!saToken() || !restaurant) return;
    rpc("menu_set", { p_token: saToken(), p_restaurant: restaurant, p_dishes: JSON.stringify(dishesToPublish) })
      .then(res => { if (res && res.ok === true) { if (onPublished) onPublished(dishesToPublish); rememberSharedMenu(restaurant, dishesToPublish); try { localStorage.setItem("sa_menu_pub_" + restaurant, String(Date.now())); } catch (e) {} } })
      .catch(() => {});
  };
  // Доп. 166: стоп-лист. Один тап — блюдо помечено «сегодня нет» и это сразу уходит команде.
  const toggleStop = (d) => {
    const stopped = !d.stop;
    const upd = { ...d, stop: stopped ? { since: Date.now() } : null };
    const own = custom[restaurant] || []; // все свои, включая архив — иначе setCustom стёр бы архив
    const nextOwn = own.some(x => x.id === d.id) ? own.map(x => x.id === d.id ? upd : x) : [upd, ...own];
    setCustom({ ...custom, [restaurant]: nextOwn });
    vibrate(stopped ? "error" : "success");
    publishList([...nextOwn, ...orphanShared.filter(x => x.id !== d.id)]);
  };
  const publish = () => {
    if (!saToken()) { _showPub(false, "Нужен вход по коду сотрудника"); return; }
    setPubBusy(true);
    const toPublish = [...list, ...archived, ...orphanShared]; // Доп. 154/167: свои + архив (с флагом) + серверные
    rpc("menu_set", { p_token: saToken(), p_restaurant: restaurant, p_dishes: JSON.stringify(toPublish) })
      .then(res => {
        setPubBusy(false);
        if (res && res.ok === true) {
          _showPub(true, toPublish.length ? "Опубликовано ✓ — команда увидит меню при следующем открытии тренажёра" : "Опубликовано ✓ — серверное меню очищено");
          if (onPublished) onPublished(toPublish);
          if (setDeleted) setDeleted({ ...deleted, [restaurant]: [] });
          rememberSharedMenu(restaurant, toPublish);
          try { localStorage.setItem("sa_menu_pub_" + restaurant, String(Date.now())); } catch (e) {}
          vibrate("light");
        }
        else if (res && res.ok === false) _showPub(false, res.error === "auth" ? "Сервер не подтвердил сессию — выйди и зайди по коду заново" : "Сервер отклонил: " + (res.error || "неизвестно"));
        else if (res && res.message) _showPub(false, "Ошибка сервера: " + String(res.message).slice(0, 140));
        else _showPub(false, "Неожиданный ответ сервера");
      })
      .catch(() => {
        setPubBusy(false);
        rpcSync("menu_set", { p_token: saToken(), p_restaurant: restaurant, p_dishes: JSON.stringify(toPublish) });
        _showPub(false, "Нет сети — публикация отправится автоматически, когда связь появится");
      });
  };

  const save = () => {
    if (!form.name.trim()) return;
    const dish = { ...form, id: form.id || "c" + Date.now(), name: form.name.trim(), ingredients: form.ingredients.split(",").map(s => s.trim()).filter(Boolean) };
    if (!form.id) { dish.isNew = true; dish.addedAt = Date.now(); } // новое блюдо → в «Новые позиции» на 30 дней
    // Доп. 154: чужое блюдо (пример или серверное) с той же id ещё не в своих — добавляем как свою версию
    const own = custom[restaurant] || [];
    const next = { ...custom, [restaurant]: form.id && own.some(d => d.id === form.id) ? own.map(d => d.id === form.id ? dish : d) : [dish, ...own] };
    setCustom(next); setForm(null); vibrate("light");
  };
  // Доп. 163: удаление с отменой (6 секунд), поиск и раздел в списке, признак неопубликованных изменений
  const [undo, setUndo] = React.useState(null);
  const undoTimer = React.useRef(null);
  // Доп. 167: удаление = архив (archived:true), не небытие. Архив едет на сервер вместе с меню,
  // официанты и Наставник его не видят; вернуть можно в любой момент.
  const allOwn = custom[restaurant] || [];
  const remove = (id) => {
    const dish = allOwn.find(d => d.id === id);
    setCustom({ ...custom, [restaurant]: allOwn.map(d => d.id === id ? { ...d, archived: true, archivedAt: Date.now(), stop: null } : d) });
    if (dish) { setUndo(dish); clearTimeout(undoTimer.current); undoTimer.current = setTimeout(() => setUndo(null), 6000); vibrate("light"); }
  };
  const restoreRemoved = () => { if (!undo) return; unarchive(undo.id); setUndo(null); clearTimeout(undoTimer.current); };
  const unarchive = (id) => { setCustom({ ...custom, [restaurant]: (custom[restaurant] || []).map(d => d.id === id ? { ...d, archived: false, archivedAt: null } : d) }); vibrate("success"); };
  const destroy = (id) => { setCustom({ ...custom, [restaurant]: (custom[restaurant] || []).filter(d => d.id !== id) }); if (setDeleted && (shared || []).some(x => x && x.id === id)) setDeleted({ ...deleted, [restaurant]: [...(deleted[restaurant] || []), id] }); vibrate("error"); };
  // Доп. 166: дублировать (вариации) и двигать внутри раздела (порядок как в печатном меню)
  const duplicate = (d) => { const copy = { ...d, id: "c" + Date.now(), name: d.name + " (копия)", stop: null, archived: false }; setCustom({ ...custom, [restaurant]: [copy, ...(custom[restaurant] || [])] }); vibrate("light"); setForm({ img: "", ...copy, ingredients: (copy.ingredients || []).join(", ") }); };
  const moveIn = (d, dir) => {
    const same = list.filter(x => normCat(x.cat) === normCat(d.cat));
    const i = same.findIndex(x => x.id === d.id), j = i + dir;
    if (j < 0 || j >= same.length) return;
    const own = custom[restaurant] || [];
    const a = own.indexOf(same[i]), b = own.indexOf(same[j]);
    const next = own.slice(); [next[a], next[b]] = [next[b], next[a]];
    setCustom({ ...custom, [restaurant]: next }); vibrate("light");
  };
  const [eq, setEq] = React.useState("");
  const [ecat, setEcat] = React.useState("");
  const vis = (arr) => arr.filter(d => dishMatches(d, eq) && (!ecat || normCat(d.cat) === ecat));
  const [photoState, setPhotoState] = React.useState(""); // Доп. 135: "" | uploading | cloud | local (хук — на верхнем уровне компонента)
  React.useEffect(() => { if (!form) setPhotoState(""); }, [form]); // закрыли форму — подпись не переезжает на следующее блюдо
  // Доп. 166: предпросмотр «как увидит официант» и AI-описание по составу
  const [preview2, setPreview2] = React.useState(false);
  const [aiBusy, setAiBusy] = React.useState(false);
  const [aiErr, setAiErr] = React.useState("");
  const [aiVariants, setAiVariants] = React.useState([]); // Доп. 167: три варианта на выбор
  React.useEffect(() => { if (!form) { setPreview2(false); setAiErr(""); setAiVariants([]); } }, [form]);
  const aiDescribe = () => {
    if (!form || !form.name.trim() || aiBusy) return;
    setAiBusy(true); setAiErr("");
    const ing = String(form.ingredients || "").split(",").map(x => x.trim()).filter(Boolean).join(", ");
    const ask = `Напиши три разных «вкусных описания» блюда для гостя ресторана «${restaurant}» — каждое два предложения, тёплым живым языком официанта, без пафоса и без перечисления ингредиентов подряд. Первое — про вкус и текстуру, второе — про происхождение или способ приготовления, третье — короткое и игривое. Блюдо: «${form.name.trim()}»${form.cat ? ` (раздел: ${form.cat})` : ""}. Состав: ${ing || "не указан"}.${form.note ? ` Важно: ${form.note}` : ""} Формат ответа строго: три абзаца, каждый начинается с «1.», «2.», «3.». Без кавычек, заголовков и пояснений.`;
    fetch(`${SUPABASE_URL}/functions/v1/ai-chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: SUPABASE_KEY, Authorization: "Bearer " + SUPABASE_KEY },
      body: JSON.stringify({ token: saToken(), messages: [{ role: "user", content: ask }] }),
    }).then(r => r.json()).then(j => {
      setAiBusy(false);
      if (j && j.ok && j.reply) {
        const raw = String(j.reply).replace(/\[\[[^\]]*\]\]/g, "");
        const parts = raw.split(/\n?\s*(?:^|\n)\s*[1-3][.)]\s*/m).map(x => x.replace(/^["«»\s*]+|["«»\s*]+$/g, "").trim()).filter(x => x.length > 20).slice(0, 3);
        if (parts.length >= 2) { setAiVariants(parts); vibrate("success"); }
        else if (parts.length === 1) { setForm(f => ({ ...f, desc: parts[0] })); vibrate("success"); }
        else setAiErr("Наставник ответил невнятно — попробуй ещё раз");
      }
      else setAiErr("Наставник не ответил — попробуй ещё раз");
    }).catch(() => { setAiBusy(false); setAiErr("Нет связи с Наставником"); });
  };

  if (form) {
    const toggleAl = (al) => setForm(f => ({ ...f, allergens: f.allergens.includes(al) ? f.allergens.filter(x => x !== al) : [...f.allergens, al] }));
    // Доп. 135: сжали на телефоне → отправили в Storage → в блюде остаётся ссылка.
    // Не получилось (функция не развёрнута, нет сети) — base64 в localStorage, как раньше.
    const onPhoto = (e) => {
      const file = e.target.files && e.target.files[0]; e.target.value = "";
      if (!file) return;
      readPhoto(file, (data) => {
        setForm(f => ({ ...f, img: data }));
        setPhotoState("uploading");
        fetch(`${SUPABASE_URL}/functions/v1/photo-upload`, {
          method: "POST",
          headers: { "Content-Type": "application/json", apikey: SUPABASE_KEY, Authorization: "Bearer " + SUPABASE_KEY },
          body: JSON.stringify({ token: saToken(), restaurant, dishId: form.id || ("d" + Date.now()), image: data }),
        }).then(r => r.json()).then(j => {
          if (j && j.ok && j.url) { setForm(f => ({ ...f, img: j.url })); setPhotoState("cloud"); }
          else setPhotoState("local");
        }).catch(() => setPhotoState("local"));
      });
    };
    // Доп. 163: рабочая форма — разделы, состав чипами, подсказки аллергенов, липкие кнопки
    const secLabel = (t) => <div style={{ fontSize: 10.5, letterSpacing: 1.6, color: gold, fontFamily: "monospace", margin: "14px 2px 8px" }}>{t}</div>;
    const ingList = String(form.ingredients || "").split(",").map(x => x.trim()).filter(Boolean);
    const setIng = (arr) => setForm(f => ({ ...f, ingredients: arr.join(", ") }));
    const addIng = (raw) => { const parts = String(raw || "").split(",").map(x => x.trim()).filter(Boolean); if (parts.length) setIng([...ingList, ...parts.filter(x => !ingList.includes(x))]); };
    const hints = suggestAllergens(ingList, form.allergens);
    const cats = [...CAT_ORDER, ...[...new Set([...list, ...(shared || []), ...(RESTAURANT_MENUS[restaurant] || [])].map(d => normCat(d.cat)).filter(Boolean))].filter(c => !CAT_ORDER.some(x => x.toLowerCase() === c.toLowerCase()))];
    const chip = (on, danger) => ({ padding: "6px 11px", borderRadius: 10, fontSize: 12.5, cursor: "pointer", flexShrink: 0, whiteSpace: "nowrap",
      border: `1px solid ${on ? (danger ? red : gold) : gold + "55"}`, background: on ? (danger ? "rgba(224,120,120,0.15)" : "rgba(214,178,102,0.16)") : "transparent", color: on ? (danger ? red : textColor) : T.modSub.color });
    const canSave = !!form.name.trim();
    const isEdit = !!form.id && list.some(d => d.id === form.id);
    return (
      <div style={T.screen} className="sa-screen">
        {Head(form.id ? "Изменить блюдо" : "Новое блюдо")}
        <div style={{ padding: "6px 16px 130px" }}>
          {secLabel("ФОТО")}
          {form.img
            ? <div style={{ position: "relative", marginBottom: 4 }}>
                <img src={form.img} alt="" loading="lazy" decoding="async" style={{ width: "100%", height: 160, objectFit: "cover", borderRadius: 14, display: "block", border: `1px solid ${gold}44` }} />
                <div onClick={() => setForm(f => ({ ...f, img: "" }))} {...onActivate(() => setForm(f => ({ ...f, img: "" })))} style={{ position: "absolute", top: 8, right: 8, width: 28, height: 28, borderRadius: 14, background: "rgba(0,0,0,0.55)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", fontSize: 14 }}>✕</div>
                {photoState && <div style={{ position: "absolute", left: 8, bottom: 8, fontSize: 10.5, padding: "3px 8px", borderRadius: 999, background: "rgba(0,0,0,0.55)", color: photoState === "local" ? "#F0B37A" : "#EFE4C8" }}>
                  {photoState === "uploading" ? "Отправляю в облако…" : photoState === "cloud" ? "В облаке — увидят все" : "Только на этом телефоне"}
                </div>}
                <label style={{ position: "absolute", right: 8, bottom: 8, fontSize: 11, padding: "4px 10px", borderRadius: 999, background: "rgba(0,0,0,0.55)", color: "#EFE4C8", cursor: "pointer" }}>Заменить<input type="file" accept="image/*" onChange={onPhoto} style={{ display: "none" }} /></label>
              </div>
            : <label style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "20px 13px", borderRadius: 14, border: `1.5px dashed ${gold}77`, color: T.para?.color, fontSize: 14, cursor: "pointer" }}>
                {GAME_SVG.cards(gold, 18)} Снять или выбрать фото
                <input type="file" accept="image/*" onChange={onPhoto} style={{ display: "none" }} />
              </label>}

          {secLabel("ОСНОВНОЕ")}
          <EditorField inputSt={inputSt} textColor={textColor} a11y={a11y} placeholder="Название блюда *" value={form.name} onChange={v => setForm(f => ({ ...f, name: v }))} style={{ fontSize: 17, fontFamily: "Georgia, serif" }} />
          <div className="sa-hscroll" style={{ display: "flex", gap: 7, overflowX: "auto", padding: "2px 0 8px", WebkitOverflowScrolling: "touch" }}>
            {cats.map(c => <span key={c} style={chip(normCat(form.cat).toLowerCase() === c.toLowerCase())} onClick={() => setForm(f => ({ ...f, cat: normCat(f.cat).toLowerCase() === c.toLowerCase() ? "" : c }))}>{c}</span>)}
            <span style={chip(!!form.cat && !cats.some(c => c.toLowerCase() === normCat(form.cat).toLowerCase()))} onClick={() => { const v = window.prompt("Название раздела", form.cat || ""); if (v != null) setForm(f => ({ ...f, cat: v.trim() })); }}>＋ свой раздел</span>
          </div>
          {form.cat && !cats.some(c => c.toLowerCase() === normCat(form.cat).toLowerCase()) && <div style={{ fontSize: 12, color: T.modSub.color, margin: "-4px 2px 8px" }}>Раздел: <b style={{ color: textColor }}>{form.cat}</b></div>}

          {secLabel("СОСТАВ И АЛЛЕРГЕНЫ")}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 7, marginBottom: 8 }}>
            {ingList.map((x, i) => (
              <span key={i} style={{ ...chip(true), display: "inline-flex", alignItems: "center", gap: 6, paddingRight: 8 }}>
                {x}<span onClick={() => setIng(ingList.filter((_, k) => k !== i))} style={{ opacity: 0.7, fontSize: 12 }}>✕</span>
              </span>
            ))}
          </div>
          <input className="sa-field" style={{ ...inputSt, marginBottom: 4 }} placeholder={ingList.length ? "Ещё ингредиент — Enter или запятая" : "Ингредиент — Enter или запятая"}
            onKeyDown={e => { if (e.key === "Enter" || e.key === ",") { e.preventDefault(); addIng(e.currentTarget.value); e.currentTarget.value = ""; } }}
            onBlur={e => { if (e.currentTarget.value.trim()) { addIng(e.currentTarget.value); e.currentTarget.value = ""; } }}
            onChange={e => { if (e.target.value.includes(",")) { addIng(e.target.value); e.target.value = ""; } }} />
          <div style={{ fontSize: 11.5, color: T.modSub.color, margin: "0 2px 10px" }}>Можно вставить весь состав через запятую — разложится на чипы.</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 8 }}>
            {ALLERGENS_LIST.map(al => <span key={al} style={chip(form.allergens.includes(al), true)} onClick={() => toggleAl(al)} {...onActivate(() => toggleAl(al))}>{al}</span>)}
          </div>
          {hints.length > 0 && (
            <div className="sa-fadein" style={{ ...glass(T), padding: "10px 12px", marginBottom: 4, borderColor: red + "66" }}>
              <div style={{ fontSize: 11, letterSpacing: 1.2, color: red, fontFamily: "monospace", marginBottom: 6 }}>ПРОВЕРЬ АЛЛЕРГЕНЫ</div>
              {hints.map(h => (
                <div key={h.allergen} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: T.para?.color, marginBottom: 6 }}>
                  <span style={{ flex: 1 }}>В составе «{h.because}…» — похоже на <b style={{ color: red }}>{h.allergen}</b></span>
                  <span style={{ ...chip(false), padding: "4px 10px", color: red, borderColor: red + "88" }} onClick={() => toggleAl(h.allergen)}>Добавить</span>
                </div>
              ))}
            </div>
          )}

          {secLabel("ДЛЯ ГОСТЯ")}
          <EditorField inputSt={inputSt} textColor={textColor} a11y={a11y} placeholder="Эталонное «вкусное описание» для гостя" value={form.desc} onChange={v => setForm(f => ({ ...f, desc: v }))} rows={3} />
          <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "-4px 0 10px" }}>
            <span onClick={aiDescribe} {...onActivate(aiDescribe)} style={{ padding: "6px 12px", borderRadius: 999, fontSize: 12.5, cursor: canSave ? "pointer" : "default", border: `1px solid ${gold}88`, color: gold, opacity: canSave && !aiBusy ? 1 : 0.5 }}>{aiBusy ? "Наставник пишет…" : aiVariants.length ? "✦ Ещё три варианта" : "✦ Три варианта описания"}</span>
            {aiErr && <span style={{ fontSize: 12, color: red }}>{aiErr}</span>}
          </div>
          {aiVariants.length > 0 && (
            <div className="sa-fadein" style={{ ...glass(T), padding: "10px 12px", marginBottom: 12 }}>
              <div style={{ fontSize: 10.5, letterSpacing: 1.4, color: gold, fontFamily: "monospace", marginBottom: 8 }}>ВЫБЕРИ — ПОТОМ МОЖНО ПРАВИТЬ</div>
              {aiVariants.map((v, i) => (
                <div key={i} onClick={() => { setForm(f => ({ ...f, desc: v })); vibrate("light"); }} {...onActivate(() => setForm(f => ({ ...f, desc: v })))}
                  style={{ padding: "9px 11px", borderRadius: 12, marginBottom: 6, cursor: "pointer", fontSize: 13.5, lineHeight: 1.5, color: T.para?.color, border: `1px solid ${form.desc === v ? gold : gold + "33"}`, background: form.desc === v ? "rgba(214,178,102,0.12)" : "transparent" }}>
                  <span style={{ color: gold, marginRight: 6 }}>{i + 1}.</span>{v}
                </div>
              ))}
            </div>
          )}
          <EditorField inputSt={inputSt} textColor={textColor} a11y={a11y} placeholder="Сочетание (вино, напитки)" value={form.pairing} onChange={v => setForm(f => ({ ...f, pairing: v }))} />
          <EditorField inputSt={inputSt} textColor={textColor} a11y={a11y} placeholder="Важно знать (прожарки, подача, выход в граммах…)" value={form.note} onChange={v => setForm(f => ({ ...f, note: v }))} rows={2} />
        </div>
        {/* липкие кнопки — всегда под рукой */}
        <div style={{ position: "fixed", left: 0, right: 0, bottom: 0, padding: "10px 16px calc(12px + env(safe-area-inset-bottom, 0px))", zIndex: 30,
          background: a11y ? "rgba(245,238,222,0.92)" : "rgba(21,17,11,0.92)", borderTop: `1px solid ${gold}33`, backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)" }}>
          <div style={{ display: "flex", gap: 10 }}>
            <button className="sa-btn" style={{ ...T.doneBtn, background: "transparent", border: `1px solid ${gold}66`, color: textColor, flex: 1 }} onClick={() => setForm(null)}>Отмена</button>
            <button className="sa-btn" style={{ ...T.doneBtn, background: "transparent", border: `1px solid ${gold}88`, color: gold, flex: 1, opacity: canSave ? 1 : 0.5 }} disabled={!canSave} onClick={() => { setPreview2(true); vibrate("light"); }}>Как увидит официант</button>
            <button className="sa-btn" style={{ ...T.doneBtn, background: gold, flex: 1.4, opacity: canSave ? 1 : 0.5 }} disabled={!canSave} onClick={save}>{isEdit ? "Сохранить" : "Добавить в меню"}</button>
          </div>
          {!isEdit && <div style={{ textAlign: "center", marginTop: 8 }}><span style={{ fontSize: 12.5, color: gold, cursor: canSave ? "pointer" : "default", opacity: canSave ? 1 : 0.4 }} onClick={() => { if (!canSave) return; save(); setTimeout(() => setForm({ ...empty, cat: form.cat }), 0); }}>Сохранить и добавить ещё{form.cat ? ` в «${form.cat}»` : ""} ›</span></div>}
        </div>
        {preview2 && (() => {
          const d = { ...form, ingredients: ingList };
          return (
            <div onClick={() => setPreview2(false)} style={{ position: "fixed", inset: 0, zIndex: 60, background: "rgba(0,0,0,0.55)", display: "flex", alignItems: "center", justifyContent: "center", padding: 18 }}>
              <div onClick={e => e.stopPropagation()} className="sa-fadein" style={{ width: "100%", maxWidth: 420 }}>
                <div style={{ textAlign: "center", fontSize: 10.5, letterSpacing: 1.6, color: "#EFE4C8", fontFamily: "monospace", marginBottom: 8 }}>ТАК УВИДИТ ОФИЦИАНТ · ТАП — ПЕРЕВЕРНУТЬ</div>
                <PreviewCard d={d} T={T} gold={gold} red={red} glass={glass} />
                <button className="sa-btn" onClick={() => setPreview2(false)} style={{ ...T.doneBtn, width: "100%", marginTop: 12, background: gold }}>Вернуться к правке</button>
              </div>
            </div>
          );
        })()}
      </div>
    );
  }

  return (
    <div style={T.screen} className="sa-screen">
      {Head("Редактор меню")}
      {preview ? (
        <div style={{ padding: "10px 16px 24px" }}>
          <div style={{ ...glass(T), padding: "14px 15px", marginBottom: 12 }}>
            <div style={{ fontSize: 11, letterSpacing: 2, color: gold, fontFamily: "monospace", marginBottom: 6 }}>AI РАЗОБРАЛ PDF · ПРОВЕРЬ ДО ДОБАВЛЕНИЯ</div>
            <div style={{ fontSize: 14, color: T.para?.color, lineHeight: 1.55 }}>Нашёл <b style={{ color: gold }}>{preview.length}</b> блюд. Разделы и аллергены можно поправить прямо здесь: тап по чипу. Блюда без аллергенов подсвечены — ИИ мог пропустить, а у стола это дорого.</div>
          </div>
          {(() => {
            const catsAll = [...CAT_ORDER, ...[...new Set(preview.map(d => normCat(d.cat)).filter(Boolean))].filter(c => !CAT_ORDER.some(x => x.toLowerCase() === c.toLowerCase()))];
            const upd = (i, patch) => setPreview(pv => pv.map((d, k) => k === i ? { ...d, ...patch } : d));
            return preview.map((d, i) => {
              const als = Array.isArray(d.allergens) ? d.allergens : [];
              const ings = Array.isArray(d.ingredients) ? d.ingredients : String(d.ingredients || "").split(",").map(x => x.trim()).filter(Boolean);
              const hints = suggestAllergens(ings, als);
              const noAl = !als.length;
              return (
                <div key={i} style={{ ...glass(T), padding: "11px 14px", marginBottom: 8, borderColor: noAl ? red + "66" : undefined }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{ ...T.modTitle, flex: 1 }}>{d.name || "Без названия"}</div>
                    <span onClick={() => setPreview(pv => pv.filter((_, k) => k !== i))} style={{ color: red, cursor: "pointer", padding: "2px 6px" }}>✕</span>
                  </div>
                  <div style={{ ...T.modSub, whiteSpace: "normal", marginTop: 2 }}>{ings.slice(0, 6).join(", ") || "состав не распознан"}</div>
                  <div className="sa-hscroll" style={{ display: "flex", gap: 6, overflowX: "auto", padding: "8px 0 2px" }}>
                    {catsAll.map(c => <span key={c} onClick={() => upd(i, { cat: normCat(d.cat).toLowerCase() === c.toLowerCase() ? "" : c })} style={{ padding: "4px 10px", borderRadius: 999, fontSize: 11.5, cursor: "pointer", flexShrink: 0, whiteSpace: "nowrap", border: `1px solid ${normCat(d.cat).toLowerCase() === c.toLowerCase() ? gold : gold + "44"}`, background: normCat(d.cat).toLowerCase() === c.toLowerCase() ? "rgba(214,178,102,0.16)" : "transparent", color: normCat(d.cat).toLowerCase() === c.toLowerCase() ? textColor : T.modSub.color }}>{c}</span>)}
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 6 }}>
                    {ALLERGENS_LIST.map(al => { const on = als.includes(al); return <span key={al} onClick={() => upd(i, { allergens: on ? als.filter(x => x !== al) : [...als, al] })} style={{ padding: "4px 9px", borderRadius: 999, fontSize: 11, cursor: "pointer", border: `1px solid ${on ? red : gold + "44"}`, background: on ? "rgba(224,120,120,0.15)" : "transparent", color: on ? red : T.modSub.color }}>{al}</span>; })}
                  </div>
                  {hints.length > 0 && <div style={{ fontSize: 12, color: red, marginTop: 6 }}>Проверь: в составе «{hints[0].because}…» — похоже на {hints.map(h => h.allergen).join(", ")}</div>}
                  {noAl && !hints.length && <div style={{ fontSize: 12, color: T.modSub.color, marginTop: 6 }}>Аллергенов не найдено — если так и есть, всё в порядке.</div>}
                </div>
              );
            });
          })()}
          <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
            <button className="sa-btn" style={{ ...T.doneBtn, flex: 1, background: "transparent", border: `1px solid ${gold}88`, color: textColor }} onClick={() => setPreview(null)}>Отмена</button>
            <button className="sa-btn sa-btn-pulse" style={{ ...T.doneBtn, flex: 1, background: green, color: "#fff" }} onClick={acceptImport} disabled={!preview.length}>Добавить ({preview.length}) ✓</button>
          </div>
        </div>
      ) : (<>
      <div style={{ padding: "10px 16px 0" }}>
        {/* Доп. 166: шапка со статусом — менеджер всегда видит, что делать дальше */}
        {(() => {
          const teamCount = list.length + orphanShared.length;
          const stopped = [...list, ...orphanShared].filter(d => d.stop).length;
          let pubAt = 0; try { pubAt = Number(localStorage.getItem("sa_menu_pub_" + restaurant) || 0); } catch (e) {}
          const ago = pubAt ? (() => { const m = Math.round((Date.now() - pubAt) / 60000); return m < 1 ? "только что" : m < 60 ? `${m} мин назад` : m < 1440 ? `${Math.round(m / 60)} ч назад` : `${Math.round(m / 1440)} дн назад`; })() : null;
          return (
            <div style={{ ...glass(T), padding: "14px 15px", marginBottom: 10 }}>
              <div style={{ fontSize: 10.5, letterSpacing: 1.6, color: gold, fontFamily: "monospace", marginBottom: 6 }}>МЕНЮ КОМАНДЫ · {restaurant}</div>
              <div style={{ fontFamily: "Georgia, serif", fontSize: 20, color: textColor, lineHeight: 1.2 }}>{teamCount} {teamCount % 10 === 1 && teamCount % 100 !== 11 ? "блюдо" : teamCount % 10 >= 2 && teamCount % 10 <= 4 && (teamCount % 100 < 12 || teamCount % 100 > 14) ? "блюда" : "блюд"}{stopped ? <span style={{ color: red, fontSize: 14 }}> · в стопе {stopped}</span> : null}</div>
              <div style={{ fontSize: 12.5, color: unpublished ? gold : T.modSub.color, marginTop: 4 }}>
                {unpublished ? `${unpublished} ${unpublished === 1 ? "изменение ждёт" : unpublished < 5 ? "изменения ждут" : "изменений ждут"} публикации — команда видит старую версию` : ago ? `Опубликовано ${ago} — команда видит актуальное` : "Ещё не публиковалось — команда видит примеры"}
              </div>
              <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
                {unpublished
                  ? <button className="sa-btn sa-btn-pulse" style={{ ...T.doneBtn, flex: 1.5, background: green, color: "#fff", opacity: pubBusy ? 0.55 : 1 }} onClick={publish} disabled={pubBusy}>{pubBusy ? "Отправляю…" : `Опубликовать · ${unpublished}`}</button>
                  : <button className="sa-btn" style={{ ...T.doneBtn, flex: 1.5, background: gold }} onClick={() => setForm({ ...empty })}>+ Добавить блюдо</button>}
                {unpublished
                  ? <button className="sa-btn" style={{ ...T.doneBtn, flex: 1, background: "transparent", border: `1px solid ${gold}88`, color: textColor }} onClick={() => setForm({ ...empty })}>+ Блюдо</button>
                  : <label className="sa-btn" style={{ ...T.doneBtn, flex: 1, background: "transparent", border: `1.5px dashed ${gold}88`, color: T.para?.color, textAlign: "center", cursor: "pointer", opacity: importing ? 0.55 : 1 }}>
                      {importing ? "Читаю PDF…" : "⚡ PDF"}
                      <input type="file" accept="application/pdf" onChange={onPdf} disabled={importing} style={{ display: "none" }} />
                    </label>}
              </div>
              {unpublished ? (
                <label className="sa-btn" style={{ display: "block", textAlign: "center", marginTop: 8, fontSize: 12.5, color: T.modSub.color, cursor: "pointer" }}>
                  {importing ? "Читаю PDF…" : "⚡ Импорт из PDF"}
                  <input type="file" accept="application/pdf" onChange={onPdf} disabled={importing} style={{ display: "none" }} />
                </label>
              ) : null}
            </div>
          );
        })()}
        {pubMsg && <div style={{ marginTop: 8, fontSize: 12.5, lineHeight: 1.5, color: pubMsg.ok ? green : red }}>{pubMsg.text}</div>}
        {!pubMsg && unpublished > 0 && <div style={{ marginTop: 8, fontSize: 12.5, color: T.modSub.color }}>Команда пока видит старую версию — {unpublished} {unpublished === 1 ? "изменение" : unpublished < 5 ? "изменения" : "изменений"} ждут публикации.</div>}
        {undo && (
          <div className="sa-fadein" style={{ ...glass(T), marginTop: 10, padding: "10px 13px", display: "flex", alignItems: "center", gap: 10, fontSize: 13, color: T.para?.color }}>
            <span style={{ flex: 1 }}>«{undo.name}» удалено</span>
            <span style={{ color: gold, fontWeight: "bold", cursor: "pointer" }} onClick={restoreRemoved} {...onActivate(restoreRemoved)}>Вернуть</span>
          </div>
        )}
        {(list.length + orphanShared.length + sampleList.length) > 6 && (
          <div style={{ marginTop: 12 }}>
            <input className="sa-field" value={eq} onChange={e => setEq(e.target.value)} placeholder="Найти блюдо в редакторе…" style={{ ...inputSt, marginBottom: 8, padding: "9px 12px", fontSize: 14 }} />
            <div className="sa-hscroll" style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 2 }}>
              {[{ cat: "", n: list.length + orphanShared.length + sampleList.length }, ...groupByCat([...list, ...orphanShared, ...sampleList]).map(g => ({ cat: g.cat, n: g.items.length }))].map(g => (
                <span key={g.cat || "_all"} onClick={() => setEcat(g.cat === ecat ? "" : g.cat)} style={{ padding: "4px 10px", borderRadius: 999, fontSize: 11.5, cursor: "pointer", flexShrink: 0, whiteSpace: "nowrap", border: `1px solid ${ecat === g.cat ? gold : gold + "55"}`, background: ecat === g.cat ? "rgba(214,178,102,0.16)" : "transparent", color: ecat === g.cat ? textColor : T.modSub.color }}>{g.cat || "Все"} · {g.n}</span>
              ))}
            </div>
          </div>
        )}
        {importErr && <div style={{ marginTop: 8, fontSize: 12.5, lineHeight: 1.5, color: red }}>{importErr}</div>}
        {orphanShared.length > 0 && (
          <div style={{ ...glass(T), padding: "13px 14px", marginTop: 12, fontSize: 13, color: T.para?.color, lineHeight: 1.55 }}>
            На сервере команды опубликовано <b style={{ color: gold }}>{orphanShared.length}</b> блюд, которых нет в твоём редакторе — их нельзя изменить или удалить, пока не заберёшь сюда.
            <button className="sa-btn" style={{ ...T.doneBtn, width: "100%", marginTop: 10, background: "transparent", border: `1px solid ${gold}88`, color: T.para?.color }}
              onClick={() => { setCustom({ ...custom, [restaurant]: [...list, ...orphanShared] }); vibrate("light"); }}
              {...onActivate(() => { setCustom({ ...custom, [restaurant]: [...list, ...orphanShared] }); })}>
              Забрать в редактор ({orphanShared.length})
            </button>
          </div>
        )}
        <div onClick={() => setHideSamples({ ...hideSamples, [restaurant]: samplesShown })} {...onActivate(() => setHideSamples({ ...hideSamples, [restaurant]: samplesShown }))}
          className="sa-card"
          style={{ ...glass(T), margin: "12px 0 4px", padding: "11px 13px", fontSize: 13.5, color: T.para?.color, cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
          <span>Примеры-заготовки в тренажёре{hs === undefined && (shared || []).length ? <span style={{ color: T.modSub.color, fontSize: 12 }}> · скрыты сами: есть меню команды</span> : null}</span>
          <b style={{ color: samplesShown ? "#5DBB8A" : red, flexShrink: 0 }}>{samplesShown ? "видны" : "скрыты"}</b>
        </div>
      </div>
      <div style={{ ...T.secTitle }}>Свои блюда ({vis(list).length}{eq || ecat ? ` из ${list.length}` : ""})</div>
      <div style={{ padding: "0 14px 14px" }}>
        {!list.length && <div style={{ color: T.modSub.color, fontSize: 13, padding: "6px 4px" }}>Пока пусто. Добавь реальные блюда — и команда будет тренироваться на них.</div>}
        {groupByCat(vis(list)).map(g => (
          <div key={g.cat}>
            {list.length > 6 && <div style={{ fontSize: 10.5, letterSpacing: 1.5, color: gold, fontFamily: "monospace", margin: "6px 2px 8px" }}>{g.cat.toUpperCase()} · {g.items.length}</div>}
            {g.items.map(d => {
              const changed = !sameAsServer(d);
              return (
                <div key={d.id} className="sa-card" style={{ ...T.modCard, margin: "0 0 10px", flexWrap: "wrap", opacity: d.stop ? 0.85 : 1 }}>
                  <div style={{ ...T.modBar, background: d.stop ? red : changed ? gold : green }} />
                  {d.img && <img src={d.img} alt="" loading="lazy" style={{ width: 44, height: 44, objectFit: "cover", borderRadius: 10, flexShrink: 0, filter: d.stop ? "grayscale(1)" : "none" }} />}
                  <div style={{ flex: 1, minWidth: 0 }} onClick={() => setForm({ img: "", ...d, ingredients: (d.ingredients || []).join(", ") })} {...onActivate(() => setForm({ img: "", ...d, ingredients: (d.ingredients || []).join(", ") }))}>
                    <div style={T.modTitle}>{d.name}{d.stop ? <span style={{ color: red, fontSize: 11, marginLeft: 8, letterSpacing: 1 }}>В СТОПЕ</span> : null}</div>
                    <div style={T.modSub}>{(d.ingredients || []).length} ингр. · {(d.allergens || []).length ? (d.allergens || []).length + " аллерг." : "аллергенов нет"}{changed ? " · не опубликовано" : ""}</div>
                  </div>
                  <div style={{ padding: "6px 10px", cursor: "pointer", color: red, fontSize: 17 }} onClick={() => remove(d.id)} {...onActivate(() => remove(d.id))}>✕</div>
                  {/* Доп. 166: стоп · дубликат · порядок */}
                  <div style={{ flexBasis: "100%", display: "flex", gap: 6, paddingTop: 8, marginTop: 2, borderTop: `1px solid ${gold}22` }}>
                    <span onClick={() => toggleStop(d)} {...onActivate(() => toggleStop(d))} style={{ padding: "5px 10px", borderRadius: 999, fontSize: 11.5, cursor: "pointer", border: `1px solid ${d.stop ? red : gold + "55"}`, color: d.stop ? red : T.modSub.color, background: d.stop ? "rgba(224,120,120,0.12)" : "transparent" }}>{d.stop ? "Вернуть в меню" : "В стоп"}</span>
                    <span onClick={() => duplicate(d)} {...onActivate(() => duplicate(d))} style={{ padding: "5px 10px", borderRadius: 999, fontSize: 11.5, cursor: "pointer", border: `1px solid ${gold}55`, color: T.modSub.color }}>⧉ Дубликат</span>
                    <span style={{ marginLeft: "auto", display: "flex", gap: 4 }}>
                      <span onClick={() => moveIn(d, -1)} {...onActivate(() => moveIn(d, -1))} style={{ width: 30, height: 26, borderRadius: 8, border: `1px solid ${gold}55`, color: gold, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", fontSize: 13 }}>↑</span>
                      <span onClick={() => moveIn(d, 1)} {...onActivate(() => moveIn(d, 1))} style={{ width: 30, height: 26, borderRadius: 8, border: `1px solid ${gold}55`, color: gold, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", fontSize: 13 }}>↓</span>
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>
      {/* Доп. 154: серверное меню и примеры — тоже поштучно: тап — править (копия уходит в свои), ✕ — удалить */}
      {orphanShared.length > 0 && (<>
        <div style={{ ...T.secTitle }}>Меню команды на сервере ({orphanShared.length})</div>
        <div style={{ padding: "0 14px 14px" }}>
          <div style={{ color: T.modSub.color, fontSize: 12.5, padding: "0 4px 8px", lineHeight: 1.5 }}>Тап — поправить (копия появится в своих), ✕ — удалить. Изменения уйдут команде после «Опубликовать».</div>
          {vis(orphanShared).map(d => (
            <div key={d.id} className="sa-card" style={{ ...T.modCard, margin: "0 0 10px" }}>
              <div style={{ ...T.modBar, background: "#5DBB8A" }} />
              {d.img && <img src={d.img} alt="" loading="lazy" style={{ width: 44, height: 44, objectFit: "cover", borderRadius: 10, flexShrink: 0 }} />}
              <div style={{ flex: 1, minWidth: 0 }} onClick={() => editForeign(d)} {...onActivate(() => editForeign(d))}>
                <div style={T.modTitle}>{d.name}{d.stop ? <span style={{ color: red, fontSize: 11, marginLeft: 8, letterSpacing: 1 }}>В СТОПЕ</span> : null}</div>
                <div style={T.modSub}>{d.cat || "без категории"} · {(d.ingredients || []).length} ингр.</div>
              </div>
              <span onClick={() => toggleStop(d)} {...onActivate(() => toggleStop(d))} style={{ padding: "5px 9px", borderRadius: 999, fontSize: 11, cursor: "pointer", flexShrink: 0, border: `1px solid ${d.stop ? red : gold + "55"}`, color: d.stop ? red : T.modSub.color }}>{d.stop ? "Вернуть" : "В стоп"}</span>
              <div style={{ padding: "6px 10px", cursor: "pointer", color: red, fontSize: 17 }} onClick={() => deleteServer(d.id)} {...onActivate(() => deleteServer(d.id))}>✕</div>
            </div>
          ))}
        </div>
      </>)}
      {(deleted[restaurant] || []).length > 0 && (
        <div style={{ margin: "0 14px 14px", fontSize: 12.5, color: red, lineHeight: 1.5 }}>
          Помечено к удалению с сервера: {(deleted[restaurant] || []).length}. Нажми «Опубликовать команде», чтобы применить.
          <span style={{ color: gold, marginLeft: 8, cursor: "pointer" }} onClick={() => setDeleted({ ...deleted, [restaurant]: [] })}>Вернуть</span>
        </div>
      )}
      {archived.length > 0 && (<>
        <div style={{ ...T.secTitle }}>Архив ({archived.length})</div>
        <div style={{ padding: "0 14px 14px" }}>
          <div style={{ color: T.modSub.color, fontSize: 12.5, padding: "0 4px 8px", lineHeight: 1.5 }}>Убранные позиции. Официанты и Наставник их не видят. «Вернуть» — снова в меню, «Навсегда» — без возврата.</div>
          {archived.map(d => (
            <div key={d.id} className="sa-card" style={{ ...T.modCard, margin: "0 0 8px", opacity: 0.8 }}>
              <div style={{ ...T.modBar, background: T.modSub.color }} />
              {d.img && <img src={d.img} alt="" loading="lazy" style={{ width: 40, height: 40, objectFit: "cover", borderRadius: 10, flexShrink: 0, filter: "grayscale(1)" }} />}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={T.modTitle}>{d.name}</div>
                <div style={T.modSub}>{d.cat || "без раздела"}{d.archivedAt ? " · убрано " + new Date(d.archivedAt).toLocaleDateString("ru-RU", { day: "numeric", month: "short" }) : ""}</div>
              </div>
              <span onClick={() => unarchive(d.id)} {...onActivate(() => unarchive(d.id))} style={{ padding: "5px 10px", borderRadius: 999, fontSize: 11.5, cursor: "pointer", border: `1px solid ${green}88`, color: green, flexShrink: 0 }}>Вернуть</span>
              <span onClick={() => { if (window.confirm(`Удалить «${d.name}» навсегда?`)) destroy(d.id); }} {...onActivate(() => destroy(d.id))} style={{ padding: "5px 8px", fontSize: 11.5, cursor: "pointer", color: red, flexShrink: 0 }}>Навсегда</span>
            </div>
          ))}
        </div>
      </>)}
      {sampleList.length > 0 && (<>
        <div style={{ ...T.secTitle }}>Примеры-заготовки ({sampleList.length})</div>
        <div style={{ padding: "0 14px 24px" }}>
          <div style={{ color: T.modSub.color, fontSize: 12.5, padding: "0 4px 8px", lineHeight: 1.5 }}>Учебные блюда для старта. Тап — переделать под своё, ✕ — убрать с этого телефона. После публикации меню команды они скроются сами.</div>
          {vis(sampleList).map(d => (
            <div key={d.id} className="sa-card" style={{ ...T.modCard, margin: "0 0 10px", opacity: 0.85 }}>
              <div style={{ ...T.modBar, background: `${gold}66` }} />
              {d.img && <img src={d.img} alt="" loading="lazy" style={{ width: 44, height: 44, objectFit: "cover", borderRadius: 10, flexShrink: 0 }} />}
              <div style={{ flex: 1, minWidth: 0 }} onClick={() => editForeign(d)} {...onActivate(() => editForeign(d))}>
                <div style={T.modTitle}>{d.name}</div>
                <div style={T.modSub}>{d.cat || "без категории"} · {(d.ingredients || []).length} ингр.</div>
              </div>
              <div style={{ padding: "6px 10px", cursor: "pointer", color: red, fontSize: 17 }} onClick={() => hideSample(d.id)} {...onActivate(() => hideSample(d.id))}>✕</div>
            </div>
          ))}
        </div>
      </>)}
      </>)}
    </div>
  );
}
