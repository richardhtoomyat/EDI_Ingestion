create table public.onboardings (
  id uuid primary key default gen_random_uuid(),
  token text unique not null default encode(gen_random_bytes(16), 'hex'),
  company_name text not null,
  customer_email text not null,
  prefill jsonb not null,
  submission jsonb,
  created_at timestamptz not null default now()
);

alter table public.onboardings enable row level security;
