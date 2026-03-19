'use client';

interface QuestionFeedbackProps {
  questionNo: number;
  maxMarks: number;
  awardedMarks: number;
  feedback: string;
  ocrConfidence: string;
}

export function QuestionFeedbackCard({
  questionNo,
  maxMarks,
  awardedMarks,
  feedback,
  ocrConfidence,
}: QuestionFeedbackProps) {
  return (
    <div className="rounded-lg border p-4 space-y-2">
      <div className="flex justify-between">
        <h3 className="font-medium">Question {questionNo}</h3>
        <span className="text-sm">{awardedMarks}/{maxMarks}</span>
      </div>
      <p className="text-sm text-gray-700">{feedback}</p>
      {ocrConfidence === 'low' && (
        <span className="inline-block rounded bg-yellow-100 px-2 py-0.5 text-xs text-yellow-700">
          Low OCR confidence
        </span>
      )}
    </div>
  );
}
