-- Add invoice_template column to profiles (run once in Supabase SQL Editor)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS invoice_template TEXT;
