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

export const updateProfileSchema = z.object({
  full_name: z.string().min(1, 'Name is required').max(200),
  marking_language: z.enum(['sinhala', 'tamil', 'english']),
  subject_ids: z.array(z.string().uuid()).min(1, 'Select at least one subject').max(6),
});

export const questionPaperSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200),
  subject_id: z.string().uuid('Invalid subject'),
  year: z.number().int().min(1990).max(2030).optional(),
});

export const markingSchemeSchema = z.object({
  paper_id: z.string().uuid('Invalid paper ID'),
});

export const submissionFileSchema = z.object({
  student_name: z.string().min(1, 'Student name is required').max(200),
  index_no: z.string().max(50).optional(),
});

export const submissionUploadSchema = z.object({
  batch_id: z.string().uuid('Invalid batch ID'),
  files: z.array(submissionFileSchema).min(1).max(50, 'Maximum 50 files per upload'),
});

export type CreateBatchInput = z.infer<typeof createBatchSchema>;
export type OverrideMarksInput = z.infer<typeof overrideMarksSchema>;
export type OnboardingInput = z.infer<typeof onboardingSchema>;
export type QuestionPaperInput = z.infer<typeof questionPaperSchema>;
export type MarkingSchemeInput = z.infer<typeof markingSchemeSchema>;
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
export type SubmissionFileInput = z.infer<typeof submissionFileSchema>;
export type SubmissionUploadInput = z.infer<typeof submissionUploadSchema>;
