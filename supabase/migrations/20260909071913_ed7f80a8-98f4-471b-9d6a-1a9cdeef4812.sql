ALTER TABLE public.ai_settings ALTER COLUMN model SET DEFAULT 'mk/auto';
UPDATE public.ai_settings SET model = 'mk/' || substring(model from 4), updated_at = now() WHERE model LIKE 'nk/%';