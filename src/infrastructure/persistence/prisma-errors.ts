// Prisma reports the error code on `error.code`, not inside `error.message` —
// matching on the message text never fires.
export function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    (error as { code?: unknown }).code === 'P2002'
  );
}
