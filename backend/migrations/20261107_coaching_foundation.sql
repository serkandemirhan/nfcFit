-- Additive coaching foundation. Existing console schema must already exist.
-- Apply as database owner; backend writes must use a non-client database role.
begin;

CREATE TABLE IF NOT EXISTS console_coach_links (
	id VARCHAR(36) NOT NULL, 
	tenant_id VARCHAR(36) NOT NULL, 
	trainer_id VARCHAR(36) NOT NULL, 
	athlete_id VARCHAR(36) NOT NULL, 
	active BOOLEAN NOT NULL, 
	PRIMARY KEY (id), 
	UNIQUE (tenant_id, trainer_id, athlete_id), 
	FOREIGN KEY(tenant_id) REFERENCES console_tenants (id), 
	FOREIGN KEY(trainer_id) REFERENCES console_accounts (id), 
	FOREIGN KEY(athlete_id) REFERENCES console_accounts (id)
)

;
CREATE INDEX IF NOT EXISTS ix_console_coach_links_trainer_id ON console_coach_links (trainer_id);
CREATE INDEX IF NOT EXISTS ix_console_coach_links_tenant_id ON console_coach_links (tenant_id);
CREATE INDEX IF NOT EXISTS ix_console_coach_links_athlete_id ON console_coach_links (athlete_id);

CREATE TABLE IF NOT EXISTS console_coaching_notifications (
	id VARCHAR(36) NOT NULL, 
	account_id VARCHAR(36) NOT NULL, 
	group_key VARCHAR(180) NOT NULL, 
	body VARCHAR(400) NOT NULL, 
	context_id VARCHAR(80) NOT NULL, 
	read BOOLEAN NOT NULL, 
	created_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	PRIMARY KEY (id), 
	UNIQUE (account_id, group_key), 
	FOREIGN KEY(account_id) REFERENCES console_accounts (id)
)

;
CREATE INDEX IF NOT EXISTS ix_console_coaching_notifications_account_id ON console_coaching_notifications (account_id);

CREATE TABLE IF NOT EXISTS console_coaching_plans (
	id VARCHAR(36) NOT NULL, 
	owner_id VARCHAR(36) NOT NULL, 
	athlete_id VARCHAR(36), 
	tenant_id VARCHAR(36), 
	template_id VARCHAR(36), 
	version INTEGER NOT NULL, 
	created_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	PRIMARY KEY (id), 
	CHECK (version >= 1), 
	FOREIGN KEY(owner_id) REFERENCES console_accounts (id), 
	FOREIGN KEY(athlete_id) REFERENCES console_accounts (id), 
	FOREIGN KEY(tenant_id) REFERENCES console_tenants (id), 
	FOREIGN KEY(template_id) REFERENCES console_coaching_plans (id)
)

;
CREATE INDEX IF NOT EXISTS ix_console_coaching_plans_owner_id ON console_coaching_plans (owner_id);
CREATE INDEX IF NOT EXISTS ix_console_coaching_plans_tenant_id ON console_coaching_plans (tenant_id);
CREATE INDEX IF NOT EXISTS ix_console_coaching_plans_athlete_id ON console_coaching_plans (athlete_id);

CREATE TABLE IF NOT EXISTS console_library_exercises (
	id VARCHAR(80) NOT NULL, 
	owner_id VARCHAR(36), 
	content JSON NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(owner_id) REFERENCES console_accounts (id)
)

;
CREATE INDEX IF NOT EXISTS ix_console_library_exercises_owner_id ON console_library_exercises (owner_id);

CREATE TABLE IF NOT EXISTS console_private_wellness (
	id VARCHAR(36) NOT NULL, 
	account_id VARCHAR(36) NOT NULL, 
	kind VARCHAR(20) NOT NULL, 
	content JSON NOT NULL, 
	occurred_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(account_id) REFERENCES console_accounts (id)
)

;
CREATE INDEX IF NOT EXISTS ix_console_private_wellness_account_id ON console_private_wellness (account_id);
CREATE INDEX IF NOT EXISTS ix_console_private_wellness_kind ON console_private_wellness (kind);
CREATE INDEX IF NOT EXISTS ix_console_private_wellness_occurred_at ON console_private_wellness (occurred_at);

