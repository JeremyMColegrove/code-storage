import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useIsMobile } from '../use-mobile';

describe('useIsMobile', () => {
  it('returns true when innerWidth is below breakpoint', () => {
    global.innerWidth = 500;
    const { result } = renderHook(() => useIsMobile());
    expect(result.current).toBe(true);
  });

  it('returns false when innerWidth is above breakpoint', () => {
    global.innerWidth = 1200;
    const { result } = renderHook(() => useIsMobile());
    expect(result.current).toBe(false);
  });
});


