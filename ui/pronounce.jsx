// ui/pronounce.jsx — v80 (Доп. 393): «Как произносить» — названия из меню, винной и барной карты.
//
// SayButton — «послушать»: живой голос с сервера (radio-tts: say — по-русски с ударением, say_o — в оригинале;
//   каждое слово озвучивается один раз и дальше берётся из кэша), без него — голос телефона.
// SayLine — строка «Как произносить» на обороте карточки блюда: ударение, которое записал менеджер, или слова
//   из словаря, найденные в названии.
// PronounceScreen — словарь целиком: поиск, разделы, послушать, повторить и сравнить со своей записью.
// v86 (Доп. 399): «медленно» — тот же голос медленнее; под словом — оно же по слогам, ударный слог заглавными.
import React from "react";
import { vibrate } from "../lib/utils";
import { labelStyle } from "./tokens";
import { liveVoiceAvailable, voiceUrl } from "../lib/radio-voice";
import { stressText, plainText, findPronounce, searchPronounce, hasStress, syllables } from "../lib/pronounce";
import { PRON_CATS } from "../data/pronounce";
import { recordClip, canRecord } from "../lib/voice-note";
import { playUrl, stopVoice } from "./voice-note";

// язык оригинала → голос телефона (если живых голосов нет)
const LANG = { "фр.": "fr-FR", "ит.": "it-IT", "исп.": "es-ES", "катал.": "ca-ES", "нем.": "de-DE", "порт.": "pt-PT", "англ.": "en-US", "яп.": "ja-JP", "венг.": "hu-HU", "нидерл.": "nl-NL", "тайск.": "th-TH", "араб.": "ar-SA", "гавайск.": "en-US" };

// Есть ли живые голоса: спрашиваем один раз (ответ помнит lib/radio-voice), решение по нажатию — без ожидания,
// иначе iPhone не даст включить голос телефона
let live = null;
export function probeLive() { if (live === null) { live = false; liveVoiceAvailable().then((ok) => { live = !!ok; }, () => { live = false; }); } }

function phoneSay(text, lang, onEnd, slow) {
  try {
    const ss = window.speechSynthesis; if (!ss) { onEnd && onEnd(false); return false; }
    ss.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = lang || "ru-RU"; u.rate = slow ? 0.55 : 0.85;
    u.onend = () => onEnd && onEnd(true); u.onerror = () => onEnd && onEnd(false);
    ss.speak(u); return true;
  } catch (e) { onEnd && onEnd(false); return false; }
}

/** Кнопка «послушать». w — слово с разметкой ударения; orig — если задан, звучит оригинал (o) на языке lang;
 *  slow (v86) — медленнее: живой голос на 0,7 скорости, голос телефона — 0,55. */
export function SayButton({ w, o, lang, orig = false, slow = false, gold, sub, a11y, label, size = 30 }) {
  const [st, setSt] = React.useState("idle");   // idle | load | play
  React.useEffect(() => { probeLive(); }, []);
  React.useEffect(() => () => { if (st !== "idle") stopVoice(); }, []);   // eslint-disable-line react-hooks/exhaustive-deps
  const tap = (e) => {
    if (e) { e.stopPropagation(); e.preventDefault(); }
    if (st !== "idle") { stopVoice(); try { window.speechSynthesis && window.speechSynthesis.cancel(); } catch (x) {} setSt("idle"); return; }
    vibrate("light");
    const text = orig ? String(o || "") : stressText(w);
    if (!text) return;
    if (live) {
      setSt("load");
      playUrl(voiceUrl(orig ? "say_o" : "say", text), {
        rate: slow ? 0.7 : 1,
        onStart: () => setSt("play"),
        onEnd: () => setSt("idle"),
        onError: () => { setSt("idle"); live = false; phoneSay(orig ? text : plainText(w), orig ? LANG[lang] : "ru-RU", null, slow); },
      });
    } else {
      setSt("play");
      if (!phoneSay(orig ? text : plainText(w), orig ? LANG[lang] : "ru-RU", () => setSt("idle"), slow)) setSt("idle");
    }
  };
  const on = st !== "idle";
  return (
    <button type="button" onClick={tap} data-say={orig ? "orig" : slow ? "slow" : "ru"} data-say-state={st}
      aria-label={(orig ? "Послушать в оригинале: " + (o || "") : (slow ? "Послушать медленно: " : "Послушать, как произносить: ") + plainText(w))}
      style={{ display: "inline-flex", alignItems: "center", gap: 6, height: size, padding: label ? "0 11px 0 4px" : 0, width: label ? "auto" : size, justifyContent: "center",
        borderRadius: size / 2, border: `1px solid ${gold}${on ? "" : "88"}`, background: on ? gold : "transparent", color: on ? "#1A1008" : sub,
        cursor: "pointer", font: "inherit", fontSize: 11.5, flexShrink: 0, WebkitTapHighlightColor: "transparent" }}>
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={on ? "#1A1008" : gold} strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M11 5 6 9H3v6h3l5 4z" />{on ? <path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13" /> : <path d="M15.5 8.5a5 5 0 0 1 0 7" />}
      </svg>
      {label ? <span style={{ fontFamily: "Georgia, serif" }}>{label}</span> : null}
    </button>
  );
}

