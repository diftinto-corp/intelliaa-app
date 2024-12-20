DO $$ 
DECLARE
    _table_name text := 'docuement_storage_assistants';
BEGIN
    -- Intentar revocar todos los posibles permisos
    EXECUTE format('
        DO $inner$ 
        BEGIN 
            EXECUTE format(''REVOKE ALL PRIVILEGES ON TABLE public.%I FROM anon'');
            EXECUTE format(''REVOKE ALL PRIVILEGES ON TABLE public.%I FROM authenticated'');
            EXECUTE format(''REVOKE ALL PRIVILEGES ON TABLE public.%I FROM service_role'');
        EXCEPTION 
            WHEN undefined_table THEN null;
        END $inner$;
    ', _table_name, _table_name, _table_name);

    -- También intentar eliminar la tabla si existe
    EXECUTE format('DROP TABLE IF EXISTS public.%I', _table_name);
END $$; 