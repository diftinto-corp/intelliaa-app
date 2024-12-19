-- Primero, crear la tabla document_storages si no existe
CREATE TABLE IF NOT EXISTS public.document_storages (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at timestamp with time zone DEFAULT now()
);

-- Eliminar triggers y políticas existentes de manera segura
DO $$ 
BEGIN
    -- Eliminar triggers si existen
    IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_pdf_docs_timestamp') THEN
        DROP TRIGGER set_pdf_docs_timestamp ON public.pdf_docs;
    END IF;
    
    IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_pdf_docs_user_tracking') THEN
        DROP TRIGGER set_pdf_docs_user_tracking ON public.pdf_docs;
    END IF;
END $$;

-- Eliminar políticas de manera segura
DO $$
BEGIN
    EXECUTE 'DROP POLICY IF EXISTS "Account members can delete" ON public.pdf_docs';
    EXECUTE 'DROP POLICY IF EXISTS "Account members can insert" ON public.pdf_docs';
    EXECUTE 'DROP POLICY IF EXISTS "All logged in users can select" ON public.pdf_docs';
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- Agregar la columna document_storage_id si no existe
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'pdf_docs' 
        AND column_name = 'document_storage_id'
    ) THEN
        ALTER TABLE public.pdf_docs ADD COLUMN document_storage_id uuid;
    END IF;
END $$;

-- Verificar y corregir datos inválidos
DO $$
BEGIN
    -- Actualizar registros NULL con nuevos UUIDs
    UPDATE public.pdf_docs 
    SET document_storage_id = gen_random_uuid()
    WHERE document_storage_id IS NULL;

    -- Insertar los IDs faltantes en document_storages
    INSERT INTO public.document_storages (id)
    SELECT DISTINCT document_storage_id
    FROM public.pdf_docs
    WHERE document_storage_id NOT IN (SELECT id FROM public.document_storages)
    AND document_storage_id IS NOT NULL;
END $$;

-- Eliminar la restricción existente si existe
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 
        FROM information_schema.table_constraints 
        WHERE constraint_name = 'public_pdf_docs_document_storage_id_fkey'
    ) THEN
        ALTER TABLE "public"."pdf_docs" 
        DROP CONSTRAINT "public_pdf_docs_document_storage_id_fkey";
    END IF;
END $$;

-- Agregar la restricción
ALTER TABLE "public"."pdf_docs" 
    ADD CONSTRAINT "public_pdf_docs_document_storage_id_fkey" 
    FOREIGN KEY (document_storage_id) 
    REFERENCES document_storages(id);

-- Configurar columnas de timestamp
ALTER TABLE "public"."pdf_docs" 
    ALTER COLUMN "created_at" SET DEFAULT now(),
    ALTER COLUMN "created_at" SET NOT NULL,
    ALTER COLUMN "id" SET DEFAULT gen_random_uuid(),
    ALTER COLUMN "updated_at" SET DEFAULT now();


