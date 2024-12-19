-- Verificar y eliminar la columna si existe
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'pdf_docs' 
        AND column_name = 'document_storages_id'
    ) THEN
        ALTER TABLE "public"."pdf_docs" DROP COLUMN "document_storages_id";
    END IF;
END $$;

-- Eliminar la restricción existente si existe
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 
        FROM information_schema.table_constraints 
        WHERE constraint_name = 'public_pdf_docs_document_storages_id_fkey'
    ) THEN
        ALTER TABLE "public"."pdf_docs" 
        DROP CONSTRAINT "public_pdf_docs_document_storages_id_fkey";
    END IF;
END $$;

-- Verificar y agregar la columna si no existe
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'pdf_docs' 
        AND column_name = 'document_storage_id'
    ) THEN
        ALTER TABLE "public"."pdf_docs" ADD COLUMN "document_storage_id" uuid DEFAULT gen_random_uuid();
    END IF;
END $$;

-- Verificar y agregar la restricción si no existe
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.table_constraints 
        WHERE constraint_name = 'public_pdf_docs_document_storage_id_fkey'
        AND table_name = 'pdf_docs'
    ) THEN
        ALTER TABLE "public"."pdf_docs" 
        ADD CONSTRAINT "public_pdf_docs_document_storage_id_fkey" 
        FOREIGN KEY (document_storage_id) 
        REFERENCES document_storages(id) not valid;
    END IF;
END $$;

alter table "public"."pdf_docs" validate constraint "public_pdf_docs_document_storage_id_fkey";


