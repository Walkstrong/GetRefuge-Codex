-- Example org for local testing
INSERT INTO organizations (id, name)
VALUES ('550e8400-e29b-41d4-a716-446655440000', 'Example NGO');

-- Example user (placeholder auth user UUID)
INSERT INTO users (id, org_id, email, role)
VALUES ('12345678-1234-1234-1234-123456789abc', '550e8400-e29b-41d4-a716-446655440000', 'admin@example.org', 'admin');
