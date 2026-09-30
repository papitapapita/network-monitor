// Source: src/infrastructure/di/installersDir.ts

import { loadInstallersDir } from '../../../src/infrastructure/di/installersDir';

describe('[INS-042] loadInstallersDir', () => {
  it('returns null when unset or blank', () => {
    expect(loadInstallersDir({})).toBeNull();
    expect(loadInstallersDir({ INSTALLERS_DIR: '  ' })).toBeNull();
  });

  it('returns an absolute path, trimmed', () => {
    expect(
      loadInstallersDir({ INSTALLERS_DIR: ' /srv/nms/installers ' })
    ).toBe('/srv/nms/installers');
  });

  it('stops the boot on a relative path', () => {
    expect(() =>
      loadInstallersDir({ INSTALLERS_DIR: 'installers' })
    ).toThrow(
      'INSTALLERS_DIR: expected an absolute path, got "installers"'
    );
  });
});
