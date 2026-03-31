import useSWR from 'swr';

interface BatchDetailRaw {
  id: string;
  name: string;
  status: string;
  medium: string;
  total_papers: number;
  marked_papers: number;
  created_at: string;
  paper_name: string | null;
  question_papers?: { subjects?: { name?: string } } | null;
}

export interface BatchDetail {
  id: string;
  name: string;
  status: string;
  medium: string;
  total_papers: number;
  marked_papers: number;
  created_at: string;
  paper_name: string | null;
  subject_name: string | null;
}

export function useBatchDetail(batchId: string) {
  const { data, error, isLoading, mutate } = useSWR<BatchDetailRaw>(
    batchId ? `/api/batches/${batchId}` : null
  );

  const batch: BatchDetail | undefined = data
    ? {
        id: data.id,
        name: data.name,
        status: data.status,
        medium: data.medium,
        total_papers: data.total_papers,
        marked_papers: data.marked_papers,
        created_at: data.created_at,
        paper_name: data.paper_name,
        subject_name: data.question_papers?.subjects?.name ?? null,
      }
    : undefined;

  return { batch, error, isLoading, mutate };
}
