# Database Schema & Query Patterns

## Supabase Setup
- PostgreSQL with pgvector extension enabled
- Row Level Security (RLS) enabled on ALL tables
- All queries go through typed functions in `lib/db/` -- never write raw SQL in API routes

---

## Schema

### `tutors`

```sql
id               uuid primary key references auth.users(id)
email            text not null unique
full_name        text not null
marking_language text not null check (marking_language in ('sinhala','tamil','english'))
created_at       timestamptz default now()
-- Billing fields:
stripe_customer_id     text unique,
stripe_subscription_id text unique,
plan                   text not null default 'free'
  check (plan in ('free','starter','standard','pro','institute')),
ai_minutes_used        int  not null default 0,
ai_minutes_limit       int  not null default 10,
subscription_status    text not null default 'active'
  check (subscription_status in ('active','past_due','canceled','trialing')),
billing_period_end     timestamptz
```

> Migration snippet (run via `supabase/migrations/20260319_add_billing.sql`):

```sql
ALTER TABLE public.tutors
  ADD COLUMN IF NOT EXISTS stripe_customer_id     text unique,
  ADD COLUMN IF NOT EXISTS stripe_subscription_id text unique,
  ADD COLUMN IF NOT EXISTS plan                   text NOT NULL DEFAULT 'free'
    CHECK (plan IN ('free','starter','standard','pro','institute')),
  ADD COLUMN IF NOT EXISTS ai_minutes_used        int  NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ai_minutes_limit       int  NOT NULL DEFAULT 10,
  ADD COLUMN IF NOT EXISTS subscription_status    text NOT NULL DEFAULT 'active'
    CHECK (subscription_status IN ('active','past_due','canceled','trialing')),
  ADD COLUMN IF NOT EXISTS billing_period_end     timestamptz;
```

---

### Billing Helper Functions

```sql
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
```

These functions are called only from:
- Stripe webhook handler (via service-role client)
- `lib/db/billing.ts` (`checkAndDeductMinutes`)

---

### `subjects`

```sql
id    uuid primary key default gen_random_uuid()
name  text not null  -- 'Combined Maths' | 'Physics' | 'Chemistry' | 'Economics' | 'Business Studies' | 'Biology'
code  text not null unique
```

Seed these 6 subjects in the initial migration. Do not allow tutors to create new subjects.

---

### `tutor_subjects`  (registration)

```sql
tutor_id    uuid references tutors(id) on delete cascade
subject_id  uuid references subjects(id)
primary key (tutor_id, subject_id)
```

---

### `question_papers`

```sql
id            uuid primary key default gen_random_uuid()
tutor_id      uuid references tutors(id)
subject_id    uuid references subjects(id)
title         text not null
year          int
pdf_url       text not null         -- Supabase Storage path
parsed_json   jsonb                 -- Claude-parsed structure: {questions:[{no,marks,model_answer}]}
created_at    timestamptz default now()
```

---

### `marking_schemes`

```sql
id              uuid primary key default gen_random_uuid()
paper_id        uuid references question_papers(id)
pdf_url         text not null
structure_json  jsonb       -- same shape as parsed_json but sourced from marking scheme PDF
embeddings_done boolean default false
created_at      timestamptz default now()
```

---

### `ms_embeddings`  (RAG store)

```sql
id          uuid primary key default gen_random_uuid()
scheme_id   uuid references marking_schemes(id) on delete cascade
chunk_text  text not null
chunk_type  text    -- 'question_criterion' | 'model_answer' | 'mark_allocation'
question_no int
embedding   vector(1536)   -- OpenAI text-embedding-3-small dimensions
```

Index:

```sql
CREATE INDEX ON ms_embeddings
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);
```

---

### `batches`

