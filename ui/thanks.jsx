// ui/thanks.jsx — v84 (Доп. 397): «Спасибо от гостей».
//
// ThanksScreen — «Я» → «Спасибо от гостей»: свой QR (гость сканирует и говорит спасибо лично тебе), «Поделиться
// ссылкой», «Картинка для печати», сколько спасибо за неделю, месяц и всего, последние с отметками и словами гостя;
// «Сменить QR» — старый код перестаёт работать. Руководителю и старшему — вкладка «Команда»: кого и за что благодарят,
// неуместный текст можно скрыть. Сервер — этап 34; без него экран честно говорит, что этапа нет.
// v86 (Доп. 399): «Показать гостю» — QR на весь экран на светлом фоне, экран не гаснет, пока он открыт; руководителю во
// вкладке «Команда» — «Отзывы о заведении»: ссылки на Яндекс Карты, 2ГИС, Google Карты (этап 36), их гость видит
// после «Спасибо передано».
import React from "react";
import { createPortal } from "react-dom";
import { vibrate } from "../lib/utils";
import { labelStyle } from "./tokens";
import { rpc, saToken, rpcMissing } from "../api/supabase";
import { qrMatrix, qrPath } from "../lib/qr";
import { tagLabel, thanksUrl, posLabel, tagsLine, reviewKind, REVIEW_KINDS } from "../lib/guest-thanks";

const MONTHS = ["января", "февраля", "марта", "апреля", "мая", "июня", "июля", "августа", "сентября", "октября", "ноября", "декабря"];
const dayOf = (iso) => { const d = new Date(iso || 0); return isNaN(d) ? "" : d.getDate() + " " + MONTHS[d.getMonth()]; };
const C = (a11y) => ({
  gold: a11y ? "#7A5D2A" : "#D2A85A",
  text: a11y ? "#2A1F0E" : "#EFE4C8",
  sub: a11y ? "#6B5B40" : "#A99A7C",
  line: a11y ? "rgba(139,106,48,0.28)" : "rgba(214,178,102,0.22)",
  red: a11y ? "#A0412F" : "#E08A7A",
  frost: {
    background: a11y ? "rgba(250,242,222,0.62)" : "rgba(226,186,116,0.09)",
    border: a11y ? "1px solid rgba(139,106,48,0.30)" : "1px solid rgba(255,255,255,0.13)",
    boxShadow: a11y ? "inset 0 0 26px rgba(255,255,255,0.55), 0 6px 18px rgba(120,85,25,0.14)" : "inset 0 0 26px rgba(255,248,230,0.07), 0 8px 24px rgba(0,0,0,0.45)",
    borderRadius: 18,
  },
});
const INK = "#22170A", PAPER = "#F7F0E1";   // QR — тёмным по светлому: так его читает любая камера
const btn = (c, main) => ({ padding: "12px 14px", borderRadius: 16, fontFamily: "Georgia, serif", fontSize: 14.5, cursor: "pointer",
  ...(main ? { border: 0, background: c.gold, color: "#1A1008", fontWeight: "bold" } : { border: `1px solid ${c.gold}`, background: "transparent", color: c.text }) });

/** Картинка для печати: заведение, QR, имя и должность, «Наведите камеру…». PNG через canvas. */
export function drawThanksCard(canvas, { url, name, pos, restaurant }) {
  const W = 1080, H = 1440, ctx = canvas.getContext("2d");
  canvas.width = W; canvas.height = H;
  ctx.fillStyle = PAPER; ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = "#B8924A"; ctx.lineWidth = 6; ctx.strokeRect(40, 40, W - 80, H - 80);
  ctx.textAlign = "center"; ctx.fillStyle = "#8B6A30";
  ctx.font = "italic 44px Georgia, serif"; ctx.fillText(restaurant || "Service Academy", W / 2, 150);
  ctx.fillStyle = INK; ctx.font = "84px Georgia, serif"; ctx.fillText("Скажите спасибо", W / 2, 270);
  const qr = qrMatrix(url, { ecl: "M" });
  if (qr) {
    const Q = 4, n = qr.size + 2 * Q, box = 700, s = Math.floor(box / n), x0 = (W - s * n) / 2, y0 = 340;
    ctx.fillStyle = "#FFFFFF"; ctx.fillRect(x0, y0, s * n, s * n);
    ctx.fillStyle = INK;
    qr.modules.forEach((row, y) => row.forEach((d, x) => { if (d) ctx.fillRect(x0 + (x + Q) * s, y0 + (y + Q) * s, s, s); }));
  }
  ctx.fillStyle = INK; ctx.font = "76px Georgia, serif"; ctx.fillText(name || "", W / 2, 1160);
  if (pos) { ctx.fillStyle = "#8B6A30"; ctx.font = "italic 44px Georgia, serif"; ctx.fillText(pos, W / 2, 1230); }
  ctx.fillStyle = "#5A4628"; ctx.font = "38px Georgia, serif"; ctx.fillText("Наведите камеру телефона на код", W / 2, 1320);
  return canvas;
}

