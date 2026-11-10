-- Additive compatibility migration. No existing role, membership, workout or plan is rewritten.
-- Apply after 20261107_coaching_foundation.sql using the backend schema owner.
BEGIN;
CREATE TABLE IF NOT EXISTS console_audit_logs (
 id varchar(36) PRIMARY KEY, tenant_id varchar(36) NOT NULL REFERENCES console_tenants(id),
 actor_id varchar(36) NOT NULL REFERENCES console_accounts(id), action varchar(80) NOT NULL,
 subject_id varchar(160) NOT NULL, detail varchar(8000) NOT NULL DEFAULT '{}',
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_console_audit_logs_tenant_id ON console_audit_logs(tenant_id);
CREATE TABLE IF NOT EXISTS console_club_billing_profiles (
 tenant_id varchar(36) PRIMARY KEY REFERENCES console_tenants(id), legal_name varchar(200) NOT NULL DEFAULT '',
 billing_email varchar(320) NOT NULL DEFAULT '', tax_id varchar(80) NOT NULL DEFAULT '', address varchar(1000) NOT NULL DEFAULT ''
);
CREATE TABLE IF NOT EXISTS console_subscription_requests (
 id varchar(36) PRIMARY KEY, tenant_id varchar(36) NOT NULL REFERENCES console_tenants(id),
 actor_id varchar(36) NOT NULL REFERENCES console_accounts(id), requested_plan varchar(80) NOT NULL,
 status varchar(20) NOT NULL DEFAULT 'pending', created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_console_subscription_requests_tenant_id ON console_subscription_requests(tenant_id);
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conname='nfcfit_known_staff_role' AND conrelid='console_tenant_staff'::regclass) THEN
 ALTER TABLE console_tenant_staff ADD CONSTRAINT nfcfit_known_staff_role CHECK (role IN ('owner','admin','coach','CLUB_ADMIN','CLUB_MANAGER','TRAINER')) NOT VALID;
 END IF;
END $$;
ALTER TABLE console_tenant_staff VALIDATE CONSTRAINT nfcfit_known_staff_role;
CREATE OR REPLACE FUNCTION public.nfcfit_club_role(role text) RETURNS text
LANGUAGE sql IMMUTABLE AS $$ SELECT CASE role WHEN 'owner' THEN 'CLUB_ADMIN' WHEN 'admin' THEN 'CLUB_MANAGER' WHEN 'coach' THEN 'TRAINER' ELSE role END $$;
CREATE OR REPLACE FUNCTION public.nfcfit_staff_access(club varchar, allowed text[]) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
 SELECT EXISTS(SELECT 1 FROM console_tenant_staff s JOIN console_tenants t ON t.id=s.tenant_id
 WHERE s.tenant_id=club AND s.account_id=public.nfcfit_account_id() AND s.status='active'
 AND t.status='active' AND public.nfcfit_club_role(s.role)=ANY(allowed))
$$;
CREATE OR REPLACE FUNCTION public.nfcfit_member_access(club varchar) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
 SELECT EXISTS(SELECT 1 FROM console_memberships m JOIN console_tenants t ON t.id=m.tenant_id
 WHERE m.tenant_id=club AND m.account_id=public.nfcfit_account_id()
 AND m.status IN ('active','pending') AND t.status='active')
$$;
-- Extend existing coaching consent/link helpers to accept both generations of stored roles.
DO $$ DECLARE name text; definition text; BEGIN
 FOREACH name IN ARRAY ARRAY['nfcfit_athlete_access','nfcfit_link_access'] LOOP
 SELECT pg_get_functiondef(p.oid) INTO definition FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
 WHERE p.proname=name AND n.nspname='public';
 IF definition IS NULL THEN RAISE EXCEPTION 'Missing coaching helper %', name; END IF;
 EXECUTE replace(replace(definition, '''owner'',''admin'',''coach'',''CLUB_ADMIN'',''CLUB_MANAGER'',''TRAINER''', '''owner'',''coach'',''CLUB_ADMIN'',''TRAINER'''), '''owner'',''admin'',''coach''', '''owner'',''coach'',''CLUB_ADMIN'',''TRAINER''');
 END LOOP;
END $$;
CREATE OR REPLACE FUNCTION public.nfcfit_plan_access(plan varchar) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
 SELECT EXISTS(SELECT 1 FROM console_coaching_plans p WHERE p.id=plan AND
 ((p.athlete_id IS NULL AND p.owner_id=public.nfcfit_account_id() AND
   (p.tenant_id IS NULL OR public.nfcfit_staff_access(p.tenant_id,ARRAY['CLUB_ADMIN','TRAINER'])))
 OR p.athlete_id=public.nfcfit_account_id()
 OR (p.tenant_id IS NOT NULL AND EXISTS(SELECT 1 FROM console_coach_links l WHERE
 l.tenant_id=p.tenant_id AND l.athlete_id=p.athlete_id AND l.trainer_id=public.nfcfit_account_id() AND public.nfcfit_link_access(l.id)))))
$$;
CREATE OR REPLACE FUNCTION public.nfcfit_protect_last_club_admin() RETURNS trigger
LANGUAGE plpgsql SET search_path=public,pg_temp AS $$ BEGIN
 IF OLD.status='active' AND public.nfcfit_club_role(OLD.role)='CLUB_ADMIN' THEN
   IF TG_OP='UPDATE' THEN
     IF NEW.tenant_id=OLD.tenant_id AND NEW.account_id=OLD.account_id AND NEW.status='active' AND public.nfcfit_club_role(NEW.role)='CLUB_ADMIN' THEN RETURN NEW; END IF;
   END IF;
   PERFORM 1 FROM console_tenants WHERE id=OLD.tenant_id FOR UPDATE;
   IF NOT EXISTS(SELECT 1 FROM console_tenant_staff WHERE tenant_id=OLD.tenant_id AND id<>OLD.id AND status='active' AND public.nfcfit_club_role(role)='CLUB_ADMIN') THEN
     RAISE EXCEPTION 'last_active_club_admin' USING ERRCODE='23514';
   END IF;
 END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; END IF; RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS nfcfit_last_club_admin ON console_tenant_staff;
CREATE TRIGGER nfcfit_last_club_admin BEFORE UPDATE OR DELETE ON console_tenant_staff FOR EACH ROW EXECUTE FUNCTION public.nfcfit_protect_last_club_admin();
-- An immutable audit ledger, including against backend accidental edits.
DROP TRIGGER IF EXISTS nfcfit_immutable_ledger ON console_audit_logs;
CREATE TRIGGER nfcfit_immutable_ledger BEFORE UPDATE OR DELETE ON console_audit_logs FOR EACH ROW EXECUTE FUNCTION public.nfcfit_immutable_ledger();
-- Clients have read-only, tenant-scoped database access. Mutations go through checked APIs.
DO $$ DECLARE tab text; BEGIN
 FOREACH tab IN ARRAY ARRAY['console_accounts','console_tenants','console_tenant_staff','console_memberships','console_exercises','console_nfc_tags','console_activities','console_member_exercise_goals','console_audit_logs','console_subscription_requests','console_club_billing_profiles'] LOOP
 IF EXISTS(SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename=tab AND policyname<>'nfcfit_club_read') THEN RAISE EXCEPTION USING MESSAGE='Review unexpected existing RLS policies on ' || tab; END IF;
 EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',tab);
 EXECUTE format('REVOKE ALL ON public.%I FROM anon, authenticated',tab);
 EXECUTE format('GRANT SELECT ON public.%I TO authenticated',tab);
 EXECUTE format('DROP POLICY IF EXISTS nfcfit_club_read ON public.%I',tab);
 END LOOP;
END $$;
-- Do not expose password_hash through client reads.
REVOKE SELECT ON console_accounts FROM authenticated;
GRANT SELECT(id,email,name,supabase_user_id,is_platform_admin,created_at) ON console_accounts TO authenticated;
CREATE POLICY nfcfit_club_read ON console_accounts FOR SELECT TO authenticated USING(id=public.nfcfit_account_id());
CREATE POLICY nfcfit_club_read ON console_tenants FOR SELECT TO authenticated USING(public.nfcfit_member_access(id) OR public.nfcfit_staff_access(id,ARRAY['CLUB_ADMIN','CLUB_MANAGER','TRAINER']));
CREATE POLICY nfcfit_club_read ON console_tenant_staff FOR SELECT TO authenticated USING(account_id=public.nfcfit_account_id() OR public.nfcfit_staff_access(tenant_id,ARRAY['CLUB_ADMIN','CLUB_MANAGER']));
CREATE POLICY nfcfit_club_read ON console_memberships FOR SELECT TO authenticated USING(account_id=public.nfcfit_account_id() OR public.nfcfit_staff_access(tenant_id,ARRAY['CLUB_ADMIN','CLUB_MANAGER']));
CREATE POLICY nfcfit_club_read ON console_exercises FOR SELECT TO authenticated USING(public.nfcfit_member_access(tenant_id) OR public.nfcfit_staff_access(tenant_id,ARRAY['CLUB_ADMIN','CLUB_MANAGER','TRAINER']));
CREATE POLICY nfcfit_club_read ON console_nfc_tags FOR SELECT TO authenticated USING(public.nfcfit_member_access(tenant_id) OR public.nfcfit_staff_access(tenant_id,ARRAY['CLUB_ADMIN','CLUB_MANAGER']));
CREATE POLICY nfcfit_club_read ON console_activities FOR SELECT TO authenticated USING(account_id=public.nfcfit_account_id() OR public.nfcfit_staff_access(tenant_id,ARRAY['CLUB_ADMIN','CLUB_MANAGER']));
CREATE POLICY nfcfit_club_read ON console_member_exercise_goals FOR SELECT TO authenticated USING(account_id=public.nfcfit_account_id());
CREATE POLICY nfcfit_club_read ON console_audit_logs FOR SELECT TO authenticated USING(public.nfcfit_staff_access(tenant_id,ARRAY['CLUB_ADMIN']));
CREATE POLICY nfcfit_club_read ON console_subscription_requests FOR SELECT TO authenticated USING(public.nfcfit_staff_access(tenant_id,ARRAY['CLUB_ADMIN']));
CREATE POLICY nfcfit_club_read ON console_club_billing_profiles FOR SELECT TO authenticated USING(public.nfcfit_staff_access(tenant_id,ARRAY['CLUB_ADMIN']));
COMMIT;
