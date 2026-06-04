export const userRoles = ["user", "admin", "super_admin"] as const;

export type UserRole = (typeof userRoles)[number];

export type PublicUser = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  isEmailVerified: boolean;
  lastLoginAt?: string;
  createdAt: string;
  updatedAt: string;
};