function QrCard({ c, url, name, pos, restaurant }) {
  const qr = React.useMemo(() => qrMatrix(url, { ecl: "M" }), [url]);
  if (!qr) return null;
  const n = qr.size + 8;
  return (
    <div data-thanks-qr="" data-qr-version={qr.version} style={{ background: PAPER, borderRadius: 20, padding: "18px 18px 16px", textAlign: "center", boxShadow: "0 10px 26px rgba(0,0,0,0.35)" }}>
      <div style={{ fontStyle: "italic", fontSize: 14, color: "#8B6A30" }}>{restaurant}</div>
      <div style={{ fontFamily: "Georgia, serif", fontSize: 20, color: INK, margin: "4px 0 10px" }}>Скажите спасибо</div>
      <svg viewBox={"0 0 " + n + " " + n} width="100%" style={{ maxWidth: 260, display: "block", margin: "0 auto", background: "#fff", borderRadius: 6 }}
        shapeRendering="crispEdges" role="img" aria-label={"QR-код: спасибо для " + (name || "сотрудника")}>
        <path d={qrPath(qr, 4)} fill={INK} />
      </svg>
      <div style={{ fontFamily: "Georgia, serif", fontSize: 22, color: INK, marginTop: 10 }}>{name}</div>
      {pos ? <div style={{ fontStyle: "italic", fontSize: 14, color: "#8B6A30" }}>{pos}</div> : null}
    </div>
  );
}

const portal = (el) => (typeof document !== "undefined" && document.body && document.body.nodeType === 1 ? createPortal(el, document.body) : el);

/** v86: QR на весь экран — показать гостю. Светлый фон (так ярче и камера читает быстрее), экран не гаснет (Wake Lock). */
export function QrFull({ url, name, pos, restaurant, onClose }) {
  const qr = React.useMemo(() => qrMatrix(url, { ecl: "M" }), [url]);
  React.useEffect(() => {
    let lock = null, dead = false;
    const get = () => {
      try {
        if (!navigator.wakeLock || document.visibilityState !== "visible") return;
        navigator.wakeLock.request("screen").then((l) => {
          if (dead) { l.release().catch(() => {}); return; }
          lock = l; try { l.addEventListener("release", () => { lock = null; }); } catch (e) {}
        }).catch(() => {});
      } catch (e) {}
    };
    get();
    const vis = () => { if (document.visibilityState === "visible" && !lock) get(); };   // свёрнутое приложение отпускает «не гаснуть»
    try { document.addEventListener("visibilitychange", vis); } catch (e) {}
    return () => { dead = true; try { document.removeEventListener("visibilitychange", vis); } catch (e) {} try { if (lock) lock.release().catch(() => {}); } catch (e) {} };
  }, []);
  if (!qr) return null;
  const n = qr.size + 8;
  return portal(
    <div data-thanks-full="" role="dialog" aria-modal="true" aria-label="QR для гостя" className="sa-layer"
      style={{ position: "fixed", inset: 0, zIndex: 1100, background: PAPER, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        padding: "max(16px, var(--sa-st, env(safe-area-inset-top, 0px))) 18px calc(18px + env(safe-area-inset-bottom, 0px))", boxSizing: "border-box", fontFamily: "Georgia, serif", textAlign: "center" }}>
      <button type="button" data-sa-back="" aria-label="Закрыть" onClick={onClose}
        style={{ position: "absolute", top: "max(10px, var(--sa-st, env(safe-area-inset-top, 0px)))", right: 12, width: 44, height: 44, border: 0, background: "none", color: "#8B6A30", fontSize: 30, lineHeight: 1, cursor: "pointer" }}>×</button>
      <div style={{ fontStyle: "italic", fontSize: 17, color: "#8B6A30" }}>{restaurant}</div>
      <div style={{ fontSize: 30, color: INK, margin: "6px 0 16px" }}>Скажите спасибо</div>
      <svg viewBox={"0 0 " + n + " " + n} shapeRendering="crispEdges" role="img" aria-label={"QR-код: спасибо для " + (name || "сотрудника")}
        style={{ width: "min(84vw, 56vh)", height: "min(84vw, 56vh)", display: "block", background: "#fff", borderRadius: 8 }}>
        <path d={qrPath(qr, 4)} fill={INK} />
      </svg>
      <div style={{ fontSize: 30, color: INK, marginTop: 16 }}>{name}</div>
      {pos ? <div style={{ fontStyle: "italic", fontSize: 17, color: "#8B6A30" }}>{pos}</div> : null}
      <div style={{ fontSize: 15, color: "#5A4628", marginTop: 12 }}>Наведите камеру телефона на код</div>
    </div>
  );
}

