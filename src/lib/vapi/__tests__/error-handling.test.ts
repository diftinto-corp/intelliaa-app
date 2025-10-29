/**
 * Tests for VAPI Error Handling Utilities
 *
 * Validates:
 * - Error type detection and classification
 * - Retry logic with exponential backoff
 * - User-friendly error messages
 *
 * @see INT-34 Week 4: Backend Tests
 */

import {
  VapiError,
  VapiErrorType,
  parseVapiError,
  callVapiWithRetry,
  isVapiError,
} from '../error-handling';

describe('VapiError', () => {
  it('should create error with correct properties', () => {
    const error = new VapiError(
      VapiErrorType.VALIDATION,
      400,
      { field: 'temperature' },
      'Temperatura inválida'
    );

    expect(error.type).toBe(VapiErrorType.VALIDATION);
    expect(error.statusCode).toBe(400);
    expect(error.details).toEqual({ field: 'temperature' });
    expect(error.userMessage).toBe('Temperatura inválida');
    expect(error.name).toBe('VapiError');
  });

  it('should convert to JSON correctly', () => {
    const error = new VapiError(
      VapiErrorType.RATE_LIMIT,
      429,
      null,
      'Demasiadas solicitudes'
    );

    const json = error.toJSON();

    expect(json).toEqual({
      name: 'VapiError',
      type: VapiErrorType.RATE_LIMIT,
      statusCode: 429,
      message: 'Demasiadas solicitudes',
      details: null,
    });
  });
});

describe('parseVapiError', () => {
  it('should parse 401 authentication error', () => {
    const response = new Response(null, { status: 401 });
    const error = parseVapiError(response);

    expect(error.type).toBe(VapiErrorType.AUTHENTICATION);
    expect(error.statusCode).toBe(401);
    expect(error.userMessage).toContain('autenticación');
  });

  it('should parse 429 rate limit error', () => {
    const response = new Response(null, { status: 429 });
    const error = parseVapiError(response);

    expect(error.type).toBe(VapiErrorType.RATE_LIMIT);
    expect(error.statusCode).toBe(429);
    expect(error.userMessage).toContain('Demasiadas solicitudes');
  });

  it('should parse 404 not found error', () => {
    const response = new Response(null, { status: 404 });
    const error = parseVapiError(response);

    expect(error.type).toBe(VapiErrorType.NOT_FOUND);
    expect(error.statusCode).toBe(404);
    expect(error.userMessage).toContain('no encontrado');
  });

  it('should parse 400 validation error with details', () => {
    const response = new Response(null, { status: 400 });
    const errorData = { message: 'Invalid temperature value' };
    const error = parseVapiError(response, errorData);

    expect(error.type).toBe(VapiErrorType.VALIDATION);
    expect(error.statusCode).toBe(400);
    expect(error.userMessage).toContain('Invalid temperature value');
  });

  it('should parse 500 server error', () => {
    const response = new Response(null, { status: 500 });
    const error = parseVapiError(response);

    expect(error.type).toBe(VapiErrorType.SERVER_ERROR);
    expect(error.statusCode).toBe(500);
    expect(error.userMessage).toContain('no está disponible');
  });

  it('should extract Retry-After header for rate limits', () => {
    const response = new Response(null, {
      status: 429,
      headers: { 'Retry-After': '60' },
    });
    const error = parseVapiError(response);

    expect(error.userMessage).toContain('60 segundos');
  });
});

