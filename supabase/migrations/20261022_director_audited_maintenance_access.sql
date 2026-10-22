-- Owners with the active Director role can use the same audited maintenance controls as Developer.
CREATE OR REPLACE FUNCTION public.portal_developer_profile()
RETURNS public.portal_profiles
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_profile public.portal_profiles;
BEGIN
 SELECT * INTO v_profile FROM public.portal_profiles
 WHERE auth_user_id=auth.uid() AND coalesce(is_active,false) = true LIMIT 1;
 IF v_profile.id IS NULL OR v_profile.role NOT IN ('developer','director') THEN
   RAISE EXCEPTION 'Developer or Director role required';
 END IF;
 RETURN v_profile;
END
$function$;
-- Rollback: restore prior developer-only function definition from previous migration.
