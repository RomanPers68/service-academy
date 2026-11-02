// ui/bar-sommelier.jsx — v131 (Доп. 444): «Сомелье» в «Барной карте».
//
// Владелец (02.11): «как ты смотришь на то, что бы добавить AI-Сомелье?» — на концепт «Да делаем». Вход — строка «Сомелье»
// под вкладками «Барной карты». Официант пишет или говорит, что хочет гость; быстрые просьбы одним касанием (к блюду из
// меню, бокалом, бюджет, похоже на…, аперитив, к десерту, дижестив) ставят фразу в поле: видно, что уйдёт Наставнику.
// В ответе 2–3 позиции только из нашей карты (не из стопа, в бюджете): почему подходит и фраза гостю; касание — карточка
// в «Барной карте», «назад» — сюда же. Дальше «Ещё варианты», «Подешевле», «Поделиться в чат». Работает через Наставника
// (функция ai-chat, лимит общий: подбор считается как вопрос); нет лимита, связи или ИИ — подбор по карте без пояснений.
// Что понято из просьбы и кто из карты годится — lib/sommelier.js.
import React from "react";
import { onActivate, vibrate } from "../lib/utils";
import { GOLD, labelStyle } from "./tokens";
import { SUPABASE_URL, SUPABASE_KEY, saToken } from "../api/supabase";
import { WINE, SPIRIT } from "../lib/drinks";
import { dishesOf } from "../lib/reference-context";
import { drinkShareItem, cocktailShareItem } from "../lib/share-items";
import { SOM_WHAT, SOM_KIND_RU, SOM_OCC, somAsk, askEmpty, somPool, somShortlist, somPrompt, promptCount, parseSom, localPicks, cheaperThan, somToggle, somOn,
  budgetPhrase, somBudgetSteps, dishOptions, likeOptions, kindsFor, posWord } from "../lib/sommelier";
import { MicButton } from "./mic";
import { CocktailArt } from "./cocktail-art";
import { WineThumb } from "./wine-list";
import { Chevron, ShareChat } from "./bar-kit";

const SERIF = "Georgia, 'Times New Roman', serif";
const H = () => ({ apikey: SUPABASE_KEY, Authorization: "Bearer " + SUPABASE_KEY });
const keyOf = (c) => c.kind + ":" + c.id;
const plural = (n, a, b, c) => { const m10 = n % 10, m100 = n % 100; return m10 === 1 && m100 !== 11 ? a : m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20) ? b : c; };
const cutName = (t, n = 26) => (String(t).length > n ? String(t).slice(0, n - 1).trimEnd() + "…" : String(t));
// без Наставника: почему подбор по карте и что делать
const LOCAL_WHY = {
  daily_limit: "На сегодня вопросы к Наставнику закончились: подобрал по карте сам, без его пояснений. Завтра снова с Наставником.",
  not_configured: "Наставник на сервере ещё не подключён: подобрал по карте сам, по совпадению с просьбой.",
  net: "Нет связи с Наставником: подобрал по карте сам, по совпадению с просьбой.",
  none: "Наставник не выбрал из списка: вот что ближе всего по карте.",
};
const LOCAL_ANY = "Наставник сейчас не ответил: подобрал по карте сам. Можно спросить ещё раз.";

/** Спросить Наставника: → { reply, remaining } или { error }. */
async function askMentor(prompt) {
  try {
    const r = await fetch(SUPABASE_URL + "/functions/v1/ai-chat", { method: "POST", headers: { "Content-Type": "application/json", ...H() },
      body: JSON.stringify({ token: saToken(), mode: "sommelier", messages: [{ role: "user", content: prompt }] }) });
    const j = await r.json();
    if (j && j.ok && j.reply) return { reply: String(j.reply), remaining: typeof j.remaining === "number" ? j.remaining : -1 };
    return { error: (j && j.error) || "ai" };
  } catch (e) { return { error: "net" }; }
}

