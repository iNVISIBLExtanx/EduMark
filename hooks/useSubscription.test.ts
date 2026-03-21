import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { SWRConfig } from 'swr';
import React from 'react';
import { useSubscription } from './useSubscription';

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

describe('useSubscription', () => {
  it('returns computed fields from subscription data', async () => {
    const mockData = {
      plan: 'starter',
      ai_minutes_used: 30,
      ai_minutes_limit: 50,
      subscription_status: 'active',
      billing_period_end: '2026-04-19T00:00:00Z',
    };

    const wrapper = createWrapper(() => Promise.resolve(mockData));
    const { result } = renderHook(() => useSubscription(), { wrapper });

    await waitFor(() => expect(result.current.subscription).toBeDefined());

    expect(result.current.available).toBe(20);
    expect(result.current.usagePercent).toBe(60);
    expect(result.current.isPastDue).toBe(false);
    expect(result.current.isFree).toBe(false);
  });

  it('identifies past_due status', async () => {
    const mockData = {
      plan: 'standard',
      ai_minutes_used: 10,
      ai_minutes_limit: 150,
      subscription_status: 'past_due',
      billing_period_end: '2026-04-19T00:00:00Z',
    };

    const wrapper = createWrapper(() => Promise.resolve(mockData));
    const { result } = renderHook(() => useSubscription(), { wrapper });

    await waitFor(() => expect(result.current.subscription).toBeDefined());

    expect(result.current.isPastDue).toBe(true);
  });

  it('identifies free plan', async () => {
    const mockData = {
      plan: 'free',
      ai_minutes_used: 0,
      ai_minutes_limit: 10,
      subscription_status: 'active',
      billing_period_end: null,
    };

    const wrapper = createWrapper(() => Promise.resolve(mockData));
    const { result } = renderHook(() => useSubscription(), { wrapper });

    await waitFor(() => expect(result.current.subscription).toBeDefined());

    expect(result.current.isFree).toBe(true);
    expect(result.current.available).toBe(10);
  });

  it('returns defaults when data is not yet loaded', () => {
    const wrapper = createWrapper(() => new Promise(() => {})); // never resolves
    const { result } = renderHook(() => useSubscription(), { wrapper });

    expect(result.current.subscription).toBeUndefined();
    expect(result.current.available).toBe(0);
    expect(result.current.usagePercent).toBe(0);
  });
});
