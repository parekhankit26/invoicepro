-- InvoicePro Main Schema — Run this FIRST in Supabase SQL Editor
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email TEXT NOT NULL, full_name TEXT, company_name TEXT, company_logo TEXT,
  company_address TEXT, company_phone TEXT, company_website TEXT, tax_number TEXT,
  default_currency TEXT DEFAULT 'GBP', default_tax_rate DECIMAL(5,2) DEFAULT 20.00,
  default_payment_terms INTEGER DEFAULT 30, stripe_customer_id TEXT,
  plan TEXT DEFAULT 'free' CHECK (plan IN ('free','starter','pro','enterprise')),
  created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS clients (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL, email TEXT NOT NULL, phone TEXT, company TEXT,
  address TEXT, city TEXT, country TEXT DEFAULT 'GB', tax_number TEXT,
  currency TEXT DEFAULT 'GBP', notes TEXT, is_archived BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS invoices (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
  invoice_number TEXT NOT NULL,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft','sent','pending','paid','overdue','cancelled','refunded')),
  issue_date DATE NOT NULL DEFAULT CURRENT_DATE, due_date DATE NOT NULL,
  currency TEXT DEFAULT 'GBP', subtotal DECIMAL(12,2) DEFAULT 0,
  tax_rate DECIMAL(5,2) DEFAULT 20.00, tax_amount DECIMAL(12,2) DEFAULT 0,
  discount_percent DECIMAL(5,2) DEFAULT 0, discount_amount DECIMAL(12,2) DEFAULT 0,
  total DECIMAL(12,2) DEFAULT 0, amount_paid DECIMAL(12,2) DEFAULT 0,
  notes TEXT, terms TEXT, footer TEXT,
  stripe_payment_link TEXT, stripe_payment_intent_id TEXT, pdf_url TEXT,
  sent_at TIMESTAMPTZ, paid_at TIMESTAMPTZ, viewed_at TIMESTAMPTZ, view_count INTEGER DEFAULT 0,
  is_recurring BOOLEAN DEFAULT FALSE,
  recurring_interval TEXT CHECK (recurring_interval IN ('weekly','monthly','quarterly','yearly')),
  recurring_end_date DATE, recurring_parent_id UUID REFERENCES invoices(id),
  next_invoice_date DATE, late_fee_percent DECIMAL(5,2) DEFAULT 0,
  late_fee_amount DECIMAL(12,2) DEFAULT 0, client_token TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS invoice_items (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  invoice_id UUID REFERENCES invoices(id) ON DELETE CASCADE NOT NULL,
  description TEXT NOT NULL, quantity DECIMAL(10,2) DEFAULT 1,
  unit_price DECIMAL(12,2) NOT NULL, tax_rate DECIMAL(5,2) DEFAULT 0,
  amount DECIMAL(12,2) NOT NULL, sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS payments (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  invoice_id UUID REFERENCES invoices(id) ON DELETE CASCADE NOT NULL,
  amount DECIMAL(12,2) NOT NULL, currency TEXT DEFAULT 'GBP',
  method TEXT DEFAULT 'manual' CHECK (method IN ('stripe','bank_transfer','cash','cheque','paypal','manual','other')),
  status TEXT DEFAULT 'completed' CHECK (status IN ('pending','completed','failed','refunded')),
  stripe_payment_id TEXT, reference TEXT, notes TEXT,
  paid_at TIMESTAMPTZ DEFAULT NOW(), created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS expenses (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
  category TEXT NOT NULL, description TEXT NOT NULL,
  amount DECIMAL(12,2) NOT NULL, currency TEXT DEFAULT 'GBP',
  tax_amount DECIMAL(12,2) DEFAULT 0, is_billable BOOLEAN DEFAULT FALSE,
  is_billed BOOLEAN DEFAULT FALSE, receipt_url TEXT, receipt_data JSONB,
  ai_scanned BOOLEAN DEFAULT FALSE, date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS activity_logs (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  entity_type TEXT NOT NULL, entity_id UUID NOT NULL,
  action TEXT NOT NULL, metadata JSONB, created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS reminder_logs (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  invoice_id UUID REFERENCES invoices(id) ON DELETE CASCADE NOT NULL,
  type TEXT NOT NULL, sent_at TIMESTAMPTZ DEFAULT NOW(),
  email_to TEXT NOT NULL, success BOOLEAN DEFAULT TRUE
);

-- New v2 tables
CREATE TABLE IF NOT EXISTS quotes (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
  quote_number TEXT NOT NULL,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft','sent','accepted','declined','expired','converted')),
  issue_date DATE NOT NULL DEFAULT CURRENT_DATE, expiry_date DATE NOT NULL,
  currency TEXT DEFAULT 'GBP', subtotal DECIMAL(12,2) DEFAULT 0,
  tax_rate DECIMAL(5,2) DEFAULT 20.00, tax_amount DECIMAL(12,2) DEFAULT 0,
  discount_percent DECIMAL(5,2) DEFAULT 0, discount_amount DECIMAL(12,2) DEFAULT 0,
  total DECIMAL(12,2) DEFAULT 0, notes TEXT, terms TEXT,
  converted_invoice_id UUID REFERENCES invoices(id),
  sent_at TIMESTAMPTZ, accepted_at TIMESTAMPTZ, declined_at TIMESTAMPTZ,
  client_token TEXT UNIQUE, created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS quote_items (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  quote_id UUID REFERENCES quotes(id) ON DELETE CASCADE NOT NULL,
  description TEXT NOT NULL, quantity DECIMAL(10,2) DEFAULT 1,
  unit_price DECIMAL(12,2) NOT NULL, tax_rate DECIMAL(5,2) DEFAULT 0,
  amount DECIMAL(12,2) NOT NULL, sort_order INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS time_entries (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
  project TEXT, description TEXT NOT NULL,
  hours DECIMAL(6,2) NOT NULL, hourly_rate DECIMAL(10,2) NOT NULL,
  amount DECIMAL(12,2) GENERATED ALWAYS AS (hours * hourly_rate) STORED,
  date DATE NOT NULL DEFAULT CURRENT_DATE, is_billable BOOLEAN DEFAULT TRUE,
  is_billed BOOLEAN DEFAULT FALSE, invoice_id UUID REFERENCES invoices(id) ON DELETE SET NULL,
  started_at TIMESTAMPTZ, ended_at TIMESTAMPTZ, created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS client_portal_tokens (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE NOT NULL,
  token TEXT UNIQUE NOT NULL, is_active BOOLEAN DEFAULT TRUE,
  last_accessed TIMESTAMPTZ, created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, client_id)
);

CREATE TABLE IF NOT EXISTS team_members (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  owner_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  member_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL, full_name TEXT,
  role TEXT DEFAULT 'staff' CHECK (role IN ('admin','manager','staff','accountant','viewer')),
  permissions JSONB DEFAULT '{"create_invoices":true,"send_invoices":true,"view_reports":false,"manage_clients":true}',
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending','active','suspended')),
  invite_token TEXT UNIQUE, invited_at TIMESTAMPTZ DEFAULT NOW(),
  joined_at TIMESTAMPTZ, created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS api_keys (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL, key_hash TEXT UNIQUE NOT NULL,
  key_prefix TEXT NOT NULL, permissions JSONB DEFAULT '["invoices:read"]',
  last_used TIMESTAMPTZ, expires_at DATE, is_active BOOLEAN DEFAULT TRUE,
  request_count INTEGER DEFAULT 0, created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS white_label_settings (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE NOT NULL,
  brand_name TEXT, brand_logo_url TEXT,
  brand_primary_color TEXT DEFAULT '#1a1814', brand_accent_color TEXT DEFAULT '#22c55e',
  custom_domain TEXT, custom_email_from TEXT, custom_email_name TEXT,
  invoice_footer TEXT, hide_powered_by BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS invoice_views (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  invoice_id UUID REFERENCES invoices(id) ON DELETE CASCADE NOT NULL,
  viewed_at TIMESTAMPTZ DEFAULT NOW(), ip_address TEXT, user_agent TEXT,
  source TEXT DEFAULT 'email'
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_invoices_user_id ON invoices(user_id);
CREATE INDEX IF NOT EXISTS idx_invoices_client_id ON invoices(client_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);
CREATE INDEX IF NOT EXISTS idx_clients_user_id ON clients(user_id);
CREATE INDEX IF NOT EXISTS idx_payments_invoice_id ON payments(invoice_id);
CREATE INDEX IF NOT EXISTS idx_expenses_user_id ON expenses(user_id);
CREATE INDEX IF NOT EXISTS idx_quotes_user_id ON quotes(user_id);
CREATE INDEX IF NOT EXISTS idx_time_entries_user_id ON time_entries(user_id);

-- RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE quote_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE time_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_portal_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE white_label_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_views ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own profile" ON profiles FOR ALL USING (auth.uid() = id);
CREATE POLICY "own clients" ON clients FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "own invoices" ON invoices FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "own invoice items" ON invoice_items FOR ALL USING (EXISTS (SELECT 1 FROM invoices WHERE invoices.id = invoice_items.invoice_id AND invoices.user_id = auth.uid()));
CREATE POLICY "own payments" ON payments FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "own expenses" ON expenses FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "own activity" ON activity_logs FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own quotes" ON quotes FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "own quote items" ON quote_items FOR ALL USING (EXISTS (SELECT 1 FROM quotes WHERE quotes.id = quote_items.quote_id AND quotes.user_id = auth.uid()));
CREATE POLICY "own time entries" ON time_entries FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "own portal tokens" ON client_portal_tokens FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "own team" ON team_members FOR ALL USING (auth.uid() = owner_id OR auth.uid() = member_id);
CREATE POLICY "own api keys" ON api_keys FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "own white label" ON white_label_settings FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "own invoice views" ON invoice_views FOR SELECT USING (EXISTS (SELECT 1 FROM invoices WHERE invoices.id = invoice_views.invoice_id AND invoices.user_id = auth.uid()));

-- Auto update trigger
CREATE OR REPLACE FUNCTION update_updated_at() RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $$ LANGUAGE plpgsql;
CREATE TRIGGER upd_profiles BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER upd_clients BEFORE UPDATE ON clients FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER upd_invoices BEFORE UPDATE ON invoices FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER upd_expenses BEFORE UPDATE ON expenses FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER upd_quotes BEFORE UPDATE ON quotes FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Auto create profile on signup
CREATE OR REPLACE FUNCTION handle_new_user() RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, email, full_name) VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data->>'full_name');
  RETURN NEW;
END; $$ LANGUAGE plpgsql SECURITY DEFINER;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Satisfaction scores (Feature 6)
CREATE TABLE IF NOT EXISTS satisfaction_scores (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  invoice_id UUID REFERENCES invoices(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
  score INTEGER NOT NULL CHECK (score BETWEEN 1 AND 5),
  comment TEXT,
  responded_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE satisfaction_scores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own satisfaction scores" ON satisfaction_scores FOR ALL USING (auth.uid() = user_id);
