const { Pool } = require("pg");

const pool = new Pool({
  user: "postgres",
  host: "localhost",
  database: "mycompany",
  password: "Ranger@32",
  port: 5432
});

module.exports = pool;