/** Что показать «как произносить» для блюда: своё ударение менеджера или слова из словаря. */
export function sayFor(d) {
  if (!d) return [];
  if (String(d.say || "").trim() && hasStress(d.say)) return [{ w: String(d.say).trim(), own: true }];
  return findPronounce(d.name, 2);
}

/** Строка «Как произносить» на обороте карточки блюда. */
export function SayLine({ d, gold, text, sub, a11y }) {
  const items = sayFor(d);
  if (!items.length) return null;
  return (
    <div data-sayline="" style={{ marginTop: 6, marginBottom: 8 }} onClick={(e) => e.stopPropagation()}>
      <div style={{ ...labelStyle(13.5), color: gold, marginBottom: 6 }}>Как произносить</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {items.map((e, k) => (
          <div key={k} style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <span style={{ fontFamily: "Georgia, serif", fontSize: 16, color: text }}>{stressText(e.w)}</span>
            <SayButton w={e.w} gold={gold} sub={sub} a11y={a11y} size={28} />
            {e.o ? <span style={{ fontSize: 12, color: sub, fontStyle: "italic" }}>{e.o}</span> : null}
            {e.o ? <SayButton w={e.w} o={e.o} lang={e.lang} orig gold={gold} sub={sub} a11y={a11y} size={28} label="ориг." /> : null}
          </div>
        ))}
      </div>
    </div>
  );
}

// «Повтори и сравни»: запись себя до 4 секунд → послушать себя и образец
function Repeat({ e, gold, text, sub, a11y, red }) {
  const [st, setSt] = React.useState("idle");   // idle | rec | done
  const [mine, setMine] = React.useState(null);
  const [err, setErr] = React.useState("");
  const rec = React.useRef(null);
  React.useEffect(() => () => { try { rec.current && rec.current.cancel(); } catch (x) {} }, []);
  React.useEffect(() => () => { if (mine) try { URL.revokeObjectURL(mine); } catch (x) {} }, [mine]);
  if (!canRecord()) return null;
  const go = (ev) => {
    ev.stopPropagation();
    if (st === "rec") { try { rec.current && rec.current.stop(); } catch (x) {} return; }
    setErr(""); stopVoice(); vibrate("medium");
    rec.current = recordClip({ maxSec: 4,
      onState: (s) => { if (s === "rec") setSt("rec"); else if (s === "idle") setSt(mine ? "done" : "idle"); },
      onDone: ({ blob }) => { setMine(URL.createObjectURL(blob)); setSt("done"); },
      onError: (t) => setErr(t) });
  };
  const playMine = (ev) => { ev.stopPropagation(); if (mine) playUrl(mine, {}); };
  const pill = (on) => ({ display: "inline-flex", alignItems: "center", gap: 6, height: 30, padding: "0 12px", borderRadius: 15, cursor: "pointer", font: "inherit", fontSize: 11.5, fontFamily: "Georgia, serif",
    border: `1px solid ${on ? (red || "#D9776A") : gold + "88"}`, background: on ? "rgba(217,119,106,0.14)" : "transparent", color: on ? (red || "#D9776A") : sub });
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
      <button type="button" data-repeat={st} onClick={go} style={pill(st === "rec")} aria-label={st === "rec" ? "Остановить запись" : "Повторить за голосом: записать себя"}>
        {st === "rec" ? <span className="sa-rec-dot" style={{ width: 8, height: 8, borderRadius: 4, background: red || "#D9776A" }} /> : null}
        {st === "rec" ? "стоп" : mine ? "ещё раз" : "повторить"}
      </button>
      {mine && st !== "rec" ? <button type="button" data-repeat-mine="" onClick={playMine} style={pill(false)}>я</button> : null}
      {err ? <span style={{ fontSize: 11, color: red || "#D9776A" }}>{err}</span> : null}
    </span>
  );
}

