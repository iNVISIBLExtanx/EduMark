-- =============================================================
-- EduMark AI — Initial Database Migration
-- =============================================================

-- ─── Extensions ──────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "vector" WITH SCHEMA "extensions";

-- ─── Tables (in FK-dependency order) ─────────────────────────

-- 1. tutors
CREATE TABLE public.tutors (
  id                     uuid PRIMARY KEY REFERENCES auth.users(id),
  email                  text NOT NULL UNIQUE,
  full_name              text NOT NULL,
  marking_language       text NOT NULL CHECK (marking_language IN ('sinhala','tamil','english')),
  created_at             timestamptz DEFAULT now(),
  stripe_customer_id     text UNIQUE,
  stripe_subscription_id text UNIQUE,
  plan                   text NOT NULL DEFAULT 'free'
                           CHECK (plan IN ('free','starter','standard','pro','institute')),
  ai_minutes_used        int  NOT NULL DEFAULT 0,
  ai_minutes_limit       int  NOT NULL DEFAULT 10,
  subscription_status    text NOT NULL DEFAULT 'active'
                           CHECK (subscription_status IN ('active','past_due','canceled','trialing')),
  billing_period_end     timestamptz
);

-- 2. subjects
CREATE TABLE public.subjects (
  id   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  code text NOT NULL UNIQUE
);

-- 3. tutor_subjects (registration join table)
CREATE TABLE public.tutor_subjects (
  tutor_id   uuid REFERENCES public.tutors(id) ON DELETE CASCADE,
  subject_id uuid REFERENCES public.subjects(id),
  PRIMARY KEY (tutor_id, subject_id)
);

-- 4. question_papers
CREATE TABLE public.question_papers (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tutor_id    uuid REFERENCES public.tutors(id),
  subject_id  uuid REFERENCES public.subjects(id),
  title       text NOT NULL,
  year        int,
  pdf_url     text NOT NULL,
  parsed_json jsonb,
  created_at  timestamptz DEFAULT now()
);

-- 5. marking_schemes
CREATE TABLE public.marking_schemes (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  paper_id        uuid REFERENCES public.question_papers(id),
  pdf_url         text NOT NULL,
  structure_json  jsonb,
  embeddings_done boolean DEFAULT false,
  created_at      timestamptz DEFAULT now()
);

-- 6. ms_embeddings (RAG store)
CREATE TABLE public.ms_embeddings (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scheme_id   uuid REFERENCES public.marking_schemes(id) ON DELETE CASCADE,
  chunk_text  text NOT NULL,
  chunk_type  text,
  question_no int,
  embedding   vector(1536)
);

CREATE INDEX ms_embeddings_embedding_idx ON public.ms_embeddings
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

-- 7. batches
CREATE TABLE public.batches (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tutor_id        uuid REFERENCES public.tutors(id),
  paper_id        uuid REFERENCES public.question_papers(id),
  scheme_id       uuid REFERENCES public.marking_schemes(id),
  name            text NOT NULL,
  medium          text NOT NULL CHECK (medium IN ('sinhala','tamil','english')),
  status          text NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending','uploading','processing','completed','failed')),
  claude_batch_id text,
  total_papers    int DEFAULT 0,
  marked_papers   int DEFAULT 0,
  created_at      timestamptz DEFAULT now()
);

-- 8. students
CREATE TABLE public.students (
  id       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id uuid REFERENCES public.batches(id) ON DELETE CASCADE,
  name     text NOT NULL,
  index_no text
);

-- 9. submissions
CREATE TABLE public.submissions (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id    uuid REFERENCES public.students(id) ON DELETE CASCADE,
  batch_id      uuid REFERENCES public.batches(id),
  pdf_url       text NOT NULL,
  page_count    int,
  status        text NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending','processing','marked','failed')),
  claude_req_id text,
  created_at    timestamptz DEFAULT now()
);

-- 10. marking_results
CREATE TABLE public.marking_results (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id       uuid REFERENCES public.submissions(id) ON DELETE CASCADE,
  question_no         int  NOT NULL,
  max_marks           int  NOT NULL,
  awarded_marks       int  NOT NULL,
  student_answer_text text,
  feedback            text NOT NULL,
  ocr_confidence      text DEFAULT 'high' CHECK (ocr_confidence IN ('high','low')),
  tutor_override      boolean DEFAULT false,
  override_marks      int,
  override_feedback   text,
  created_at          timestamptz DEFAULT now()
);

-- 11. reports
CREATE TABLE public.reports (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id  uuid REFERENCES public.submissions(id) UNIQUE,
  pdf_url        text,
  tutor_approved boolean DEFAULT false,
  approved_at    timestamptz,
  generated_at   timestamptz
);

-- ─── Seed Subjects ───────────────────────────────────────────
INSERT INTO public.subjects (name, code) VALUES
  ('Combined Maths', 'CM'),
  ('Physics',        'PHY'),
  ('Chemistry',      'CHEM'),
  ('Economics',      'ECON'),
  ('Business Studies','BS'),
  ('Biology',        'BIO');

