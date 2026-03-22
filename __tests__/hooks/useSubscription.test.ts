import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { SWRConfig } from 'swr';
import React from 'react';
import { useSubscription } from '@/hooks/useSubscription';

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

  it('returns error when API call fails', async () => {
    const wrapper = createWrapper(() => Promise.reject(new Error('API down')));
    const { result } = renderHook(() => useSubscription(), { wrapper });

    await waitFor(() => expect(result.current.error).toBeDefined());

    expect(result.current.subscription).toBeUndefined();
    expect(result.current.error).toBeTruthy();
  });

  it('exposes mutate function for revalidation', async () => {
    const mockData = {
      plan: 'starter',
      ai_minutes_used: 0,
      ai_minutes_limit: 50,
      subscription_status: 'active',
      billing_period_end: '2026-04-19T00:00:00Z',
    };
    const wrapper = createWrapper(() => Promise.resolve(mockData));
    const { result } = renderHook(() => useSubscription(), { wrapper });

    await waitFor(() => expect(result.current.subscription).toBeDefined());

    expect(typeof result.current.mutate).toBe('function');
  });

  it('identifies canceled subscription as not past_due', async () => {
    const mockData = {
      plan: 'standard',
      ai_minutes_used: 10,
      ai_minutes_limit: 150,
      subscription_status: 'canceled',
      billing_period_end: null,
    };
    const wrapper = createWrapper(() => Promise.resolve(mockData));
    const { result } = renderHook(() => useSubscription(), { wrapper });

    await waitFor(() => expect(result.current.subscription).toBeDefined());

    expect(result.current.isPastDue).toBe(false);
  });

  it('computes 100% usage when all minutes are used', async () => {
    const mockData = {
      plan: 'starter',
      ai_minutes_used: 50,
      ai_minutes_limit: 50,
      subscription_status: 'active',
      billing_period_end: '2026-04-19T00:00:00Z',
    };
    const wrapper = createWrapper(() => Promise.resolve(mockData));
    const { result } = renderHook(() => useSubscription(), { wrapper });

    await waitFor(() => expect(result.current.subscription).toBeDefined());

    expect(result.current.usagePercent).toBe(100);
    expect(result.current.available).toBe(0);
  });

  it('handles zero ai_minutes_limit without NaN', async () => {
    const mockData = {
      plan: 'free',
      ai_minutes_used: 0,
      ai_minutes_limit: 0,
      subscription_status: 'active',
      billing_period_end: null,
    };
    const wrapper = createWrapper(() => Promise.resolve(mockData));
    const { result } = renderHook(() => useSubscription(), { wrapper });

    await waitFor(() => expect(result.current.subscription).toBeDefined());

    // usagePercent should be 0, not NaN (division by zero guard needed)
    expect(result.current.usagePercent).toBe(0);
    expect(Number.isNaN(result.current.usagePercent)).toBe(false);
  });
});
