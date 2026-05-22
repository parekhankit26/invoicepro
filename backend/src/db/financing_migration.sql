CREATE TABLE IF NOT EXISTS financing_applications (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  invoice_id UUID REFERENCES invoices(id) ON DELETE CASCADE NOT NULL,
  reference TEXT NOT NULL,
  -- Offer at time of application
  invoice_amount DECIMAL(12,2) NOT NULL,
  advance_percent DECIMAL(5,2) NOT NULL DEFAULT 90,
  gross_advance DECIMAL(12,2) NOT NULL,
  fee_percent DECIMAL(5,2) NOT NULL,
  fee_amount DECIMAL(12,2) NOT NULL,
  net_advance DECIMAL(12,2) NOT NULL,
  currency VARCHAR(3) NOT NULL DEFAULT 'GBP',
  -- Applicant bank details
  account_holder_name TEXT NOT NULL,
  bank_name TEXT NOT NULL,
  account_number TEXT NOT NULL,
  sort_code TEXT,
  contact_phone TEXT NOT NULL,
  business_registered_name TEXT,
  -- Status
  status TEXT NOT NULL DEFAULT 'pending',
  admin_notes TEXT,
  rejection_reason TEXT,
  -- Timestamps
  applied_at TIMESTAMPTZ DEFAULT NOW(),
  reviewed_at TIMESTAMPTZ,
  approved_at TIMESTAMPTZ,
  funded_at TIMESTAMPTZ,
  repaid_at TIMESTAMPTZ,
  rejected_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE financing_applications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users manage own financing" ON financing_applications;
CREATE POLICY "Users manage own financing" ON financing_applications FOR ALL USING (auth.uid() = user_id);
NOTIFY pgrst, 'reload schema';
