// Prisma reports the error code on `error.code`, not inside `error.message` —
// matching on the message text never fires.
function hasCode(error: unknown, code: string): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    (error as { code?: unknown }).code === code
  );
}

export function isUniqueViolation(error: unknown): boolean {
  return hasCode(error, 'P2002');
}

export function isForeignKeyViolation(error: unknown): boolean {
  return hasCode(error, 'P2003');
}

export function isRecordNotFound(error: unknown): boolean {
  return hasCode(error, 'P2025');
}
