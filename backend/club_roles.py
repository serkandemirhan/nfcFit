"""Product roles. Legacy values remain readable; no stored role is rewritten."""
PLATFORM_ADMIN = "PLATFORM_ADMIN"
CLUB_ADMIN = "CLUB_ADMIN"
CLUB_MANAGER = "CLUB_MANAGER"
TRAINER = "TRAINER"
CLUB_MEMBER = "CLUB_MEMBER"
ALIASES = {"owner": CLUB_ADMIN, "admin": CLUB_MANAGER, "coach": TRAINER}
STAFF_ROLES = frozenset({CLUB_ADMIN, CLUB_MANAGER, TRAINER})
OPERATORS = frozenset({CLUB_ADMIN, CLUB_MANAGER})
COACH_ROLES = frozenset({"owner", "coach", CLUB_ADMIN, TRAINER})

def canonical_role(value):
    return ALIASES.get(value, value)

def permits(value, allowed):
    return canonical_role(value) in {canonical_role(role) for role in allowed}