function Mine({ c, a11y, st, profile, onRotate, rotating }) {
  const url = thanksUrl(typeof location !== "undefined" ? location.origin : "", st.code);
  const pos = posLabel(profile && profile.position);
  const [msg, setMsg] = React.useState("");
  const [sure, setSure] = React.useState(false);
  const [full, setFull] = React.useState(false);
  const share = () => {
    vibrate("light");
    const data = { title: "Сказать спасибо", text: "Скажите спасибо: " + (st.name || ""), url };
    if (navigator.share) { navigator.share(data).catch(() => {}); return; }
    try { navigator.clipboard.writeText(url).then(() => setMsg("Ссылка скопирована."), () => setMsg(url)); } catch (e) { setMsg(url); }
  };
  const save = () => {
    vibrate("light");
    try {
      const cv = drawThanksCard(document.createElement("canvas"), { url, name: st.name, pos, restaurant: st.restaurant });
      cv.toBlob((blob) => {
        if (!blob) { setMsg("Не получилось. Сделай снимок экрана с QR."); return; }
        const file = typeof File !== "undefined" ? new File([blob], "spasibo-qr.png", { type: "image/png" }) : null;
        if (file && navigator.canShare && navigator.canShare({ files: [file] })) { navigator.share({ files: [file], title: "QR для гостей" }).catch(() => {}); return; }
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob); a.download = "spasibo-qr.png"; document.body.appendChild(a); a.click();
        setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
        setMsg("Картинка сохранена: распечатай и поставь на стол или стойку. Если не сохранилась, сделай снимок экрана с QR.");
      }, "image/png");
    } catch (e) { setMsg("Не получилось. Сделай снимок экрана с QR."); }
  };
  return (
    <div>
      <QrCard c={c} url={url} name={st.name} pos={pos} restaurant={st.restaurant} />
      <button type="button" data-thanks-show="" onClick={() => { vibrate("light"); setFull(true); }} style={{ ...btn(c, true), width: "100%", marginTop: 12 }}>Показать гостю на весь экран</button>
      <div style={{ fontSize: 13, color: c.sub, lineHeight: 1.5, margin: "12px 2px" }}>Покажи гостю или поставь распечатку на стол: гость наводит камеру и говорит спасибо лично тебе. Без регистрации, за пару секунд.</div>
      <div style={{ display: "flex", gap: 10 }}>
        <button type="button" data-thanks-share="" onClick={share} style={{ ...btn(c), flex: 1 }}>Поделиться ссылкой</button>
        <button type="button" data-thanks-print="" onClick={save} style={{ ...btn(c), flex: 1 }}>Картинка для печати</button>
      </div>
      {msg ? <div role="status" style={{ fontSize: 13, color: c.text, margin: "10px 2px 0", lineHeight: 1.45, wordBreak: "break-all" }}>{msg}</div> : null}
      <div style={{ ...c.frost, padding: "14px 16px", margin: "16px 0 10px", display: "flex", textAlign: "center" }} data-thanks-stats="">
        {[["за неделю", st.week], ["за месяц", st.month], ["всего", st.total]].map(([t, v]) => (
          <div key={t} style={{ flex: 1 }}>
            <div style={{ fontFamily: "Georgia, serif", fontSize: 26, color: c.text }}>{v || 0}</div>
            <div style={{ fontSize: 12, color: c.sub }}>{t}</div>
          </div>))}
      </div>
      {(st.items || []).length ? (st.items || []).map((x) => (
        <div key={x.id} data-thanks-item={x.id} style={{ ...c.frost, padding: "11px 14px", marginBottom: 8 }}>
          <div style={{ ...labelStyle(12.5), color: c.gold }}>{dayOf(x.at)}{(x.tags || []).length ? " · " + x.tags.map((k) => tagLabel(k).toLowerCase()).join(", ") : ""}</div>
          {x.text ? <div style={{ fontFamily: "Georgia, serif", fontSize: 14.5, color: c.text, marginTop: 4, lineHeight: 1.45 }}>«{x.text}»</div>
            : <div style={{ fontSize: 13, color: c.sub, marginTop: 3 }}>Спасибо без слов</div>}
        </div>))
        : <div style={{ fontSize: 13.5, color: c.sub, lineHeight: 1.5, padding: "2px 2px 8px" }}>Пока спасибо нет. Первое придёт, когда гость отсканирует твой QR.</div>}
      <div style={{ marginTop: 16 }}>
        <button type="button" data-thanks-rotate="" disabled={rotating} onClick={() => { if (!sure) { vibrate("light"); setSure(true); return; } setSure(false); onRotate(); }}
          style={{ border: 0, background: "none", color: sure ? c.red : c.sub, fontFamily: "Georgia, serif", fontSize: 13.5, cursor: "pointer", padding: "6px 2px" }}>
          {rotating ? "Меняю…" : sure ? "Старый QR перестанет работать. Нажми ещё раз" : "Сменить QR"}</button>
      </div>
      {full ? <QrFull url={url} name={st.name} pos={pos} restaurant={st.restaurant} onClose={() => setFull(false)} /> : null}
    </div>
  );
}

