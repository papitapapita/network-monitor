import { z } from 'zod';

export const loginSchema = z.object({
  body: z.object({
    email: z
      .string()
      .min(1, 'Email is required')
      .email('Email is not valid'),
    password: z.string().min(1, 'Password is required'),
    trustedBrowserToken: z.string().min(1).max(2000).optional()
  })
});

export type LoginInput = z.infer<typeof loginSchema>['body'];

const appCode = z
  .string()
  .regex(/^\d{6}$/, 'Code must be the 6 digits the app shows');

const rememberBrowser = z.boolean().optional();

export const confirmTwoFactorSetupSchema = z.object({
  body: z.object({ code: appCode, rememberBrowser })
});

export type ConfirmTwoFactorSetupInput = z.infer<
  typeof confirmTwoFactorSetupSchema
>['body'];

export const verifyTwoFactorSchema = z.object({
  body: z
    .object({
      code: appCode.optional(),
      recoveryCode: z.string().trim().min(1).max(40).optional(),
      rememberBrowser
    })
    .refine(
      (body) =>
        (body.code === undefined) !==
        (body.recoveryCode === undefined),
      { message: 'Send either code or recoveryCode' }
    )
});

export type VerifyTwoFactorInput = z.infer<
  typeof verifyTwoFactorSchema
>['body'];

export const forgotPasswordSchema = z.object({
  body: z.object({
    email: z
      .string()
      .min(1, 'Email is required')
      .email('Email is not valid')
  })
});

export type ForgotPasswordInput = z.infer<
  typeof forgotPasswordSchema
>['body'];

export const resetPasswordSchema = z.object({
  body: z.object({
    token: z.string().min(1, 'Token is required').max(2000),
    password: z.string().min(1, 'Password is required').max(200)
  })
});

export type ResetPasswordInput = z.infer<
  typeof resetPasswordSchema
>['body'];
