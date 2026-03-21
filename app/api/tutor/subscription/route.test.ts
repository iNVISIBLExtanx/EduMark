import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mockSupabaseClient } from '../../../../__mocks__/supabase';
import { GET } from './route';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('GET /api/tutor/subscription', () => {
  it('returns 401 when unauthenticated', async () => {
    mockSupabaseClient.auth.getUser.mockResolvedValue({
      data: { user: null },
    });

    const res = await GET();
    expect(res.status).toBe(401);
  });

  it('returns billing fields on success', async () => {
    mockSupabaseClient.auth.getUser.mockResolvedValue({
      data: { user: { id: 'user-1' } },
    });
    const billingData = {
      plan: 'starter',
      ai_minutes_used: 10,
      ai_minutes_limit: 50,
      subscription_status: 'active',
      billing_period_end: '2026-04-19T00:00:00Z',
    };
    mockSupabaseClient.single.mockResolvedValue({
      data: billingData,
      error: null,
    });

    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual(billingData);
  });

  it('returns 500 on database error', async () => {
    mockSupabaseClient.auth.getUser.mockResolvedValue({
      data: { user: { id: 'user-1' } },
    });
    mockSupabaseClient.single.mockResolvedValue({
      data: null,
      error: { message: 'DB error' },
    });

    const res = await GET();
    expect(res.status).toBe(500);
  });

  it('selects exactly the required billing fields', async () => {
    mockSupabaseClient.auth.getUser.mockResolvedValue({
      data: { user: { id: 'user-1' } },
    });
    mockSupabaseClient.single.mockResolvedValue({
      data: { plan: 'free', ai_minutes_used: 0, ai_minutes_limit: 10, subscription_status: 'active', billing_period_end: null },
      error: null,
    });

    await GET();

    expect(mockSupabaseClient.select).toHaveBeenCalledWith(
      'plan, ai_minutes_used, ai_minutes_limit, subscription_status, billing_period_end',
    );
  });

  it('queries by authenticated user id', async () => {
    mockSupabaseClient.auth.getUser.mockResolvedValue({
      data: { user: { id: 'user-42' } },
    });
    mockSupabaseClient.single.mockResolvedValue({
      data: { plan: 'free', ai_minutes_used: 0, ai_minutes_limit: 10, subscription_status: 'active', billing_period_end: null },
      error: null,
    });

    await GET();

    expect(mockSupabaseClient.eq).toHaveBeenCalledWith('id', 'user-42');
  });

  it('queries the tutors table', async () => {
    mockSupabaseClient.auth.getUser.mockResolvedValue({
      data: { user: { id: 'user-1' } },
    });
    mockSupabaseClient.single.mockResolvedValue({
      data: { plan: 'free', ai_minutes_used: 0, ai_minutes_limit: 10, subscription_status: 'active', billing_period_end: null },
      error: null,
    });

    await GET();

    expect(mockSupabaseClient.from).toHaveBeenCalledWith('tutors');
  });
});
