import { withTimeout, withTimeoutAndRetry } from '@/lib/timeout-utils';

describe('withTimeout', () => {
  it('resolves when promise finishes before timeout', async () => {
    const result = await withTimeout(Promise.resolve('ok'), 1000);
    expect(result).toBe('ok');
  });

  it('rejects when promise takes longer than timeout', async () => {
    const slow = new Promise(resolve => setTimeout(resolve, 5000));
    await expect(withTimeout(slow, 50)).rejects.toThrow('Operation timed out');
  });

  it('uses custom error message', async () => {
    const slow = new Promise(resolve => setTimeout(resolve, 5000));
    await expect(withTimeout(slow, 50, 'Custom timeout')).rejects.toThrow('Custom timeout');
  });

  it('propagates the original error if promise rejects before timeout', async () => {
    const failing = Promise.reject(new Error('original'));
    await expect(withTimeout(failing, 1000)).rejects.toThrow('original');
  });
});

describe('withTimeoutAndRetry', () => {
  it('resolves on first attempt if function succeeds', async () => {
    const fn = jest.fn().mockResolvedValue('done');
    const result = await withTimeoutAndRetry(fn, 1000, 2);
    expect(result).toBe('done');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('retries on failure and resolves on second attempt', async () => {
    const fn = jest.fn()
      .mockRejectedValueOnce(new Error('fail'))
      .mockResolvedValueOnce('ok');
    const result = await withTimeoutAndRetry(fn, 1000, 1);
    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('throws after exhausting all retries', async () => {
    const fn = jest.fn().mockRejectedValue(new Error('persistent fail'));
    await expect(withTimeoutAndRetry(fn, 1000, 1)).rejects.toThrow('persistent fail');
    expect(fn).toHaveBeenCalledTimes(2); // initial + 1 retry
  });

  it('respects timeout per attempt', async () => {
    const fn = jest.fn().mockImplementation(
      () => new Promise(resolve => setTimeout(resolve, 5000))
    );
    await expect(withTimeoutAndRetry(fn, 50, 0, 'timed out')).rejects.toThrow('timed out');
  });
});