CREATE TABLE IF NOT EXISTS console_weekly_reports (
	id VARCHAR(36) NOT NULL, 
	athlete_id VARCHAR(36) NOT NULL, 
	scope VARCHAR(36) NOT NULL, 
	week VARCHAR(10) NOT NULL, 
	timezone VARCHAR(80) NOT NULL, 
	status VARCHAR(30) NOT NULL, 
	content JSON NOT NULL, 
	created_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	PRIMARY KEY (id), 
	UNIQUE (athlete_id, week, timezone, scope), 
	FOREIGN KEY(athlete_id) REFERENCES console_accounts (id)
)

;
CREATE INDEX IF NOT EXISTS ix_console_weekly_reports_athlete_id ON console_weekly_reports (athlete_id);

CREATE TABLE IF NOT EXISTS console_wellness_consent (
	account_id VARCHAR(36) NOT NULL, 
	trainer_id VARCHAR(36) NOT NULL, 
	kind VARCHAR(20) NOT NULL, 
	allowed BOOLEAN NOT NULL, 
	PRIMARY KEY (account_id, trainer_id, kind), 
	FOREIGN KEY(account_id) REFERENCES console_accounts (id), 
	FOREIGN KEY(trainer_id) REFERENCES console_accounts (id)
)

;

CREATE TABLE IF NOT EXISTS console_wellness_preferences (
	account_id VARCHAR(36) NOT NULL, 
	water_goal_ml INTEGER NOT NULL, 
	PRIMARY KEY (account_id), 
	CHECK (water_goal_ml > 0 AND water_goal_ml <= 10000), 
	FOREIGN KEY(account_id) REFERENCES console_accounts (id)
)

;

CREATE TABLE IF NOT EXISTS console_coach_reviews (
	id VARCHAR(36) NOT NULL, 
	report_id VARCHAR(36) NOT NULL, 
	reviewer_id VARCHAR(36) NOT NULL, 
	status VARCHAR(30) NOT NULL, 
	fingerprint VARCHAR(64) NOT NULL, 
	created_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(report_id) REFERENCES console_weekly_reports (id), 
	FOREIGN KEY(reviewer_id) REFERENCES console_accounts (id)
)

;
CREATE INDEX IF NOT EXISTS ix_console_coach_reviews_reviewer_id ON console_coach_reviews (reviewer_id);
CREATE INDEX IF NOT EXISTS ix_console_coach_reviews_report_id ON console_coach_reviews (report_id);

CREATE TABLE IF NOT EXISTS console_coaching_messages (
	id VARCHAR(36) NOT NULL, 
	link_id VARCHAR(36) NOT NULL, 
	author_id VARCHAR(36) NOT NULL, 
	context_type VARCHAR(20) NOT NULL, 
	context_id VARCHAR(80), 
	body VARCHAR(4000) NOT NULL, 
	read_at TIMESTAMP WITH TIME ZONE, 
	created_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(link_id) REFERENCES console_coach_links (id), 
	FOREIGN KEY(author_id) REFERENCES console_accounts (id)
)

;
CREATE INDEX IF NOT EXISTS ix_console_coaching_messages_link_id ON console_coaching_messages (link_id);

CREATE TABLE IF NOT EXISTS console_exercise_favorites (
	account_id VARCHAR(36) NOT NULL, 
	exercise_id VARCHAR(80) NOT NULL, 
	PRIMARY KEY (account_id, exercise_id), 
	FOREIGN KEY(account_id) REFERENCES console_accounts (id), 
	FOREIGN KEY(exercise_id) REFERENCES console_library_exercises (id)
)

;

CREATE TABLE IF NOT EXISTS console_plan_versions (
	id VARCHAR(36) NOT NULL, 
	plan_id VARCHAR(36) NOT NULL, 
	version INTEGER NOT NULL, 
	actor_id VARCHAR(36) NOT NULL, 
	actor_role VARCHAR(20) NOT NULL, 
	reason VARCHAR(1000) NOT NULL, 
	review_status VARCHAR(20) NOT NULL, 
	reviewed_by VARCHAR(36), 
	reviewed_at TIMESTAMP WITH TIME ZONE, 
	content JSON NOT NULL, 
	previous JSON, 
	created_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	PRIMARY KEY (id), 
	UNIQUE (plan_id, version), 
	CHECK (version >= 1), 
	FOREIGN KEY(plan_id) REFERENCES console_coaching_plans (id), 
	FOREIGN KEY(actor_id) REFERENCES console_accounts (id), 
	FOREIGN KEY(reviewed_by) REFERENCES console_accounts (id)
)