-- ─── Billing Helper Functions (SECURITY DEFINER) ─────────────

-- Atomic increment of used minutes (bounded by limit)
CREATE OR REPLACE FUNCTION public.increment_ai_minutes_used(
  p_tutor_id uuid,
  p_amount   int
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.tutors
  SET ai_minutes_used = LEAST(ai_minutes_used + p_amount, ai_minutes_limit)
  WHERE id = p_tutor_id;
END;
$$;

-- Add top-up minutes to the monthly limit (not usage)
CREATE OR REPLACE FUNCTION public.add_topup_minutes(
  p_tutor_id uuid,
  p_amount   int
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.tutors
  SET ai_minutes_limit = ai_minutes_limit + p_amount
  WHERE id = p_tutor_id;
END;
$$;

-- ─── RAG Helper Function ─────────────────────────────────────

CREATE OR REPLACE FUNCTION public.match_marking_criteria(
  p_scheme_id      uuid,
  p_query_embedding vector(1536),
  p_match_count    int
)
RETURNS TABLE (
  id          uuid,
  chunk_text  text,
  chunk_type  text,
  question_no int,
  similarity  float
)
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  RETURN QUERY
  SELECT
    mse.id,
    mse.chunk_text,
    mse.chunk_type,
    mse.question_no,
    1 - (mse.embedding <=> p_query_embedding) AS similarity
  FROM public.ms_embeddings mse
  WHERE mse.scheme_id = p_scheme_id
  ORDER BY mse.embedding <=> p_query_embedding
  LIMIT p_match_count;
END;
$$;

-- ─── Row Level Security ──────────────────────────────────────

ALTER TABLE public.tutors          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subjects        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tutor_subjects  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.question_papers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marking_schemes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ms_embeddings   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.batches         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.students        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.submissions     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marking_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reports         ENABLE ROW LEVEL SECURITY;

-- ─── RLS Policies: tutors ────────────────────────────────────

CREATE POLICY "tutors_select_own" ON public.tutors
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "tutors_insert_own" ON public.tutors
  FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "tutors_update_own" ON public.tutors
  FOR UPDATE USING (auth.uid() = id);

-- ─── RLS Policies: subjects (read-only for all authenticated) ─

CREATE POLICY "subjects_select_authenticated" ON public.subjects
  FOR SELECT TO authenticated USING (true);

-- ─── RLS Policies: tutor_subjects ────────────────────────────

CREATE POLICY "tutor_subjects_select_own" ON public.tutor_subjects
  FOR SELECT USING (auth.uid() = tutor_id);

CREATE POLICY "tutor_subjects_insert_own" ON public.tutor_subjects
  FOR INSERT WITH CHECK (auth.uid() = tutor_id);

CREATE POLICY "tutor_subjects_delete_own" ON public.tutor_subjects
  FOR DELETE USING (auth.uid() = tutor_id);

-- ─── RLS Policies: question_papers ───────────────────────────

CREATE POLICY "question_papers_select_own" ON public.question_papers
  FOR SELECT USING (auth.uid() = tutor_id);

CREATE POLICY "question_papers_insert_own" ON public.question_papers
  FOR INSERT WITH CHECK (auth.uid() = tutor_id);

CREATE POLICY "question_papers_update_own" ON public.question_papers
  FOR UPDATE USING (auth.uid() = tutor_id);

CREATE POLICY "question_papers_delete_own" ON public.question_papers
  FOR DELETE USING (auth.uid() = tutor_id);

-- ─── RLS Policies: marking_schemes (via question_papers) ─────

CREATE POLICY "marking_schemes_select_own" ON public.marking_schemes
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.question_papers qp
      WHERE qp.id = paper_id AND qp.tutor_id = auth.uid()
    )
  );

CREATE POLICY "marking_schemes_insert_own" ON public.marking_schemes
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.question_papers qp
      WHERE qp.id = paper_id AND qp.tutor_id = auth.uid()
    )
  );

CREATE POLICY "marking_schemes_update_own" ON public.marking_schemes
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.question_papers qp
      WHERE qp.id = paper_id AND qp.tutor_id = auth.uid()
    )
  );

CREATE POLICY "marking_schemes_delete_own" ON public.marking_schemes
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.question_papers qp
      WHERE qp.id = paper_id AND qp.tutor_id = auth.uid()
    )
  );

-- ─── RLS Policies: ms_embeddings (via marking_schemes → question_papers) ─

CREATE POLICY "ms_embeddings_select_own" ON public.ms_embeddings
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.marking_schemes ms
      JOIN public.question_papers qp ON qp.id = ms.paper_id
      WHERE ms.id = scheme_id AND qp.tutor_id = auth.uid()
    )
  );

