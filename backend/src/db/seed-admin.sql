-- ── PLANS ─────────────────────────────────────────────────
INSERT INTO plans (name, slug, price_monthly, price_yearly, max_invoices, max_clients, max_team_members, features, is_active, is_featured, sort_order) VALUES
('Free', 'free', 0, 0, 5, 3, 0, '["5 invoices","3 clients","Basic reports"]', true, false, 1),
('Starter', 'starter', 9, 90, 50, 20, 1, '["50 invoices","20 clients","Email reminders","PDF export","Early payment discount","Receipt scanner"]', true, false, 2),
('Pro', 'pro', 19, 190, -1, -1, 3, '["Unlimited invoices","Unlimited clients","AI assistant","WhatsApp reminders","Cash flow forecast","Client happiness","Invoice financing","Milestone billing","Time tracking","Recurring invoices","3 team members"]', true, true, 3),
('Enterprise', 'enterprise', 49, 490, -1, -1, -1, '["Everything in Pro","White label","API access","Xero/QuickBooks export","Unlimited team members","Priority support","Custom domain"]', true, false, 4)
ON CONFLICT (slug) DO UPDATE SET price_monthly = EXCLUDED.price_monthly, price_yearly = EXCLUDED.price_yearly;

-- ── CURRENCIES ─────────────────────────────────────────────
INSERT INTO currencies (code, name, symbol, is_active, sort_order) VALUES
('GBP', 'British Pound', '£', true, 1),
('USD', 'US Dollar', '$', true, 2),
('EUR', 'Euro', '€', true, 3),
('CAD', 'Canadian Dollar', 'C$', true, 4),
('AUD', 'Australian Dollar', 'A$', true, 5),
('CHF', 'Swiss Franc', 'Fr', true, 6),
('JPY', 'Japanese Yen', '¥', true, 7),
('INR', 'Indian Rupee', '₹', true, 8),
('AED', 'UAE Dirham', 'د.إ', true, 9),
('SGD', 'Singapore Dollar', 'S$', true, 10),
('NOK', 'Norwegian Krone', 'kr', true, 11),
('SEK', 'Swedish Krona', 'kr', true, 12),
('DKK', 'Danish Krone', 'kr', true, 13),
('NZD', 'New Zealand Dollar', 'NZ$', true, 14),
('ZAR', 'South African Rand', 'R', true, 15),
('MXN', 'Mexican Peso', '$', false, 16),
('BRL', 'Brazilian Real', 'R$', false, 17),
('HKD', 'Hong Kong Dollar', 'HK$', true, 18)
ON CONFLICT (code) DO NOTHING;

-- ── APP SETTINGS ───────────────────────────────────────────
INSERT INTO app_settings (key, value, category, label) VALUES
('feature_ai_assistant', 'true', 'features', 'AI Invoice Assistant'),
('feature_whatsapp_sms', 'true', 'features', 'WhatsApp & SMS Reminders'),
('feature_receipt_scanner', 'true', 'features', 'AI Receipt Scanner'),
('feature_cashflow_forecast', 'true', 'features', 'Cash Flow Forecast'),
('feature_invoice_designer', 'true', 'features', 'Invoice Template Designer'),
('feature_client_happiness', 'true', 'features', 'Client Happiness Score'),
('feature_financing', 'true', 'features', 'Invoice Financing'),
('feature_milestones', 'true', 'features', 'Milestone Billing'),
('feature_early_payment', 'true', 'features', 'Early Payment Discount'),
('feature_view_tracking', 'true', 'features', 'Invoice View Tracking'),
('feature_year_review', 'true', 'features', 'Year in Review'),
('feature_time_tracking', 'true', 'features', 'Time Tracking'),
('feature_recurring', 'true', 'features', 'Recurring Invoices'),
('feature_xero_export', 'true', 'features', 'Xero/QuickBooks Export'),
('feature_white_label', 'true', 'features', 'White Label Branding'),
('feature_api_access', 'true', 'features', 'API Access'),
('app_name', '"InvoicePro"', 'general', 'App Name'),
('app_maintenance', 'false', 'general', 'Maintenance Mode'),
('allow_registration', 'true', 'general', 'Allow New Registrations'),
('default_currency', '"GBP"', 'general', 'Default Currency'),
('default_tax_rate', '20', 'general', 'Default Tax Rate (%)'),
('support_email', '"support@invoicepro.com"', 'general', 'Support Email')
ON CONFLICT (key) DO NOTHING;
