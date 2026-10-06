// Source: src/application/billing/services/billNoticeText.ts

import {
  billEmail,
  reminderEmail,
  reminderTemplateParams
} from '../../../../src/application/billing/services';
import { Money } from '../../../../src/domain/shared/value-objects';

const CONTENT = {
  fullName: 'Ana Gómez',
  period: '2026-10',
  total: Money.create(109333).value,
  cutDay: new Date('2026-10-19T00:00:00.000Z')
};

describe('billNoticeText', () => {
  it('[BIL-320] the bill email names the period, the amount in pesos and the due day', () => {
    const email = billEmail({
      ...CONTENT,
      dueDate: new Date('2026-10-16T04:59:59.999Z')
    });

    expect(email.subject).toBe('Su cuenta del periodo 2026-10');
    expect(email.text).toContain('Hola Ana Gómez');
    expect(email.text).toContain('$109.333');
    expect(email.text).toContain('15 de octubre de 2026');
  });

  it('[BIL-321] the reminder email names the cut day', () => {
    const email = reminderEmail(CONTENT);

    expect(email.text).toContain('$109.333');
    expect(email.text).toContain(
      'se suspenderá el 19 de octubre de 2026'
    );
  });

  it('[BIL-322] the WhatsApp parameters are name, period, amount and cut day', () => {
    expect(reminderTemplateParams(CONTENT)).toEqual([
      'Ana Gómez',
      '2026-10',
      '$109.333',
      '19 de octubre de 2026'
    ]);
  });
});
