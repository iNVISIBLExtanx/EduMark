import { vi } from 'vitest';

export const mockAnthropic = {
  messages: { create: vi.fn() },
  beta: {
    messages: {
      batches: {
        create: vi.fn(),
        retrieve: vi.fn(),
        results: vi.fn(),
      },
    },
  },
};

vi.mock('@/lib/ai/claude-client', () => ({ anthropic: mockAnthropic }));
