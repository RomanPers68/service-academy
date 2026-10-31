// ui/wine-editor.jsx — v120 (Доп. 433): «Редактор вин» — умный, как редактор коктейлей.
//
// Владелец (31.10): «Сделаем такой же умный редактор, чтобы не только AI добавлял, а ещё и человек ручками всё это мог
// добавить». Каждое поле заполняется руками. AI помогает четырьмя путями (api/wine-import.js): «Заполнить по названию»
// в форме; «Импорт»: фото страницы карты (по странице за раз, можно несколько снимков), PDF, список названий текстом
// (по 15 за запрос). Что дописал AI, помечено «AI» и ждёт проверки: «Всё верно» в форме или «Верно» в списке (одно
// касание). Поле, исправленное руками, — проверено. Сохраняется в меню команды (menu_set), команда видит сразу.
import React from "react";
import { GOLD, labelStyle } from "./tokens";
import { onActivate, vibrate } from "../lib/utils";
import { rpc, saToken } from "../api/supabase";
import { rememberSharedMenu, dishesOf } from "../lib/reference-context";
import { useTeamMenu, winesWord } from "./wine-list";
import { WINE_COLORS, COLOR_GROUP, sweetsOf, GLASS_TYPES, TEMP_HINT, AI_FIELDS, FIELD_RU, wineRecords, withWine, withWines, withoutWine, normWine, mergeAi,
  touched, confirmWine, unchecked, wineTitle, wineLine, winePrice, groupByColor, findWines, sameWine, splitNames } from "../lib/wine";

const SERIF = "Georgia, 'Times New Roman', serif";
const BATCH = 15;   // названий за один запрос AI
const blank = () => ({ id: "", name: "", producer: "", country: "", region: "", grapes: "", color: "", sweet: "", vintage: "", abv: "", byGlass: false,
  priceGlass: "", priceBottle: "", volume: "", temp: "", glass: "", notes: "", short: "", story: "", pair: [], pairNote: "", stop: null, archived: false, ai: [] });
const shown = (v) => (Array.isArray(v) ? v.join(", ") : v == null ? "" : String(v));

// страница карты снимком: до 1800 px по длинной стороне, JPEG — текст на листе читается, запрос не тяжелее пары МБ
function shrink(file) {
  return new Promise((ok, bad) => {
    try {
      const url = URL.createObjectURL(file), img = new Image();
      img.onload = () => {
        const k = Math.min(1, 1800 / Math.max(img.width, img.height)), c = document.createElement("canvas");
        c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
        c.getContext("2d").drawImage(img, 0, 0, c.width, c.height); URL.revokeObjectURL(url);
        let data = c.toDataURL("image/jpeg", 0.8); if (data.length > 3500000) data = c.toDataURL("image/jpeg", 0.62);
        ok(data.split(",")[1]);
      };
      img.onerror = () => { URL.revokeObjectURL(url); bad(new Error("Не получилось открыть снимок")); };
      img.src = url;
    } catch (e) { bad(e); }
  });
}
const fileB64 = (file) => new Promise((ok, bad) => { const fr = new FileReader(); fr.onload = () => ok(String(fr.result).split(",")[1]); fr.onerror = () => bad(new Error("Файл не прочитался")); fr.readAsDataURL(file); });
// AI: ответ — массив вин; ошибка — понятным текстом
const askAi = (body) => fetch("/api/wine-import", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...body, token: saToken() }) })
  .catch(() => { throw new Error("Сеть недоступна или функция /api/wine-import не развёрнута."); })
  .then((r) => r.json().catch(() => ({})).then((j) => { if (!r.ok || !Array.isArray(j.wines)) throw new Error((j && j.error) || "Не получилось, попробуй ещё раз"); return j.wines; }));

