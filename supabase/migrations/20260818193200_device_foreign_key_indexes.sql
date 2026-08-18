create index if not exists entitlements_device_id_idx
  on public.entitlements(device_id);

create index if not exists production_leases_device_id_idx
  on public.production_leases(device_id);
