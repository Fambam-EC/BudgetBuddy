const assert = require('node:assert/strict');
const { after, before, test } = require('node:test');

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-for-api-tests';
process.env.MAILJET_API_KEY = process.env.MAILJET_API_KEY || 'test-api-key';
process.env.MAILJET_API_SECRET = process.env.MAILJET_API_SECRET || 'test-secret-key';
process.env.MAILJET_FROM_EMAIL = process.env.MAILJET_FROM_EMAIL || 'budgetbuddy@example.com';
process.env.BUDGET_INVITE_URL = process.env.BUDGET_INVITE_URL || 'https://example.com/invite';

const { app, initializeDatabase, pool, startServer } = require('./server');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
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

test('startServer initializes the database before binding the API to loopback', async () => {
  const originalQuery = pool.query;
  pool.query = async () => ({ rows: [], rowCount: 0 });

  let apiServer;
  try {
    apiServer = await startServer(0);
    await new Promise((resolve) => apiServer.once('listening', resolve));
    assert.equal(apiServer.address().address, '127.0.0.1');
  } finally {
    pool.query = originalQuery;
    if (apiServer) {
      await new Promise((resolve, reject) => {
        apiServer.close((error) => error ? reject(error) : resolve());
      });
    }
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

  assert.equal(response.status, 200);
  assert.equal(response.headers.get('access-control-allow-origin'), 'http://localhost:8080');
  assert.match(response.headers.get('access-control-allow-headers'), /ngrok-skip-browser-warning/i);
});

test('budget endpoints reject requests without a JWT', async () => {
  const response = await fetch(`${baseUrl}/budgets`);
  assert.equal(response.status, 401);
});

test('account deletion removes owned data and the account in one transaction', async () => {
  const originalQuery = pool.query;
  const originalConnect = pool.connect;
  const queries = [];
  pool.query = async () => ({ rows: [], rowCount: 0 });
  pool.connect = async () => ({
    query: async (statement, parameters) => {
      const query = String(statement).trim();
      queries.push({ query, parameters });
      if (query.startsWith('DELETE FROM users')) {
        return { rows: [{ email: 'person@example.com' }], rowCount: 1 };
      }
      return { rows: [], rowCount: 1 };
    },
    release: () => {},
  });

  try {
    const token = jwt.sign({ sub: 'Person@Example.com' }, process.env.JWT_SECRET);
    const response = await fetch(`${baseUrl}/account`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });

    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { message: 'Account deleted' });
    assert.equal(queries[0].query, 'BEGIN');
    assert.match(queries[1].query, /DELETE FROM budgets WHERE LOWER\(owner_email\) = \$1/);
    assert.match(queries[2].query, /DELETE FROM budget_history WHERE LOWER\(owner_email\) = \$1/);
    assert.match(queries[3].query, /DELETE FROM budget_invitations WHERE LOWER\(email\) = \$1/);
    assert.match(queries[4].query, /DELETE FROM password_reset_tokens WHERE LOWER\(email\) = \$1/);
    assert.match(queries[5].query, /DELETE FROM users WHERE LOWER\(email\) = \$1 RETURNING email/);
    assert.ok(queries.slice(1, 6).every(({ parameters }) => parameters[0] === 'person@example.com'));
    assert.equal(queries[6].query, 'COMMIT');
  } finally {
    pool.query = originalQuery;
    pool.connect = originalConnect;
  }
});

test('account deletion rolls back when the account is not found', async () => {
  const originalQuery = pool.query;
  const originalConnect = pool.connect;
  const queries = [];
  pool.query = async () => ({ rows: [], rowCount: 0 });
  pool.connect = async () => ({
    query: async (statement) => {
      const query = String(statement).trim();
      queries.push(query);
      return { rows: [], rowCount: query.startsWith('DELETE FROM users') ? 0 : 1 };
    },
    release: () => {},
  });

  try {
    const token = jwt.sign({ sub: 'person@example.com' }, process.env.JWT_SECRET);
    const response = await fetch(`${baseUrl}/account`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });

    assert.equal(response.status, 404);
    assert.deepEqual(await response.json(), { error: 'Account not found' });
    assert.equal(queries.at(-1), 'ROLLBACK');
  } finally {
    pool.query = originalQuery;
    pool.connect = originalConnect;
  }
});

