const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./database.sqlite');
const adminHash = '$2b$10$kzOslSASLTVaqbM0mRtbDOQQJOARQTLlwzmvtuafDMnHSawIEvugK'; // Reliance@1024
db.run(`INSERT OR IGNORE INTO users (name, email, password, role, status) VALUES (?, ?, ?, ?, ?)`, ['Admin Commute Controller', 'admin@reliance.com', adminHash, 'Admin', 'Active'], function(err) {
  if (err) console.error(err);
  else console.log('Admin inserted, lastID:', this.lastID);
});
