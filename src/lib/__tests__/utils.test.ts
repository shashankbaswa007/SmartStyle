import { cn } from '@/lib/utils';

describe('cn utility', () => {
  it('merges class names', () => {
    expect(cn('foo', 'bar')).toBe('foo bar');
  });

  it('handles conditional classes via clsx', () => {
    expect(cn('base', false && 'hidden', 'active')).toBe('base active');
  });

  it('deduplicates tailwind classes via twMerge', () => {
    expect(cn('px-4', 'px-6')).toBe('px-6');
  });

  it('handles conflicting tailwind utilities', () => {
    expect(cn('text-red-500', 'text-blue-500')).toBe('text-blue-500');
  });

  it('returns empty string for no arguments', () => {
    expect(cn()).toBe('');
  });

  it('handles undefined and null gracefully', () => {
    expect(cn('base', undefined, null, 'end')).toBe('base end');
  });

  it('handles array inputs', () => {
    expect(cn(['foo', 'bar'])).toBe('foo bar');
  });

  it('handles object inputs', () => {
    expect(cn({ hidden: true, visible: false })).toBe('hidden');
  });
});
