import { z } from "zod";

export const emailSchema = z.string().trim().toLowerCase().email().max(254);

export const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters long.")
  .max(128, "Password must be at most 128 characters long.")
  .regex(/[a-z]/, "Password must include a lowercase letter.")
  .regex(/[A-Z]/, "Password must include an uppercase letter.")
  .regex(/[0-9]/, "Password must include a number.");

export const registerBodySchema = z
  .object({
    email: emailSchema,
    name: z.string().trim().min(2).max(80),
    password: passwordSchema,
  })
  .strict();

export const loginBodySchema = z
  .object({
    email: emailSchema,
    password: z.string().min(1),
  })
  .strict();

export const refreshBodySchema = z
  .object({
    refreshToken: z.string().min(1),
  })
  .strict();

export const forgotPasswordRequestBodySchema = z
  .object({
    email: emailSchema,
  })
  .strict();

export const verifyPasswordResetCodeBodySchema = z
  .object({
    email: emailSchema,
    code: z.string().regex(/^\d{6}$/, "Code must be a 6-digit number."),
  })
  .strict();

export const resetPasswordBodySchema = z
  .object({
    email: emailSchema,
    resetToken: z.string().min(1),
    password: passwordSchema,
    confirmPassword: z.string().min(1),
  })
  .strict()
  .refine((value) => value.password === value.confirmPassword, {
    message: "Confirm password must match password.",
    path: ["confirmPassword"],
  });

export type RegisterInput = z.infer<typeof registerBodySchema>;
export type LoginInput = z.infer<typeof loginBodySchema>;
export type RefreshInput = z.infer<typeof refreshBodySchema>;
export type ForgotPasswordRequestInput = z.infer<typeof forgotPasswordRequestBodySchema>;
export type VerifyPasswordResetCodeInput = z.infer<typeof verifyPasswordResetCodeBodySchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordBodySchema>;
