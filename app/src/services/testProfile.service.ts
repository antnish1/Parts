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

  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data;
}
