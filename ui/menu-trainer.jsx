// ui/menu-trainer.jsx
// Этап 2 — меню-тренажёр. Три режима:
//   1) Флеш-карточки — вспомни состав и аллергены, переверни, оцени себя
//   2) Викторина — авто-вопросы по аллергенам, составу и сочетаниям
//   3) «Опиши за 60 секунд» — расскажи о блюде вслух, сравни с эталоном
// Плюс редактор блюд для менеджеров (localStorage: sa_menu_custom).

import React from "react";
import { RESTAURANT_MENUS, ALLERGENS_LIST } from "../data/menu";
import { RESTAURANTS } from "../data/roles";
import { onActivate, shuffleArray, vibrate } from "../lib/utils";
import { GAME_SVG, UI_SVG } from "./icons";
import { TimerBar } from "./widgets";

const CUSTOM_KEY = "sa_menu_custom";     // { [restaurant]: Dish[] }
const HIDE_SAMPLES_KEY = "sa_menu_hide_samples"; // { [restaurant]: true }

const loadCustom = () => { try { return JSON.parse(localStorage.getItem(CUSTOM_KEY) || "{}"); } catch (e) { return {}; } };
const saveCustom = (obj) => { try { localStorage.setItem(CUSTOM_KEY, JSON.stringify(obj)); } catch (e) {} };
const loadHide = () => { try { return JSON.parse(localStorage.getItem(HIDE_SAMPLES_KEY) || "{}"); } catch (e) { return {}; } };
const saveHide = (obj) => { try { localStorage.setItem(HIDE_SAMPLES_KEY, JSON.stringify(obj)); } catch (e) {} };

