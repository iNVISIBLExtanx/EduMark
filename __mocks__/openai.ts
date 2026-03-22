import { vi } from 'vitest';

export const mockOpenAI = {
  embeddings: {
    create: vi.fn(),
  },
};

vi.mock('@/lib/ai/openai-client', () => ({
  openai: mockOpenAI,
}));