```sql
id              uuid primary key default gen_random_uuid()
tutor_id        uuid references tutors(id)
paper_id        uuid references question_papers(id)
scheme_id       uuid references marking_schemes(id)
name            text not null
medium          text not null check (medium in ('sinhala','tamil','english'))
status          text not null default 'pending'
                check (status in ('pending','uploading','processing','completed','failed'))
claude_batch_id text        -- Anthropic Batch API job ID
total_papers    int default 0
marked_papers   int default 0
paper_name      text        -- e.g. 'Pure (Paper I)' or 'Applied (Paper II)' for Combined Maths
created_at      timestamptz default now()
```

> Added in `supabase/migrations/20260325_mark_paper_schema.sql`.

---

### `students`

```sql
id        uuid primary key default gen_random_uuid()
batch_id  uuid references batches(id) on delete cascade
name      text not null
index_no  text          -- optional student index number
```

---

### `submissions`

```sql
id              uuid primary key default gen_random_uuid()
student_id      uuid references students(id) on delete cascade
batch_id        uuid references batches(id)
pdf_url         text not null
page_count      int
status          text not null default 'pending'
                check (status in ('pending','processing','marked','failed'))
claude_req_id   text    -- custom_id in Anthropic Batch API request
-- Summary fields written by saveMarkingResults (service role, background job):
total_awarded             int
total_max                 int
general_feedback          text
best_questions_selected   jsonb   -- e.g. [1,3,5,6,7] for Combined Maths Part B
paper_name                text    -- e.g. 'Pure (Paper I)'
created_at      timestamptz default now()
```

> Summary columns added in `supabase/migrations/20260325_mark_paper_schema.sql`.
> `GET /api/submissions/[id]` returns `{ results, summary }` where `summary` is these fields.

---

### `marking_results`

```sql
id                  uuid primary key default gen_random_uuid()
submission_id       uuid references submissions(id) on delete cascade
part                text        -- 'Part A' | 'Part B' | '' (empty for subjects without part structure)
question_no         int not null
max_marks           int not null
awarded_marks       int not null
student_answer_text text        -- Claude's OCR transcription of student's answer
feedback            text not null
ocr_confidence      text default 'high' check (ocr_confidence in ('high','low'))
sub_questions       jsonb       -- [{label, max_marks, awarded_marks, feedback}] for (a)(i)/(a)(ii) style questions
tutor_override      boolean default false
override_marks      int         -- set if tutor manually edited the mark
override_feedback   text        -- set if tutor manually edited the feedback
created_at          timestamptz default now()
```

> `part` and `sub_questions` added in `supabase/migrations/20260325_mark_paper_schema.sql`.

---

### `reports`

```sql
id              uuid primary key default gen_random_uuid()
submission_id   uuid references submissions(id) unique
pdf_url         text            -- Supabase Storage path after PDF generation
tutor_approved  boolean default false
approved_at     timestamptz
generated_at    timestamptz
```

---

## RLS Policies (pattern)

Every table with `tutor_id` (or reachable via FK to a tutor):
- `SELECT / INSERT / UPDATE / DELETE` restricted by `auth.uid() = tutor_id`
- Use Supabase's `WITH CHECK` on INSERT to enforce ownership

### Billing field protection on `tutors`

```sql
ALTER TABLE public.tutors ENABLE ROW LEVEL SECURITY;

-- Billing fields may ONLY be updated by the service role or SECURITY DEFINER functions.
-- This means even a direct Supabase client call from the browser cannot change plan or limits.
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
```

---

## Query Function Pattern

All DB access goes through typed functions in `lib/db/`. Example:

```typescript
// lib/db/batches.ts
import { createServerClient } from '@/lib/supabase/server';

export async function getBatchesByTutor(tutorId: string) {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from('batches')
    .select('id, name, status, total_papers, marked_papers, created_at, question_papers(title, subjects(name))')
    .eq('tutor_id', tutorId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data;
}
```

Rules:
- Always select only needed columns -- never `select('*')` on joins.
- Any changes to billing fields (`plan`, `ai_minutes_*`, `stripe_*`) must go through:
  - Stripe webhook (service-role client), or
  - `increment_ai_minutes_used` / `add_topup_minutes` SQL functions.
- Never update billing fields from client-context API routes using the anon client.

