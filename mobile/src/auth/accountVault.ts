import type { Session } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';
import type { UserProfile, UserRole } from '@/types/auth';

const INDEX_KEY = 'parts.saved-accounts.v1';
const tokenKey = (userId: string, kind: 'access' | 'refresh') => `parts.account.${userId}.${kind}`;

export type SavedAccount = {
  userId: string;
  loginId: string;
  fullName: string;
  branch: string;
  role: UserRole | null;
  updatedAt: string;
};

function loginIdFromSession(session: Session) {
  const email = session.user.email ?? '';
  return email.includes('@portal.local') ? email.split('@')[0].trim().toUpperCase() : email;
}

async function readIndex(): Promise<SavedAccount[]> {
  try {
    const raw = await SecureStore.getItemAsync(INDEX_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((item): item is SavedAccount => Boolean(item?.userId)) : [];
  } catch {
    return [];
  }
}

async function writeIndex(accounts: SavedAccount[]) {
  await SecureStore.setItemAsync(INDEX_KEY, JSON.stringify(accounts.slice(0, 8)));
}

export async function listSavedAccounts() {
  return readIndex();
}

export async function saveAccountSession(session: Session, profile: UserProfile) {
  const account: SavedAccount = {
    userId: session.user.id,
    loginId: loginIdFromSession(session),
    fullName: profile.fullName,
    branch: profile.branch,
    role: profile.role,
    updatedAt: new Date().toISOString(),
  };

  await Promise.all([
    SecureStore.setItemAsync(tokenKey(session.user.id, 'access'), session.access_token),
    SecureStore.setItemAsync(tokenKey(session.user.id, 'refresh'), session.refresh_token),
  ]);

  const existing = await readIndex();
  const next = [account, ...existing.filter((item) => item.userId !== account.userId)];
  await writeIndex(next);
  return next;
}

export async function getSavedAccountTokens(userId: string) {
  const [accessToken, refreshToken] = await Promise.all([
    SecureStore.getItemAsync(tokenKey(userId, 'access')),
    SecureStore.getItemAsync(tokenKey(userId, 'refresh')),
  ]);
  if (!accessToken || !refreshToken) throw new Error('Saved session is no longer available. Sign in again.');
  return { accessToken, refreshToken };
}

export async function removeSavedAccount(userId: string) {
  await Promise.all([
    SecureStore.deleteItemAsync(tokenKey(userId, 'access')),
    SecureStore.deleteItemAsync(tokenKey(userId, 'refresh')),
  ]);
  const next = (await readIndex()).filter((item) => item.userId !== userId);
  await writeIndex(next);
  return next;
}
