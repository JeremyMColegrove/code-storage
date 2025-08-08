import { describe, expect, it } from 'vitest';
import { cn } from '../utils';

describe('utils.cn', () => {
  it('merges conditional class names and dedupes tailwind conflicts', () => {
    expect(cn('p-2', 'px-3', false && 'hidden', undefined, { 'text-red-500': true, 'text-blue-500': false }))
      .toBe('p-2 px-3 text-red-500');
  });
});


