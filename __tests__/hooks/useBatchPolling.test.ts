import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';

vi.mock('swr', () => ({
  default: vi.fn(),
}));

import useSWR from 'swr';
const mockUseSWR = useSWR as ReturnType<typeof vi.fn>;

import { useBatchPolling } from '@/hooks/useBatchPolling';

describe('useBatchPolling', () => {
  it('passes correct poll URL when enabled', () => {
    mockUseSWR.mockReturnValue({ data: undefined, error: undefined });
    renderHook(() => useBatchPolling('batch-123', true));
    expect(mockUseSWR).toHaveBeenCalledWith(
      '/api/batches/batch-123/poll',
      expect.objectContaining({ refreshInterval: 15000 })
    );
  });

  it('passes null key when disabled', () => {
    mockUseSWR.mockReturnValue({ data: undefined, error: undefined });
    renderHook(() => useBatchPolling('batch-123', false));
    expect(mockUseSWR).toHaveBeenCalledWith(null, expect.any(Object));
  });

  it('returns isDone true when status is completed', () => {
    mockUseSWR.mockReturnValue({ data: { status: 'completed', results: [] }, error: undefined });
    const { result } = renderHook(() => useBatchPolling('batch-123', true));
    expect(result.current.isDone).toBe(true);
  });

  it('returns isDone false when status is processing', () => {
    mockUseSWR.mockReturnValue({ data: { status: 'processing', marked: 2, total: 5 }, error: undefined });
    const { result } = renderHook(() => useBatchPolling('batch-123', true));
    expect(result.current.isDone).toBe(false);
  });

  it('returns error from SWR', () => {
    const swrError = new Error('Network failure');
    mockUseSWR.mockReturnValue({ data: undefined, error: swrError });
    const { result } = renderHook(() => useBatchPolling('batch-123', true));
    expect(result.current.error).toBe(swrError);
  });
});
