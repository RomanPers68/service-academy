// ui/league.jsx — Доп. 317: «Лига недели» и «Кубок заведений». v31 — доработки.
//
// Каждую неделю — с нуля: очки за занятия с понедельника, а не за стаж, поэтому новичок
// соревнуется наравне со «старичками». Два вида, как у рейтинга: «в заведении» и «во всей сети».
// «Кубок заведений» — средние очки на человека: маленький ресторан на равных с большим.
// Данные — сервер (этап 24: league_week). Свои очки видны и без сервера — по журналу дня.
// v31 (этап 25): подиум, стрелки «как неделю назад», «до места — N очков: это 2 живых гостя»,
// итоги прошлой недели и победы, нарисованный кубок и сколько недель он у заведения.
import React from "react";
import { rpc, saToken, rpcMissing } from "../api/supabase";
import { PlaceCard, MasterMark } from "./screens-gamification";
import { GOLD, goldText } from "./tokens";
import { onActivate, vibrate } from "../lib/utils";
import { POINTS, weekPoints, weekStart } from "../lib/activity";
import { useHintOnce, HintBubble } from "./widgets";
import { hintsFor } from "../data/hints";
import { masterRolesOf } from "../lib/mastery";
import { serverMissing } from "../lib/server-text";   // v58 (Доп. 371): без «этап 24» у сотрудника

const MEDAL = ["#E8C56A", "#C9C9C9", "#C89A6E"];
const MEDAL_LIGHT = ["#B8902E", "#7E8790", "#A0643A"];
const POS = { waiter: "официант", hostess: "хостес", bartender: "бармен", senior_bartender: "ст. бармен", manager: "менеджер", senior: "руководитель" };
const WHAT = [["l", "урок"], ["p", "практика"], ["q", "тест"], ["d", "живой диалог"], ["b", "сборка"], ["w", "разминка"], ["g", "живой гость"], ["u", "освежить тему"],
  ["o", "раунд мастера на золото"], ["k", "зачёт на опыт"], ["x", "экзамен"], ["m", "тренажёр"], ["r", "выпуск радио"], ["f", "исправленная ошибка"], ["s", "ситуация у стола"]];
function plural(n, a, b, c) { const m10 = n % 10, m100 = n % 100; if (m10 === 1 && m100 !== 11) return a; if (m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20)) return b; return c; }

// «До места — 35 очков: это 2 живых гостя или 4 урока»
export function gapWords(gap) {
  const g = Math.max(0, Math.ceil(Number(gap) || 0));
  if (!g) return "";
  const guests = Math.ceil(g / POINTS.g), lessons = Math.ceil(g / POINTS.l);
  return guests + " " + plural(guests, "живой гость", "живых гостя", "живых гостей") + (lessons !== guests ? " или " + lessons + " " + plural(lessons, "урок", "урока", "уроков") : "");
}
// стрелка: место сейчас против места неделю назад (по итогам прошлой недели)
export function moveOf(cur, prev) {
  if (!prev || !cur) return null;
  const d = prev - cur;
  return d > 0 ? { up: true, n: d } : d < 0 ? { up: false, n: -d } : { same: true };
}
// сколько недель подряд кубок у одного заведения (история — свежие первыми). Неделя без
// записи (лигу тогда никто не подвёл) серию прерывает — «подряд» значит подряд (ревью v31)
export function cupStreak(hist = []) {
  if (!hist.length) return null;
  const r = hist[0].restaurant; let n = 0, prev = null;
  const t = (w) => { const d = String(w || "").split("-").map(Number); return d.length === 3 ? Date.UTC(d[0], d[1] - 1, d[2]) : NaN; };
  for (const h of hist) {
    if (h.restaurant !== r) break;
    const cur = t(h.week_start);
    if (prev != null && !(prev - cur === 7 * 86400000)) break;
    n++; prev = cur;
  }
  return { restaurant: r, weeks: n };
}
// v40: «Мастер роли ✦» у имени в лиге — роли мастера (или null). masters — mastersIndex(строки mastery_list):
// там мастера только своего заведения, поэтому знак — только у строк своего заведения. Своя строка
// («ты» на подиуме) — по имени из профиля.
export function leagueMasterRoles(masters, r, profile) {
  if (!masters || !r) return null;
  const myRest = (profile && profile.restaurant) || "";
  if (!myRest || (r.restaurant || "") !== myRest) return null;
  const who = r.me && profile ? profile : r;
  return masterRolesOf(masters, who.name, who.surname);
}

