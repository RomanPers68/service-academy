// ui/voice-note.jsx — v80 (Доп. 393): голос шефа и сомелье — плеер и запись.
//
// VoicePill — кнопка «▶ Шеф · Алексей · 0:42» с полоской прогресса; играет один звук за раз во всём приложении.
// VoiceRecorder — запись в форме блюда: «Записать» → идёт запись (время, уровень микрофона) → «Послушать» и
// «Сохранить» → файл уходит в облако (voice-upload), в блюде остаётся ссылка. Перезапись заменяет прежний файл.
// v86 (Доп. 399): скорость 1× / 1,5× (одна на все записи, помнит телефон), «прослушано» у каждой записи; в «Голосах
// шефа и сомелье» — плеер внизу экрана: полоса, пауза, назад и вперёд по очереди, скорость; «Только новые».
import React from "react";
import { LineArt } from "./line-art";   // v87: рисунок золотой линией
import { createPortal } from "react-dom";
import { vibrate } from "../lib/utils";
import { labelStyle } from "./tokens";
import { silentUrl } from "../lib/radio-voice";
import { VOICE_KINDS, VOICE_MAX_SEC, canRecord, recordClip, uploadClip, clipTime, dishVoices,
  voiceRate, setVoiceRate, nextRate, rateLabel, heardSet, isHeard, markHeard } from "../lib/voice-note";

// ── Один звук за раз: новый останавливает прежний ─────────────────────────────
// url — ссылка или обещание ссылки (голос произношения сначала спрашивают у сервера). Во втором случае
// элемент <audio> «будится» беззвучным WAV прямо по нажатию: iPhone даёт играть звук только из касания,
// а ответ сервера приходит позже (так же делает радио).
let playing = null;   // { audio, stop }
export function stopVoice() { const p = playing; playing = null; if (p) { try { p.stop(); } catch (e) {} } }
export function playUrl(url, { onStart, onTime, onEnd, onError, rate = 1 } = {}) {
  stopVoice();
  let audio;
  try { audio = new Audio(); } catch (e) { onError && onError(); return null; }
  let ended = false;
  const finish = (done) => { if (ended) return; ended = true; if (playing === me) playing = null; onEnd && onEnd(done); };
  const fail = (why) => { if (ended) return; ended = true; if (playing === me) playing = null; onError && onError(why); };
  // при паузе <audio> ещё раз шлёт timeupdate — снимаем обработчики, чтобы полоска остановленной записи обнулилась
  const me = { audio, stop: () => { audio.ontimeupdate = null; audio.onended = null; audio.onerror = null; try { audio.pause(); } catch (e) {} finish(false); } };
  playing = me;
  audio.preload = "auto";
  const go = (src) => {
    if (ended) return;
    audio.ontimeupdate = () => onTime && onTime(audio.currentTime, audio.duration);
    audio.onended = () => finish(true);
    audio.onerror = () => fail();
    audio.src = src;
    // скорость: defaultPlaybackRate — её не сбрасывает загрузка звука (Chrome возвращает playbackRate к ней)
    if (rate && rate !== 1) { try { audio.defaultPlaybackRate = rate; audio.playbackRate = rate; } catch (e) {} }
    const p = audio.play();
    if (p && p.then) p.then(() => onStart && onStart(), () => fail());
    else onStart && onStart();
  };
  if (url && typeof url.then === "function") {
    const s = silentUrl();
    if (s) { try { audio.src = s; const p = audio.play(); if (p && p.catch) p.catch(() => {}); } catch (e) {} }
    url.then((u) => (u ? go(u) : fail()), (e) => fail(e));
  } else go(url);
  return me;
}

const Ic = {
  play: (c) => <svg width="11" height="11" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4.5v15l13-7.5z" fill={c} /></svg>,
  check: (c) => <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>,
  prev: (c) => <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 5h2.5v14H6zM20 5v14L9.5 12z" fill={c} /></svg>,
  next: (c) => <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true"><path d="M15.5 5H18v14h-2.5zM4 5v14l10.5-7z" fill={c} /></svg>,
  pause: (c) => <svg width="11" height="11" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 4h4v16H6zM14 4h4v16h-4z" fill={c} /></svg>,
  mic: (c) => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3" /></svg>,
};

