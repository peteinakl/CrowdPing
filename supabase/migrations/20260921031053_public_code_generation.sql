-- 16-character Crockford base32 public codes (80 bits of randomness), unambiguous alphabet
-- (excludes I, L, O, U). Called only from inside publish_poll(), which is SECURITY DEFINER,
-- so this function inherits that execution context without needing its own elevated rights.

create function public.generate_unique_public_code()
returns text
language plpgsql
set search_path = ''
as $$
declare
  v_alphabet text := '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
  v_code text;
  v_attempt int := 0;
  v_max_attempts constant int := 20;
begin
  loop
    v_attempt := v_attempt + 1;
    if v_attempt > v_max_attempts then
      raise exception 'Could not generate a unique public code after % attempts', v_max_attempts;
    end if;

    select string_agg(
      substr(v_alphabet, (get_byte(extensions.gen_random_bytes(1), 0) % 32) + 1, 1),
      '' order by gs
    )
    into v_code
    from generate_series(1, 16) as gs;

    exit when not exists (select 1 from public.polls where public_code = v_code);
  end loop;

  return v_code;
end;
$$;

comment on function public.generate_unique_public_code is 'Regenerates on collision (astronomically unlikely at 80 bits); collision-checked against polls.public_code.';
