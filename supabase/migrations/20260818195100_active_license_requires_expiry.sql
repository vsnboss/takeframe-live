alter table public.licenses
  add constraint active_license_requires_valid_until
  check (status <> 'active' or valid_until is not null);
