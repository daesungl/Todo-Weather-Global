-- DELETE events on plan_members need REPLICA IDENTITY FULL so that
-- realtime filters (uid=eq.X, plan_id=eq.X) can match the deleted row.
-- Without this, kicked-member detection and owner member-list updates
-- rely solely on polling instead of realtime push.
ALTER TABLE plan_members REPLICA IDENTITY FULL;
