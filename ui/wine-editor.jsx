// ui/wine-editor.jsx — v120 (Доп. 433): «Редактор вин» — умный, как редактор коктейлей.
//
// Владелец (31.10): «Сделаем такой же умный редактор, чтобы не только AI добавлял, а ещё и человек ручками всё это мог
// добавить». Каждое поле заполняется руками. AI помогает четырьмя путями (api/wine-import.js): «Заполнить по названию»
// в форме; «Импорт»: фото страницы карты (по странице за раз, можно несколько снимков), PDF, список названий текстом
// (по 15 за запрос). Что дописал AI, помечено «AI» и ждёт проверки: «Всё верно» в форме или «Верно» в списке (одно
// касание). Поле, исправленное руками, — проверено. Сохраняется в меню команды (menu_set), команда видит сразу.
// v122 (Доп. 435), владелец (31.10): «может в редактор добавим возможность загрузки фото бутылок?». Фото бутылки в форме:
// снимок ужимается до 700 px и уходит в хранилище (функция photo-upload, как у фото блюд и коктейлей), в записи — ссылка;
// «Заполнить по этикетке» — AI читает этикетку (снимок до 1800 px), у нового вина без названия — сразу после снимка.
// «Импорт» → «Фото бутылок»: пачка снимков, с каждого — вино с фото; что уже есть в карте без фото, получает фото и пустые
// поля с этикетки (lib/wine.js: bottlePlan, applyBottles).
// v123 (Доп. 436): «Проверка подряд» — не проверенные вина по одному на экран, что дописал AI, подсвечено; «Верно»,
// «Исправить» (форма), «Пропустить». Вход — из редактора и из тренировки («@review»): в тренировку идут только проверенные.
// У нового вина — addedAt (для «Новых вин» в тренировке).
import React from "react";
import { GOLD, labelStyle } from "./tokens";
import { onActivate, vibrate } from "../lib/utils";
import { rpc, saToken, SUPABASE_URL, SUPABASE_KEY } from "../api/supabase";
import { rememberSharedMenu, dishesOf } from "../lib/reference-context";
import { useTeamMenu, winesWord, BottleGlyph, WineThumb } from "./wine-list";
import { WINE_COLORS, COLOR_GROUP, sweetsOf, GLASS_TYPES, TEMP_HINT, AI_FIELDS, FIELD_RU, wineRecords, withWine, withWines, withoutWine, normWine, mergeAi,
  touched, confirmWine, unchecked, wineTitle, wineLine, winePrice, groupByColor, findWines, sameWine, splitNames, bottlePlan, applyBottles, normName, uncheckedQueue, reviewRows } from "../lib/wine";

const SERIF = "Georgia, 'Times New Roman', serif";
const BATCH = 15;   // названий за один запрос AI
const MAX_SHOTS = 40;   // v122: снимков бутылок за одну пачку
const newId = () => "wn-" + Date.now() + "-" + Math.random().toString(36).slice(2, 6);
// _nid — id нового вина заранее: под ним фото ложится в хранилище ещё до сохранения
const blank = () => ({ id: "", _nid: newId(), name: "", producer: "", country: "", region: "", grapes: "", color: "", sweet: "", vintage: "", abv: "", byGlass: false,
  priceGlass: "", priceBottle: "", volume: "", temp: "", glass: "", notes: "", short: "", story: "", pair: [], pairNote: "", stop: null, archived: false, ai: [] });
const shotsWord = (n) => { const m10 = n % 10, m100 = n % 100; return n + " " + (m10 === 1 && m100 !== 11 ? "снимке" : "снимках"); };
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
// фото бутылки для карты: до 700 px, JPEG (как фото блюд), data:image… — уходит в хранилище
function smallJpeg(file) {
  return new Promise((ok, bad) => {
    try {
      const url = URL.createObjectURL(file), img = new Image();
      img.onload = () => {
        const k = Math.min(1, 700 / Math.max(img.width, img.height)), c = document.createElement("canvas");
        c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
        c.getContext("2d").drawImage(img, 0, 0, c.width, c.height); URL.revokeObjectURL(url);
        let data = c.toDataURL("image/jpeg", 0.74); if (data.length > 260000) data = c.toDataURL("image/jpeg", 0.56);
        ok(data);
      };
      img.onerror = () => { URL.revokeObjectURL(url); bad(new Error("Не получилось открыть снимок")); };
      img.src = url;
    } catch (e) { bad(e); }
  });
}
// причина отказа хранилища словами (как у фото блюд, ui/menu-trainer.jsx)
const photoWhy = (status, j) => status === 404 || (j && /not found/i.test(String(j.message || j.msg || ""))) ? "функция photo-upload не развёрнута в Supabase"
  : j && j.error === "auth" ? "сессия устарела, войди заново" : j && j.error === "forbidden" ? "загружать фото может менеджер, старший или владелец"
  : j && j.error === "storage" ? "хранилище: " + (j.detail || "ошибка") : j && j.error === "too_large" ? "фото больше 2 МБ" : "HTTP " + status;
