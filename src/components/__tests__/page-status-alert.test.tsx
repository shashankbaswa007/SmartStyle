import { fireEvent, render, screen } from '@testing-library/react';
import PageStatusAlert from '@/components/PageStatusAlert';

jest.mock('lucide-react', () => ({
  Loader2: (props: any) => <svg data-testid="icon-loader" {...props} />,
}));

describe('PageStatusAlert', () => {
  it('renders title and description', () => {
    render(
      <PageStatusAlert
        title="Unable to load data"
        description="Please try again in a moment."
      />
    );

    expect(screen.getByText('Unable to load data')).toBeInTheDocument();
    expect(screen.getByText('Please try again in a moment.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Retry' })).not.toBeInTheDocument();
  });

  it('invokes retry handler when retry button is clicked', () => {
    const onRetry = jest.fn();

    render(
      <PageStatusAlert
        title="Load failed"
        description="Try again"
        onRetry={onRetry}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('shows retrying state and disables retry button', () => {
    const onRetry = jest.fn();

    render(
      <PageStatusAlert
        title="Load failed"
        description="Try again"
        onRetry={onRetry}
        isRetrying
      />
    );

    const button = screen.getByRole('button', { name: /Retrying.../i });
    expect(button).toBeDisabled();
    expect(screen.getByTestId('icon-loader')).toBeInTheDocument();
  });

  it('respects custom retry label', () => {
    const onRetry = jest.fn();

    render(
      <PageStatusAlert
        title="Load failed"
        description="Try again"
        onRetry={onRetry}
        retryLabel="Try once more"
      />
    );

    expect(screen.getByRole('button', { name: 'Try once more' })).toBeInTheDocument();
  });
});
