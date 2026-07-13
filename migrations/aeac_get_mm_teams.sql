-- Applied to project ehxldkjlyofhhzlxfnhf.
CREATE OR REPLACE FUNCTION public.get_mm_teams()
RETURNS TABLE(
  team_code text, team_name text,
  marketing_id uuid, marketing_name text, marketing_email text,
  tro_id uuid, tro_name text, tro_email text
)
LANGUAGE sql SECURITY DEFINER SET search_path = public, property
AS $$
  SELECT m.team_code, m.team_name,
         m.id, m.name, lower(m.email),
         t.id, t.name, lower(t.email)
  FROM property.staff_marketing m
  LEFT JOIN property.staff_tro t ON t.id = m.partner_tro_id AND t.active IS TRUE
  WHERE m.active IS TRUE AND m.team_code IS NOT NULL
    AND m.email IS NOT NULL AND m.email <> ''
  ORDER BY m.team_code;
$$;
GRANT EXECUTE ON FUNCTION public.get_mm_teams() TO anon, authenticated;
