-- invest-pal: mentor summaries per language.
--
-- 0001 gave gann_signals a single ai_summary column, which was fine while the
-- interface was English only. With the Hebrew toggle in place, one column means
-- a Hebrew page shows an English paragraph — so summaries move to a map keyed
-- by language code.
--
-- ai_summary stays, holding the English text, so nothing that reads it breaks.
--
-- Safe to re-run.

alter table public.gann_signals
  add column if not exists ai_summaries jsonb not null default '{}'::jsonb;

comment on column public.gann_signals.ai_summaries is
  'Mentor summaries keyed by language code, e.g. {"en": "...", "he": "..."}. '
  'Written by python -m gann.refresh --lang en,he.';

comment on column public.gann_signals.ai_summary is
  'Deprecated in favour of ai_summaries. Kept holding the English summary.';

-- Carry any existing English summary into the map so the UI has it immediately.
update public.gann_signals
   set ai_summaries = jsonb_build_object('en', ai_summary)
 where ai_summary is not null
   and not ai_summaries ? 'en';
