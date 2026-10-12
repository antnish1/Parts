export type UserRole = 'branch' | 'admin' | 'super' | 'manager' | 'viewer' | 'developer' | 'hq' | 'accounts';

export type UserProfile = {
  id: string;
  fullName: string;
  branch: string;
  role: UserRole;
  isActive: boolean;
};