test('password reset consumes a valid token and updates the password in one transaction', async () => {
  const originalQuery = pool.query;
  const originalConnect = pool.connect;
  const queries = [];
  pool.query = async () => ({ rows: [], rowCount: 0 });
  pool.connect = async () => ({
    query: async (statement, parameters) => {
      const query = String(statement).trim();
      queries.push({ query, parameters });
      if (query.startsWith('DELETE FROM password_reset_tokens')) {
        return { rows: [{ email: 'person@example.com' }], rowCount: 1 };
      }
      if (query.startsWith('UPDATE users SET password_hash')) {
        return { rows: [], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    },
    release: () => {},
  });

  try {
    const response = await fetch(`${baseUrl}/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'Person@Example.com',
        token: 'a'.repeat(64),
        password: 'new-password',
      }),
    });

    assert.equal(response.status, 200);
    assert.equal((await response.json()).message, 'Password has been reset successfully');
    assert.equal(queries[0].query, 'BEGIN');
    assert.match(queries[1].query, /DELETE FROM password_reset_tokens/);
    assert.equal(queries[1].parameters[1], 'person@example.com');
    assert.match(queries[2].query, /UPDATE users SET password_hash/);
    assert.equal(queries[2].parameters[1], 'person@example.com');
    assert.equal(queries[3].query, 'COMMIT');
  } finally {
    pool.query = originalQuery;
    pool.connect = originalConnect;
  }
});

test('password reset rejects expired or already-used tokens without changing a password', async () => {
  const originalQuery = pool.query;
  const originalConnect = pool.connect;
  const queries = [];
  pool.query = async () => ({ rows: [], rowCount: 0 });
  pool.connect = async () => ({
    query: async (statement) => {
      const query = String(statement).trim();
      queries.push(query);
      return { rows: [], rowCount: 0 };
    },
    release: () => {},
  });

  try {
    const response = await fetch(`${baseUrl}/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'person@example.com',
        token: 'b'.repeat(64),
        password: 'new-password',
      }),
    });

    assert.equal(response.status, 400);
    assert.deepEqual(await response.json(), {
      error: 'Invalid or expired password reset link',
    });
    assert.equal(queries[0], 'BEGIN');
    assert.match(queries[1], /DELETE FROM password_reset_tokens/);
    assert.equal(queries[2], 'ROLLBACK');
  } finally {
    pool.query = originalQuery;
    pool.connect = originalConnect;
  }
});

test('budget invitation is committed before its email is sent', async () => {
  const originalQuery = pool.query;
  const originalConnect = pool.connect;
  const originalCreateTransport = nodemailer.createTransport;
  const events = [];
  pool.query = async (statement) => {
    if (String(statement).includes('SELECT name, owner_email FROM budgets')) {
      return {
        rows: [{ name: 'Household', owner_email: 'owner@example.com' }],
        rowCount: 1,
      };
    }
    return { rows: [], rowCount: 0 };
  };
  pool.connect = async () => ({
    query: async (statement) => {
      const query = String(statement).trim();
      if (query === 'BEGIN' || query === 'COMMIT' || query === 'ROLLBACK') {
        events.push(query);
      } else if (query.startsWith('INSERT INTO budget_invitations')) {
        events.push('INSERT');
        return {
          rows: [{ id: 1, email: 'recipient@example.com', budgetId: 'budget-1', budgetName: 'Household' }],
          rowCount: 1,
        };
      }
      return { rows: [], rowCount: 0 };
    },
    release: () => {},
  });
  nodemailer.createTransport = (options) => {
    assert.equal(options.host, 'in-v3.mailjet.com');
    assert.equal(options.port, 587);
    assert.equal(options.secure, false);
    assert.equal(options.requireTLS, true);
    assert.equal(options.auth.user, 'test-api-key');
    assert.equal(options.auth.pass, 'test-secret-key');
    return {
      sendMail: async (message) => {
        events.push('EMAIL');
        assert.equal(message.to, 'recipient@example.com');
        assert.equal(message.from.address, 'budgetbuddy@example.com');
      },
    };
  };

  try {
    const token = jwt.sign({ sub: 'owner@example.com' }, process.env.JWT_SECRET);
    const response = await fetch(`${baseUrl}/share`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email: 'recipient@example.com', budgetId: 'budget-1' }),
    });

    assert.equal(response.status, 201);
    const commitIndex = events.indexOf('COMMIT');
    const emailIndex = events.indexOf('EMAIL');
    assert.notEqual(commitIndex, -1);
    assert.notEqual(emailIndex, -1);
    assert.ok(commitIndex < emailIndex);
  } finally {
    pool.query = originalQuery;
    pool.connect = originalConnect;
    nodemailer.createTransport = originalCreateTransport;
  }
});