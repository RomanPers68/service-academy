// lib/utils.js
// Чистые утилиты: нормализация, перемешивание, выборка, виброотдача.
// Из App.jsx (строки 5, 4177–4217, 4234–4252).

export const normSurname = (s) => (!s || s === "EMPTY") ? "" : s;

export function shuffleArray(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}


// Лучший результат по каждому квизу для каждого игрока — перепрохождение не накручивает средний %
export function dedupeBestScores(list) {
  const best = {};
  list.forEach(s => {
    const key = `${s.name}|${s.surname}|${s.quiz_id || s.quizTitle || s.id}`;
    if (!best[key] || s.pct > best[key].pct) best[key] = s;
  });
  return Object.values(best);
}

export function pickRandom(arr, n) {
  const seen = new Set();
  const result = [];
  for (const item of shuffleArray(arr)) {
    const key = item.scene || item.statement || item.question || JSON.stringify(item).slice(0, 60);
    if (!seen.has(key)) {
      seen.add(key);
      result.push(item);
      if (result.length >= n) break;
    }
  }
  return result;
}
export function shuffleSituationOptions(sit) {
  if (sit.genre === "hotspot") return sit;
  if (sit.genre === "truefalse") return sit;
  if (!sit.options || sit.options.length === 0) return sit;
  const indexed = sit.options.map((text, i) => ({ text, isCorrect: i === sit.correct }));
  const shuffled = shuffleArray(indexed);
  return { ...sit, options: shuffled.map(o => o.text), correct: shuffled.findIndex(o => o.isCorrect) };
}

// Мы правда внутри Telegram? Скрипт telegram-web-app.js подключён в index.html
// безусловно, поэтому в APK (TWA) и в обычном браузере он всё равно создаёт
// window.Telegram.WebApp вместе с объектом HapticFeedback. Проверка «есть ли
// HapticFeedback» из-за этого проходила ВСЕГДА: вызывалась пустышка, а до
// navigator.vibrate дело не доходило — отсюда «на андроиде нет отдачи».
// Настоящий признак Telegram — непустая initData либо платформа, отличная от
// "unknown": вне клиента оба поля пустые.
const inTelegram = () => {
  try {
    const tg = window.Telegram && window.Telegram.WebApp;
    if (!tg || !tg.HapticFeedback) return false;
    const plat = tg.platform || "unknown";
    return !!(tg.initData && tg.initData.length) || (plat !== "unknown" && plat !== "");
  } catch (e) { return false; }
};

export const vibrate = (pattern) => {
  try {
    if (inTelegram()) {
      // Telegram haptic API
      const H = window.Telegram.WebApp.HapticFeedback;
      if (pattern === "success") H.notificationOccurred("success");
      else if (pattern === "error") H.notificationOccurred("error");
      else if (pattern === "light") H.impactOccurred("light");
      else if (pattern === "medium") H.impactOccurred("medium");
      else if (pattern === "heavy") H.impactOccurred("heavy");
    } else if (typeof navigator !== "undefined" && navigator.vibrate) {
      // Web Vibration API — работает в Chrome и в APK, но требует разрешения
      // android.permission.VIBRATE в манифесте приложения (см. CHANGES)
      if (pattern === "success") navigator.vibrate([40, 30, 80]);
      else if (pattern === "error") navigator.vibrate([80, 40, 80, 40, 80]);
      else if (pattern === "light") navigator.vibrate(20);
      else if (pattern === "medium") navigator.vibrate(40);
      else if (pattern === "heavy") navigator.vibrate([60, 30, 60]);
    } else {
      iosSwitchHaptic(pattern);
    }
  } catch(e) {}
};

// Доп. 183: отдача в Safari / на экране «Домой» iPhone. У Safari нет API вибрации, но
// системный переключатель <input type="checkbox" switch> при переключении даёт лёгкий
// «тик» (iOS 17.4+). Дёргаем скрытый переключатель в момент тапа. Одиночный тик —
// light/medium, два — heavy, три — success/error. Срабатывает только внутри жеста
// пользователя — ровно там, где вызывается vibrate(). Где переключателя нет — тишина.
let _hapticSwitch = null;
function iosSwitchHaptic(pattern) {
  if (typeof document === "undefined") return;
  if (!/iPhone|iPad|iPod/i.test(navigator.userAgent || "")) return;
  if (!_hapticSwitch) {
    const label = document.createElement("label");
    label.setAttribute("aria-hidden", "true");
    label.style.cssText = "position:fixed;left:-200px;top:-200px;width:44px;height:44px;overflow:hidden;pointer-events:none";
    const input = document.createElement("input");
    input.type = "checkbox"; input.setAttribute("switch", "");
    label.appendChild(input); document.body.appendChild(label);
    _hapticSwitch = { label, input, supported: "switch" in input || input.hasAttribute("switch") };
  }
  // Первый тик — синхронно, внутри жеста (иначе iOS молчит: даже setTimeout(0) выводит из жеста).
  // Дополнительные тики — с задержкой; система их может не дать, это нормально.
  const n = pattern === "heavy" ? 2 : (pattern === "success" || pattern === "error") ? 3 : 1;
  try { _hapticSwitch.input.click(); } catch (e) {}
  for (let i = 1; i < n; i++) setTimeout(() => { try { _hapticSwitch.input.click(); } catch (e) {} }, i * 70);
}

