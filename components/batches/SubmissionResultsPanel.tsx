'use client';

import { useMarkingResults } from '@/hooks/useMarkingResults';
import { MarkingSummary } from '@/components/marking/MarkingSummary';
import { QuestionFeedbackCard } from '@/components/marking/QuestionFeedbackCard';

interface SubmissionResultsPanelProps {
  submissionId: string;
  language: string;
}

export function SubmissionResultsPanel({ submissionId, language }: SubmissionResultsPanelProps) {
  const { results, summary, isLoading, error, mutate } = useMarkingResults(submissionId);

  if (isLoading) return <p className="text-gray-500 py-2">Loading results...</p>;
  if (error) return <p className="text-red-600 py-2">Error loading results: {error.message}</p>;
  if (results.length === 0) return <p className="text-gray-500 py-2">No results available.</p>;

  // Prefer server-computed summary; fall back to local calculation for backward compat
  const totalAwarded = summary?.total_awarded ?? results.reduce((sum, r) => sum + r.awarded_marks, 0);
  const totalMax = summary?.total_max ?? results.reduce((sum, r) => sum + r.max_marks, 0);
  const overrideTotal = results.reduce((sum, r) => {
    if (r.tutor_override && r.override_marks !== null) return sum + r.override_marks;
    return sum + r.awarded_marks;
  }, 0);

  return (
    <div className="space-y-4 py-4 pl-4 border-l-2 border-blue-200">
      <MarkingSummary
        totalAwarded={totalAwarded}
        totalMax={totalMax}
        overrideTotal={overrideTotal}
      />
      <div className="space-y-3">
        {results.map((result) => (
          <QuestionFeedbackCard
            key={result.id}
            id={result.id}
            submissionId={submissionId}
            part={result.part}
            questionNo={result.question_no}
            maxMarks={result.max_marks}
            awardedMarks={result.awarded_marks}
            feedback={result.feedback}
            studentAnswerText={result.student_answer_text}
            ocrConfidence={result.ocr_confidence}
            subQuestions={result.sub_questions}
            tutorOverride={result.tutor_override}
            overrideMarks={result.override_marks}
            overrideFeedback={result.override_feedback}
            language={language}
            onSaved={() => mutate()}
          />
        ))}
      </div>
    </div>
  );
}
