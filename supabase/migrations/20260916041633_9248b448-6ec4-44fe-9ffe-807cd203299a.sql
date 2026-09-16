REVOKE ALL ON FUNCTION public.pin_session_create(uuid, text, text) FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.pin_session_valid(uuid, text) FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.pin_session_list(uuid, text) FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.pin_session_revoke(uuid, text, uuid) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.pin_session_create(uuid, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.pin_session_valid(uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.pin_session_list(uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.pin_session_revoke(uuid, text, uuid) TO service_role;