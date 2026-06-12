-- KVKK self-service silme için signups.status'a 'deleted' eklenir.
-- Silinen kullanıcı giriş yapamaz (getCurrentUser status='active' arar) ve
-- PII anonimleştirilir.
do $$
declare cname text;
begin
  select con.conname into cname
  from pg_constraint con
  where con.conrelid = 'public.signups'::regclass
    and con.contype = 'c'
    and pg_get_constraintdef(con.oid) like '%status = ANY%'
    and pg_get_constraintdef(con.oid) like '%active%'
    and pg_get_constraintdef(con.oid) not like '%approval_status%'
    and pg_get_constraintdef(con.oid) not like '%premeeting%';
  if cname is not null then
    execute format('alter table public.signups drop constraint %I', cname);
  end if;
  alter table public.signups
    add constraint signups_status_check
    check (status = any (array['pending'::text, 'active'::text, 'expired'::text, 'deleted'::text]));
end $$;
