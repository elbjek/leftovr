-- Readable invite codes: CHOMP- + 8 chars from a 31-symbol unambiguous alphabet
-- (no 0/O/1/I/L). ~40 bits of entropy — not brute-forceable even on the
-- unthrottled accept path, but far friendlier to read/type than the 16-hex
-- code from the S3 hardening migration.

set check_function_bodies = off;

create or replace function public.generate_invite_code()
returns text
language plpgsql
volatile
set search_path = ''
as $$
declare
  alphabet text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; -- 31 chars, omits 0 O 1 I L
  bytes bytea;
  generated_code text;
  i integer;
begin
  loop
    bytes := extensions.gen_random_bytes(8);
    generated_code := 'CHOMP-';
    for i in 0..7 loop
      generated_code := generated_code || substr(alphabet, (get_byte(bytes, i) % 31) + 1, 1);
    end loop;

    exit when not exists (
      select 1 from public.household_invites hi where hi.code = generated_code
    );
  end loop;

  return generated_code;
end;
$$;