/** Кнопка-плеер записи. v = { kind, url, sec, name }; label — своя подпись вместо «Шеф · имя». */
export function VoicePill({ v, gold, text, sub, a11y, label, onPlayed, style, heard: heardProp }) {
  const [st, setSt] = React.useState("idle");   // idle | load | play | err
  const [p, setP] = React.useState(0);
  const [heardNow, setHeardNow] = React.useState(false);
  const me = React.useRef(null);
  React.useEffect(() => () => { if (me.current && playing === me.current) stopVoice(); }, []);
  React.useEffect(() => { setSt("idle"); setP(0); }, [v && v.url]);
  if (!v || !v.url) return null;
  const meta = VOICE_KINDS[v.kind] || { label: "Голос", title: "Голос" };
  const toggle = (e) => {
    if (e) { e.stopPropagation(); e.preventDefault(); }
    if (st === "play" || st === "load") { stopVoice(); return; }
    vibrate("light"); setSt("load"); setP(0);
    let far = 0;   // дослушал почти до конца — тоже «прослушано»
    me.current = playUrl(v.url, {
      rate: voiceRate(),
      onStart: () => setSt("play"),
      onTime: (t, d) => { const len = d && isFinite(d) ? d : v.sec; if (len) { far = Math.max(far, t / len); setP(Math.min(1, t / len)); } },
      onEnd: (done) => {
        setSt("idle"); setP(0);
        if ((done || far >= 0.85) && !String(v.url).startsWith("blob:")) { markHeard(v); setHeardNow(true); }
        if (done && onPlayed) onPlayed();
      },
      onError: () => { setSt("err"); setP(0); },
    });
  };
  const on = st === "play" || st === "load";
  const heard = heardProp !== undefined ? heardProp : heardNow || isHeard(v, heardSet());
  // «Шеф · Алексей»; если имя уже начинается со слова «шеф» / «сомелье» — без повтора: «Шеф Алексей»
  const nm = String(v.name || "").trim();
  const txt = label || (!nm ? meta.label : nm.toLowerCase().startsWith(meta.label.toLowerCase()) ? nm.charAt(0).toUpperCase() + nm.slice(1) : meta.label + " · " + nm);
  return (
    <button type="button" onClick={toggle} data-voice={v.kind} data-voice-state={st}
      aria-label={(on ? "Остановить: " : "Слушать: ") + meta.title + (v.name ? ", " + v.name : "") + (heard ? ", прослушано" : "")}
      style={{ position: "relative", overflow: "hidden", display: "inline-flex", alignItems: "center", gap: 8, maxWidth: "100%", padding: "5px 12px 5px 5px",
        borderRadius: 999, border: `1px solid ${gold}${on ? "CC" : "77"}`, background: a11y ? "rgba(255,255,255,0.55)" : "rgba(255,248,230,0.06)",
        color: text, cursor: "pointer", font: "inherit", textAlign: "left", WebkitTapHighlightColor: "transparent", ...style }}>
      <span style={{ width: 26, height: 26, borderRadius: 13, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center",
        border: `1.5px solid ${gold}`, background: on ? gold : "transparent", transition: "background .2s" }}>
        {st === "play" ? Ic.pause(a11y ? "#fff" : "#1A1008") : st === "load" ? <span className="sa-voice-dot" style={{ width: 6, height: 6, borderRadius: 3, background: a11y ? "#fff" : "#1A1008" }} /> : Ic.play(gold)}
      </span>
      <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: 12.5, fontFamily: "Georgia, serif" }}>{txt}</span>
      <span style={{ fontSize: 11, color: st === "err" ? "#D9776A" : sub, flexShrink: 0, fontVariantNumeric: "tabular-nums" }}>{st === "err" ? "не играет" : clipTime(v.sec)}</span>
      {heard && st !== "err" ? <span data-voice-heard="" title="Прослушано" style={{ display: "inline-flex", flexShrink: 0, marginLeft: -2 }}>{Ic.check(gold)}</span> : null}
      <span aria-hidden="true" style={{ position: "absolute", left: 0, bottom: 0, height: 2, width: `${p * 100}%`, background: gold, transition: "width .25s linear" }} />
    </button>
  );
}

/**
 * Запись голоса к блюду в редакторе.
 * value — { url, sec, name, at } или null; onChange(новое значение или null) — форма блюда кладёт его в dish.voice[kind].
 */
