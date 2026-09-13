import React from "react";
import { onActivate, vibrate, readPhoto } from "../lib/utils";
import { GOLD } from "./tokens";
import { rpc, saToken, SUPABASE_URL, SUPABASE_KEY } from "../api/supabase";
import { cocktailRecords, withCocktail, withoutCocktail, recToCocktail, cachedShared } from "../lib/deck-extras";
import { buildScenario, GLASS_RU, GARNISH_RU } from "../lib/bar-lab";
import { COCKTAILS } from "../data/cocktails";
import { CocktailArt } from "./cocktail-art";
import { frostOf } from "./home-hubs";
import { rememberSharedMenu } from "../lib/reference-context";

// ── Дополнение 240: редактор коктейлей бара ────────────────────────────────────
// Свой коктейль — полноправный: витраж, оборот, «Собрать руками» с точной последовательностью,
// «Знаю?», печати, Наставник. Хранится в меню команды записью kind:"cocktail" — видно всем сразу.

const METHODS = ["билд", "шейк", "стир", "мадл", "слои", "блендер", "свизл"];
const ICES = [["cube", "Кубики"], ["crushed", "Краш"], ["none", "Без льда"]];
const UNITS = ["мл", "дэш", "шт", "ч.л.", "листьев", "доверху"];
const PALETTE = [["#D6B266", "#A8823A"], ["#C4483A", "#7A2418"], ["#E2A63A", "#B86A1A"], ["#9BC77A", "#4F7A38"], ["#5AA7D8", "#2A5F8F"], ["#6E3E1C", "#3A2010"], ["#EFE4C8", "#C9B78E"], ["#E88AA0", "#A83A5A"], ["#8B6BB0", "#4E3670"], ["#DDE7EA", "#9FB3B8"]];
const GLASSES = Object.keys(GLASS_RU);
const GARNISHES = Object.keys(GARNISH_RU);

const empty = () => ({ id: "", name: "", base: "", glass: "rocks", method: "билд", ice: "cube", garnish: "none", color: PALETTE[0], strength: 3, sweet: 2, ing: [["", "", "мл"]], steps: [""], tip: "", story: "", pair: "", note: "", short: "", fizz: false, foam: false, inCard: true });

