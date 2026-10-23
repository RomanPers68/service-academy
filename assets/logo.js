// assets/logo.js
// Логотипы (светлый и тёмный). v59 (Доп. 372): файлы в public/assets вместо base64 внутри главного скрипта —
// две картинки весили ~53 КБ и почти не сжимались, то есть около пятой части стартового кода. Теперь они
// грузятся отдельно (параллельно с кодом), а сервис-воркер держит их в кэше как остальные /assets/*.
export let LOGO_SRC = "/assets/logo-light.webp";
export let LOGO_SRC_DARK = "/assets/logo-dark.webp";

// v73 (Доп. 386): владелец (две записи с iPhone): логотип на главной и во вкладках «исчезает ненадолго» при переходе.
// Каждый переход рисует экран заново, а с ним — новую картинку; в Telegram на iPhone (сервис-воркера там нет) WebKit
// то берёт файл из памяти, то загружает и раскодирует его снова — и до секунды на месте логотипа пусто. Теперь файл
// загружается один раз, лежит в памяти (blob:) и держится раскодированным: новые картинки получают его сразу.
// Экспорт — живой (let): экраны, нарисованные после загрузки, берут адрес из памяти.
const held = [];
function hold(url, done) {
  try {
    if (typeof window === "undefined" || typeof fetch !== "function" || !window.URL || !URL.createObjectURL) return;
    fetch(url).then((r) => (r && r.ok ? r.blob() : null)).then((b) => {
      if (!b || !/^image\//.test(b.type || "")) return;
      const u = URL.createObjectURL(b), im = new Image();
      im.decoding = "sync"; im.src = u; held.push(im);
      const ready = () => done(u);
      if (typeof im.decode === "function") im.decode().then(ready, () => {}); else im.onload = ready;
    }).catch(() => {});
  } catch (e) {}
}
hold(LOGO_SRC_DARK, (u) => { LOGO_SRC_DARK = u; });
hold(LOGO_SRC, (u) => { LOGO_SRC = u; });