export function VoiceRecorder({ kind, value, onChange, restaurant, dishId, gold, red, text, sub, a11y, inputSt }) {
  const meta = VOICE_KINDS[kind];
  const nameKey = "sa_voice_name_" + kind + "_" + (restaurant || "");
  const [name, setName] = React.useState(() => (value && value.name) || (() => { try { return localStorage.getItem(nameKey) || ""; } catch (e) { return ""; } })());
  const [phase, setPhase] = React.useState("idle");   // idle | rec | review | up
  const [sec, setSec] = React.useState(0);
  const [level, setLevel] = React.useState(0);
  const [clip, setClip] = React.useState(null);       // { blob, sec, url }
  const [err, setErr] = React.useState("");
  const rec = React.useRef(null);
  const alive = React.useRef(true);
  // StrictMode в разработке монтирует дважды: «жив» ставим в самом эффекте, а не только при создании ref
  React.useEffect(() => { alive.current = true; return () => { alive.current = false; try { rec.current && rec.current.cancel(); } catch (e) {} }; }, []);
  React.useEffect(() => () => { if (clip && clip.url) try { URL.revokeObjectURL(clip.url); } catch (e) {} }, [clip]);
  const can = canRecord();

  const start = () => {
    setErr(""); setSec(0); setClip(null); stopVoice(); vibrate("medium");
    rec.current = recordClip({
      maxSec: VOICE_MAX_SEC,
      onState: (s) => { if (!alive.current) return; if (s === "rec") setPhase("rec"); else if (s === "idle") setPhase("idle"); },
      onTick: (s) => alive.current && setSec(s),
      onLevel: (l) => alive.current && setLevel(l),
      onDone: ({ blob, sec: s }) => { if (!alive.current) return; setClip({ blob, sec: s, url: URL.createObjectURL(blob) }); setPhase("review"); vibrate("light"); },
      onError: (t) => { if (!alive.current) return; setErr(t); setPhase("idle"); },
    });
  };
  const stop = () => { try { rec.current && rec.current.stop(); } catch (e) {} };
  const cancel = () => { try { rec.current && rec.current.cancel(); } catch (e) {} setPhase("idle"); setSec(0); };
  const save = async () => {
    if (!clip) return;
    stopVoice(); setPhase("up"); setErr("");
    const r = await uploadClip({ restaurant, dishId, kind, blob: clip.blob });
    if (!alive.current) return;
    if (r.ok) {
      const nm = String(name || "").trim().slice(0, 40);
      try { localStorage.setItem(nameKey, nm); } catch (e) {}
      onChange({ url: r.url, sec: clip.sec, name: nm, at: Date.now() });
      setClip(null); setPhase("idle"); vibrate("success");
    } else { setErr("Не сохранилось: " + r.why); setPhase("review"); vibrate("error"); }
  };
  // файл не удаляем сразу: его уберёт уборка после публикации меню (sweepVoices), когда на него никто не ссылается
  const remove = () => { if (!value) return; stopVoice(); onChange(null); vibrate("light"); };

  const btn = (primary, danger) => ({ padding: "8px 14px", borderRadius: 999, fontSize: 12.5, cursor: "pointer", font: "inherit", fontFamily: "Georgia, serif",
    border: `1px solid ${danger ? (red || "#D9776A") + "88" : gold + (primary ? "" : "77")}`,
    background: primary ? `linear-gradient(180deg,#E4C88C,${gold})` : "transparent", color: primary ? "#1A1008" : danger ? (red || "#D9776A") : text });
  const box = { borderRadius: 14, padding: "12px 12px 12px", marginBottom: 10, border: `1px solid ${gold}44`, background: a11y ? "rgba(255,255,255,0.35)" : "rgba(255,248,230,0.04)" };

  return (
    <div style={box} data-voice-rec={kind} data-voice-phase={phase}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 2 }}>
        <span style={{ fontFamily: "Georgia, serif", fontSize: 14, color: text, fontWeight: "bold" }}>{meta.title}</span>
      </div>
      <div style={{ fontSize: 12, color: sub, lineHeight: 1.45, marginBottom: 10 }}>{meta.hint}</div>

      {phase === "rec" ? (
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
            <span className="sa-rec-dot" aria-hidden="true" style={{ width: 10, height: 10, borderRadius: 5, background: red || "#D9776A", flexShrink: 0 }} />
            <span style={{ fontFamily: "Georgia, serif", fontSize: 18, color: text, fontVariantNumeric: "tabular-nums" }}>{clipTime(sec)}</span>
            <span style={{ fontSize: 11, color: sub }}>из {clipTime(VOICE_MAX_SEC)}</span>
            <span aria-hidden="true" style={{ flex: 1, height: 4, borderRadius: 2, background: a11y ? "rgba(139,106,48,0.18)" : "rgba(214,178,102,0.16)", overflow: "hidden" }}>
              <span style={{ display: "block", height: "100%", width: `${Math.round(Math.max(0.04, level) * 100)}%`, background: gold, transition: "width .08s linear" }} />
            </span>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button type="button" onClick={stop} style={{ ...btn(true), flex: 1 }}>Готово</button>
            <button type="button" onClick={cancel} style={btn(false)}>Отмена</button>
          </div>
        </div>
      ) : phase === "review" || phase === "up" ? (
        <div>
          <VoicePill v={{ kind, url: clip && clip.url, sec: clip && clip.sec, name }} gold={gold} text={text} sub={sub} a11y={a11y} label="Послушать, что получилось" style={{ marginBottom: 10 }} />
          <input className="sa-field" value={name} onChange={(e) => setName(e.target.value)} maxLength={40}
            placeholder={kind === "chef" ? "Кто говорит, имя: например, Алексей" : "Кто говорит, имя: например, Мария"}
            style={{ ...inputSt, marginBottom: 10, fontSize: 13.5 }} />
          <div style={{ display: "flex", gap: 8 }}>
            <button type="button" onClick={save} disabled={phase === "up"} style={{ ...btn(true), flex: 1, opacity: phase === "up" ? 0.6 : 1 }}>{phase === "up" ? "Сохраняю…" : value ? "Заменить запись" : "Сохранить"}</button>
            <button type="button" onClick={start} disabled={phase === "up"} style={btn(false)}>Заново</button>
          </div>
        </div>
      ) : value && value.url ? (
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <VoicePill v={{ kind, ...value }} gold={gold} text={text} sub={sub} a11y={a11y} />
          {can && <button type="button" onClick={start} style={btn(false)}>Перезаписать</button>}
          <button type="button" onClick={remove} style={btn(false, true)}>Убрать</button>
        </div>
      ) : can ? (
        <button type="button" onClick={start} style={{ ...btn(false), display: "inline-flex", alignItems: "center", gap: 8 }}>{Ic.mic(gold)} Записать</button>
      ) : (
        <div style={{ fontSize: 12.5, color: sub }}>На этом телефоне запись звука недоступна. Попробуй с другого телефона или из браузера.</div>
      )}
      {err && <div role="alert" style={{ fontSize: 12.5, color: red || "#D9776A", marginTop: 8, lineHeight: 1.45 }}>{err}</div>}
    </div>
  );
}

