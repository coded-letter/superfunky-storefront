export function normalizeCommunityMemberType(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase().replace(/\s+/g, "-");
  if (!/^[a-z0-9_-]+$/.test(normalized)) return null;
  return normalized === "administrator" ? "admin" : normalized;
}

export function normalizeCommunityMemberTypes(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return Array.from(new Set(value.flatMap((item) => {
    const normalized = normalizeCommunityMemberType(item);
    return normalized ? [normalized] : [];
  })));
}

export function communityMemberMatchesRoles(memberTypes: unknown, requestedRoles: readonly string[]): boolean {
  const normalizedMemberTypes = normalizeCommunityMemberTypes(memberTypes);
  if (!normalizedMemberTypes.length) return false;
  if (!requestedRoles.length) return true;
  return requestedRoles.some((role) => {
    const normalizedRole = normalizeCommunityMemberType(role);
    return normalizedRole ? normalizedMemberTypes.includes(normalizedRole) : false;
  });
}
