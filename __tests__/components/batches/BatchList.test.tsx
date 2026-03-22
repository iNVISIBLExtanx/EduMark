import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BatchList } from '@/components/batches/BatchList';

vi.mock('@/hooks/useBatches', () => ({
  useBatches: vi.fn(),
}));
vi.mock('@/components/batches/BatchStatusBadge', () => ({
  BatchStatusBadge: ({ status }: { status: string }) => <span data-testid="status-badge">{status}</span>,
}));
vi.mock('@/components/shared/LanguageBadge', () => ({
  LanguageBadge: ({ language }: { language: string }) => <span data-testid="language-badge">{language}</span>,
}));
vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...props}>{children}</a>
  ),
}));

import { useBatches } from '@/hooks/useBatches';

const mockUseBatches = useBatches as ReturnType<typeof vi.fn>;

const sampleBatches = [
  { id: 'b1', name: 'Physics 2024 - Class A', status: 'completed', medium: 'english', total_papers: 10, marked_papers: 10, created_at: '2026-03-20' },
  { id: 'b2', name: 'Chemistry 2024', status: 'processing', medium: 'sinhala', total_papers: 5, marked_papers: 2, created_at: '2026-03-21' },
];

const defaultReturn = {
  batches: sampleBatches,
  error: null,
  isLoading: false,
  mutate: vi.fn(),
};

beforeEach(() => {
  vi.clearAllMocks();
  mockUseBatches.mockReturnValue(defaultReturn);
});

describe('BatchList', () => {
  it('shows loading state when isLoading is true', () => {
    mockUseBatches.mockReturnValue({ ...defaultReturn, isLoading: true });
    render(<BatchList />);
    expect(screen.getByText('Loading batches...')).toBeInTheDocument();
  });

  it('shows error message when error is set', () => {
    mockUseBatches.mockReturnValue({ ...defaultReturn, error: new Error('Failed to load') });
    render(<BatchList />);
    expect(screen.getByText('Error: Failed to load')).toBeInTheDocument();
  });

  it('shows empty state when batches is empty', () => {
    mockUseBatches.mockReturnValue({ ...defaultReturn, batches: [] });
    render(<BatchList />);
    expect(screen.getByText('No batches yet. Create one to get started.')).toBeInTheDocument();
  });

  it('renders batch names as links to /batches/{id}', () => {
    render(<BatchList />);
    const link1 = screen.getByText('Physics 2024 - Class A').closest('a');
    const link2 = screen.getByText('Chemistry 2024').closest('a');
    expect(link1).toHaveAttribute('href', '/batches/b1');
    expect(link2).toHaveAttribute('href', '/batches/b2');
  });

  it('shows marked/total papers count per batch', () => {
    render(<BatchList />);
    expect(screen.getByText('10/10 papers marked')).toBeInTheDocument();
    expect(screen.getByText('2/5 papers marked')).toBeInTheDocument();
  });

  it('renders status and language badges for each batch', () => {
    render(<BatchList />);
    const statusBadges = screen.getAllByTestId('status-badge');
    const languageBadges = screen.getAllByTestId('language-badge');
    expect(statusBadges).toHaveLength(2);
    expect(languageBadges).toHaveLength(2);
    expect(statusBadges[0]).toHaveTextContent('completed');
    expect(statusBadges[1]).toHaveTextContent('processing');
    expect(languageBadges[0]).toHaveTextContent('english');
    expect(languageBadges[1]).toHaveTextContent('sinhala');
  });

  it('renders multiple batches as list items', () => {
    render(<BatchList />);
    expect(screen.getByText('Physics 2024 - Class A')).toBeInTheDocument();
    expect(screen.getByText('Chemistry 2024')).toBeInTheDocument();
  });
});
