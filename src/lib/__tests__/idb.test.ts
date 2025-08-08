import { describe, expect, it } from 'vitest';
import { HANDLE_KEY, idbGet, idbSet } from '../idb';

describe('idb key-value', () => {
  it('stores and retrieves values', async () => {
    const value = { hello: 'world' };
    await idbSet(HANDLE_KEY, value);
    const got = await idbGet<typeof value>(HANDLE_KEY);
    expect(got).toEqual(value);
  });
});