// Занять «эфир» своим проигрывателем (очередь «слушать подряд»): прежний звук смолкает, а новый плеер — остановит этот
function claimVoice(stop) { stopVoice(); const me = { stop }; playing = me; return me; }

const portal = (el) => (typeof document !== "undefined" && document.body && document.body.nodeType === 1 ? createPortal(el, document.body) : el);

/** «Голоса шефа и сомелье»: все записи меню, по одной или подряд, как подкаст. v86: плеер внизу, скорость, «прослушано». */
export function VoicesList({ T, a11y, gold, dishes = [], Head, glass }) {
  const text = T.modTitle.color, sub = T.modSub.color;
  const items = React.useMemo(() => (dishes || []).filter((d) => d && !d.archived).map((d) => ({ d, voices: dishVoices(d) })).filter((x) => x.voices.length), [dishes]);
  const all = React.useMemo(() => items.flatMap((x) => x.voices.map((v) => ({ d: x.d, v }))), [items]);
  const [heard, setHeard] = React.useState(() => heardSet());
  const [queue, setQueue] = React.useState([]);   // что играет сейчас: все записи или только новые
  const [cur, setCur] = React.useState(-1);
  const [st, setSt] = React.useState("idle");   // idle | load | play | pause
  const [pos, setPos] = React.useState({ t: 0, d: 0 });
  const [rate, setRate] = React.useState(() => voiceRate());
  const aRef = React.useRef(null);
  const meRef = React.useRef(null);
  const qRef = React.useRef([]);
  const fresh = all.filter((q) => !isHeard(q.v, heard));
  const total = all.reduce((s, q) => s + (Number(q.v.sec) || 0), 0);
  const halt = () => { const a = aRef.current; if (a) { a.onended = null; a.onerror = null; a.onplaying = null; a.ontimeupdate = null; try { a.pause(); } catch (e) {} } setCur(-1); setSt("idle"); setPos({ t: 0, d: 0 }); };
  const playAt = (i) => {
    const q = qRef.current;
    if (i < 0 || i >= q.length) { if (meRef.current && playing === meRef.current) playing = null; meRef.current = null; halt(); return; }
    // один и тот же <audio> на всю очередь: iPhone пускает следующую запись без нового касания
    if (!aRef.current) { try { aRef.current = new Audio(); aRef.current.preload = "auto"; } catch (e) { return; } }
    const a = aRef.current;
    if (!meRef.current || playing !== meRef.current) meRef.current = claimVoice(halt);   // пусто и пусто — тоже «не наш эфир»
    setCur(i); setSt("load"); setPos({ t: 0, d: Number(q[i].v.sec) || 0 });
    a.onplaying = () => setSt("play");
    a.ontimeupdate = () => setPos({ t: a.currentTime || 0, d: a.duration && isFinite(a.duration) ? a.duration : Number(q[i].v.sec) || 0 });
    a.onended = () => { markHeard(q[i].v); setHeard(heardSet()); playAt(i + 1); };
    a.onerror = () => playAt(i + 1);
    a.src = q[i].v.url;
    try { const r = voiceRate(); a.defaultPlaybackRate = r; a.playbackRate = r; } catch (e) {}
    const p = a.play(); if (p && p.catch) p.catch(() => halt());
  };
  const start = (list) => { vibrate("light"); qRef.current = list; setQueue(list); playAt(0); };
  const pause = () => { const a = aRef.current; if (!a) return; vibrate("light"); if (st === "pause") { const p = a.play(); if (p && p.catch) p.catch(() => {}); setSt("play"); } else { try { a.pause(); } catch (e) {} setSt("pause"); } };
  const speed = () => { const r = nextRate(rate); vibrate("light"); setRate(r); setVoiceRate(r); const a = aRef.current; if (a) { try { a.defaultPlaybackRate = r; a.playbackRate = r; } catch (e) {} } };
  React.useEffect(() => () => { if (meRef.current && playing === meRef.current) stopVoice(); else halt(); }, []);   // eslint-disable-line react-hooks/exhaustive-deps
  const on = cur >= 0;
  const now = on ? queue[cur] : null;
  const heardCount = all.length - fresh.length;
  const btnRound = (lbl, onClick, icon, dis) => (
    <button type="button" aria-label={lbl} onClick={onClick} disabled={dis} style={{ width: 38, height: 38, borderRadius: 19, border: `1px solid ${gold}88`, background: "transparent", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", opacity: dis ? 0.35 : 1, flexShrink: 0 }}>{icon}</button>);
  return (
    <div style={T.screen} className="sa-screen">
      {Head("Голоса шефа и сомелье")}
      <div style={{ padding: "6px 16px 150px" }}>
        <div style={{ fontSize: 13, color: sub, lineHeight: 1.55, marginBottom: 12 }}>
          Шеф рассказывает о блюдах, сомелье советует, что к ним налить. Своими словами и своим голосом. Слушай по одной записи или подряд, хоть по дороге на смену.
        </div>
        <div style={{ display: "flex", gap: 8, marginBottom: heardCount ? 8 : 14 }}>
          <button type="button" data-voices-all={on ? "on" : "off"} onClick={() => { if (on) stopVoice(); else start(all); }}
            style={{ ...T.doneBtn, flex: 1, margin: 0, background: on ? "transparent" : gold, color: on ? text : "#1A1008", border: `1px solid ${gold}${on ? "AA" : ""}`, display: "flex", alignItems: "center", justifyContent: "center", gap: 10 }}>
            {on ? Ic.pause(text) : Ic.play("#1A1008")}
            <span>{on ? "Стоп" : `Слушать подряд · ${clipTime(total)}`}</span>
          </button>
          {!on && heardCount && fresh.length ? <button type="button" data-voices-new="" onClick={() => start(fresh)}
            style={{ ...T.doneBtn, margin: 0, flex: "0 0 auto", padding: "0 16px", background: "transparent", color: text, border: `1px solid ${gold}AA` }}>Только новые · {fresh.length}</button> : null}
        </div>
        {heardCount ? <div data-voices-heard="" style={{ fontSize: 12.5, color: sub, margin: "0 2px 14px" }}>Прослушано {heardCount} из {all.length}{fresh.length ? "" : ": всё послушал(а)"}</div> : null}
        {items.map(({ d, voices }) => {
          const playingHere = now && now.d === d;
          return (
            <div key={d.id} data-voices-dish={d.id} style={{ ...glass(T), padding: "12px 12px", marginBottom: 10, display: "flex", gap: 12, alignItems: "flex-start", borderColor: playingHere ? gold : undefined }}>
              {d.img ? <img src={d.img} alt="" loading="lazy" decoding="async" style={{ width: 52, height: 52, objectFit: "cover", borderRadius: 12, flexShrink: 0 }} /> : null}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ ...labelStyle(12.5), color: gold, marginBottom: 2 }}>{d.cat || "Блюдо"}</div>
                <div style={{ fontFamily: "Georgia, serif", fontSize: 15.5, color: text, marginBottom: 8, lineHeight: 1.3 }}>{d.name}</div>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 6 }}>
                  {voices.map((v) => <VoicePill key={v.kind} v={v} gold={gold} text={text} sub={sub} a11y={a11y} heard={isHeard(v, heard)} onPlayed={() => setHeard(heardSet())} />)}
                </div>
              </div>
            </div>
          );
        })}
        <LineArt kind="mic" color={gold} size={140} style={{ margin: "28px auto 0", opacity: 0.4 }} />
      </div>
      {/* плеер — порталом, как полоса брифинга: внутри .sa-screen (анимация с transform) fixed прилипает к экрану, а не к окну */}
      {now ? portal(<>
        {/* для экранного диктора — одна строка на запись (не время: оно меняется четыре раза в секунду) */}
        <span data-voices-now="" aria-live="polite" style={{ position: "absolute", width: 1, height: 1, margin: -1, padding: 0, overflow: "hidden", clip: "rect(0 0 0 0)", whiteSpace: "nowrap", border: 0 }}>
          {"Звучит: " + now.d.name + ". " + ((VOICE_KINDS[now.v.kind] || {}).label || "") + (now.v.name ? ", " + now.v.name : "") + ". " + (cur + 1) + " из " + queue.length}</span>
        <div data-voices-player={st} style={{ position: "fixed", left: 0, right: 0, bottom: 0, zIndex: 40, fontFamily: "Georgia, serif",
          padding: "0 14px calc(12px + env(safe-area-inset-bottom, 0px))", background: a11y ? "rgba(245,238,222,0.96)" : "rgba(21,17,11,0.96)", borderTop: `1px solid ${gold}44`,
          boxShadow: "0 -8px 24px rgba(0,0,0,0.35)" }}>
          <div role="progressbar" aria-label="Сколько прослушано" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pos.d ? Math.round((pos.t / pos.d) * 100) : 0}
            style={{ height: 3, margin: "0 -14px 10px", background: `${gold}26` }}>
            <div style={{ height: "100%", width: `${pos.d ? Math.min(100, (pos.t / pos.d) * 100) : 0}%`, background: gold, transition: "width .25s linear" }} />
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, maxWidth: 560, margin: "0 auto" }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, color: text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{now.d.name}</div>
              <div style={{ fontSize: 11.5, color: sub, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", fontVariantNumeric: "tabular-nums" }}>
                {(VOICE_KINDS[now.v.kind] || {}).label}{now.v.name ? " · " + now.v.name : ""} · {st === "load" ? "загружаю" : clipTime(pos.t) + " из " + clipTime(pos.d)} · {cur + 1}/{queue.length}</div>
            </div>
            {btnRound("Предыдущая запись", () => playAt(cur - 1), Ic.prev(gold), cur <= 0)}
            <button type="button" data-voices-pause="" aria-label={st === "pause" ? "Дальше слушать" : "Пауза"} onClick={pause}
              style={{ width: 44, height: 44, borderRadius: 22, border: 0, background: gold, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0 }}>
              {st === "pause" ? Ic.play("#1A1008") : Ic.pause("#1A1008")}</button>
            {btnRound("Следующая запись", () => playAt(cur + 1), Ic.next(gold), cur >= queue.length - 1)}
            <button type="button" data-voices-rate={rate} aria-label={"Скорость: " + rateLabel(rate)} onClick={speed}
              style={{ minWidth: 46, height: 30, borderRadius: 15, border: `1px solid ${gold}88`, background: rate !== 1 ? `${gold}33` : "transparent", color: text, fontFamily: "Georgia, serif", fontSize: 12.5, cursor: "pointer", flexShrink: 0 }}>{rateLabel(rate)}</button>
          </div>
        </div></>) : null}
    </div>
  );
}
