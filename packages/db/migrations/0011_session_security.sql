CREATE FUNCTION public.vinea_mfa_sessions() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.two_factor_enabled IS DISTINCT FROM OLD.two_factor_enabled THEN DELETE FROM public.auth_session WHERE user_id=NEW.id; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER mfa_revoke_existing_sessions BEFORE UPDATE ON public.auth_user FOR EACH ROW EXECUTE FUNCTION public.vinea_mfa_sessions();
REVOKE ALL ON FUNCTION public.vinea_mfa_sessions() FROM PUBLIC;
