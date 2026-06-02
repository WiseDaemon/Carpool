const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./database.sqlite');

db.serialize(() => {
  db.run("PRAGMA foreign_keys=off;");
  db.run("BEGIN TRANSACTION;");
  
  db.run(`CREATE TABLE users_new (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    emp_id TEXT,
    gender TEXT,
    password TEXT,
    role TEXT NOT NULL CHECK(role IN ('Pool Host', 'Passenger', 'Admin')),
    has_vehicle_pass BOOLEAN DEFAULT 0,
    vehicle_no TEXT,
    vehicle_make TEXT,
    vehicle_model TEXT,
    vehicle_capacity TEXT,
    status TEXT DEFAULT 'Active',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(email, role)
  )`);
  
  db.run(`INSERT INTO users_new (id, name, email, emp_id, gender, password, role, has_vehicle_pass, vehicle_no, vehicle_make, vehicle_model, vehicle_capacity, status, created_at)
          SELECT id, name, email, emp_id, gender, password, 
          CASE WHEN role = 'Pool Host' THEN 'Pool Host' ELSE role END AS role, 
          has_vehicle_pass, vehicle_no, vehicle_make, vehicle_model, vehicle_capacity, status, created_at
          FROM users`);
          
  db.run("DROP TABLE users");
  db.run("ALTER TABLE users_new RENAME TO users");
    
  db.run("COMMIT;");
  db.run("PRAGMA foreign_keys=on;", (err) => {
    if (err) console.error("Migration error:", err);
    else console.log("Migration complete: Pool Host renamed to Pool Host!");
  });
});
