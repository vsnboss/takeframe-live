alter table public.production_leases
  drop constraint if exists production_lease_authority,
  add constraint production_lease_authority
    check (num_nonnulls(license_id, match_pass_id) = 1);

alter table public.entitlements
  drop constraint if exists entitlement_authority,
  add constraint entitlement_authority
    check (num_nonnulls(license_id, match_pass_id) = 1);