CREATE POLICY "ms_embeddings_insert_own" ON public.ms_embeddings
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.marking_schemes ms
      JOIN public.question_papers qp ON qp.id = ms.paper_id
      WHERE ms.id = scheme_id AND qp.tutor_id = auth.uid()
    )
  );

CREATE POLICY "ms_embeddings_delete_own" ON public.ms_embeddings
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.marking_schemes ms
      JOIN public.question_papers qp ON qp.id = ms.paper_id
      WHERE ms.id = scheme_id AND qp.tutor_id = auth.uid()
    )
  );

-- ─── RLS Policies: batches ───────────────────────────────────

CREATE POLICY "batches_select_own" ON public.batches
  FOR SELECT USING (auth.uid() = tutor_id);

CREATE POLICY "batches_insert_own" ON public.batches
  FOR INSERT WITH CHECK (auth.uid() = tutor_id);

CREATE POLICY "batches_update_own" ON public.batches
  FOR UPDATE USING (auth.uid() = tutor_id);

CREATE POLICY "batches_delete_own" ON public.batches
  FOR DELETE USING (auth.uid() = tutor_id);

-- ─── RLS Policies: students (via batches) ────────────────────

CREATE POLICY "students_select_own" ON public.students
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.batches b
      WHERE b.id = batch_id AND b.tutor_id = auth.uid()
    )
  );

CREATE POLICY "students_insert_own" ON public.students
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.batches b
      WHERE b.id = batch_id AND b.tutor_id = auth.uid()
    )
  );

CREATE POLICY "students_update_own" ON public.students
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.batches b
      WHERE b.id = batch_id AND b.tutor_id = auth.uid()
    )
  );

CREATE POLICY "students_delete_own" ON public.students
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.batches b
      WHERE b.id = batch_id AND b.tutor_id = auth.uid()
    )
  );

-- ─── RLS Policies: submissions (via batches) ─────────────────

CREATE POLICY "submissions_select_own" ON public.submissions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.batches b
      WHERE b.id = batch_id AND b.tutor_id = auth.uid()
    )
  );

CREATE POLICY "submissions_insert_own" ON public.submissions
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.batches b
      WHERE b.id = batch_id AND b.tutor_id = auth.uid()
    )
  );

CREATE POLICY "submissions_update_own" ON public.submissions
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.batches b
      WHERE b.id = batch_id AND b.tutor_id = auth.uid()
    )
  );

CREATE POLICY "submissions_delete_own" ON public.submissions
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.batches b
      WHERE b.id = batch_id AND b.tutor_id = auth.uid()
    )
  );

-- ─── RLS Policies: marking_results (via submissions → batches) ─

CREATE POLICY "marking_results_select_own" ON public.marking_results
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.submissions s
      JOIN public.batches b ON b.id = s.batch_id
      WHERE s.id = submission_id AND b.tutor_id = auth.uid()
    )
  );

CREATE POLICY "marking_results_insert_own" ON public.marking_results
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.submissions s
      JOIN public.batches b ON b.id = s.batch_id
      WHERE s.id = submission_id AND b.tutor_id = auth.uid()
    )
  );

CREATE POLICY "marking_results_update_own" ON public.marking_results
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.submissions s
      JOIN public.batches b ON b.id = s.batch_id
      WHERE s.id = submission_id AND b.tutor_id = auth.uid()
    )
  );

CREATE POLICY "marking_results_delete_own" ON public.marking_results
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.submissions s
      JOIN public.batches b ON b.id = s.batch_id
      WHERE s.id = submission_id AND b.tutor_id = auth.uid()
    )
  );

-- ─── RLS Policies: reports (via submissions → batches) ───────

CREATE POLICY "reports_select_own" ON public.reports
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.submissions s
      JOIN public.batches b ON b.id = s.batch_id
      WHERE s.id = submission_id AND b.tutor_id = auth.uid()
    )
  );

CREATE POLICY "reports_insert_own" ON public.reports
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.submissions s
      JOIN public.batches b ON b.id = s.batch_id
      WHERE s.id = submission_id AND b.tutor_id = auth.uid()
    )
  );

CREATE POLICY "reports_update_own" ON public.reports
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.submissions s
      JOIN public.batches b ON b.id = s.batch_id
      WHERE s.id = submission_id AND b.tutor_id = auth.uid()
    )
  );

-- ─── Billing Field Protection ────────────────────────────────
-- Billing fields may ONLY be updated by the service role or SECURITY DEFINER functions.
-- Even a direct Supabase client call from the browser cannot change plan or limits.

REVOKE UPDATE (
  stripe_customer_id,
  stripe_subscription_id,
  plan,
  ai_minutes_limit,
  ai_minutes_used,
  subscription_status,
  billing_period_end
) ON public.tutors FROM authenticated;

-- Tutors can self-edit only safe profile fields.
GRANT UPDATE (full_name, marking_language)
  ON public.tutors TO authenticated;
