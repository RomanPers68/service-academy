import React from "react";
import { onActivate, vibrate } from "../lib/utils";

// ── Дополнение 140: «Гид по приложению» — всегда под рукой во вкладке «Я» ────
// Попап первого входа показывается один раз; гид — постоянный. Каждая функция:
// что это, зачем и кнопка «Открыть». Сгруппировано по вкладкам. Пункты
// менеджера/владельца видны только им. Стиль — «Морозный след», обе темы.

const GUIDE = [
  { tab: "Учусь", items: [
    { key: "track", title: "Твой трек", text: "Карточка сверху главной ведёт к следующему уроку роли: прогресс, время до конца пути, кнопка «Дальше». Начинать всегда отсюда.", go: "roleSelect" },
    { key: "lessons", title: "Уроки, тесты и диалоги", text: "Программа роли: теория, тесты по 12 случайных вопросов, живые диалоги с гостем и практика ситуаций. Пройденное отмечается галочкой, роль закрывает экзамен.", go: "roleSelect" },
    { key: "mistakes", title: "Работа над ошибками", text: "Вопросы, где ошибался, возвращаются через интервалы, пока не ответишь верно дважды. Бейдж на карточке — сколько ждёт повторения.", go: "mistakes" },
    { key: "reference", title: "Справочник", text: "Курсы для всей команды: сервировка, вина, кофе, гид по приложению. Поиск по главам — вверху. Здесь же Колода бармена.", go: "reference" },
    { key: "cocktails", title: "Колода бармена", text: "50 карточек: состав в мл, метод, бокал, история и фраза гостю. Свайп — листать, тап — перевернуть, режим «Знаю?» — самопроверка.", go: "cocktails" },
    { key: "menu", title: "Меню ресторана", text: "Карточки блюд с фото, составом и аллергенами; тренажёр «Опиши за 60 секунд» и тест. Менеджер правит меню и публикует команде — правка появится у всех.", go: "menu" },
    { key: "glossary", title: "Глоссарий", text: "Термины зала, бара и кухни одним списком с поиском. Заметки и избранное — свои, хранятся на телефоне.", go: "glossary" },
    { key: "assistant", title: "AI-наставник", text: "Круглая кнопка на главных экранах. Знает стандарты, меню и коктейли твоего ресторана; отвечает голосом или текстом, показывает карточки и ведёт в нужный раздел.", go: "assistant" },
    { key: "sos", title: "SOS", text: "Красная плитка: шпаргалки на экстренный случай — аллергия у гостя, конфликт, жалоба, ЧП в зале. Открывается за секунду.", go: "sos" },
  ]},
  { tab: "Смена", items: [
    { key: "schedule", title: "График смен", text: "Свои смены, часы и заработок. Тап по дню — кто в смене, заметка, «попросить выходной». Имя старшего — звонок в один тап.", go: "schedule" },
    { key: "checklist", title: "Чек-листы", text: "Открытие, смена, закрытие — по пунктам, с отметками. Старший видит, что сделано.", go: "checklist" },
    { key: "daily", title: "Задание дня", text: "Короткая практика на сегодня, три минуты. Серия дней подряд даёт очки.", go: "daily" },
    { key: "weekly", title: "Гость недели", text: "Живой диалог с непростым гостем — раз в неделю новый. За успех — печать в Книгу отзывов.", go: "weeklyGuest" },
    { key: "guestbook", title: "Книга отзывов", text: "Твоя история в академии: страницы за роли, печати за испытания, монограмма. Не рейтинг — летопись.", go: "guestbook" },
    { key: "onboarding", title: "Первая неделя", text: "План адаптации новичка по дням: что узнать, у кого спросить, что показать старшему. Менеджер видит прогресс каждого.", go: "onboarding" },
  ]},
  { tab: "Команда", items: [
    { key: "leaderboard", title: "Рейтинг", text: "Очки за уроки, задания и звёзды практики. Место в команде и в ресторане; бейдж месяца.", go: "leaderboard" },
    { key: "mentor", title: "Наставничество и допуски", text: "Старший подтверждает навыки лично: «принимать заказ», «работать с винной картой». Допуск — это доверие, а не тест.", go: "mentor" },
    { key: "analytics", title: "Аналитика", text: "Сводка по команде: кто застрял, кто растёт, слабые темы. Внизу — резервная копия базы одним тапом (владельцу).", go: "analytics", staff: true },
    { key: "team", title: "Сотрудники", text: "Карточки, коды входа, должности, роли. Здесь же выдаётся доступ к редактированию.", go: "team", admin: true },
    { key: "hire", title: "Собеседование и AI HR", text: "Кандидат проходит мини-курс и интервью с AI HR — голосом или текстом. Результат и рекомендация — менеджеру.", go: "candidate", staff: true },
    { key: "editor", title: "Редактор контента", text: "Свои уроки и материалы для команды — без разработчика. Опубликованное видят все сотрудники ресторана.", go: "contentEditor", staff: true },
  ]},
  { tab: "Я", items: [
    { key: "stats", title: "Мой прогресс", text: "Роли, уроки, экзамены, очки — всё в цифрах. Отсюда открываются новые треки.", go: "stats" },
    { key: "certs", title: "Сертификаты", text: "За каждую закрытую роль — именной сертификат с печатью. Можно сохранить картинкой.", go: "certificates" },
    { key: "profile", title: "Аккаунт и настройки", text: "Тренировочная карточка, крупный шрифт и светлая тема «Для чтения», выход из аккаунта.", go: "profile" },
    { key: "voice", title: "Голосовой ввод", text: "Микрофон у Наставника и в AI HR: скажи — текст появится в поле. Работает в Telegram и в браузере.", go: "assistant" },
  ]},
];

