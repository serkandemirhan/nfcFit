import { canonicalRole, isClubOperator, isClubTrainer } from "./club-roles";
import type { ConsoleIdentity } from "./tenant-console";

type Identity = ConsoleIdentity | null | undefined;
export function activeStaff(identity: Identity, tenantId?: string) {
  return (
    identity?.staff.filter(
      (s) =>
        s.status === "active" && (!tenantId || s.tenant_id === tenantId) &&
        (s.tenant_status == null || s.tenant_status === "active"),
    ) ?? []
  );
}
/** Facility roles never follow from ordinary membership or a coach assignment. */
export function canOpenCoachArea(identity: Identity, tenantId?: string) {
  return activeStaff(identity, tenantId).some((s) =>
    isClubTrainer(s.role),
  );
}
export function isCoach(identity: Identity) {
  return activeStaff(identity).some((s) => canonicalRole(s.role) === "TRAINER");
}
export function canOpenManagement(identity: Identity, tenantId?: string) {
  return Boolean(
    (!tenantId && identity?.account.is_platform_admin) ||
    activeStaff(identity, tenantId).some((s) => isClubOperator(s.role)),
  );
}
