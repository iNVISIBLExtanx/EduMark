# UI Conventions & Component Standards

## Component Library
- **shadcn/ui** for all base components (Button, Card, Dialog, Table, Badge, etc.)
- **Tailwind CSS** for all styling — no custom CSS files
- **lucide-react** for icons

## Component Rules
1. All page-level components (`BatchList`, `BatchDetail`, `SubmissionResultsPanel`, etc.) are `'use client'` components
2. `page.tsx` files have NO `'use client'` directive — they are server components that just render one child
3. Never pass server-fetched data as props through `page.tsx` — use SWR hooks inside the component

## Language-Aware Display
When showing feedback or student answers, apply the correct font class based on the batch medium:
```tsx
const FONT_CLASS = {
  sinhala: 'font-sinhala leading-loose',  // Noto Sans Sinhala loaded via next/font
  tamil:   'font-tamil leading-loose',
  english: 'font-sans',
};

<p className={FONT_CLASS[batch.medium]}>{result.feedback}</p>
```

Load Noto Sans Sinhala and Noto Sans Tamil via `next/font/google` in `app/layout.tsx`:
```tsx
import { Noto_Sans_Sinhala, Noto_Sans_Tamil } from 'next/font/google';
const sinhala = Noto_Sans_Sinhala({ subsets: ['sinhala'], variable: '--font-sinhala' });
const tamil = Noto_Sans_Tamil({ subsets: ['tamil'], variable: '--font-tamil' });
```

## Status Badges
Use consistent color coding:
- `pending` → gray
- `processing` → blue (with spinner)
- `completed` → green
- `failed` → red
- `ocr_confidence: low` → yellow warning badge beside question

## Loading States
Every component using a SWR hook must handle:
```tsx
if (isLoading) return <LoadingSpinner />;
if (error) return <ErrorMessage message={error.message} />;
```

## Form Handling
Use `react-hook-form` + `zod` for all forms. Define zod schemas in `lib/validations/`.

## Bulk Upload Pattern
`BulkUploader.tsx` provides drag-and-drop file upload:
- Drop zone with visual feedback (blue highlight on drag-over)
- Client-side validation: PDF type, 20MB size limit, 50 file maximum
- File list with editable student name (auto-populated from filename) + optional index number
- Uses `apiUpload` from `lib/api-client.ts` for multipart upload
- Calls `onUploadComplete` callback after success to trigger SWR revalidation

## Create Batch Pattern
`CreateBatchDialog.tsx` (opened from `BatchList.tsx` via "Create Batch" button):
- Batch Name text input (required, 1-200 chars)
- Question Paper dropdown (all papers from `useQuestionPapers`, scheme_id derived from selection)
- Medium shown as read-only text (auto-derived from tutor's `marking_language` via `useTutorProfile` — not selectable)
- On success: navigates to `/batches/{batch.id}` for student paper upload

## Delete Question Paper Pattern
`QuestionPaperList.tsx` has a Trash2 icon per row:
- Confirmation dialog before delete ("Delete Question Paper" with warning)
- `DELETE /api/question-papers/[id]` via `apiFetch`
- 409 error displayed if paper has associated batches
- Calls `mutate()` on success to refresh the list

## Batch Detail Navigation
`BatchDetail.tsx` has a "Back to Batches" button (ArrowLeft icon) at the top that navigates to `/batches`.

## Batch Name Editing
`BatchDetail.tsx` has a Pencil icon beside the batch name. Clicking it shows an inline input + Save/Cancel buttons. Save calls `PATCH /api/batches/[id]` with the new name. Question paper and medium are displayed but not editable.

## Batch Deletion
Delete buttons are on each batch card in `BatchList.tsx` (Trash2 icon), not inside `BatchDetail.tsx`.
- Confirmation dialog before delete ("Delete Batch" with warning about permanent deletion)
- `DELETE /api/batches/[id]` via `apiFetch`
- 409 error displayed if batch is processing
- Calls `mutate()` on success to refresh the list

## Dispatch & Polling Pattern
`BatchDetail.tsx` manages the AI marking lifecycle:
- `pending` + submissions: "Mark Papers" button (calls `apiFetch` POST dispatch)
- `processing`: Animated progress text with `useBatchPolling` (15s refresh)
- `completed`: Green checkmark status
- `failed`: Red error status
- 402 errors: `UpgradeModal` for insufficient minutes

## Submission Review Dialog Pattern

`SubmissionReviewDialog.tsx` is a full-screen review modal that replaced the old inline `<TableRow>` expansion. Opened from the "View Results" button in `BatchDetail.tsx`.

Props: `submissionId`, `studentName`, `language`, `isOpen`, `onClose`.

State in `BatchDetail.tsx`:
```tsx
const [dialogSubmission, setDialogSubmission] = useState<{ id: string; studentName: string } | null>(null);
```

"View Results" button wiring:
```tsx
<Button onClick={() => setDialogSubmission({ id: submission.id, studentName: submission.students.name })}>
  View Results
</Button>
```

Dialog mount at bottom of `BatchDetail.tsx` render:
```tsx
{dialogSubmission && (
  <SubmissionReviewDialog
    submissionId={dialogSubmission.id}
    studentName={dialogSubmission.studentName}
    language={batch.medium}
    isOpen={!!dialogSubmission}
    onClose={() => setDialogSubmission(null)}
  />
)}
```

The dialog contains:
- `SubmissionResultsPanel` (full results + per-question edit) in a scrollable area
- Bottom action bar: "Close", "Download Report", "Approve & Download"
- `data-testid="review-dialog"` on `DialogContent`
- `className="max-w-4xl h-[90vh] flex flex-col p-0"` — fixed height, scrollable body

## Combined Maths Paper Selector

For Combined Maths batches, the tutor must specify which paper they are dispatching ('Pure (Paper I)' or 'Applied (Paper II)') before marking can start.

**When to show**: `batch.subject_name === 'Combined Maths'` AND `batch.paper_name` is null (not yet set).

**Pattern in `BatchDetail.tsx`**:
```tsx
{batch.subject_name === 'Combined Maths' && !batch.paper_name && (
  <div className="space-y-1">
    <label className="text-sm font-medium">Select Paper</label>
    <select value={selectedPaperName} onChange={e => setSelectedPaperName(e.target.value)}
      className="rounded-md border border-gray-300 px-3 py-2 text-sm">
      <option value="">Choose paper...</option>
      <option value="Pure (Paper I)">Pure (Paper I)</option>
      <option value="Applied (Paper II)">Applied (Paper II)</option>
    </select>
  </div>
)}
```

**Disable dispatch button** until selection is made:
```typescript
const needsPaperSelection = batch.subject_name === 'Combined Maths' && !batch.paper_name && !selectedPaperName;
// Apply: disabled={dispatching || needsPaperSelection}
```

**Send in dispatch body**: Pass selected value as `paper_name` in the POST body. Once stored on the batch the selector is hidden.
