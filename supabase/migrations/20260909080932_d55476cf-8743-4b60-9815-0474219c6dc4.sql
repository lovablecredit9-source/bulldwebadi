CREATE TABLE public.project_activities (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  title TEXT NOT NULL DEFAULT '',
  summary TEXT NOT NULL DEFAULT '',
  files JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX project_activities_project_idx ON public.project_activities (project_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_activities TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_activities TO authenticated;
GRANT ALL ON public.project_activities TO service_role;

ALTER TABLE public.project_activities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Riwayat aktivitas terbuka" ON public.project_activities
FOR ALL USING (true) WITH CHECK (true);