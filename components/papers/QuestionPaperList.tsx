'use client';

import { useQuestionPapers } from '@/hooks/useQuestionPapers';
import { SubjectBadge } from '@/components/shared/SubjectBadge';

export function QuestionPaperList() {
  const { papers, isLoading, error } = useQuestionPapers();

  if (isLoading) return <p className="p-6">Loading question papers...</p>;
  if (error) return <p className="p-6 text-red-600">Error: {error.message}</p>;

  if (papers.length === 0) {
    return (
      <p className="text-gray-500">
        No question papers yet. Upload one to get started.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-left text-gray-500">
            <th className="pb-2 font-medium">Title</th>
            <th className="pb-2 font-medium">Subject</th>
            <th className="pb-2 font-medium">Year</th>
            <th className="pb-2 font-medium">Uploaded</th>
          </tr>
        </thead>
        <tbody>
          {papers.map((paper) => (
            <tr key={paper.id} className="border-b last:border-0">
              <td className="py-3 font-medium">{paper.title}</td>
              <td className="py-3">
                <SubjectBadge subject={paper.subjects.name} />
              </td>
              <td className="py-3 text-gray-500">{paper.year ?? '—'}</td>
              <td className="py-3 text-gray-500">
                {new Date(paper.created_at).toLocaleDateString()}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
