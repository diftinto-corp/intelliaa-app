/**
 * Test Namespace Fixtures
 * Valid and invalid namespace patterns for testing
 */

/**
 * Valid namespaces (should pass validation)
 */
export const validNamespaces = {
  // Legacy format (13-char alphanumeric)
  legacyShort: 'abc123def456',
  legacy13Char: '1a2b3c4d5e6f7',

  // New format with hyphens
  withHyphen: 'assistant-123',
  multipleHyphens: 'my-test-namespace',
  longWithHyphens: 'very-long-namespace-with-many-hyphens-but-still-valid-abc',

  // Minimum length (3 chars)
  minLength: 'abc',

  // Maximum length (63 chars)
  maxLength: 'a'.repeat(63),

  // Numbers only
  numbersOnly: '123456789',

  // Letters only
  lettersOnly: 'abcdefghijk',

  // Starts with number
  startsWithNumber: '1test',

  // Ends with number
  endsWithNumber: 'test1',
};

/**
 * Invalid namespaces (should fail validation)
 */
export const invalidNamespaces = {
  // Too short
  tooShort: 'ab',
  oneChar: 'a',
  empty: '',

  // Too long
  tooLong: 'a'.repeat(64),
  wayTooLong: 'a'.repeat(100),

  // Special characters
  withUnderscore: 'test_namespace',
  withDot: 'test.namespace',
  withSpace: 'test namespace',
  withSlash: 'test/namespace',
  withAt: 'test@namespace',

  // Uppercase letters
  uppercase: 'TestNamespace',
  mixedCase: 'testNameSpace',
  allUppercase: 'TESTNAMESPACE',

  // Invalid start/end
  startsWithHyphen: '-testnamespace',
  endsWithHyphen: 'testnamespace-',
  hyphenOnly: '---',

  // Consecutive hyphens
  consecutiveHyphens: 'test--namespace',
  multipleConsecutive: 'test---namespace',

  // Null/undefined
  nullValue: null as any,
  undefinedValue: undefined as any,

  // Non-string types
  numberType: 123 as any,
  objectType: {} as any,
  arrayType: [] as any,
};

/**
 * Generate a random valid namespace for testing
 */
export function generateRandomNamespace(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  const length = Math.floor(Math.random() * 50) + 10; // 10-60 chars
  let namespace = '';

  for (let i = 0; i < length; i++) {
    // Don't add hyphen at start/end or consecutively
    if (i > 0 && i < length - 1 && Math.random() < 0.1 && namespace[i - 1] !== '-') {
      namespace += '-';
    } else {
      namespace += chars[Math.floor(Math.random() * chars.length)];
    }
  }

  return namespace;
}

/**
 * Generate test namespaces for multi-tenant isolation testing
 */
export function generateIsolatedNamespaces(count: number = 3): string[] {
  const namespaces: string[] = [];
  for (let i = 0; i < count; i++) {
    namespaces.push(`test-namespace-${i}-${Date.now()}`);
  }
  return namespaces;
}
