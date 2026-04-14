'use client';

import { useState, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTutorSubjects } from '@/hooks/useTutorSubjects';
import { useQuestionPapers } from '@/hooks/useQuestionPapers';
import { apiUpload } from '@/lib/api-client';
import { questionPaperSchema, type QuestionPaperInput } from '@/lib/validations/schemas';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const MAX_PAPER_FILE_SIZE = 20 * 1024 * 1024; // 20MB for question paper PDF
const MAX_SCHEME_FILE_SIZE = 5 * 1024 * 1024; // 5MB — scheme PDFs must be compact for Claude API request budget

export function QuestionPaperUploadForm() {
  const { subjects, isLoading: subjectsLoading } = useTutorSubjects();
  const { mutate } = useQuestionPapers();
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const paperFileRef = useRef<HTMLInputElement>(null);
  const schemeFileRef = useRef<HTMLInputElement>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<QuestionPaperInput>({
    resolver: zodResolver(questionPaperSchema),
  });

  const onSubmit = async (data: QuestionPaperInput) => {
    setUploadError(null);
    setSuccess(false);

    const paperFile = paperFileRef.current?.files?.[0];
    if (!paperFile) {
      setUploadError('Please select a question paper PDF');
      return;
    }
    if (paperFile.type !== 'application/pdf') {
      setUploadError('Question paper must be a PDF file');
      return;
    }
    if (paperFile.size > MAX_PAPER_FILE_SIZE) {
      setUploadError('Question paper must be under 20MB');
      return;
    }

    const schemeFile = schemeFileRef.current?.files?.[0];
    if (!schemeFile) {
      setUploadError('Please select a marking scheme PDF');
      return;
    }
    if (schemeFile.type !== 'application/pdf') {
      setUploadError('Marking scheme must be a PDF file');
      return;
    }
    if (schemeFile.size > MAX_SCHEME_FILE_SIZE) {
      setUploadError('Marking scheme must be under 5MB. Export as a compact PDF (not a scanned image) to keep the AI request within limits.');
      return;
    }

    setUploading(true);

    try {
      // Upload question paper
      const paperFormData = new FormData();
      paperFormData.append('file', paperFile);
      paperFormData.append('title', data.title);
      paperFormData.append('subject_id', data.subject_id);
      if (data.year) paperFormData.append('year', String(data.year));

      const paper = await apiUpload<{ id: string }>('/api/question-papers', paperFormData);

      // Upload marking scheme (required for AI marking)
      const schemeFormData = new FormData();
      schemeFormData.append('file', schemeFile);
      schemeFormData.append('paper_id', paper.id);
      await apiUpload('/api/marking-schemes', schemeFormData);

      setSuccess(true);
      reset();
      if (paperFileRef.current) paperFileRef.current.value = '';
      if (schemeFileRef.current) schemeFileRef.current.value = '';
      mutate();
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Upload Question Paper</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              placeholder="e.g. 2025 A/L Combined Maths Paper I"
              {...register('title')}
            />
            {errors.title && (
              <p className="text-sm text-red-600">{errors.title.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="subject_id">Subject</Label>
            <select
              id="subject_id"
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              disabled={subjectsLoading}
              {...register('subject_id')}
            >
              <option value="">Select a subject</option>
              {subjects.map((ts) => (
                <option key={ts.subject_id} value={ts.subject_id}>
                  {ts.subjects.name}
                </option>
              ))}
            </select>
            {errors.subject_id && (
              <p className="text-sm text-red-600">{errors.subject_id.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="year">Year (optional)</Label>
            <Input
              id="year"
              type="number"
              min={1990}
              max={2030}
              placeholder="e.g. 2025"
              {...register('year', { setValueAs: (v: string) => (v === '' ? undefined : Number(v)) })}
            />
            {errors.year && (
              <p className="text-sm text-red-600">{errors.year.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="paper-file">Question Paper PDF</Label>
            <Input
              id="paper-file"
              type="file"
              accept="application/pdf"
              ref={paperFileRef}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="scheme-file">Marking Scheme PDF</Label>
            <Input
              id="scheme-file"
              type="file"
              accept="application/pdf"
              ref={schemeFileRef}
            />
          </div>

          {uploadError && (
            <p className="text-sm text-red-600">{uploadError}</p>
          )}
          {success && (
            <p className="text-sm text-green-600">
              Question paper and marking scheme uploaded successfully!
            </p>
          )}

          <Button type="submit" disabled={uploading || subjectsLoading}>
            {uploading ? 'Uploading...' : 'Upload'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
