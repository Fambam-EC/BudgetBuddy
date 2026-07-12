const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
require('dotenv').config();

const app = express();

const corsOptions = {
  // 1. Specify allowed origins (can be a string, array, or function)
  origin: ['http://localhost:8080', 'https://onset-theatrics-subway.ngrok-free.dev','http://192.168.0.146:8080'],
  
  // 2. Control which HTTP methods are permitted
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  
  // 3. Define allowed request headers from the client
  allowedHeaders: ['Access-Control-Allow-Origin','Content-Type', 'bypass-tunnel-reminder', '*'],
};

app.use(cors(corsOptions));
app.use(express.json()); // Parses incoming JSON payloads

// Configure PostgreSQL client pool
const pool = new Pool({
  user: 'postgres',
  host: '0.0.0.0',
  password: 'superuser',
  database: 'budgetbuddy',
  port: 5432,
});

// Route endpoint to write data
app.post('/api/users', async (req, res) => {
  try {
    console.log(pool)
    console.log(req)
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
app.listen(3000, () => console.log('Server running on port 3000'));
