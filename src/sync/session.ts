export interface AccountUser {
  id: string;
  username: string;
  email: string | null;
  emailVerified: boolean;
  createdAt: number;
}

export interface RemoteProgress {
  wordIndex: number;
  wordCount: number;
  wpm: number;
  finished: boolean;
  updatedAt: number;
}

export interface RemoteBook {
  fingerprint: string;
  title: string;
  author?: string;
  wordCount: number;
  updatedAt: number;
  progress: RemoteProgress | null;
}

type Listener = () => void;

let token: string | undefined;
let user: AccountUser | undefined;
const listeners = new Set<Listener>();

export function getToken(): string | undefined {
  return token;
}

export function getUser(): AccountUser | undefined {
  return user;
}

export function setSession(nextToken: string | undefined, nextUser: AccountUser | undefined): void {
  token = nextToken;
  user = nextUser;
  for (const listener of listeners) listener();
}

export function onSessionChange(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
