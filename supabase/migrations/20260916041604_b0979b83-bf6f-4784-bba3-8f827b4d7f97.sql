ALTER TABLE public.project_sessions
  ADD COLUMN IF NOT EXISTS device_label text NOT NULL DEFAULT 'Perangkat',
  ADD COLUMN IF NOT EXISTS last_seen_at timestamptz NOT NULL DEFAULT now();

CREATE OR REPLACE FUNCTION public.pin_session_create(p_project_id uuid, p_token_hash text, p_device_label text DEFAULT 'Perangkat')
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.project_sessions(project_id, token_hash, device_label, last_seen_at)
  VALUES (p_project_id, p_token_hash, left(coalesce(nullif(trim(p_device_label), ''), 'Perangkat'), 120), now())
  ON CONFLICT (token_hash) DO UPDATE SET
    device_label = excluded.device_label,
    last_seen_at = now(),
    expires_at = now() + interval '7 days';
  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.pin_session_valid(p_project_id uuid, p_token_hash text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  valid_session boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM public.project_sessions
    WHERE project_id = p_project_id
      AND token_hash = p_token_hash
      AND expires_at > now()
  ) INTO valid_session;
  IF valid_session THEN
    UPDATE public.project_sessions
    SET last_seen_at = now()
    WHERE project_id = p_project_id AND token_hash = p_token_hash;
  END IF;
  RETURN valid_session;
END;
$$;

CREATE OR REPLACE FUNCTION public.pin_session_list(p_project_id uuid, p_token_hash text)
RETURNS TABLE(id uuid, device_label text, created_at timestamptz, last_seen_at timestamptz, expires_at timestamptz, current_device boolean)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT s.id, s.device_label, s.created_at, s.last_seen_at, s.expires_at, s.token_hash = p_token_hash
  FROM public.project_sessions s
  WHERE s.project_id = p_project_id
    AND s.expires_at > now()
    AND EXISTS (
      SELECT 1 FROM public.project_sessions current_session
      WHERE current_session.project_id = p_project_id
        AND current_session.token_hash = p_token_hash
        AND current_session.expires_at > now()
    )
  ORDER BY s.last_seen_at DESC;
$$;

CREATE OR REPLACE FUNCTION public.pin_session_revoke(p_project_id uuid, p_token_hash text, p_session_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.project_sessions
    WHERE project_id = p_project_id AND token_hash = p_token_hash AND expires_at > now()
  ) THEN
    RETURN false;
  END IF;
  DELETE FROM public.project_sessions WHERE project_id = p_project_id AND id = p_session_id;
  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.pin_session_create(uuid, text, text) FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.pin_session_valid(uuid, text) FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.pin_session_list(uuid, text) FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.pin_session_revoke(uuid, text, uuid) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.pin_session_create(uuid, text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.pin_session_valid(uuid, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.pin_session_list(uuid, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.pin_session_revoke(uuid, text, uuid) TO anon, authenticated;