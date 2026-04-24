const express = require("express");
const cors = require("cors");
const { Pool } = require("pg");
const jwt = require("jsonwebtoken");
const multer = require("multer");
const path = require("path");
require("dotenv").config();

const app = express();
app.use(cors());
app.use(express.json());
app.use("/uploads", express.static("uploads"));

const PORT = process.env.PORT || 3000;
const JWT_SECRET = "menesah_secret";

// DATABASE
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || "postgresql://postgres:password@localhost:5432/menesah",
  ssl: process.env.DATABASE_URL
    ? { rejectUnauthorized: false }
    : false
});

// FILE UPLOAD
const storage = multer.diskStorage({
  destination: "./uploads",
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  }
});
const upload = multer({ storage });

// AUTH MIDDLEWARE
function auth(req, res, next) {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(403).json({ message: "No token" });

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch {
    res.status(401).json({ message: "Invalid token" });
  }
}

// INIT DATABASE
async function initDB() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email TEXT UNIQUE,
        password TEXT,
        role TEXT
      );
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS applications (
        id SERIAL PRIMARY KEY,
        full_name TEXT,
        passport_number TEXT,
        age INT,
        status TEXT DEFAULT 'Applied',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS files (
        id SERIAL PRIMARY KEY,
        application_id INT,
        filename TEXT,
        filepath TEXT
      );
    `);
    await pool.query(`
  CREATE TABLE IF NOT EXISTS companies (
    id SERIAL PRIMARY KEY,
    name TEXT
  );
`);

await pool.query(`
  ALTER TABLE applications
  ADD COLUMN IF NOT EXISTS company_id INT;
`);

await pool.query(`
  ALTER TABLE users
  ADD COLUMN IF NOT EXISTS company_id INT;
`);

    await pool.query(`
    -- CANDIDATES TABLE (NEW)
  CREATE TABLE IF NOT EXISTS candidates (
  id SERIAL PRIMARY KEY,
  full_name TEXT,
  passport_number TEXT,
  age INT,
  status TEXT DEFAULT 'Pending',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
`);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS timeline (
        id SERIAL PRIMARY KEY,
        application_id INT,
        action TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS notifications (
        id SERIAL PRIMARY KEY,
        message TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // USERS
    await pool.query(`
      INSERT INTO users (email, password, role) VALUES
      ('owner@test.com','1234','owner'),
      ('reception@test.com','1234','receptionist'),
      ('it@test.com','1234','it'),
      ('partner@test.com','1234','partner')
      ON CONFLICT DO NOTHING;
    `);

    console.log("✅ DATABASE READY");
  } catch (err) {
    console.error("DB INIT ERROR:", err.message);
  }
  await pool.query(`
  ALTER TABLE candidates
  ADD COLUMN IF NOT EXISTS email TEXT,
  ADD COLUMN IF NOT EXISTS password TEXT;
`);
app.post("/api/candidate/register", async (req, res) => {
  const { full_name, email, password } = req.body;

  const result = await pool.query(
    "INSERT INTO candidates (full_name, email, password) VALUES ($1,$2,$3) RETURNING *",
    [full_name, email, password]
  );

  res.json(result.rows[0]);
});
app.post("/api/candidate/login", async (req, res) => {
  const { email, password } = req.body;

  const result = await pool.query(
    "SELECT * FROM candidates WHERE email=$1 AND password=$2",
    [email, password]
  );

  if (result.rows.length === 0) {
    return res.status(401).json({ message: "Invalid login" });
  }

  res.json(result.rows[0]);
});
async function candidateDashboard() {
  const res = await fetch(`${BASE_URL}/api/candidates`);
  const data = await res.json();

  let html = "<h2>My Application</h2>";

  data.forEach(c => {
    html += `<p>${c.full_name} - ${c.status}</p>`;
  });

  document.getElementById("content").innerHTML = html;
}
}

// AUTH ROUTE
app.post("/api/auth/login", async (req, res) => {
  const { email, password } = req.body;

  const result = await pool.query(
    "SELECT * FROM users WHERE email=$1 AND password=$2",
    [email, password]
  );
  if (req.user.role === "partner") {
  const result = await pool.query(
    "SELECT * FROM applications WHERE company_id=$1",
    [req.user.company_id]
  );
  return res.json(result.rows);
}

  if (result.rows.length === 0)
    return res.status(401).json({ message: "Invalid login" });

  const user = result.rows[0];

  const token = jwt.sign(
    { id: user.id, role: user.role },
    JWT_SECRET
  );

  res.json({ token, role: user.role });
});
// CREATE COMPANY
app.post("/api/companies", auth, async (req, res) => {
  const { name } = req.body;

  const result = await pool.query(
    "INSERT INTO companies (name) VALUES ($1) RETURNING *",
    [name]
  );

  res.json(result.rows[0]);
});

// GET COMPANIES
app.get("/api/companies", auth, async (req, res) => {
  const result = await pool.query("SELECT * FROM companies");
  res.json(result.rows);
});

// CREATE APPLICATION (PUBLIC + STAFF)
app.post("/api/candidates", async (req, res) => {
  const { full_name, passport_number, age, company_id } = req.body;

  const result = await pool.query(
    "INSERT INTO candidates (full_name, passport_number, age) VALUES ($1,$2,$3) RETURNING *",
    [full_name, passport_number, age]
  );

  res.json(result.rows[0]);
});

// GET APPLICATIONS
app.get("/api/candidates", auth, async (req, res) => {
  const result = await pool.query(
    "SELECT * FROM candidates ORDER BY id DESC"
  );
  res.json(result.rows);
;

  const appData = result.rows[0];

  await pool.query(
    "INSERT INTO timeline (application_id, action) VALUES ($1,$2)",
    [appData.id, "Application Created"]
  );

  await pool.query(
    "INSERT INTO notifications (message) VALUES ($1)",
    [`New application: ${full_name}`]
  );

  res.json(appData);
});

// UPDATE STATUS
app.post("/api/candidates/approve/:id", auth, async (req, res) => {
  const cand = await pool.query(
    "SELECT * FROM candidates WHERE id=$1",
    [req.params.id]
  );

  const c = cand.rows[0];

  const appInsert = await pool.query(
    "INSERT INTO applications (full_name, passport_number, age, status, company_id) VALUES ($1,$2,$3,$4,$5) RETURNING *",
    [c.full_name, c.passport_number, c.age, "Approved", c.company_id]
  );

  await pool.query("DELETE FROM candidates WHERE id=$1", [req.params.id]);

  res.json(appInsert.rows[0]);
});
app.put("/api/applications/ticket/:id", auth, async (req, res) => {
  await pool.query(
    "UPDATE applications SET status='TicketReady' WHERE id=$1",
    [req.params.id]
  );

  res.json({ message: "Ticket Ready" });
});
app.put("/api/candidates/:id", auth, async (req, res) => {
  const { status } = req.body;

  await pool.query(
    "UPDATE candidates SET status=$1 WHERE id=$2",
    [status, req.params.id]
  );

  await pool.query(
    "INSERT INTO timeline (application_id, action) VALUES ($1,$2)",
    [req.params.id, `Moved to ${status}`]
  );

  await pool.query(
    "INSERT INTO notifications (message) VALUES ($1)",
    [`Application ${req.params.id} → ${status}`]
  );

  res.json({ message: "Updated" });
});

// TIMELINE
app.get("/api/applications/timeline/:id", auth, async (req, res) => {
  const result = await pool.query(
    "SELECT * FROM timeline WHERE application_id=$1",
    [req.params.id]
  );

  res.json(result.rows);
});

// STATS
app.get("/api/applications/stats", auth, async (req, res) => {
  const total = await pool.query("SELECT COUNT(*) FROM applications");
  const applied = await pool.query("SELECT COUNT(*) FROM applications WHERE status='Applied'");
  const approved = await pool.query("SELECT COUNT(*) FROM applications WHERE status='Approved'");
  const medical = await pool.query("SELECT COUNT(*) FROM applications WHERE status='Medical'");
  const selected = await pool.query("SELECT COUNT(*) FROM applications WHERE status='Selected'");

  res.json({
    total: total.rows[0].count,
    applied: applied.rows[0].count,
    approved: approved.rows[0].count,
    medical: medical.rows[0].count,
    selected: selected.rows[0].count
  });
});

// FILE UPLOAD
app.post("/api/files", upload.single("file"), async (req, res) => {
  const { application_id } = req.body;

  await pool.query(
    "INSERT INTO files (application_id, filename, filepath) VALUES ($1,$2,$3)",
    [application_id, req.file.filename, req.file.filename]
  );

  res.json({ message: "Uploaded" });
});

// GET FILES
app.get("/api/files/:id", auth, async (req, res) => {
  const result = await pool.query(
    "SELECT * FROM files WHERE application_id=$1",
    [req.params.id]
  );

  res.json(result.rows);
});

// NOTIFICATIONS
app.get("/api/notifications", auth, async (req, res) => {
  const result = await pool.query(
    "SELECT * FROM notifications ORDER BY created_at DESC LIMIT 10"
  );
  res.json(result.rows);
});
// GET FILES
app.get("/api/files/:id", auth, async (req, res) => {
  const result = await pool.query(
    "SELECT * FROM files WHERE application_id=$1",
    [req.params.id]
  );

  res.json(result.rows);
});

// 🔔 NOTIFICATIONS ROUTE (PUT IT HERE)
app.get("/api/notifications", auth, async (req, res) => {
  const result = await pool.query(
    "SELECT * FROM notifications ORDER BY created_at DESC LIMIT 10"
  );
  res.json(result.rows);
});
const PDFDocument = require("pdfkit");

app.get("/api/reports/applications", auth, async (req, res) => {
  const result = await pool.query("SELECT * FROM applications");

  const doc = new PDFDocument();

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", "attachment; filename=report.pdf");

  doc.pipe(res);

  doc.fontSize(18).text("MENESAH ERP REPORT", { align: "center" });
  doc.moveDown();

  result.rows.forEach(a => {
    doc.fontSize(12).text(
      `Name: ${a.full_name} | Passport: ${a.passport_number} | Status: ${a.status}`
    );
    doc.moveDown();
  });

  doc.end();
});

// START SERVER
app.listen(PORT, async () => {
  await initDB();
  console.log(`🚀 Server running on port ${PORT}`);
});

// START
app.listen(PORT, async () => {
  await initDB();
  console.log(`🚀 Server running on port ${PORT}`);
});