import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { SWRConfig } from 'swr';
import React from 'react';
import { useBatchDetail } from '@/hooks/useBatchDetail';

function createWrapper(fetcher: (key: string) => Promise<unknown>) {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(
      SWRConfig,
      { value: { fetcher, dedupingInterval: 0, provider: () => new Map() } },
      children,
    );
  };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('useBatchDetail', () => {
  it('returns batch fields from API response', async () => {
    const mockData = {
      id: 'batch-1',
      name: 'Test Batch',
      status: 'pending',
      medium: 'english',
      total_papers: 5,
      marked_papers: 0,
      created_at: '2026-03-15T00:00:00Z',
      paper_name: null,
      question_papers: { subjects: { name: 'Physics' } },
    };

    const wrapper = createWrapper(() => Promise.resolve(mockData));
    const { result } = renderHook(() => useBatchDetail('batch-1'), { wrapper });

    await waitFor(() => expect(result.current.batch).toBeDefined());

    expect(result.current.batch?.id).toBe('batch-1');
    expect(result.current.batch?.name).toBe('Test Batch');
    expect(result.current.batch?.status).toBe('pending');
    expect(result.current.batch?.medium).toBe('english');
    expect(result.current.batch?.total_papers).toBe(5);
    expect(result.current.batch?.marked_papers).toBe(0);
  });

  it('exposes paper_name from API response', async () => {
    const mockData = {
      id: 'batch-2',
      name: 'CM Batch',
      status: 'pending',
      medium: 'english',
      total_papers: 3,
      marked_papers: 0,
      created_at: '2026-03-15T00:00:00Z',
      paper_name: 'Pure (Paper I)',
      question_papers: { subjects: { name: 'Combined Maths' } },
    };

    const wrapper = createWrapper(() => Promise.resolve(mockData));
    const { result } = renderHook(() => useBatchDetail('batch-2'), { wrapper });

    await waitFor(() => expect(result.current.batch).toBeDefined());

    expect(result.current.batch?.paper_name).toBe('Pure (Paper I)');
  });

  it('extracts subject_name from nested question_papers.subjects join', async () => {
    const mockData = {
      id: 'batch-3',
      name: 'CM Batch',
      status: 'completed',
      medium: 'sinhala',
      total_papers: 10,
      marked_papers: 10,
      created_at: '2026-03-15T00:00:00Z',
      paper_name: null,
      question_papers: { subjects: { name: 'Combined Maths' } },
    };

    const wrapper = createWrapper(() => Promise.resolve(mockData));
    const { result } = renderHook(() => useBatchDetail('batch-3'), { wrapper });

    await waitFor(() => expect(result.current.batch).toBeDefined());

    expect(result.current.batch?.subject_name).toBe('Combined Maths');
  });

  it('returns null for subject_name when question_papers is null', async () => {
    const mockData = {
      id: 'batch-4',
      name: 'Batch no paper',
      status: 'pending',
      medium: 'english',
      total_papers: 0,
      marked_papers: 0,
      created_at: '2026-03-15T00:00:00Z',
      paper_name: null,
      question_papers: null,
    };

    const wrapper = createWrapper(() => Promise.resolve(mockData));
    const { result } = renderHook(() => useBatchDetail('batch-4'), { wrapper });

    await waitFor(() => expect(result.current.batch).toBeDefined());

    expect(result.current.batch?.subject_name).toBeNull();
  });

  it('returns null for subject_name when subjects is undefined', async () => {
    const mockData = {
      id: 'batch-5',
      name: 'Batch no subject',
      status: 'pending',
      medium: 'english',
      total_papers: 0,
      marked_papers: 0,
      created_at: '2026-03-15T00:00:00Z',
      paper_name: null,
      question_papers: {},
    };

    const wrapper = createWrapper(() => Promise.resolve(mockData));
    const { result } = renderHook(() => useBatchDetail('batch-5'), { wrapper });

    await waitFor(() => expect(result.current.batch).toBeDefined());

    expect(result.current.batch?.subject_name).toBeNull();
  });

  it('returns undefined batch when data not loaded', () => {
    const wrapper = createWrapper(() => new Promise(() => {})); // never resolves
    const { result } = renderHook(() => useBatchDetail('batch-1'), { wrapper });

    expect(result.current.batch).toBeUndefined();
    expect(result.current.isLoading).toBe(true);
  });

  it('returns error when API call fails', async () => {
    const wrapper = createWrapper(() => Promise.reject(new Error('Not found')));
    const { result } = renderHook(() => useBatchDetail('batch-1'), { wrapper });

    await waitFor(() => expect(result.current.error).toBeDefined());

    expect(result.current.batch).toBeUndefined();
    expect(result.current.error).toBeTruthy();
  });

  it('uses null SWR key when batchId is empty string', () => {
    const wrapper = createWrapper(() => Promise.resolve({}));
    const { result } = renderHook(() => useBatchDetail(''), { wrapper });

    // SWR key is null for empty batchId — data stays undefined
    expect(result.current.batch).toBeUndefined();
  });
});
