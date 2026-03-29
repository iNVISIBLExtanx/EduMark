-- Migration: extend marking_results and submissions for subject-aware marking schema
-- Run: supabase db push

-- marking_results: add part + sub_questions
ALTER TABLE public.marking_results
  ADD COLUMN IF NOT EXISTS part          text,
  ADD COLUMN IF NOT EXISTS sub_questions jsonb;

-- submissions: add fields for batch-level result summary
ALTER TABLE public.submissions
  ADD COLUMN IF NOT EXISTS total_awarded             int,
  ADD COLUMN IF NOT EXISTS total_max                 int,
  ADD COLUMN IF NOT EXISTS general_feedback          text,
  ADD COLUMN IF NOT EXISTS best_questions_selected   jsonb,
  ADD COLUMN IF NOT EXISTS paper_name                text;

-- batches: add paper_name for Combined Maths "Pure (Paper I)" vs "Applied (Paper II)"
ALTER TABLE public.batches
  ADD COLUMN IF NOT EXISTS paper_name text;
