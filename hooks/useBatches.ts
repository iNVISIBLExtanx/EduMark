import useSWR from 'swr';

interface Batch {
  id: string;
  name: string;
  status: string;
  medium: string;
  total_papers: number;
  marked_papers: number;
  created_at: string;
}

export function useBatches() {
  const { data, error, isLoading, mutate } = useSWR<Batch[]>('/api/batches');
  return { batches: data ?? [], error, isLoading, mutate };
}
