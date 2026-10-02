const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const app = express();

const configuredCorsOrigins = (process.env.CORS_ORIGINS || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

const defaultCorsOrigins = [
  'https://api.budgetbuddy.me',
];

const corsOptions = {
  origin(origin, callback) {
    // Native clients do not send an Origin header; browser clients do.
    if (!origin) {
      return callback(null, true);
    }

    const isAllowed =
      [...defaultCorsOrigins, ...configuredCorsOrigins].includes(origin) ||
      /^http:\/\/localhost(?::\d+)?$/i.test(origin) ||
      /^http:\/\/127\.0\.0\.1(?::\d+)?$/i.test(origin) ||
      /^http:\/\/192\.168\.0\.146(?::\d+)?$/i.test(origin);

    return callback(isAllowed ? null : new Error('Origin is not allowed by CORS'), isAllowed);
  },
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    'Accept',
    'Content-Type',
    'Authorization',
    'Access-Control-Allow-Origin',
  ],
  optionsSuccessStatus: 200,
};

const SALT_ROUNDS = 10;

app.use(cors(corsOptions));
app.use(express.json()); // Parses incoming JSON payloads

// Configure PostgreSQL client pool
const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || '127.0.0.1',
  password: process.env.DB_PASSWORD || 'superuser',
  database: process.env.DB_NAME || 'budgetbuddy',
  port: Number(process.env.DB_PORT) || 5432,
});

const resetTokenLifetimeMinutes = 30;
const passwordResetUrl = process.env.PASSWORD_RESET_URL;
const budgetInviteUrl = process.env.BUDGET_INVITE_URL;

const isEmailConfigured = () =>
  Boolean(
    process.env.RESEND_API_KEY &&
    process.env.RESEND_FROM_EMAIL,
  );

async function sendEmail({ to, subject, text, html }) {
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: `${process.env.RESEND_FROM_NAME || 'BudgetBuddy'} <${process.env.RESEND_FROM_EMAIL}>`,
      to: [to],
      subject,
      text,
      html,
    }),
  });

  if (!response.ok) {
    const responseBody = await response.text();
    throw new Error(`Resend email request failed (${response.status}): ${responseBody}`);
  }
}

const hashResetToken = (token) =>
  crypto.createHash('sha256').update(token).digest('hex');

const isValidEmail = (email) =>
  typeof email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

const escapeHtml = (value) =>
  value.replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[character]);

async function ensurePasswordResetTokensTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS password_reset_tokens (
      token_hash TEXT PRIMARY KEY,
      email TEXT NOT NULL,
      expires_at TIMESTAMPTZ NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
}

