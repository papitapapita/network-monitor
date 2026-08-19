// Source: src/domain/device-inventory/aggregates/Vendor.ts

import {
  Vendor,
  VendorProps
} from '../../../../src/domain/device-inventory';
import { VendorId } from '../../../../src/domain/shared';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

type CreateVendorProps = Omit<VendorProps, 'createdAt' | 'updatedAt'>;

function makeProps(
  overrides: Partial<CreateVendorProps> = {}
): CreateVendorProps {
  return {
    name: 'Cisco',
    slug: 'cisco',
    description: null,
    ...overrides
  };
}

function makeVendor(
  overrides: Partial<CreateVendorProps> = {}
): Vendor {
  const result = Vendor.create(makeProps(overrides));
  if (result.isFailure) {
    throw new Error(`makeVendor: ${result.error}`);
  }
  return result.value;
}

// ---------------------------------------------------------------------------
describe('Vendor', () => {
  // =========================================================================
  describe('create()', () => {
    describe('when given valid required-only props', () => {
      it('should return a successful Result', () => {
        const result = Vendor.create(makeProps());

        expect(result.isSuccess).toBe(true);
        expect(result.isFailure).toBe(false);
      });

      it('should return a Vendor instance', () => {
        const result = Vendor.create(makeProps());

        expect(result.value).toBeInstanceOf(Vendor);
      });

      it('should assign a valid VendorId', () => {
        const vendor = makeVendor();

        expect(vendor.id).toBeInstanceOf(VendorId);
        expect(vendor.id.toValue().length).toBeGreaterThan(0);
      });

      it('should expose the provided name', () => {
        const vendor = makeVendor({ name: 'MikroTik' });

        expect(vendor.name).toBe('MikroTik');
      });

      it('should expose the provided slug', () => {
        const vendor = makeVendor({ slug: 'mikrotik' });

        expect(vendor.slug).toBe('mikrotik');
      });

      it('should default description to null when not provided', () => {
        const vendor = makeVendor({ description: null });

        expect(vendor.description).toBeNull();
      });

      it('should expose the provided description when given', () => {
        const vendor = makeVendor({
          description: 'Leading networking vendor'
        });

        expect(vendor.description).toBe('Leading networking vendor');
      });

      it('should set createdAt and updatedAt to recent timestamps', () => {
        const before = new Date();
        const vendor = makeVendor();
        const after = new Date();

        expect(vendor.createdAt.getTime()).toBeGreaterThanOrEqual(
          before.getTime()
        );
        expect(vendor.createdAt.getTime()).toBeLessThanOrEqual(
          after.getTime()
        );
        expect(vendor.updatedAt.getTime()).toBeGreaterThanOrEqual(
          before.getTime()
        );
        expect(vendor.updatedAt.getTime()).toBeLessThanOrEqual(
          after.getTime()
        );
      });

      it('should generate unique IDs for each created Vendor', () => {
        const a = makeVendor();
        const b = makeVendor();

        expect(a.id.toString()).not.toBe(b.id.toString());
      });
    });

    // -----------------------------------------------------------------------
    describe('[DEV-001] [DEV-006] required field validation', () => {
      it('should fail when name is null', () => {
        const result = Vendor.create(
          makeProps({ name: null as unknown as string })
        );

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('name');
      });

      it('should fail when name is undefined', () => {
        const result = Vendor.create(
          makeProps({ name: undefined as unknown as string })
        );

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('name');
      });

      it('should fail when name is an empty string', () => {
        const result = Vendor.create(makeProps({ name: '' }));

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('empty');
      });

      it('should fail when name is a whitespace-only string', () => {
        const result = Vendor.create(makeProps({ name: '   ' }));

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('empty');
      });

      it('should fail when name exceeds 100 characters', () => {
        const result = Vendor.create(
          makeProps({ name: 'A'.repeat(101) })
        );

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('100');
      });

      it('should succeed when name is exactly 100 characters', () => {
        const result = Vendor.create(
          makeProps({ name: 'A'.repeat(100) })
        );

        expect(result.isSuccess).toBe(true);
      });

      it('should fail when slug is null', () => {
        const result = Vendor.create(
          makeProps({ slug: null as unknown as string })
        );

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('slug');
      });

      it('should fail when slug is undefined', () => {
        const result = Vendor.create(
          makeProps({ slug: undefined as unknown as string })
        );

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('slug');
      });

      it('should fail when slug is an empty string', () => {
        const result = Vendor.create(makeProps({ slug: '' }));

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('empty');
      });

      it('should fail when slug exceeds 100 characters', () => {
        const result = Vendor.create(
          makeProps({ slug: 'a'.repeat(101) })
        );

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('100');
      });

      it('should succeed when slug is exactly 100 characters', () => {
        const result = Vendor.create(
          makeProps({ slug: 'a'.repeat(100) })
        );

        expect(result.isSuccess).toBe(true);
      });
    });

    // -----------------------------------------------------------------------
    describe('[DEV-002] slug format validation', () => {
      it('should succeed for a simple lowercase slug', () => {
        const result = Vendor.create(makeProps({ slug: 'cisco' }));

        expect(result.isSuccess).toBe(true);
      });

      it('should succeed for a hyphenated slug', () => {
        const result = Vendor.create(makeProps({ slug: 'tp-link' }));

        expect(result.isSuccess).toBe(true);
      });

      it('should succeed for a slug with digits', () => {
        const result = Vendor.create(
          makeProps({ slug: 'vendor123' })
        );

        expect(result.isSuccess).toBe(true);
      });

      it('should succeed for a slug mixing letters, digits and hyphens', () => {
        const result = Vendor.create(
          makeProps({ slug: 'vendor-1-inc' })
        );

        expect(result.isSuccess).toBe(true);
      });

      it('should fail for a slug with uppercase letters', () => {
        const result = Vendor.create(makeProps({ slug: 'Cisco' }));

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('lowercase');
      });

      it('should fail for a slug with spaces', () => {
        const result = Vendor.create(makeProps({ slug: 'tp link' }));

        expect(result.isFailure).toBe(true);
      });

      it('should fail for a slug with underscores', () => {
        const result = Vendor.create(makeProps({ slug: 'tp_link' }));

        expect(result.isFailure).toBe(true);
      });

      it('should fail for a slug starting with a hyphen', () => {
        const result = Vendor.create(makeProps({ slug: '-cisco' }));

        expect(result.isFailure).toBe(true);
      });

      it('should fail for a slug ending with a hyphen', () => {
        const result = Vendor.create(makeProps({ slug: 'cisco-' }));

        expect(result.isFailure).toBe(true);
      });

      it('should fail for a slug with consecutive hyphens', () => {
        const result = Vendor.create(makeProps({ slug: 'tp--link' }));

        expect(result.isFailure).toBe(true);
      });

      it('should fail for a slug with special characters', () => {
        const result = Vendor.create(
          makeProps({ slug: 'cisco@net' })
        );

        expect(result.isFailure).toBe(true);
      });
    });

    // -----------------------------------------------------------------------
    describe('[DEV-004] description validation', () => {
      it('should fail when description exceeds 500 characters', () => {
        const result = Vendor.create(
          makeProps({ description: 'A'.repeat(501) })
        );

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('500');
      });

      it('should succeed when description is exactly 500 characters', () => {
        const result = Vendor.create(
          makeProps({ description: 'A'.repeat(500) })
        );

        expect(result.isSuccess).toBe(true);
      });

      it('should succeed when description is null', () => {
        const result = Vendor.create(
          makeProps({ description: null })
        );

        expect(result.isSuccess).toBe(true);
      });
    });
  });

  // =========================================================================
  describe('reconstitute()', () => {
    it('should return a Vendor instance without emitting domain events', () => {
      const id = VendorId.create();
      const now = new Date();
      const vendor = Vendor.reconstitute(id, {
        ...makeProps(),
        createdAt: now,
        updatedAt: now
      });

      expect(vendor).toBeInstanceOf(Vendor);
      expect(vendor.domainEvents.length).toBe(0);
    });

    it('should use the provided ID', () => {
      const id = VendorId.create();
      const now = new Date();
      const vendor = Vendor.reconstitute(id, {
        ...makeProps(),
        createdAt: now,
        updatedAt: now
      });

      expect(vendor.id).toBe(id);
    });

    it('should expose all props it was given', () => {
      const id = VendorId.create();
      const createdAt = new Date('2023-01-01T00:00:00Z');
      const updatedAt = new Date('2023-06-01T00:00:00Z');

      const vendor = Vendor.reconstitute(id, {
        name: 'HP',
        slug: 'hp',
        description: 'Enterprise hardware vendor',
        createdAt,
        updatedAt
      });

      expect(vendor.name).toBe('HP');
      expect(vendor.slug).toBe('hp');
      expect(vendor.description).toBe('Enterprise hardware vendor');
      expect(vendor.createdAt).toEqual(createdAt);
      expect(vendor.updatedAt).toEqual(updatedAt);
    });

    it('should expose null description when reconstituted with null', () => {
      const id = VendorId.create();
      const now = new Date();
      const vendor = Vendor.reconstitute(id, {
        ...makeProps({ description: null }),
        createdAt: now,
        updatedAt: now
      });

      expect(vendor.description).toBeNull();
    });
  });

  // =========================================================================
  describe('updateName()', () => {
    describe('happy path', () => {
      it('should return a successful Result when given a valid new name', () => {
        const vendor = makeVendor({ name: 'Cisco' });
        const result = vendor.updateName('MikroTik');

        expect(result.isSuccess).toBe(true);
      });

      it('should update the name prop', () => {
        const vendor = makeVendor({ name: 'Cisco' });
        vendor.updateName('MikroTik');

        expect(vendor.name).toBe('MikroTik');
      });

      it('should trim whitespace from the new name', () => {
        const vendor = makeVendor();
        vendor.updateName('  MikroTik  ');

        expect(vendor.name).toBe('MikroTik');
      });

      it('should update updatedAt timestamp', () => {
        const vendor = makeVendor();
        const before = new Date();
        vendor.updateName('MikroTik');
        const after = new Date();

        expect(vendor.updatedAt.getTime()).toBeGreaterThanOrEqual(
          before.getTime()
        );
        expect(vendor.updatedAt.getTime()).toBeLessThanOrEqual(
          after.getTime()
        );
      });
    });

    // -----------------------------------------------------------------------
    describe('no-op when name is unchanged', () => {
      it('should return a successful Result and emit no events', () => {
        const vendor = makeVendor({ name: 'Cisco' });
        vendor.clearEvents();
        const result = vendor.updateName('Cisco');

        expect(result.isSuccess).toBe(true);
        expect(vendor.domainEvents.length).toBe(0);
      });

      it('should not change updatedAt when the value is the same', () => {
        const vendor = makeVendor({ name: 'Cisco' });
        const updatedAtBefore = vendor.updatedAt;
        vendor.updateName('Cisco');

        expect(vendor.updatedAt).toBe(updatedAtBefore);
      });
    });

    // -----------------------------------------------------------------------
    describe('[DEV-001] validation failures', () => {
      it('should fail when newName is null', () => {
        const vendor = makeVendor();
        const result = vendor.updateName(null as unknown as string);

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('name');
      });

      it('should fail when newName is undefined', () => {
        const vendor = makeVendor();
        const result = vendor.updateName(
          undefined as unknown as string
        );

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('name');
      });

      it('should fail when newName is an empty string', () => {
        const vendor = makeVendor();
        const result = vendor.updateName('');

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('empty');
      });

      it('should fail when newName is a whitespace-only string', () => {
        const vendor = makeVendor();
        const result = vendor.updateName('   ');

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('empty');
      });

      it('should fail when newName exceeds 100 characters', () => {
        const vendor = makeVendor();
        const result = vendor.updateName('A'.repeat(101));

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('100');
      });

      it('should not change the name when validation fails', () => {
        const vendor = makeVendor({ name: 'Cisco' });
        vendor.updateName('');

        expect(vendor.name).toBe('Cisco');
      });
    });
  });

  // =========================================================================
  describe('updateSlug()', () => {
    describe('happy path', () => {
      it('should return a successful Result when given a valid new slug', () => {
        const vendor = makeVendor({ slug: 'cisco' });
        const result = vendor.updateSlug('mikrotik');

        expect(result.isSuccess).toBe(true);
      });

      it('should update the slug prop', () => {
        const vendor = makeVendor({ slug: 'cisco' });
        vendor.updateSlug('mikrotik');

        expect(vendor.slug).toBe('mikrotik');
      });

      it('should trim whitespace from the new slug', () => {
        const vendor = makeVendor();
        vendor.updateSlug('  mikrotik  ');

        expect(vendor.slug).toBe('mikrotik');
      });

      it('should update updatedAt timestamp', () => {
        const vendor = makeVendor();
        const before = new Date();
        vendor.updateSlug('mikrotik');
        const after = new Date();

        expect(vendor.updatedAt.getTime()).toBeGreaterThanOrEqual(
          before.getTime()
        );
        expect(vendor.updatedAt.getTime()).toBeLessThanOrEqual(
          after.getTime()
        );
      });
    });

    // -----------------------------------------------------------------------
    describe('no-op when slug is unchanged', () => {
      it('should return a successful Result and emit no events', () => {
        const vendor = makeVendor({ slug: 'cisco' });
        vendor.clearEvents();
        const result = vendor.updateSlug('cisco');

        expect(result.isSuccess).toBe(true);
        expect(vendor.domainEvents.length).toBe(0);
      });

      it('should not change updatedAt when the value is the same', () => {
        const vendor = makeVendor({ slug: 'cisco' });
        const updatedAtBefore = vendor.updatedAt;
        vendor.updateSlug('cisco');

        expect(vendor.updatedAt).toBe(updatedAtBefore);
      });
    });

    // -----------------------------------------------------------------------
    describe('[DEV-002] validation failures', () => {
      it('should fail when newSlug is null', () => {
        const vendor = makeVendor();
        const result = vendor.updateSlug(null as unknown as string);

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('slug');
      });

      it('should fail when newSlug is undefined', () => {
        const vendor = makeVendor();
        const result = vendor.updateSlug(
          undefined as unknown as string
        );

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('slug');
      });

      it('should fail when newSlug is an empty string', () => {
        const vendor = makeVendor();
        const result = vendor.updateSlug('');

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('empty');
      });

      it('should fail when newSlug exceeds 100 characters', () => {
        const vendor = makeVendor();
        const result = vendor.updateSlug('a'.repeat(101));

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('100');
      });

      it('should fail when newSlug contains uppercase letters', () => {
        const vendor = makeVendor();
        const result = vendor.updateSlug('Cisco');

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('lowercase');
      });

      it('should fail when newSlug contains spaces', () => {
        const vendor = makeVendor();
        const result = vendor.updateSlug('tp link');

        expect(result.isFailure).toBe(true);
      });

      it('should fail when newSlug starts with a hyphen', () => {
        const vendor = makeVendor();
        const result = vendor.updateSlug('-cisco');

        expect(result.isFailure).toBe(true);
      });

      it('should fail when newSlug ends with a hyphen', () => {
        const vendor = makeVendor();
        const result = vendor.updateSlug('cisco-');

        expect(result.isFailure).toBe(true);
      });

      it('should fail when newSlug has consecutive hyphens', () => {
        const vendor = makeVendor();
        const result = vendor.updateSlug('tp--link');

        expect(result.isFailure).toBe(true);
      });

      it('should not change the slug when validation fails', () => {
        const vendor = makeVendor({ slug: 'cisco' });
        vendor.updateSlug('InvalidSlug!');

        expect(vendor.slug).toBe('cisco');
      });
    });
  });

  // =========================================================================
  describe('updateDescription()', () => {
    describe('happy path', () => {
      it('should return a successful Result when given a valid description', () => {
        const vendor = makeVendor({ description: null });
        const result = vendor.updateDescription(
          'A leading networking vendor'
        );

        expect(result.isSuccess).toBe(true);
      });

      it('should update the description prop', () => {
        const vendor = makeVendor({ description: null });
        vendor.updateDescription('A leading networking vendor');

        expect(vendor.description).toBe(
          'A leading networking vendor'
        );
      });

      it('should allow setting description to null', () => {
        const vendor = makeVendor({
          description: 'Some description'
        });
        const result = vendor.updateDescription(null);

        expect(result.isSuccess).toBe(true);
        expect(vendor.description).toBeNull();
      });

      it('should update updatedAt timestamp', () => {
        const vendor = makeVendor({ description: null });
        const before = new Date();
        vendor.updateDescription('New description');
        const after = new Date();

        expect(vendor.updatedAt.getTime()).toBeGreaterThanOrEqual(
          before.getTime()
        );
        expect(vendor.updatedAt.getTime()).toBeLessThanOrEqual(
          after.getTime()
        );
      });

      it('should succeed when description is exactly 500 characters', () => {
        const vendor = makeVendor({ description: null });
        const result = vendor.updateDescription('A'.repeat(500));

        expect(result.isSuccess).toBe(true);
      });
    });

    // -----------------------------------------------------------------------
    describe('no-op when description is unchanged', () => {
      it('should return a successful Result and emit no events when value is the same string', () => {
        const vendor = makeVendor({
          description: 'Same description'
        });
        vendor.clearEvents();
        const result = vendor.updateDescription('Same description');

        expect(result.isSuccess).toBe(true);
        expect(vendor.domainEvents.length).toBe(0);
      });

      it('should return a successful Result and emit no events when both old and new are null', () => {
        const vendor = makeVendor({ description: null });
        vendor.clearEvents();
        const result = vendor.updateDescription(null);

        expect(result.isSuccess).toBe(true);
        expect(vendor.domainEvents.length).toBe(0);
      });

      it('should not change updatedAt when the value is the same', () => {
        const vendor = makeVendor({
          description: 'Same description'
        });
        const updatedAtBefore = vendor.updatedAt;
        vendor.updateDescription('Same description');

        expect(vendor.updatedAt).toBe(updatedAtBefore);
      });
    });

    // -----------------------------------------------------------------------
    describe('[DEV-004] validation failures', () => {
      it('should fail when description exceeds 500 characters', () => {
        const vendor = makeVendor({ description: null });
        const result = vendor.updateDescription('A'.repeat(501));

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('500');
      });

      it('should not change the description when validation fails', () => {
        const vendor = makeVendor({ description: 'Old description' });
        vendor.updateDescription('A'.repeat(501));

        expect(vendor.description).toBe('Old description');
      });
    });
  });
});
