export type ClubRole = 'PLATFORM_ADMIN' | 'CLUB_ADMIN' | 'CLUB_MANAGER' | 'TRAINER' | 'CLUB_MEMBER';
const aliases: Record<string, ClubRole> = { owner: 'CLUB_ADMIN', admin: 'CLUB_MANAGER', coach: 'TRAINER' };
export const canonicalRole = (role: string): string => aliases[role] ?? role;
export const isClubAdmin = (role: string) => canonicalRole(role) === 'CLUB_ADMIN';
export const isClubOperator = (role: string) => ['CLUB_ADMIN', 'CLUB_MANAGER'].includes(canonicalRole(role));
export const isClubTrainer = (role: string) => ['CLUB_ADMIN', 'TRAINER'].includes(canonicalRole(role));
