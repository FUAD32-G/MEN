const express = require("express");
const cors = require("cors");
require("dotenv").config();

app.use(cors());
const app = express();

app.use(cors());
app.use(express.json());

// ROUTES
const authRoutes = require("./routes/auth");
const appRoutes = require("./routes/applications");

app.use("/api/auth", authRoutes);
app.use("/api/applications", appRoutes);

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
const path = require("path");
app.use(express.static(path.join(__dirname, "frontend")));
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
const PORT = process.env.PORT || 3000;
// START SERVER
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});