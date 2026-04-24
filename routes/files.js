const express = require("express");
const multer = require("multer");
const auth = require("../middleware/authMiddleware");

const upload = multer({ dest: "uploads/" });

module.exports = (pool) => {
  const router = express.Router();

  router.post("/", auth, upload.single("file"), async (req, res) => {
    const { application_id } = req.body;

    await pool.query(
      "INSERT INTO files (application_id, filename, filepath) VALUES ($1,$2,$3)",
      [application_id, req.file.originalname, req.file.filename]
    );

    res.json({ message: "Uploaded" });
  });

  router.get("/:id", auth, async (req, res) => {
    const result = await pool.query(
      "SELECT * FROM files WHERE application_id=$1",
      [req.params.id]
    );

    res.json(result.rows);
  });

  return router;
};