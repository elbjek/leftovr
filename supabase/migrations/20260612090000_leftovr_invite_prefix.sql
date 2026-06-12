-- Rebrand: new invite codes use the LEFTOVR- prefix. Existing CHOMP- codes
-- stay valid because lookup/accept match the full stored code string.

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
    generated_code := 'LEFTOVR-';
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
