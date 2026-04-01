import useSWR from 'swr';

interface PollData {
  status: 'processing' | 'completed' | 'failed';
  marked: number;
  total: number;
}

export function useBatchPolling(batchId: string, enabled: boolean) {
  const { data, error } = useSWR<PollData>(
    enabled ? `/api/batches/${batchId}/poll` : null,
    { refreshInterval: 15000 }
  );
  return { pollData: data, isDone: data?.status === 'completed', error };
}
