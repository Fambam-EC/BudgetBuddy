const assert = require('node:assert/strict');
const { after, before, test } = require('node:test');

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-for-api-tests';
process.env.SMTP_HOST = process.env.SMTP_HOST || 'smtp.test';
process.env.SMTP_FROM = process.env.SMTP_FROM || 'budgetbuddy@example.com';
process.env.BUDGET_INVITE_URL = process.env.BUDGET_INVITE_URL || 'https://example.com/invite';

const nodemailer = require('nodemailer');
const originalCreateTransport = nodemailer.createTransport;
const mailTransporter = { sendMail: async () => ({}) };
nodemailer.createTransport = () => mailTransporter;
const { app, initializeDatabase, pool } = require('./server');
nodemailer.createTransport = originalCreateTransport;
const jwt = require('jsonwebtoken');
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

  assert.equal(response.status, 200);
  assert.equal(response.headers.get('access-control-allow-origin'), 'http://localhost:8080');
  assert.match(response.headers.get('access-control-allow-headers'), /ngrok-skip-browser-warning/i);
});

test('budget endpoints reject requests without a JWT', async () => {
  const response = await fetch(`${baseUrl}/budgets`);
  assert.equal(response.status, 401);
});

test('budget invitation is committed before its email is sent', async () => {
  const originalQuery = pool.query;
  const originalConnect = pool.connect;
  const originalSendMail = mailTransporter.sendMail;
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
  mailTransporter.sendMail = async () => {
    events.push('EMAIL');
    return {};
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
    mailTransporter.sendMail = originalSendMail;
  }
});