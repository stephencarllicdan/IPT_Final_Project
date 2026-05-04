const express = require("express");
const mysql = require("mysql");
const cors = require("cors");
const bcrypt = require("bcrypt");

const app = express();

app.use(cors());
app.use(express.json());

const db = mysql.createConnection({
  host: process.env.MYSQLHOST,
  user: process.env.MYSQLUSER,
  password: process.env.MYSQLPASSWORD,
  database: process.env.MYSQLDATABASE,
  port: process.env.MYSQLPORT
});

db.connect(err => {
  if (err) {
    console.log("DB Error:", err);
  } else {
    console.log("MySQL Connected");
  }
});

app.post("/register", async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!email || !password) {
      return res.json({ success: false, message: "Missing fields" });
    }

    db.query("SELECT * FROM users WHERE email=?", [email], async (err, result) => {
      if (err) {
        console.log(err);
        return res.json({ success: false });
      }

      if (result.length > 0) {
        return res.json({ success: false, message: "Email already exists" });
      }

      const hashedPassword = await bcrypt.hash(password, 10);

      db.query(
        "INSERT INTO users (name,email,password) VALUES (?,?,?)",
        [name || "User", email, hashedPassword],
        (err) => {
          if (err) {
            console.log(err);
            return res.json({ success: false });
          }

          res.json({ success: true });
        }
      );
    });

  } catch (error) {
    console.log(error);
    res.json({ success: false });
  }
});

app.post("/login", (req, res) => {
  const { email, password } = req.body;

  db.query("SELECT * FROM users WHERE email=?", [email], async (err, result) => {
    if (err) {
      console.log(err);
      return res.json({ success: false });
    }

    if (result.length > 0) {
      const user = result[0];

      const match = await bcrypt.compare(password, user.password);

      if (match) {
        res.json({ success: true, user });
      } else {
        res.json({ success: false, message: "Wrong password" });
      }
    } else {
      res.json({ success: false, message: "User not found" });
    }
  });
});

app.get("/requests", (req, res) => {
  let search = req.query.search;

  let sql = "SELECT * FROM requests";
  let values = [];

  if (search && search.trim() !== "") {
    search = "%" + search.trim().toLowerCase() + "%";
    sql += " WHERE LOWER(TRIM(title)) LIKE ?";
    values.push(search);
  }

  sql += " ORDER BY id DESC";

  db.query(sql, values, (err, result) => {
    if (err) {
      console.log(err);
      return res.json([]);
    }

    res.json(result);
  });
});

app.post("/requests", (req, res) => {
  let { user_id, title, description } = req.body;

  if (!title || !description) {
    return res.json({ success: false });
  }

  title = title.trim();
  description = description.trim();

  db.query(
    "INSERT INTO requests (user_id,title,description,status) VALUES (?,?,?,?)",
    [user_id || 1, title, description, "pending"],
    (err) => {
      if (err) {
        console.log(err);
        return res.json({ success: false });
      }

      res.json({ success: true });
    }
  );
});

app.put("/requests/:id", (req, res) => {
  let { title, description, status } = req.body;
  const id = req.params.id;

  if (!title || !description || !status) {
    return res.json({ success: false });
  }

  title = title.trim();
  description = description.trim();
  status = status.trim().toLowerCase();

  db.query(
    "UPDATE requests SET title=?, description=?, status=? WHERE id=?",
    [title, description, status, id],
    (err) => {
      if (err) {
        console.log(err);
        return res.json({ success: false });
      }

      res.json({ success: true });
    }
  );
});

app.delete("/requests/:id", (req, res) => {
  const id = req.params.id;

  db.query("DELETE FROM requests WHERE id=?", [id], (err) => {
    if (err) {
      console.log(err);
      return res.json({ success: false });
    }

    res.json({ success: true });
  });
});

app.get("/dashboard", (req, res) => {
  db.query(`
    SELECT 
      COUNT(*) AS total,
      SUM(CASE WHEN LOWER(TRIM(status))='pending' THEN 1 ELSE 0 END) AS pending,
      SUM(CASE WHEN LOWER(TRIM(status))='done' THEN 1 ELSE 0 END) AS done
    FROM requests
  `, (err, result) => {

    if (err) {
      console.log(err);
      return res.json({ total: 0, pending: 0, done: 0 });
    }

    res.json({
      total: result[0].total || 0,
      pending: result[0].pending || 0,
      done: result[0].done || 0
    });
  });
});

app.get("/fix-data", (req, res) => {
  db.query(
    "UPDATE requests SET status = LOWER(TRIM(status))",
    (err) => {
      if (err) {
        console.log(err);
        return res.json({ success: false });
      }

      res.json({ success: true });
    }
  );
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("Server running on port " + PORT);
});