alter function public.set_updated_at() set search_path = public, pg_catalog;
alter function public.generate_takeframe_license_key() set search_path = public, pg_catalog;
alter function public.generate_takeframe_match_pass_key() set search_path = public, pg_catalog;

revoke execute on function public.claim_webhook_event(text,text,text,text,jsonb) from anon, authenticated;
revoke execute on function public.finish_webhook_event(uuid,text,text) from anon, authenticated;
revoke execute on function public.acquire_production_lease(uuid,uuid,uuid,text,text,integer,integer) from anon, authenticated;
revoke execute on function public.heartbeat_production_lease(text,integer) from anon, authenticated;
revoke execute on function public.release_production_lease(text) from anon, authenticated;

grant execute on function public.claim_webhook_event(text,text,text,text,jsonb) to service_role;
grant execute on function public.finish_webhook_event(uuid,text,text) to service_role;
grant execute on function public.acquire_production_lease(uuid,uuid,uuid,text,text,integer,integer) to service_role;
grant execute on function public.heartbeat_production_lease(text,integer) to service_role;
grant execute on function public.release_production_lease(text) to service_role;
