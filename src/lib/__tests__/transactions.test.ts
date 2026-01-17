/**
 * Unit Tests for Transaction Utilities
 * 
 * Tests atomic transaction operations
 */

import { executeTransaction } from '@/lib/transactions';

describe('Transaction Utilities', () => {
  describe('executeTransaction', () => {
    it('should execute transaction successfully', async () => {
      const operation = jest.fn().mockResolvedValue('success');
      const result = await executeTransaction(operation);
      
      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(1);
    });

    it('should retry on contention error', async () => {
      const operation = jest.fn()
        .mockRejectedValueOnce(new Error('Transaction failed due to contention'))
        .mockResolvedValue('success');
      
      const result = await executeTransaction(operation, 3);
      
      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(2);
    });

    it('should fail after max retries', async () => {
      const operation = jest.fn()
        .mockRejectedValue(new Error('Transaction failed due to contention'));
      
      await expect(executeTransaction(operation, 3)).rejects.toThrow();
      expect(operation).toHaveBeenCalledTimes(3);
    });

    it('should not retry non-retryable errors', async () => {
      const operation = jest.fn()
        .mockRejectedValue(new Error('Permission denied'));
      
      await expect(executeTransaction(operation, 3)).rejects.toThrow('Permission denied');
      expect(operation).toHaveBeenCalledTimes(1);
    });
  });
});
