-- supabase-stage2.sql
-- Этап 2: серверное хранение подтверждений навыков наставником.
-- ⚠️ НЕОБЯЗАТЕЛЬНО для работы приложения: допуски хранятся локально на устройстве.
-- Применяй этот скрипт (Supabase → SQL Editor), когда захочешь видеть допуски
-- всех сотрудников в аналитике менеджера. До этого вызовы confirm_skill из
-- приложения безопасно отбрасываются офлайн-очередью (ошибка 404 → drop).

create table if not exists skill_confirmations (
  id bigint generated always as identity primary key,
  session_token text,          -- токен сессии сотрудника (sa_session_token)
  role_id text not null,       -- spg / seasonal / core / manager / service_manager
  skill_id text not null,      -- id навыка из data/skills.js
  skill_label text,            -- название навыка (на момент подтверждения)
  mentor text not null,        -- фамилия и имя наставника
  confirmed_on date not null,
  created_at timestamptz default now()
);

-- Один навык подтверждается один раз на сотрудника (повтор перезаписывает)
create unique index if not exists skill_conf_uniq
  on skill_confirmations (session_token, role_id, skill_id);

-- RPC, который вызывает приложение: rpcSync("confirm_skill", {...})
create or replace function confirm_skill(
  p_token text, p_role text, p_skill text, p_skill_label text, p_mentor text, p_date date
) returns json
language plpgsql security definer as $$
begin
  insert into skill_confirmations (session_token, role_id, skill_id, skill_label, mentor, confirmed_on)
  values (p_token, p_role, p_skill, p_skill_label, p_mentor, p_date)
  on conflict (session_token, role_id, skill_id)
  do update set mentor = excluded.mentor, confirmed_on = excluded.confirmed_on, skill_label = excluded.skill_label;
  return json_build_object('ok', true);
end; $$;

-- Если у тебя в проекте есть таблица sessions/profiles, связанная с токеном —
-- добавь сюда join и сохраняй сразу имя сотрудника, как сделано в твоих
-- существующих RPC-функциях записи (посмотри их как образец).
