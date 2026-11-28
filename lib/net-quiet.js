// lib/net-quiet.js — v226 (Доп. 552): пока идёт видео-знакомство, вся связь — ему.
//
// Владелец (29.11, запись с ярлыка на iPhone): «Теперь видео очень долго грузит». С v224 приложение само берёт заранее фото
// уроков, кружки команды и фото меню — по три сразу. Если в это время человек открывает ролик (или ролик качается заранее,
// lib/intro-warm.js), фото делят с ним связь, и ролик стоит на круге ожидания. Теперь ролик «занимает» сеть: плеер — пока
// открыт, заготовка ролика — пока качается (holdNet), а фото заранее перед каждым следующим файлом ждут, когда сеть
// освободится (netFree). Что человек открыл сам (экран с фото), не ждёт: сюда идёт только «заранее».

let busy = 0;
let waiters = [];

/** Занята ли связь роликом */
export const netBusy = () => busy > 0;

/** Ролик занял связь. → отпустить() (повторный вызов — ничего) */
export function holdNet() {
  busy++;
  let done = false;
  return () => {
    if (done) return;
    done = true;
    busy = Math.max(0, busy - 1);
    if (!busy) { const w = waiters; waiters = []; for (const f of w) f(); }
  };
}

/** Дождаться свободной связи: сразу, если свободна; дольше maxMs не ждём (вдруг ролик забыли отпустить) */
export function netFree(maxMs = 60000) {
  if (!busy) return Promise.resolve();
  return new Promise((res) => {
    let t = 0;
    const go = () => { clearTimeout(t); waiters = waiters.filter((f) => f !== go); res(); };
    waiters.push(go);
    t = setTimeout(go, maxMs);
  });
}

/** Для проверок: всё отпустить */
export function resetNetQuiet() { busy = 0; const w = waiters; waiters = []; for (const f of w) f(); }
