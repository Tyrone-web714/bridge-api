INSERT INTO role_permissions (role, permission)
VALUES
  ('PLATFORM_ADMIN', 'ai.driver_copilot.use'),
  ('ORGANIZATION_ADMIN', 'ai.driver_copilot.use'),
  ('SUPERVISOR', 'ai.driver_copilot.use'),
  ('DRIVER', 'ai.driver_copilot.use')
ON CONFLICT (role, permission) DO NOTHING;
