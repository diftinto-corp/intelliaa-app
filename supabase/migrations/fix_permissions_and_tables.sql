DO $$ 
BEGIN
    -- Manejar permisos de la tabla con error de ortografía
    BEGIN
        REVOKE ALL PRIVILEGES ON TABLE "public"."docuement_storage_assistants" FROM "anon";
    EXCEPTION 
        WHEN undefined_table THEN
            NULL;
    END;

    -- Intentar eliminar la tabla con error de ortografía si existe
    DROP TABLE IF EXISTS "public"."docuement_storage_assistants";

    -- Manejar el caso anterior de embedded_pdfs
    BEGIN
        DROP TRIGGER IF EXISTS "set_embedded_pdfs_timestamp" ON "public"."embedded_pdfs";
    EXCEPTION 
        WHEN undefined_table THEN
            NULL;
    END;

    BEGIN
        DROP POLICY IF EXISTS "Account members can delete" ON "public"."embedded_pdfs";
        DROP POLICY IF EXISTS "Account members can insert" ON "public"."embedded_pdfs";
    EXCEPTION 
        WHEN undefined_table THEN
            NULL;
    END;

    DROP TABLE IF EXISTS "public"."embedded_pdfs";
END $$; 