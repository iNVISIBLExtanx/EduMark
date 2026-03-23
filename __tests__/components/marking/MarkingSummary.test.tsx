import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MarkingSummary } from '@/components/marking/MarkingSummary';

describe('MarkingSummary', () => {
  it('renders total marks and percentage', () => {
    render(<MarkingSummary totalAwarded={35} totalMax={50} />);
    expect(screen.getByText('35/50')).toBeInTheDocument();
    expect(screen.getByText('70%')).toBeInTheDocument();
  });

  it('handles zero total max', () => {
    render(<MarkingSummary totalAwarded={0} totalMax={0} />);
    expect(screen.getByText('0/0')).toBeInTheDocument();
    expect(screen.getByText('0%')).toBeInTheDocument();
  });

  it('shows override total when different from awarded', () => {
    render(<MarkingSummary totalAwarded={35} totalMax={50} overrideTotal={40} />);
    expect(screen.getByText('40/50')).toBeInTheDocument();
    expect(screen.getByText('80%')).toBeInTheDocument();
    expect(screen.getByText('Includes tutor adjustments')).toBeInTheDocument();
  });

  it('does not show adjustment note when override equals awarded', () => {
    render(<MarkingSummary totalAwarded={35} totalMax={50} overrideTotal={35} />);
    expect(screen.getByText('35/50')).toBeInTheDocument();
    expect(screen.queryByText('Includes tutor adjustments')).not.toBeInTheDocument();
  });
});
