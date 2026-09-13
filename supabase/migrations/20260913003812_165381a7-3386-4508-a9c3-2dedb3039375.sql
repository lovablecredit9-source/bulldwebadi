ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS pin_hash text,
  ADD COLUMN IF NOT EXISTS pin_salt text,
  ADD COLUMN IF NOT EXISTS pin_set_at timestamptz;

CREATE TABLE IF NOT EXISTS public.project_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  token_hash text NOT NULL,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS project_sessions_token_hash_idx ON public.project_sessions(token_hash);
CREATE INDEX IF NOT EXISTS project_sessions_project_idx ON public.project_sessions(project_id);

GRANT ALL ON public.project_sessions TO service_role;

ALTER TABLE public.project_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Sesi PIN hanya server" ON public.project_sessions
  FOR ALL TO service_role USING (true) WITH CHECK (true);