import { render, screen } from '@testing-library/react';
import { MatchScoreBadge } from '@/components/match-score-badge';

// Mock ESM-only dependencies
jest.mock('lucide-react', () => ({
  Target: (props: any) => <svg data-testid="icon-target" {...props} />,
  Sparkles: (props: any) => <svg data-testid="icon-sparkles" {...props} />,
  Search: (props: any) => <svg data-testid="icon-search" {...props} />,
}));

describe('MatchScoreBadge', () => {
  it('renders nothing when matchScore is undefined', () => {
    const { container } = render(<MatchScoreBadge />);
    expect(container.firstChild).toBeNull();
  });

  it('renders nothing when matchCategory is undefined', () => {
    const { container } = render(<MatchScoreBadge matchScore={85} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders a perfect match badge', () => {
    render(<MatchScoreBadge matchScore={95} matchCategory="perfect" />);
    expect(screen.getByText(/Core Match/)).toBeInTheDocument();
    expect(screen.getByText(/95%/)).toBeInTheDocument();
  });

  it('renders a great match badge', () => {
    render(<MatchScoreBadge matchScore={78} matchCategory="great" />);
    expect(screen.getByText(/Style Stretch/)).toBeInTheDocument();
  });

  it('renders an exploring badge', () => {
    render(<MatchScoreBadge matchScore={55} matchCategory="exploring" />);
    expect(screen.getByText(/Creative Edge/)).toBeInTheDocument();
  });

  it('falls back to exploring for unknown category', () => {
    render(<MatchScoreBadge matchScore={60} matchCategory="unknown" />);
    expect(screen.getByText(/Creative Edge/)).toBeInTheDocument();
  });

  it('hides score when showScore is false', () => {
    render(<MatchScoreBadge matchScore={90} matchCategory="perfect" showScore={false} />);
    expect(screen.getByText(/Core Match/)).toBeInTheDocument();
    expect(screen.queryByText(/90%/)).not.toBeInTheDocument();
  });

  it('applies custom className', () => {
    const { container } = render(
      <MatchScoreBadge matchScore={80} matchCategory="great" className="mt-4" />
    );
    expect(container.firstChild).toHaveClass('mt-4');
  });

  it('rounds score to nearest integer', () => {
    render(<MatchScoreBadge matchScore={87.6} matchCategory="perfect" />);
    expect(screen.getByText(/88%/)).toBeInTheDocument();
  });
});
