CREATE FUNCTION notify_pre_approval() RETURNS trigger AS $$
DECLARE
  target_id uuid;
BEGIN
  IF TG_TABLE_NAME = 'pre_approval' THEN
    target_id := NEW.id;
  ELSE
    target_id := NEW.pre_approval_id;
  END IF;
  PERFORM pg_notify('pre_approval_' || target_id::text, NEW.status::text);
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER lender_result_notify
  AFTER UPDATE OF status ON lender_result
  FOR EACH ROW EXECUTE FUNCTION notify_pre_approval();
--> statement-breakpoint
CREATE TRIGGER pre_approval_notify
  AFTER UPDATE OF status ON pre_approval
  FOR EACH ROW EXECUTE FUNCTION notify_pre_approval();