// Фирменная «стеклянная» плашка — те же токены, что у карточек уроков (обе темы)
const glass = (T) => ({
  background: T.lessGlass?.bg || "linear-gradient(155deg, #382810 0%, #281C08 100%)",
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
  const [mode, setMode] = React.useState(null); // null | "cards" | "quiz" | "60sec" | "edit"
  const [custom, setCustom] = React.useState(loadCustom);
  const [hideSamples, setHideSamples] = React.useState(loadHide);

  const dishes = React.useMemo(() => {
    if (!restaurant) return [];
    const samples = hideSamples[restaurant] ? [] : (RESTAURANT_MENUS[restaurant] || []);
    return [...(custom[restaurant] || []), ...samples];
  }, [restaurant, custom, hideSamples]);

  const Head = (title) => (
    <div style={T.lessHead}>
      <button style={T.backBtn2} onClick={() => (mode ? setMode(null) : restaurant && !RESTAURANTS.includes(profile?.restaurant) ? setRestaurant(null) : onBack())}>‹</button>
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
  if (mode === "cards") return <FlashCards T={T} gold={gold} green={green} red={red} dishes={dishes} Head={Head} restaurant={restaurant} />;
  if (mode === "quiz") return <MenuQuiz T={T} gold={gold} green={green} red={red} dishes={dishes} Head={Head} restaurant={restaurant} />;
  if (mode === "60sec") return <Describe60 T={T} gold={gold} green={green} dishes={dishes} Head={Head} restaurant={restaurant} a11y={a11y} />;
  if (mode === "edit") return (
    <MenuEditor T={T} gold={gold} red={red} textColor={textColor} a11y={a11y} Head={Head} restaurant={restaurant}
      custom={custom} setCustom={(v) => { setCustom(v); saveCustom(v); }}
      hideSamples={hideSamples} setHideSamples={(v) => { setHideSamples(v); saveHide(v); }} />
  );

  // ── Главная тренажёра ──────────────────────────────────────────────────────
  const modes = [
    { key: "cards", icon: (c) => GAME_SVG.cards(c, 20), title: "Флеш-карточки", sub: "Состав, аллергены, сочетания — вспомни и проверь себя" },
    { key: "quiz", icon: (c) => UI_SVG.quiz(c, 20), title: "Викторина по меню", sub: "Автоматические вопросы по блюдам ресторана" },
    { key: "60sec", icon: (c) => GAME_SVG.clock(c, 20), title: "Опиши за 60 секунд", sub: "Расскажи о блюде вслух, сравни с эталоном" },
  ];
  const iconBox = { width: 38, height: 38, borderRadius: 11, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", background: a11y ? "rgba(200,150,50,0.14)" : "rgba(200,169,110,0.13)", marginRight: 4 };
  return (
    <div style={T.screen} className="sa-screen">
      {Head(restaurant)}
      <div style={{ padding: "8px 18px 0", color: T.modSub.color, fontSize: 13, lineHeight: 1.5 }}>
        В базе: <b style={{ color: gold }}>{dishes.length}</b> блюд{canEdit ? " · ты можешь редактировать меню" : ""}
      </div>
      <div style={{ ...T.secTitle }}>Тренировка</div>
      <div style={{ padding: "0 14px" }}>
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
        {!dishes.length && <div style={{ textAlign: "center", padding: "20px", color: T.modSub.color, fontSize: 13 }}>Меню пустое — попроси менеджера добавить блюда в редакторе.</div>}
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
function FlashCards({ T, gold, green, red, dishes, Head, restaurant }) {
  const [deck, setDeck] = React.useState(() => shuffleArray(dishes));
  const [flipped, setFlipped] = React.useState(false);
  const [known, setKnown] = React.useState(0);
  const [repeats, setRepeats] = React.useState(0);
  const total = dishes.length;

  if (!deck.length) return (
    <div style={T.screen} className="sa-screen">
      {Head("Флеш-карточки")}
      <div style={{ textAlign: "center", padding: "60px 24px" }}>
        <div style={{ fontSize: 44, marginBottom: 12 }}>🏆</div>
        <div style={{ ...T.bold, marginBottom: 8 }}>Колода пройдена!</div>
        <div style={{ color: T.modSub.color, fontSize: 14, marginBottom: 20 }}>Знал сразу: {known} из {total}{repeats ? ` · повторов: ${repeats}` : ""}</div>
        <button className="sa-btn" style={{ ...T.doneBtn, background: gold, padding: "13px 30px" }} onClick={() => { setDeck(shuffleArray(dishes)); setKnown(0); setRepeats(0); setFlipped(false); }}>Ещё раз</button>
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
        <div className="sa-card" onClick={() => !flipped && setFlipped(true)} {...(!flipped ? onActivate(() => setFlipped(true)) : {})} style={{ ...glass(T), padding: "22px 18px", minHeight: 220, cursor: !flipped ? "pointer" : "default", overflow: "hidden" }}>
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
          <button className="sa-btn" style={{ ...T.doneBtn, background: gold, flex: 1 }} onClick={() => setFlipped(true)}>Перевернуть ↻</button>
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
  dishes.forEach(d => {
    const ing = (d.ingredients || [])[Math.floor(Math.random() * (d.ingredients || []).length)];
    if (!ing) return;
    const foreign = shuffleArray([...new Set(others(d).flatMap(x => x.ingredients || []).filter(i => !(d.ingredients || []).includes(i)))]).slice(0, 3);
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
          <div style={{ fontSize: 44, marginBottom: 12 }}>{pct >= 80 ? "🏆" : pct >= 50 ? "💪" : "📖"}</div>
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
      <div style={T.quizWrap}>
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
        <div style={{ ...glass(T), padding: "22px 18px", overflow: "hidden" }}>
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
function MenuEditor({ T, gold, red, textColor, a11y, Head, restaurant, custom, setCustom, hideSamples, setHideSamples }) {
  const empty = { name: "", cat: "", ingredients: "", allergens: [], desc: "", pairing: "", note: "", img: "" };
  const [form, setForm] = React.useState(null); // null | { ...dish, ingredients: "строка" }
  const list = custom[restaurant] || [];
  const inputSt = { width: "100%", boxSizing: "border-box", padding: "11px 13px", borderRadius: 12, border: `1px solid ${gold}88`, borderTop: `1px solid ${gold}55`, background: a11y ? "rgba(255,255,255,0.55)" : "rgba(0,0,0,0.25)", boxShadow: "0 2px 6px rgba(0,0,0,0.12) inset", color: textColor, fontSize: 15, outline: "none", marginBottom: 10 };

  const save = () => {
    if (!form.name.trim()) return;
    const dish = { ...form, id: form.id || "c" + Date.now(), name: form.name.trim(), ingredients: form.ingredients.split(",").map(s => s.trim()).filter(Boolean) };
    const next = { ...custom, [restaurant]: form.id ? list.map(d => d.id === form.id ? dish : d) : [dish, ...list] };
    setCustom(next); setForm(null); vibrate("light");
  };
  const remove = (id) => setCustom({ ...custom, [restaurant]: list.filter(d => d.id !== id) });

  if (form) {
    const toggleAl = (al) => setForm(f => ({ ...f, allergens: f.allergens.includes(al) ? f.allergens.filter(x => x !== al) : [...f.allergens, al] }));
    const onPhoto = (e) => { const file = e.target.files && e.target.files[0]; if (file) readPhoto(file, (data) => setForm(f => ({ ...f, img: data }))); e.target.value = ""; };
    return (
      <div style={T.screen} className="sa-screen">
        {Head(form.id ? "Изменить блюдо" : "Новое блюдо")}
        <div style={{ padding: "10px 16px 24px" }}>
          {form.img
            ? <div style={{ position: "relative", marginBottom: 12 }}>
                <img src={form.img} alt="" style={{ width: "100%", height: 160, objectFit: "cover", borderRadius: 14, display: "block", border: `1px solid ${gold}44` }} />
                <div onClick={() => setForm(f => ({ ...f, img: "" }))} {...onActivate(() => setForm(f => ({ ...f, img: "" })))} style={{ position: "absolute", top: 8, right: 8, width: 28, height: 28, borderRadius: 14, background: "rgba(0,0,0,0.55)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", fontSize: 14 }}>✕</div>
              </div>
            : <label style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "22px 13px", borderRadius: 14, border: `1.5px dashed ${gold}77`, color: T.para?.color, fontSize: 14, cursor: "pointer", marginBottom: 12 }}>
                {GAME_SVG.cards(gold, 18)} Добавить фото блюда
                <input type="file" accept="image/*" onChange={onPhoto} style={{ display: "none" }} />
              </label>}
          <input style={inputSt} placeholder="Название блюда *" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
          <input style={inputSt} placeholder="Категория (Стейки, Супы…)" value={form.cat} onChange={e => setForm(f => ({ ...f, cat: e.target.value }))} />
          <input style={inputSt} placeholder="Состав через запятую" value={form.ingredients} onChange={e => setForm(f => ({ ...f, ingredients: e.target.value }))} />
          <div style={{ fontSize: 11, letterSpacing: 1, color: gold, fontFamily: "monospace", margin: "2px 0 8px" }}>АЛЛЕРГЕНЫ</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
            {ALLERGENS_LIST.map(al => (
              <div key={al} onClick={() => toggleAl(al)} {...onActivate(() => toggleAl(al))}
                style={{ padding: "6px 11px", borderRadius: 10, fontSize: 12.5, cursor: "pointer", border: `1px solid ${form.allergens.includes(al) ? red : gold + "55"}`, background: form.allergens.includes(al) ? "rgba(224,120,120,0.15)" : "transparent", color: form.allergens.includes(al) ? red : T.modSub.color }}>{al}</div>
            ))}
          </div>
          <textarea style={{ ...inputSt, minHeight: 84, resize: "vertical" }} placeholder="Эталонное «вкусное описание» для гостя" value={form.desc} onChange={e => setForm(f => ({ ...f, desc: e.target.value }))} />
          <input style={inputSt} placeholder="Сочетание (вино, напитки)" value={form.pairing} onChange={e => setForm(f => ({ ...f, pairing: e.target.value }))} />
          <input style={inputSt} placeholder="Важно знать (прожарки, подача…)" value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))} />
          <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
            <button className="sa-btn" style={{ ...T.doneBtn, background: "transparent", border: `1px solid ${gold}66`, color: textColor, flex: 1 }} onClick={() => setForm(null)}>Отмена</button>
            <button className="sa-btn" style={{ ...T.doneBtn, background: gold, flex: 1, opacity: form.name.trim() ? 1 : 0.5 }} onClick={save}>Сохранить</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={T.screen} className="sa-screen">
      {Head("Редактор меню")}
      <div style={{ padding: "10px 16px 0" }}>
        <button className="sa-btn" style={{ ...T.doneBtn, background: gold, width: "100%" }} onClick={() => setForm({ ...empty })}>+ Добавить блюдо</button>
        <div onClick={() => setHideSamples({ ...hideSamples, [restaurant]: !hideSamples[restaurant] })} {...onActivate(() => setHideSamples({ ...hideSamples, [restaurant]: !hideSamples[restaurant] }))}
          className="sa-card"
          style={{ ...glass(T), margin: "12px 0 4px", padding: "11px 13px", fontSize: 13.5, color: T.para?.color, cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span>Примеры-заготовки в тренажёре</span>
          <b style={{ color: hideSamples[restaurant] ? red : "#5DBB8A" }}>{hideSamples[restaurant] ? "скрыты" : "видны"}</b>
        </div>
      </div>
      <div style={{ ...T.secTitle }}>Свои блюда ({list.length})</div>
      <div style={{ padding: "0 14px 24px" }}>
        {!list.length && <div style={{ color: T.modSub.color, fontSize: 13, padding: "6px 4px" }}>Пока пусто. Добавь реальные блюда — и команда будет тренироваться на них.</div>}
        {list.map(d => (
          <div key={d.id} className="sa-card" style={{ ...T.modCard, margin: "0 0 10px" }}>
            <div style={{ ...T.modBar, background: gold }} />
            {d.img && <img src={d.img} alt="" loading="lazy" style={{ width: 44, height: 44, objectFit: "cover", borderRadius: 10, flexShrink: 0 }} />}
            <div style={{ flex: 1, minWidth: 0 }} onClick={() => setForm({ img: "", ...d, ingredients: (d.ingredients || []).join(", ") })} {...onActivate(() => setForm({ img: "", ...d, ingredients: (d.ingredients || []).join(", ") }))}>
              <div style={T.modTitle}>{d.name}</div>
              <div style={T.modSub}>{d.cat || "без категории"} · {(d.ingredients || []).length} ингр.</div>
            </div>
            <div style={{ padding: "6px 10px", cursor: "pointer", color: red, fontSize: 17 }} onClick={() => remove(d.id)} {...onActivate(() => remove(d.id))}>✕</div>
          </div>
        ))}
      </div>
    </div>
  );
}
