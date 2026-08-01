// Source: src/infrastructure/persistence/prisma-errors.ts

import {
  isForeignKeyViolation,
  isRecordNotFound,
  isUniqueViolation
} from '../../../src/infrastructure/persistence/prisma-errors';

// ---------------------------------------------------------------------------
// Fixture helpers
// ---------------------------------------------------------------------------

function makePrismaError(code: string, message: string): Error {
  const error = new Error(message);
  (error as Error & { code: string }).code = code;
  return error;
}

// ---------------------------------------------------------------------------

describe('prisma-errors', () => {
  const cases: Array<{
    name: string;
    code: string;
    predicate: (error: unknown) => boolean;
  }> = [
    {
      name: 'isUniqueViolation',
      code: 'P2002',
      predicate: isUniqueViolation
    },
    {
      name: 'isForeignKeyViolation',
      code: 'P2003',
      predicate: isForeignKeyViolation
    },
    {
      name: 'isRecordNotFound',
      code: 'P2025',
      predicate: isRecordNotFound
    }
  ];

  describe.each(cases)('$name', ({ code, predicate }) => {
    it(`matches an error carrying ${code} on error.code`, () => {
      expect(
        predicate(makePrismaError(code, 'Operation failed'))
      ).toBe(true);
    });

    it(`does not match an error that only mentions ${code} in its message`, () => {
      expect(predicate(new Error(`Operation failed ${code}`))).toBe(
        false
      );
    });

    it('does not match another Prisma code', () => {
      expect(
        predicate(makePrismaError('P1001', 'Cannot reach database'))
      ).toBe(false);
    });

    it('does not match non-error values', () => {
      expect(predicate(null)).toBe(false);
      expect(predicate(undefined)).toBe(false);
      expect(predicate('P2002')).toBe(false);
    });
  });
});
