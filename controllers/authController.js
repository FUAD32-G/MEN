const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const pool = require("../config/db");

exports.register = async (req, res) => {
  try {
    const { name, email, password, role } = req.body;

    const hashed = await bcrypt.hash(password, 10);

    const result = await pool.query(
      "INSERT INTO users (name, email, password, role) VALUES ($1,$2,$3,$4) RETURNING *",
      [name, email, hashed, role]
    );

    res.send(result.rows[0]);
  } catch (err) {
    console.error(err.message);
    res.status(500).send(err.message);
  }
};

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    const result = await pool.query(
      "SELECT * FROM users WHERE email=$1",
      [email]
    );

    const user = result.rows[0];

    if (!user) return res.status(401).send("User not found");

    const match = await bcrypt.compare(password, user.password);

    if (!match) return res.status(401).send("Wrong password");

    const token = jwt.sign(
      { id: user.id, role: user.role },
      "SECRET",
      { expiresIn: "1d" }
    );

    res.send({ token, user });
  } catch (err) {
    console.error(err.message);
    res.status(500).send(err.message);
  }
};