;
CREATE INDEX IF NOT EXISTS ix_console_plan_versions_plan_id ON console_plan_versions (plan_id);

CREATE TABLE IF NOT EXISTS console_report_snapshots (
	id VARCHAR(36) NOT NULL, 
	report_id VARCHAR(36) NOT NULL, 
	status VARCHAR(30) NOT NULL, 
	content JSON NOT NULL, 
	captured_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(report_id) REFERENCES console_weekly_reports (id)
)

;
CREATE INDEX IF NOT EXISTS ix_console_report_snapshots_report_id ON console_report_snapshots (report_id);

CREATE TABLE IF NOT EXISTS console_workouts (
	id VARCHAR(36) NOT NULL, 
	athlete_id VARCHAR(36) NOT NULL, 
	plan_id VARCHAR(36) NOT NULL, 
	plan_version INTEGER NOT NULL, 
	session_key VARCHAR(36) NOT NULL, 
	scheduled_date VARCHAR(10) NOT NULL, 
	state VARCHAR(24) NOT NULL, 
	version INTEGER NOT NULL, 
	snapshot JSON NOT NULL, 
	actual JSON NOT NULL, 
	updated_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	PRIMARY KEY (id), 
	UNIQUE (plan_id, session_key, scheduled_date), 
	CHECK (version >= 1), 
	FOREIGN KEY(athlete_id) REFERENCES console_accounts (id), 
	FOREIGN KEY(plan_id) REFERENCES console_coaching_plans (id)
)

;
CREATE INDEX IF NOT EXISTS ix_console_workouts_athlete_id ON console_workouts (athlete_id);
CREATE INDEX IF NOT EXISTS ix_console_workouts_plan_id ON console_workouts (plan_id);
CREATE INDEX IF NOT EXISTS ix_console_workouts_scheduled_date ON console_workouts (scheduled_date);

CREATE TABLE IF NOT EXISTS console_equipment (
	id VARCHAR(36) NOT NULL, 
	tenant_id VARCHAR(36) NOT NULL, 
	tag_id VARCHAR(36), 
	name VARCHAR(160) NOT NULL, 
	equipment_type VARCHAR(80) NOT NULL, 
	exercise_ids JSON NOT NULL, 
	active BOOLEAN NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(tenant_id) REFERENCES console_tenants (id), 
	UNIQUE (tag_id), 
	FOREIGN KEY(tag_id) REFERENCES console_nfc_tags (id) ON DELETE SET NULL
)

;
CREATE INDEX IF NOT EXISTS ix_console_equipment_tenant_id ON console_equipment (tenant_id);

CREATE TABLE IF NOT EXISTS console_workout_events (
	id VARCHAR(36) NOT NULL, 
	workout_id VARCHAR(36) NOT NULL, 
	actor_id VARCHAR(36) NOT NULL, 
	fingerprint VARCHAR(64) NOT NULL, 
	command JSON NOT NULL, 
	result JSON NOT NULL, 
	created_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(workout_id) REFERENCES console_workouts (id), 
	FOREIGN KEY(actor_id) REFERENCES console_accounts (id)
)

;
CREATE INDEX IF NOT EXISTS ix_console_workout_events_actor_id ON console_workout_events (actor_id);
CREATE INDEX IF NOT EXISTS ix_console_workout_events_workout_id ON console_workout_events (workout_id);

-- Helper functions deliberately expose only current caller identity or a boolean.
create or replace function public.nfcfit_account_id() returns varchar
language sql stable security definer set search_path = public, pg_temp as $$
 select id from public.console_accounts where supabase_user_id = auth.uid()::text limit 1
$$;
create or replace function public.nfcfit_athlete_access(athlete varchar) returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
 select athlete = public.nfcfit_account_id() or exists (
 select 1 from public.console_coach_links l
 join public.console_tenants t on t.id=l.tenant_id and t.status='active'
 join public.console_tenant_staff s on s.tenant_id=l.tenant_id and s.account_id=l.trainer_id and s.status='active' and s.role in ('owner','admin','coach')
 join public.console_memberships m on m.tenant_id=l.tenant_id and m.account_id=l.athlete_id and m.status='active'
 where l.trainer_id=public.nfcfit_account_id() and l.athlete_id=athlete and l.active
 )