describe('callVapiWithRetry', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'warn').mockImplementation();
    jest.spyOn(console, 'error').mockImplementation();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should succeed on first attempt', async () => {
    const operation = jest.fn().mockResolvedValue({ id: 'success' });

    const result = await callVapiWithRetry(operation);

    expect(result).toEqual({ id: 'success' });
    expect(operation).toHaveBeenCalledTimes(1);
  });

  it('should retry on rate limit error', async () => {
    const operation = jest.fn()
      .mockRejectedValueOnce(
        new VapiError(VapiErrorType.RATE_LIMIT, 429, null, '')
      )
      .mockResolvedValueOnce({ id: 'success' });

    const result = await callVapiWithRetry(operation, {
      maxRetries: 3,
      baseDelay: 10, // Short delay for testing
    });

    expect(result).toEqual({ id: 'success' });
    expect(operation).toHaveBeenCalledTimes(2);
  });

  it('should NOT retry on validation error', async () => {
    const operation = jest.fn()
      .mockRejectedValue(
        new VapiError(VapiErrorType.VALIDATION, 400, null, 'Invalid data')
      );

    await expect(
      callVapiWithRetry(operation, { maxRetries: 3, baseDelay: 10 })
    ).rejects.toThrow('Invalid data');

    expect(operation).toHaveBeenCalledTimes(1); // No retry
  });

  it('should NOT retry on authentication error', async () => {
    const operation = jest.fn()
      .mockRejectedValue(
        new VapiError(VapiErrorType.AUTHENTICATION, 401, null, 'Auth failed')
      );

    await expect(
      callVapiWithRetry(operation, { maxRetries: 3, baseDelay: 10 })
    ).rejects.toThrow('Auth failed');

    expect(operation).toHaveBeenCalledTimes(1); // No retry
  });

  it('should throw after max retries exceeded', async () => {
    const operation = jest.fn()
      .mockRejectedValue(
        new VapiError(VapiErrorType.SERVER_ERROR, 500, null, 'Server error')
      );

    await expect(
      callVapiWithRetry(operation, { maxRetries: 3, baseDelay: 10 })
    ).rejects.toThrow('Server error');

    expect(operation).toHaveBeenCalledTimes(3);
  });

  it('should call onRetry callback', async () => {
    const onRetry = jest.fn();
    const operation = jest.fn()
      .mockRejectedValueOnce(
        new VapiError(VapiErrorType.RATE_LIMIT, 429, null, '')
      )
      .mockResolvedValueOnce({ id: 'success' });

    await callVapiWithRetry(operation, {
      maxRetries: 3,
      baseDelay: 10,
      onRetry,
    });

    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(onRetry).toHaveBeenCalledWith(
      1, // attempt
      expect.any(VapiError),
      expect.any(Number) // delay
    );
  });

  it('should use exponential backoff', async () => {
    const delays: number[] = [];
    const operation = jest.fn()
      .mockRejectedValueOnce(new VapiError(VapiErrorType.SERVER_ERROR, 500, null, ''))
      .mockRejectedValueOnce(new VapiError(VapiErrorType.SERVER_ERROR, 500, null, ''))
      .mockResolvedValueOnce({ id: 'success' });

    await callVapiWithRetry(operation, {
      maxRetries: 3,
      baseDelay: 100,
      onRetry: (_attempt, _error, delay) => delays.push(delay),
    });

    // First retry should be ~100ms, second ~200ms (exponential)
    expect(delays[0]).toBeGreaterThanOrEqual(100);
    expect(delays[0]).toBeLessThanOrEqual(130); // With 30% jitter
    expect(delays[1]).toBeGreaterThanOrEqual(200);
    expect(delays[1]).toBeLessThanOrEqual(260); // With 30% jitter
  });
});

describe('isVapiError', () => {
  it('should return true for VapiError instances', () => {
    const error = new VapiError(
      VapiErrorType.VALIDATION,
      400,
      null,
      'Test error'
    );

    expect(isVapiError(error)).toBe(true);
  });

  it('should return false for regular Error', () => {
    const error = new Error('Regular error');

    expect(isVapiError(error)).toBe(false);
  });

  it('should return false for non-error values', () => {
    expect(isVapiError(null)).toBe(false);
    expect(isVapiError(undefined)).toBe(false);
    expect(isVapiError('string')).toBe(false);
    expect(isVapiError({})).toBe(false);
  });
});
