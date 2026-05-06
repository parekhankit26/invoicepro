-- ══════════════════════════════════════════════════════════
-- InvoicePro Demo Data — Run this in Supabase SQL Editor
-- ══════════════════════════════════════════════════════════

-- Step 1: Create tables if not exist
CREATE TABLE IF NOT EXISTS plans (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name TEXT NOT NULL, slug TEXT UNIQUE NOT NULL,
  price_monthly DECIMAL(10,2) DEFAULT 0, price_yearly DECIMAL(10,2) DEFAULT 0,
  max_invoices INTEGER DEFAULT 5, max_clients INTEGER DEFAULT 3,
  max_team_members INTEGER DEFAULT 0, features JSONB DEFAULT '[]',
  is_active BOOLEAN DEFAULT true, is_featured BOOLEAN DEFAULT false,
  sort_order INTEGER DEFAULT 0, created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS currencies (
  code TEXT PRIMARY KEY, name TEXT NOT NULL, symbol TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true, sort_order INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS app_settings (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  key TEXT UNIQUE NOT NULL, value TEXT, category TEXT DEFAULT 'general',
  label TEXT, updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS support_tickets (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  subject TEXT NOT NULL, message TEXT NOT NULL,
  priority TEXT DEFAULT 'normal', status TEXT DEFAULT 'open',
  admin_reply TEXT, replied_at TIMESTAMPTZ, created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS admin_audit_log (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  admin_id UUID, action TEXT NOT NULL, entity_type TEXT,
  entity_id TEXT, new_value JSONB, created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Step 2: Plans
INSERT INTO plans (name, slug, price_monthly, price_yearly, max_invoices, max_clients, max_team_members, features, is_active, is_featured, sort_order) VALUES
('Free', 'free', 0, 0, 5, 2, 0, '["5 invoices/month","2 clients","Basic reports","Email support"]', true, false, 1),
('Starter', 'starter', 9.5, 90, 50, 20, 1, '["50 invoices","20 clients","Email reminders","PDF export","Receipt scanner","Early payment discount","1 team member"]', true, false, 2),
('Pro', 'pro', 20, 182, -1, -1, 3, '["Unlimited invoices","Unlimited clients","AI assistant","WhatsApp reminders","Cash flow forecast","Client happiness score","Invoice financing","Milestone billing","Time tracking","Recurring invoices","3 team members","Priority support"]', true, true, 3),
('Enterprise', 'enterprise', 49.5, 470, -1, -1, -1, '["Everything in Pro","White label branding","REST API access","Xero/QuickBooks export","Unlimited team members","Custom domain","Dedicated support","SLA guarantee"]', true, false, 4)
ON CONFLICT (slug) DO UPDATE SET 
  price_monthly = EXCLUDED.price_monthly,
  price_yearly = EXCLUDED.price_yearly,
  max_clients = EXCLUDED.max_clients,
  max_team_members = EXCLUDED.max_team_members;

-- Step 3: Currencies
INSERT INTO currencies (code, name, symbol, is_active, sort_order) VALUES
('GBP','British Pound','£',true,1),('USD','US Dollar','$',true,2),
('EUR','Euro','€',true,3),('CAD','Canadian Dollar','C$',true,4),
('AUD','Australian Dollar','A$',true,5),('CHF','Swiss Franc','CHF',true,6),
('JPY','Japanese Yen','¥',true,7),('INR','Indian Rupee','₹',true,8),
('AED','UAE Dirham','AED',true,9),('SGD','Singapore Dollar','S$',true,10),
('NOK','Norwegian Krone','kr',true,11),('SEK','Swedish Krona','kr',true,12),
('DKK','Danish Krone','kr',true,13),('NZD','New Zealand Dollar','NZ$',true,14),
('ZAR','South African Rand','R',true,15),('HKD','Hong Kong Dollar','HK$',true,16),
('MXN','Mexican Peso','MX$',false,17),('BRL','Brazilian Real','R$',false,18)
ON CONFLICT (code) DO NOTHING;

-- Step 4: App Settings (Feature flags + general)
INSERT INTO app_settings (key, value, category, label) VALUES
('feature_ai_assistant','true','features','AI Invoice Assistant'),
('feature_whatsapp_sms','true','features','WhatsApp & SMS Reminders'),
('feature_receipt_scanner','true','features','AI Receipt Scanner'),
('feature_cashflow_forecast','true','features','Cash Flow Forecast'),
('feature_invoice_designer','true','features','Invoice Template Designer'),
('feature_client_happiness','true','features','Client Happiness Score'),
('feature_financing','true','features','Invoice Financing (Get Paid Now)'),
('feature_milestones','true','features','Milestone Billing'),
('feature_early_payment','true','features','Early Payment Discount'),
('feature_view_tracking','true','features','Invoice View Tracking'),
('feature_year_review','true','features','Year in Review'),
('feature_time_tracking','true','features','Time Tracking'),
('feature_recurring','true','features','Recurring Invoices'),
('feature_xero_export','false','features','Xero/QuickBooks Export'),
('feature_white_label','false','features','White Label Branding'),
('feature_api_access','false','features','REST API Access'),
('app_name','"InvoicePro"','general','App Name'),
('app_tagline','"Smart invoicing for freelancers & agencies"','general','App Tagline'),
('app_maintenance','false','general','Maintenance Mode'),
('allow_registration','true','general','Allow New Registrations'),
('default_currency','"GBP"','general','Default Currency'),
('default_tax_rate','20','general','Default VAT Rate (%)'),
('default_payment_terms','30','general','Default Payment Terms (days)'),
('support_email','"support@invoicepro.com"','general','Support Email'),
('max_file_size','10','general','Max Upload Size (MB)')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, label = EXCLUDED.label;

-- Step 5: Demo support ticket (so tickets page shows data)
-- Note: This requires a real user_id - skip if no users yet
-- INSERT INTO support_tickets (subject, message, priority, status) 
-- VALUES ('How do I send invoices?', 'I created an invoice but not sure how to send it to my client.', 'normal', 'open');

SELECT 'Demo data loaded successfully! Plans: ' || COUNT(*) FROM plans;
