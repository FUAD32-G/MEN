// ===== IMPORTS =====
const express = require("express");
const cors = require("cors");
require("dotenv").config();
const path = require("path");

// ===== INIT APP (MUST COME BEFORE app.use) =====
const app = express();

// ===== MIDDLEWARE =====
app.use(cors());
app.use(express.json());

// ===== STATIC FILES =====
app.use(express.static(path.join(__dirname, "frontend")));

// ROUTES
const authRoutes = require("./routes/auth");
const appRoutes = require("./routes/applications");

app.use("/api/auth", require("./routes/auth"));
app.use("/api/applications", require("./routes/applications"));

// FILE UPLOAD (multer)
const multer = require("multer");

const storage = multer.diskStorage({
  destination: "uploads/",
  filename: (req, file, cb) => {
    cb(null, Date.now() + "-" + file.originalname);
  }
});

const upload = multer({ storage });

app.post("/upload/:id", upload.single("file"), async (req, res) => {
  const appId = req.params.id;

  await pool.query(
    "INSERT INTO files (application_id, filename, filepath) VALUES ($1,$2,$3)",
    [appId, req.file.originalname, req.file.filename]
  );
  await pool.query(
    "INSERT INTO notifications (message) VALUES ($1)",
    [`Application ${id} moved to ${status}`]
    
  );
  res.send("File uploaded");
});
const { Pool } = require("pg");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});
async function initDB() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email TEXT,
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
        created_by TEXT,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
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
      CREATE TABLE IF NOT EXISTS timeline (
        id SERIAL PRIMARY KEY,
        application_id INT,
        action TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // ✅ INSERT DEFAULT USER (if not exists)
    await pool.query(`
      INSERT INTO users (email, password, role)
      VALUES ('owner@test.com', '1234', 'owner')
      ON CONFLICT DO NOTHING;
    `);

    console.log("Database initialized ✅");

  } catch (err) {
    console.error("DB INIT ERROR:", err);
  }
}

// PDF REPORT
const PDFDocument = require("pdfkit");

app.get("/report/:id", (req, res) => {
  const doc = new PDFDocument();

  res.setHeader("Content-Type", "application/pdf");
  doc.pipe(res);

  doc.text("MENESAH REPORT");
  doc.text("Application ID: " + req.params.id);

  doc.end();
});

// START SERVER
const PORT = process.env.PORT || 3000;

initDB().then(() => {
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
});