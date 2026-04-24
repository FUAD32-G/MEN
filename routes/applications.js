const express = require("express");
const auth = require("../middleware/authMiddleware");

module.exports = (pool) => {
  const router = express.Router();

  // ===== GET (ROLE-BASED) =====
  router.get("/", auth, async (req, res) => {
    try {
      let query = "SELECT * FROM applications ORDER BY id DESC";

      if (req.user.role === "receptionist") {
        query = "SELECT * FROM applications WHERE status='Applied' ORDER BY id DESC";
      } else if (req.user.role === "it") {
        query = "SELECT * FROM applications WHERE status='Approved' ORDER BY id DESC";
      } else if (req.user.role === "partner") {
        query = "SELECT * FROM applications WHERE status='Medical' ORDER BY id DESC";
      }

      const result = await pool.query(query);
      res.json(result.rows);
    } catch (err) {
      console.error("GET /applications error:", err.message);
      res.status(500).json({ message: "Server error" });
    }
  });

  // ===== CREATE =====
  router.post("/", async (req, res) => {
    try {
      const { full_name, passport_number, age } = req.body;

      if (!full_name || !passport_number || !age) {
        return res.status(400).json({ message: "Missing fields" });
      }

      const result = await pool.query(
        "INSERT INTO applications (full_name, passport_number, age) VALUES ($1,$2,$3) RETURNING *",
        [full_name, passport_number, age]
      );

      // timeline
      await pool.query(
        "INSERT INTO timeline (application_id, action) VALUES ($1,$2)",
        [result.rows[0].id, "Created"]
      );
      await pool.query(
       "INSERT INTO notifications (message) VALUES ($1)",
       [`New application: ${full_name}`]
      );
      await pool.query(
     "INSERT INTO notifications (message) VALUES ($1)",
     [`Application ${req.params.id} moved to ${status}`]
     );

      res.json(result.rows[0]);
    } catch (err) {
      console.error("POST /applications error:", err.message);
      res.status(500).json({ message: "Server error" });
    }
  });

  // ===== UPDATE STATUS =====
  router.put("/:id", auth, async (req, res) => {
    try {
      const { status } = req.body;

      if (!status) {
        return res.status(400).json({ message: "Missing status" });
      }

      await pool.query(
        "UPDATE applications SET status=$1 WHERE id=$2",
        [status, req.params.id]
      );

      await pool.query(
        "INSERT INTO timeline (application_id, action) VALUES ($1,$2)",
        [req.params.id, `Moved to ${status}`]
      );

      res.json({ message: "Updated" });
    } catch (err) {
      console.error("PUT /applications error:", err.message);
      res.status(500).json({ message: "Server error" });
    }
  });

  // ===== STATS =====
  router.get("/stats", auth, async (req, res) => {
    try {
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
    } catch (err) {
      console.error("GET /stats error:", err.message);
      res.status(500).json({ message: "Server error" });
    }
  });

  // ===== TIMELINE =====
  router.get("/timeline/:id", auth, async (req, res) => {
    try {
      const result = await pool.query(
        "SELECT * FROM timeline WHERE application_id=$1 ORDER BY created_at DESC",
        [req.params.id]
      );

      res.json(result.rows);
    } catch (err) {
      console.error("GET /timeline error:", err.message);
      res.status(500).json({ message: "Server error" });
    }
  });

  return router;
};