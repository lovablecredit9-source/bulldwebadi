
CREATE TABLE public.projects (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'nodejs',
  description TEXT DEFAULT '',
  model TEXT,
  meta JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.projects TO anon, authenticated;
GRANT ALL ON public.projects TO service_role;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "projects public access" ON public.projects FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.project_files (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  path TEXT NOT NULL,
  content TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (project_id, path)
);
CREATE INDEX project_files_project_idx ON public.project_files(project_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_files TO anon, authenticated;
GRANT ALL ON public.project_files TO service_role;
ALTER TABLE public.project_files ENABLE ROW LEVEL SECURITY;
CREATE POLICY "project_files public access" ON public.project_files FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.project_versions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  version INTEGER NOT NULL,
  label TEXT NOT NULL DEFAULT 'Backup',
  snapshot JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX project_versions_project_idx ON public.project_versions(project_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_versions TO anon, authenticated;
GRANT ALL ON public.project_versions TO service_role;
ALTER TABLE public.project_versions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "project_versions public access" ON public.project_versions FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.ai_chats (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT 'Chat baru',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_chats TO anon, authenticated;
GRANT ALL ON public.ai_chats TO service_role;
ALTER TABLE public.ai_chats ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ai_chats public access" ON public.ai_chats FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.ai_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  chat_id UUID NOT NULL REFERENCES public.ai_chats(id) ON DELETE CASCADE,
  role TEXT NOT NULL,
  content TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ai_messages_chat_idx ON public.ai_messages(chat_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_messages TO anon, authenticated;
GRANT ALL ON public.ai_messages TO service_role;
ALTER TABLE public.ai_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ai_messages public access" ON public.ai_messages FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.ai_settings (
  id INTEGER NOT NULL PRIMARY KEY DEFAULT 1,
  base_url TEXT NOT NULL DEFAULT 'https://router.marketku.id/v1',
  api_key TEXT,
  model TEXT NOT NULL DEFAULT 'nk/auto',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT ai_settings_single_row CHECK (id = 1)
);
GRANT ALL ON public.ai_settings TO service_role;
ALTER TABLE public.ai_settings ENABLE ROW LEVEL SECURITY;

INSERT INTO public.ai_settings (id) VALUES (1);
