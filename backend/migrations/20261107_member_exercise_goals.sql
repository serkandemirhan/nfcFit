-- Also created by initialize_console_schema. Existing activities remain unchanged.
BEGIN;
CREATE TABLE IF NOT EXISTS console_member_exercise_goals (
    id VARCHAR(36) PRIMARY KEY,
    account_id VARCHAR(36) NOT NULL REFERENCES console_accounts(id) ON DELETE CASCADE,
    exercise_id VARCHAR(36) NOT NULL REFERENCES console_exercises(id) ON DELETE CASCADE,
    unit VARCHAR(20) NOT NULL,
    target_quantity DOUBLE PRECISION NOT NULL,
    CONSTRAINT uq_console_member_exercise_goal UNIQUE (account_id, exercise_id, unit)
);
CREATE INDEX IF NOT EXISTS ix_console_member_exercise_goals_account_id ON console_member_exercise_goals(account_id);
CREATE INDEX IF NOT EXISTS ix_console_member_exercise_goals_exercise_id ON console_member_exercise_goals(exercise_id);
COMMIT;
