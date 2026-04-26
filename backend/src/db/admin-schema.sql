-- InvoicePro Admin Schema — Run this SECOND in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS plans (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name TEXT NOT NULL, slug TEXT UNIQUE NOT NULL,
  price_monthly DECIMAL(10,2) DEFAULT 0, price_yearly DECIMAL(10,2) DEFAULT 0,
  currency TEXT DEFAULT 'GBP', max_invoices INTEGER DEFAULT 5,
  max_clients INTEGER DEFAULT 2, max_team_members INTEGER DEFAULT 1,
  features JSONB DEFAULT '[]', is_active BOOLEAN DEFAULT TRUE,
  is_featured BOOLEAN DEFAULT FALSE, stripe_price_id_monthly TEXT,
  stripe_price_id_yearly TEXT, sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS app_settings (
  key TEXT PRIMARY KEY, value JSONB NOT NULL,
  label TEXT, category TEXT DEFAULT 'general', updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS currencies (
  code TEXT PRIMARY KEY, name TEXT NOT NULL, symbol TEXT NOT NULL,
  decimal_places INTEGER DEFAULT 2, is_active BOOLEAN DEFAULT TRUE, sort_order INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS admin_users (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  email TEXT UNIQUE NOT NULL, password_hash TEXT NOT NULL, full_name TEXT,
  role TEXT DEFAULT 'admin' CHECK (role IN ('super_admin','admin','support')),
  last_login TIMESTAMPTZ, is_active BOOLEAN DEFAULT TRUE, created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_subscriptions (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  plan_id UUID REFERENCES plans(id) NOT NULL,
  status TEXT DEFAULT 'active', billing_period TEXT DEFAULT 'monthly',
  current_period_start TIMESTAMPTZ DEFAULT NOW(), current_period_end TIMESTAMPTZ,
  stripe_subscription_id TEXT, stripe_customer_id TEXT,
  cancelled_at TIMESTAMPTZ, trial_ends_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS support_tickets (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  subject TEXT NOT NULL, message TEXT NOT NULL,
  status TEXT DEFAULT 'open', priority TEXT DEFAULT 'normal',
  admin_reply TEXT, replied_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS admin_audit_log (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  admin_id UUID REFERENCES admin_users(id),
  action TEXT NOT NULL, entity_type TEXT, entity_id TEXT,
  old_value JSONB, new_value JSONB, ip_address TEXT, created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed plans
INSERT INTO plans (name,slug,price_monthly,price_yearly,max_invoices,max_clients,max_team_members,features,is_active,is_featured,sort_order) VALUES
('Free','free',0,0,5,2,1,'["PDF export","Email support","Basic dashboard"]',true,false,1),
('Starter','starter',9,86,50,20,1,'["50 invoices/mo","20 clients","Stripe payments","Email reminders","Multi-currency"]',true,false,2),
('Pro','pro',19,182,-1,-1,3,'["Unlimited invoices","Unlimited clients","Recurring invoices","Expense tracking","P&L reports","Team members (3)","Time tracking","Quotes"]',true,true,3),
('Enterprise','enterprise',49,470,-1,-1,-1,'["Everything in Pro","Unlimited team","White-label","API access","Custom domain","Xero export","Priority support","SLA"]',true,false,4)
ON CONFLICT (slug) DO NOTHING;

-- Seed currencies
INSERT INTO currencies (code,name,symbol,decimal_places,is_active,sort_order) VALUES
('GBP','British Pound','£',2,true,1),('USD','US Dollar','$',2,true,2),('EUR','Euro','€',2,true,3),
('CAD','Canadian Dollar','C$',2,true,4),('AUD','Australian Dollar','A$',2,true,5),
('CHF','Swiss Franc','Fr',2,true,6),('JPY','Japanese Yen','¥',0,true,7),
('CNY','Chinese Yuan','¥',2,true,8),('INR','Indian Rupee','₹',2,true,9),
('BRL','Brazilian Real','R$',2,true,10),('MXN','Mexican Peso','$',2,true,11),
('SGD','Singapore Dollar','S$',2,true,12),('HKD','Hong Kong Dollar','HK$',2,true,13),
('NOK','Norwegian Krone','kr',2,true,14),('SEK','Swedish Krona','kr',2,true,15),
('DKK','Danish Krone','kr',2,true,16),('NZD','New Zealand Dollar','NZ$',2,true,17),
('ZAR','South African Rand','R',2,true,18),('AED','UAE Dirham','د.إ',2,true,19),
('SAR','Saudi Riyal','﷼',2,true,20),('TRY','Turkish Lira','₺',2,true,21),
('PLN','Polish Zloty','zł',2,true,22),('CZK','Czech Koruna','Kč',2,true,23),
('HUF','Hungarian Forint','Ft',0,true,24),('PHP','Philippine Peso','₱',2,true,25),
('THB','Thai Baht','฿',2,true,26),('MYR','Malaysian Ringgit','RM',2,true,27),
('IDR','Indonesian Rupiah','Rp',0,true,28),('AED','UAE Dirham','د.إ',2,true,29)
ON CONFLICT (code) DO NOTHING;

-- Seed app settings
INSERT INTO app_settings (key,value,label,category) VALUES
('app_name','"InvoicePro"','Application name','branding'),
('app_tagline','"Smart invoicing for small business"','Tagline','branding'),
('app_logo_url','null','Logo URL','branding'),
('primary_color','"#1a1814"','Primary colour','branding'),
('accent_color','"#22c55e"','Accent colour','branding'),
('support_email','"support@invoicepro.com"','Support email','general'),
('default_currency','"GBP"','Default currency','general'),
('default_tax_rate','20','Default tax rate (%)','general'),
('default_payment_terms','30','Default payment terms (days)','general'),
('trial_days','14','Free trial days','billing'),
('invoice_number_prefix','"INV"','Invoice number prefix','invoicing'),
('maintenance_mode','false','Maintenance mode','general'),
('allow_registration','true','Allow new registrations','general')
ON CONFLICT (key) DO NOTHING;

-- RLS
ALTER TABLE plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE currencies ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE support_tickets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "read active plans" ON plans FOR SELECT USING (is_active = true);
CREATE POLICY "read active currencies" ON currencies FOR SELECT USING (is_active = true);
CREATE POLICY "read settings" ON app_settings FOR SELECT USING (true);
CREATE POLICY "own subscription" ON user_subscriptions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own tickets" ON support_tickets FOR ALL USING (auth.uid() = user_id);
