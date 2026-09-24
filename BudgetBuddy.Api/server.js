const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
require('dotenv').config();

const app = express();

const configuredCorsOrigins = (process.env.CORS_ORIGINS || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

const defaultCorsOrigins = [
  'http://localhost:8080',
  'http://127.0.0.1:8080',
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'http://192.168.0.146:8080',
  'https://onset-theatrics-subway.ngrok-free.dev',
];

const corsOptions = {
  origin(origin, callback) {
    // Native clients do not send an Origin header; browser clients do.
    if (!origin) {
      return callback(null, true);
    }

    const isAllowed =
      [...defaultCorsOrigins, ...configuredCorsOrigins].includes(origin) ||
      /^https:\/\/[a-z0-9-]+\.ngrok-free\.dev$/i.test(origin);

    return callback(isAllowed ? null : new Error('Origin is not allowed by CORS'), isAllowed);
  },
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    'Accept',
    'Content-Type',
    'bypass-tunnel-reminder',
    'Access-Control-Allow-Origin',
  ],
  optionsSuccessStatus: 204,
};

const SALT_ROUNDS = 10;

app.use(cors(corsOptions));
app.options(/.*/, cors(corsOptions));
app.use(express.json()); // Parses incoming JSON payloads

// Configure PostgreSQL client pool
const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || '0.0.0.0',
  password: process.env.DB_PASSWORD || 'superuser',
  database: process.env.DB_NAME || 'budgetbuddy',
  port: Number(process.env.DB_PORT) || 5432,
});

const resetTokenLifetimeMinutes = 30;
const passwordResetUrl = process.env.PASSWORD_RESET_URL;
const budgetInviteUrl = process.env.BUDGET_INVITE_URL;
const mailTransporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT) || 587,
  secure: process.env.SMTP_SECURE === 'true',
  auth: process.env.SMTP_USER
    ? {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASSWORD,
      }
    : undefined,
});

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

async function ensureBudgetTables() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS budgets (
      budget_id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      owner_email TEXT,
      budget_items JSONB NOT NULL DEFAULT '[]'::jsonb,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await pool.query(`
    ALTER TABLE budgets ADD COLUMN IF NOT EXISTS owner_email TEXT
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
}

// Route endpoint to write data
app.post('/api/users', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT * FROM users`);
    res.status(201).json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database write failed' });
  }
});

app.get('/api/users', async (req, res) => {
  try {
    console.log(req)
    const result = await pool.query(
      `SELECT * FROM users`);
    return res.status(201).json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database write failed' });
  }
});

app.post('/register', async (req, res) => {
  try{
    const { email, password } = req.body;
    if (!email || !password){
      return(res.status(400))
    }
    console.log(email, password)
    
    const hash = await bcrypt.hash(password, SALT_ROUNDS);
    
    await pool.query('INSERT INTO users (email, password_hash) VALUES ($1, $2)', [email, hash]);
        return res.status(201).json({ message: "Registered" });
    
  }
  catch (err){
    return res.status(500).json({ error: "Error" });
  }
});

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

    const result = await pool.query(
      'SELECT email FROM users WHERE LOWER(email) = LOWER($1) LIMIT 1',
      [email.trim()],
    );

    if (result.rowCount === 0) {
      return res.status(200).json(genericResponse);
    }

    if (!process.env.SMTP_HOST || !process.env.SMTP_FROM || !passwordResetUrl) {
      console.error(
        'Password reset email is not configured. Set SMTP_HOST, SMTP_FROM, and PASSWORD_RESET_URL.',
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
    resetLink.searchParams.set('email', email.trim());

    await pool.query('DELETE FROM password_reset_tokens WHERE email = $1 OR expires_at < NOW()', [
      email.trim(),
    ]);
    await pool.query(
      'INSERT INTO password_reset_tokens (token_hash, email, expires_at) VALUES ($1, $2, $3)',
      [tokenHash, email.trim(), expiresAt],
    );
    await mailTransporter.sendMail({
      from: process.env.SMTP_FROM,
      to: email.trim(),
      subject: 'Reset your BudgetBuddy password',
      text: `Use this link to reset your BudgetBuddy password: ${resetLink.toString()}\n\nThis link expires in ${resetTokenLifetimeMinutes} minutes.`,
      html: `<p>Use the link below to reset your BudgetBuddy password.</p><p><a href="${resetLink.toString()}">Reset password</a></p><p>This link expires in ${resetTokenLifetimeMinutes} minutes.</p>`,
    });

    return res.status(200).json(genericResponse);
  } catch (err) {
    console.error('Password reset request failed', err);
    return res.status(500).json({ error: 'Unable to send password reset email' });
  }
});