// Доступность: делает кликабельный элемент управляемым с клавиатуры (Enter/Space)
// и озвучиваемым скринридером как кнопка. Вид не меняется. Применение:
//   <div onClick={fn} {...onActivate(fn)} style={...}>
// Если обработчик не задан (undefined) — ничего не добавляет (элемент не фокусируется).
export const onActivate = (handler) => (handler ? {
  role: "button",
  tabIndex: 0,
  onKeyDown: (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); handler(e); } },
} : {});

// Перемешивание вариантов вопроса теста/экзамена с пересчётом индекса правильного.
// Принимает { options: [...], correct: number }, возвращает копию с новым порядком.
// Все места сверяют ответ с полем correct того же объекта, поэтому логика не ломается.
export function shuffleQuizOptions(q) {
  if (!q || !Array.isArray(q.options) || typeof q.correct !== "number" || q.options.length < 2) return q;
  const indexed = q.options.map((text, i) => ({ text, isCorrect: i === q.correct }));
  const shuffled = shuffleArray(indexed);
  return { ...q, options: shuffled.map(o => o.text), correct: shuffled.findIndex(o => o.isCorrect) };
}

// Перемешивание вариантов во всех вопросах урока-теста (для открытия урока).
export function shuffleLessonQuestions(lesson) {
  if (!lesson || lesson.type !== "quiz" || !Array.isArray(lesson.questions)) return lesson;
  return { ...lesson, questions: lesson.questions.map(shuffleQuizOptions) };
}

// Кодирование кода входа для ссылки t.me/...?startapp= —
// Telegram допускает там только A-Za-z0-9_- , а коды у нас кириллические.
export function encodeStartParam(s) {
  try { return btoa(unescape(encodeURIComponent(s))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""); } catch (e) { return ""; }
}
export function decodeStartParam(s) {
  try { const b = String(s).replace(/-/g, "+").replace(/_/g, "/"); return decodeURIComponent(escape(atob(b))); } catch (e) { return null; }
}

// Доп. 242: сжать фото на телефоне до ~700px JPEG — общий для редакторов меню и коктейлей
export const readPhoto = (file, cb) => {
  try {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const max = 700; const k = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement("canvas"); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
      c.getContext("2d").drawImage(img, 0, 0, c.width, c.height); URL.revokeObjectURL(url);
      let data = c.toDataURL("image/jpeg", 0.72); if (data.length > 400000) data = c.toDataURL("image/jpeg", 0.55);
      cb(data);
    };
    img.onerror = () => { URL.revokeObjectURL(url); };
    img.src = url;
  } catch (e) {}
};

// Пол сотрудника (правка 169): в анкете его нет, определяем по фамилии, затем по имени.
// Неясно — остаётся мужской вариант («ПОПАЛСЯ»), как было раньше.
const MALE_A = new Set(["никита", "илья", "данила", "данило", "фома", "кузьма", "савва", "лука", "гаврила",
  "миша", "гоша", "костя", "толя", "коля", "вася", "витя", "петя", "сеня", "степа", "юра", "боря", "гена",
  "ваня", "федя", "паша", "дима", "леша", "сережа", "андрюша", "рома", "жора", "гриша", "сема", "тема"]);
export function isFemaleName(name, surname) {
  const n = String(name || "").trim().toLowerCase().replace(/ё/g, "е").split(/[\s-]/)[0];
  const s = String(surname || "").trim().toLowerCase().replace(/ё/g, "е");
  if (/(ова|ева|ина|ына|ская|цкая|ная|тая)$/.test(s)) return true;
  // Фамилии, одинаковые у мужчин и женщин (Шевченко, Ткачук, Петросян), пола не выдают —
  // по ним решает имя; по окончанию судим только о склоняемых русских фамилиях.
  if (/(ов|ев|ин|ын|ский|цкий|ой)$/.test(s)) return false;
  if (MALE_A.has(n)) return false;
  return /(а|я)$/.test(n);
}
