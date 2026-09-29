const assert = require('node:assert/strict');
const { after, before, test } = require('node:test');

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-for-api-tests';

const { app, initializeDatabase, pool } = require('./server');
let server;
let baseUrl;

before(async () => {
  server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  await new Promise((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  });
  await pool.end();
});

test('startup initialization creates every application table', async () => {
  const originalQuery = pool.query;
  const statements = [];
  pool.query = async (statement) => {
    statements.push(String(statement));
    return { rows: [], rowCount: 0 };
  };

  try {
    await initializeDatabase();
  } finally {
    pool.query = originalQuery;
  }

  for (const tableName of [
    'users',
    'password_reset_tokens',
    'budgets',
    'budget_invitations',
    'budget_history',
  ]) {
    assert.ok(
      statements.some((statement) => statement.includes(`CREATE TABLE IF NOT EXISTS ${tableName}`)),
      `startup should create ${tableName}`,
    );
  }
});

test('registration preflight allows the ngrok browser bypass header', async () => {
  const response = await fetch(`${baseUrl}/register`, {
    method: 'OPTIONS',
    headers: {
      Origin: 'http://localhost:8080',
      'Access-Control-Request-Method': 'POST',
      'Access-Control-Request-Headers': 'content-type,ngrok-skip-browser-warning',
    },
  });

  assert.equal(response.status, 204);
  assert.equal(response.headers.get('access-control-allow-origin'), 'http://localhost:8080');
  assert.match(response.headers.get('access-control-allow-headers'), /ngrok-skip-browser-warning/i);
});

test('budget endpoints reject requests without a JWT', async () => {
  const response = await fetch(`${baseUrl}/budgets`);
  assert.equal(response.status, 401);
});