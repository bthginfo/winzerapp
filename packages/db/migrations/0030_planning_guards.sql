CREATE FUNCTION app.resource_plan_guard() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,app AS $$
BEGIN
 IF NEW.status IN ('planned','in_progress') AND NEW.resource_id IS NOT NULL AND EXISTS(SELECT 1 FROM app.resource_booking WHERE tenant_id=NEW.tenant_id AND resource_id=NEW.resource_id AND status IN ('planned','doing') AND starts_at<NEW.ends_at AND ends_at>NEW.starts_at) THEN PERFORM app.fail('RESOURCE_CONFLICT');END IF;RETURN NEW;
END $$;
CREATE TRIGGER resource_schedule_guard BEFORE INSERT OR UPDATE ON app.harvest_plan FOR EACH ROW EXECUTE FUNCTION app.resource_plan_guard();
CREATE FUNCTION app.booking_status_guard() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,app AS $$
BEGIN IF OLD.status IN ('done','cancelled') AND NEW.status<>OLD.status THEN PERFORM app.fail('ALREADY_COMPLETED');END IF;RETURN NEW;END $$;
CREATE TRIGGER completed_booking BEFORE UPDATE ON app.resource_booking FOR EACH ROW EXECUTE FUNCTION app.booking_status_guard();