$$;
create or replace function public.nfcfit_link_access(link varchar) returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
 select exists(select 1 from public.console_coach_links l where l.id=link and l.active
 and public.nfcfit_account_id() in (l.trainer_id,l.athlete_id)
 and exists (select 1 from public.console_tenants t where t.id=l.tenant_id and t.status='active')
 and exists (select 1 from public.console_tenant_staff s where s.tenant_id=l.tenant_id and s.account_id=l.trainer_id and s.status='active' and s.role in ('owner','admin','coach'))
 and exists (select 1 from public.console_memberships m where m.tenant_id=l.tenant_id and m.account_id=l.athlete_id and m.status='active'))
$$;
create or replace function public.nfcfit_plan_access(plan varchar) returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
 select exists(select 1 from public.console_coaching_plans p where p.id=plan and
 ((p.athlete_id is null and p.owner_id=public.nfcfit_account_id()) or
 (p.athlete_id = public.nfcfit_account_id()) or (p.tenant_id is not null and exists(select 1 from public.console_coach_links l where l.tenant_id=p.tenant_id and l.athlete_id=p.athlete_id and l.trainer_id=public.nfcfit_account_id() and public.nfcfit_link_access(l.id)))))
$$;


alter table public.console_coach_reviews enable row level security;
revoke all on public.console_coach_reviews from anon, authenticated;
grant select on public.console_coach_reviews to authenticated;
drop policy if exists nfcfit_scoped_read on public.console_coach_reviews;
create policy nfcfit_scoped_read on public.console_coach_reviews for select to authenticated using (exists(select 1 from public.console_weekly_reports r where r.id=report_id));
alter table public.console_wellness_preferences enable row level security;
revoke all on public.console_wellness_preferences from anon, authenticated;
grant select on public.console_wellness_preferences to authenticated;
drop policy if exists nfcfit_scoped_read on public.console_wellness_preferences;
create policy nfcfit_scoped_read on public.console_wellness_preferences for select to authenticated using (account_id=public.nfcfit_account_id());
alter table public.console_report_snapshots enable row level security;
revoke all on public.console_report_snapshots from anon, authenticated;
grant select on public.console_report_snapshots to authenticated;
drop policy if exists nfcfit_scoped_read on public.console_report_snapshots;
create policy nfcfit_scoped_read on public.console_report_snapshots for select to authenticated using (exists(select 1 from public.console_weekly_reports r where r.id=report_id));
alter table public.console_coach_links enable row level security;
revoke all on public.console_coach_links from anon, authenticated;
grant select on public.console_coach_links to authenticated;
drop policy if exists nfcfit_scoped_read on public.console_coach_links;
create policy nfcfit_scoped_read on public.console_coach_links for select to authenticated using (public.nfcfit_link_access(id));
alter table public.console_library_exercises enable row level security;
revoke all on public.console_library_exercises from anon, authenticated;
grant select on public.console_library_exercises to authenticated;
drop policy if exists nfcfit_scoped_read on public.console_library_exercises;
create policy nfcfit_scoped_read on public.console_library_exercises for select to authenticated using (owner_id is null or owner_id=public.nfcfit_account_id());
alter table public.console_exercise_favorites enable row level security;
revoke all on public.console_exercise_favorites from anon, authenticated;
grant select on public.console_exercise_favorites to authenticated;
drop policy if exists nfcfit_scoped_read on public.console_exercise_favorites;
create policy nfcfit_scoped_read on public.console_exercise_favorites for select to authenticated using (account_id=public.nfcfit_account_id());
alter table public.console_coaching_plans enable row level security;
revoke all on public.console_coaching_plans from anon, authenticated;
grant select on public.console_coaching_plans to authenticated;
drop policy if exists nfcfit_scoped_read on public.console_coaching_plans;
create policy nfcfit_scoped_read on public.console_coaching_plans for select to authenticated using (public.nfcfit_plan_access(id));
alter table public.console_plan_versions enable row level security;
revoke all on public.console_plan_versions from anon, authenticated;
grant select on public.console_plan_versions to authenticated;
drop policy if exists nfcfit_scoped_read on public.console_plan_versions;
create policy nfcfit_scoped_read on public.console_plan_versions for select to authenticated using (public.nfcfit_plan_access(plan_id));
alter table public.console_workouts enable row level security;
revoke all on public.console_workouts from anon, authenticated;
grant select on public.console_workouts to authenticated;
drop policy if exists nfcfit_scoped_read on public.console_workouts;
create policy nfcfit_scoped_read on public.console_workouts for select to authenticated using (public.nfcfit_plan_access(plan_id));
alter table public.console_workout_events enable row level security;
revoke all on public.console_workout_events from anon, authenticated;
grant select on public.console_workout_events to authenticated;
drop policy if exists nfcfit_scoped_read on public.console_workout_events;
create policy nfcfit_scoped_read on public.console_workout_events for select to authenticated using (exists(select 1 from public.console_workouts w where w.id=workout_id and public.nfcfit_plan_access(w.plan_id)));
alter table public.console_weekly_reports enable row level security;
revoke all on public.console_weekly_reports from anon, authenticated;
grant select on public.console_weekly_reports to authenticated;
drop policy if exists nfcfit_scoped_read on public.console_weekly_reports;
create policy nfcfit_scoped_read on public.console_weekly_reports for select to authenticated using (athlete_id=public.nfcfit_account_id() or (scope <> 'all' and exists(select 1 from public.console_coach_links l where l.tenant_id=scope and l.athlete_id=console_weekly_reports.athlete_id and l.trainer_id=public.nfcfit_account_id() and public.nfcfit_link_access(l.id))));
alter table public.console_coaching_messages enable row level security;
revoke all on public.console_coaching_messages from anon, authenticated;
grant select on public.console_coaching_messages to authenticated;
drop policy if exists nfcfit_scoped_read on public.console_coaching_messages;
create policy nfcfit_scoped_read on public.console_coaching_messages for select to authenticated using (public.nfcfit_link_access(link_id));
alter table public.console_coaching_notifications enable row level security;
revoke all on public.console_coaching_notifications from anon, authenticated;
grant select on public.console_coaching_notifications to authenticated;
drop policy if exists nfcfit_scoped_read on public.console_coaching_notifications;
create policy nfcfit_scoped_read on public.console_coaching_notifications for select to authenticated using (account_id=public.nfcfit_account_id());
alter table public.console_private_wellness enable row level security;
revoke all on public.console_private_wellness from anon, authenticated;
grant select on public.console_private_wellness to authenticated;
drop policy if exists nfcfit_scoped_read on public.console_private_wellness;
create policy nfcfit_scoped_read on public.console_private_wellness for select to authenticated using (account_id=public.nfcfit_account_id() or (public.nfcfit_athlete_access(account_id) and exists(select 1 from public.console_wellness_consent c where c.account_id=console_private_wellness.account_id and c.trainer_id=public.nfcfit_account_id() and c.kind=console_private_wellness.kind and c.allowed)));
alter table public.console_wellness_consent enable row level security;
revoke all on public.console_wellness_consent from anon, authenticated;
grant select on public.console_wellness_consent to authenticated;
drop policy if exists nfcfit_scoped_read on public.console_wellness_consent;
create policy nfcfit_scoped_read on public.console_wellness_consent for select to authenticated using (account_id=public.nfcfit_account_id() or (trainer_id=public.nfcfit_account_id() and public.nfcfit_athlete_access(account_id)));
alter table public.console_equipment enable row level security;
revoke all on public.console_equipment from anon, authenticated;
grant select on public.console_equipment to authenticated;
drop policy if exists nfcfit_scoped_read on public.console_equipment;
create policy nfcfit_scoped_read on public.console_equipment for select to authenticated using (exists(select 1 from public.console_tenants t where t.id=tenant_id and t.status='active') and (exists(select 1 from public.console_memberships m where m.tenant_id=console_equipment.tenant_id and m.account_id=public.nfcfit_account_id() and m.status='active') or exists(select 1 from public.console_tenant_staff s where s.tenant_id=console_equipment.tenant_id and s.account_id=public.nfcfit_account_id() and s.status='active')));
-- Legacy console tables remain backend-only; avoid exposing password hashes and member lists.
alter table public.console_accounts enable row level security;
revoke all on public.console_accounts from anon, authenticated;
-- Legacy console tables remain backend-only; avoid exposing password hashes and member lists.
alter table public.console_tenants enable row level security;
revoke all on public.console_tenants from anon, authenticated;
-- Legacy console tables remain backend-only; avoid exposing password hashes and member lists.
alter table public.console_tenant_staff enable row level security;
revoke all on public.console_tenant_staff from anon, authenticated;
-- Legacy console tables remain backend-only; avoid exposing password hashes and member lists.
alter table public.console_memberships enable row level security;
revoke all on public.console_memberships from anon, authenticated;
-- Legacy console tables remain backend-only; avoid exposing password hashes and member lists.
alter table public.console_exercises enable row level security;
revoke all on public.console_exercises from anon, authenticated;
-- Legacy console tables remain backend-only; avoid exposing password hashes and member lists.
alter table public.console_nfc_tags enable row level security;
revoke all on public.console_nfc_tags from anon, authenticated;
-- Legacy console tables remain backend-only; avoid exposing password hashes and member lists.
alter table public.console_activities enable row level security;
revoke all on public.console_activities from anon, authenticated;
-- Legacy console tables remain backend-only; avoid exposing password hashes and member lists.
alter table public.console_member_exercise_goals enable row level security;
revoke all on public.console_member_exercise_goals from anon, authenticated;
revoke all on function public.nfcfit_account_id() from public, anon;
grant execute on function public.nfcfit_account_id() to authenticated;
revoke all on function public.nfcfit_athlete_access(varchar) from public, anon;
grant execute on function public.nfcfit_athlete_access(varchar) to authenticated;
revoke all on function public.nfcfit_plan_access(varchar) from public, anon;
grant execute on function public.nfcfit_plan_access(varchar) to authenticated;
revoke all on function public.nfcfit_link_access(varchar) from public, anon;
grant execute on function public.nfcfit_link_access(varchar) to authenticated;

