import {
  isGetUserEventsArgs,
  isGetNavigationHistoryArgs,
  isGetClickEventsArgs,
} from './validation';

describe('validation type guards', () => {
  const guards = {
    isGetUserEventsArgs,
    isGetNavigationHistoryArgs,
    isGetClickEventsArgs,
  };

  describe.each(Object.entries(guards))('%s', (_name, guard) => {
    it('accepts null and undefined (no args)', () => {
      expect(guard(null)).toBe(true);
      expect(guard(undefined)).toBe(true);
    });

    it('accepts an empty object', () => {
      expect(guard({})).toBe(true);
    });

    it('rejects a bare string, number, or boolean', () => {
      expect(guard('not-an-object')).toBe(false);
      expect(guard(42)).toBe(false);
      expect(guard(true)).toBe(false);
    });

    it('rejects an array', () => {
      expect(guard([])).toBe(false);
      expect(guard(['navigation'])).toBe(false);
    });
  });

  describe('isGetUserEventsArgs', () => {
    it('accepts a fully valid payload', () => {
      expect(
        isGetUserEventsArgs({
          type: 'click',
          startTime: 1,
          endTime: 2,
          path: '/home',
          limit: 10,
        }),
      ).toBe(true);
    });

    it('rejects an invalid type enum value', () => {
      expect(isGetUserEventsArgs({ type: 'bogus' })).toBe(false);
    });

    it('rejects wrong-typed fields', () => {
      expect(isGetUserEventsArgs({ startTime: 'not-a-number' })).toBe(false);
      expect(isGetUserEventsArgs({ endTime: 'not-a-number' })).toBe(false);
      expect(isGetUserEventsArgs({ path: 123 })).toBe(false);
      expect(isGetUserEventsArgs({ limit: '10' })).toBe(false);
    });
  });

  describe('isGetNavigationHistoryArgs', () => {
    it('accepts a valid limit', () => {
      expect(isGetNavigationHistoryArgs({ limit: 25 })).toBe(true);
    });

    it('rejects a non-numeric limit', () => {
      expect(isGetNavigationHistoryArgs({ limit: '25' })).toBe(false);
    });
  });

  describe('isGetClickEventsArgs', () => {
    it('accepts a valid element filter and limit', () => {
      expect(isGetClickEventsArgs({ element: 'button', limit: 5 })).toBe(true);
    });

    it('rejects a non-string element filter', () => {
      expect(isGetClickEventsArgs({ element: 123 })).toBe(false);
    });

    it('rejects a non-numeric limit', () => {
      expect(isGetClickEventsArgs({ limit: 'five' })).toBe(false);
    });
  });
});
