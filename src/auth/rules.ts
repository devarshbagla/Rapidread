/** Username and password rules shared by the Worker and the account form. */

export const USERNAME_MIN = 3;
export const USERNAME_MAX = 24;
export const PASSWORD_MIN = 8;
export const PASSWORD_MAX = 200;

const USERNAME_RE = /^[a-zA-Z0-9_]+$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeUsername(value: string): string {
  return value.trim().toLowerCase();
}

export function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

export function usernameError(value: string): string | undefined {
  const trimmed = value.trim();
  if (trimmed.length < USERNAME_MIN || trimmed.length > USERNAME_MAX) {
    return `Username must be ${USERNAME_MIN}–${USERNAME_MAX} characters.`;
  }
  if (!USERNAME_RE.test(trimmed)) {
    return 'Use letters, numbers, and underscores only.';
  }
  return undefined;
}

export function passwordError(value: string): string | undefined {
  if (value.length < PASSWORD_MIN) {
    return `Password must be at least ${PASSWORD_MIN} characters.`;
  }
  if (value.length > PASSWORD_MAX) {
    return 'Password is too long.';
  }
  return undefined;
}

export function emailError(value: string): string | undefined {
  const trimmed = value.trim();
  if (trimmed.length === 0) return undefined;
  if (trimmed.length > 254 || !EMAIL_RE.test(trimmed)) {
    return 'That email address does not look valid.';
  }
  return undefined;
}
