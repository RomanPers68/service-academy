// lib/use-day.js — v31: то, что App.jsx держал россыпью, — отдельными хуками.
//
// useFreshMarks — свежесть тем, зачёты на опыт и золото (Доп. 313, 315, 316): отсчёт свежести
//   с момента, когда тема впервые пройдена; отпечаток текста своего раздела («обновлено»).
// useDayBrief — сводка дня с сервера одним запросом (этап 25: day_brief): квест смены, свеча
//   на двоих, место в лиге. Без этапа 25 — как раньше: пара отдельным запросом (этап 24),
//   квест карточка грузит сама.
import React from "react";
import { rpc, saToken, rpcMissing } from "../api/supabase";
import { readFresh, saveFresh, syncFresh, fadedList, moduleDone } from "./freshness";
import { readCredits, readGold, canRefresh } from "./marks";

export function useFreshMarks({ profile, storageLoaded, ukP, programModules, completed, quizDone }) {
  const [ver, setVer] = React.useState(0);
  const bumpMarks = React.useCallback(() => setVer((v) => v + 1), []);
  const marks = React.useMemo(() => ({ fresh: readFresh(ukP), credit: readCredits(ukP), gold: readGold(ukP) }), [ukP, ver, completed]);   // eslint-disable-line react-hooks/exhaustive-deps
  // свежесть ведём только у тем, где есть чем освежить (хотя бы 2 задания «у стола»)
  const freshMods = React.useMemo(() => (programModules || []).filter(canRefresh), [programModules]);
  // тема впервые пройдена — отсчёт свежести с этого дня (старых дат прохождения у приложения нет)
  const doneRef = React.useRef(null);
  React.useEffect(() => {
    if (!profile || !storageLoaded || !freshMods.length) return;
    let { map, changed } = syncFresh(readFresh(ukP), freshMods, completed, quizDone);
    // тему прошли целиком заново у тебя на глазах (в раздел добавили урок — и его прошли):
    // текст раздела теперь знаком весь, пометка «обновлено» не нужна (ревью v30). Считается
    // только переход «была видна непройденной → пройдена»: раздел, который просто догрузился
    // с сервера уже пройденным, пометку не теряет.
    const nowDone = new Set(freshMods.filter((m) => moduleDone(m, completed, quizDone)).map((m) => m.id));
    const before = doneRef.current;
    if (before && before.uk === ukP) {
      freshMods.forEach((m) => {
        if (m.rev && nowDone.has(m.id) && before.known.has(m.id) && !before.ids.has(m.id) && map[m.id] && map[m.id].h && map[m.id].h !== m.rev) {
          map = { ...map, [m.id]: { ...map[m.id], h: m.rev } }; changed = true;
        }
      });
    }
    doneRef.current = { uk: ukP, ids: nowDone, known: new Set(freshMods.map((m) => m.id)) };
    if (changed) { saveFresh(ukP, map); setVer((v) => v + 1); }
  }, [profile, storageLoaded, ukP, freshMods, completed, quizDone]);
  const fadedIds = React.useMemo(() => new Set(fadedList(marks.fresh, freshMods, completed, quizDone).map((x) => x.mod.id)), [marks, freshMods, completed, quizDone]);
  return { marks, bumpMarks, freshMods, fadedIds, marksVer: ver };
}

// Строка на главной: напарник уже занимался сегодня, а ты — ещё нет
export function pairLineOf(pairInfo) {
  const p = pairInfo && pairInfo.pair;
  if (!p || !p.partner) return null;
  const pt = p.partner_today || {}, me = p.me_today || {};
  if (!(pt.state === 2 && me.state !== 2)) return null;
  const nm = p.partner.name || "Напарник", fem = /[ая]$/i.test(nm) && !/^(никита|илья|кузьма|фома|лука)$/i.test(nm);
  return { text: nm + (pt.warm ? (fem ? " уже размялась" : " уже размялся") : (fem ? " уже занималась" : " уже занимался")) + " — твоя очередь", warm: !!pt.warm };
}

const BRIEF_GAP = 45000;   // не чаще раза в 45 секунд (кроме «сейчас же»)

export function useDayBrief({ profile, storageLoaded, screen, activity }) {
  const [brief, setBrief] = React.useState(null);        // { quest, pair, league } | { missing: true }
  const [pairInfo, setPairInfo] = React.useState(null);
  const at = React.useRef(0);
  const missing = React.useRef(false);
  // другой человек на том же телефоне (выход без перезагрузки) — сводку прошлого не показываем
  // и ждать 45 секунд не надо (ревью v31)
  const pid = profile ? String(profile.id || profile.name + "|" + (profile.surname || "")) : "";
  const seenPid = React.useRef(pid);
  if (seenPid.current !== pid) { seenPid.current = pid; at.current = 0; }
  React.useEffect(() => { setBrief(null); setPairInfo(null); }, [pid]);
  const refreshDay = React.useCallback((force) => {
    if (!profile) return;
    if (!force && Date.now() - at.current < BRIEF_GAP) return;
    at.current = Date.now();
    const pairOnly = () => rpc("pair_status", { p_token: saToken() }).then((r) => {
      if (r && r.ok) setPairInfo(r); else if (rpcMissing(r)) setPairInfo({ missing: true });
    }).catch(() => {});
    if (missing.current) { pairOnly(); return; }
    rpc("day_brief", { p_token: saToken() }).then((r) => {
      if (rpcMissing(r)) { missing.current = true; setBrief({ missing: true }); pairOnly(); return; }
      if (r && r.ok) {
        setBrief({ quest: r.quest || null, pair: r.pair || null, league: r.league || null, at: Date.now() });
        if (r.pair && r.pair.ok) setPairInfo(r.pair);
      } else {
        setBrief((b) => (b && !b.error && !b.missing ? b : { error: true }));
        // ответ без ok (пустой, не тот формат) — свечу на двоих спросим отдельно, как до этапа 25
        if (!r || typeof r !== "object" || !("ok" in r)) pairOnly();
      }
    }).catch(() => setBrief((b) => (b && !b.error && !b.missing ? b : { error: true })));
  }, [profile]);
  // при входе на главную, «Смену», «Команду» (v31: место в лиге) и «Я» — свежая сводка
  React.useEffect(() => {
    if (profile && storageLoaded && ["roleSelect", "me", "shift", "teamHub"].includes(screen)) refreshDay(false);
  }, [screen, profile, storageLoaded, refreshDay]);
  // после занятия на «Смене» — через 20 секунд (быстрая отметка дня уходит за ~6 секунд)
  React.useEffect(() => {
    if (screen !== "shift" || !profile) return undefined;
    const t = setTimeout(() => refreshDay(true), 20000);
    return () => clearTimeout(t);
  }, [activity, screen]);   // eslint-disable-line react-hooks/exhaustive-deps
  const hasBrief = !!(brief && !brief.missing && !brief.error);
  // pending — сводка ещё едет; ok; missing — нет этапа 25; error — нет связи
  const briefStatus = !brief ? "pending" : brief.missing ? "missing" : brief.error ? "error" : "ok";
  return { brief: hasBrief ? brief : null, briefStatus, briefMissing: briefStatus === "missing", pairInfo, setPairInfo, refreshDay };
}