const uploadPhoto = (restaurant, id, data) => fetch(`${SUPABASE_URL}/functions/v1/photo-upload`, { method: "POST",
  headers: { "Content-Type": "application/json", apikey: SUPABASE_KEY, Authorization: "Bearer " + SUPABASE_KEY },
  body: JSON.stringify({ token: saToken(), restaurant, dishId: id, image: data }) })
  .catch(() => { throw new Error("нет связи с сервером"); })
  .then((r) => r.json().catch(() => null).then((j) => { if (j && j.ok && j.url) return j.url; throw new Error(photoWhy(r.status, j)); }));
const fileB64 = (file) => new Promise((ok, bad) => { const fr = new FileReader(); fr.onload = () => ok(String(fr.result).split(",")[1]); fr.onerror = () => bad(new Error("Файл не прочитался")); fr.readAsDataURL(file); });
// AI: ответ — { wines, cut } (cut — ответ оборвался на длинной карте: просим продолжение); ошибка — понятным текстом
const askAiFull = (body) => fetch("/api/wine-import", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...body, token: saToken() }) })
  .catch(() => { throw new Error("Сеть недоступна или функция /api/wine-import не развёрнута."); })
  .then((r) => r.json().catch(() => ({})).then((j) => { if (!r.ok || !Array.isArray(j.wines)) throw new Error((j && j.error) || "Не получилось, попробуй ещё раз"); return j; }));
