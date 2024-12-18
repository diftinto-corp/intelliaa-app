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

-- Eliminar restricciones existentes
ALTER TABLE IF EXISTS "public"."pdf_docs" 
    DROP CONSTRAINT IF EXISTS "public_pdf_docs_document_storages_id_fkey";

-- Verificar y corregir datos inválidos
DO $$
BEGIN
    -- Actualizar registros NULL con nuevos UUIDs
    UPDATE public.pdf_docs 
    SET document_storages_id = gen_random_uuid()
    WHERE document_storages_id IS NULL;

    -- Insertar los IDs faltantes en document_storages
    INSERT INTO public.document_storages (id)
    SELECT DISTINCT document_storages_id
    FROM public.pdf_docs
    WHERE document_storages_id NOT IN (SELECT id FROM public.document_storages)
    AND document_storages_id IS NOT NULL;

    -- Verificar que no haya registros huérfanos
    IF EXISTS (
        SELECT 1 
        FROM public.pdf_docs p
        LEFT JOIN public.document_storages d ON d.id = p.document_storages_id
        WHERE d.id IS NULL
    ) THEN
        RAISE EXCEPTION 'Existen registros en pdf_docs sin correspondencia en document_storages';
    END IF;
END $$;

-- Agregar la restricción sin validar primero
ALTER TABLE "public"."pdf_docs" 
    ADD CONSTRAINT "public_pdf_docs_document_storages_id_fkey" 
    FOREIGN KEY (document_storages_id) 
    REFERENCES document_storages(id)
    NOT VALID;

-- Validar la restricción en un paso separado
ALTER TABLE "public"."pdf_docs" 
    VALIDATE CONSTRAINT "public_pdf_docs_document_storages_id_fkey";

-- Configurar columnas de timestamp
ALTER TABLE "public"."pdf_docs" 
    ALTER COLUMN "created_at" SET DEFAULT now(),
    ALTER COLUMN "created_at" SET NOT NULL,
    ALTER COLUMN "id" SET DEFAULT gen_random_uuid(),
    ALTER COLUMN "updated_at" SET DEFAULT now();