/** v86: «Отзывы о заведении» — руководителю: ссылки на Яндекс Карты, 2ГИС, Google Карты (этап 36). */
function ReviewLinks({ c, a11y }) {
  const [st, setSt] = React.useState("loading");   // loading | ok | missing | error
  const [vals, setVals] = React.useState(["", ""]);
  const [busy, setBusy] = React.useState(false);
  const [msg, setMsg] = React.useState(null);   // { ok, text }
  React.useEffect(() => {
    let alive = true;
    rpc("review_links", { p_token: saToken() }).then((r) => {
      if (!alive) return;
      if (rpcMissing(r)) { setSt("missing"); return; }
      if (r && r.ok) { const l = (r.links || []).map((x) => String((x && x.url) || "")); setVals([l[0] || "", l[1] || ""]); setSt("ok"); } else setSt("error");
    }).catch(() => alive && setSt("error"));
    return () => { alive = false; };
  }, []);
  if (st === "loading" || st === "error") return null;
  const save = () => {
    const list = vals.map((v) => v.trim()).filter(Boolean);
    const bad = list.find((u) => !reviewKind(u));
    if (bad) { setMsg({ ok: false, text: "Это не страница заведения в Яндекс Картах, 2ГИС или Google Картах: " + bad.slice(0, 60) }); return; }
    if (list.length === 2 && reviewKind(list[0]) === reviewKind(list[1])) { setMsg({ ok: false, text: "Обе ссылки на одни и те же карты. Оставь одну." }); return; }
    setBusy(true); setMsg(null);
    rpc("review_links_set", { p_token: saToken(), p_links: list }).then((r) => {
      setBusy(false);
      if (r && r.ok) { vibrate("success"); setMsg({ ok: true, text: list.length ? "Сохранено. После «Спасибо передано» гость увидит: " + list.map((u) => REVIEW_KINDS[reviewKind(u)]).join(", ") + "." : "Ссылок нет: гость отзыв не увидит." }); }
      else if (r && r.error === "forbidden") setMsg({ ok: false, text: "Ссылки меняет руководитель или старший." });
      else setMsg({ ok: false, text: "Не сохранилось. Проверь ссылки и связь." });
    }).catch(() => { setBusy(false); setMsg({ ok: false, text: "Нет связи. Попробуй ещё раз." }); });
  };
  const field = { width: "100%", boxSizing: "border-box", padding: "10px 12px", borderRadius: 12, border: `1px solid ${c.line}`, background: a11y ? "rgba(255,255,255,0.55)" : "rgba(0,0,0,0.25)",
    color: c.text, fontFamily: "Georgia, serif", fontSize: 13.5, outline: "none", marginBottom: 8 };
  return (
    <div data-review-links="" style={{ ...c.frost, padding: "14px 14px 12px", marginTop: 18 }}>
      <div style={{ ...labelStyle(15), color: c.gold, marginBottom: 6 }}>Отзывы о заведении</div>
      {st === "missing" ? <div style={{ fontSize: 13, color: c.sub, lineHeight: 1.5 }}>Ссылки на отзывы появятся, когда на сервер добавят этап 36 (supabase-stage36-comfort.sql).</div> : <>
        <div style={{ fontSize: 12.5, color: c.sub, lineHeight: 1.5, marginBottom: 10 }}>Ссылка на ваше заведение в Яндекс Картах, 2ГИС или Google Картах. После «Спасибо передано» гость увидит кнопку и, если захочет, оставит отзыв.</div>
        {[0, 1].map((i) => <input key={i} data-review-input={i} value={vals[i]} onChange={(e) => { setMsg(null); const v = e.target.value; setVals((a) => a.map((x, k) => (k === i ? v : x))); }}
          placeholder={i ? "https://2gis.ru/…/firm/…" : "https://yandex.ru/maps/org/…"} inputMode="url" autoCapitalize="off" autoCorrect="off" spellCheck={false} style={field} />)}
        {msg ? <div role={msg.ok ? "status" : "alert"} style={{ fontSize: 12.5, color: msg.ok ? c.text : c.red, lineHeight: 1.45, margin: "0 2px 8px", wordBreak: "break-word" }}>{msg.text}</div> : null}
        <button type="button" data-review-save="" onClick={save} disabled={busy} style={{ ...btn(c), width: "100%", padding: "10px 14px", opacity: busy ? 0.6 : 1 }}>{busy ? "Сохраняю…" : "Сохранить ссылки"}</button>
      </>}
    </div>
  );
}

