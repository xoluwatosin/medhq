// The owner of the Admin Centre. Only this account may force other admins to
// sign out or reset their passwords, and it can never be switched off. The
// database holds the same rule in private.is_super_admin, which functions
// cannot call, so the ID is kept here once for every function that needs it.
export const SUPER_ADMIN_ID = "af2fac7f-86db-483f-831e-3cb38454a30c";

export const isSuperAdmin = (userId: string | null | undefined): boolean => userId === SUPER_ADMIN_ID;
