-- Intentar eliminar las políticas si existen, ignorando errores si no existen
DO $$ 
BEGIN
    -- Intentar eliminar la política de delete
    BEGIN
        DROP POLICY IF EXISTS "Account members can delete" ON "public"."embedded_pdfs";
    EXCEPTION 
        WHEN undefined_table THEN
            -- Ignorar el error si la tabla no existe
            NULL;
    END;

    -- Intentar eliminar la política de insert
    BEGIN
        DROP POLICY IF EXISTS "Account members can insert" ON "public"."embedded_pdfs";
    EXCEPTION 
        WHEN undefined_table THEN
            -- Ignorar el error si la tabla no existe
            NULL;
    END;
END $$; 