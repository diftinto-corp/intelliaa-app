-- Primero verificamos si la tabla existe, si no, la creamos
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'pdf_docs') THEN
        CREATE TABLE public.pdf_docs (
            id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
            created_at timestamp with time zone DEFAULT now(),
            updated_at timestamp with time zone DEFAULT now(),
            account_id uuid,
            document_storage_id uuid
        );
    END IF;
END $$;

-- Verificamos y agregamos la columna account_id si no existe
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'pdf_docs' AND column_name = 'account_id'
    ) THEN
        ALTER TABLE public.pdf_docs ADD COLUMN account_id uuid;
    END IF;
END $$;

-- Verificamos y agregamos la columna document_storage_id si no existe
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'pdf_docs' AND column_name = 'document_storage_id'
    ) THEN
        ALTER TABLE public.pdf_docs ADD COLUMN document_storage_id uuid;
    END IF;
END $$;

-- Eliminamos las restricciones existentes si las hay
DO $$
BEGIN
    EXECUTE (
        SELECT string_agg('ALTER TABLE public.pdf_docs DROP CONSTRAINT IF EXISTS ' || quote_ident(constraint_name), '; ')
        FROM information_schema.table_constraints
        WHERE table_name = 'pdf_docs'
        AND constraint_type = 'FOREIGN KEY'
    );
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- Agregamos las nuevas restricciones
DO $$
BEGIN
    -- Agregamos la restricción de account_id
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'public_pdf_docs_account_id_fkey'
    ) THEN
        ALTER TABLE public.pdf_docs 
        ADD CONSTRAINT public_pdf_docs_account_id_fkey 
        FOREIGN KEY (account_id) 
        REFERENCES basejump.accounts(id) NOT VALID;
    END IF;

    -- Agregamos la restricción de document_storage_id
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'public_pdf_docs_document_storage_id_fkey'
    ) THEN
        ALTER TABLE public.pdf_docs 
        ADD CONSTRAINT public_pdf_docs_document_storage_id_fkey 
        FOREIGN KEY (document_storage_id) 
        REFERENCES document_storages(id) NOT VALID;
    END IF;
END $$;

-- Validamos las restricciones
ALTER TABLE public.pdf_docs VALIDATE CONSTRAINT public_pdf_docs_account_id_fkey;
ALTER TABLE public.pdf_docs VALIDATE CONSTRAINT public_pdf_docs_document_storage_id_fkey; 