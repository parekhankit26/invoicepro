-- ================================================================
-- InvoicePro — COMPLETE MIGRATION SCRIPT
-- Run this in Supabase SQL Editor → it is safe to run multiple times
-- ================================================================

-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ── PROFILES ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email TEXT NOT NULL,
  full_name TEXT,
  company_name TEXT,
  company_logo TEXT,
  company_address TEXT,
  company_phone TEXT,
  company_website TEXT,
  tax_number TEXT,
  default_currency TEXT DEFAULT 'GBP',
  default_tax_rate DECIMAL(5,2) DEFAULT 20.00,
  default_payment_terms INTEGER DEFAULT 30,
  plan TEXT DEFAULT 'free' CHECK (plan IN ('free','starter','pro','enterprise')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
-- New columns for profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS country_code TEXT DEFAULT 'GB';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS notify_on_view BOOLEAN DEFAULT TRUE;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS notify_on_payment BOOLEAN DEFAULT TRUE;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS auto_reminders BOOLEAN DEFAULT FALSE;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT;

-- ── CLIENTS ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS clients (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  company TEXT,
  address TEXT,
  city TEXT,
  country TEXT DEFAULT 'GB',
  tax_number TEXT,
  currency TEXT DEFAULT 'GBP',
  notes TEXT,
  is_archived BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE clients ADD COLUMN IF NOT EXISTS website TEXT;

-- ── INVOICES ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS invoices (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
  invoice_number TEXT NOT NULL,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft','sent','pending','paid','overdue','cancelled','refunded')),
  issue_date DATE NOT NULL DEFAULT CURRENT_DATE,
  due_date DATE NOT NULL,
  currency TEXT DEFAULT 'GBP',
  subtotal DECIMAL(12,2) DEFAULT 0,
  tax_rate DECIMAL(5,2) DEFAULT 20.00,
  tax_amount DECIMAL(12,2) DEFAULT 0,
  discount_percent DECIMAL(5,2) DEFAULT 0,
  discount_amount DECIMAL(12,2) DEFAULT 0,
  total DECIMAL(12,2) DEFAULT 0,
  amount_paid DECIMAL(12,2) DEFAULT 0,
  notes TEXT,
  terms TEXT,
  footer TEXT,
  sent_at TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,
  viewed_at TIMESTAMPTZ,
  view_count INTEGER DEFAULT 0,
  late_fee_percent DECIMAL(5,2) DEFAULT 0,
  late_fee_amount DECIMAL(12,2) DEFAULT 0,
  client_token TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
-- Country/tax system columns
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS country_code TEXT DEFAULT 'GB';
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS tax_type TEXT DEFAULT 'standard';
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS tax_lines JSONB DEFAULT '[]';
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS taxable_amount DECIMAL(12,2) DEFAULT 0;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS tax_summary_label TEXT DEFAULT 'VAT';
-- Recurring
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS is_recurring BOOLEAN DEFAULT FALSE;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS recurring_interval TEXT;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS recurring_end_date DATE;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS recurring_parent_id UUID;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS next_invoice_date DATE;
-- Stripe
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS stripe_payment_link TEXT;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS stripe_payment_intent_id TEXT;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS pdf_url TEXT;

-- ── INVOICE ITEMS ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS invoice_items (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  invoice_id UUID REFERENCES invoices(id) ON DELETE CASCADE NOT NULL,
  description TEXT NOT NULL,
  quantity DECIMAL(10,2) DEFAULT 1,
  unit_price DECIMAL(12,2) NOT NULL,
  tax_rate DECIMAL(5,2) DEFAULT 0,
  amount DECIMAL(12,2) NOT NULL,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── PAYMENTS ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS payments (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  invoice_id UUID REFERENCES invoices(id) ON DELETE CASCADE NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  currency TEXT DEFAULT 'GBP',
  method TEXT DEFAULT 'manual' CHECK (method IN ('stripe','bank_transfer','cash','cheque','paypal','manual','other')),
  status TEXT DEFAULT 'completed' CHECK (status IN ('pending','completed','failed','refunded')),
  stripe_payment_id TEXT,
  reference TEXT,
  notes TEXT,
  paid_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── EXPENSES ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS expenses (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
  category TEXT NOT NULL,
  description TEXT NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  currency TEXT DEFAULT 'GBP',
  tax_amount DECIMAL(12,2) DEFAULT 0,
  is_billable BOOLEAN DEFAULT FALSE,
  is_billed BOOLEAN DEFAULT FALSE,
  receipt_url TEXT,
  receipt_data JSONB,
  ai_scanned BOOLEAN DEFAULT FALSE,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS reference TEXT;
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS notes TEXT;

-- ── QUOTES ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS quotes (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
  quote_number TEXT NOT NULL,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft','sent','accepted','declined','expired','converted')),
  issue_date DATE NOT NULL DEFAULT CURRENT_DATE,
  expiry_date DATE NOT NULL,
  currency TEXT DEFAULT 'GBP',
  subtotal DECIMAL(12,2) DEFAULT 0,
  tax_rate DECIMAL(5,2) DEFAULT 20.00,
  tax_amount DECIMAL(12,2) DEFAULT 0,
  discount_percent DECIMAL(5,2) DEFAULT 0,
  discount_amount DECIMAL(12,2) DEFAULT 0,
  total DECIMAL(12,2) DEFAULT 0,
  notes TEXT,
  terms TEXT,
  converted_invoice_id UUID REFERENCES invoices(id),
  sent_at TIMESTAMPTZ,
  accepted_at TIMESTAMPTZ,
  declined_at TIMESTAMPTZ,
  client_token TEXT UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS country_code TEXT DEFAULT 'GB';
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS tax_type TEXT DEFAULT 'standard';
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS tax_lines JSONB DEFAULT '[]';
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS taxable_amount DECIMAL(12,2) DEFAULT 0;

-- ── QUOTE ITEMS ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS quote_items (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  quote_id UUID REFERENCES quotes(id) ON DELETE CASCADE NOT NULL,
  description TEXT NOT NULL,
  quantity DECIMAL(10,2) DEFAULT 1,
  unit_price DECIMAL(12,2) NOT NULL,
  tax_rate DECIMAL(5,2) DEFAULT 0,
  amount DECIMAL(12,2) NOT NULL,
  sort_order INTEGER DEFAULT 0
);

-- ── TIME ENTRIES ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS time_entries (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
  project TEXT,
  description TEXT NOT NULL,
  hours DECIMAL(6,2) NOT NULL,
  hourly_rate DECIMAL(10,2) NOT NULL,
  amount DECIMAL(12,2) GENERATED ALWAYS AS (hours * hourly_rate) STORED,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  is_billable BOOLEAN DEFAULT TRUE,
  is_billed BOOLEAN DEFAULT FALSE,
  invoice_id UUID REFERENCES invoices(id) ON DELETE SET NULL,
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── CLIENT PORTAL TOKENS ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS client_portal_tokens (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE NOT NULL,
  token TEXT UNIQUE NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  last_accessed TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── TEAM MEMBERS ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS team_members (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  owner_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  member_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  role TEXT DEFAULT 'staff' CHECK (role IN ('admin','manager','staff','accountant','viewer')),
  permissions JSONB DEFAULT '{"create_invoices":true,"send_invoices":true,"view_reports":false,"manage_clients":true,"manage_expenses":true}',
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending','active','suspended')),
  invite_token TEXT UNIQUE,
  invited_at TIMESTAMPTZ DEFAULT NOW(),
  joined_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── API KEYS ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS api_keys (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  key_hash TEXT UNIQUE NOT NULL,
  key_prefix TEXT NOT NULL,
  permissions JSONB DEFAULT '["invoices:read"]',
  last_used TIMESTAMPTZ,
  expires_at DATE,
  is_active BOOLEAN DEFAULT TRUE,
  request_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── WHITE LABEL ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS white_label_settings (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE NOT NULL,
  brand_name TEXT,
  brand_logo_url TEXT,
  brand_primary_color TEXT DEFAULT '#1a1814',
  brand_accent_color TEXT DEFAULT '#22c55e',
  custom_domain TEXT,
  custom_email_from TEXT,
  custom_email_name TEXT,
  invoice_footer TEXT,
  hide_powered_by BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── INVOICE VIEWS ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS invoice_views (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  invoice_id UUID REFERENCES invoices(id) ON DELETE CASCADE NOT NULL,
  viewed_at TIMESTAMPTZ DEFAULT NOW(),
  ip_address TEXT,
  user_agent TEXT,
  source TEXT DEFAULT 'email'
);

-- ── SATISFACTION SCORES ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS satisfaction_scores (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  invoice_id UUID REFERENCES invoices(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
  score INTEGER NOT NULL CHECK (score BETWEEN 1 AND 5),
  comment TEXT,
  responded_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── ACTIVITY LOGS ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS activity_logs (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID NOT NULL,
  action TEXT NOT NULL,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── REMINDER LOGS ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS reminder_logs (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  invoice_id UUID REFERENCES invoices(id) ON DELETE CASCADE NOT NULL,
  type TEXT NOT NULL,
  sent_at TIMESTAMPTZ DEFAULT NOW(),
  email_to TEXT NOT NULL,
  success BOOLEAN DEFAULT TRUE
);

-- ── TAX PERIODS ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tax_periods (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  vat_collected DECIMAL(12,2) DEFAULT 0,
  vat_reclaimable DECIMAL(12,2) DEFAULT 0,
  net_vat DECIMAL(12,2) DEFAULT 0,
  total_revenue DECIMAL(12,2) DEFAULT 0,
  total_expenses DECIMAL(12,2) DEFAULT 0,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft','submitted','paid')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── INDEXES ───────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_invoices_user_id ON invoices(user_id);
CREATE INDEX IF NOT EXISTS idx_invoices_client_id ON invoices(client_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);
CREATE INDEX IF NOT EXISTS idx_clients_user_id ON clients(user_id);
CREATE INDEX IF NOT EXISTS idx_payments_invoice_id ON payments(invoice_id);
CREATE INDEX IF NOT EXISTS idx_payments_user_id ON payments(user_id);
CREATE INDEX IF NOT EXISTS idx_expenses_user_id ON expenses(user_id);
CREATE INDEX IF NOT EXISTS idx_quotes_user_id ON quotes(user_id);
CREATE INDEX IF NOT EXISTS idx_quotes_client_id ON quotes(client_id);
CREATE INDEX IF NOT EXISTS idx_time_entries_user_id ON time_entries(user_id);
CREATE INDEX IF NOT EXISTS idx_team_members_owner_id ON team_members(owner_id);
CREATE INDEX IF NOT EXISTS idx_team_members_member_id ON team_members(member_id);
CREATE INDEX IF NOT EXISTS idx_invoice_views_invoice_id ON invoice_views(invoice_id);
CREATE INDEX IF NOT EXISTS idx_client_portal_tokens_token ON client_portal_tokens(token);

-- ── ROW LEVEL SECURITY ────────────────────────────────────────────
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE quote_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE time_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_portal_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE white_label_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_views ENABLE ROW LEVEL SECURITY;
ALTER TABLE satisfaction_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE tax_periods ENABLE ROW LEVEL SECURITY;

-- Drop and recreate policies safely
DO $$ BEGIN
  -- profiles
  DROP POLICY IF EXISTS "own profile" ON profiles;
  CREATE POLICY "own profile" ON profiles FOR ALL USING (auth.uid() = id);
  -- clients
  DROP POLICY IF EXISTS "own clients" ON clients;
  CREATE POLICY "own clients" ON clients FOR ALL USING (auth.uid() = user_id);
  -- invoices
  DROP POLICY IF EXISTS "own invoices" ON invoices;
  CREATE POLICY "own invoices" ON invoices FOR ALL USING (auth.uid() = user_id);
  -- invoice_items
  DROP POLICY IF EXISTS "own invoice items" ON invoice_items;
  CREATE POLICY "own invoice items" ON invoice_items FOR ALL USING (
    EXISTS (SELECT 1 FROM invoices WHERE invoices.id = invoice_items.invoice_id AND invoices.user_id = auth.uid())
  );
  -- payments
  DROP POLICY IF EXISTS "own payments" ON payments;
  CREATE POLICY "own payments" ON payments FOR ALL USING (auth.uid() = user_id);
  -- expenses
  DROP POLICY IF EXISTS "own expenses" ON expenses;
  CREATE POLICY "own expenses" ON expenses FOR ALL USING (auth.uid() = user_id);
  -- quotes
  DROP POLICY IF EXISTS "own quotes" ON quotes;
  DROP POLICY IF EXISTS "Users manage own quotes" ON quotes;
  DROP POLICY IF EXISTS "own quotes" ON quotes;
  CREATE POLICY "own quotes" ON quotes FOR ALL USING (auth.uid() = user_id);
  -- quote_items
  DROP POLICY IF EXISTS "own quote items" ON quote_items;
  DROP POLICY IF EXISTS "Users manage own quote items" ON quote_items;
  DROP POLICY IF EXISTS "own quote items" ON quote_items;
  CREATE POLICY "own quote items" ON quote_items FOR ALL USING (
    EXISTS (SELECT 1 FROM quotes WHERE quotes.id = quote_items.quote_id AND quotes.user_id = auth.uid())
  );
  -- time_entries
  DROP POLICY IF EXISTS "own time entries" ON time_entries;
  DROP POLICY IF EXISTS "Users manage own time entries" ON time_entries;
  DROP POLICY IF EXISTS "own time entries" ON time_entries;
  CREATE POLICY "own time entries" ON time_entries FOR ALL USING (auth.uid() = user_id);
  -- client_portal_tokens
  DROP POLICY IF EXISTS "own portal tokens" ON client_portal_tokens;
  DROP POLICY IF EXISTS "Users manage own portal tokens" ON client_portal_tokens;
  DROP POLICY IF EXISTS "own portal tokens" ON client_portal_tokens;
  CREATE POLICY "own portal tokens" ON client_portal_tokens FOR ALL USING (auth.uid() = user_id);
  -- team_members
  DROP POLICY IF EXISTS "own team" ON team_members;
  DROP POLICY IF EXISTS "Users manage own team" ON team_members;
  DROP POLICY IF EXISTS "Team members can view" ON team_members;
  DROP POLICY IF EXISTS "own team" ON team_members;
  CREATE POLICY "own team" ON team_members FOR ALL USING (auth.uid() = owner_id OR auth.uid() = member_id);
  -- api_keys
  DROP POLICY IF EXISTS "own api keys" ON api_keys;
  DROP POLICY IF EXISTS "Users manage own api keys" ON api_keys;
  DROP POLICY IF EXISTS "own api keys" ON api_keys;
  CREATE POLICY "own api keys" ON api_keys FOR ALL USING (auth.uid() = user_id);
  -- white_label_settings
  DROP POLICY IF EXISTS "own white label" ON white_label_settings;
  DROP POLICY IF EXISTS "Users manage own white label" ON white_label_settings;
  DROP POLICY IF EXISTS "own white label" ON white_label_settings;
  CREATE POLICY "own white label" ON white_label_settings FOR ALL USING (auth.uid() = user_id);
  -- invoice_views
  DROP POLICY IF EXISTS "own invoice views" ON invoice_views;
  DROP POLICY IF EXISTS "Users view own invoice views" ON invoice_views;
  DROP POLICY IF EXISTS "own invoice views" ON invoice_views;
  CREATE POLICY "own invoice views" ON invoice_views FOR ALL USING (
    EXISTS (SELECT 1 FROM invoices WHERE invoices.id = invoice_views.invoice_id AND invoices.user_id = auth.uid())
  );
  -- satisfaction_scores
  DROP POLICY IF EXISTS "own satisfaction scores" ON satisfaction_scores;
  CREATE POLICY "own satisfaction scores" ON satisfaction_scores FOR ALL USING (auth.uid() = user_id);
  -- activity_logs
  DROP POLICY IF EXISTS "own activity" ON activity_logs;
  CREATE POLICY "own activity" ON activity_logs FOR ALL USING (auth.uid() = user_id);
  -- tax_periods
  DROP POLICY IF EXISTS "Users manage own tax periods" ON tax_periods;
  DROP POLICY IF EXISTS "own tax periods" ON tax_periods;
  CREATE POLICY "own tax periods" ON tax_periods FOR ALL USING (auth.uid() = user_id);
END $$;

-- ── FUNCTIONS & TRIGGERS ──────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS upd_profiles ON profiles;
CREATE TRIGGER upd_profiles BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at();
DROP TRIGGER IF EXISTS upd_clients ON clients;
CREATE TRIGGER upd_clients BEFORE UPDATE ON clients FOR EACH ROW EXECUTE FUNCTION update_updated_at();
DROP TRIGGER IF EXISTS upd_invoices ON invoices;
CREATE TRIGGER upd_invoices BEFORE UPDATE ON invoices FOR EACH ROW EXECUTE FUNCTION update_updated_at();
DROP TRIGGER IF EXISTS upd_expenses ON expenses;
CREATE TRIGGER upd_expenses BEFORE UPDATE ON expenses FOR EACH ROW EXECUTE FUNCTION update_updated_at();
DROP TRIGGER IF EXISTS upd_quotes ON quotes;
CREATE TRIGGER upd_quotes BEFORE UPDATE ON quotes FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, email, full_name)
  VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data->>'full_name')
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ── REFRESH SCHEMA CACHE ──────────────────────────────────────────
-- This tells PostgREST to reload its schema cache immediately
NOTIFY pgrst, 'reload schema';

SELECT 'Migration complete ✅' as status;

-- ── ADMIN PASSWORD RESET COLUMNS ─────────────────────────
ALTER TABLE admin_users ADD COLUMN IF NOT EXISTS password_reset_token TEXT;
ALTER TABLE admin_users ADD COLUMN IF NOT EXISTS password_reset_expires TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS idx_admin_reset_token ON admin_users(password_reset_token);

-- ── SUPPORT TICKETS EXTRA COLUMNS ─────────────────────────
ALTER TABLE support_tickets ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMPTZ;
ALTER TABLE support_tickets ADD COLUMN IF NOT EXISTS replied_by TEXT;

-- ── PLANS TABLE ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS plans (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  price_monthly DECIMAL(8,2) DEFAULT 0,
  price_yearly DECIMAL(8,2) DEFAULT 0,
  max_invoices INTEGER DEFAULT 5,
  max_clients INTEGER DEFAULT 2,
  max_team_members INTEGER DEFAULT 0,
  features JSONB DEFAULT '[]',
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO plans (slug, name, price_monthly, price_yearly, max_invoices, max_clients, max_team_members, is_active)
VALUES
  ('free',       'Free',       0,  0,   5,  2,  0, true),
  ('starter',    'Starter',    9,  90, -1, -1,  3, true),
  ('pro',        'Pro',       19, 190, -1, -1, 10, true),
  ('enterprise', 'Enterprise',49, 490,-1, -1, -1, true)
ON CONFLICT (slug) DO NOTHING;

-- ── APP SETTINGS DEFAULTS ────────────────────────────────────
INSERT INTO app_settings (key, value, label, category) VALUES
  ('feature_ai_assistant',     'true',  'AI Assistant',          'features'),
  ('feature_whatsapp_sms',     'false', 'WhatsApp & SMS',         'features'),
  ('feature_receipt_scanner',  'true',  'Receipt Scanner',        'features'),
  ('feature_cashflow_forecast','true',  'Cash Flow Forecast',     'features'),
  ('feature_invoice_designer', 'true',  'Invoice Designer',       'features'),
  ('feature_client_happiness', 'true',  'Client Happiness',       'features'),
  ('feature_financing',        'false', 'Invoice Financing',      'features'),
  ('feature_time_tracking',    'true',  'Time Tracking',          'features'),
  ('feature_recurring',        'false', 'Recurring Invoices',     'features'),
  ('site_name',    '"InvoicePro"',    'Site name',    'general'),
  ('support_email','"support@invoicepro.app"','Support email','general'),
  ('max_free_invoices','5',    'Free plan invoice limit',  'limits'),
  ('max_free_clients', '2',   'Free plan client limit',   'limits')
ON CONFLICT (key) DO NOTHING;

SELECT 'Full migration complete ✅' as status;

-- ── PERMANENT EMAIL SETTINGS (Hostinger) ─────────────────────
-- Pre-configure Hostinger SMTP - admin just needs to add password
INSERT INTO app_settings (key, value, label, category) VALUES
  ('smtp_host',   '"smtp.hostinger.com"',        'SMTP Host',     'email'),
  ('smtp_port',   '"465"',                        'SMTP Port',     'email'),
  ('smtp_secure', 'true',                         'Use SSL',       'email'),
  ('smtp_user',   '"invoice@asproite.com"',       'SMTP Username', 'email'),
  ('smtp_from',   '"InvoicePro <invoice@asproite.com>"', 'From Email', 'email'),
  ('email_provider', '"smtp"',                    'Provider',      'email')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

SELECT 'Hostinger email pre-configured ✅' as status;