/** Значок строки «Сомелье»: бокал и искра. */
export const SOM_IC = (c, s = 18) => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
    <path d="M6.5 3h8l-.5 5a3.5 3.5 0 0 1-7 0z" /><path d="M10.5 11.5V19M7.5 21h6" /><path d="M19 3.5v4M17 5.5h4" /></svg>);

/** Строка «Сомелье» под вкладками «Барной карты». */
export function SomEntry({ T, a11y, onClick }) {
  const gold = a11y ? "#7A5D2A" : GOLD, text = T.modTitle.color, sub = T.modSub.color;
  const go = () => { vibrate("light"); onClick(); };
  return (
    <div style={{ padding: "0 16px 12px" }}>
      <div role="button" tabIndex={0} data-bar-som-open="" data-lens-card="" onClick={go} {...onActivate(go)}
        style={{ ...T.modCard, display: "flex", alignItems: "center", gap: 12, padding: "10px 12px 10px 12px", margin: 0, cursor: "pointer",
          border: `1px solid ${gold}${a11y ? "77" : "66"}`, background: a11y ? "rgba(139,106,48,0.07)" : "linear-gradient(135deg, rgba(214,178,102,0.16), rgba(255,248,230,0.03) 70%)",
          boxShadow: a11y ? "none" : "0 0 22px rgba(214,178,102,0.10)" }}>
        <span aria-hidden="true" style={{ width: 36, height: 36, flexShrink: 0, borderRadius: 999, display: "grid", placeItems: "center", border: `1px solid ${gold}55`,
          background: a11y ? "rgba(139,106,48,0.08)" : "radial-gradient(circle at 50% 40%, rgba(214,178,102,0.22), rgba(214,178,102,0.04))" }}>{SOM_IC(gold, 19)}</span>
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{ display: "block", fontFamily: SERIF, fontSize: 15.5, color: text, lineHeight: 1.25 }}>Сомелье</span>
          <span style={{ display: "block", fontSize: 12.5, color: sub, lineHeight: 1.35, marginTop: 2 }}>Подберу гостю из нашей карты</span>
        </span>
        <Chevron gold={gold} />
      </div>
    </div>);
}

