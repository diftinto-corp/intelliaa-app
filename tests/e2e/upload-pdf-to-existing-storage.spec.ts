/**
 * INTEL-005: E2E Tests for Upload PDF to Existing Storage
 *
 * Tests the complete user flow from UI to database
 */

import { test, expect } from '@playwright/test';
import path from 'path';

test.describe('INTEL-005: Upload PDF to Existing Storage E2E', () => {
  test.beforeEach(async ({ page }) => {
    // Login (adjust based on your auth flow)
    await page.goto('/auth/login');
    await page.fill('[name="email"]', process.env.TEST_USER_EMAIL!);
    await page.fill('[name="password"]', process.env.TEST_USER_PASSWORD!);
    await page.click('button[type="submit"]');
    await page.waitForURL('/**/documents');
  });

  test('should upload PDF to existing storage with progress indicators', async ({ page }) => {
    // Navigate to document storage detail page
    await page.goto('/test-account/documents');
    await page.click('[data-testid="document-storage-item"]:first-child');

    // Wait for document list to load
    await expect(page.locator('[data-testid="document-list"]')).toBeVisible();

    // Click "Add New Document" button
    await page.click('button:has-text("Agregar nuevo documento")');

    // Verify modal opened
    await expect(page.locator('[role="dialog"]')).toBeVisible();
    await expect(page.locator('text=Agregar nuevo archivo')).toBeVisible();

    // Upload PDF file
    const testPdfPath = path.join(__dirname, '../fixtures/test-document.pdf');
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(testPdfPath);

    // Verify file preview shown
    await expect(page.locator('text=test-document.pdf')).toBeVisible();
    await expect(page.locator('text=MB')).toBeVisible(); // File size displayed

    // Click upload button
    await page.click('button:has-text("Subir Documento")');

    // Verify processing steps appear in order
    await expect(page.locator('text=Validando archivo')).toBeVisible();
    await expect(page.locator('[role="progressbar"]')).toBeVisible();

    await expect(page.locator('text=Generando embeddings')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=Actualizando base de conocimientos')).toBeVisible({ timeout: 30000 });
    await expect(page.locator('text=Guardando documento')).toBeVisible({ timeout: 10000 });

    // Verify success state
    await expect(page.locator('text=Completado')).toBeVisible({ timeout: 60000 });

    // Verify success toast
    await expect(page.locator('text=Documento subido exitosamente')).toBeVisible();

    // Verify modal auto-closes
    await expect(page.locator('[role="dialog"]')).not.toBeVisible({ timeout: 5000 });

    // Verify document appears in list (real-time update)
    await expect(page.locator('text=test-document.pdf')).toBeVisible({ timeout: 5000 });
  });

  test('should show duplicate file rename notification', async ({ page }) => {
    // Upload same file twice
    await page.goto('/test-account/documents');
    await page.click('[data-testid="document-storage-item"]:first-child');

    // First upload
    await uploadPdfFile(page, 'duplicate-test.pdf');
    await expect(page.locator('text=Documento subido exitosamente')).toBeVisible();
    await page.waitForTimeout(2000); // Wait for modal to close

    // Second upload (same file name)
    await page.click('button:has-text("Agregar nuevo documento")');
    const fileInput = page.locator('input[type="file"]');
    const testPdfPath = path.join(__dirname, '../fixtures/duplicate-test.pdf');
    await fileInput.setInputFiles(testPdfPath);
    await page.click('button:has-text("Subir Documento")');

    // Wait for completion
    await expect(page.locator('text=Completado')).toBeVisible({ timeout: 60000 });

    // Verify rename notification in toast
    await expect(page.locator('text=fue renombrado a')).toBeVisible();
    await expect(page.locator('text=porque ya existía un archivo con el mismo nombre')).toBeVisible();

    // Verify renamed file in list
    await expect(page.locator('[data-testid="document-list"]')).toContainText(/duplicate-test-\d+\.pdf/);
  });

  test('should prevent concurrent uploads to same storage', async ({ page, context }) => {
    // Open second tab
    const page2 = await context.newPage();

    // Both pages navigate to same document storage
    await page.goto('/test-account/documents/test-storage-id');
    await page2.goto('/test-account/documents/test-storage-id');

    // Start upload on page 1
    await page.click('button:has-text("Agregar nuevo documento")');
    const fileInput1 = page.locator('input[type="file"]');
    await fileInput1.setInputFiles(path.join(__dirname, '../fixtures/test-1.pdf'));
    await page.click('button:has-text("Subir Documento")');

    // Immediately try to upload on page 2 (should be blocked)
    await page2.click('button:has-text("Agregar nuevo documento")');
    const fileInput2 = page2.locator('input[type="file"]');
    await fileInput2.setInputFiles(path.join(__dirname, '../fixtures/test-2.pdf'));
    await page2.click('button:has-text("Subir Documento")');

    // Verify lock error message on page 2
    await expect(page2.locator('text=Otro proceso está subiendo un archivo')).toBeVisible({ timeout: 5000 });
    await expect(page2.locator('text=espera a que termine')).toBeVisible();

    // Wait for page 1 to complete
    await expect(page.locator('text=Completado')).toBeVisible({ timeout: 60000 });

    // Now page 2 should be able to upload
    await page2.reload();
    await page2.click('button:has-text("Agregar nuevo documento")');
    await fileInput2.setInputFiles(path.join(__dirname, '../fixtures/test-2.pdf'));
    await page2.click('button:has-text("Subir Documento")');

    await expect(page2.locator('text=Completado')).toBeVisible({ timeout: 60000 });
  });

  test('should validate file size (max 50MB)', async ({ page }) => {
    await page.goto('/test-account/documents');
    await page.click('[data-testid="document-storage-item"]:first-child');
    await page.click('button:has-text("Agregar nuevo documento")');

    // Try to upload file > 50MB (create large mock file)
    const largeFile = path.join(__dirname, '../fixtures/large-file.pdf'); // 51MB file

    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(largeFile);

    // Verify error message
    await expect(page.locator('text=excede el límite de 50MB')).toBeVisible();

    // Verify upload button is disabled
    await expect(page.locator('button:has-text("Subir Documento")')).toBeDisabled();
  });

  test('should validate PDF file type', async ({ page }) => {
    await page.goto('/test-account/documents');
    await page.click('[data-testid="document-storage-item"]:first-child');
    await page.click('button:has-text("Agregar nuevo documento")');

    // Try to upload non-PDF file
    const txtFile = path.join(__dirname, '../fixtures/test.txt');

    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(txtFile);

    // Verify error message
    await expect(page.locator('text=Solo se permiten archivos PDF')).toBeVisible();

    // Verify upload button is disabled
    await expect(page.locator('button:has-text("Subir Documento")')).toBeDisabled();
  });

  test('should show error and allow retry on upload failure', async ({ page }) => {
    // Mock network failure
    await page.route('**/api/**', route => {
      if (route.request().url().includes('uploadPdfToExistingStorage')) {
        route.abort('failed');
      } else {
        route.continue();
      }
    });

    await page.goto('/test-account/documents');
    await page.click('[data-testid="document-storage-item"]:first-child');

    await uploadPdfFile(page, 'test-document.pdf');

    // Verify error state
    await expect(page.locator('text=Error')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('[role="alert"]')).toBeVisible();

    // Verify error toast
    await expect(page.locator('text=Error al subir documento')).toBeVisible();

    // Verify retry button available
    // (Implementation depends on your error handling UI)

    // Clean up route mock
    await page.unroute('**/api/**');
  });

  test('should auto-refresh document list after successful upload', async ({ page, context }) => {
    // Open second tab to verify real-time update
    const page2 = await context.newPage();

    await page.goto('/test-account/documents/test-storage-id');
    await page2.goto('/test-account/documents/test-storage-id');

    // Get initial document count
    const initialCount = await page2.locator('[data-testid="document-item"]').count();

    // Upload on page 1
    await uploadPdfFile(page, 'new-document.pdf');

    // Wait for completion
    await expect(page.locator('text=Completado')).toBeVisible({ timeout: 60000 });

    // Verify page 2 auto-updates (Supabase real-time)
    await expect(page2.locator('[data-testid="document-list"]')).toContainText('new-document.pdf', {
      timeout: 5000,
    });

    const newCount = await page2.locator('[data-testid="document-item"]').count();
    expect(newCount).toBe(initialCount + 1);
  });
});

// ============================================================================
// Helper Functions
// ============================================================================

async function uploadPdfFile(page: any, fileName: string) {
  await page.click('button:has-text("Agregar nuevo documento")');

  const testPdfPath = path.join(__dirname, `../fixtures/${fileName}`);
  const fileInput = page.locator('input[type="file"]');
  await fileInput.setInputFiles(testPdfPath);

  await page.click('button:has-text("Subir Documento")');
}
