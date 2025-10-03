# Test Fixtures for INTEL-005

## PDF Test Files

### test-document.pdf
- **Size**: ~100KB
- **Pages**: 2
- **Content**: Sample document for happy path testing
- **Usage**: Default test case

### duplicate-test.pdf
- **Size**: ~50KB
- **Pages**: 1
- **Content**: Used for duplicate name testing
- **Usage**: Upload twice to same storage

### large-file.pdf
- **Size**: 51MB
- **Pages**: 1000+
- **Content**: Large document for size validation
- **Usage**: Test file size limit (max 50MB)

### test-1.pdf, test-2.pdf
- **Size**: ~100KB each
- **Pages**: 1 each
- **Content**: Simple single-page documents
- **Usage**: Concurrent upload testing

### corrupted.pdf
- **Size**: ~10KB
- **Content**: Invalid PDF structure
- **Usage**: File validation testing

## Text Files (for validation)

### test.txt
- **Size**: 1KB
- **Content**: Plain text
- **Usage**: Test PDF type validation

## Creating Test PDFs

### ✅ Automated Generation (Recommended)
```bash
# Generate all test fixtures automatically
npm run generate:test-pdfs
```

This will create all required test files using [scripts/generate-test-pdfs.ts](../../scripts/generate-test-pdfs.ts):
- Standard PDFs with sample content
- Large PDF (51MB, 1200 pages) for size validation
- Corrupted PDF for error handling
- Text file for PDF type validation

**Output:**
```
✅ Created test-document.pdf (100 KB, 2 pages)
✅ Created duplicate-test.pdf (50 KB, 1 page)
✅ Created test-1.pdf (100 KB, 1 page)
✅ Created test-2.pdf (100 KB, 1 page)
✅ Created corrupted.pdf (invalid PDF structure)
📦 Creating large file (this may take a minute)...
✅ Created large-file.pdf (51.2 MB, 1200 pages)
✅ Created test.txt (1 KB)
```

### Manual Creation (Alternative)
If you need custom test files:

1. **Simple PDFs** - Use any tool (Google Docs, Word, etc.)
2. **Save to** - `tests/fixtures/` directory
3. **Name according to** - conventions in this README

## Fixture Checklist

- [ ] test-document.pdf (100KB, 2 pages)
- [ ] duplicate-test.pdf (50KB, 1 page)
- [ ] large-file.pdf (51MB, 1000+ pages)
- [ ] test-1.pdf (100KB, 1 page)
- [ ] test-2.pdf (100KB, 1 page)
- [ ] test.txt (1KB, plain text)
- [ ] corrupted.pdf (invalid PDF)

## Environment Setup for Tests

Create `.env.test`:
```env
# Test user credentials
TEST_USER_EMAIL=test@example.com
TEST_USER_PASSWORD=testpassword123

# Test Supabase project
TEST_SUPABASE_URL=https://test-project.supabase.co
TEST_SUPABASE_ANON_KEY=your-test-anon-key

# Mock service endpoints
MOCK_PINECONE_API=true
MOCK_VAPI_API=true
MOCK_OPENAI_API=true
```
