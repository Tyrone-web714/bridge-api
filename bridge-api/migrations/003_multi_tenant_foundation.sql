CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS organizations (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS tenant_backfill_exceptions (
  id BIGSERIAL PRIMARY KEY,
  table_name TEXT NOT NULL,
  record_identifier TEXT NOT NULL,
  reason TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO organizations (id, name, slug, status)
VALUES (
  '00000000-0000-4000-8000-000000000001',
  'Truck-Safe Routing Development',
  'truck-safe-routing-development',
  'active'
)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  slug = EXCLUDED.slug,
  status = EXCLUDED.status,
  updated_at = NOW();

ALTER TABLE admin_users
  ADD COLUMN IF NOT EXISTS organization_id TEXT REFERENCES organizations(id);

ALTER TABLE audit_events
  ADD COLUMN IF NOT EXISTS organization_id TEXT REFERENCES organizations(id);

ALTER TABLE drivers
  ADD COLUMN IF NOT EXISTS organization_id TEXT REFERENCES organizations(id),
  ADD COLUMN IF NOT EXISTS internal_driver_id TEXT,
  ADD COLUMN IF NOT EXISTS company_driver_number TEXT;

ALTER TABLE driver_sessions
  ADD COLUMN IF NOT EXISTS organization_id TEXT REFERENCES organizations(id),
  ADD COLUMN IF NOT EXISTS internal_driver_id TEXT;

ALTER TABLE warehouse_employees
  ADD COLUMN IF NOT EXISTS organization_id TEXT REFERENCES organizations(id),
  ADD COLUMN IF NOT EXISTS company_employee_id TEXT;

ALTER TABLE delivery_notes
  ADD COLUMN IF NOT EXISTS organization_id TEXT REFERENCES organizations(id);

ALTER TABLE recent_destinations
  ADD COLUMN IF NOT EXISTS organization_id TEXT REFERENCES organizations(id);

ALTER TABLE route_sessions
  ADD COLUMN IF NOT EXISTS organization_id TEXT REFERENCES organizations(id);

ALTER TABLE route_session_events
  ADD COLUMN IF NOT EXISTS organization_id TEXT REFERENCES organizations(id);

ALTER TABLE daily_route_manifests
  ADD COLUMN IF NOT EXISTS organization_id TEXT REFERENCES organizations(id);

ALTER TABLE daily_route_stops
  ADD COLUMN IF NOT EXISTS organization_id TEXT REFERENCES organizations(id);

ALTER TABLE customer_accounts
  ADD COLUMN IF NOT EXISTS organization_id TEXT REFERENCES organizations(id);

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS organization_id TEXT REFERENCES organizations(id);

ALTER TABLE product_barcodes
  ADD COLUMN IF NOT EXISTS organization_id TEXT REFERENCES organizations(id);

ALTER TABLE route_truck_inventory_additions
  ADD COLUMN IF NOT EXISTS organization_id TEXT REFERENCES organizations(id);

ALTER TABLE route_truck_inventory_allocations
  ADD COLUMN IF NOT EXISTS organization_id TEXT REFERENCES organizations(id);

ALTER TABLE route_departure_inventory_confirmations
  ADD COLUMN IF NOT EXISTS organization_id TEXT REFERENCES organizations(id);

ALTER TABLE account_orders
  ADD COLUMN IF NOT EXISTS organization_id TEXT REFERENCES organizations(id);

ALTER TABLE account_order_items
  ADD COLUMN IF NOT EXISTS organization_id TEXT REFERENCES organizations(id);

ALTER TABLE delivery_deductions
  ADD COLUMN IF NOT EXISTS organization_id TEXT REFERENCES organizations(id);

ALTER TABLE delivery_settlements
  ADD COLUMN IF NOT EXISTS organization_id TEXT REFERENCES organizations(id);

ALTER TABLE delivery_settlement_items
  ADD COLUMN IF NOT EXISTS organization_id TEXT REFERENCES organizations(id);

ALTER TABLE delivery_documents
  ADD COLUMN IF NOT EXISTS organization_id TEXT REFERENCES organizations(id);

ALTER TABLE route_closeout_documents
  ADD COLUMN IF NOT EXISTS organization_id TEXT REFERENCES organizations(id);

ALTER TABLE route_inventory_closeouts
  ADD COLUMN IF NOT EXISTS organization_id TEXT REFERENCES organizations(id);

ALTER TABLE account_ai_insights
  ADD COLUMN IF NOT EXISTS organization_id TEXT REFERENCES organizations(id);

ALTER TABLE data_import_batches
  ADD COLUMN IF NOT EXISTS organization_id TEXT REFERENCES organizations(id);

ALTER TABLE ai_interaction_logs
  ADD COLUMN IF NOT EXISTS organization_id TEXT REFERENCES organizations(id);

ALTER TABLE prediction_runs
  ADD COLUMN IF NOT EXISTS organization_id TEXT REFERENCES organizations(id);

ALTER TABLE supervisor_alerts
  ADD COLUMN IF NOT EXISTS organization_id TEXT REFERENCES organizations(id);

ALTER TABLE scheduled_report_schedules
  ADD COLUMN IF NOT EXISTS organization_id TEXT REFERENCES organizations(id);

ALTER TABLE scheduled_reports
  ADD COLUMN IF NOT EXISTS organization_id TEXT REFERENCES organizations(id);

UPDATE admin_users SET organization_id = '00000000-0000-4000-8000-000000000001' WHERE organization_id IS NULL;
UPDATE audit_events SET organization_id = '00000000-0000-4000-8000-000000000001' WHERE organization_id IS NULL;
UPDATE drivers
SET
  organization_id = COALESCE(organization_id, '00000000-0000-4000-8000-000000000001'),
  internal_driver_id = COALESCE(internal_driver_id, gen_random_uuid()::text),
  company_driver_number = COALESCE(company_driver_number, driver_id)
WHERE organization_id IS NULL OR internal_driver_id IS NULL OR company_driver_number IS NULL;
UPDATE driver_sessions AS session
SET
  organization_id = COALESCE(session.organization_id, driver.organization_id),
  internal_driver_id = COALESCE(session.internal_driver_id, driver.internal_driver_id)
FROM drivers AS driver
WHERE session.driver_id = driver.driver_id
  AND (session.organization_id IS NULL OR session.internal_driver_id IS NULL);
UPDATE warehouse_employees
SET
  organization_id = COALESCE(organization_id, '00000000-0000-4000-8000-000000000001'),
  company_employee_id = COALESCE(company_employee_id, employee_id)
WHERE organization_id IS NULL OR company_employee_id IS NULL;
UPDATE delivery_notes SET organization_id = '00000000-0000-4000-8000-000000000001' WHERE organization_id IS NULL;
UPDATE recent_destinations SET organization_id = '00000000-0000-4000-8000-000000000001' WHERE organization_id IS NULL;
UPDATE route_sessions SET organization_id = '00000000-0000-4000-8000-000000000001' WHERE organization_id IS NULL;
UPDATE route_session_events SET organization_id = '00000000-0000-4000-8000-000000000001' WHERE organization_id IS NULL;
UPDATE daily_route_manifests SET organization_id = '00000000-0000-4000-8000-000000000001' WHERE organization_id IS NULL;
UPDATE daily_route_stops AS stop SET organization_id = manifest.organization_id FROM daily_route_manifests AS manifest WHERE stop.manifest_id = manifest.id AND stop.organization_id IS NULL;
UPDATE customer_accounts SET organization_id = '00000000-0000-4000-8000-000000000001' WHERE organization_id IS NULL;
UPDATE products SET organization_id = '00000000-0000-4000-8000-000000000001' WHERE organization_id IS NULL;
UPDATE product_barcodes SET organization_id = '00000000-0000-4000-8000-000000000001' WHERE organization_id IS NULL;
UPDATE route_truck_inventory_additions SET organization_id = '00000000-0000-4000-8000-000000000001' WHERE organization_id IS NULL;
UPDATE route_truck_inventory_allocations SET organization_id = '00000000-0000-4000-8000-000000000001' WHERE organization_id IS NULL;
UPDATE route_departure_inventory_confirmations SET organization_id = '00000000-0000-4000-8000-000000000001' WHERE organization_id IS NULL;
UPDATE account_orders SET organization_id = '00000000-0000-4000-8000-000000000001' WHERE organization_id IS NULL;
UPDATE account_order_items AS item SET organization_id = orders.organization_id FROM account_orders AS orders WHERE item.order_id = orders.id AND item.organization_id IS NULL;
UPDATE delivery_deductions SET organization_id = '00000000-0000-4000-8000-000000000001' WHERE organization_id IS NULL;
UPDATE delivery_settlements SET organization_id = '00000000-0000-4000-8000-000000000001' WHERE organization_id IS NULL;
UPDATE delivery_settlement_items AS item SET organization_id = settlement.organization_id FROM delivery_settlements AS settlement WHERE item.settlement_id = settlement.id AND item.organization_id IS NULL;
UPDATE delivery_documents SET organization_id = '00000000-0000-4000-8000-000000000001' WHERE organization_id IS NULL;
UPDATE route_closeout_documents SET organization_id = '00000000-0000-4000-8000-000000000001' WHERE organization_id IS NULL;
UPDATE route_inventory_closeouts SET organization_id = '00000000-0000-4000-8000-000000000001' WHERE organization_id IS NULL;
UPDATE account_ai_insights SET organization_id = '00000000-0000-4000-8000-000000000001' WHERE organization_id IS NULL;
UPDATE data_import_batches SET organization_id = '00000000-0000-4000-8000-000000000001' WHERE organization_id IS NULL;
UPDATE ai_interaction_logs SET organization_id = '00000000-0000-4000-8000-000000000001' WHERE organization_id IS NULL;
UPDATE prediction_runs SET organization_id = '00000000-0000-4000-8000-000000000001' WHERE organization_id IS NULL;
UPDATE supervisor_alerts SET organization_id = '00000000-0000-4000-8000-000000000001' WHERE organization_id IS NULL;
UPDATE scheduled_report_schedules SET organization_id = '00000000-0000-4000-8000-000000000001' WHERE organization_id IS NULL;
UPDATE scheduled_reports SET organization_id = '00000000-0000-4000-8000-000000000001' WHERE organization_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS drivers_internal_driver_id_unique_idx
  ON drivers(internal_driver_id)
  WHERE internal_driver_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS drivers_org_company_driver_number_unique_idx
  ON drivers(organization_id, LOWER(company_driver_number))
  WHERE organization_id IS NOT NULL AND company_driver_number IS NOT NULL;

CREATE INDEX IF NOT EXISTS admin_users_organization_idx ON admin_users(organization_id);
CREATE INDEX IF NOT EXISTS audit_events_organization_idx ON audit_events(organization_id);
CREATE INDEX IF NOT EXISTS drivers_organization_idx ON drivers(organization_id);
CREATE INDEX IF NOT EXISTS driver_sessions_organization_idx ON driver_sessions(organization_id);
CREATE INDEX IF NOT EXISTS warehouse_employees_organization_idx ON warehouse_employees(organization_id);
CREATE INDEX IF NOT EXISTS delivery_notes_organization_idx ON delivery_notes(organization_id);
CREATE INDEX IF NOT EXISTS recent_destinations_organization_idx ON recent_destinations(organization_id);
CREATE INDEX IF NOT EXISTS route_sessions_organization_idx ON route_sessions(organization_id);
CREATE INDEX IF NOT EXISTS daily_route_manifests_organization_idx ON daily_route_manifests(organization_id);
CREATE INDEX IF NOT EXISTS daily_route_stops_organization_idx ON daily_route_stops(organization_id);
CREATE INDEX IF NOT EXISTS customer_accounts_organization_idx ON customer_accounts(organization_id);
CREATE INDEX IF NOT EXISTS products_organization_idx ON products(organization_id);
CREATE INDEX IF NOT EXISTS account_orders_organization_idx ON account_orders(organization_id);
CREATE INDEX IF NOT EXISTS delivery_documents_organization_idx ON delivery_documents(organization_id);
CREATE INDEX IF NOT EXISTS route_inventory_closeouts_organization_idx ON route_inventory_closeouts(organization_id);
CREATE INDEX IF NOT EXISTS account_ai_insights_organization_idx ON account_ai_insights(organization_id);
CREATE INDEX IF NOT EXISTS supervisor_alerts_organization_idx ON supervisor_alerts(organization_id);
