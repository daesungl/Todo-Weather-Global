CREATE TABLE transfer_codes (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  code text UNIQUE NOT NULL,
  uid uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now() NOT NULL,
  expires_at timestamptz NOT NULL,
  used_at timestamptz
);

ALTER TABLE transfer_codes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users can read own codes" ON transfer_codes
  FOR SELECT TO authenticated USING (uid = auth.uid());
