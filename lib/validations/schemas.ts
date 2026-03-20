import { z } from 'zod';

export const createBatchSchema = z.object({
  name: z.string().min(1).max(200),
  paper_id: z.string().uuid(),
  scheme_id: z.string().uuid(),
  medium: z.enum(['sinhala', 'tamil', 'english']),
});

export const overrideMarksSchema = z.object({
  override_marks: z.number().int().min(0),
  override_feedback: z.string().min(1),
});

export const onboardingSchema = z.object({
  full_name: z.string().min(1).max(200),
  marking_language: z.enum(['sinhala', 'tamil', 'english']),
  subject_ids: z.array(z.string().uuid()).min(1).max(6),
});

export type CreateBatchInput = z.infer<typeof createBatchSchema>;
export type OverrideMarksInput = z.infer<typeof overrideMarksSchema>;
export type OnboardingInput = z.infer<typeof onboardingSchema>;
