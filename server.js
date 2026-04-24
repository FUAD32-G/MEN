const express = require("express");
const cors = require("cors");
const { Pool } = require("pg");
const jwt = require("jsonwebtoken");
const multer = require("multer");
require("dotenv").config();

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;

/* ================= DATABASE ================= */
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL
    ? { rejectUnauthorized: false }
    : false
});

/* ================= FILE UPLOAD ================= */
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, "uploads/"),
  filename: (req, file, cb) =>
    cb(null, Date.now() + "-" + file.originalname)
});

const upload = multer({ storage });

/* ================= INIT DB ================= */
async function initDB() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      email TEXT UNIQUE,
      password TEXT,
      role TEXT,
      company_id INT
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS companies (
      id SERIAL PRIMARY KEY,
      name TEXT
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS candidates (
      id SERIAL PRIMARY KEY,
      full_name TEXT,
      passport_number TEXT,
      age INT,
      email TEXT,
      password TEXT,
      status TEXT DEFAULT 'Pending',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS applications (
      id SERIAL PRIMARY KEY,
      full_name TEXT,
      passport_number TEXT,
      age INT,
      status TEXT,
      company_id INT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS files (
      id SERIAL PRIMARY KEY,
      application_id INT,
      file_path TEXT
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS notifications (
      id SERIAL PRIMARY KEY,
      message TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Ensure default owner exists
  await pool.query(`
    INSERT INTO users (email, password, role)
    VALUES ('owner@test.com','1234','owner')
    ON CONFLICT (email) DO NOTHING;
  `);

  console.log("DATABASE READY");
}

/* ================= AUTH ================= */
function auth(req, res, next) {
  const header = req.headers.authorization;
  if (!header) return res.sendStatus(403);

  try {
    const token = header.split(" ")[1];
    const decoded = jwt.verify(token, "secret");
    req.user = decoded;
    next();
  } catch {
    res.sendStatus(403);
  }
}

/* ================= LOGIN ================= */
app.post("/api/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    const result = await pool.query(
      "SELECT * FROM users WHERE email=$1",
      [email]
    );

    if (result.rows.length === 0)
      return res.status(401).json({ message: "User not found" });

    const user = result.rows[0];

    if (user.password !== password)
      return res.status(401).json({ message: "Wrong password" });

    const token = jwt.sign(
      { id: user.id, role: user.role, company_id: user.company_id },
      "secret"
    );

    res.json({ token, role: user.role });

  } catch (err) {
    console.log(err);
    res.status(500).json({ message: "server error" });
  }
});

/* ================= COMPANIES ================= */
app.post("/api/companies", auth, async (req, res) => {
  const result = await pool.query(
    "INSERT INTO companies (name) VALUES ($1) RETURNING *",
    [req.body.name]
  );
  res.json(result.rows[0]);
});

app.get("/api/companies", auth, async (req, res) => {
  const result = await pool.query("SELECT * FROM companies");
  res.json(result.rows);
});

/* ================= USERS ================= */
app.post("/api/users", auth, async (req, res) => {
  const { email, password, role, company_id } = req.body;

  const result = await pool.query(
    "INSERT INTO users (email, password, role, company_id) VALUES ($1,$2,$3,$4) RETURNING *",
    [email, password, role, company_id]
  );

  res.json(result.rows[0]);
});

/* ================= CANDIDATES ================= */
app.post("/api/candidates", async (req, res) => {
  const { full_name, passport_number, age } = req.body;

  const result = await pool.query(
    "INSERT INTO candidates (full_name, passport_number, age) VALUES ($1,$2,$3) RETURNING *",
    [full_name, passport_number, age]
  );

  res.json(result.rows[0]);
});

app.get("/api/candidates", auth, async (req, res) => {
  const result = await pool.query("SELECT * FROM candidates ORDER BY id DESC");
  res.json(result.rows);
});

/* APPROVE */
app.post("/api/candidates/approve/:id", auth, async (req, res) => {
  const cand = await pool.query(
    "SELECT * FROM candidates WHERE id=$1",
    [req.params.id]
  );

  const c = cand.rows[0];

  await pool.query(
    "INSERT INTO applications (full_name, passport_number, age, status) VALUES ($1,$2,$3,'Approved')",
    [c.full_name, c.passport_number, c.age]
  );

  await pool.query("DELETE FROM candidates WHERE id=$1", [req.params.id]);

  await pool.query(
    "INSERT INTO notifications (message) VALUES ($1)",
    [`Candidate ${c.full_name} approved`]
  );

  res.json({ message: "Approved" });
});

/* ================= APPLICATIONS ================= */
app.get("/api/applications", auth, async (req, res) => {
  let result;

  if (req.user.role === "partner") {
    result = await pool.query(
      "SELECT * FROM applications WHERE company_id=$1",
      [req.user.company_id]
    );
  } else {
    result = await pool.query("SELECT * FROM applications");
  }

  res.json(result.rows);
});

/* STATUS UPDATE */
app.put("/api/applications/status/:id", auth, async (req, res) => {
  await pool.query(
    "UPDATE applications SET status=$1 WHERE id=$2",
    [req.body.status, req.params.id]
  );

  res.json({ message: "Updated" });
});

/* TICKET READY */
app.put("/api/applications/ticket/:id", auth, async (req, res) => {
  await pool.query(
    "UPDATE applications SET status='TicketReady' WHERE id=$1",
    [req.params.id]
  );

  res.json({ message: "Ticket Ready" });
});

/* ================= FILE UPLOAD ================= */
app.post("/api/upload/:id", auth, upload.single("file"), async (req, res) => {
  await pool.query(
    "INSERT INTO files (application_id, file_path) VALUES ($1,$2)",
    [req.params.id, req.file.path]
  );

  res.json({ message: "Uploaded" });
});

/* ================= FILE VIEW ================= */
app.get("/api/files/:id", auth, async (req, res) => {
  const result = await pool.query(
    "SELECT * FROM files WHERE application_id=$1",
    [req.params.id]
  );

  res.json(result.rows);
});

/* ================= NOTIFICATIONS ================= */
app.get("/api/notifications", auth, async (req, res) => {
  const result = await pool.query(
    "SELECT * FROM notifications ORDER BY created_at DESC"
  );

  res.json(result.rows);
});

/* ================= STATS ================= */
app.get("/api/applications/stats", auth, async (req, res) => {
  const total = await pool.query("SELECT COUNT(*) FROM applications");
  const approved = await pool.query("SELECT COUNT(*) FROM applications WHERE status='Approved'");
  const ticket = await pool.query("SELECT COUNT(*) FROM applications WHERE status='TicketReady'");

  res.json({
    total: total.rows[0].count,
    approved: approved.rows[0].count,
    ticket: ticket.rows[0].count
  });
});

/* ================= START ================= */
app.listen(PORT, async () => {
  await initDB();
  console.log(`🚀 Server running on port ${PORT}`);
});