/**
 * Vitest Setup File
 *
 * This file is executed before all test files.
 * Use it to configure global test utilities, mocks, and environment setup.
 */

import { beforeAll, afterEach, afterAll, vi } from 'vitest';
import { cleanup } from '@testing-library/react';

// Setup dotenv for tests
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

// Extend Vitest matchers with Testing Library
import '@testing-library/jest-dom/vitest';

// Clean up after each test
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

// Global test setup
beforeAll(() => {
  // Set test environment variables
  process.env.NODE_ENV = 'test';

  // Mock console methods to reduce noise in tests
  // You can remove this if you want to see console output
  global.console = {
    ...console,
    log: vi.fn(),
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    // Keep error for debugging test failures
    error: console.error,
  };
});

// Global test teardown
afterAll(() => {
  vi.restoreAllMocks();
});

// Mock Next.js specific modules
vi.mock('next/navigation', () => ({
  useRouter: vi.fn(() => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
    back: vi.fn(),
    pathname: '/',
    query: {},
    asPath: '/',
  })),
  usePathname: vi.fn(() => '/'),
  useSearchParams: vi.fn(() => new URLSearchParams()),
  useParams: vi.fn(() => ({})),
}));

// Mock environment variables for tests
process.env.OPENAI_API_KEY = process.env.OPENAI_API_KEY || 'sk-test-key-for-testing';
process.env.NEXT_PUBLIC_SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://test.supabase.co';
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'test-anon-key';
