-- Production received the Stripe schema through the Supabase migration API before
-- these repository timestamped files were merged. If a later `supabase db push`
-- sees the repository versions as pending, make the following trigger creation
-- replay-safe. The next migration recreates the trigger immediately.
drop trigger if exists stripe_plan_mappings_updated_at on public.stripe_plan_mappings;
