import useSWR from 'swr';

interface BatchDetail {
  id: string;
  name: string;
  status: string;
  medium: string;
  total_papers: number;
  marked_papers: number;
  created_at: string;
}

export function useBatchDetail(batchId: string) {
  const { data, error, isLoading, mutate } = useSWR<BatchDetail>(
    batchId ? `/api/batches/${batchId}` : null
  );
  return { batch: data, error, isLoading, mutate };
}
