
REVOKE EXECUTE ON FUNCTION public.find_chama_by_name(text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.join_chama_by_name(text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.accept_chama_invite(text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.preview_chama_invite(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.find_chama_by_name(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.join_chama_by_name(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.accept_chama_invite(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.preview_chama_invite(text) TO anon, authenticated;
