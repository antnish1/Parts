import { supabase } from '../lib/supabase';

export type TestProfileOption = {
  id: string;
  full_name: string;
  branch: string;
  role: string;
};

export type TestProfileRow = TestProfileOption & {
  login_id: string | null;
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
  loginId?: string;
};

export type UpdateTestProfileInput = {
  fullName: string;
  branch: string;
  role: string;
  isActive: boolean;
  loginId?: string;
};

function friendlyUserError(message: string) {
  const text = message.toLowerCase();
  if (text.includes('user id') || text.includes('login_id')) return 'This User ID is already assigned. Please use another User ID.';
  if (text.includes('already') || text.includes('registered') || text.includes('duplicate')) return 'This email or User ID is already registered. Please use another User ID, or edit the existing user profile.';
  if (text.includes('password')) return message || 'Password is not valid.';
  if (text.includes('unauthorized') || text.includes('jwt')) return 'Your login session expired. Please logout and login again as developer.';
  if (text.includes('developer')) return 'Only an active developer user can create or edit portal users.';
  if (text.includes('failed to fetch') || text.includes('send a request')) return 'Could not connect to the user function. Please check Edge Function deployment and project URL.';
  return message || 'User operation failed. Please check the details and try again.';
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
  return friendlyUserError(maybeError?.message ?? 'User operation failed.');
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
    .select('id, full_name, branch, role, login_id, is_active, created_at')
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

export async function updateTestProfile(profileId: string, input: UpdateTestProfileInput) {
  const fullName = input.fullName.trim();
  const branch = input.branch.trim();
  const role = input.role.trim();
  const loginId = input.loginId?.trim().replace(/\s+/g, '').toUpperCase() || '';
  if (!profileId) throw new Error('Profile id is required.');
  if (!fullName || !branch || !role) throw new Error('Name, branch and role are required.');

  const { data, error } = await supabase.functions.invoke('update-portal-user', {
    body: { profileId, fullName, branch, role, loginId, isActive: input.isActive },
  });

  if (error) throw new Error(await readFunctionError(error));
  if (data?.error) throw new Error(friendlyUserError(String(data.error)));
  if (!data?.ok) throw new Error('Profile update was not confirmed by the server.');
  return data;
}

export async function setTestProfileActive(profileId: string, isActive: boolean) {
  if (!profileId) throw new Error('Profile id is required.');
  const { error } = await supabase
    .from('test_profiles')
    .update({ is_active: isActive })
    .eq('id', profileId);
  if (error) throw error;
}

export async function createPortalUser(input: CreatePortalUserInput) {
  const { data, error } = await supabase.functions.invoke('create-portal-user', {
    body: {
      email: input.email.trim().toLowerCase(),
      password: input.password.trim(),
      fullName: input.fullName.trim(),
      branch: input.branch.trim(),
      role: input.role.trim(),
      loginId: input.loginId?.trim().replace(/\s+/g, '').toUpperCase() || '',
    },
  });

  if (error) throw new Error(await readFunctionError(error));
  if (data?.error) throw new Error(friendlyUserError(data.error));
  return data;
}
