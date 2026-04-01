'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Pencil, Save, X } from 'lucide-react';
import { apiFetch } from '@/lib/api-client';
import type { SubQuestion } from '@/hooks/useMarkingResults';

const FONT_CLASS: Record<string, string> = {
  sinhala: 'font-sinhala leading-loose',
  tamil: 'font-tamil leading-loose',
  english: 'font-sans',
};

interface QuestionFeedbackProps {
  id: string;
  submissionId: string;
  part: string | null;
  questionNo: number;
  maxMarks: number;
  awardedMarks: number;
  feedback: string;
  studentAnswerText: string;
  ocrConfidence: string;
  subQuestions: SubQuestion[] | null;
  tutorOverride: boolean;
  overrideMarks: number | null;
  overrideFeedback: string | null;
  language: string;
  onSaved: () => void;
  onMarksChange?: (marks: number) => void;
}

export function QuestionFeedbackCard({
  id,
  submissionId,
  part,
  questionNo,
  maxMarks,
  awardedMarks,
  feedback,
  studentAnswerText,
  ocrConfidence,
  subQuestions,
  tutorOverride,
  overrideMarks,
  overrideFeedback,
  language,
  onSaved,
  onMarksChange,
}: QuestionFeedbackProps) {
  const [editing, setEditing] = useState(false);
  const [marks, setMarks] = useState(overrideMarks ?? awardedMarks);
  const [feedbackText, setFeedbackText] = useState(overrideFeedback ?? feedback);
  const [saving, setSaving] = useState(false);

  const displayMarks = tutorOverride ? overrideMarks ?? awardedMarks : awardedMarks;
  const displayFeedback = tutorOverride ? overrideFeedback ?? feedback : feedback;
  const fontClass = FONT_CLASS[language] ?? FONT_CLASS.english;

  const handleSave = async () => {
    setSaving(true);
    try {
      await apiFetch(`/api/submissions/${submissionId}/override`, {
        method: 'PATCH',
        body: JSON.stringify({
          result_id: id,
          override_marks: marks,
          override_feedback: feedbackText,
        }),
      });
      setEditing(false);
      onSaved();
    } catch {
      // Error handling — apiFetch throws on non-ok
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    const original = overrideMarks ?? awardedMarks;
    setMarks(original);
    setFeedbackText(overrideFeedback ?? feedback);
    setEditing(false);
    onMarksChange?.(original);
  };

  return (
    <div className="rounded-lg border p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {part && (
            <Badge variant="outline" className="bg-gray-100 text-gray-600 border-gray-300 text-xs">
              {part}
            </Badge>
          )}
          <h3 className="font-medium">Question {questionNo}</h3>
          {ocrConfidence === 'low' && (
            <Badge variant="outline" className="bg-yellow-100 text-yellow-700 border-yellow-300">
              Low OCR confidence
            </Badge>
          )}
          {tutorOverride && !editing && (
            <Badge variant="outline" className="bg-blue-100 text-blue-700 border-blue-300">
              Edited
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">
            {editing ? marks : displayMarks}/{maxMarks}
          </span>
          {!editing && (
            <Button variant="ghost" size="sm" onClick={() => setEditing(true)}>
              <Pencil className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {studentAnswerText && (
        <div>
          <p className="text-xs text-gray-500 mb-1">Student Answer</p>
          <p className={`text-sm text-gray-700 ${fontClass}`}>{studentAnswerText}</p>
        </div>
      )}

      {subQuestions && subQuestions.length > 0 && (
        <div>
          <p className="text-xs text-gray-500 mb-1">Sub-question Breakdown</p>
          <div className="space-y-1">
            {subQuestions.map((sq) => (
              <div key={sq.label} className="flex items-start gap-2 text-sm">
                <span className="font-mono text-gray-600 w-14 shrink-0">{sq.label}</span>
                <span className="text-gray-800 font-medium w-16 shrink-0">
                  {sq.awarded_marks}/{sq.max_marks}
                </span>
                <span className={`text-gray-600 ${fontClass}`}>{sq.feedback}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {editing ? (
        <div className="space-y-3 border-t pt-3">
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Override Marks</label>
            <Input
              type="number"
              min={0}
              max={maxMarks}
              value={marks}
              onChange={(e) => {
                const val = Number(e.target.value);
                setMarks(val);
                onMarksChange?.(val);
              }}
            />
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Override Feedback</label>
            <textarea
              className={`w-full rounded-md border border-gray-300 px-3 py-2 text-sm ${fontClass}`}
              rows={3}
              value={feedbackText}
              onChange={(e) => setFeedbackText(e.target.value)}
            />
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={handleSave} disabled={saving}>
              <Save className="h-4 w-4 mr-1" />
              {saving ? 'Saving...' : 'Save'}
            </Button>
            <Button variant="ghost" size="sm" onClick={handleCancel} disabled={saving}>
              <X className="h-4 w-4 mr-1" />
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <div>
          <p className="text-xs text-gray-500 mb-1">Feedback</p>
          <p
            className={`text-sm text-gray-700 ${fontClass} cursor-pointer rounded px-1 -mx-1 hover:bg-gray-50`}
            onClick={() => setEditing(true)}
            title="Click to edit feedback"
          >
            {displayFeedback}
          </p>
        </div>
      )}
    </div>
  );
}
