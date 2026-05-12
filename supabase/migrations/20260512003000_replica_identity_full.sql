-- Supabase Realtime DELETE events only include the primary key by default.
-- Filters like `plan_id=eq.X` cannot match DELETE events unless the old row
-- includes all columns. REPLICA IDENTITY FULL fixes this.
ALTER TABLE plan_comments REPLICA IDENTITY FULL;
ALTER TABLE plan_steps REPLICA IDENTITY FULL;
