import { z } from 'zod';

export const VisibilitySchema = z
  .object({
    toast: z.boolean().default(true),
    toastCooldownMs: z.number().int().nonnegative().default(0),
    log: z.boolean().default(true),
    header: z.boolean().default(true),
  })
  .default({
    toast: true,
    toastCooldownMs: 0,
    log: true,
    header: true,
  });

export const RateLimitSchema = z
  .object({
    defaultBackoffMs: z.number().int().positive().default(30_000),
    maxBackoffMs: z.number().int().positive().default(300_000),
  })
  .default({
    defaultBackoffMs: 30_000,
    maxBackoffMs: 300_000,
  });

export const CopilotMultiConfigSchema = z.object({
  accountsPath: z.string().optional(),
  modelCacheTtlMs: z.number().int().positive().default(86_400_000),
  strategy: z.enum(['sticky', 'round-robin', 'hybrid']).default('hybrid'),
  visibility: VisibilitySchema,
  rateLimit: RateLimitSchema,
});

export type CopilotMultiConfig = z.infer<typeof CopilotMultiConfigSchema>;
