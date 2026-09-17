import { describe, expect, it } from 'vitest';
import { hashPassword, passwordsMatch, signJwt, verifyJwt } from './crypto';

describe('password hashing', () => {
  it('round-trips a password with a unique salt', async () => {
    const first = await hashPassword('longenough');
    const second = await hashPassword('longenough');
    expect(first.salt).not.toBe(second.salt);
    expect(await passwordsMatch('longenough', first.salt, first.hash)).toBe(true);
    expect(await passwordsMatch('wrong-pass', first.salt, first.hash)).toBe(false);
  });
});

describe('jwt', () => {
  it('accepts a fresh token and rejects a bad secret', async () => {
    const token = await signJwt('user-1', 'devarsh', 'secret-a');
    const payload = await verifyJwt(token, 'secret-a');
    expect(payload?.sub).toBe('user-1');
    expect(payload?.usr).toBe('devarsh');
    expect(await verifyJwt(token, 'secret-b')).toBeUndefined();
    expect(await verifyJwt('not-a-jwt', 'secret-a')).toBeUndefined();
  });
});
