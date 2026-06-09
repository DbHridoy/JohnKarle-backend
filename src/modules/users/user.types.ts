export const userRoles = ["user", "admin", "super_admin"] as const;
export const familyMemberRoles = ["viewer", "editor", "owner"] as const;

export type UserRole = (typeof userRoles)[number];
export type FamilyMemberRole = (typeof familyMemberRoles)[number];

export type UserProfilePicture = {
  key: string;
  url: string;
  originalName: string;
  mimeType: string;
  size: number;
};

export type FamilyMember = {
  name: string;
  email: string;
  role: FamilyMemberRole;
};

export type UserPreferences = {
  notifications: boolean;
  aiInsight: boolean;
  darkMode: boolean;
  anonymousAnalytics: boolean;
};

export type PublicUser = {
  id: string;
  name: string;
  phoneNumber?: string;
  email: string;
  role: UserRole;
  isEmailVerified: boolean;
  address?: string;
  profilePicture?: UserProfilePicture;
  familyMembers: FamilyMember[];
  preferences: UserPreferences;
  legacyAccessEnabled: boolean;
  lastActiveAt?: string;
  lastLoginAt?: string;
  createdAt: string;
  updatedAt: string;
};