function Team({ c, a11y }) {
  const [st, setSt] = React.useState({ status: "loading" });
  const load = React.useCallback(() => {
    rpc("thanks_team", { p_token: saToken() }).then((r) => {
      if (rpcMissing(r)) setSt({ status: "missing" });
      else if (r && r.ok) setSt({ status: "ok", ...r });
      else setSt({ status: "error" });
    }).catch(() => setSt({ status: "offline" }));
  }, []);
  React.useEffect(() => { load(); }, [load]);
  const hide = (x) => {
    vibrate("light");
    rpc("thanks_hide", { p_token: saToken(), p_id: x.id, p_hidden: !x.hidden }).then((r) => { if (r && r.ok) load(); }).catch(() => {});
  };
  if (st.status === "loading") return <div style={{ fontSize: 13, color: c.sub, padding: "6px 2px" }}>Загружаю…</div>;
  if (st.status !== "ok") return <div style={{ fontSize: 13.5, color: c.text, padding: "6px 2px" }}>{st.status === "missing" ? "На сервере ещё нет этапа 34." : "Не загрузилось. Проверь связь."}</div>;
  const rows = st.rows || [], items = st.items || [];
  return (
    <div data-thanks-team="">
      <div style={{ ...labelStyle(15), color: c.gold, margin: "4px 2px 10px" }}>Кого благодарят · 30 дней</div>
      {rows.length ? rows.map((r) => (
        <div key={r.emp_id} data-thanks-row={r.emp_id} style={{ ...c.frost, padding: "11px 14px", marginBottom: 8, display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: "Georgia, serif", fontSize: 15.5, color: c.text }}>{r.name || "Сотрудник"}</div>
            {tagsLine(r.tags) ? <div style={{ fontSize: 12.5, color: c.sub, marginTop: 2 }}>{tagsLine(r.tags)}</div> : null}
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontFamily: "Georgia, serif", fontSize: 20, color: c.text }}>{r.week}</div>
            <div style={{ fontSize: 11.5, color: c.sub }}>за неделю · {r.month} за месяц</div>
          </div>
        </div>)) : <div style={{ fontSize: 13.5, color: c.sub, padding: "0 2px 8px", lineHeight: 1.5 }}>За месяц спасибо от гостей пока не было. Чтобы начали, команде нужно показывать свои QR: «Я» → «Спасибо от гостей».</div>}
      {items.length ? <>
        <div style={{ ...labelStyle(15), color: c.gold, margin: "18px 2px 10px" }}>Последние</div>
        {items.map((x) => (
          <div key={x.id} data-thanks-titem={x.id} data-hidden={x.hidden ? "1" : "0"} style={{ ...c.frost, padding: "11px 14px", marginBottom: 8, opacity: x.hidden ? 0.55 : 1 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ ...labelStyle(12.5), color: c.gold, flex: 1 }}>{x.name || "Сотрудник"} · {dayOf(x.at)}{(x.tags || []).length ? " · " + x.tags.map((k) => tagLabel(k).toLowerCase()).join(", ") : ""}</div>
              {x.text ? <button type="button" data-thanks-hide={x.id} onClick={() => hide(x)} style={{ border: 0, background: "none", color: c.sub, fontSize: 12.5, cursor: "pointer", fontFamily: "Georgia, serif" }}>{x.hidden ? "Вернуть" : "Скрыть"}</button> : null}
            </div>
            {x.text ? <div style={{ fontFamily: "Georgia, serif", fontSize: 14.5, color: c.text, marginTop: 4, lineHeight: 1.45 }}>{x.hidden ? "Скрыто: не видно сотруднику и не считается." : "«" + x.text + "»"}</div> : null}
          </div>))}
      </> : null}
      <ReviewLinks c={c} a11y={a11y} />
    </div>
  );
}

