import useSWR from 'swr';

interface BatchResults {
  status: string;
  results: unknown[];
}

export function useBatchPolling(batchId: string, enabled: boolean) {
  const { data, error } = useSWR<BatchResults>(
    enabled ? `/api/batches/${batchId}/results` : null,
    { refreshInterval: 15000 }
  );
  return { results: data, isDone: data?.status === 'completed', error };
}
