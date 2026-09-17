ALTER TABLE public.site_banners
  ADD COLUMN IF NOT EXISTS banner_type text NOT NULL DEFAULT 'dashboard';

UPDATE public.site_banners
SET banner_type = 'dashboard'
WHERE banner_type IS NULL OR trim(banner_type) = '';

ALTER TABLE public.site_banners
  DROP CONSTRAINT IF EXISTS site_banners_banner_type_check;

ALTER TABLE public.site_banners
  ADD CONSTRAINT site_banners_banner_type_check
  CHECK (banner_type IN ('dashboard', 'telegram', 'whatsapp', 'browser-extension'));

CREATE INDEX IF NOT EXISTS site_banners_type_active_idx
  ON public.site_banners (banner_type, is_active, created_at DESC);
