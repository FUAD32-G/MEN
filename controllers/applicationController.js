const pool = require("../config/db");

// CREATE
exports.apply = async (req, res) => {
  try {
    const {
      full_name,
      phone,
      country,
      passport_number,
      age,
      coc_status
    } = req.body;

    if (!full_name) {
      return res.status(400).send("Full name required");
    }

    const result = await pool.query(
      `INSERT INTO applications 
      (full_name, phone, country, passport_number, age, coc_status) 
      VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [full_name, phone, country, passport_number, age, coc_status]
    );

    res.send(result.rows[0]);

  } catch (err) {
    console.error("APPLY ERROR:", err.message);
    res.status(500).send(err.message);
  }
};
exports.getAll = async (req, res) => {
  try {
    const role = req.user.role;

    let query = "SELECT * FROM applications";

    if (role === "partner") {
      query += " WHERE status = 'Approved'";
    }

    if (role === "it") {
      query += " WHERE status IN ('Approved','Medical','LMIS')";
    }

    if (role === "receptionist") {
      query += " WHERE status = 'Applied'";
    }

    if (role === "owner") {
      query += " ORDER BY id DESC";
    }

    const result = await pool.query(query);
    res.send(result.rows);

  } catch (err) {
    res.status(500).send(err.message);
  }
};
exports.getFiles = async (req, res) => {
  const id = req.params.id;

  const result = await pool.query(
    "SELECT * FROM files WHERE application_id=$1",
    [id]
  );

  res.send(result.rows);
};
exports.getOne = async (req, res) => {
  try {
    const id = req.params.id;

    const result = await pool.query(
      "SELECT * FROM applications WHERE id=$1",
      [id]
    );

    res.send(result.rows[0]);
  } catch (err) {
    res.status(500).send(err.message);
  }
};
exports.getTimeline = async (req, res) => {
  const id = req.params.id;

  const result = await pool.query(
    "SELECT * FROM history WHERE application_id=$1 ORDER BY created_at DESC",
    [id]
  );

  res.send(result.rows);
};
// UPDATE
exports.update = async (req, res) => {
  try {
    const id = req.params.id;
    const { status } = req.body;
    const role = req.user.role;

    // ROLE RULES
    if (role === "receptionist" && status !== "Approved") {
      return res.status(403).send("Receptionist can only approve");
    }

    if (role === "it" && !["Medical", "LMIS"].includes(status)) {
      return res.status(403).send("IT can only set Medical or LMIS");
    }

    if (role === "secretary" && status !== "Tasheer") {
      return res.status(403).send("Secretary can only set Tasheer");
    }

    if (role === "executor" && status !== "Ticket") {
      return res.status(403).send("Executor can only set Ticket");
    }

    if (role === "owner" && status !== "Ready") {
      return res.status(403).send("Owner can only set Ready");
    }

    const result = await pool.query(
      "UPDATE applications SET status=$1 WHERE id=$2 RETURNING *",
      [status, id]
    );

    res.send(result.rows[0]);

  } catch (err) {
    console.error(err.message);
    res.status(500).send(err.message);
  }
};