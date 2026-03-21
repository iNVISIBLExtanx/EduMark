import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mockSupabaseClient } from '../../__mocks__/supabase';
import { checkAndDeductMinutes } from './billing';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('checkAndDeductMinutes', () => {
  it('deducts minutes on happy path', async () => {
    mockSupabaseClient.single.mockResolvedValue({
      data: { ai_minutes_used: 5, ai_minutes_limit: 50, subscription_status: 'active' },
      error: null,
    });
    mockSupabaseClient.rpc.mockResolvedValue({ error: null });

    await checkAndDeductMinutes('tutor-1', 3);

    expect(mockSupabaseClient.rpc).toHaveBeenCalledWith('increment_ai_minutes_used', {
      p_tutor_id: 'tutor-1',
      p_amount: 3,
    });
  });

  it('succeeds when available equals papersCount exactly', async () => {
    mockSupabaseClient.single.mockResolvedValue({
      data: { ai_minutes_used: 45, ai_minutes_limit: 50, subscription_status: 'active' },
      error: null,
    });
    mockSupabaseClient.rpc.mockResolvedValue({ error: null });

    await checkAndDeductMinutes('tutor-1', 5);

    expect(mockSupabaseClient.rpc).toHaveBeenCalledWith('increment_ai_minutes_used', {
      p_tutor_id: 'tutor-1',
      p_amount: 5,
    });
  });

  it('throws tutor_not_found when tutor does not exist', async () => {
    mockSupabaseClient.single.mockResolvedValue({
      data: null,
      error: { message: 'not found' },
    });

    await expect(checkAndDeductMinutes('bad-id', 1)).rejects.toThrow('tutor_not_found');
  });

  it('throws subscription_past_due when status is past_due', async () => {
    mockSupabaseClient.single.mockResolvedValue({
      data: { ai_minutes_used: 0, ai_minutes_limit: 50, subscription_status: 'past_due' },
      error: null,
    });

    await expect(checkAndDeductMinutes('tutor-1', 1)).rejects.toThrow('subscription_past_due');
    expect(mockSupabaseClient.rpc).not.toHaveBeenCalled();
  });

  it('throws insufficient_ai_minutes when not enough available', async () => {
    mockSupabaseClient.single.mockResolvedValue({
      data: { ai_minutes_used: 48, ai_minutes_limit: 50, subscription_status: 'active' },
      error: null,
    });

    await expect(checkAndDeductMinutes('tutor-1', 5)).rejects.toThrow('insufficient_ai_minutes');
    expect(mockSupabaseClient.rpc).not.toHaveBeenCalled();
  });

  it('throws insufficient_ai_minutes when all minutes used', async () => {
    mockSupabaseClient.single.mockResolvedValue({
      data: { ai_minutes_used: 50, ai_minutes_limit: 50, subscription_status: 'active' },
      error: null,
    });

    await expect(checkAndDeductMinutes('tutor-1', 1)).rejects.toThrow('insufficient_ai_minutes');
  });
});