async function ensureUsersTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      email TEXT PRIMARY KEY,
      password_hash TEXT NOT NULL
    )
  `);
}

async function ensureBudgetTables() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS budgets (
      budget_id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      owner_email TEXT,
      budget_items JSONB NOT NULL DEFAULT '[]'::jsonb,
      is_archived BOOLEAN NOT NULL DEFAULT FALSE,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await pool.query(`
    ALTER TABLE budgets ADD COLUMN IF NOT EXISTS owner_email TEXT
  `);
  await pool.query(`
    ALTER TABLE budgets ADD COLUMN IF NOT EXISTS is_archived BOOLEAN NOT NULL DEFAULT FALSE
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS budget_invitations (
      id BIGSERIAL PRIMARY KEY,
      email TEXT NOT NULL,
      budget_id TEXT NOT NULL REFERENCES budgets(budget_id) ON DELETE CASCADE,
      budget_name TEXT NOT NULL,
      invitation_status TEXT NOT NULL DEFAULT 'pending',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await pool.query(`
    CREATE INDEX IF NOT EXISTS budget_invitations_email_status_idx
    ON budget_invitations (LOWER(email), invitation_status)
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS budget_history (
      history_id TEXT PRIMARY KEY,
      owner_email TEXT NOT NULL,
      budget_id TEXT NOT NULL,
      budget_name TEXT NOT NULL,
      budget_items JSONB NOT NULL DEFAULT '[]'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await pool.query(`
    CREATE INDEX IF NOT EXISTS budget_history_owner_created_idx
    ON budget_history (LOWER(owner_email), created_at DESC)
  `);
}

app.get('/api/users', requireAuthentication, async (req, res) => {
  try {
    await ensureUsersTable();
    const result = await pool.query(
      'SELECT email FROM users WHERE LOWER(email) = $1 LIMIT 1',
      [req.user.email],
    );
    return res.status(200).json(result.rows[0] || null);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Unable to load account' });
  }
});

app.delete('/account', requireAuthentication, async (req, res) => {
  let client;
  try {
    await ensureUsersTable();
    await ensurePasswordResetTokensTable();
    await ensureBudgetTables();
    client = await pool.connect();
    await client.query('BEGIN');
    await client.query(
      'DELETE FROM budgets WHERE LOWER(owner_email) = $1',
      [req.user.email],
    );
    await client.query(
      'DELETE FROM budget_history WHERE LOWER(owner_email) = $1',
      [req.user.email],
    );
    await client.query(
      'DELETE FROM budget_invitations WHERE LOWER(email) = $1',
      [req.user.email],
    );
    await client.query(
      'DELETE FROM password_reset_tokens WHERE LOWER(email) = $1',
      [req.user.email],
    );
    const result = await client.query(
      'DELETE FROM users WHERE LOWER(email) = $1 RETURNING email',
      [req.user.email],
    );
    if (result.rowCount === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Account not found' });
    }
    await client.query('COMMIT');
    return res.status(200).json({ message: 'Account deleted' });
  } catch (err) {
    if (client) {
      await client.query('ROLLBACK').catch((rollbackError) => {
        console.error('Account deletion rollback failed', rollbackError);
      });
    }
    console.error('Account deletion failed', err);
    return res.status(500).json({ error: 'Unable to delete account' });
  } finally {
    client?.release();
  }
});

app.post('/register', async (req, res) => {
  try{
    await ensureUsersTable();
    const { email, password } = req.body;
    if (!isValidEmail(email) || typeof password !== 'string' || password.length < 6){
      return res.status(400).json({ error: 'A valid email and password of at least 6 characters are required' });
    }

    const hash = await bcrypt.hash(password, SALT_ROUNDS);

    await pool.query('INSERT INTO users (email, password_hash) VALUES ($1, $2)', [email.trim().toLowerCase(), hash]);
    return res.status(201).json({ message: 'Registered' });
  }
  catch (err){
    if (err.code === '23505') {
      return res.status(409).json({ error: 'An account with that email already exists' });
    }
    console.error('Registration failed', err);
    return res.status(500).json({ error: 'Unable to register account' });
  }
});

app.post('/login', async (req, res) => {
  const { email, password } = req.body || {};
  if (!isValidEmail(email) || typeof password !== 'string' || !password) {
    return res.status(400).json({ error: 'A valid email and password are required' });
  }
  if (!process.env.JWT_SECRET) {
    return res.status(503).json({ error: 'Login is temporarily unavailable' });
  }

  try {
    await ensureUsersTable();
    const normalizedEmail = email.trim().toLowerCase();
    const result = await pool.query(
      'SELECT email, password_hash FROM users WHERE LOWER(email) = $1 LIMIT 1',
      [normalizedEmail],
    );
    const user = result.rows[0];
    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const token = jwt.sign({ sub: user.email.toLowerCase() }, process.env.JWT_SECRET, {
      expiresIn: '30d',
    });
    return res.status(200).json({ token, user: { email: user.email } });
  } catch (err) {
    console.error('Login failed', err);
    return res.status(500).json({ error: 'Unable to log in' });
  }
});

app.get('/auth/me', async (req, res) => {
  const authorization = req.get('Authorization') || '';
  const token = authorization.startsWith('Bearer ') ? authorization.slice(7) : '';
  if (!token || !process.env.JWT_SECRET) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    if (typeof payload.sub !== 'string') {
      return res.status(401).json({ error: 'Invalid session' });
    }
    const result = await pool.query(
      'SELECT email FROM users WHERE LOWER(email) = LOWER($1) LIMIT 1',
      [payload.sub],
    );
    if (result.rowCount === 0) {
      return res.status(401).json({ error: 'Invalid session' });
    }
    return res.status(200).json({ user: { email: result.rows[0].email } });
  } catch (err) {
    if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Invalid or expired session' });
    }
    console.error('Session validation failed', err);
    return res.status(500).json({ error: 'Unable to validate session' });
  }
});

function requireAuthentication(req, res, next) {
  const authorization = req.get('Authorization') || '';
  const token = authorization.startsWith('Bearer ') ? authorization.slice(7) : '';
  if (!token || !process.env.JWT_SECRET) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    if (typeof payload.sub !== 'string' || !isValidEmail(payload.sub)) {
      return res.status(401).json({ error: 'Invalid session' });
    }
    req.user = { email: payload.sub.trim().toLowerCase() };
    return next();
  } catch (err) {
    if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Invalid or expired session' });
    }
    console.error('Authentication failed', err);
    return res.status(500).json({ error: 'Unable to authenticate request' });
  }
}

app.post('/forgot-password', async (req, res) => {
  const { email } = req.body || {};
  const genericResponse = {
    message: 'If an account exists for that email, a password reset email has been sent.',
  };

  if (!isValidEmail(email)) {
    return res.status(400).json({ error: 'A valid email address is required' });
  }

  try {
    await ensurePasswordResetTokensTable();
    const normalizedEmail = email.trim().toLowerCase();

    const result = await pool.query(
      'SELECT email FROM users WHERE LOWER(email) = LOWER($1) LIMIT 1',
      [normalizedEmail],
    );

    if (result.rowCount === 0) {
      return res.status(200).json(genericResponse);
    }

    if (!isEmailConfigured() || !passwordResetUrl) {
      console.error(
        'Password reset email is not configured. Set RESEND_API_KEY, RESEND_FROM_EMAIL, and PASSWORD_RESET_URL.',
      );
      return res.status(503).json({ error: 'Password reset email is temporarily unavailable' });
    }

    const token = crypto.randomBytes(32).toString('hex');
    const tokenHash = hashResetToken(token);
    const expiresAt = new Date(
      Date.now() + resetTokenLifetimeMinutes * 60 * 1000,
    );
    const resetLink = new URL(passwordResetUrl);
    resetLink.searchParams.set('token', token);
    resetLink.searchParams.set('email', normalizedEmail);

    await pool.query(
      'DELETE FROM password_reset_tokens WHERE LOWER(email) = $1 OR expires_at < NOW()',
      [normalizedEmail],
    );
    await pool.query(
      'INSERT INTO password_reset_tokens (token_hash, email, expires_at) VALUES ($1, $2, $3)',
      [tokenHash, normalizedEmail, expiresAt],
    );
    await sendEmail({
      to: normalizedEmail,
      subject: 'Reset your BudgetBuddy password',
      text: `Use this link to reset your BudgetBuddy password: ${resetLink.toString()}\n\nThis link expires in ${resetTokenLifetimeMinutes} minutes.`,
      html: `<p>Use the link below to reset your BudgetBuddy password.</p><p><a href="${escapeHtml(resetLink.toString())}">Reset password</a></p><p>This link expires in ${resetTokenLifetimeMinutes} minutes.</p>`,
    });

    return res.status(200).json(genericResponse);
  } catch (err) {
    console.error('Password reset request failed', err);
    return res.status(500).json({ error: 'Unable to send password reset email' });
  }
});

app.post('/reset-password', async (req, res) => {
  const { email, token, password } = req.body || {};
  if (
    !isValidEmail(email) ||
    typeof token !== 'string' ||
    !/^[a-f0-9]{64}$/i.test(token) ||
    typeof password !== 'string' ||
    password.length < 6
  ) {
    return res.status(400).json({
      error: 'A valid email, reset token, and password of at least 6 characters are required',
    });
  }

  const normalizedEmail = email.trim().toLowerCase();
  const tokenHash = hashResetToken(token);
  let client;
  try {
    await ensureUsersTable();
    await ensurePasswordResetTokensTable();
    client = await pool.connect();
    await client.query('BEGIN');
    const tokenResult = await client.query(
      `DELETE FROM password_reset_tokens
       WHERE token_hash = $1 AND LOWER(email) = $2 AND expires_at > NOW()
       RETURNING email`,
      [tokenHash, normalizedEmail],
    );
    if (tokenResult.rowCount === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Invalid or expired password reset link' });
    }

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    const userResult = await client.query(
      'UPDATE users SET password_hash = $1 WHERE LOWER(email) = $2',
      [passwordHash, normalizedEmail],
    );
    if (userResult.rowCount === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Unable to reset password for this account' });
    }

    await client.query('COMMIT');
    return res.status(200).json({ message: 'Password has been reset successfully' });
  } catch (err) {
    if (client) {
      try {
        await client.query('ROLLBACK');
      } catch (rollbackError) {
        console.error('Password reset rollback failed', rollbackError);
      }
    }
    console.error('Password reset failed', err);
    return res.status(500).json({ error: 'Unable to reset password' });
  } finally {
    if (client) client.release();
  }
});

app.post('/budgets', requireAuthentication, async (req, res) => {
  const { budgetId, name, budgetItems } = req.body || {};
  if (
    typeof budgetId !== 'string' ||
    !budgetId.trim() ||
    typeof name !== 'string' ||
    !name.trim() ||
    !Array.isArray(budgetItems)
  ) {
    return res.status(400).json({
      error: 'budgetId, name, and budgetItems are required',
    });
  }

  try {
    await ensureBudgetTables();
    const existingBudget = await pool.query(
      `SELECT b.owner_email,
              EXISTS (
                SELECT 1 FROM budget_invitations i
                WHERE i.budget_id = b.budget_id
                  AND LOWER(i.email) = $2
                  AND i.invitation_status = 'accepted'
              ) AS is_collaborator
       FROM budgets b
       WHERE b.budget_id = $1`,
      [budgetId.trim(), req.user.email],
    );
    if (
      existingBudget.rowCount > 0 &&
      existingBudget.rows[0].owner_email?.toLowerCase() !== req.user.email &&
      !existingBudget.rows[0].is_collaborator
    ) {
      return res.status(403).json({ error: 'You do not have access to this budget' });
    }

    const result = await pool.query(
      `INSERT INTO budgets (budget_id, name, owner_email, budget_items, updated_at)
       VALUES ($1, $2, $3, $4::jsonb, NOW())
       ON CONFLICT (budget_id)
       DO UPDATE SET name = EXCLUDED.name,
                     owner_email = COALESCE(budgets.owner_email, EXCLUDED.owner_email),
                     budget_items = EXCLUDED.budget_items,
                     is_archived = FALSE,
                     updated_at = NOW()
       RETURNING budget_id AS "budgetId", name, owner_email AS "ownerEmail",
                 budget_items AS "budgetItems", updated_at AS "updatedAt"`,
      [budgetId.trim(), name.trim(), req.user.email, JSON.stringify(budgetItems)],
    );
    return res.status(200).json(result.rows[0]);
  } catch (err) {
    console.error('Budget save failed', err);
    return res.status(500).json({ error: 'Unable to save budget' });
  }
});

app.get('/budgets', requireAuthentication, async (req, res) => {
  try {
    await ensureBudgetTables();
    const result = await pool.query(
      `SELECT b.budget_id AS "budgetId", b.name, b.owner_email AS "ownerEmail",
              b.budget_items AS "budgetItems", b.updated_at AS "updatedAt"
       FROM budgets b
       WHERE b.is_archived = FALSE
         AND (LOWER(b.owner_email) = LOWER($1)
          OR EXISTS (
            SELECT 1
            FROM budget_invitations i
            WHERE i.budget_id = b.budget_id
              AND LOWER(i.email) = LOWER($1)
              AND i.invitation_status = 'accepted'
          ))
       ORDER BY b.updated_at DESC`,
      [req.user.email],
    );
    return res.status(200).json(result.rows);
  } catch (err) {
    console.error('Budget list failed', err);
    return res.status(500).json({ error: 'Unable to load budgets' });
  }
});

app.get('/budgets/:budgetId', requireAuthentication, async (req, res) => {
  const { budgetId } = req.params;
  if (!budgetId.trim()) {
    return res.status(400).json({ error: 'A budgetId is required' });
  }

  try {
    await ensureBudgetTables();
    const result = await pool.query(
      `SELECT b.budget_id AS "budgetId", b.name, b.owner_email AS "ownerEmail",
              b.budget_items AS "budgetItems", b.updated_at AS "updatedAt"
       FROM budgets b
       WHERE b.budget_id = $1
         AND b.is_archived = FALSE
         AND (
           LOWER(b.owner_email) = LOWER($2)
           OR EXISTS (
             SELECT 1
             FROM budget_invitations i
             WHERE i.budget_id = b.budget_id
               AND LOWER(i.email) = LOWER($2)
               AND i.invitation_status = 'accepted'
           )
         )`,
      [budgetId.trim(), req.user.email],
    );
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Budget not found or access denied' });
    }
    return res.status(200).json(result.rows[0]);
  } catch (err) {
    console.error('Budget lookup failed', err);
    return res.status(500).json({ error: 'Unable to load budget' });
  }
});

app.get('/history', requireAuthentication, async (req, res) => {
  try {
    await ensureBudgetTables();
    const result = await pool.query(
      `SELECT history_id AS "historyId", budget_id AS "budgetId",
              budget_name AS "budgetName", budget_items AS "budgetItems",
              created_at AS "createdAt"
       FROM budget_history
       WHERE LOWER(owner_email) = $1
       ORDER BY created_at DESC`,
      [req.user.email],
    );
    return res.status(200).json(result.rows);
  } catch (err) {
    console.error('Budget history load failed', err);
    return res.status(500).json({ error: 'Unable to load budget history' });
  }
});

app.post('/history', requireAuthentication, async (req, res) => {
  const { historyId, budgetId, budgetName, budgetItems } = req.body || {};
  if (
    typeof historyId !== 'string' || !historyId.trim() ||
    typeof budgetId !== 'string' || !budgetId.trim() ||
    typeof budgetName !== 'string' || !budgetName.trim() ||
    !Array.isArray(budgetItems)
  ) {
    return res.status(400).json({ error: 'A historyId, budgetId, budgetName, and budgetItems are required' });
  }

  let client;
  try {
    await ensureBudgetTables();
    client = await pool.connect();
    await client.query('BEGIN');
    const access = await client.query(
      `SELECT b.owner_email,
              EXISTS (
                SELECT 1 FROM budget_invitations i
                WHERE i.budget_id = b.budget_id
                  AND LOWER(i.email) = $2
                  AND i.invitation_status = 'accepted'
              ) AS is_collaborator
       FROM budgets b
       WHERE b.budget_id = $1`,
      [budgetId.trim(), req.user.email],
    );
    if (access.rowCount === 0 || access.rows[0].owner_email?.toLowerCase() !== req.user.email) {
      await client.query('ROLLBACK');
      return res.status(403).json({ error: 'Only the budget owner can archive this budget' });
    }

    const result = await client.query(
      `INSERT INTO budget_history (history_id, owner_email, budget_id, budget_name, budget_items)
       VALUES ($1, $2, $3, $4, $5::jsonb)
       ON CONFLICT (history_id) DO NOTHING
       RETURNING history_id AS "historyId", budget_id AS "budgetId",
                 budget_name AS "budgetName", budget_items AS "budgetItems",
                 created_at AS "createdAt"`,
      [historyId.trim(), req.user.email, budgetId.trim(), budgetName.trim(), JSON.stringify(budgetItems)],
    );
    if (result.rowCount === 0) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'History entry already exists' });
    }
    await client.query(
      'UPDATE budgets SET is_archived = TRUE, updated_at = NOW() WHERE budget_id = $1',
      [budgetId.trim()],
    );
    await client.query('COMMIT');
    return res.status(201).json(result.rows[0]);
  } catch (err) {
    if (client) {
      await client.query('ROLLBACK').catch((rollbackError) => {
        console.error('Budget history rollback failed', rollbackError);
      });
    }
    console.error('Budget history save failed', err);
    return res.status(500).json({ error: 'Unable to save budget history' });
  } finally {
    client?.release();
  }
});

app.delete('/history/:historyId', requireAuthentication, async (req, res) => {
  try {
    await ensureBudgetTables();
    const result = await pool.query(
      `DELETE FROM budget_history
       WHERE history_id = $1 AND LOWER(owner_email) = $2
       RETURNING history_id AS "historyId"`,
      [req.params.historyId, req.user.email],
    );
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'History entry not found' });
    }
    return res.status(200).json({ historyId: result.rows[0].historyId });
  } catch (err) {
    console.error('Budget history delete failed', err);
    return res.status(500).json({ error: 'Unable to delete budget history' });
  }
});

app.post('/share', requireAuthentication, async (req, res) => {
  const { email, budgetId } = req.body || {};
  if (!isValidEmail(email) || typeof budgetId !== 'string' || !budgetId.trim()) {
    return res.status(400).json({ error: 'A valid email and budgetId are required' });
  }

  if (!isEmailConfigured() || !budgetInviteUrl) {
    console.error(
      'Budget invitation email is not configured. Set RESEND_API_KEY, RESEND_FROM_EMAIL, and BUDGET_INVITE_URL.',
    );
    return res.status(503).json({ error: 'Budget invitations are temporarily unavailable' });
  }

  let inviteLink;
  try {
    inviteLink = new URL(budgetInviteUrl);
    inviteLink.searchParams.set('budgetId', budgetId.trim());
  } catch (err) {
    console.error('BUDGET_INVITE_URL is invalid', err);
    return res.status(503).json({ error: 'Budget invitations are temporarily unavailable' });
  }

  const recipientEmail = email.trim().toLowerCase();
  let client;
  let transactionOpen = false;
  try {
    await ensureBudgetTables();
    const budgetResult = await pool.query(
      'SELECT name, owner_email FROM budgets WHERE budget_id = $1',
      [budgetId.trim()],
    );
    if (budgetResult.rowCount === 0) {
      return res.status(404).json({ error: 'Budget not found' });
    }

    if (budgetResult.rows[0].owner_email?.toLowerCase() !== req.user.email) {
      return res.status(403).json({ error: 'Only the budget owner can invite others' });
    }

    const budgetName = budgetResult.rows[0].name;
    const safeBudgetName = escapeHtml(budgetName);

    client = await pool.connect();
    await client.query('BEGIN');
    transactionOpen = true;
    await client.query(
      `DELETE FROM budget_invitations
       WHERE LOWER(email) = $1 AND budget_id = $2 AND invitation_status = 'pending'`,
      [recipientEmail, budgetId.trim()],
    );
    const invitationResult = await client.query(
      `INSERT INTO budget_invitations (email, budget_id, budget_name)
       VALUES ($1, $2, $3)
       RETURNING id, email, budget_id AS "budgetId", budget_name AS "budgetName",
                 invitation_status AS "invitationStatus", created_at AS "createdAt"`,
      [recipientEmail, budgetId.trim(), budgetName],
    );

    await client.query('COMMIT');
    transactionOpen = false;

    await sendEmail({
      to: recipientEmail,
      subject: `You're invited to share "${budgetName}" on BudgetBuddy`,
      text: `You have been invited to share the BudgetBuddy budget "${budgetName}". Open this link to view the invitation: ${inviteLink.toString()}`,
      html: `<p>You have been invited to share the BudgetBuddy budget <strong>${safeBudgetName}</strong>.</p><p><a href="${inviteLink.toString()}">Open budget invitation</a></p>`,
    });

    return res.status(201).json(invitationResult.rows[0]);
  } catch (err) {
    if (client && transactionOpen) {
      await client.query('ROLLBACK').catch((rollbackError) => {
        console.error('Budget invitation rollback failed', rollbackError);
      });
    }
    console.error('Budget share failed', err);
    return res.status(502).json({ error: 'Unable to send budget invitation' });
  } finally {
    client?.release();
  }
});