export function CocktailEditor({ T, a11y, profile, onBack, onOpenCard, startEditId }) {
  const gold = a11y ? "#8B6A30" : GOLD; const text = T.modTitle.color, sub = T.modSub.color, frost = frostOf(a11y);
  const restaurant = profile?.restaurant || "";
  const [shared, setShared] = React.useState(() => cachedShared(restaurant));
  const [busy, setBusy] = React.useState(false);
  const [msg, setMsg] = React.useState("");
  const [form, setForm] = React.useState(null);
  const [aiBusy, setAiBusy] = React.useState(false); const [aiVariants, setAiVariants] = React.useState(null); const [aiErr, setAiErr] = React.useState("");
  const [paste, setPaste] = React.useState(null); // Доп. 241: вставить спек текстом
  const [showArchive, setShowArchive] = React.useState(false);
  const [photoState, setPhotoState] = React.useState(""); // Доп. 242: "" | uploading | cloud | local
  const [more, setMore] = React.useState(false); // Доп. 243: гарниш, цвет, характер, история — под «Ещё»
  const photoRef = React.useRef(null);
  React.useEffect(() => { if (!restaurant) return; let alive = true; rpc("menu_get", { p_restaurant: restaurant }).then(res => { const arr = typeof res === "string" ? JSON.parse(res) : res; if (alive && Array.isArray(arr)) { setShared(arr); if (startEditId) { const r = arr.find(x => x && x.kind === "cocktail" && x.id === startEditId); if (r) setForm(toForm(r)); } } }).catch(() => {}); return () => { alive = false; }; }, [restaurant]);
  const recs = React.useMemo(() => cocktailRecords(shared).filter(r => !r.archived), [shared]);
  const archived = React.useMemo(() => cocktailRecords(shared).filter(r => r.archived), [shared]);
  const toForm = (r) => ({ ...empty(), ...r, ice: r.ice === "crushed" ? "crushed" : r.ice === "none" || r.ice === false ? "none" : "cube", ing: (r.ing && r.ing.length ? r.ing : [["", "", "мл"]]).map(i => [i[0] || "", i[1] ?? "", i[2] || "мл"]), steps: r.steps && r.steps.length ? r.steps : [""] });
  const persist = (next, okText) => {
    setBusy(true); setMsg("");
    rpc("menu_set", { p_token: saToken(), p_restaurant: restaurant, p_dishes: JSON.stringify(next) }).then(res => {
      setBusy(false);
      if (res && res.ok === true) { setShared(next); rememberSharedMenu(restaurant, next); setMsg(okText); vibrate("success"); setForm(null); }
      else { setMsg("Не сохранилось — проверь связь и права"); vibrate("error"); }
    }).catch(() => { setBusy(false); setMsg("Нет связи"); vibrate("error"); });
  };
  const save = () => {
    const rec = { ...form, id: form.id || "ck-" + Date.now(), name: String(form.name || "").trim(), ing: form.ing.filter(i => String(i[0]).trim()).map(i => [String(i[0]).trim(), i[2] === "доверху" ? 90 : (Number(String(i[1]).replace(",", ".")) || 0), i[2] || "мл"]), steps: form.steps.map(s => String(s).trim()).filter(Boolean), kind: "cocktail" };
    if (!rec.name || rec.ing.length < 1 || rec.steps.length < 1) { setMsg("Нужны название, хотя бы один ингредиент и один шаг"); vibrate("error"); return; }
    persist(withCocktail(shared, rec), `«${rec.name}» в Колоде у всех ✓`);
  };
  const patch = (id, fn, okText) => { const r = cocktailRecords(shared).find(x => x.id === id); if (!r) return; persist(withCocktail(shared, fn(r)), okText); };
  const toggleStop = (id) => patch(id, r => ({ ...r, stop: r.stop ? null : { since: Date.now() } }), "Стоп-лист обновлён у всех ✓");
  const duplicate = (id) => { const r = cocktailRecords(shared).find(x => x.id === id); if (!r) return; setForm(toForm({ ...r, id: "", name: r.name + " · вариация", stop: null })); vibrate("light"); };
  const archive = (id) => patch(id, r => ({ ...r, archived: true, stop: null }), "В архиве — вернуть можно в любой момент ✓");
  const unarchive = (id) => patch(id, r => ({ ...r, archived: false }), "Вернули в Колоду ✓");
  const remove = (id) => { const r = cocktailRecords(shared).find(x => x.id === id); if (!r || !window.confirm(`Удалить «${r.name}» навсегда? Вернуть будет нельзя.`)) return; persist(withoutCocktail(shared, id), "Удалено навсегда"); };
  // ── фото: сжать → в облако (photo-upload) → в записи ссылка; не вышло — base64 остаётся в записи
  const onPhoto = (e) => {
    const file = e.target.files && e.target.files[0]; e.target.value = ""; if (!file) return;
    readPhoto(file, (data) => {
      setForm(f => ({ ...f, img: data })); setPhotoState("uploading");
      fetch(`${SUPABASE_URL}/functions/v1/photo-upload`, { method: "POST", headers: { "Content-Type": "application/json", apikey: SUPABASE_KEY, Authorization: "Bearer " + SUPABASE_KEY }, body: JSON.stringify({ token: saToken(), restaurant, dishId: form.id || ("ck-" + Date.now()), image: data }) })
        .then(r => r.json()).then(j => { if (j && j.ok && j.url) { setForm(f => ({ ...f, img: j.url })); setPhotoState("cloud"); } else setPhotoState("local"); }).catch(() => setPhotoState("local"));
    });
  };
  // ── AI: история и фраза гостю — три варианта, как в редакторе меню
  const aiStory = () => {
    if (!form || !String(form.name || "").trim() || aiBusy) return;
    setAiBusy(true); setAiErr(""); setAiVariants(null);
    const ing = form.ing.filter(i => String(i[0]).trim()).map(i => `${i[0]}${i[1] ? " " + i[1] + " " + (i[2] || "мл") : ""}`).join(", ");
    const ask = `Напиши три разных короткие истории авторского коктейля «${form.name}» бара ресторана «${restaurant}» — каждая два-три предложения, живым языком бармена, без штампов и восклицаний. Состав: ${ing || "не указан"}. Метод: ${form.method}, бокал: ${GLASS_RU[form.glass]}. Первая — про вкус и характер, вторая — про происхождение или идею названия (если не знаешь — придумай правдоподобно и честно скажи «у нас так рассказывают»), третья — игривая, как сказать гостю у стойки. Пронумеруй 1., 2., 3. и ничего больше не добавляй.`;
    fetch(`${SUPABASE_URL}/functions/v1/ai-chat`, { method: "POST", headers: { "Content-Type": "application/json", apikey: SUPABASE_KEY, Authorization: "Bearer " + SUPABASE_KEY }, body: JSON.stringify({ token: saToken(), messages: [{ role: "user", content: ask }] }) })
      .then(r => r.json()).then(j => {
        setAiBusy(false);
        if (j && j.ok && j.reply) {
          const raw = String(j.reply).replace(/\[\[[^\]]*\]\]/g, "");
          const parts = raw.split(/\n?\s*(?:^|\n)\s*[1-3][.)]\s*/m).map(x => x.replace(/^["«»\s*]+|["«»\s*]+$/g, "").trim()).filter(x => x.length > 20).slice(0, 3);
          if (parts.length >= 1) { setAiVariants(parts); vibrate("success"); } else setAiErr("Наставник ответил невнятно — попробуй ещё раз");
        } else setAiErr("Наставник не ответил — попробуй ещё раз");
      }).catch(() => { setAiBusy(false); setAiErr("Нет связи с Наставником"); });
  };
  // ── вставка спека текстом: «Джин 40 мл», «Тоник — доверху», «Ангостура 2 дэша»
  const parsePaste = (txt) => {
    const lines = String(txt || "").split(/\n|;/).map(x => x.trim()).filter(Boolean); const ing = []; const steps = [];
    for (const ln of lines) {
      const m = ln.match(/^(.+?)[\s—–:-]+(\d+[.,]?\d*)\s*(мл|дэш|дэша|дэшей|шт|ч\.?\s?л\.?|листьев|лист)?\.?$/i) || ln.match(/^(.+?)[\s—–:-]+(доверху|до верха|топ)$/i);
      if (m) { const unit = /довер|верха|топ/i.test(m[2] || "") ? "доверху" : /дэш/i.test(m[3] || "") ? "дэш" : /шт/i.test(m[3] || "") ? "шт" : /ч/i.test(m[3] || "") ? "ч.л." : /лист/i.test(m[3] || "") ? "листьев" : "мл"; ing.push([m[1].replace(/[—–:-]+$/, "").trim(), unit === "доверху" ? "" : m[2].replace(",", "."), unit]); }
      else steps.push(ln.replace(/^\d+[.)]\s*/, ""));
    }
    return { ing, steps };
  };
  const pill = (on, extra) => ({ padding: "6px 11px", borderRadius: 999, fontSize: 12.5, cursor: "pointer", border: `1px solid ${on ? gold : gold + "44"}`, background: on ? "rgba(214,178,102,0.16)" : "transparent", color: on ? text : sub, whiteSpace: "nowrap", ...extra });
  const inputSt = { width: "100%", boxSizing: "border-box", padding: "10px 12px", borderRadius: 12, border: `1px solid ${gold}44`, background: a11y ? "rgba(255,255,255,0.6)" : "rgba(255,248,230,0.05)", color: text, fontSize: 14, fontFamily: "Georgia, serif", outline: "none" };
  const label = (t) => <div style={{ fontSize: 10.5, letterSpacing: 1.6, color: gold, fontFamily: "monospace", margin: "14px 0 6px" }}>{t}</div>;
  const Head = (title, back) => (
    <div style={{ padding: "16px 16px 6px", display: "flex", alignItems: "center", gap: 10 }}>
      <button className="sa-btn" onClick={back} {...onActivate(back)} aria-label="Назад" style={{ border: "none", background: "transparent", color: gold, fontSize: 22, cursor: "pointer", padding: "4px 8px 4px 0" }}>‹</button>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: "ui-monospace, Menlo, monospace", fontSize: 10.5, letterSpacing: 1.5, color: gold }}>КОЛОДА БАРМЕНА · {restaurant.toUpperCase()}</div>
        <div style={{ fontFamily: "Georgia, serif", fontSize: 22, color: text, lineHeight: 1.15, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{title}</div>
      </div>
    </div>
  );

  // ─────────────────────────────────────────────── ФОРМА
  if (form) {
    const preview = recToCocktail({ ...form, id: form.id || "preview", ing: form.ing.filter(i => String(i[0]).trim()).map(i => [i[0], i[2] === "доверху" ? 90 : Number(String(i[1]).replace(",", ".")) || 0, i[2]]), steps: form.steps.filter(s => String(s).trim()) });
    const seq = preview.ing.length && preview.steps.length ? buildScenario(preview, COCKTAILS).steps : [];
    const setIng = (k, j, v) => setForm(f => ({ ...f, ing: f.ing.map((row, i) => i === k ? row.map((x, jj) => jj === j ? v : x) : row) }));
    const showMore = more || !!form.id;
    return (
      <div style={T.screen} className="sa-screen">
        {Head(form.id ? "Правка коктейля" : "Новый коктейль", () => setForm(null))}
        <div style={{ padding: "4px 16px 120px" }}>
          {/* живой витраж и сборка — как увидит бармен */}
          <div style={{ ...frost, borderRadius: 18, padding: 14, display: "flex", gap: 14, alignItems: "center" }}>
            <div style={{ width: 96, flexShrink: 0 }}><CocktailArt c={preview} w={96} light={a11y} /></div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontFamily: "Georgia, serif", fontSize: 18, color: text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{form.name || "Без названия"}</div>
              <div style={{ fontSize: 12, color: sub, marginTop: 2 }}>{form.method} · {GLASS_RU[form.glass]} · {ICES.find(x => x[0] === form.ice)?.[1]}</div>
              <div style={{ fontSize: 10.5, letterSpacing: 1.4, color: gold, fontFamily: "monospace", marginTop: 8 }}>СБОРКА · {seq.length ? `${seq.length} ШАГОВ` : "ДОПИШИ СОСТАВ И ШАГИ"}</div>
              {seq.length > 0 && <div style={{ fontSize: 12, color: sub, lineHeight: 1.5, maxHeight: 74, overflow: "hidden" }}>{seq.map((s, i) => `${i + 1}. ${s.label}`).join(" · ")}</div>}
            </div>
          </div>

          {label("ФОТО · НЕОБЯЗАТЕЛЬНО")}
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <div onClick={() => photoRef.current && photoRef.current.click()} style={{ width: 96, height: 96, borderRadius: 14, border: `1px dashed ${gold}66`, background: form.img ? `url(${form.img}) center/cover` : (a11y ? "rgba(255,255,255,0.4)" : "rgba(255,248,230,0.04)"), display: "flex", alignItems: "center", justifyContent: "center", color: gold, fontSize: 22, cursor: "pointer", flexShrink: 0 }}>{form.img ? "" : "＋"}</div>
            <div style={{ flex: 1, fontSize: 12.5, color: sub, lineHeight: 1.5 }}>
              {form.img ? (photoState === "uploading" ? "Отправляю в облако…" : photoState === "cloud" ? "В облаке ✓ — увидят все" : photoState === "local" ? "Сохранено в записи (облако не ответило)" : "Фото есть") : "Фото покажется на лице карточки в Колоде; витраж останется в углу и в Сборке."}
              {form.img && <div style={{ marginTop: 6, display: "flex", gap: 10 }}><span style={{ color: gold, cursor: "pointer" }} onClick={() => photoRef.current && photoRef.current.click()}>Заменить</span><span style={{ color: "#E07878", cursor: "pointer" }} onClick={() => setForm(f => ({ ...f, img: "" }))}>Убрать</span></div>}
            </div>
            <input ref={photoRef} type="file" accept="image/*" capture="environment" onChange={onPhoto} style={{ display: "none" }} />
          </div>
          {label("НАЗВАНИЕ И БАЗА")}
          <input style={inputSt} placeholder="Название коктейля" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
          <input style={{ ...inputSt, marginTop: 8 }} placeholder="База: джин, ром, водка…" value={form.base} onChange={e => setForm(f => ({ ...f, base: e.target.value }))} />

          {label("БОКАЛ")}
          <div className="sa-hscroll" style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 6 }}>
            {GLASSES.map(g => <div key={g} onClick={() => setForm(f => ({ ...f, glass: g }))} style={{ flexShrink: 0, width: 64, textAlign: "center", cursor: "pointer", opacity: form.glass === g ? 1 : 0.55 }}>
              <div style={{ width: 56, height: 72, margin: "0 auto", borderRadius: 12, border: `1px solid ${form.glass === g ? gold : gold + "33"}`, display: "flex", alignItems: "flex-end", justifyContent: "center", overflow: "hidden" }}><CocktailArt c={{ ...preview, glass: g }} w={54} light={a11y} /></div>
              <div style={{ fontSize: 10.5, color: form.glass === g ? gold : sub, marginTop: 3 }}>{GLASS_RU[g]}</div>
            </div>)}
          </div>

          {label("МЕТОД · ЛЁД")}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>{METHODS.map(m => <span key={m} style={pill(form.method === m)} onClick={() => setForm(f => ({ ...f, method: m }))}>{m}</span>)}</div>
          <div style={{ display: "flex", gap: 6, marginTop: 8 }}>{ICES.map(([k, l]) => <span key={k} style={pill(form.ice === k)} onClick={() => setForm(f => ({ ...f, ice: k }))}>{l}</span>)}</div>

          {label("СОСТАВ · С ОБЪЁМАМИ")}
          <div style={{ display: "flex", gap: 6, marginBottom: 8, flexWrap: "wrap" }}>
            <span style={pill(!!paste)} onClick={() => setPaste(p => p == null ? "" : null)}>{paste == null ? "⌘ Вставить спек текстом" : "Скрыть"}</span>
          </div>
          {paste != null && (
            <div className="sa-fadein" style={{ ...frost, borderRadius: 14, padding: 10, marginBottom: 10 }}>
              <textarea style={{ ...inputSt, minHeight: 96 }} placeholder={"Строка — ингредиент с объёмом, остальное — шаги:\nДжин 40 мл\nБлю кюрасао 15 мл\nТоник — доверху\nХайбол со льдом\nПеремешать один оборот"} value={paste} onChange={e => setPaste(e.target.value)} />
              <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                <span style={pill(true)} onClick={() => { const r = parsePaste(paste); setForm(f => ({ ...f, ing: r.ing.length ? r.ing : f.ing, steps: r.steps.length ? r.steps : f.steps })); setPaste(null); vibrate("success"); }}>Разобрать → в форму</span>
                <span style={{ fontSize: 12, color: sub, alignSelf: "center" }}>объёмы — в состав, остальные строки — в шаги</span>
              </div>
            </div>
          )}
          {form.ing.map((row, k) => (
            <div key={k} style={{ display: "flex", gap: 6, marginBottom: 6, alignItems: "center" }}>
              <input style={{ ...inputSt, flex: 1.6 }} placeholder="Ингредиент" value={row[0]} onChange={e => setIng(k, 0, e.target.value)} />
              <input style={{ ...inputSt, width: 62, flex: "none", textAlign: "center", opacity: row[2] === "доверху" ? 0.4 : 1 }} placeholder="30" inputMode="decimal" value={row[2] === "доверху" ? "" : row[1]} disabled={row[2] === "доверху"} onChange={e => setIng(k, 1, e.target.value)} />
              <select style={{ ...inputSt, width: 92, flex: "none", padding: "10px 6px" }} value={row[2]} onChange={e => setIng(k, 2, e.target.value)}>{UNITS.map(u => <option key={u} value={u}>{u}</option>)}</select>
              <span onClick={() => setForm(f => ({ ...f, ing: f.ing.length > 1 ? f.ing.filter((_, i) => i !== k) : [["", "", "мл"]] }))} style={{ color: "#E07878", cursor: "pointer", padding: "0 4px", fontSize: 18 }}>✕</span>
            </div>
          ))}
          <span style={pill(false, { display: "inline-block", marginTop: 2 })} onClick={() => setForm(f => ({ ...f, ing: [...f.ing, ["", "", "мл"]] }))}>＋ ингредиент</span>

          {label("ШАГИ · ПО ПОРЯДКУ, ГЛАГОЛАМИ БАРА")}
          <div style={{ fontSize: 12, color: sub, marginBottom: 6, lineHeight: 1.5 }}>«Джин, вермут в смесительный стакан», «Лёд, стир 30 секунд», «Стрейн в купе», «Цедра лимона». Из шагов тренажёр строит сборку — смотри сверху, что получилось.</div>
          {form.steps.map((st, k) => (
            <div key={k} style={{ display: "flex", gap: 6, marginBottom: 6, alignItems: "center" }}>
              <span style={{ width: 20, color: gold, fontFamily: "monospace", fontSize: 12 }}>{k + 1}.</span>
              <input style={{ ...inputSt, flex: 1 }} placeholder="Шаг" value={st} onChange={e => setForm(f => ({ ...f, steps: f.steps.map((x, i) => i === k ? e.target.value : x) }))} />
              <span onClick={() => setForm(f => ({ ...f, steps: f.steps.length > 1 ? f.steps.filter((_, i) => i !== k) : [""] }))} style={{ color: "#E07878", cursor: "pointer", padding: "0 4px", fontSize: 18 }}>✕</span>
            </div>
          ))}
          <span style={pill(false, { display: "inline-block", marginTop: 2 })} onClick={() => setForm(f => ({ ...f, steps: [...f.steps, ""] }))}>＋ шаг</span>

          {!showMore && (
            <div onClick={() => { setMore(true); vibrate("light"); }} {...onActivate(() => setMore(true))} style={{ marginTop: 18, padding: "12px 14px", borderRadius: 14, border: `1px dashed ${gold}55`, color: gold, fontSize: 13.5, cursor: "pointer", display: "flex", justifyContent: "space-between" }}>
              <span>Ещё: гарниш, цвет, крепость, история, фраза гостю</span><span>▸</span>
            </div>
          )}
          {showMore && <>
          {label("ГАРНИШ · ЦВЕТ · ХАРАКТЕР")}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>{GARNISHES.map(g => <span key={g} style={pill(form.garnish === g)} onClick={() => setForm(f => ({ ...f, garnish: g }))}>{GARNISH_RU[g]}</span>)}</div>
          <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>{PALETTE.map((pal, i) => <span key={i} onClick={() => setForm(f => ({ ...f, color: pal }))} style={{ width: 30, height: 30, borderRadius: 15, background: `linear-gradient(180deg, ${pal[0]}, ${pal[1]})`, border: `2px solid ${form.color && form.color[0] === pal[0] ? gold : "transparent"}`, cursor: "pointer", boxShadow: "0 2px 6px rgba(0,0,0,.35)" }} />)}</div>
          <div style={{ display: "flex", gap: 16, marginTop: 12, fontSize: 12.5, color: sub }}>
            <label style={{ flex: 1 }}>Крепость {form.strength}/5<input type="range" min="1" max="5" value={form.strength} onChange={e => setForm(f => ({ ...f, strength: Number(e.target.value) }))} style={{ width: "100%", accentColor: gold }} /></label>
            <label style={{ flex: 1 }}>Сладость {form.sweet}/4<input type="range" min="0" max="4" value={form.sweet} onChange={e => setForm(f => ({ ...f, sweet: Number(e.target.value) }))} style={{ width: "100%", accentColor: gold }} /></label>
          </div>
          <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
            <span style={pill(form.fizz)} onClick={() => setForm(f => ({ ...f, fizz: !f.fizz }))}>газированный</span>
            <span style={pill(form.foam)} onClick={() => setForm(f => ({ ...f, foam: !f.foam }))}>с пенкой</span>
            <span style={pill(form.inCard)} onClick={() => setForm(f => ({ ...f, inCard: !f.inCard }))}>в карте бара</span>
          </div>

          {label("ДЛЯ ГОСТЯ И ДЛЯ БАРМЕНА")}
          <input style={inputSt} placeholder="Одной фразой гостю (необязательно)" value={form.short} onChange={e => setForm(f => ({ ...f, short: e.target.value }))} />
          <textarea style={{ ...inputSt, marginTop: 8, minHeight: 64 }} placeholder="История коктейля — как она звучит у стойки" value={form.story} onChange={e => setForm(f => ({ ...f, story: e.target.value }))} />
          <div style={{ display: "flex", gap: 8, marginTop: 6, alignItems: "center", flexWrap: "wrap" }}>
            <span onClick={aiStory} {...onActivate(aiStory)} style={pill(false, { opacity: String(form.name || "").trim() ? 1 : 0.5 })}>{aiBusy ? "Наставник пишет…" : "✦ История от Наставника · 3 варианта"}</span>
            {aiErr && <span style={{ fontSize: 12, color: "#E07878" }}>{aiErr}</span>}
          </div>
          {aiVariants && (
            <div className="sa-fadein" style={{ marginTop: 8 }}>
              {aiVariants.map((v, i) => (
                <div key={i} style={{ ...frost, borderRadius: 14, padding: "10px 12px", marginBottom: 6 }}>
                  <div style={{ fontSize: 10.5, letterSpacing: 1.4, color: gold, fontFamily: "monospace" }}>{["ПРО ВКУС", "ПРО ПРОИСХОЖДЕНИЕ", "ИГРИВО"][i] || "ВАРИАНТ"}</div>
                  <div style={{ fontSize: 13, color: text, lineHeight: 1.5, marginTop: 3 }}>{v}</div>
                  <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
                    <span style={pill(false)} onClick={() => { setForm(f => ({ ...f, story: v })); setAiVariants(null); vibrate("light"); }}>→ в историю</span>
                    <span style={pill(false)} onClick={() => { setForm(f => ({ ...f, short: v.split(/(?<=[.!?])\s/)[0] })); setAiVariants(null); vibrate("light"); }}>→ фразой гостю</span>
                  </div>
                </div>
              ))}
            </div>
          )}
          <input style={{ ...inputSt, marginTop: 8 }} placeholder="Совет бармену (сноска на обороте)" value={form.tip} onChange={e => setForm(f => ({ ...f, tip: e.target.value }))} />
          <input style={{ ...inputSt, marginTop: 8 }} placeholder="К столу: с чем подавать" value={form.pair} onChange={e => setForm(f => ({ ...f, pair: e.target.value }))} />
          <input style={{ ...inputSt, marginTop: 8 }} placeholder="Сноска: как наливаем у нас vs канон" value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))} />
          </>}
          {msg && <div style={{ fontSize: 12.5, color: /✓/.test(msg) ? "#5DBB8A" : "#E07878", marginTop: 10 }}>{msg}</div>}
        </div>
        <div style={{ position: "fixed", left: 0, right: 0, bottom: "calc(64px + env(safe-area-inset-bottom, 0px))", padding: "10px 16px", background: a11y ? "rgba(250,242,222,0.96)" : "rgba(24,19,9,0.96)", borderTop: `1px solid ${gold}33`, display: "flex", gap: 10, zIndex: 20 }}>
          <button className="sa-btn" onClick={() => setForm(null)} style={{ ...T.doneBtn, flex: 1, background: "transparent", border: `1px solid ${gold}66`, color: text }}>Отмена</button>
          <button className="sa-btn" onClick={save} disabled={busy} style={{ ...T.doneBtn, flex: 1.6, background: gold, opacity: busy ? 0.55 : 1 }}>{busy ? "Сохраняю…" : form.id ? "Сохранить — увидят все" : "Добавить в Колоду"}</button>
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────── СПИСОК
  return (
    <div style={T.screen} className="sa-screen">
      {Head("Свои коктейли", onBack)}
      <div style={{ padding: "4px 16px 100px" }}>
        <div style={{ ...frost, borderRadius: 18, padding: "14px 15px", marginBottom: 12 }}>
          <div style={{ fontSize: 13.5, color: T.para?.color || text, lineHeight: 1.55 }}>Свой коктейль получает всё, что классика: витраж, оборот, «Собрать руками» с точной последовательностью, «Знаю?», печати и Наставника. Сохраняется в меню команды — бармены видят сразу.</div>
          <button className="sa-btn" onClick={() => { setForm(empty()); vibrate("light"); }} style={{ ...T.doneBtn, background: gold, width: "100%", marginTop: 12 }}>＋ Новый коктейль</button>
          {msg && <div style={{ fontSize: 12.5, color: /✓/.test(msg) ? "#5DBB8A" : "#E07878", marginTop: 8 }}>{msg}</div>}
        </div>
        {recs.length === 0 && <div style={{ textAlign: "center", color: sub, fontSize: 13, padding: "20px 0" }}>Пока пусто — первый авторский коктейль будет здесь.</div>}
        {recs.map(r => { const c = recToCocktail(r); const seq = c.ing.length && c.steps.length ? buildScenario(c, COCKTAILS).steps.length : 0; return (
          <div key={r.id} className="sa-card" style={{ ...frost, borderRadius: 16, padding: "10px 12px", marginBottom: 8, display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 52, flexShrink: 0 }} onClick={() => onOpenCard && onOpenCard(r.id)}><CocktailArt c={c} w={52} light={a11y} /></div>
            <div style={{ flex: 1, minWidth: 0 }} onClick={() => setForm(toForm(r))} {...onActivate(() => setForm(toForm(r)))}>
              <div style={{ fontFamily: "Georgia, serif", fontSize: 16, color: text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.name}</div>
              <div style={{ fontSize: 12, color: r.stop ? "#E07878" : sub }}>{r.stop ? "В стопе · " : ""}{c.method} · {GLASS_RU[c.glass]} · {c.ing.length} ингр. · сборка {seq} шагов{r.inCard === false ? " · не в карте" : ""}</div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 4, alignItems: "flex-end", flexShrink: 0 }}>
              <span onClick={() => toggleStop(r.id)} style={pill(!!r.stop, { padding: "4px 9px", fontSize: 11, color: r.stop ? "#E07878" : sub, borderColor: r.stop ? "#E0787866" : gold + "33" })}>{r.stop ? "В стопе" : "В стоп"}</span>
              <div style={{ display: "flex", gap: 8, fontSize: 11.5 }}>
                <span onClick={() => duplicate(r.id)} style={{ color: gold, cursor: "pointer" }}>⧉</span>
                <span onClick={() => archive(r.id)} style={{ color: sub, cursor: "pointer" }}>в архив</span>
              </div>
            </div>
          </div>); })}
        {archived.length > 0 && (
          <div style={{ marginTop: 16 }}>
            <div onClick={() => setShowArchive(v => !v)} {...onActivate(() => setShowArchive(v => !v))} style={{ fontSize: 10.5, letterSpacing: 1.6, color: gold, fontFamily: "monospace", cursor: "pointer", marginBottom: 8 }}>АРХИВ · {archived.length} {showArchive ? "▾" : "▸"}</div>
            {showArchive && archived.map(r => (
              <div key={r.id} style={{ ...frost, borderRadius: 14, padding: "10px 12px", marginBottom: 8, display: "flex", alignItems: "center", gap: 10, opacity: 0.8 }}>
                <div style={{ flex: 1, minWidth: 0, fontFamily: "Georgia, serif", fontSize: 15, color: text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.name}</div>
                <span style={pill(false, { fontSize: 11.5 })} onClick={() => unarchive(r.id)}>Вернуть</span>
                <span onClick={() => remove(r.id)} style={{ color: "#E07878", cursor: "pointer", fontSize: 11.5 }}>навсегда</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