export function WineEditor({ T, a11y, profile, onBack, startEditId }) {
  const gold = a11y ? "#7A5D2A" : GOLD, text = T.modTitle.color, sub = T.modSub.color;
  const red = a11y ? "#A33A2A" : "#E07878", amber = a11y ? "#8A5A12" : "#E4B36A";
  const restaurant = (profile && profile.restaurant) || "";
  const who = profile ? [profile.name, profile.surname].filter(Boolean).join(" ") : "";
  const [shared, setShared] = useTeamMenu(restaurant);
  const [busy, setBusy] = React.useState(false);
  const [msg, setMsg] = React.useState("");
  const [form, setForm] = React.useState(null);
  const [sure, setSure] = React.useState(false);        // «Удалить?» — второе касание
  const [aiBusy, setAiBusy] = React.useState(false);
  const [aiErr, setAiErr] = React.useState("");
  const [imp, setImp] = React.useState(null);           // импорт: { stage: pick | text | names | work | review, … }
  const [q, setQ] = React.useState("");
  const [only, setOnly] = React.useState("all");        // all | unchecked | glass | stop | archive
  const photoRef = React.useRef(null), pdfRef = React.useRef(null), started = React.useRef(false);
  const wines = React.useMemo(() => wineRecords(shared), [shared]);
  const live = wines.filter((w) => !w.archived);
  const dishes = React.useMemo(() => { try { return (dishesOf(restaurant) || []).filter((d) => d && d.id && d.name); } catch (e) { return []; } }, [restaurant, shared]);
  React.useEffect(() => {   // «Править» из карточки вина — сразу форма
    if (started.current || !startEditId) return;
    const r = wines.find((x) => x.id === startEditId);
    if (r) { started.current = true; setForm({ ...blank(), ...r }); }
  }, [wines, startEditId]);

  const persist = (next, okText, after) => {
    setBusy(true); setMsg("");
    rpc("menu_set", { p_token: saToken(), p_restaurant: restaurant, p_dishes: JSON.stringify(next) }).then((res) => {
      setBusy(false);
      if (res && res.ok === true) { setShared(next); rememberSharedMenu(restaurant, next); setMsg(okText); vibrate("success"); if (after) after(); }
      else { setMsg("Не сохранилось. Проверь связь и права"); vibrate("error"); }
    }).catch(() => { setBusy(false); setMsg("Нет связи"); vibrate("error"); });
  };

  // ── стили (метки линзы — как у редактора коктейлей) ──
  const inputSt = { width: "100%", boxSizing: "border-box", padding: "10px 12px", borderRadius: 12, border: `1px solid ${gold}44`, background: a11y ? "rgba(255,255,255,0.6)" : "rgba(255,248,230,0.05)", color: text, fontSize: 14, fontFamily: SERIF, outline: "none" };
  const pill = (on, extra) => ({ padding: "6px 11px", borderRadius: 999, fontSize: 13, fontFamily: SERIF, cursor: "pointer", border: `1px solid ${on ? gold : gold + "44"}`, background: on ? (a11y ? "rgba(139,106,48,0.14)" : "rgba(214,178,102,0.16)") : "transparent", color: on ? text : sub, whiteSpace: "nowrap", ...extra });
  const mainBtn = { ...T.doneBtn, margin: 0, background: gold, color: "#1A1008", border: "none" };
  const softBtn = { ...T.doneBtn, margin: 0, background: "transparent", color: text, border: `1px solid ${gold}77` };
  const card = { ...T.modCard, display: "block", cursor: "default", padding: "12px 14px" };
  const Head = (title, back) => (
    <div style={{ padding: "16px 16px 6px", display: "flex", alignItems: "center", gap: 10 }}>
      <button className="sa-btn" data-lens="back" onClick={back} {...onActivate(back)} aria-label="Назад" style={{ border: "none", background: "transparent", color: gold, fontSize: 21, cursor: "pointer", padding: "4px 8px 4px 0" }}>‹</button>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ ...labelStyle(13.5), color: gold }}>Винная карта · {restaurant}</div>
        <div style={{ fontFamily: SERIF, fontSize: 21, color: text, lineHeight: 1.15, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{title}</div>
      </div>
    </div>
  );
  const aiTag = <span data-wine-ai="" style={{ marginLeft: 6, fontSize: 11, fontStyle: "normal", padding: "0 6px", borderRadius: 999, border: `1px solid ${amber}99`, color: amber }}>AI</span>;
  const note = msg ? <div role="status" style={{ fontSize: 13, color: /Не |Нет /.test(msg) ? red : gold, margin: "8px 2px 0", lineHeight: 1.45 }}>{msg}</div> : null;

  // ─────────────────────────────── ФОРМА ВИНА
  if (form) {
    const set = (f, v) => setForm((x) => touched({ ...x, [f]: v }, f));
    const has = (f) => (form.ai || []).includes(f);
    const label = (t, f) => <div style={{ ...labelStyle(13.5), color: gold, margin: "14px 0 6px" }}>{t}{f && (Array.isArray(f) ? f.some(has) : has(f)) ? aiTag : null}</div>;
    const field = (f, ph, extra = {}) => <input data-lens-field="" data-wine-field={f} style={{ ...inputSt, ...extra }} placeholder={ph} value={shown(form[f])} onChange={(e) => set(f, e.target.value)} />;
    const fill = () => {
      const name = String(form.name || "").trim();
      if (!name) { setAiErr("Сначала название"); return; }
      setAiBusy(true); setAiErr(""); vibrate("light");
      askAi({ mode: "fill", name }).then((got) => { setAiBusy(false); setForm((x) => mergeAi(x, got[0] || {})); vibrate("success"); })
        .catch((e) => { setAiBusy(false); setAiErr(e.message); });
    };
    const save = (confirm) => {
      const rec = normWine(confirm ? confirmWine(form, who) : form, { id: form.id || undefined });
      if (!rec.name) { setMsg("Нужно название"); vibrate("error"); return; }
      persist(withWine(shared, rec), "«" + rec.name + "» в карте у всех", () => { setForm(null); setSure(false); });
    };
    const isNew = !form.id;
    const pairs = new Set(form.pair || []);
    const dishOrder = [...dishes.filter((d) => pairs.has(d.id)), ...dishes.filter((d) => !pairs.has(d.id))];
    return (
      <div style={T.screen} className="sa-screen" data-wine-form={form.id || "new"}>
        {Head(isNew ? "Новое вино" : "Правка вина", () => { setForm(null); setSure(false); setAiErr(""); })}
        <div style={{ padding: "4px 16px 220px" }}>
          {label("Название, как в карте")}
          <input data-lens-field="" data-wine-field="name" style={inputSt} placeholder="Например: Шабли Премьер Крю, Domaine Laroche" value={form.name} onChange={(e) => set("name", e.target.value)} />
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 8, flexWrap: "wrap" }}>
            <button type="button" className="sa-btn" data-lens-btn="soft" data-lens-ink="" data-wine-fill="" onClick={fill} disabled={aiBusy}
              style={{ ...pill(false), color: gold, opacity: aiBusy ? 0.6 : 1 }}>{aiBusy ? "AI думает…" : "Заполнить по названию"}</button>
            <span style={{ fontSize: 12.5, color: sub, lineHeight: 1.4, flex: "1 1 160px" }}>AI заполнит только пустые поля, вписанное руками не тронет</span>
          </div>
          {aiErr ? <div role="alert" style={{ fontSize: 13, color: red, marginTop: 6, lineHeight: 1.45 }}>{aiErr}</div> : null}
          {unchecked(form) ? (
            <div data-lens-card="warn" data-wine-check="" style={{ ...card, marginTop: 12, borderColor: amber }}>
              <div style={{ fontSize: 13.5, color: text, lineHeight: 1.5 }}>AI дописал: {form.ai.map((f) => FIELD_RU[f] || f).join(", ")}. Проверь: где не так, исправь руками, остальное подтверди.</div>
              <button type="button" className="sa-btn" data-lens-btn="soft" data-wine-confirm="" onClick={() => { setForm((x) => confirmWine(x, who)); vibrate("light"); }} style={{ ...pill(false), marginTop: 8, color: text }}>Всё верно</button>
            </div>) : null}
          {label("Производитель", "producer")}{field("producer", "Хозяйство или дом")}
          {label("Страна и регион", ["country", "region"])}
          <div style={{ display: "flex", gap: 8 }}>{field("country", "Страна", { flex: 1 })}{field("region", "Регион", { flex: 1.4 })}</div>
          {label("Сорт винограда", "grapes")}{field("grapes", "Через запятую: шардоне, пино нуар")}
          {label("Цвет", "color")}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>{WINE_COLORS.map(([k, t]) => <button type="button" key={k} data-wine-color={k} aria-pressed={form.color === k} data-lens-btn={form.color === k ? "tab" : "soft"} data-lens-ink="" onClick={() => set("color", form.color === k ? "" : k)} style={pill(form.color === k)}>{t}</button>)}</div>
          {label("Сладость", "sweet")}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>{sweetsOf(form.color).map((t) => <button type="button" key={t} aria-pressed={form.sweet === t} data-lens-btn={form.sweet === t ? "tab" : "soft"} data-lens-ink="" onClick={() => set("sweet", form.sweet === t ? "" : t)} style={pill(form.sweet === t)}>{t}</button>)}</div>
          {label("Год и крепость", ["vintage", "abv"])}
          <div style={{ display: "flex", gap: 8 }}>{field("vintage", "Год урожая", { flex: 1 })}{field("abv", "Крепость, %", { flex: 1 })}</div>
          {label("Подача и цена", ["byGlass", "priceGlass", "priceBottle", "volume"])}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
            <button type="button" data-wine-glass="" aria-pressed={!!form.byGlass} data-lens-btn={form.byGlass ? "tab" : "soft"} data-lens-ink="" onClick={() => set("byGlass", !form.byGlass)} style={pill(!!form.byGlass)}>Бокалом</button>
            <button type="button" data-wine-stop="" aria-pressed={!!form.stop} data-lens-btn={form.stop ? "danger" : "soft"} onClick={() => setForm((x) => ({ ...x, stop: x.stop ? null : { since: Date.now(), by: who } }))}
              style={pill(!!form.stop, form.stop ? { color: red, borderColor: red } : {})}>Сегодня нет</button>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            {form.byGlass ? field("priceGlass", "Бокал, ₽", { flex: 1 }) : null}{field("priceBottle", "Бутылка, ₽", { flex: 1 })}{field("volume", "Объём", { flex: 0.8 })}
          </div>
          {label("Температура и бокал", ["temp", "glass"])}
          {field("temp", "Например: " + (TEMP_HINT[form.color] || "8–10 °C"))}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>{GLASS_TYPES.map((g) => <button type="button" key={g} aria-pressed={form.glass === g} data-lens-btn={form.glass === g ? "tab" : "soft"} data-lens-ink="" onClick={() => set("glass", form.glass === g ? "" : g)} style={pill(form.glass === g)}>{g}</button>)}</div>
          {label("Ноты вкуса и аромата", "notes")}{field("notes", "Через запятую: зелёное яблоко, мел, цитрус")}
          {label("Одной фразой гостю", "short")}{field("short", "Как официант скажет за столом")}
          {label("О вине", "story")}
          <textarea data-lens-field="" data-wine-field="story" rows={3} style={{ ...inputSt, minHeight: 82, resize: "vertical" }} placeholder="Стиль, чем интересно, как рассказать гостю" value={shown(form.story)} onChange={(e) => set("story", e.target.value)} />
          {label("К блюдам")}
          {dishes.length ? <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>{dishOrder.slice(0, 40).map((d) => {
            const on = pairs.has(d.id);
            return <button type="button" key={d.id} aria-pressed={on} data-lens-btn={on ? "tab" : "soft"} data-lens-ink="" onClick={() => setForm((x) => ({ ...x, pair: on ? (x.pair || []).filter((i) => i !== d.id) : [...(x.pair || []), d.id] }))} style={pill(on)}>{d.name}</button>; })}</div>
            : <div style={{ fontSize: 13, color: sub }}>Блюда появятся, когда в меню команды будут свои блюда.</div>}
          <input data-lens-field="" style={{ ...inputSt, marginTop: 8 }} placeholder="Пояснение: почему к ним, что ещё предложить" value={shown(form.pairNote)} onChange={(e) => set("pairNote", e.target.value)} />
          {!isNew ? (
            <div style={{ display: "flex", gap: 8, marginTop: 18, flexWrap: "wrap" }}>
              <button type="button" className="sa-btn" data-lens-btn="soft" onClick={() => persist(withWine(shared, normWine({ ...form, archived: !form.archived })), form.archived ? "Вернули в карту" : "Убрали в архив", () => setForm(null))} style={pill(false, { color: text })}>{form.archived ? "Вернуть в карту" : "В архив"}</button>
              <button type="button" className="sa-btn" data-lens-btn="danger" data-wine-del="" onClick={() => { if (!sure) { setSure(true); vibrate("light"); return; } persist(withoutWine(shared, form.id), "Удалено", () => { setForm(null); setSure(false); }); }}
                style={pill(false, { color: red, borderColor: red + "88" })}>{sure ? "Удалить насовсем?" : "Удалить"}</button>
            </div>) : null}
          {note}
        </div>
        <div style={{ position: "fixed", left: 0, right: 0, bottom: 0, zIndex: 30, padding: "12px 16px calc(14px + env(safe-area-inset-bottom, 0px))", display: "flex", gap: 10, background: a11y ? "rgba(245,238,222,0.96)" : "rgba(21,17,11,0.94)", borderTop: `1px solid ${gold}33` }}>
          <button type="button" className="sa-btn" data-lens-btn="soft" onClick={() => { setForm(null); setSure(false); }} style={{ ...softBtn, flex: 1 }}>Отмена</button>
          <button type="button" className="sa-btn" data-lens-btn="main" data-wine-save="" onClick={() => save(false)} disabled={busy} style={{ ...mainBtn, flex: 1.6, opacity: busy ? 0.6 : 1 }}>{busy ? "Сохраняю…" : "Сохранить"}</button>
        </div>
      </div>
    );
  }

  // ─────────────────────────────── ИМПОРТ
  const addFound = (found, failed = 0) => setImp({ stage: "review", failed, found: found.map((w) => ({ w, dup: live.some((x) => sameWine(x, w)) })).map((x) => ({ ...x, keep: !x.dup })) });
  const fromAi = (raw, name) => normWine({ ...raw, name: name || raw.name }, { ai: AI_FIELDS });
  const runNames = (names, withAi) => {
    if (!withAi) { addFound(names.map((n) => normWine({ name: n }))); return; }
    const found = []; let failed = 0, i = 0;
    const step = () => {
      if (i >= names.length) { addFound(found, failed); return; }
      const part = names.slice(i, i + BATCH);
      setImp({ stage: "work", label: "AI дополняет", done: i, total: names.length });
      askAi({ mode: "names", names: part }).then((got) => { part.forEach((n, j) => found.push(got[j] ? fromAi(got[j], n) : normWine({ name: n }))); })
        .catch(() => { failed += part.length; part.forEach((n) => found.push(normWine({ name: n }))); })
        .then(() => { i += BATCH; step(); });
    };
    step();
  };
  const runSheets = (files, kind) => {
    const found = []; let k = 0, err = "";
    const step = () => {
      if (k >= files.length) { if (!found.length) { setImp({ stage: "pick", err: err || "На листе не нашлось ни одного вина" }); return; } addFound(found); return; }
      setImp({ stage: "work", label: kind === "pdf" ? "Читаю PDF" : files.length > 1 ? "Читаю страницу " + (k + 1) + " из " + files.length : "Читаю страницу", done: k, total: files.length });
      const f = files[k];
      (kind === "pdf" ? fileB64(f).then((b) => askAi({ mode: "pdf", pdfBase64: b })) : shrink(f).then((b) => askAi({ mode: "photo", imageBase64: b, mime: "image/jpeg" })))
        .then((got) => { got.forEach((w) => found.push(fromAi(w))); }).catch((e) => { err = e.message; })
        .then(() => { k++; step(); });
    };
    step();
  };
  const impPanel = imp ? (
    <div data-lens-card="" data-wine-import={imp.stage} style={{ ...card, margin: "10px 0 6px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ ...labelStyle(13.5), color: gold, flex: 1 }}>Импорт</span>
        {imp.stage !== "work" ? <button type="button" className="sa-btn" data-lens="disc" data-lens-x="" aria-label="Закрыть импорт" onClick={() => setImp(null)} style={{ border: 0, background: "none", color: sub, fontSize: 20, cursor: "pointer", width: 32, height: 32, lineHeight: 1 }}>×</button> : null}
      </div>
      {imp.stage === "pick" ? <>
        <div style={{ fontSize: 13, color: sub, lineHeight: 1.5, margin: "4px 0 10px" }}>AI прочитает и заполнит, ты проверишь список и добавишь. Что он допишет сам, будет помечено «AI».</div>
        <div style={{ display: "grid", gap: 8 }}>
          <button type="button" className="sa-btn" data-lens-btn="soft" data-wine-imp="photo" onClick={() => photoRef.current && photoRef.current.click()} style={{ ...softBtn, textAlign: "left", padding: "12px 14px", fontWeight: "normal" }}><b>Фото страницы</b><br /><span style={{ fontSize: 12.5, color: sub }}>Сними страницу карты, можно несколько снимков сразу</span></button>
          <button type="button" className="sa-btn" data-lens-btn="soft" data-wine-imp="text" onClick={() => setImp({ stage: "text", text: "" })} style={{ ...softBtn, textAlign: "left", padding: "12px 14px", fontWeight: "normal" }}><b>Списком</b><br /><span style={{ fontSize: 12.5, color: sub }}>Вставь названия столбиком: из кассы, Word, переписки</span></button>
          <button type="button" className="sa-btn" data-lens-btn="soft" data-wine-imp="pdf" onClick={() => pdfRef.current && pdfRef.current.click()} style={{ ...softBtn, textAlign: "left", padding: "12px 14px", fontWeight: "normal" }}><b>PDF</b><br /><span style={{ fontSize: 12.5, color: sub }}>Если карта есть файлом</span></button>
        </div>
        {imp.err ? <div role="alert" style={{ fontSize: 13, color: red, marginTop: 8, lineHeight: 1.45 }}>{imp.err}</div> : null}
      </> : null}
      {imp.stage === "text" ? <>
        <textarea data-lens-field="" data-wine-paste="" rows={7} value={imp.text} onChange={(e) => setImp({ ...imp, text: e.target.value })} placeholder={"По одному вину в строке:\nШабли, Domaine Laroche 2021\nКьянти Классико, Castello di Ama\nПросекко DOC Brut"} style={{ ...inputSt, marginTop: 8, minHeight: 150 }} />
        <button type="button" className="sa-btn" data-lens-btn="main" data-wine-parse="" onClick={() => { const names = splitNames(imp.text); if (!names.length) { setImp({ ...imp, err: "Не нашлось ни одного названия" }); return; } setImp({ stage: "names", names }); vibrate("light"); }} style={{ ...mainBtn, width: "100%", marginTop: 10, padding: "12px" }}>Разобрать</button>
        {imp.err ? <div role="alert" style={{ fontSize: 13, color: red, marginTop: 8 }}>{imp.err}</div> : null}
      </> : null}
      {imp.stage === "names" ? <>
        <div style={{ fontSize: 14, color: text, margin: "6px 0 8px" }} data-wine-names={imp.names.length}>Нашлось {winesWord(imp.names.length)}. AI допишет сорт, регион, стиль, ноты и подачу, ты проверишь.</div>
        <div style={{ maxHeight: 150, overflowY: "auto", fontSize: 13, color: sub, lineHeight: 1.6, marginBottom: 10 }}>{imp.names.map((n, i) => <div key={i}>{i + 1}. {n}</div>)}</div>
        <div style={{ display: "flex", gap: 8 }}>
          <button type="button" className="sa-btn" data-lens-btn="soft" data-wine-bare="" onClick={() => runNames(imp.names, false)} style={{ ...softBtn, flex: "1 1 auto", padding: "11px 10px", fontSize: 13.5, whiteSpace: "nowrap" }}>Только названия</button>
          <button type="button" className="sa-btn" data-lens-btn="main" data-wine-ai-go="" onClick={() => runNames(imp.names, true)} style={{ ...mainBtn, flex: "1 1 auto", padding: "11px 10px", fontSize: 13.5, whiteSpace: "nowrap" }}>Дополнить через AI</button>
        </div>
      </> : null}
      {imp.stage === "work" ? (
        <div role="status" style={{ padding: "8px 0 2px" }}>
          <div style={{ fontSize: 14, color: text }}>{imp.label}{imp.total > 1 ? ": " + Math.min(imp.done + BATCH, imp.total) + " из " + imp.total : "…"}</div>
          <div style={{ height: 4, borderRadius: 2, background: gold + "26", marginTop: 8, overflow: "hidden" }}><div style={{ height: "100%", width: Math.round((imp.done / Math.max(1, imp.total)) * 100) + "%", background: gold, transition: "width .3s" }} /></div>
        </div>) : null}
      {imp.stage === "review" ? (() => {
        const keepN = imp.found.filter((x) => x.keep).length;
        const toggle = (i) => setImp({ ...imp, found: imp.found.map((x, j) => (j === i ? { ...x, keep: !x.keep } : x)) });
        return <>
          <div style={{ fontSize: 13.5, color: text, margin: "6px 0 8px", lineHeight: 1.5 }} data-wine-found={imp.found.length}>
            Нашлось {winesWord(imp.found.length)}{imp.found.some((x) => x.dup) ? ", уже в карте: " + imp.found.filter((x) => x.dup).length : ""}. Сними отметку с лишних.
            {imp.failed ? " Для " + winesWord(imp.failed) + " AI не ответил: они добавятся только с названием." : ""}</div>
          <div style={{ maxHeight: 320, overflowY: "auto" }}>
            {imp.found.map((x, i) => (
              <label key={i} data-wine-found-row={i} style={{ display: "flex", gap: 10, alignItems: "flex-start", padding: "8px 2px", borderTop: i ? `1px solid ${gold}22` : "none", cursor: "pointer" }}>
                <input type="checkbox" checked={x.keep} onChange={() => toggle(i)} style={{ marginTop: 3, accentColor: gold, width: 18, height: 18 }} />
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: "block", fontFamily: SERIF, fontSize: 14.5, color: text }}>{wineTitle(x.w)}{x.dup ? <span style={{ fontSize: 12, color: sub }}> · уже в карте</span> : null}</span>
                  {wineLine(x.w) || winePrice(x.w) ? <span style={{ display: "block", fontSize: 12.5, color: sub, lineHeight: 1.4 }}>{[wineLine(x.w), winePrice(x.w)].filter(Boolean).join(" · ")}</span> : null}
                </span>
              </label>))}
          </div>
          <button type="button" className="sa-btn" data-lens-btn="main" data-wine-add="" disabled={!keepN || busy} onClick={() => persist(withWines(shared, imp.found.filter((x) => x.keep).map((x) => x.w)), "Добавлено: " + winesWord(keepN), () => setImp(null))}
            style={{ ...mainBtn, width: "100%", marginTop: 10, padding: "12px", opacity: !keepN || busy ? 0.55 : 1 }}>{busy ? "Сохраняю…" : keepN ? "Добавить " + winesWord(keepN) : "Ничего не отмечено"}</button>
        </>;
      })() : null}
      <input ref={photoRef} type="file" accept="image/*" multiple onChange={(e) => { const fs = [...(e.target.files || [])]; e.target.value = ""; if (fs.length) runSheets(fs, "photo"); }} style={{ display: "none" }} />
      <input ref={pdfRef} type="file" accept="application/pdf" onChange={(e) => { const f = e.target.files && e.target.files[0]; e.target.value = ""; if (f) runSheets([f], "pdf"); }} style={{ display: "none" }} />
    </div>) : null;

  // ─────────────────────────────── СПИСОК
  const pool = only === "archive" ? wines.filter((w) => w.archived) : live;
  const list = findWines(pool, q).filter((w) => (only === "unchecked" ? unchecked(w) : only === "glass" ? w.byGlass : only === "stop" ? !!w.stop : true));
  const uncheckedN = live.filter(unchecked).length, archN = wines.length - live.length;
  const quick = (w, patch, okText) => persist(withWine(shared, normWine({ ...w, ...patch })), okText);
  return (
    <div style={T.screen} className="sa-screen" data-wine-editor={live.length}>
      {Head("Редактор вин", onBack)}
      <div style={{ padding: "0 16px 140px" }}>
        <div style={{ fontSize: 13.5, color: sub, margin: "2px 2px 10px" }}>
          {live.length ? winesWord(live.length) + (live.some((w) => w.byGlass) ? " · бокалом " + live.filter((w) => w.byGlass).length : "") + (uncheckedN ? " · не проверено " + uncheckedN : "") + (archN ? " · в архиве " + archN : "")
            : "Пока пусто. Добавляй по одному или импортом: фото страниц карты, списком названий, PDF."}
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button type="button" className="sa-btn" data-lens-btn="main" data-wine-new="" onClick={() => { setForm(blank()); setAiErr(""); setMsg(""); vibrate("light"); }} style={{ ...mainBtn, flex: 1.3, padding: "12px", fontSize: 14.5 }}>＋ Новое вино</button>
          <button type="button" className="sa-btn" data-lens-btn={imp ? "tab" : "soft"} data-wine-import-open="" onClick={() => { setImp(imp ? null : { stage: "pick" }); vibrate("light"); }} style={{ ...softBtn, flex: 1, padding: "12px", fontSize: 14.5 }}>Импорт</button>
        </div>
        {impPanel}
        {note}
        {wines.length ? <>
          <input data-lens-field="" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Найти вино" aria-label="Найти вино" style={{ ...inputSt, marginTop: 12 }} />
          <div className="sa-hscroll" role="group" aria-label="Показать" style={{ display: "flex", gap: 6, overflowX: "auto", padding: "10px 0 4px" }}>
            {[["all", "Все"], ...(uncheckedN ? [["unchecked", "Не проверено · " + uncheckedN]] : []), ["glass", "Бокалом"], ["stop", "Сегодня нет"], ...(archN ? [["archive", "Архив"]] : [])].map(([k, t]) => (
              <button key={k} type="button" aria-pressed={only === k} data-wine-filter={k} data-lens-btn={only === k ? "tab" : "soft"} data-lens-ink="" onClick={() => { setOnly(k); vibrate("light"); }} style={pill(only === k, { flexShrink: 0 })}>{t}</button>))}
          </div>
          {!list.length ? <div style={{ fontSize: 14, color: sub, padding: "16px 2px" }}>Здесь пусто.</div> : null}
          {groupByColor(list).map(([k, ws]) => (
            <div key={k}>
              <div style={{ ...labelStyle(13.5), color: gold, margin: "14px 2px 6px" }}>{COLOR_GROUP[k]} · {ws.length}</div>
              {ws.map((w) => {
                const open = () => { setForm({ ...blank(), ...w }); setAiErr(""); setMsg(""); setSure(false); vibrate("light"); };
                return (
                  <div key={w.id} data-lens-card="" data-wine-erow={w.id} style={{ ...card, marginBottom: 8, padding: "10px 12px", display: "flex", gap: 10, alignItems: "center" }}>
                    <div role="button" tabIndex={0} onClick={open} {...onActivate(open)} style={{ flex: 1, minWidth: 0, cursor: "pointer" }}>
                      <div style={{ fontFamily: SERIF, fontSize: 15, color: text, lineHeight: 1.3, opacity: w.stop ? 0.6 : 1 }}>{wineTitle(w)}</div>
                      {wineLine(w) ? <div style={{ fontSize: 12.5, color: sub, marginTop: 2, lineHeight: 1.4 }}>{wineLine(w)}</div> : null}
                      <div style={{ fontSize: 12, marginTop: 3, display: "flex", gap: 8, flexWrap: "wrap" }}>
                        {winePrice(w) ? <span style={{ color: text }}>{winePrice(w)}</span> : null}
                        {w.stop ? <span style={{ color: red }}>сегодня нет</span> : null}
                        {unchecked(w) ? <span style={{ color: amber }}>AI: {w.ai.slice(0, 4).map((f) => FIELD_RU[f] || f).join(", ")}{w.ai.length > 4 ? "…" : ""}</span> : null}
                      </div>
                    </div>
                    {unchecked(w) && !w.archived ? <button type="button" className="sa-btn" data-lens-btn="soft" data-wine-ok={w.id} disabled={busy} onClick={() => quick(confirmWine(w, who), {}, "«" + w.name + "» проверено")}
                      style={pill(false, { color: text, flexShrink: 0 })}>Верно</button> : null}
                  </div>);
              })}
            </div>))}
        </> : null}
      </div>
    </div>
  );
}