export function GuideScreen({ T, a11y, profile, onBack, onOpen }) {
  const gold = a11y ? "#8B6A30" : "#D2A85A";
  const text = T.modTitle?.color || (a11y ? "#2A1F0E" : "#EFE4C8");
  const sub = T.modSub?.color || (a11y ? "#6B5A3E" : "#9C8760");
  const staff = !!profile?.is_admin || ["manager", "senior"].includes(profile?.position);
  const admin = !!profile?.is_admin;
  const [open, setOpen] = React.useState(null);
  const frost = {
    background: a11y ? "rgba(250,242,222,0.62)" : "rgba(226,186,116,0.09)",
    border: a11y ? "1px solid rgba(139,106,48,0.30)" : "1px solid rgba(255,255,255,0.13)",
    boxShadow: a11y
      ? "inset 0 0 26px rgba(255,255,255,0.55), inset 0 1px 0 rgba(255,255,255,0.9), 0 6px 18px rgba(120,85,25,0.14)"
      : "inset 0 0 26px rgba(255,248,230,0.07), inset 0 1px 0 rgba(255,255,255,0.12), 0 8px 24px rgba(0,0,0,0.45)",
  };
  return (
    <div style={T.screen} className="sa-screen">
      <div style={{ padding: "16px 16px 6px", display: "flex", alignItems: "center", gap: 10 }}>
        <button className="sa-btn" onClick={onBack} {...onActivate(onBack)} aria-label="Назад"
          style={{ border: "none", background: "transparent", color: gold, fontSize: 22, cursor: "pointer", padding: "4px 8px 4px 0" }}>‹</button>
        <div>
          <div style={{ fontFamily: "ui-monospace, Menlo, monospace", fontSize: 10.5, letterSpacing: 1.5, color: gold }}>ГИД ПО ПРИЛОЖЕНИЮ</div>
          <div style={{ fontFamily: "Georgia, serif", fontSize: 24, color: text, lineHeight: 1.15 }}>Что где и зачем</div>
        </div>
      </div>
      <div style={{ padding: "4px 16px 100px" }}>
        <div style={{ fontSize: 13, color: sub, lineHeight: 1.5, marginBottom: 14 }}>Тапни пункт — раскроется объяснение и кнопка «Открыть». Список всегда здесь, во вкладке «Я».</div>
        {GUIDE.map(sec => {
          const items = sec.items.filter(it => (!it.staff || staff) && (!it.admin || admin));
          if (!items.length) return null;
          return (
            <div key={sec.tab} style={{ marginBottom: 18 }}>
              <div style={{ fontFamily: "ui-monospace, Menlo, monospace", fontSize: 10.5, letterSpacing: 1.6, color: gold, margin: "0 2px 8px" }}>{sec.tab.toUpperCase()}</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {items.map(it => {
                  const isOpen = open === it.key;
                  const toggle = () => { vibrate("light"); setOpen(isOpen ? null : it.key); };
                  return (
                    <div key={it.key} style={{ ...frost, borderRadius: 16, overflow: "hidden" }}>
                      <div onClick={toggle} {...onActivate(toggle)} aria-expanded={isOpen} style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 14px", cursor: "pointer", WebkitTapHighlightColor: "transparent" }}>
                        <div style={{ flex: 1, fontFamily: "Georgia, serif", fontSize: 16, color: text }}>{it.title}</div>
                        <span style={{ color: gold, fontSize: 18, transform: isOpen ? "rotate(90deg)" : "none", transition: "transform .3s cubic-bezier(.25,.8,.25,1)" }}>›</span>
                      </div>
                      {isOpen && (
                        <div className="sa-fadein" style={{ padding: "0 14px 12px" }}>
                          <div style={{ fontSize: 13.5, color: sub, lineHeight: 1.6 }}>{it.text}</div>
                          {it.go && onOpen && (
                            <button className="sa-btn" onClick={() => { vibrate("light"); onOpen(it.go); }}
                              style={{ marginTop: 10, border: `1px solid ${gold}88`, background: "transparent", color: gold, fontFamily: "Georgia, serif", fontSize: 14, fontWeight: "bold", borderRadius: 12, padding: "8px 14px", cursor: "pointer" }}>
                              Открыть ›
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
