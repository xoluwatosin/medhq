GRANT USAGE ON SCHEMA private TO sandbox_exec;
GRANT EXECUTE ON FUNCTION private.upsert_form_definition(text, int, text, jsonb) TO sandbox_exec;