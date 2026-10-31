// lib/server-check.js — v99 (Доп. 412): экран «Сервер» у владельца. Приложение знает, какие этапы базы ему нужны (по
// одной функции или корзине Storage от каждого), и спрашивает сервер (этап 39, server_check), что из этого на месте,
// как дела у Telegram (бот, вебхук, последнее событие, кто подключил напоминания, кто входит без кода) и у расписаний
// pg_cron. Здесь — список этапов и разбор ответа; экран — ui/server.jsx.

export const REPO_URL = "https://github.com/RomanPers68/service-academy/blob/main/supabase/";

/** Этапы: номер, файл, что даёт, чем узнаётся на сервере (функция fn или корзина bucket). По порядку применения. */
export const STAGES = [
  { n: "4", file: "supabase-stage4.sql", what: "Меню команды на сервере", fn: "menu_get" },
  { n: "6", file: "supabase-stage6-mentor-pin.sql", what: "PIN наставника", fn: "confirm_skill_pin" },
  { n: "7", file: "supabase-stage7-quiz-analytics.sql", what: "Аналитика тестов", fn: "quiz_hard_questions" },
  { n: "8", file: "supabase-stage8-candidates.sql", what: "Кандидаты", fn: "candidate_list" },
  { n: "9", file: "supabase-stage9-schedule.sql", what: "График смен", fn: "schedule_load" },
  { n: "10", file: "supabase-stage10-backup.sql", what: "Резервная копия", fn: "backup_take" },
  { n: "12", file: "supabase-stage12-storage.sql", what: "Фото блюд", bucket: "menu-photos" },
  { n: "13", file: "supabase-stage13-permanent-codes.sql", what: "Постоянные коды входа", fn: "admin_issue_permanent_code" },
  { n: "14", file: "supabase-stage14-achievements.sql", what: "Достижения", fn: "achievements_list" },
  { n: "15", file: "supabase-stage15-quiz-retries.sql", what: "Повторы тестов", fn: "quiz_people" },
  { n: "16", file: "supabase-stage16-quiz-keys.sql", what: "Ключи тестов", fn: "log_quiz_key" },
  { n: "20", file: "supabase-stage20-reset-traces.sql", what: "Сброс прогресса", fn: "admin_wipe_lesson_traces" },
  { n: "20c", file: "supabase-stage20c-my-state.sql", what: "Прогресс на сервере", fn: "my_state" },
  { n: "20e", file: "supabase-stage20e-unlock-quiz.sql", what: "Разблокировать тест", fn: "admin_unlock_quiz" },
  { n: "21", file: "supabase-stage21-private-data.sql", what: "Личные данные только по входу", fn: "team_scores" },
  { n: "22", file: "supabase-stage22-hall-confirm.sql", what: "Подтверждение в зале", fn: "skill_requests_inbox" },
  { n: "22б", file: "supabase-stage22b-telegram-reminders.sql", what: "Напоминания в Telegram", fn: "tg_link" },
  { n: "23", file: "supabase-stage23-reports.sql", what: "Отчёты по сотрудникам", fn: "report_people" },
  { n: "24", file: "supabase-stage24-together.sql", what: "Квест, лига, свеча на двоих", fn: "league_week" },
  { n: "25", file: "supabase-stage25-live.sql", what: "Живые сообщения бота", fn: "quest_thanks" },
  { n: "26", file: "supabase-stage26-mastery.sql", what: "Путь мастера", fn: "mastery_list" },
  { n: "27", file: "supabase-stage27-bootstrap.sql", what: "Быстрый старт", fn: "app_bootstrap" },
  { n: "28", file: "supabase-stage28-ai-hr.sql", what: "AI HR", fn: "hr_quality_get" },
  { n: "30", file: "supabase-stage30-voice.sql", what: "Голос шефа и сомелье", bucket: "menu-voice" },
  { n: "31", file: "supabase-stage31-qday.sql", what: "Вопрос дня", fn: "qday_inbox" },
  { n: "32", file: "supabase-stage32-briefing.sql", what: "Брифинг смены", fn: "brief_today" },
  { n: "33", file: "supabase-stage33-cases.sql", what: "Случаи из зала", fn: "case_list" },
  { n: "34", file: "supabase-stage34-guest-thanks.sql", what: "Спасибо от гостей", fn: "guest_thanks_send" },
  { n: "35", file: "supabase-stage35-seating.sql", what: "Рассадка", fn: "seat_board" },
  { n: "36", file: "supabase-stage36-comfort.sql", what: "Тихие часы, отзывы гостей", fn: "brief_reads" },
  { n: "37", file: "supabase-stage37-halls-qday.sql", what: "Залы, вопрос дня на главной", fn: "qday_today" },
  { n: "38", file: "supabase-stage38-chat.sql", what: "Чат смены", fn: "chat_person" },
  { n: "39", file: "supabase-stage39-everyday.sql", what: "Вход через Telegram, упоминания, календарь", fn: "cal_feed" },
  { n: "40", file: "supabase-stage40-morning.sql", what: "Утро руководителя", fn: "morning_brief" },   // v106 (Доп. 419)
  { n: "41", file: "supabase-stage41-newbie.sql", what: "Новичок: наставник, памятка, первая смена", fn: "newbie_me" },   // v107 (Доп. 420)
  { n: "42", file: "supabase-stage42-thanks.sql", what: "Спасибо коллеге, дни рождения и годовщины", fn: "chat_thanks" },   // v108 (Доп. 421)
  { n: "43", file: "supabase-stage43-gain.sql", what: "Что дало обучение: итог месяца", fn: "gain_month" },   // v109 (Доп. 422)
  { n: "44", file: "supabase-stage44-wines.sql", what: "Кто выучил новые вина", fn: "wine_progress_team" },   // v125 (Доп. 438)
];
/** Расписания pg_cron, которые ставят этапы: имя задачи, что делает, какой этап. */
export const CRON_JOBS = [
  { name: "sa-warmup-reminders", what: "Напоминание о смене и разминке", n: "22б" },
  { name: "sa-nudges", what: "Сообщения бота: свеча, квест, лига", n: "25" },
  { name: "sa-qday", what: "Вопрос дня", n: "31" },
  { name: "sa-morning", what: "Утро руководителя", n: "40" },
  { name: "sa-newbie", what: "Новичку накануне первой смены", n: "41" },
  { name: "sa-cheer", what: "Дни рождения и годовщины в «Вся команда»", n: "42" },
  { name: "sa-gain", what: "Итог месяца руководителям 1-го числа", n: "43" },
];
export const stageFns = () => STAGES.filter((s) => s.fn).map((s) => s.fn);
export const stageBuckets = () => STAGES.filter((s) => s.bucket).map((s) => s.bucket);

