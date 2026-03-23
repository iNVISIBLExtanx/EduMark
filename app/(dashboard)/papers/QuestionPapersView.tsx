'use client';

import { QuestionPaperList } from '@/components/papers/QuestionPaperList';
import { QuestionPaperUploadForm } from '@/components/papers/QuestionPaperUploadForm';

export function QuestionPapersView() {
  return (
    <div className="space-y-8 p-6">
      <h1 className="text-2xl font-bold">Question Papers</h1>
      <QuestionPaperUploadForm />
      <QuestionPaperList />
    </div>
  );
}
