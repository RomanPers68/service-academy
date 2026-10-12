// lib/sfx.js — тихие звуки урока «у стола» (Доп. 290).
// Синтез на Web Audio: никаких файлов, ничего не грузится из сети.
//   ok   — звон бокалов (верно)
//   bad  — глухой стук (неверно)
//   tap  — короткий щелчок (выбор)
//   done — колокольчик раздачи (итог)
//   tick — тихий тик (последние 5 секунд раунда мастера, v31)
// Выключатель — в шапке урока, помнится в sa_sfx ("0" — выключено).
// На iPhone звук сам молчит при беззвучном режиме (Web Audio — «фоновая» категория).

const KEY = "sa_sfx";
let ctx = null;

export function sfxOn() {
  try { return localStorage.getItem(KEY) !== "0"; } catch (e) { return true; }
}

export function setSfx(on) {
  try { localStorage.setItem(KEY, on ? "1" : "0"); } catch (e) {}
}

function ac() {
  if (typeof window === "undefined") return null;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  if (!ctx) { try { ctx = new AC(); } catch (e) { ctx = null; } }
  if (ctx && ctx.state === "suspended") { try { ctx.resume(); } catch (e) {} }
  return ctx;
}

// Один «удар»: синус с быстрой атакой и экспоненциальным затуханием
function ping(c, t0, freq, dur, vol, type) {
  const o = c.createOscillator(), g = c.createGain();
  o.type = type || "sine";
  o.frequency.setValueAtTime(freq, t0);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(vol, t0 + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g); g.connect(c.destination);
  o.start(t0); o.stop(t0 + dur + 0.02);
  return o;
}

export function sfx(name) {
  if (!sfxOn()) return;
  const c = ac();
  if (!c) return;
  try {
    const t = c.currentTime + 0.01;
    if (name === "tap") { ping(c, t, 880, 0.05, 0.03); return; }
    if (name === "tick") { ping(c, t, 1240, 0.035, 0.022, "square"); return; }   // v31: последние секунды раунда мастера
    if (name === "ok") {
      // два бокала: основной тон и обертон, второй чуть выше и позже
      ping(c, t, 1568, 0.38, 0.05); ping(c, t, 3136, 0.22, 0.018);
      ping(c, t + 0.075, 2093, 0.42, 0.045); ping(c, t + 0.075, 4186, 0.2, 0.012);
      return;
    }
    if (name === "bad") {
      const o = ping(c, t, 196, 0.2, 0.07, "triangle");
      try { o.frequency.exponentialRampToValueAtTime(130, t + 0.18); } catch (e) {}
      return;
    }
    if (name === "done") {
      ping(c, t, 1319, 1.1, 0.06); ping(c, t, 2637, 0.6, 0.02); ping(c, t, 3951, 0.35, 0.008);
      return;
    }
  } catch (e) {}
}