const pl = (n, a, b, c) => { const m10 = n % 10, m100 = n % 100; return m10 === 1 && m100 !== 11 ? a : m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14) ? b : c; };
/** «только что», «5 минут назад», «3 часа назад», «вчера», «4 дня назад», «давно» (больше месяца) или "" (не было). */
export function agoText(iso, now = Date.now()) {
  const t = Date.parse(iso || "");
  if (!iso || Number.isNaN(t)) return "";
  const m = Math.max(0, Math.round((Number(now) - t) / 60000));
  if (m < 2) return "только что";
  if (m < 60) return m + " " + pl(m, "минуту", "минуты", "минут") + " назад";
  const h = Math.round(m / 60);
  if (h < 24) return h + " " + pl(h, "час", "часа", "часов") + " назад";
  const d = Math.round(h / 24);
  if (d === 1) return "вчера";
  if (d <= 30) return d + " " + pl(d, "день", "дня", "дней") + " назад";
  return "давно";
}

/**
 * Разбор ответа server_check: { stages: [{ ...этап, ok }], missing — этапы, которых нет, cron: [{ ...задача, ok, on }] или
 * null (pg_cron не включён), cronMissing, tg: { bot, name, hook, last, ago, linked, auth, staff }, app, net, todo — сколько
 * дел (этапы, бот, вебхук, расписания) }. Корзины не проверить (нет схемы Storage) — такие этапы считаются на месте.
 */
export function serverReport(r, now = Date.now()) {
  const res = r || {}, fns = new Set(Array.isArray(res.fns) ? res.fns : []), bks = Array.isArray(res.buckets) ? new Set(res.buckets) : null;
  const stages = STAGES.map((s) => ({ ...s, ok: s.fn ? fns.has(s.fn) : bks ? bks.has(s.bucket) : true }));
  const missing = stages.filter((s) => !s.ok);
  const jobs = Array.isArray(res.cron) ? res.cron : null;
  const cron = jobs ? CRON_JOBS.map((j) => { const x = jobs.find((y) => y && y.name === j.name); return { ...j, ok: !!x, on: !!(x && x.on !== false) }; }) : null;
  const cronMissing = cron ? cron.filter((j) => !j.ok || !j.on) : [];
  const t = res.tg || {};
  const tg = { bot: !!t.bot, name: t.name || "", hook: !!t.hook, last: t.last || null, ago: agoText(t.last, now), linked: Number(t.linked) || 0, auth: Number(t.auth) || 0, staff: Number(res.staff) || 0 };
  const todo = missing.length + (tg.bot ? 0 : 1) + (tg.bot && !tg.hook ? 1 : 0) + (cron ? cronMissing.length : 1);
  return { stages, missing, cron, cronMissing, tg, app: res.app || "", net: !!res.pg_net, tz: res.tz || "", todo };
}
