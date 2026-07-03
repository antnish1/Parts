import { supabase } from '../lib/supabase';

export type TestProfileOption = {
  id: string;
  full_name: string;
  branch: string;
  role: string;
};

export type TestProfileRow = TestProfileOption & {
  is_active: boolean;
  created_at: string;
};

export type CreateTestProfileInput = {
  fullName: string;
  branch: string;
  role: string;
};

export type CreatePortalUserInput = CreateTestProfileInput & {
  email: string;
  password: string;
};

function friendlyUserError(message: string) {
  const text = message.toLowerCase();
  if (text.includes('already') || text.includes('registered') || text.includes('duplicate')) return 'This email is already registered. Please use another email, or edit the existing user profile.';
  if (text.includes('password')) return 'Password is not valid. Please use at least 8 characters.';
  if (text.includes('unauthorized') || text.includes('jwt')) return 'Your login session expired. Please logout and login again as developer.';
  if (text.includes('developer')) return 'Only an active developer user can create new portal users.';
  if (text.includes('failed to fetch') || text.includes('send a request')) return 'Could not connect to the user creation function. Please check Edge Function deployment and project URL.';
  return message || 'User creation failed. Please check the details and try again.';
}

async function readFunctionError(error: unknown) {
  const maybeError = error as { message?: string; context?: Response };
  if (maybeError?.context) {
    try {
      const body = await maybeError.context.clone().json();
      if (body?.error) return friendlyUserError(String(body.error));
    } catch {
      // Ignore body parse error and use fallback message.
    }
  }
  return friendlyUserError(maybeError?.message ?? 'User creation failed.');
}

export async function getTestApprovers(): Promise<TestProfileOption[]> {
  const { data, error } = await supabase
    .from('test_profiles')
    .select('id, full_name, branch, role')
    .in('role', ['super', 'manager'])
    .eq('is_active', true)
    .order('role', { ascending: false })
    .order('full_name', { ascending: true });

  if (error) {
    console.error('Failed to load test approvers', error);
    return [];
  }

  return data ?? [];
}

export async function getTestProfiles(): Promise<TestProfileRow[]> {
  const { data, error } = await supabase
    .from('test_profiles')
    .select('id, full_name, branch, role, is_active, created_at')
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) {
    console.error('Failed to load test profiles', error);
    return [];
  }

  return data ?? [];
}

export async function createTestProfile(input: CreateTestProfileInput) {
  const fullName = input.fullName.trim();
  const branch = input.branch.trim();
  const role = input.role.trim();
  if (!fullName || !branch || !role) throw new Error('Name, branch and role are required.');

  const { error } = await supabase.from('test_profiles').insert({
    full_name: fullName,
    branch,
    role,
    is_active: true,
  });

  if (error) throw error;
}

export async function createPortalUser(input: CreatePortalUserInput) {
  const { data, error } = await supabase.functions.invoke('create-portal-user', {
    body: {
      email: input.email.trim().toLowerCase(),
      password: input.password,
      fullName: input.fullName.trim(),
      branch: input.branch.trim(),
      role: input.role.trim(),
    },
  });

  if (error) throw new Error(await readFunctionError(error));
  if (data?.error) throw new Error(friendlyUserError(data.error));
  return data;
}