export function BarSommelier({ T, a11y, restaurant, cocktails, wines, spirits, start = "all", keep = null, onKeep, onBack, onOpen, onShareChat }) {
  const gold = a11y ? "#7A5D2A" : GOLD, ink = T.modTitle.color, sub = T.modSub.color;
  const red = a11y ? "#9A3A2A" : "#E08A7A";
  const dishes = React.useMemo(() => { try { return dishesOf(restaurant) || []; } catch (e) { return []; } }, [restaurant]);
  const dishName = (id) => (dishes.find((d) => d && String(d.id) === String(id)) || {}).name || "";
  const pool = React.useMemo(() => somPool({ wines, spirits, cocktails }), [wines, spirits, cocktails]);
  const has = { wine: pool.some((c) => c.kind === "wine"), spirit: pool.some((c) => c.kind === "spirit"), cocktail: pool.some((c) => c.kind === "cocktail") };
  const kindsN = ["wine", "spirit", "cocktail"].filter((k) => has[k]).length;
  const whats = SOM_WHAT.filter(([k]) => (k === "all" ? kindsN > 1 : has[k])).map(([k]) => k);
  const first = whats.includes(start) ? start : whats[0] || "all";
  const k0 = keep || {};
  const [text, setText0] = React.useState(k0.text || "");
  const [what, setWhat] = React.useState(k0.what && whats.includes(k0.what) ? k0.what : first);
  const [sub2, setSub] = React.useState("");          // открытый ряд: dish | budget | like
  const [res, setRes] = React.useState(k0.res || null);
  const [seen, setSeen] = React.useState(k0.seen || []);
  const [busy, setBusy] = React.useState("");
  const [msg, setMsg] = React.useState("");
  const taRef = React.useRef(null);
  const textRef = React.useRef(text); textRef.current = text;
  const ctx = { dishes, wines, spirits };
  React.useEffect(() => { if (onKeep) onKeep({ text, what, res, seen }); }, [text, what, res, seen]);
  // в просьбе названо одно («виски», «красное») — вид переключается сам; можно поменять руками
  const setText = (v, typed = true) => {
    setText0(v); setMsg("");
    if (!typed) return;
    const a = somAsk(v, ctx);
    if (a.kinds.length === 1 && whats.includes(a.kinds[0])) setWhat(a.kinds[0]);
    else if (a.kinds.length > 1 && whats.includes("all")) setWhat("all");
  };
  const on = somOn(text);
  const ask = React.useMemo(() => somAsk(text, ctx), [text, dishes, wines, spirits]);
  const steps = React.useMemo(() => somBudgetSteps(pool, what, ask.glass), [pool, what, ask.glass]);
  const dishOpts = React.useMemo(() => dishOptions(dishes, pool), [dishes, pool]);
  const likeOpts = React.useMemo(() => likeOptions(pool), [pool]);
  const kinds = kindsFor(what, ask);
  const glassOk = kinds.includes("wine") && pool.some((c) => c.kind === "wine" && c.byGlass);
  const toggle = (key, phrase) => { vibrate("light"); setText(somToggle(text, key, phrase), key === "glass"); };
  const chip = (on2) => ({ padding: "7px 12px", borderRadius: 999, fontSize: 13, cursor: "pointer", border: `1px solid ${on2 ? gold : gold + "44"}`, background: on2 ? "rgba(214,178,102,0.16)" : "transparent",
    color: on2 ? ink : sub, whiteSpace: "nowrap", fontFamily: SERIF, lineHeight: 1.2 });
  const btn = (main) => ({ ...T.doneBtn, margin: 0, padding: "10px 16px", fontSize: 14, flex: main ? "1 1 0" : "0 0 auto", width: "auto", minWidth: 0, background: main ? gold : "transparent", color: main ? "#1A1008" : ink,
    border: main ? "none" : `1px solid ${gold}55`, cursor: "pointer" });

  // подбор: new — с начала, more — без показанных, cheaper — дешевле самой доступной из показанных
  const run = async (how = "new") => {
    if (busy) return;
    const a = somAsk(text, ctx);
    if (askEmpty(a)) { setMsg("Напиши, что хочет гость, или выбери подсказку ниже."); if (taRef.current) taRef.current.focus(); return; }
    vibrate("light"); setMsg(""); setSub("");
    const exclude = how === "new" ? [] : seen;
    const below = how === "cheaper" && res ? cheaperThan(res.picks, a.glass) : 0;
    const sl = somShortlist(pool, a, { what, exclude, below });
    const base = { how, text: a.text, what, total: sl.total, glass: a.glass, at: Date.now() };
    if (!sl.list.length) { setRes({ ...base, picks: [], none: sl.none, mode: "none" }); return; }
    const prompt = somPrompt(a, sl.list, { restaurant, dishName });
    const sent = sl.list.slice(0, promptCount(prompt));
    setBusy(how + ":" + sent.length);
    const r = await askMentor(prompt);
    setBusy("");
    let out;
    if (r.reply) {
      const p = parseSom(r.reply, sent);
      out = p.picks.length ? { ...base, picks: p.picks, mode: "ai", remaining: r.remaining }
        : { ...base, picks: localPicks(sent), mode: "local", err: "none", note: p.note, remaining: r.remaining };
    } else out = { ...base, picks: localPicks(sent), mode: "local", err: r.error };
    setSeen((s) => [...(how === "new" ? [] : s), ...out.picks.map(keyOf)]);
    setRes(out);
    vibrate(out.mode === "ai" ? "success" : "light");
  };
  const reset = () => { vibrate("light"); setText0(""); setRes(null); setSeen([]); setMsg(""); setSub(""); if (taRef.current) taRef.current.focus(); };
  // есть ли ещё что показать и есть ли дешевле — по той же просьбе
  const more = React.useMemo(() => {
    if (!res || !res.picks || !res.picks.length) return { more: 0, cheaper: 0 };
    const a = somAsk(res.text, ctx);
    const m = somShortlist(pool, a, { what: res.what, exclude: seen }).total;
    const cap = cheaperThan(res.picks, a.glass);
    const ch = cap ? somShortlist(pool, a, { what: res.what, below: cap }).total : 0;
    return { more: m, cheaper: ch };
  }, [res, seen, pool]);

  const busyN = busy ? Number(busy.split(":")[1]) || 0 : 0;
  const Pick = ({ p }) => {
    const K = p.kind === "spirit" ? SPIRIT : WINE;
    const open = () => { vibrate("light"); onOpen(p.kind, p.id); };
    const share = onShareChat ? () => onShareChat(p.kind === "cocktail" ? cocktailShareItem(p.rec) : drinkShareItem(K, p.rec)) : null;
    return (
      <div data-som-pick={keyOf(p)} data-lens-card="" style={{ ...T.modCard, display: "block", cursor: "default", padding: "12px 14px", margin: "0 0 10px" }}>
        <div data-som-open={keyOf(p)} onClick={open} {...onActivate(open)} style={{ cursor: "pointer" }}>
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            {p.kind === "cocktail" ? (Array.isArray(p.rec.color) ? <div aria-hidden="true" style={{ width: 38, height: 52, flexShrink: 0, display: "flex", alignItems: "flex-end", justifyContent: "center" }}><CocktailArt c={p.rec} w={38} light={a11y} showIce={false} /></div> : null)
              : <WineThumb w={p.rec} gold={gold} a11y={a11y} />}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ ...labelStyle(12), color: gold, marginBottom: 1 }}>{SOM_KIND_RU[p.kind]}</div>
              <div style={{ fontFamily: SERIF, fontSize: 16, color: ink, lineHeight: 1.28 }}>{p.title}</div>
              {p.orig ? <div style={{ fontFamily: SERIF, fontStyle: "italic", fontSize: 12.5, color: sub, lineHeight: 1.35 }}>{p.orig}</div> : null}
              {p.line ? <div style={{ fontSize: 12.5, color: sub, lineHeight: 1.4, marginTop: 2 }}>{p.line}</div> : null}
              {p.priceText ? <div data-som-price="" style={{ fontSize: 13, color: gold, lineHeight: 1.4, marginTop: 2 }}>{p.priceText}</div> : null}
            </div>
            <Chevron gold={gold} />
          </div>
          {p.why ? <div data-som-why="" style={{ fontSize: 13.5, color: ink, lineHeight: 1.5, marginTop: 9 }}><span style={{ ...labelStyle(13.5), color: gold }}>Почему: </span>{p.why}</div> : null}
          {p.say ? <div data-som-say="" style={{ fontFamily: SERIF, fontStyle: "italic", fontSize: 14, color: ink, lineHeight: 1.5, marginTop: 7, padding: "8px 11px", borderRadius: 10,
            background: a11y ? "rgba(139,106,48,0.07)" : "rgba(214,178,102,0.08)", borderLeft: `2px solid ${gold}99` }}>{"Гостю: «" + p.say + "»"}</div> : null}
        </div>
        {share ? <div style={{ marginTop: 10 }}><ShareChat id={keyOf(p)} onClick={share} gold={gold} text={ink} /></div> : null}
      </div>);
  };
  const subRow = (key, items) => (
    <div role="group" aria-label={key === "dish" ? "К блюду" : key === "budget" ? "Бюджет" : "Похоже на"} data-som-sub={key} style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8, padding: "8px 0 0", borderTop: `1px dashed ${gold}33` }}>
      {items.map(([label, phrase]) => { const sel = new RegExp("(^|,\\s*)" + phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "(\\s*,|$)", "i").test(text);
        return <button key={phrase} type="button" className="sa-btn" data-som-opt={phrase} aria-pressed={sel} data-lens-btn={sel ? "tab" : "soft"} data-lens-ink="" onClick={() => { toggle(key, phrase); if (!sel) setSub(""); }} style={chip(sel)}>{label}</button>; })}
    </div>);
  const quick = [
    dishOpts.length ? ["dish", "К блюду", on.dish, () => { vibrate("light"); setSub((s) => (s === "dish" ? "" : "dish")); }] : null,
    glassOk ? ["glass", "Бокалом", on.glass, () => toggle("glass", "бокалом")] : null,
    steps ? ["budget", "Бюджет", on.budget, () => { vibrate("light"); setSub((s) => (s === "budget" ? "" : "budget")); }] : null,
    kinds.includes("wine") && has.wine ? ["like", "Похоже на…", on.like, () => { vibrate("light"); setSub((s) => (s === "like" ? "" : "like")); }] : null,
    ...SOM_OCC.map(([k, label]) => ["occ-" + k, label, text.toLowerCase().includes(label.toLowerCase()), () => toggle("occasion", label.toLowerCase())]),
  ].filter(Boolean);
  const leftN = res && typeof res.remaining === "number" && res.remaining >= 0 ? res.remaining : -1;
  return (
    <div style={T.screen} className="sa-screen" data-som={what}>
      <div style={{ padding: "16px 16px 6px", display: "flex", alignItems: "center", gap: 10 }}>
        <button className="sa-btn" data-lens="back" onClick={onBack} {...onActivate(onBack)} aria-label="Назад" style={{ border: "none", background: "transparent", color: gold, fontSize: 21, cursor: "pointer", padding: "4px 8px 4px 0" }}>‹</button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ ...labelStyle(13.5), color: gold }}>Барная карта · Наставник</div>
          <div style={{ fontFamily: SERIF, fontSize: 21, color: ink, lineHeight: 1.15 }}>Сомелье</div>
        </div>
      </div>
      <div style={{ padding: "0 16px 140px" }}>
        <div style={{ fontSize: 13.5, color: sub, lineHeight: 1.5, margin: "2px 2px 12px" }}>Напиши или скажи, что хочет гость. Подберу 2–3 позиции только из нашей карты: не из стопа и в бюджете.</div>
        {whats.length > 1 ? (
          <div role="group" aria-label="Что подобрать" data-som-whats={whats.join(",")} style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
            {whats.map((k) => <button key={k} type="button" className="sa-btn" data-som-what={k} aria-pressed={what === k} data-lens-btn={what === k ? "tab" : "soft"} data-lens-ink=""
              onClick={() => { vibrate("light"); setWhat(k); }} style={chip(what === k)}>{(SOM_WHAT.find(([x]) => x === k) || [])[1]}</button>)}
          </div>) : null}
        <div data-lens-card="" onClick={() => taRef.current && taRef.current.focus()} style={{ ...T.modCard, display: "flex", alignItems: "flex-end", gap: 8, padding: "8px 8px 8px 13px", margin: 0, cursor: "text" }}>
          <textarea ref={taRef} data-som-text="" rows={2} value={text} maxLength={300} aria-label="Что хочет гость" placeholder={"Например: к рибаю, сухое красное, до 5\u00A0000"}
            onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); run("new"); } }}
            style={{ flex: 1, minWidth: 0, resize: "none", border: "none", outline: "none", background: "transparent", color: ink, fontFamily: SERIF, fontSize: 15.5, lineHeight: 1.45, padding: "4px 0", minHeight: 46 }} />
          <MicButton a11y={a11y} size={38} sttUrl={SUPABASE_URL + "/functions/v1/stt"} headers={H()} onText={(x) => { const a = String(textRef.current || "").trim(), b = String(x || "").trim(); setText((a && b ? a + " " + b : a || b).slice(0, 300)); }} onError={(m) => setMsg(m)} />
        </div>
        <div role="group" aria-label="Быстрые просьбы" data-som-chips="" style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 10 }}>
          {quick.map(([k, label, sel, act]) => <button key={k} type="button" className="sa-btn" data-som-chip={k} aria-pressed={!!sel} aria-expanded={k === "dish" || k === "budget" || k === "like" ? sub2 === k : undefined}
            data-lens-btn={sel || sub2 === k ? "tab" : "soft"} data-lens-ink="" onClick={act} style={chip(sel || sub2 === k)}>{label}</button>)}
        </div>
        {sub2 === "dish" ? subRow("dish", dishOpts.map((d) => [cutName(d.name), "к «" + d.name + "»"])) : null}
        {sub2 === "budget" && steps ? subRow("budget", [0, 1, 2].map((i) => [budgetPhrase(i, steps), budgetPhrase(i, steps)])) : null}
        {sub2 === "like" ? subRow("like", likeOpts.map((nm) => [nm, "похоже на " + nm])) : null}
        <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
          <button type="button" className="sa-btn" data-lens-btn="main" data-som-go="" onClick={() => run("new")} disabled={!!busy} style={{ ...btn(true), opacity: busy ? 0.65 : 1 }}>{busy && busy.startsWith("new") ? "Подбираю…" : "Подобрать"}</button>
          {text || res ? <button type="button" className="sa-btn" data-lens-btn="soft" data-lens-ink="" data-som-new="" onClick={reset} disabled={!!busy} style={btn(false)}>Заново</button> : null}
        </div>
        {msg ? <div role="status" data-som-msg="" style={{ fontSize: 13, color: red, lineHeight: 1.5, margin: "10px 2px 0" }}>{msg}</div> : null}
        {busy ? <div role="status" data-som-busy={busyN} style={{ fontSize: 13, color: gold, lineHeight: 1.5, margin: "12px 2px 0" }}>{"Наставник выбирает из " + posWord(busyN) + " нашей карты…"}</div> : null}
        {res && !busy ? (
          <div data-som-res={res.mode} data-som-n={res.picks.length} data-som-at={res.at || 0} style={{ marginTop: 18 }}>
            {res.mode === "none" ? <div data-som-none="" data-lens-card="" style={{ ...T.modCard, display: "block", cursor: "default", padding: "12px 14px", fontSize: 14, color: ink, lineHeight: 1.5 }}>{res.none}</div> : <>
              <div data-som-label="" style={{ ...labelStyle(14), color: gold, margin: "0 2px 8px" }}>{res.mode === "ai" ? (res.how === "cheaper" ? "Подешевле" : res.how === "more" ? "Ещё варианты" : "Сомелье советует") : "Ближе всего по карте"}</div>
              {res.mode === "local" ? <div data-som-err={res.err || ""} style={{ fontSize: 12.5, color: sub, lineHeight: 1.5, margin: "0 2px 10px" }}>
                {res.err === "none" && res.note ? <span data-som-note="">{"Наставник: «" + res.note + "» "}</span> : null}{LOCAL_WHY[res.err] || LOCAL_ANY}</div> : null}
              {res.picks.map((p) => <Pick key={keyOf(p)} p={p} />)}
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 4 }}>
                {more.more ? <button type="button" className="sa-btn" data-lens-btn="soft" data-lens-ink="" data-som-more={more.more} onClick={() => run("more")} style={btn(false)}>Ещё варианты</button> : null}
                {more.cheaper ? <button type="button" className="sa-btn" data-lens-btn="soft" data-lens-ink="" data-som-cheaper={more.cheaper} onClick={() => run("cheaper")} style={btn(false)}>Подешевле</button> : null}
              </div>
            </>}
            <div data-som-foot="" style={{ fontSize: 12.5, color: sub, lineHeight: 1.5, margin: "12px 2px 0" }}>
              {"Под просьбу в нашей карте: " + posWord(res.total) + ". Стоп и архив не предлагаю."}
              {leftN >= 0 ? <span data-som-left={leftN}>{" У Наставника сегодня осталось " + leftN + " " + plural(leftN, "вопрос", "вопроса", "вопросов") + ": подбор считается как вопрос."}</span> : null}
            </div>
          </div>) : null}
      </div>
    </div>);
}
