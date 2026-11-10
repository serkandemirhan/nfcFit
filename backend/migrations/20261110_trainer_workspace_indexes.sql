-- Additive supporting indexes. No table/role/data rewrite.
CREATE INDEX IF NOT EXISTS ix_trainer_plan_tenant_athlete ON console_coaching_plans(tenant_id, athlete_id);
CREATE INDEX IF NOT EXISTS ix_trainer_version_review ON console_plan_versions(plan_id, review_status);
CREATE INDEX IF NOT EXISTS ix_trainer_workout_member_date ON console_workouts(athlete_id, scheduled_date, id);
