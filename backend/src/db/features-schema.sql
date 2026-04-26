-- ============================================
-- InvoicePro — New Features Schema
-- Run this AFTER schema.sql and admin-schema.sql
-- ============================================

-- ============================================
-- QUOTES / ESTIMATES
-- ============================================
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
  client_token TEXT UNIQUE, -- for client portal access
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

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

-- ============================================
-- TIME TRACKING
-- ============================================
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

-- ============================================
-- CLIENT PORTAL
-- ============================================
CREATE TABLE IF NOT EXISTS client_portal_tokens (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE NOT NULL,
  token TEXT UNIQUE NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  last_accessed TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, client_id)
);

-- ============================================
-- TEAM MEMBERS (Enterprise)
-- ============================================
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

-- ============================================
-- API KEYS (Enterprise)
-- ============================================
CREATE TABLE IF NOT EXISTS api_keys (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  key_hash TEXT UNIQUE NOT NULL,
  key_prefix TEXT NOT NULL, -- first 8 chars for display
  permissions JSONB DEFAULT '["invoices:read","invoices:write","clients:read"]',
  last_used TIMESTAMPTZ,
  expires_at DATE,
  is_active BOOLEAN DEFAULT TRUE,
  request_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- INVOICE VIEW TRACKING
-- ============================================
CREATE TABLE IF NOT EXISTS invoice_views (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  invoice_id UUID REFERENCES invoices(id) ON DELETE CASCADE NOT NULL,
  viewed_at TIMESTAMPTZ DEFAULT NOW(),
  ip_address TEXT,
  user_agent TEXT,
  source TEXT DEFAULT 'email' CHECK (source IN ('email','portal','link','direct'))
);

-- ============================================
-- LATE PAYMENT FEES
-- ============================================
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS late_fee_percent DECIMAL(5,2) DEFAULT 0;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS late_fee_amount DECIMAL(12,2) DEFAULT 0;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS client_token TEXT;

-- ============================================
-- WHITE LABEL (Enterprise)
-- ============================================
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

-- ============================================
-- RECEIPT UPLOADS (for AI scanning)
-- ============================================
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS receipt_data JSONB;
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS ai_scanned BOOLEAN DEFAULT FALSE;

-- ============================================
-- TAX REPORTS
-- ============================================
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

-- ============================================
-- WEBHOOK ENDPOINTS (Enterprise API)
-- ============================================
CREATE TABLE IF NOT EXISTS webhook_endpoints (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  url TEXT NOT NULL,
  events JSONB DEFAULT '["invoice.paid","invoice.sent","payment.received"]',
  secret TEXT NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  last_triggered TIMESTAMPTZ,
  failure_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- INDEXES
-- ============================================
CREATE INDEX IF NOT EXISTS idx_quotes_user_id ON quotes(user_id);
CREATE INDEX IF NOT EXISTS idx_quotes_client_id ON quotes(client_id);
CREATE INDEX IF NOT EXISTS idx_time_entries_user_id ON time_entries(user_id);
CREATE INDEX IF NOT EXISTS idx_time_entries_client_id ON time_entries(client_id);
CREATE INDEX IF NOT EXISTS idx_team_members_owner_id ON team_members(owner_id);
CREATE INDEX IF NOT EXISTS idx_invoice_views_invoice_id ON invoice_views(invoice_id);
CREATE INDEX IF NOT EXISTS idx_client_portal_tokens_token ON client_portal_tokens(token);

-- ============================================
-- RLS POLICIES
-- ============================================
ALTER TABLE quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE quote_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE time_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_portal_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_views ENABLE ROW LEVEL SECURITY;
ALTER TABLE white_label_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE tax_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_endpoints ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own quotes" ON quotes FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users manage own quote items" ON quote_items FOR ALL USING (EXISTS (SELECT 1 FROM quotes WHERE quotes.id = quote_items.quote_id AND quotes.user_id = auth.uid()));
CREATE POLICY "Users manage own time entries" ON time_entries FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users manage own portal tokens" ON client_portal_tokens FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users manage own team" ON team_members FOR ALL USING (auth.uid() = owner_id);
CREATE POLICY "Team members can view" ON team_members FOR SELECT USING (auth.uid() = member_id);
CREATE POLICY "Users manage own api keys" ON api_keys FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users view own invoice views" ON invoice_views FOR SELECT USING (EXISTS (SELECT 1 FROM invoices WHERE invoices.id = invoice_views.invoice_id AND invoices.user_id = auth.uid()));
CREATE POLICY "Users manage own white label" ON white_label_settings FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users manage own tax periods" ON tax_periods FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users manage own webhooks" ON webhook_endpoints FOR ALL USING (auth.uid() = user_id);

-- Auto-update trigger for quotes
CREATE TRIGGER update_quotes_updated_at BEFORE UPDATE ON quotes FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_white_label_updated_at BEFORE UPDATE ON white_label_settings FOR EACH ROW EXECUTE FUNCTION update_updated_at();
