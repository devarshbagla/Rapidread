import { describe, expect, it } from 'vitest';
import { emailError, normalizeUsername, passwordError, usernameError } from './rules';

describe('usernameError', () => {
  it('accepts a simple handle', () => {
    expect(usernameError('devarsh')).toBeUndefined();
    expect(normalizeUsername(' Devarsh ')).toBe('devarsh');
  });

  it('rejects short, long, or punctuated names', () => {
    expect(usernameError('ab')).toMatch(/3/);
    expect(usernameError('a'.repeat(25))).toMatch(/24/);
    expect(usernameError('hi there')).toMatch(/letters/);
    expect(usernameError('me@home')).toMatch(/letters/);
  });
});

describe('passwordError', () => {
  it('requires eight characters', () => {
    expect(passwordError('short')).toMatch(/8/);
    expect(passwordError('longenough')).toBeUndefined();
  });
});

describe('emailError', () => {
  it('treats empty as skipped', () => {
    expect(emailError('')).toBeUndefined();
    expect(emailError('  ')).toBeUndefined();
  });

  it('rejects malformed addresses', () => {
    expect(emailError('not-an-email')).toBeDefined();
    expect(emailError('me@example.com')).toBeUndefined();
  });
});