export function ThanksScreen({ T, a11y, profile, lead = false, startTab = "mine", onBack, onLoaded }) {
  const c = C(a11y);
  const [tab, setTab] = React.useState(lead && startTab === "team" ? "team" : "mine");
  const [st, setSt] = React.useState({ status: "loading" });
  const [rotating, setRotating] = React.useState(false);
  const load = React.useCallback(() => {
    rpc("my_thanks", { p_token: saToken() }).then((r) => {
      if (rpcMissing(r)) setSt({ status: "missing" });
      else if (r && r.ok && r.code) { setSt({ status: "ok", ...r }); if (onLoaded) onLoaded(r); }
      else setSt({ status: "error" });
    }).catch(() => setSt((s) => (s.status === "ok" ? s : { status: "offline" })));
  }, []);   // eslint-disable-line react-hooks/exhaustive-deps
  React.useEffect(() => { load(); }, [load]);
  const rotate = () => {
    setRotating(true);
    rpc("thanks_rotate", { p_token: saToken() }).then((r) => { setRotating(false); if (r && r.ok) { vibrate("success"); load(); } }).catch(() => setRotating(false));
  };
  const tabBtn = (k, t) => (
    <button key={k} type="button" role="tab" aria-selected={tab === k} data-thanks-tab={k} onClick={() => { vibrate("light"); setTab(k); }}
      style={{ flex: 1, padding: "9px 10px", borderRadius: 999, border: `1px solid ${tab === k ? c.gold : c.line}`, background: tab === k ? (a11y ? "rgba(139,106,48,0.18)" : "rgba(200,169,110,0.22)") : "transparent",
        color: tab === k ? c.text : c.sub, fontFamily: "Georgia, serif", fontSize: 14, cursor: "pointer" }}>{t}</button>);
  return (
    <div style={T.screen} className="sa-screen">
      <div style={T.lessHead}>
        <button className="sa-hit" style={T.backBtn2} aria-label="Вернуться" onClick={onBack}>‹</button>
        <div style={T.lessHeadTitle}>Спасибо от гостей</div>
      </div>
      <div style={{ padding: "4px 16px 110px" }}>
        {lead ? <div role="tablist" style={{ display: "flex", gap: 8, marginBottom: 14 }}>{[tabBtn("mine", "Мой QR"), tabBtn("team", "Команда")]}</div> : null}
        {tab === "team" ? <Team c={c} a11y={a11y} /> : <>
          {st.status === "loading" ? <div style={{ fontSize: 13, color: c.sub, padding: "6px 2px" }}>Загружаю…</div> : null}
          {st.status === "missing" ? <div style={{ ...c.frost, padding: "12px 14px", fontSize: 13.5, color: c.text, lineHeight: 1.5 }}>На сервере ещё нет этапа 34 (supabase-stage34-guest-thanks.sql). Когда руководитель его добавит, здесь появится твой QR для гостей.</div> : null}
          {st.status === "offline" || st.status === "error" ? <div style={{ ...c.frost, padding: "12px 14px", fontSize: 13.5, color: c.text, lineHeight: 1.5 }}>Не загрузилось. Проверь связь.
            <button type="button" onClick={() => { setSt({ status: "loading" }); load(); }} style={{ ...btn(c), display: "block", marginTop: 10, padding: "9px 14px" }}>Ещё раз</button></div> : null}
          {st.status === "ok" ? <Mine c={c} a11y={a11y} st={st} profile={profile} onRotate={rotate} rotating={rotating} /> : null}
        </>}
      </div>
    </div>
  );
}

