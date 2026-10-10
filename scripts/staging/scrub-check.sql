-- After scrub.sql: list any text column in public, private or auth that still
-- holds an email address not on example.invalid. Prints nothing when clean.
do $$
declare
  r record;
  n bigint;
begin
  for r in
    select c.table_schema, c.table_name, c.column_name
      from information_schema.columns c
      join information_schema.tables t
        on t.table_schema = c.table_schema and t.table_name = c.table_name and t.table_type = 'BASE TABLE'
     where c.table_schema in ('public', 'private', 'auth')
       and c.data_type in ('text', 'character varying')
  loop
    execute format(
      'select count(*) from %I.%I where %I ~* %L and %I !~* %L',
      r.table_schema, r.table_name, r.column_name, '[a-z0-9._%%+-]+@[a-z0-9.-]+\.[a-z]{2,}',
      r.column_name, '@example\.invalid'
    ) into n;
    if n > 0 then
      raise warning 'possible real email: %.%.% (% rows)', r.table_schema, r.table_name, r.column_name, n;
    end if;
  end loop;
end $$;
