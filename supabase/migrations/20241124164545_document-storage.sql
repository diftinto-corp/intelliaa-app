-- Primero, crear la tabla document_storages si no existe
CREATE TABLE IF NOT EXISTS public.document_storages (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at timestamp with time zone DEFAULT now()
);

-- Eliminar triggers y políticas existentes
drop trigger if exists "set_pdf_docs_timestamp" on "public"."pdf_docs";
drop trigger if exists "set_pdf_docs_user_tracking" on "public"."pdf_docs";
drop policy if exists "Account members can delete" on "public"."pdf_docs";
drop policy if exists "Account members can insert" on "public"."pdf_docs";
drop policy if exists "All logged in users can select" on "public"."pdf_docs";

-- Eliminar restricciones existentes de manera segura
DO $$ 
BEGIN
    ALTER TABLE IF EXISTS "public"."pdf_docs" 
        DROP CONSTRAINT IF EXISTS "pdf_docs_created_by_fkey",
        DROP CONSTRAINT IF EXISTS "pdf_docs_updated_by_fkey",
        DROP CONSTRAINT IF EXISTS "public_pdf_docs_account_id_fkey",
        DROP CONSTRAINT IF EXISTS "public_pdf_docs_document_storage_id_fkey",
        DROP CONSTRAINT IF EXISTS "pdf_docs_s3_key_key";
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- Eliminar columnas antiguas
ALTER TABLE "public"."pdf_docs" 
    DROP COLUMN IF EXISTS "account_id",
    DROP COLUMN IF EXISTS "created_by",
    DROP COLUMN IF EXISTS "document_storage_id",
    DROP COLUMN IF EXISTS "updated_by",
    DROP COLUMN IF EXISTS "s3_key";

-- Agregar nueva columna document_storages_id
ALTER TABLE "public"."pdf_docs" 
    ADD COLUMN IF NOT EXISTS "document_storages_id" uuid;

-- Configurar columnas de timestamp
ALTER TABLE "public"."pdf_docs" 
    ALTER COLUMN "created_at" SET DEFAULT now(),
    ALTER COLUMN "created_at" SET NOT NULL,
    ALTER COLUMN "id" SET DEFAULT gen_random_uuid(),
    ALTER COLUMN "updated_at" SET DEFAULT now();

-- Generar IDs para registros existentes y crear entradas en document_storages
WITH new_storage_ids AS (
    UPDATE "public"."pdf_docs" 
    SET "document_storages_id" = gen_random_uuid()
    WHERE "document_storages_id" IS NULL
    RETURNING document_storages_id
)
INSERT INTO public.document_storages (id)
SELECT DISTINCT document_storages_id 
FROM new_storage_ids
ON CONFLICT (id) DO NOTHING;

-- Asegurarse de que todos los document_storages_id tienen una entrada correspondiente
INSERT INTO public.document_storages (id)
SELECT DISTINCT pdf_docs.document_storages_id
FROM public.pdf_docs
LEFT JOIN public.document_storages ON document_storages.id = pdf_docs.document_storages_id
WHERE document_storages.id IS NULL
AND pdf_docs.document_storages_id IS NOT NULL;

-- Agregar la restricción de clave foránea
ALTER TABLE "public"."pdf_docs" 
    ADD CONSTRAINT "public_pdf_docs_document_storages_id_fkey" 
    FOREIGN KEY (document_storages_id) 
    REFERENCES document_storages(id);


