-- Verificar y eliminar restricciones existentes
DO $$
BEGIN
    -- Intentar eliminar cualquier restricción existente
    EXECUTE (
        SELECT string_agg('ALTER TABLE public.pdf_docs DROP CONSTRAINT IF EXISTS ' || quote_ident(constraint_name), '; ')
        FROM information_schema.table_constraints
        WHERE table_name = 'pdf_docs'
        AND constraint_name LIKE '%document_storage%'
    );
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- Modificar la columna document_storage_id
DO $$
BEGIN
    ALTER TABLE "public"."pdf_docs" ALTER COLUMN "document_storage_id" DROP DEFAULT;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- Deshabilitar RLS
ALTER TABLE "public"."pdf_docs" DISABLE ROW LEVEL SECURITY;

-- Agregar la restricción de clave foránea
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
        REFERENCES document_storages(id) NOT VALID;
    END IF;
END $$;

-- Validar la restricción
ALTER TABLE "public"."pdf_docs" VALIDATE CONSTRAINT "public_pdf_docs_document_storage_id_fkey";