create or replace function public.nfcfit_preserve_plan_version() returns trigger
language plpgsql set search_path=public,pg_temp as $$
begin
 if TG_OP='DELETE' then raise exception 'Plan versions cannot be deleted'; end if;
 if (to_jsonb(NEW)-'review_status'-'reviewed_by'-'reviewed_at') is distinct from (to_jsonb(OLD)-'review_status'-'reviewed_by'-'reviewed_at') then
  raise exception 'Historical plan versions are immutable';
 end if;
 return NEW;
end $$;
drop trigger if exists nfcfit_preserve_plan_version on public.console_plan_versions;
create trigger nfcfit_preserve_plan_version before update or delete on public.console_plan_versions for each row execute function public.nfcfit_preserve_plan_version();
create or replace function public.nfcfit_preserve_terminal_workout() returns trigger
language plpgsql set search_path=public,pg_temp as $$
begin
 if OLD.state in ('completed','partial','skipped','cancelled') then
  if TG_OP='DELETE' then raise exception 'Completed workouts cannot be deleted'; end if;
  if to_jsonb(NEW) is distinct from to_jsonb(OLD) then raise exception 'Completed workouts are immutable'; end if;
 end if;
 if TG_OP='DELETE' then return OLD; end if;
 return NEW;
end $$;
drop trigger if exists nfcfit_preserve_terminal_workout on public.console_workouts;
create trigger nfcfit_preserve_terminal_workout before update or delete on public.console_workouts for each row execute function public.nfcfit_preserve_terminal_workout();
create or replace function public.nfcfit_immutable_ledger() returns trigger
language plpgsql set search_path=public,pg_temp as $$
begin raise exception 'Audit ledger is immutable'; end $$;

drop trigger if exists nfcfit_immutable_ledger on public.console_workout_events;
create trigger nfcfit_immutable_ledger before update or delete on public.console_workout_events for each row execute function public.nfcfit_immutable_ledger();
drop trigger if exists nfcfit_immutable_ledger on public.console_report_snapshots;
create trigger nfcfit_immutable_ledger before update or delete on public.console_report_snapshots for each row execute function public.nfcfit_immutable_ledger();
drop trigger if exists nfcfit_immutable_ledger on public.console_coach_reviews;
create trigger nfcfit_immutable_ledger before update or delete on public.console_coach_reviews for each row execute function public.nfcfit_immutable_ledger();
commit;
