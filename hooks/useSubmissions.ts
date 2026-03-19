import useSWR from 'swr';

interface Submission {
  id: string;
  student_id: string;
  pdf_url: string;
  page_count: number;
  status: string;
  created_at: string;
  students: { name: string; index_no: string | null };
}

export function useSubmissions(batchId: string) {
  const { data, error, isLoading, mutate } = useSWR<Submission[]>(
    batchId ? `/api/batches/${batchId}/submissions` : null
  );
  return { submissions: data ?? [], error, isLoading, mutate };
}
