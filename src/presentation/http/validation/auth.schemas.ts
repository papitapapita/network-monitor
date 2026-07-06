import { z } from 'zod';

export const loginSchema = z.object({
  body: z.object({
    email: z.string().min(1, 'Email is required').email('Email is not valid'),
    password: z.string().min(1, 'Password is required')
  })
});

export type LoginInput = z.infer<typeof loginSchema>['body'];