app.post('/budgets', async (req, res) => {
  const { budgetId, name, budgetItems, ownerEmail } = req.body || {};
  if (
    typeof budgetId !== 'string' ||
    !budgetId.trim() ||
    typeof name !== 'string' ||
    !name.trim() ||
    !Array.isArray(budgetItems) ||
    !isValidEmail(ownerEmail)
  ) {
    return res.status(400).json({
      error: 'budgetId, name, and budgetItems are required',
    });
  }

  try {
    await ensureBudgetTables();
    const result = await pool.query(
      `INSERT INTO budgets (budget_id, name, owner_email, budget_items, updated_at)
       VALUES ($1, $2, $3, $4::jsonb, NOW())
       ON CONFLICT (budget_id)
       DO UPDATE SET name = EXCLUDED.name,
                     owner_email = COALESCE(budgets.owner_email, EXCLUDED.owner_email),
                     budget_items = EXCLUDED.budget_items,
                     updated_at = NOW()
       RETURNING budget_id AS "budgetId", name, owner_email AS "ownerEmail",
                 budget_items AS "budgetItems", updated_at AS "updatedAt"`,
      [budgetId.trim(), name.trim(), ownerEmail.trim().toLowerCase(), JSON.stringify(budgetItems)],
    );
    return res.status(200).json(result.rows[0]);
  } catch (err) {
    console.error('Budget save failed', err);
    return res.status(500).json({ error: 'Unable to save budget' });
  }
});

app.get('/budgets', async (req, res) => {
  const { email } = req.query;
  if (!isValidEmail(email)) {
    return res.status(400).json({ error: 'A valid email is required' });
  }

  try {
    await ensureBudgetTables();
    const result = await pool.query(
      `SELECT b.budget_id AS "budgetId", b.name, b.owner_email AS "ownerEmail",
              b.budget_items AS "budgetItems", b.updated_at AS "updatedAt"
       FROM budgets b
       WHERE LOWER(b.owner_email) = LOWER($1)
          OR EXISTS (
            SELECT 1
            FROM budget_invitations i
            WHERE i.budget_id = b.budget_id
              AND LOWER(i.email) = LOWER($1)
              AND i.invitation_status = 'accepted'
          )
       ORDER BY b.updated_at DESC`,
      [email],
    );
    return res.status(200).json(result.rows);
  } catch (err) {
    console.error('Budget list failed', err);
    return res.status(500).json({ error: 'Unable to load budgets' });
  }
});

app.get('/budgets/:budgetId', async (req, res) => {
  const { email } = req.query;
  const { budgetId } = req.params;
  if (!isValidEmail(email) || !budgetId.trim()) {
    return res.status(400).json({ error: 'A valid email and budgetId are required' });
  }

  try {
    await ensureBudgetTables();
    const result = await pool.query(
      `SELECT b.budget_id AS "budgetId", b.name, b.owner_email AS "ownerEmail",
              b.budget_items AS "budgetItems", b.updated_at AS "updatedAt"
       FROM budgets b
       WHERE b.budget_id = $1
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
      [budgetId.trim(), email],
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

app.post('/share', async (req, res) => {
  const { email, budgetId } = req.body || {};
  if (!isValidEmail(email) || typeof budgetId !== 'string' || !budgetId.trim()) {
    return res.status(400).json({ error: 'A valid email and budgetId are required' });
  }

  if (!process.env.SMTP_HOST || !process.env.SMTP_FROM || !budgetInviteUrl) {
    console.error(
      'Budget invitation email is not configured. Set SMTP_HOST, SMTP_FROM, and BUDGET_INVITE_URL.',
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
  try {
    await ensureBudgetTables();
    const budgetResult = await pool.query(
      'SELECT name FROM budgets WHERE budget_id = $1',
      [budgetId.trim()],
    );
    if (budgetResult.rowCount === 0) {
      return res.status(404).json({ error: 'Budget not found' });
    }

    const budgetName = budgetResult.rows[0].name;
    const safeBudgetName = escapeHtml(budgetName);

    client = await pool.connect();
    await client.query('BEGIN');
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

    await mailTransporter.sendMail({
      from: process.env.SMTP_FROM,
      to: recipientEmail,
      subject: `You're invited to share "${budgetName}" on BudgetBuddy`,
      text: `You have been invited to share the BudgetBuddy budget "${budgetName}". Open this link to view the invitation: ${inviteLink.toString()}`,
      html: `<p>You have been invited to share the BudgetBuddy budget <strong>${safeBudgetName}</strong>.</p><p><a href="${inviteLink.toString()}">Open budget invitation</a></p>`,
    });

    await client.query('COMMIT');
    return res.status(201).json(invitationResult.rows[0]);
  } catch (err) {
    if (client) {
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

app.get('/invites', async (req, res) => {
  try{
    const { email } = req.query;
    if (!isValidEmail(email)) {
      return res.status(400).json({ error: 'A valid email is required' });
    }
    await ensureBudgetTables();
    const result = await pool.query(
      `SELECT id, email, budget_id AS "budgetId", budget_name AS "budgetName",
              invitation_status AS "invitationStatus", created_at AS "createdAt"
       FROM budget_invitations
       WHERE LOWER(email) = LOWER($1) AND invitation_status = $2
       ORDER BY created_at DESC`,
      [email, 'pending'],
    );
    res.status(200).json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500)
    .json({ error: 'Error fetching invites' });
  }
});

app.patch('/invites/:id', async (req, res) => {
  const invitationId = Number(req.params.id);
  const { email, status } = req.body || {};
  if (
    !Number.isInteger(invitationId) ||
    invitationId <= 0 ||
    !isValidEmail(email) ||
    !['accepted', 'rejected'].includes(status)
  ) {
    return res.status(400).json({
      error: 'A valid invitation id, email, and status are required',
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
      [status, invitationId, email.trim()],
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

app.listen(3000, () => console.log('Server running on port 3000'));