/** Экран «Как произносить»: словарь + свои названия меню. */
export function PronounceScreen({ T, a11y, gold, dishes = [], Head, glass }) {
  const text = T.modTitle.color, sub = T.modSub.color, red = "#D9776A";
  React.useEffect(() => { probeLive(); return () => stopVoice(); }, []);
  // свои названия: ударение от менеджера или словарные слова в названии блюда
  const own = React.useMemo(() => {
    const out = [], seen = new Set();
    for (const d of dishes) {
      if (!d || d.archived) continue;
      for (const e of sayFor(d)) {
        const k = plainText(e.w).toLowerCase();
        if (seen.has(k)) continue; seen.add(k);
        out.push({ ...e, dish: d.name });
      }
    }
    return out;
  }, [dishes]);
  const [cat, setCat] = React.useState(own.length ? "menu" : "wine");
  const [q, setQ] = React.useState("");
  // поиск — по всему сразу: свои названия и весь словарь (без разделов)
  const qq = q.trim().toLowerCase().replace(/ё/g, "е");
  const hitOwn = (e) => [plainText(e.w), e.dish, e.o].some((s) => String(s || "").toLowerCase().replace(/ё/g, "е").includes(qq));
  const list = qq
    ? (() => { const mine = own.filter(hitOwn), seen = new Set(mine.map((e) => plainText(e.w).toLowerCase()));
        return [...mine, ...searchPronounce(qq, "").filter((e) => !seen.has(plainText(e.w).toLowerCase()))]; })()
    : cat === "menu" ? own : searchPronounce("", cat);
  const chip = (on) => ({ padding: "6px 12px", borderRadius: 999, fontSize: 12.5, cursor: "pointer", flexShrink: 0, whiteSpace: "nowrap", font: "inherit", fontFamily: "Georgia, serif",
    border: `1px solid ${on ? gold : gold + "55"}`, background: on ? `linear-gradient(180deg,#E4C88C,${gold})` : "transparent", color: on ? "#1A1008" : sub });
  const cats = [...(own.length ? [{ id: "menu", label: "Наше меню" }] : []), ...PRON_CATS];
  return (
    <div style={T.screen} className="sa-screen">
      {Head("Как произносить")}
      <div style={{ padding: "6px 16px 0" }}>
        <div style={{ fontSize: 12.5, color: sub, lineHeight: 1.5, marginBottom: 10 }}>
          Знак над гласной показывает ударение, ниже слово по слогам: ударный слог заглавными. Динамик включает голос, «медленно» повторит его не спеша, «ориг.» звучит на языке оригинала, «повторить» запишет тебя, чтобы сравнить.
        </div>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Найти: шардоне, burrata, апероль…" className="sa-field"
          style={{ width: "100%", boxSizing: "border-box", padding: "10px 13px", borderRadius: 12, border: `1px solid ${gold}66`, background: a11y ? "rgba(255,255,255,0.55)" : "rgba(0,0,0,0.25)", color: text, fontFamily: "Georgia, serif", fontSize: 14, outline: "none", marginBottom: 10 }} />
        <div className="sa-hscroll" style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 4, WebkitOverflowScrolling: "touch" }}>
          {cats.map((c) => <button type="button" key={c.id} data-pron-cat={c.id} style={chip(!q && cat === c.id)} onClick={() => { setCat(c.id); setQ(""); vibrate("light"); }}>{c.label}</button>)}
        </div>
      </div>
      <div style={{ padding: "8px 16px 100px" }}>
        {!list.length ? (
          <div style={{ textAlign: "center", color: sub, fontSize: 13, padding: "24px 8px", lineHeight: 1.5 }}>
            {q ? "Такого слова в словаре нет. Как произносить свои блюда, менеджер пишет в карточке блюда." : "Пока пусто."}
          </div>
        ) : list.map((e, i) => (
          <div key={(e.w || "") + i} data-pron-item="" style={{ ...glass(T), padding: "12px 14px", marginBottom: 8 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div data-pron-word="" style={{ fontFamily: "Georgia, serif", fontSize: 19, color: text, lineHeight: 1.25 }}>{stressText(e.w)}</div>
                {syllables(e.w) ? <div data-pron-syll="" aria-label={"По слогам: " + syllables(e.w)} style={{ fontSize: 13, color: gold, letterSpacing: 0.6, marginTop: 2 }}>{syllables(e.w)}</div> : null}
                <div style={{ fontSize: 12, color: sub, marginTop: 2 }}>
                  {e.o ? <><i>{e.o}</i>{e.lang ? " · " + e.lang : ""}</> : null}
                  {e.dish && cat === "menu" ? <>{e.o ? " · " : ""}в блюде «{e.dish}»</> : null}
                </div>
              </div>
              <SayButton w={e.w} gold={gold} sub={sub} a11y={a11y} size={34} />
            </div>
            {e.tip ? <div style={{ fontSize: 12.5, color: T.para?.color || text, marginTop: 6, lineHeight: 1.45 }}>{e.tip}</div> : null}
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
              {e.o ? <SayButton w={e.w} o={e.o} lang={e.lang} orig gold={gold} sub={sub} a11y={a11y} label="ориг." /> : null}
              <SayButton w={e.w} slow gold={gold} sub={sub} a11y={a11y} label="медленно" />
              <Repeat e={e} gold={gold} text={text} sub={sub} a11y={a11y} red={red} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
