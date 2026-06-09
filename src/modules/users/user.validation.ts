import { z } from "zod";

import { familyMemberRoles } from "./user.types.js";

const booleanFromFormDataSchema = z.preprocess((value) => {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();

    if (normalized === "true") {
      return true;
    }

    if (normalized === "false") {
      return false;
    }
  }

  return value;
}, z.boolean());

const familyMembersSchema = z.preprocess(
  (value) => {
    if (value === undefined || value === null || value === "") {
      return [];
    }

    if (typeof value === "string") {
      try {
        return JSON.parse(value) as unknown;
      } catch {
        return value;
      }
    }

    return value;
  },
  z
    .array(
      z.object({
        userId: z.string().trim().min(1).optional(),
        name: z.string().trim().min(1).max(80),
        email: z.string().trim().toLowerCase().email().max(254),
        relation: z.string().trim().min(1).max(50),
        role: z.enum(familyMemberRoles),
        status: z.enum(["pending", "accepted"]).default("accepted"),
      }),
    )
    .max(50),
);

export const updateProfileBodySchema = z
  .object({
    name: z.string().trim().min(2).max(80).optional(),
    phoneNumber: z.string().trim().min(1).max(30).optional(),
    address: z.string().trim().min(1).max(300).optional(),
    familyMembers: familyMembersSchema.optional(),
    notifications: booleanFromFormDataSchema.optional(),
    aiInsight: booleanFromFormDataSchema.optional(),
    darkMode: booleanFromFormDataSchema.optional(),
    anonymousAnalytics: booleanFromFormDataSchema.optional(),
  })
  .strict();

export const createInvitationBodySchema = z
  .object({
    name: z.string().trim().min(1).max(80),
    email: z.string().trim().toLowerCase().email().max(254),
    relation: z.string().trim().min(1).max(50),
    role: z.enum(familyMemberRoles),
  })
  .strict();

export const acceptInvitationBodySchema = z
  .object({
    token: z.string().trim().min(1),
  })
  .strict();

export type UpdateProfileInput = z.infer<typeof updateProfileBodySchema>;
export type CreateInvitationInput = z.infer<typeof createInvitationBodySchema>;
export type AcceptInvitationInput = z.infer<typeof acceptInvitationBodySchema>;
