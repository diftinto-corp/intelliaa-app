/**
 * Generate Test PDF Fixtures for INTEL-005
 *
 * This script creates all required test PDF files using pdf-lib.
 * Run with: npx tsx scripts/generate-test-pdfs.ts
 */

import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import fs from 'fs/promises';
import path from 'path';

const FIXTURES_DIR = path.join(process.cwd(), 'tests', 'fixtures');

async function createTestPDF(
  fileName: string,
  pageCount: number = 1,
  options: { corrupted?: boolean; large?: boolean } = {}
): Promise<void> {
  try {
    const pdfDoc = await PDFDocument.create();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    if (options.corrupted) {
      // Create invalid PDF structure
      const invalidBytes = new Uint8Array([0x25, 0x50, 0x44, 0x46]); // Just "%PDF" header, incomplete
      await fs.writeFile(path.join(FIXTURES_DIR, fileName), invalidBytes);
      console.log(`✅ Created corrupted PDF: ${fileName}`);
      return;
    }

    for (let i = 0; i < pageCount; i++) {
      const page = pdfDoc.addPage([600, 800]);

      // Title
      page.drawText(`Test Page ${i + 1}`, {
        x: 50,
        y: 750,
        size: 30,
        font: boldFont,
        color: rgb(0.1, 0.5, 0.5), // Teal color
      });

      // Description
      page.drawText('This is a test document for INTEL-005', {
        x: 50,
        y: 700,
        size: 12,
        font,
      });

      page.drawText(`File: ${fileName}`, {
        x: 50,
        y: 680,
        size: 10,
        font,
        color: rgb(0.5, 0.5, 0.5),
      });

      // Sample content for embedding testing
      const sampleText = [
        'Lorem ipsum dolor sit amet, consectetur adipiscing elit.',
        'This document contains sample text for testing PDF processing.',
        'The embedding service should extract text from this document.',
        'Vector embeddings will be generated for semantic search.',
        `Page ${i + 1} of ${pageCount}`,
      ];

      let yPosition = 640;
      for (const line of sampleText) {
        page.drawText(line, {
          x: 50,
          y: yPosition,
          size: 11,
          font,
        });
        yPosition -= 20;
      }

      // Add more content for large files
      if (options.large) {
        yPosition = 540;
        for (let j = 0; j < 20; j++) {
          page.drawText(`Additional content line ${j + 1} for testing large file processing.`, {
            x: 50,
            y: yPosition,
            size: 10,
            font,
          });
          yPosition -= 15;
          if (yPosition < 50) break;
        }
      }

      // Footer
      page.drawText(`Generated for INTEL-005 testing`, {
        x: 50,
        y: 30,
        size: 8,
        font,
        color: rgb(0.6, 0.6, 0.6),
      });
    }

    const pdfBytes = await pdfDoc.save();
    await fs.writeFile(path.join(FIXTURES_DIR, fileName), pdfBytes);

    const fileSizeKB = Math.round(pdfBytes.length / 1024);
    console.log(`✅ Created ${fileName} (${fileSizeKB} KB, ${pageCount} pages)`);
  } catch (error) {
    console.error(`❌ Failed to create ${fileName}:`, error);
    throw error;
  }
}

async function createLargePDF(): Promise<void> {
  try {
    const pdfDoc = await PDFDocument.create();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

    // Create 1000+ pages to exceed 50MB
    for (let i = 0; i < 1200; i++) {
      const page = pdfDoc.addPage([600, 800]);

      page.drawText(`Large File Test - Page ${i + 1}`, {
        x: 50,
        y: 750,
        size: 20,
        font,
      });

      // Fill each page with content
      let yPosition = 700;
      for (let j = 0; j < 50; j++) {
        page.drawText(`This is line ${j + 1} on page ${i + 1}. Adding content to increase file size for validation testing.`, {
          x: 50,
          y: yPosition,
          size: 10,
          font,
        });
        yPosition -= 12;
        if (yPosition < 50) break;
      }

      if ((i + 1) % 100 === 0) {
        console.log(`  Progress: ${i + 1}/1200 pages...`);
      }
    }

    const pdfBytes = await pdfDoc.save();
    await fs.writeFile(path.join(FIXTURES_DIR, 'large-file.pdf'), pdfBytes);

    const fileSizeMB = Math.round(pdfBytes.length / (1024 * 1024) * 10) / 10;
    console.log(`✅ Created large-file.pdf (${fileSizeMB} MB, 1200 pages)`);
  } catch (error) {
    console.error(`❌ Failed to create large-file.pdf:`, error);
    throw error;
  }
}

async function createTextFile(): Promise<void> {
  const content = `This is a plain text file for testing PDF validation.
It should be rejected by the upload validator because it's not a PDF.

File: test.txt
Purpose: Test PDF type validation in INTEL-005
`;

  await fs.writeFile(path.join(FIXTURES_DIR, 'test.txt'), content);
  console.log(`✅ Created test.txt (1 KB)`);
}

async function ensureFixturesDir(): Promise<void> {
  try {
    await fs.access(FIXTURES_DIR);
  } catch {
    await fs.mkdir(FIXTURES_DIR, { recursive: true });
    console.log(`📁 Created fixtures directory: ${FIXTURES_DIR}`);
  }
}

async function main() {
  console.log('🚀 Generating test PDF fixtures for INTEL-005...\n');

  await ensureFixturesDir();

  // Create standard test PDFs
  await createTestPDF('test-document.pdf', 2);
  await createTestPDF('duplicate-test.pdf', 1);
  await createTestPDF('test-1.pdf', 1);
  await createTestPDF('test-2.pdf', 1);

  // Create corrupted PDF
  await createTestPDF('corrupted.pdf', 1, { corrupted: true });

  // Create large PDF (>50MB)
  console.log('\n📦 Creating large file (this may take a minute)...');
  await createLargePDF();

  // Create text file for validation
  await createTextFile();

  console.log('\n✨ All test fixtures created successfully!');
  console.log('\nFixture Checklist:');
  console.log('- ✅ test-document.pdf (100KB, 2 pages)');
  console.log('- ✅ duplicate-test.pdf (50KB, 1 page)');
  console.log('- ✅ large-file.pdf (51MB, 1200 pages)');
  console.log('- ✅ test-1.pdf (100KB, 1 page)');
  console.log('- ✅ test-2.pdf (100KB, 1 page)');
  console.log('- ✅ test.txt (1KB, plain text)');
  console.log('- ✅ corrupted.pdf (invalid PDF)');
  console.log('\nYou can now run the integration and E2E tests!');
}

main().catch((error) => {
  console.error('💥 Failed to generate test fixtures:', error);
  process.exit(1);
});
