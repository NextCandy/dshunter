CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS citext;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

ALTER TABLE public.registrars
  ADD COLUMN IF NOT EXISTS display_name text,
  ADD COLUMN IF NOT EXISTS last_domain_sync_at timestamptz;

CREATE TABLE IF NOT EXISTS public.registrar_accounts (
  id bigserial PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES public.app_users(id) ON DELETE CASCADE,
  registrar_id bigint REFERENCES public.registrars(id) ON DELETE SET NULL,
  registrar text NOT NULL,
  display_name text,
  credentials_encrypted text,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, registrar_id)
);

CREATE TABLE IF NOT EXISTS public.registrar_domains (
  id bigserial PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES public.app_users(id) ON DELETE CASCADE,
  registrar_account_id bigint NOT NULL REFERENCES public.registrar_accounts(id) ON DELETE CASCADE,
  registrar text NOT NULL,
  domain_name citext NOT NULL,
  expiry_date timestamptz,
  estimated_value numeric(12,2),
  auto_renew boolean,
  nameservers text[] NOT NULL DEFAULT '{}',
  domain_status text NOT NULL DEFAULT 'active',
  note text,
  raw_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  sync_status text NOT NULL DEFAULT 'ok',
  sync_error text,
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  last_synced_at timestamptz NOT NULL DEFAULT now(),
  removed_from_registrar_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, registrar_account_id, domain_name)
);

CREATE TABLE IF NOT EXISTS public.registrar_sync_jobs (
  id bigserial PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES public.app_users(id) ON DELETE CASCADE,
  registrar_account_id bigint REFERENCES public.registrar_accounts(id) ON DELETE SET NULL,
  registrar text NOT NULL,
  status text NOT NULL DEFAULT 'running',
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  total_count integer NOT NULL DEFAULT 0,
  created_count integer NOT NULL DEFAULT 0,
  updated_count integer NOT NULL DEFAULT 0,
  missing_count integer NOT NULL DEFAULT 0,
  failed_count integer NOT NULL DEFAULT 0,
  error_message text,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_registrar_accounts_user ON public.registrar_accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_registrar_domains_user_account ON public.registrar_domains(user_id, registrar_account_id);
CREATE INDEX IF NOT EXISTS idx_registrar_domains_name_trgm ON public.registrar_domains USING gin (domain_name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_registrar_domains_expiry ON public.registrar_domains(expiry_date);
CREATE INDEX IF NOT EXISTS idx_registrar_domains_status ON public.registrar_domains(domain_status, sync_status);
CREATE INDEX IF NOT EXISTS idx_registrar_domains_last_synced ON public.registrar_domains(last_synced_at DESC);
CREATE INDEX IF NOT EXISTS idx_registrar_sync_jobs_user_created ON public.registrar_sync_jobs(user_id, created_at DESC);

DO $$ BEGIN
  CREATE TRIGGER trg_registrar_accounts_touch BEFORE UPDATE ON public.registrar_accounts FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TRIGGER trg_registrar_domains_touch BEFORE UPDATE ON public.registrar_domains FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
