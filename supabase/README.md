# Supabase — что и в каком порядке применять

Файлы запускаются в SQL Editor **по порядку сверху вниз**. Каждый можно
запускать повторно: они написаны так, чтобы не ломаться на уже созданном
(`create ... if not exists`, `create or replace`). Внизу каждого файла есть
проверка — сколько таблиц и функций получилось.

| # | Файл | Что появляется |
|---|---|---|
| 1 | `supabase-stage2.sql` | Сотрудники, прогресс, вход по коду |
| 2 | `supabase-stage4.sql` | Рейтинг, баллы, книга отзывов |
| 3 | `menu-server-stage4.sql` | Меню ресторана на сервере: `menu_get`, `menu_set` |
| 4 | `supabase-stage5-rename.sql` | Переименование полей под новую схему |
| 5 | `supabase-stage6-mentor-pin.sql` | Наставничество и допуски по пин-коду |
| 6 | `supabase-stage7-quiz-analytics.sql` | Аналитика викторин и ошибок |
| 7 | `supabase-stage8-candidates.sql` | Кандидаты и собеседование |
| 8 | `supabase-stage8b-hire-access.sql` | Права на найм |
| 9 | `supabase-stage9-schedule.sql` | График смен: конфигурация, план, факт часов |
| 10 | `supabase-stage10-backup.sql` | Резервные копии данных ресторана |
| 11 | `supabase-stage11-lockdown.sql` | Закрытие прямого доступа к таблицам, всё через функции |
| 12 | `supabase-stage11b-menu-fix.sql` | Правка прав для меню после закрытия |
| 13 | `supabase-stage11c-whoami-fix.sql` | Правка `whoami` после закрытия |
| 14 | `supabase-stage12-storage.sql` | Хранилище фотографий блюд |
| 15 | `supabase-stage12b-bucket-only.sql` | Только корзина, если политика уже есть |
| 16 | `supabase-stage13-permanent-codes.sql` | Постоянные коды входа вместо одноразовых |
| 17 | `supabase-stage14-achievements.sql` | Рекорды команды и ачивки |
| 18 | `supabase-stage15-quiz-retries.sql` | Аналитика по людям (кто, где и как ошибается — по старшинству) и «Лазейки» |

`supabase-stage11-rollback.sql` — откат одиннадцатого шага, если после
закрытия доступа что-то перестало работать. В обычной жизни не нужен.

## Функции (папка `functions/`)

Разворачиваются отдельно, командой `supabase functions deploy <имя>`:

| Функция | Зачем |
|---|---|
| `ai-chat` | Наставник: ответы по урокам, меню и бару |
| `ai-hr` | Собеседование кандидата |
| `photo-upload` | Фото блюд: приём, сжатие, ссылка |
| `stt` | Распознавание речи для голосового ввода |
| `daily-reminder` | Утреннее напоминание в Telegram |
| `shift-reminder` | Напоминание о смене |

Ключи к ним живут в переменных окружения проекта Supabase, в репозитории их нет.