function CupArt({ size = 56, color = "#E8C56A", a11y = false }) {
  const c = a11y ? "#8A6410" : color;
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true" focusable="false">
      <defs><linearGradient id="cupg" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor={a11y ? "#D9B65C" : "#F6DE95"} /><stop offset="1" stopColor={a11y ? "#9C7420" : "#B8902E"} /></linearGradient></defs>
      <path d="M18 8h28v10c0 9-6 16-14 16S18 27 18 18z" fill="url(#cupg)" stroke={c} strokeWidth="1.5" />
      <path d="M18 12H10c0 7 4 11 9 12M46 12h8c0 7-4 11-9 12" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" />
      <path d="M29 34h6v8h-6z" fill="url(#cupg)" stroke={c} strokeWidth="1.2" />
      <path d="M22 42h20l3 8H19z" fill="url(#cupg)" stroke={c} strokeWidth="1.2" strokeLinejoin="round" />
      <path d="M32 13l1.6 3.3 3.6.5-2.6 2.5.6 3.6-3.2-1.7-3.2 1.7.6-3.6-2.6-2.5 3.6-.5z" fill={a11y ? "#FFF6DC" : "#FFF3D0"} opacity=".9" />
    </svg>
  );
}

export function LeagueScreen({ T, a11y, profile, activity = {}, onBack, masters = null }) {
  const [st, setSt] = React.useState({ status: "loading" });
  const [scope, setScopeRaw] = React.useState(() => { try { return localStorage.getItem("sa_lg_scope") === "net" ? "net" : "rest"; } catch (e) { return "rest"; } });
  const [how, setHow] = React.useState(false);
  const [hint, hintDone] = useHintOnce("league");
  const [hstep, setHstep] = React.useState(0);
  const hsteps = hintsFor("league");
  const setScope = (v) => { vibrate("light"); setScopeRaw(v); try { localStorage.setItem("sa_lg_scope", v); } catch (e) {} };
  const load = React.useCallback(() => {
    setSt((s) => ({ ...s, status: s.status === "ok" ? "ok" : "loading" }));
    rpc("league_week", { p_token: saToken() }).then((r) => {
      if (rpcMissing(r)) setSt({ status: "missing" });
      else if (r && r.ok) setSt({ status: "ok", ...r });
      else setSt({ status: "error" });
    }).catch(() => setSt({ status: "offline" }));
  }, []);
  React.useEffect(() => { load(); }, [load]);
  const gold = goldText(a11y);
  const medal = a11y ? MEDAL_LIGHT : MEDAL;
  const text = T.modTitle.color, sub = T.modSub.color;
  const myRest = (profile && profile.restaurant) || "";
  const rows = st.status === "ok" ? st.rows || [] : [];
  const restRows = rows.filter((r) => (r.restaurant || "") === myRest);
  const restCount = st.status === "ok" ? (st.cup || []).length : 0;
  const twoScopes = !!myRest && restCount > 1;
  const view = twoScopes ? (scope === "net" ? rows : restRows) : rows;
  const meIdx = (list) => list.findIndex((r) => r.me);
  const myRow = rows.find((r) => r.me);
  const localPts = weekPoints(activity);
  // своё — не меньше того, что видит телефон; но если сервер сверяет уроки и тесты со своими
  // записями (verified), место считаем по серверу, как его видят все (ревью v31)
  const verified = st.status === "ok" && !!st.verified;
  const myPts = myRow ? (verified ? myRow.pts : Math.max(myRow.pts, localPts)) : localPts;
  const phoneExtra = verified && myRow && localPts > myRow.pts ? localPts - myRow.pts : 0;
  const now = new Date();
  const left = 6 - ((now.getDay() + 6) % 7);
  const ws = weekStart(now);
  const card = { background: a11y ? "rgba(250,242,222,0.55)" : "rgba(226,186,116,0.06)", border: `1px solid ${GOLD}44`, borderRadius: 14, padding: "12px 14px", marginBottom: 12 };
  // место в текущем виде: с учётом своих очков с телефона
  const ptsOf = (r) => (r.me ? myPts : r.pts);
  const sorted = [...view].sort((a, b) => ptsOf(b) - ptsOf(a));
  const myI = meIdx(sorted);
  const ahead = myI > 0 ? sorted[myI - 1] : null;
  const gap = ahead ? ptsOf(ahead) - myPts + 1 : 0;
  const prevKey = scope === "net" || !twoScopes ? "prev_net" : "prev_rest";
  const mePrev = st.status === "ok" ? st.me_prev : null;
  const wins = st.status === "ok" && st.wins ? st.wins : null;
  const cs = st.status === "ok" ? cupStreak(st.cup_hist || []) : null;
  const podium = sorted.filter((r) => ptsOf(r) > 0).slice(0, 3);
  const mv = (r, i) => moveOf(i + 1, r[prevKey]);
  const arrow = (m) => !m ? null : m.same ? <span style={{ color: sub, fontSize: 11 }} aria-label="место то же">=</span>
    : <span style={{ color: m.up ? (a11y ? "#2F6B45" : "#8FB890") : (a11y ? "#8F3520" : "#E0A08A"), fontSize: 11, fontFamily: "monospace" }} aria-label={(m.up ? "выше на " : "ниже на ") + m.n}>{m.up ? "▲" : "▼"}{m.n}</span>;
  return (
    <div style={T.screen} className="sa-screen">
      <div style={{ ...T.lessHead, justifyContent: "space-between" }}>
        <button className="sa-hit" style={T.backBtn2} aria-label="Назад" onClick={onBack}>‹</button>
        <div style={{ ...T.lessHeadTitle, display: "flex", alignItems: "center", gap: 8 }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={GOLD} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.4l-5.2 2.7 1-5.8L3.5 9.2l5.9-.9z" /></svg>
          <span>Лига недели</span></div>
        <div style={{ width: 24 }} />
      </div>
      <div style={{ padding: "12px 16px 100px" }}>
        {hint && hsteps.length ? <HintBubble a11y={!!T.a11y} text={hsteps[hstep]} arrow="up" step={hstep + 1} total={hsteps.length}
          onNext={hstep >= hsteps.length - 1 ? null : () => setHstep((v) => v + 1)} onClose={hintDone} /> : null}
        <div style={card}>
          <div style={{ fontSize: 11, letterSpacing: 1.6, color: gold, fontFamily: "monospace" }}>НЕДЕЛЯ С {ws.getDate()}.{String(ws.getMonth() + 1).padStart(2, "0")} · {left ? "ДО ФИНАЛА " + left + " " + plural(left, "ДЕНЬ", "ДНЯ", "ДНЕЙ").toUpperCase() : "ФИНАЛ СЕГОДНЯ"}</div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginTop: 6 }}>
            <span style={{ fontFamily: "Georgia, serif", fontSize: 30, fontWeight: "bold", color: text }}>{myPts}</span>
            <span style={{ fontSize: 13, color: sub }}>{plural(myPts, "очко", "очка", "очков")} у тебя{myRow && myRow.days ? " · " + myRow.days + " " + plural(myRow.days, "день", "дня", "дней") + " в деле" : ""}</span>
          </div>
          {phoneExtra ? <div style={{ fontSize: 12, color: sub, marginTop: 4, lineHeight: 1.45 }} data-phone-extra="">Телефон насчитал {localPts} — в лиге считаются уроки и тесты, записанные на сервере (повторы того же урока очков не прибавляют).</div> : null}
          {ahead ? <div style={{ fontSize: 13, color: text, marginTop: 6, lineHeight: 1.45 }} role="status">До {myI}-го места — {gap} {plural(gap, "очко", "очка", "очков")}: это {gapWords(gap)}.</div>
            : myI === 0 && myPts > 0 ? <div style={{ fontSize: 13, color: text, marginTop: 6 }} role="status">Ты первый(ая) {scope === "net" && twoScopes ? "во всей сети" : twoScopes ? "в заведении" : ""} ✦ Держи темп до воскресенья.</div> : null}
          <div style={{ fontSize: 12.5, color: sub, marginTop: 4, lineHeight: 1.45 }}>Очки — за занятия, а не за стаж: каждую неделю все начинают с нуля.</div>
          <button type="button" onClick={() => setHow((v) => !v)} aria-expanded={how} style={{ marginTop: 8, padding: 0, border: 0, background: "none", color: gold, font: "700 12.5px Georgia, serif", cursor: "pointer" }}>{how ? "Скрыть" : "За что очки ›"}</button>
          {how ? (
            <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: "3px 12px", marginTop: 8, fontSize: 12.5, color: sub }}>
              {WHAT.map(([k, w]) => <React.Fragment key={k}><span>{w}</span><b style={{ color: text, fontVariantNumeric: "tabular-nums" }}>+{POINTS[k]}</b></React.Fragment>)}
              <span style={{ gridColumn: "1/-1", marginTop: 4 }}>Не больше 200 очков в день.{st.verified ? " Уроки и тесты сверяются с записями сервера." : ""}</span>
            </div>
          ) : null}
        </div>
        {st.status === "loading" ? <div style={{ color: sub, fontSize: 13.5, padding: "10px 2px" }}>Загружаю лигу…</div> : null}
        {st.status === "missing" ? <div style={{ ...card, color: sub, fontSize: 13.5 }}>{serverMissing({ what: "общая лига", admin: !!(profile && profile.is_admin), sql: "supabase-stage24-together.sql" })} Свои очки уже считаются.</div> : null}
        {st.status === "offline" || st.status === "error" ? (
          <div style={{ ...card, color: sub, fontSize: 13.5 }}>Нет связи с сервером. <button type="button" onClick={load} style={{ border: 0, background: "none", color: gold, font: "700 13px Georgia, serif", cursor: "pointer" }}>Ещё раз</button></div>
        ) : null}
        {st.status === "ok" ? (
          <>
            {twoScopes ? <PlaceCard T={T} tabLabel="лига недели" rest={myRest} restIdx={meIdx([...restRows].sort((a, b) => ptsOf(b) - ptsOf(a)))} restN={restRows.length} netIdx={meIdx([...rows].sort((a, b) => ptsOf(b) - ptsOf(a)))} netN={rows.length} netR={restCount} scope={scope} onScope={setScope} /> : null}
            {mePrev || (wins && (wins.rest || wins.net)) ? (
              <div style={{ ...card, display: "flex", alignItems: "center", gap: 10 }} role="group" aria-label="Прошлая неделя">
                <CupArt size={30} a11y={a11y} />
                <span style={{ flex: 1, minWidth: 0, fontSize: 12.5, color: sub, lineHeight: 1.45 }}>
                  {mePrev ? <>Прошлая неделя: <b style={{ color: text }}>{mePrev.rank_rest}-е место</b> в заведении{twoScopes && mePrev.rank_net ? ", " + mePrev.rank_net + "-е в сети" : ""} · {mePrev.pts} {plural(mePrev.pts, "очко", "очка", "очков")}</> : "На прошлой неделе очков не было"}
                  {wins && (wins.rest || wins.net) ? <><br />Побед недели: в заведении — {wins.rest}{twoScopes ? ", в сети — " + wins.net : ""} ✦</> : null}
                </span>
              </div>
            ) : null}
            {podium.length >= 2 ? (
              <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "center", gap: 8, margin: "4px 0 14px" }} role="group" aria-label="Подиум недели">
                {[1, 0, 2].filter((k) => podium[k]).map((k) => {
                  const r = podium[k]; const h = [74, 56, 44][k];
                  const nameSt = { fontSize: 12.5, color: r.me ? text : sub, fontWeight: r.me ? "bold" : "normal", textAlign: "center", maxWidth: "100%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" };
                  const nm = r.me ? "ты" : r.name + (r.surname ? " " + r.surname[0] + "." : "");
                  const mr = leagueMasterRoles(masters, r, profile);   // v40: «Мастер роли ✦» после имени
                  return (
                    <div key={r.id} style={{ flex: "0 1 110px", minWidth: 0, display: "flex", flexDirection: "column", alignItems: "center" }}>
                      {mr ? (
                        <div style={{ ...nameSt, display: "flex", alignItems: "center", justifyContent: "center", gap: 3 }}>
                          <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis" }}>{nm}</span><MasterMark roles={mr} a11y={a11y} size={12} />
                        </div>
                      ) : <div style={nameSt}>{nm}</div>}
                      <div style={{ fontFamily: "Georgia, serif", fontSize: 15, fontWeight: "bold", color: gold }}>{ptsOf(r)}</div>
                      <div style={{ width: "100%", height: h, marginTop: 4, borderRadius: "10px 10px 4px 4px", display: "grid", placeItems: "center",
                        background: `linear-gradient(180deg, ${medal[k]}55, ${medal[k]}18)`, borderTop: `1px solid ${medal[k]}99`, borderLeft: `1px solid ${medal[k]}99`, borderRight: `1px solid ${medal[k]}99`, borderBottom: "none",
                        fontFamily: "Georgia, serif", fontSize: 22, fontWeight: "bold", color: medal[k] }}>{k + 1}</div>
                    </div>
                  );
                })}
              </div>
            ) : null}
            {view.length === 0 ? <div style={{ color: sub, fontSize: 13.5, padding: "10px 2px" }}>На этой неделе пока никто не занимался — первые очки твои.</div> : null}
            <div role="list" aria-label="Лига недели">
              {sorted.slice(0, 100).map((r, i) => {
                const med = medal[i];
                const m = mv(r, i);
                const mr = leagueMasterRoles(masters, r, profile);   // v40: «Мастер роли ✦» после имени
                return (
                  <div key={r.id} role="listitem" style={{ ...T.modCard, marginBottom: 8, gap: 12, alignItems: "center", ...(r.me ? { boxShadow: `inset 0 0 0 1.5px ${GOLD}AA` } : null) }}>
                    <div style={{ width: 27, height: 27, borderRadius: "50%", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12.5, fontWeight: "bold",
                      color: med || text, background: med ? med + "33" : "transparent", border: `1.5px solid ${med ? med + "99" : (T.modSub.color + "55")}` }}>{i + 1}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ ...T.modTitle, display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>{mr ? (
                        <><span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.name} {r.surname}</span><MasterMark roles={mr} a11y={a11y} />{r.me ? <span style={{ whiteSpace: "nowrap", flexShrink: 0 }}>· ты</span> : null}</>
                      ) : <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.name} {r.surname}{r.me ? " · ты" : ""}</span>}{arrow(m)}</div>
                      <div style={{ color: sub, fontSize: 12.5 }}>{[POS[r.position] || "", scope === "net" || !twoScopes ? r.restaurant : "", r.days ? r.days + " " + plural(r.days, "день", "дня", "дней") : ""].filter(Boolean).join(" · ")}</div>
                    </div>
                    <div style={{ textAlign: "right", flexShrink: 0 }}>
                      <div style={{ color: gold, fontFamily: "Georgia, serif", fontSize: 19, fontWeight: "bold", lineHeight: 1 }}>{ptsOf(r)}</div>
                      <div style={{ color: sub, fontSize: 10.5 }}>очков</div>
                    </div>
                  </div>
                );
              })}
            </div>
            {restCount > 1 ? (
              <div style={{ ...card, marginTop: 16 }} role="group" aria-label="Кубок заведений">
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <CupArt a11y={a11y} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 11, letterSpacing: 1.6, color: gold, fontFamily: "monospace" }}>КУБОК ЗАВЕДЕНИЙ · ОЧКИ НА ЧЕЛОВЕКА</div>
                    <div style={{ fontSize: 12.5, color: sub, marginTop: 4, lineHeight: 1.45 }}>{cs && cs.restaurant ? <>Кубок у «{cs.restaurant}» — {cs.weeks} {plural(cs.weeks, "неделю", "недели", "недель")} подряд. </> : null}Средние очки на сотрудника — маленькое заведение на равных с большим.</div>
                  </div>
                </div>
                {(st.cup || []).map((c, i) => {
                  const m = moveOf(i + 1, c.prev_rank);
                  return (
                    <div key={c.restaurant} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 0", borderTop: i ? `1px solid ${GOLD}22` : "none", marginTop: i ? 0 : 8 }}>
                      <span style={{ width: 22, textAlign: "center", fontWeight: "bold", color: medal[i] || sub }}>{i + 1}</span>
                      <span style={{ flex: 1, minWidth: 0 }}>
                        <span style={{ display: "flex", alignItems: "center", gap: 6, fontFamily: "Georgia, serif", fontSize: 15, color: text }}>{c.restaurant}{c.mine ? " · ваше" : ""}{arrow(m)}</span>
                        <span style={{ display: "block", fontSize: 12, color: sub }}>занимаются {c.active} из {c.people}</span>
                      </span>
                      <span style={{ fontFamily: "Georgia, serif", fontSize: 18, fontWeight: "bold", color: gold }}>{String(c.avg).replace(".", ",")}</span>
                    </div>
                  );
                })}
                {(st.cup_hist || []).length > 1 ? (
                  <div style={{ fontSize: 11.5, color: sub, marginTop: 8, lineHeight: 1.5 }}>История кубка: {(st.cup_hist || []).slice(0, 6).map((h) => { const d = String(h.week_start || "").split("-"); return d[2] + "." + d[1] + " — " + h.restaurant; }).join(" · ")}</div>
                ) : null}
              </div>
            ) : null}
          </>
        ) : null}
      </div>
    </div>
  );
}

export default LeagueScreen;