const askAi = (body) => askAiFull(body).then((j) => j.wines);
const MAX_ROUNDS = 8;   // v122: заходов на одну длинную карту (продолжение с вина после последнего прочитанного)

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
  const [sureAll, setSureAll] = React.useState(false);  // v122: «Верно для всех в списке» — второе касание
  React.useEffect(() => { setSureAll(false); }, [only, q]);
  const photoRef = React.useRef(null), pdfRef = React.useRef(null), started = React.useRef(false);
  const picRef = React.useRef(null), bottleRef = React.useRef(null);
  const [pic, setPic] = React.useState(null);           // фото в форме: { file, data, state: up | ok | err, err }
  const [rev, setRev] = React.useState(null);           // v123: «Проверка подряд» — { ids, i, ok, fix, skip }
  const wines = React.useMemo(() => wineRecords(shared), [shared]);
  const formKey = form ? form.id || form._nid : "";
  React.useEffect(() => { setPic(null); }, [formKey]);   // другое вино в форме — снимок прежнего не переносится
  const live = wines.filter((w) => !w.archived);
  const dishes = React.useMemo(() => { try { return (dishesOf(restaurant) || []).filter((d) => d && d.id && d.name); } catch (e) { return []; } }, [restaurant, shared]);
  React.useEffect(() => {   // «Править» из карточки вина — сразу форма; «@review» из тренировки — сразу «Проверка подряд»
    if (started.current || !startEditId) return;
    if (startEditId === "@review") { if (wines.length) { started.current = true; startReview(); } return; }
    const r = wines.find((x) => x.id === startEditId);
    if (r) { started.current = true; setForm({ ...blank(), ...r }); }
  }, [wines, startEditId]);   // eslint-disable-line react-hooks/exhaustive-deps
  const startReview = () => { setRev({ ids: uncheckedQueue(wines), i: 0, ok: 0, fix: 0, skip: 0 }); setMsg(""); vibrate("light"); };
  const revCur = rev ? wines.find((x) => x.id === rev.ids[rev.i]) : null;
  React.useEffect(() => {   // вино из очереди удалили или убрали в архив (в форме) — дальше
    if (rev && !form && rev.i < rev.ids.length && (!revCur || revCur.archived)) setRev((r) => (r ? { ...r, i: r.i + 1 } : r));
  }, [rev, form, revCur]);

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
  // v123, владелец (снимок): «Кнопки слиплись». У T.doneBtn свой marginTop, и в стиле он стоит раньше margin: 0 — отступ
  // сверху у кнопки (marginTop: 10) вставал на его место и затирался margin: 0. База кнопок — без него.
  const { marginTop: _doneTop, ...doneBase } = T.doneBtn;
  const mainBtn = { ...doneBase, margin: 0, background: gold, color: "#1A1008", border: "none" };
  const softBtn = { ...doneBase, margin: 0, background: "transparent", color: text, border: `1px solid ${gold}77` };
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
    // этикетка: AI читает снимок (до 1800 px); пустое название берёт с этикетки, остальное — только в пустые поля
    const readLabel = (file) => {
      if (!file || aiBusy) return;
      setAiBusy(true); setAiErr(""); vibrate("light");
      shrink(file).then((b) => askAi({ mode: "label", imageBase64: b, mime: "image/jpeg" }))
        .then((got) => { setAiBusy(false); const g = got[0] || {}; setForm((x) => mergeAi(String(x.name || "").trim() ? x : { ...x, name: g.name || "" }, g)); vibrate("success"); })
        .catch((e) => { setAiBusy(false); setAiErr(e.message); });
    };
    const onPic = (e) => {
      const file = e.target.files && e.target.files[0]; e.target.value = ""; if (!file) return;
      const id = form.id || form._nid, auto = !form.id && !String(form.name || "").trim();
      smallJpeg(file).then((data) => {
        setPic({ file, data, state: "up" }); vibrate("light");
        if (auto) readLabel(file);   // новое вино без названия: снял — и AI сразу читает этикетку
        uploadPhoto(restaurant, id, data)
          .then((url) => { setForm((x) => (x && (x.id || x._nid) === id ? { ...x, img: url } : x)); setPic((p) => (p && p.data === data ? { ...p, state: "ok" } : p)); })
          .catch((err) => setPic((p) => (p && p.data === data ? { ...p, state: "err", err: err.message } : p)));
      }).catch((err) => setPic({ file: null, data: "", state: "err", err: err.message }));
    };
    const picSrc = pic && pic.data ? pic.data : form.img;
    const picNote = pic && pic.state === "up" ? "Загружаю фото…" : pic && pic.state === "err" ? "Фото не загрузилось: " + pic.err + ". Вино сохранится без него."
      : pic && pic.state === "ok" ? "Фото загружено, сохранится вместе с вином" : form.img ? "Фото в карте" : "Сними бутылку этикеткой к камере: фото будет в карте, а AI прочитает название, регион, год и сорт";
    const save = (confirm) => {
      const rec = normWine(confirm ? confirmWine(form, who) : form, { id: form.id || form._nid });
      if (!rec.name) { setMsg("Нужно название"); vibrate("error"); return; }
      if (!form.id && !rec.addedAt) rec.addedAt = Date.now();   // v123: новое вино — в «Новые вина» на 30 дней
      // из «Проверки подряд»: сохранил исправленное — дальше по очереди
      persist(withWine(shared, rec), "«" + rec.name + "» в карте у всех", () => { setForm(null); setSure(false); if (rev) setRev((r) => (r ? { ...r, i: r.i + 1, fix: r.fix + 1 } : r)); });
    };
    const isNew = !form.id;
    const pairs = new Set(form.pair || []);
    const dishOrder = [...dishes.filter((d) => pairs.has(d.id)), ...dishes.filter((d) => !pairs.has(d.id))];
    return (
      <div style={T.screen} className="sa-screen" data-wine-form={form.id || "new"}>
        {Head(isNew ? "Новое вино" : "Правка вина", () => { setForm(null); setSure(false); setAiErr(""); })}
        <div style={{ padding: "4px 16px 220px" }}>
          {label("Фото бутылки")}
          <div data-lens-card="" data-wine-photo={pic ? pic.state : form.img ? "on" : "none"} style={{ ...card, display: "flex", gap: 12, alignItems: "center", padding: "10px 12px" }}>
            <div style={{ width: 66, height: 88, flexShrink: 0, borderRadius: 10, overflow: "hidden", display: "grid", placeItems: "center", border: `1px ${picSrc ? "solid" : "dashed"} ${gold}55`, background: a11y ? "rgba(139,106,48,0.06)" : "rgba(255,248,230,0.04)" }}>
              {picSrc ? <img src={picSrc} alt="" data-wine-pic="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} /> : <BottleGlyph color={gold + "99"} w={20} />}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div role="status" data-wine-pic-note="" style={{ fontSize: 12.5, color: pic && pic.state === "err" ? red : sub, lineHeight: 1.45 }}>{picNote}</div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
                <button type="button" className="sa-btn" data-lens-btn="soft" data-lens-ink="" data-wine-pic-take="" onClick={() => picRef.current && picRef.current.click()} style={pill(false, { color: gold })}>{picSrc ? "Заменить" : "Сфотографировать"}</button>
                {pic && pic.file ? <button type="button" className="sa-btn" data-lens-btn="soft" data-lens-ink="" data-wine-label="" onClick={() => readLabel(pic.file)} disabled={aiBusy} style={pill(false, { color: gold, opacity: aiBusy ? 0.6 : 1 })}>{aiBusy ? "AI читает…" : "Заполнить по этикетке"}</button> : null}
                {picSrc ? <button type="button" className="sa-btn" data-lens-btn="soft" data-wine-pic-del="" onClick={() => { setPic(null); setForm((x) => ({ ...x, img: "" })); vibrate("light"); }} style={pill(false, { color: text })}>Убрать</button> : null}
              </div>
            </div>
            <input ref={picRef} type="file" accept="image/*" data-wine-pic-input="" onChange={onPic} style={{ display: "none" }} />
          </div>
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
          <button type="button" className="sa-btn" data-lens-btn="main" data-wine-save="" onClick={() => save(false)} disabled={busy || (pic && pic.state === "up")} style={{ ...mainBtn, flex: 1.6, opacity: busy || (pic && pic.state === "up") ? 0.6 : 1 }}>{busy ? "Сохраняю…" : pic && pic.state === "up" ? "Загружаю фото…" : "Сохранить"}</button>
        </div>
      </div>
    );
  }

  // ─────────────────────────────── ИМПОРТ
  const addFound = (found, failed = 0, note = "") => setImp({ stage: "review", failed, note, found: found.map((w) => ({ w, dup: live.some((x) => sameWine(x, w)) })).map((x) => ({ ...x, keep: !x.dup })) });
  const fromAi = (raw, name) => normWine({ ...raw, name: name || raw.name }, { ai: AI_FIELDS });
  const runNames = (names, withAi) => {
    if (!withAi) { addFound(names.map((n) => normWine({ name: n }))); return; }
    const found = []; let failed = 0, i = 0;
    const step = () => {
      if (i >= names.length) { addFound(found, failed); return; }
      const part = names.slice(i, i + BATCH);
      setImp({ stage: "work", label: "AI дополняет", done: i, total: names.length, step: BATCH });
      askAi({ mode: "names", names: part }).then((got) => { part.forEach((n, j) => found.push(got[j] ? fromAi(got[j], n) : normWine({ name: n }))); })
        .catch(() => { failed += part.length; part.forEach((n) => found.push(normWine({ name: n }))); })
        .then(() => { i += BATCH; step(); });
    };
    step();
  };
  // v122: длинная карта (владелец: «редактор pdf-ку не принял») — ответ мог оборваться; сервер отдаёт целые вина и cut,
  // тогда просим продолжение с вина после последнего прочитанного (after), до MAX_ROUNDS заходов; повторы — мимо
  const runSheets = (files, kind) => {
    const found = [], seen = new Set(); let k = 0, err = "";
    const take = (ws) => { let n = 0; for (const raw of ws) { const w = fromAi(raw); const key = normName(wineTitle(w)); if (!w.name || seen.has(key)) continue; seen.add(key); found.push(w); n++; } return n; };
    const label = () => (kind === "pdf" ? "Читаю PDF" : "Читаю страницу") + (found.length ? ", прочитано " + winesWord(found.length) : "");
    const step = () => {
      if (k >= files.length) {
        if (!found.length) { setImp({ stage: "pick", err: err || "На листе не нашлось ни одного вина" }); return; }
        addFound(found, 0, err ? "Дочитать не получилось: " + err + ". Прочитанное можно добавить, а остальное прочитать ещё раз или снять «Фото страницы»." : ""); return;
      }
      const f = files[k];
      setImp({ stage: "work", label: label(), done: k, total: files.length, step: 1 });
      (kind === "pdf" ? fileB64(f) : shrink(f)).then((b) => {
        let round = 0, after = "";
        const ask = () => askAiFull(kind === "pdf" ? { mode: "pdf", pdfBase64: b, after } : { mode: "photo", imageBase64: b, mime: "image/jpeg", after }).then((j) => {
          const n = take(j.wines); round++;
          setImp({ stage: "work", label: label(), done: k, total: files.length, step: 1 });
          if (j.cut && n && round < MAX_ROUNDS) { after = String(j.wines[j.wines.length - 1].name || ""); return ask(); }
          return undefined;
        });
        return ask();
      }).catch((e) => { err = e.message; })
        .then(() => { k++; step(); });
    };
    step();
  };
  // v122: после листа или PDF у вин только то, что было в карте; ноты, фраза гостю, рассказ и подача — пачками по 15
  // (режим names), только в пустые поля, с пометкой «AI»
  const enrich = () => {
    const base = imp, out = base.found.slice();
    const idx = out.map((x, i) => i).filter((i) => out[i].keep && !out[i].w.short && !(out[i].w.notes || []).length);
    let k = 0, failed = 0;
    const step = () => {
      if (k >= idx.length) { setImp({ ...base, stage: "review", found: out, enriched: true, enrichFailed: failed }); vibrate(failed ? "error" : "success"); return; }
      const part = idx.slice(k, k + BATCH);
      setImp({ stage: "work", label: "AI дополняет", done: k, total: idx.length, step: BATCH });
      askAi({ mode: "names", names: part.map((i) => out[i].w.name) })
        .then((got) => { part.forEach((i, j) => { if (got[j]) out[i] = { ...out[i], w: mergeAi(out[i].w, got[j]) }; }); })
        .catch(() => { failed += part.length; })
        .then(() => { k += BATCH; step(); });
    };
    step();
  };
  // v122: фото бутылок пачкой — по снимку: этикетку читает AI, фото для карты ужимается; что уже в карте — см. bottlePlan
  const runBottles = (picked) => {
    // за раз — до 40 снимков: снимки держатся в памяти телефона до сохранения, а одна пачка — это минуты чтения
    const files = picked.slice(0, MAX_SHOTS), cut = picked.length - files.length;
    const found = []; let k = 0, failed = 0;
    const step = () => {
      if (k >= files.length) {
        if (!found.length) { setImp({ stage: "pick", err: "Ни одной этикетки не прочитать: сними бутылки ближе, при свете, этикеткой к камере" }); return; }
        setImp({ stage: "review", bottles: true, failed, found, cut }); return;
      }
      setImp({ stage: "work", label: "Читаю этикетку", done: k, total: files.length, step: 1 });
      const f = files[k];
      Promise.all([smallJpeg(f), shrink(f).then((b) => askAi({ mode: "label", imageBase64: b, mime: "image/jpeg" }))])
        .then(([data, got]) => { const w = fromAi(got[0] || {}); if (!w.name) { failed++; return; } const plan = bottlePlan(w, live); found.push({ w, data, plan, keep: plan.keep, dup: plan.kind !== "new" }); })
        .catch(() => { failed++; })
        .then(() => { k++; step(); });
    };
    step();
  };
  // сохранить отмеченные бутылки: фото — в хранилище по одному, потом всё одним сохранением меню
  const saveBottles = async (found) => {
    const keep = found.filter((x) => x.keep);
    if (!keep.length || busy) return;
    setBusy(true); setMsg("");
    const entries = []; let upFail = 0, why = "";
    for (let i = 0; i < keep.length; i++) {
      setImp((p) => (p ? { ...p, saving: i + 1 } : p));
      const x = keep[i];
      let url = "";
      try { url = await uploadPhoto(restaurant, x.plan.to || x.w.id, x.data); } catch (e) { upFail++; if (!why) why = e.message; }
      entries.push({ w: x.w, plan: x.plan, url });
    }
    persist(applyBottles(shared, entries), "Сохранено: " + winesWord(keep.length) + (upFail ? ". Фото не загрузились у " + winesWord(upFail) + ": " + why : ""), () => setImp(null));
  };
  const impPanel = imp ? (
    <div data-lens-card="" data-wine-import={imp.stage} style={{ ...card, margin: "14px 0 6px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ ...labelStyle(13.5), color: gold, flex: 1 }}>Импорт</span>
        {imp.stage !== "work" ? <button type="button" className="sa-btn" data-lens="disc" data-lens-x="" aria-label="Закрыть импорт" onClick={() => setImp(null)} style={{ border: 0, background: "none", color: sub, fontSize: 20, cursor: "pointer", width: 32, height: 32, lineHeight: 1 }}>×</button> : null}
      </div>
      {imp.stage === "pick" ? <>
        <div style={{ fontSize: 13, color: sub, lineHeight: 1.5, margin: "4px 0 10px" }}>AI прочитает и заполнит, ты проверишь список и добавишь. Что он допишет сам, будет помечено «AI».</div>
        <div style={{ display: "grid", gap: 8 }}>
          <button type="button" className="sa-btn" data-lens-btn="soft" data-wine-imp="bottles" onClick={() => bottleRef.current && bottleRef.current.click()} style={{ ...softBtn, textAlign: "left", padding: "12px 14px", fontWeight: "normal" }}><b>Фото бутылок</b><br /><span style={{ fontSize: 12.5, color: sub }}>Сними бутылки этикеткой к камере, можно все сразу: каждая станет вином с фото</span></button>
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
          <div style={{ fontSize: 14, color: text }}>{imp.label}{imp.total > 1 ? ": " + Math.min(imp.done + (imp.step || BATCH), imp.total) + " из " + imp.total : "…"}</div>
          <div style={{ height: 4, borderRadius: 2, background: gold + "26", marginTop: 8, overflow: "hidden" }}><div style={{ height: "100%", width: Math.round((imp.done / Math.max(1, imp.total)) * 100) + "%", background: gold, transition: "width .3s" }} /></div>
        </div>) : null}
      {imp.stage === "review" && imp.bottles ? (() => {
        const keepN = imp.found.filter((x) => x.keep).length, newN = imp.found.filter((x) => x.plan.kind === "new").length;
        const toggle = (i) => setImp({ ...imp, found: imp.found.map((x, j) => (j === i ? { ...x, keep: !x.keep } : x)) });
        const what = { attach: "в карте без фото: фото и пустые поля с этикетки добавятся к нему", replace: "уже в карте с фото: отметь, чтобы заменить фото" };
        return <>
          <div style={{ fontSize: 13.5, color: text, margin: "6px 0 8px", lineHeight: 1.5 }} data-wine-found={imp.found.length}>
            Прочитано {winesWord(imp.found.length)}{newN < imp.found.length ? ", уже в карте: " + (imp.found.length - newN) : ""}. Сними отметку с лишних.
            {imp.failed ? " Этикетку не прочитать на " + shotsWord(imp.failed) + ": их можно снять ещё раз." : ""}
            {imp.cut ? " За раз читаю до " + MAX_SHOTS + " снимков, остальные " + imp.cut + " добавь следующей пачкой." : ""}</div>
          <div style={{ maxHeight: 360, overflowY: "auto" }}>
            {imp.found.map((x, i) => (
              <label key={i} data-wine-bottle-row={i} data-wine-plan={x.plan.kind} style={{ display: "flex", gap: 10, alignItems: "center", padding: "8px 2px", borderTop: i ? `1px solid ${gold}22` : "none", cursor: "pointer" }}>
                <input type="checkbox" checked={x.keep} onChange={() => toggle(i)} style={{ accentColor: gold, width: 18, height: 18, flexShrink: 0 }} />
                <img src={x.data} alt="" style={{ width: 40, height: 54, objectFit: "cover", borderRadius: 7, flexShrink: 0, border: `1px solid ${gold}44` }} />
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: "block", fontFamily: SERIF, fontSize: 14.5, color: text }}>{wineTitle(x.w)}</span>
                  {wineLine(x.w) ? <span style={{ display: "block", fontSize: 12.5, color: sub, lineHeight: 1.4 }}>{wineLine(x.w)}</span> : null}
                  {what[x.plan.kind] ? <span style={{ display: "block", fontSize: 12, color: amber, lineHeight: 1.4, marginTop: 2 }}>{what[x.plan.kind]}</span> : null}
                </span>
              </label>))}
          </div>
          <button type="button" className="sa-btn" data-lens-btn="main" data-wine-add="" disabled={!keepN || busy} onClick={() => saveBottles(imp.found)}
            style={{ ...mainBtn, width: "100%", marginTop: 14, padding: "12px", opacity: !keepN || busy ? 0.55 : 1 }}>{busy ? (imp.saving ? "Загружаю фото " + imp.saving + " из " + keepN : "Сохраняю…") : keepN ? "Сохранить " + winesWord(keepN) : "Ничего не отмечено"}</button>
        </>;
      })() : null}
      {imp.stage === "review" && !imp.bottles ? (() => {
        const keepN = imp.found.filter((x) => x.keep).length;
        const toggle = (i) => setImp({ ...imp, found: imp.found.map((x, j) => (j === i ? { ...x, keep: !x.keep } : x)) });
        return <>
          <div style={{ fontSize: 13.5, color: text, margin: "6px 0 8px", lineHeight: 1.5 }} data-wine-found={imp.found.length}>
            Нашлось {winesWord(imp.found.length)}{imp.found.some((x) => x.dup) ? ", уже в карте: " + imp.found.filter((x) => x.dup).length : ""}. Сними отметку с лишних.
            {imp.failed ? " Для " + winesWord(imp.failed) + " AI не ответил: они добавятся только с названием." : ""}</div>
          {imp.note ? <div role="alert" data-wine-imp-note="" style={{ fontSize: 13, color: amber, margin: "0 0 8px", lineHeight: 1.45 }}>{imp.note}</div> : null}
          {imp.enriched ? <div data-wine-enriched="" style={{ fontSize: 13, color: sub, margin: "0 0 8px", lineHeight: 1.45 }}>{imp.enrichFailed ? "AI не ответил для " + winesWord(imp.enrichFailed) + ": у них останется то, что было в карте." : "Ноты, фраза гостю и подача дописаны AI: проверишь в редакторе."}</div> : null}
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
          {!imp.enriched && imp.found.some((x) => x.keep && !x.w.short && !(x.w.notes || []).length) ? (
            <button type="button" className="sa-btn" data-lens-btn="soft" data-lens-ink="" data-wine-enrich="" disabled={busy} onClick={enrich}
              style={{ ...softBtn, width: "100%", marginTop: 12, padding: "11px", fontSize: 13.5, color: gold }}>Дополнить ноты и подачу через AI</button>) : null}
          <button type="button" className="sa-btn" data-lens-btn="main" data-wine-add="" disabled={!keepN || busy} onClick={() => persist(withWines(shared, imp.found.filter((x) => x.keep).map((x) => ({ ...x.w, addedAt: x.w.addedAt || Date.now() }))), "Добавлено: " + winesWord(keepN), () => setImp(null))}
            style={{ ...mainBtn, width: "100%", marginTop: 14, padding: "12px", opacity: !keepN || busy ? 0.55 : 1 }}>{busy ? "Сохраняю…" : keepN ? "Добавить " + winesWord(keepN) : "Ничего не отмечено"}</button>
        </>;
      })() : null}
      <input ref={photoRef} type="file" accept="image/*" multiple onChange={(e) => { const fs = [...(e.target.files || [])]; e.target.value = ""; if (fs.length) runSheets(fs, "photo"); }} style={{ display: "none" }} />
      <input ref={bottleRef} type="file" accept="image/*" multiple data-wine-bottles-input="" onChange={(e) => { const fs = [...(e.target.files || [])]; e.target.value = ""; if (fs.length) runBottles(fs); }} style={{ display: "none" }} />
      <input ref={pdfRef} type="file" accept="application/pdf" onChange={(e) => { const f = e.target.files && e.target.files[0]; e.target.value = ""; if (f) runSheets([f], "pdf"); }} style={{ display: "none" }} />
    </div>) : null;

  // ─────────────────────────────── ПРОВЕРКА ПОДРЯД (v123)
  // Владелец: вин 140+, AI дописал многое. По одному вину на экран: что дописал AI, подсвечено; «Верно» — подтвердить всё
  // и дальше, «Исправить» — форма (сохранил — дальше), «Пропустить» — останется в «Не проверено».
  if (rev) {
    const n = rev.ids.length, cur = rev.i < n ? revCur : null;
    const next = (patch) => setRev((r) => (r ? { ...r, i: r.i + 1, ...patch(r) } : r));
    const ok = () => { if (!cur || busy) return; persist(withWine(shared, normWine(confirmWine(cur, who))), "«" + cur.name + "» проверено", () => next((r) => ({ ok: r.ok + 1 }))); };
    return (
      <div style={T.screen} className="sa-screen" data-wine-review-screen={rev.i + "/" + n}>
        {Head("Проверка подряд", () => { setRev(null); setMsg(""); })}
        <div style={{ padding: "4px 16px 150px" }}>
          {cur ? <>
            <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "2px 2px 10px" }}>
              <div style={{ flex: 1, height: 4, borderRadius: 3, background: gold + "26", overflow: "hidden" }}><div style={{ width: Math.round((rev.i / Math.max(1, n)) * 100) + "%", height: "100%", background: gold, transition: "width .3s" }} /></div>
              <span data-wine-review-pos="" style={{ fontSize: 12.5, color: sub, whiteSpace: "nowrap" }}>{rev.i + 1} из {n}</span>
            </div>
            <div data-lens-card="" data-wine-review={cur.id} style={{ ...card, padding: "14px 16px" }}>
              <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                {cur.img ? <img src={cur.img} alt="" style={{ width: 58, height: 78, objectFit: "cover", borderRadius: 9, border: `1px solid ${gold}44`, flexShrink: 0, display: "block" }} /> : null}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: SERIF, fontSize: 18, color: text, lineHeight: 1.25 }}>{wineTitle(cur)}</div>
                  {unchecked(cur) ? <div data-wine-review-ai="" style={{ fontSize: 12.5, color: amber, marginTop: 4, lineHeight: 1.45 }}>AI дописал: {cur.ai.map((f) => FIELD_RU[f] || f).join(", ")}</div>
                    : <div style={{ fontSize: 12.5, color: sub, marginTop: 4 }}>Уже проверено</div>}
                </div>
              </div>
              {reviewRows(cur).map((r) => (
                <div key={r.key} data-wine-rrow={r.key} data-wine-rrow-ai={r.ai ? "1" : ""} style={{ marginTop: 11, paddingLeft: 10, borderLeft: `2px solid ${r.ai ? amber : gold + "33"}` }}>
                  <div style={{ ...labelStyle(12.5), color: r.ai ? amber : gold }}>{r.label}{r.ai ? aiTag : null}</div>
                  <div style={{ fontSize: 14, color: text, lineHeight: 1.45, marginTop: 2 }}>{r.value}</div>
                </div>))}
            </div>
            <div style={{ fontSize: 12.5, color: sub, lineHeight: 1.5, margin: "10px 2px 0" }}>Где не так, «Исправить»: откроется форма, сохранишь и пойдём дальше. «Пропустить» оставит вино в «Не проверено».</div>
          </> : (
            <div data-lens-card="" data-wine-review-done={rev.ok + "/" + rev.fix + "/" + rev.skip} style={{ ...card, textAlign: "center", padding: "22px 16px", marginTop: 8 }}>
              <div style={{ fontFamily: SERIF, fontSize: 19, color: text }}>{n ? "Проверка закончена" : "Не проверенных вин нет"}</div>
              <div style={{ fontSize: 14, color: sub, marginTop: 8, lineHeight: 1.5 }}>{n ? "Проверено: " + rev.ok + " · исправлено: " + rev.fix + " · пропущено: " + rev.skip + (rev.skip ? ". Пропущенные остались в «Не проверено»." : ".") : "Всё, что дописал AI, уже подтверждено."}</div>
              <button type="button" className="sa-btn" data-lens-btn="main" data-wine-review-end="" onClick={() => { setRev(null); setMsg(""); }} style={{ ...mainBtn, width: "100%", marginTop: 16, padding: "12px" }}>К списку</button>
            </div>)}
          {note}
        </div>
        {cur ? (
          <div style={{ position: "fixed", left: 0, right: 0, bottom: 0, zIndex: 30, padding: "12px 16px calc(14px + env(safe-area-inset-bottom, 0px))", display: "flex", gap: 8, background: a11y ? "rgba(245,238,222,0.96)" : "rgba(21,17,11,0.94)", borderTop: `1px solid ${gold}33` }}>
            <button type="button" className="sa-btn" data-lens-btn="soft" data-wine-review-skip="" disabled={busy} onClick={() => { next((r) => ({ skip: r.skip + 1 })); setMsg(""); vibrate("light"); }} style={{ ...softBtn, flex: 1, padding: "12px 6px", fontSize: 14 }}>Пропустить</button>
            <button type="button" className="sa-btn" data-lens-btn="soft" data-wine-review-fix="" disabled={busy} onClick={() => { setForm({ ...blank(), ...cur }); setAiErr(""); setMsg(""); setSure(false); vibrate("light"); }} style={{ ...softBtn, flex: 1, padding: "12px 6px", fontSize: 14 }}>Исправить</button>
            <button type="button" className="sa-btn" data-lens-btn="main" data-wine-review-ok="" disabled={busy} onClick={ok} style={{ ...mainBtn, flex: 1.3, padding: "12px 6px", fontSize: 14, opacity: busy ? 0.6 : 1 }}>{busy ? "Сохраняю…" : "Верно"}</button>
          </div>) : null}
      </div>);
  }

  // ─────────────────────────────── СПИСОК
  const pool = only === "archive" ? wines.filter((w) => w.archived) : live;
  const list = findWines(pool, q).filter((w) => (only === "unchecked" ? unchecked(w) : only === "glass" ? w.byGlass : only === "stop" ? !!w.stop : true));
  const uncheckedN = live.filter(unchecked).length, archN = wines.length - live.length;
  const withPics = wines.some((w) => w.img);
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
        {uncheckedN && !imp ? (
          <button type="button" className="sa-btn" data-lens-btn="soft" data-lens-ink="" data-wine-review-start={uncheckedN} onClick={startReview}
            style={{ ...softBtn, width: "100%", marginTop: 14, padding: "11px", fontSize: 14, color: gold }}>Проверка подряд · {uncheckedN}</button>) : null}
        {impPanel}
        {note}
        {wines.length ? <>
          <input data-lens-field="" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Найти вино" aria-label="Найти вино" style={{ ...inputSt, marginTop: 14 }} />
          <div className="sa-hscroll" role="group" aria-label="Показать" style={{ display: "flex", gap: 6, overflowX: "auto", padding: "10px 0 4px" }}>
            {[["all", "Все"], ...(uncheckedN ? [["unchecked", "Не проверено · " + uncheckedN]] : []), ["glass", "Бокалом"], ["stop", "Сегодня нет"], ...(archN ? [["archive", "Архив"]] : [])].map(([k, t]) => (
              <button key={k} type="button" aria-pressed={only === k} data-wine-filter={k} data-lens-btn={only === k ? "tab" : "soft"} data-lens-ink="" onClick={() => { setOnly(k); vibrate("light"); }} style={pill(only === k, { flexShrink: 0 })}>{t}</button>))}
          </div>
          {!list.length ? <div style={{ fontSize: 14, color: sub, padding: "16px 2px" }}>Здесь пусто.</div> : null}
          {/* v122 (Доп. 435), владелец: «Да, давай добавим» — на 140 винах «Верно» по одному долго: пролистал, проверил глазами
              и одним касанием (с переспросом) подтвердил все, что сейчас в списке (с поиском — только найденные) */}
          {only === "unchecked" && list.length ? (
            <button type="button" className="sa-btn" data-lens-btn={sureAll ? "main" : "soft"} data-lens-ink="" data-wine-ok-all={sureAll ? "sure" : ""} disabled={busy}
              onClick={() => { if (!sureAll) { setSureAll(true); vibrate("light"); return; }
                persist(withWines(shared, list.map((w) => normWine(confirmWine(w, who)))), "Проверено: " + winesWord(list.length), () => { setSureAll(false); setOnly("all"); }); }}
              style={{ ...(sureAll ? mainBtn : softBtn), width: "100%", margin: "6px 0 4px", padding: "11px", fontSize: 13.5, ...(sureAll ? {} : { color: gold }) }}>
              {sureAll ? "Подтвердить все " + list.length + "? Коснись ещё раз" : "Верно для всех в списке: " + list.length}</button>) : null}
          {groupByColor(list).map(([k, ws]) => (
            <div key={k}>
              <div style={{ ...labelStyle(13.5), color: gold, margin: "14px 2px 6px" }}>{COLOR_GROUP[k]} · {ws.length}</div>
              {ws.map((w) => {
                const open = () => { setForm({ ...blank(), ...w }); setAiErr(""); setMsg(""); setSure(false); vibrate("light"); };
                return (
                  <div key={w.id} data-lens-card="" data-wine-erow={w.id} style={{ ...card, marginBottom: 8, padding: "10px 12px", display: "flex", gap: 10, alignItems: "center" }}>
                    {withPics ? <WineThumb w={w} gold={gold} a11y={a11y} onClick={open} /> : null}
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