---

## Query Functions Reference

### `lib/db/question-papers.ts`
| Function | Description |
|----------|-------------|
| `getQuestionPapersByTutor(tutorId)` | List papers with nested subject + marking_schemes(id) |
| `getQuestionPaperById(paperId, tutorId)` | Get single paper (ownership check via tutor_id) |
| `createQuestionPaper(input)` | Insert question paper record |
| `getBatchCountByPaper(paperId)` | Count batches referencing this paper (used to guard deletion) |
| `deleteQuestionPaper(paperId, tutorId)` | Delete question paper record (tutor-scoped) |

### `lib/db/marking-schemes.ts`
| Function | Description |
|----------|-------------|
| `getMarkingSchemeByPaper(paperId)` | Get scheme linked to a paper |
| `createMarkingScheme(input)` | Create scheme record |
| `getMarkingSchemeById(schemeId)` | Fetch scheme with structure_json |
| `updateMarkingSchemeStructure(schemeId, structureJson)` | Update parsed structure |
| `deleteMarkingSchemeByPaper(paperId)` | Delete scheme + its embeddings for a paper, returns `{ id, pdf_url } | null` |
| `insertEmbeddingChunks(chunks)` | Bulk insert embedding vectors |
| `deleteEmbeddingsByScheme(schemeId)` | Delete all embeddings for a scheme |
| `markEmbeddingsDone(schemeId)` | Set embeddings_done flag |
| `matchMarkingCriteria(schemeId, queryEmbedding, matchCount)` | RAG retrieval via cosine distance |

### `lib/db/batches.ts`
| Function | Description |
|----------|-------------|
| `getBatchesByTutor(tutorId)` | List batches for a tutor |
| `getBatchById(batchId, tutorId)` | Get single batch including `paper_name` (ownership check via tutor_id) |
| `createBatch(input)` | Create batch with paper, scheme, medium |
| `updateBatchStatus(batchId, status)` | Update batch status (pending/processing/completed/failed) |
| `updateBatchClaudeBatchId(batchId, claudeBatchId)` | Save Anthropic Batch API job ID |
| `updateBatchName(batchId, tutorId, name)` | Update batch name (tutor-scoped ownership check) |
| `updateBatchPaperName(batchId, tutorId, paperName)` | Store paper name (e.g. 'Pure (Paper I)') on batch — called from dispatch route |
| `updateBatchMarkedPapers(batchId, markedPapers)` | Update marked paper count |
| `deleteBatch(batchId, tutorId)` | Delete batch record (tutor-scoped, cascades to students/submissions/results via FK) |

### `lib/db/submissions.ts`
| Function | Description |
|----------|-------------|
| `getSubmissionsByBatch(batchId)` | List submissions with nested student data |
| `createStudentAndSubmission(input)` | Create student + submission atomically |
| `updateBatchPaperCount(batchId, total)` | Update total_papers count |
| `updateSubmissionStatus(submissionId, status, claudeReqId?)` | Update submission status + optional claude_req_id |
| `getSubmissionPdfBuffer(pdfUrl)` | Download PDF from Supabase Storage, return Buffer |

### `lib/db/marking-results.ts`
| Function | Description |
|----------|-------------|
| `getMarkingResultsBySubmission(submissionId)` | Get all marking results for a submission (includes `part`, `sub_questions`) |
| `getMarkingResultsByBatch(batchId)` | Get all marking results for all submissions in a batch (inner join on submissions, includes `part`, `sub_questions`) |
| `saveMarkingResults(submissionId, result)` | Inserts rows to `marking_results` (with `part`, `sub_questions`); also updates `submissions` with summary fields (`total_awarded`, `total_max`, `general_feedback`, `best_questions_selected`, `paper_name`). Uses service-role client — runs in background job context. |
| `updateMarkingOverride(resultId, submissionId, overrideMarks, overrideFeedback)` | Update tutor override fields (`tutor_override`, `override_marks`, `override_feedback`) on a marking result row |