app.get('/invites', requireAuthentication, async (req, res) => {
  try{
    await ensureBudgetTables();
    const result = await pool.query(
      `SELECT id, email, budget_id AS "budgetId", budget_name AS "budgetName",
              invitation_status AS "invitationStatus", created_at AS "createdAt"
       FROM budget_invitations
       WHERE LOWER(email) = LOWER($1) AND invitation_status = $2
       ORDER BY created_at DESC`,
      [req.user.email, 'pending'],
    );
    res.status(200).json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500)
    .json({ error: 'Error fetching invites' });
  }
});

app.patch('/invites/:id', requireAuthentication, async (req, res) => {
  const invitationId = Number(req.params.id);
  const { status } = req.body || {};
  if (
    !Number.isInteger(invitationId) ||
    invitationId <= 0 ||
    !['accepted', 'rejected'].includes(status)
  ) {
    return res.status(400).json({
      error: 'A valid invitation id and status are required',
    });
  }

  try {
    await ensureBudgetTables();
    const result = await pool.query(
      `UPDATE budget_invitations
       SET invitation_status = $1
       WHERE id = $2 AND LOWER(email) = LOWER($3) AND invitation_status = 'pending'
       RETURNING id, email, budget_id AS "budgetId", budget_name AS "budgetName",
                 invitation_status AS "invitationStatus", created_at AS "createdAt"`,
      [status, invitationId, req.user.email],
    );
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Pending invitation not found' });
    }

    return res.status(200).json(result.rows[0]);
  } catch (err) {
    console.error('Invitation update failed', err);
    return res.status(500).json({ error: 'Unable to update invitation' });
  }
});

async function initializeDatabase() {
  await ensureUsersTable();
  await ensurePasswordResetTokensTable();
  await ensureBudgetTables();
}

async function startServer(port = Number(process.env.PORT) || 3000) {
  await initializeDatabase();
  return app.listen(port, '127.0.0.1', () => {
    console.log(`Server running on port ${port}`);
  });
}

if (require.main === module) {
  startServer().catch((err) => {
    console.error('Database initialization failed; server was not started.', err);
    pool.end().finally(() => {
      process.exitCode = 1;
    });
  });
}

module.exports = { app, initializeDatabase, pool, startServer };
