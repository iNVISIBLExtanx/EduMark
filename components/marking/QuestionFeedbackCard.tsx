'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Pencil, Save, X } from 'lucide-react';
import { apiFetch } from '@/lib/api-client';

const FONT_CLASS: Record<string, string> = {
  sinhala: 'font-sinhala leading-loose',
  tamil: 'font-tamil leading-loose',
  english: 'font-sans',
};

interface QuestionFeedbackProps {
  id: string;
  submissionId: string;
  questionNo: number;
  maxMarks: number;
  awardedMarks: number;
  feedback: string;
  studentAnswerText: string;
  ocrConfidence: string;
  tutorOverride: boolean;
  overrideMarks: number | null;
  overrideFeedback: string | null;
  language: string;
  onSaved: () => void;
}

export function QuestionFeedbackCard({
  id,
  submissionId,
  questionNo,
  maxMarks,
  awardedMarks,
  feedback,
  studentAnswerText,
  ocrConfidence,
  tutorOverride,
  overrideMarks,
  overrideFeedback,
  language,
  onSaved,
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
    setMarks(overrideMarks ?? awardedMarks);
    setFeedbackText(overrideFeedback ?? feedback);
    setEditing(false);
  };

  return (
    <div className="rounded-lg border p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
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

      {editing ? (
        <div className="space-y-3 border-t pt-3">
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Override Marks</label>
            <Input
              type="number"
              min={0}
              max={maxMarks}
              value={marks}
              onChange={(e) => setMarks(Number(e.target.value))}
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
          <p className={`text-sm text-gray-700 ${fontClass}`}>{displayFeedback}</p>
        </div>
      )}
    </div>
  );
}
