import { describe, expect, it } from 'vitest';
import { accountRequestUrl } from './api';

describe('accountRequestUrl', () => {
  it('uses a relative path when no API host is baked in', () => {
    expect(accountRequestUrl('/auth/register', '')).toBe('/auth/register');
  });

  it('prefixes an explicit Worker URL', () => {
    expect(accountRequestUrl('/auth/login', 'https://rapidread.example.workers.dev')).toBe(
      'https://rapidread.example.workers.dev/auth/login',
    );
  });
});
