import useSWR from 'swr';

interface QuestionPaper {
  id: string;
  title: string;
  year: number | null;
  pdf_url: string;
  subject_id: string;
  created_at: string;
  subjects: { name: string; code: string };
}

export function useQuestionPapers() {
  const { data, error, isLoading, mutate } = useSWR<QuestionPaper[]>('/api/question-papers');
  return { papers: data ?? [], error, isLoading, mutate };
}
