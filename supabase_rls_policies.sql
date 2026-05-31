-- ============================================================
-- InvoicePro — Row Level Security (RLS) Policies
-- Run this entire script in Supabase → SQL Editor → New Query
-- ============================================================
-- NOTE: The backend uses service_role key which BYPASSES RLS automatically.
-- These policies protect direct Supabase access (anon key, Supabase Studio,
-- or any future client-side queries). They do NOT affect backend functionality.
-- ============================================================

-- ── 1. PROFILES ──────────────────────────────────────────────
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;

CREATE POLICY "Users can view own profile" ON profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile" ON profiles
  FOR INSERT WITH CHECK (auth.uid() = id);


-- ── 2. CLIENTS ───────────────────────────────────────────────
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own clients" ON clients;
CREATE POLICY "Users manage own clients" ON clients
  FOR ALL USING (auth.uid() = user_id);


-- ── 3. INVOICES ──────────────────────────────────────────────
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own invoices" ON invoices;
CREATE POLICY "Users manage own invoices" ON invoices
  FOR ALL USING (auth.uid() = user_id);


-- ── 4. INVOICE ITEMS ─────────────────────────────────────────
ALTER TABLE invoice_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own invoice items" ON invoice_items;
CREATE POLICY "Users manage own invoice items" ON invoice_items
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM invoices
      WHERE invoices.id = invoice_items.invoice_id
        AND invoices.user_id = auth.uid()
    )
  );


-- ── 5. QUOTES ────────────────────────────────────────────────
ALTER TABLE quotes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own quotes" ON quotes;
CREATE POLICY "Users manage own quotes" ON quotes
  FOR ALL USING (auth.uid() = user_id);


-- ── 6. QUOTE ITEMS ───────────────────────────────────────────
ALTER TABLE quote_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own quote items" ON quote_items;
CREATE POLICY "Users manage own quote items" ON quote_items
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM quotes
      WHERE quotes.id = quote_items.quote_id
        AND quotes.user_id = auth.uid()
    )
  );


-- ── 7. PAYMENTS ──────────────────────────────────────────────
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own payments" ON payments;
CREATE POLICY "Users manage own payments" ON payments
  FOR ALL USING (auth.uid() = user_id);


-- ── 8. EXPENSES ──────────────────────────────────────────────
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own expenses" ON expenses;
CREATE POLICY "Users manage own expenses" ON expenses
  FOR ALL USING (auth.uid() = user_id);


-- ── 9. TIME ENTRIES ──────────────────────────────────────────
ALTER TABLE time_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own time entries" ON time_entries;
CREATE POLICY "Users manage own time entries" ON time_entries
  FOR ALL USING (auth.uid() = user_id);


-- ── 10. TEAM MEMBERS ─────────────────────────────────────────
ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Owners manage their team" ON team_members;
DROP POLICY IF EXISTS "Members can see their own record" ON team_members;

-- Business owner can see and manage all their team members
CREATE POLICY "Owners manage their team" ON team_members
  FOR ALL USING (auth.uid() = owner_id);

-- Team members can read their own membership record
CREATE POLICY "Members can see their own record" ON team_members
  FOR SELECT USING (auth.uid() = member_id);


-- ── 11. CLIENT PORTAL TOKENS ─────────────────────────────────
ALTER TABLE client_portal_tokens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own portal tokens" ON client_portal_tokens;
CREATE POLICY "Users manage own portal tokens" ON client_portal_tokens
  FOR ALL USING (auth.uid() = user_id);


-- ── 12. SATISFACTION SCORES ──────────────────────────────────
ALTER TABLE satisfaction_scores ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users view own satisfaction scores" ON satisfaction_scores;
CREATE POLICY "Users view own satisfaction scores" ON satisfaction_scores
  FOR ALL USING (auth.uid() = user_id);


-- ── 13. FINANCING APPLICATIONS ───────────────────────────────
ALTER TABLE financing_applications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own financing applications" ON financing_applications;
CREATE POLICY "Users manage own financing applications" ON financing_applications
  FOR ALL USING (auth.uid() = user_id);


-- ── 14. API KEYS ─────────────────────────────────────────────
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own api keys" ON api_keys;
CREATE POLICY "Users manage own api keys" ON api_keys
  FOR ALL USING (auth.uid() = user_id);


-- ── 15. WHITE LABEL SETTINGS ─────────────────────────────────
ALTER TABLE white_label_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own white label settings" ON white_label_settings;
CREATE POLICY "Users manage own white label settings" ON white_label_settings
  FOR ALL USING (auth.uid() = user_id);


-- ── 16. REMINDER LOGS ────────────────────────────────────────
ALTER TABLE reminder_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users view own reminder logs" ON reminder_logs;
CREATE POLICY "Users view own reminder logs" ON reminder_logs
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM invoices
      WHERE invoices.id = reminder_logs.invoice_id
        AND invoices.user_id = auth.uid()
    )
  );


-- ── 17. INVOICE VIEWS ────────────────────────────────────────
ALTER TABLE invoice_views ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users view own invoice view logs" ON invoice_views;
CREATE POLICY "Users view own invoice view logs" ON invoice_views
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM invoices
      WHERE invoices.id = invoice_views.invoice_id
        AND invoices.user_id = auth.uid()
    )
  );


-- ── 18. SUPPORT TICKETS ──────────────────────────────────────
ALTER TABLE support_tickets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own tickets" ON support_tickets;
CREATE POLICY "Users manage own tickets" ON support_tickets
  FOR ALL USING (auth.uid() = user_id);


-- ── 19. PLANS — public read, no user write ───────────────────
ALTER TABLE plans ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read plans" ON plans;
CREATE POLICY "Anyone can read plans" ON plans
  FOR SELECT USING (true);
-- Writes only via service_role (backend) — no user INSERT/UPDATE/DELETE policy


-- ── 20. PLAN REGIONAL PRICING — public read ──────────────────
ALTER TABLE plan_regional_pricing ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read regional pricing" ON plan_regional_pricing;
CREATE POLICY "Anyone can read regional pricing" ON plan_regional_pricing
  FOR SELECT USING (true);


-- ── 21. APP SETTINGS — public read ───────────────────────────
ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read app settings" ON app_settings;
CREATE POLICY "Anyone can read app settings" ON app_settings
  FOR SELECT USING (true);
-- Writes only via service_role (admin panel backend)


-- ── 22. ADMIN TABLES — service_role only ─────────────────────
-- admin_users and admin_audit_log should NEVER be accessible via anon/authenticated roles
ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;
-- No policies = no access for anon/authenticated. Only service_role can access.

ALTER TABLE admin_audit_log ENABLE ROW LEVEL SECURITY;
-- No policies = no access for anon/authenticated. Only service_role can access.


-- ── DONE ─────────────────────────────────────────────────────
-- Verify RLS is enabled on all tables:
SELECT schemaname, tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;
