# UI Conventions & Component Standards

## Component Library
- **shadcn/ui** for all base components (Button, Card, Dialog, Table, Badge, etc.)
- **Tailwind CSS** for all styling — no custom CSS files
- **lucide-react** for icons

## Component Rules
1. All page-level components (`BatchList`, `MarkingReview`, etc.) are `'use client'` components
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
