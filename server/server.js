const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
require('dotenv').config();
const fs = require('fs');
const http = require('http');
const { Server } = require('socket.io');
const multer = require('multer');
const path = require('path');

const app = express();
const port = process.env.PORT || 3001;

// Setup static serving for uploads
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Ensure uploads directory exists
if (!fs.existsSync(path.join(__dirname, 'uploads'))) {
  fs.mkdirSync(path.join(__dirname, 'uploads'));
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/')
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + '-' + Math.round(Math.random() * 1E9) + path.extname(file.originalname))
  }
});
const upload = multer({ storage: storage });

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ["GET", "POST"]
  }
});
app.set('io', io);

io.on('connection', (socket) => {
  console.log('A user connected via WebSocket');
  
  // Users can join a room with their user ID to receive targeted notifications
  socket.on('join', (userId) => {
    socket.join(`user_${userId}`);
    console.log(`User ${userId} joined their personal room.`);
  });
  
  socket.on('join_admin', () => {
    socket.join('admin_room');
    console.log('An Admin joined the admin room.');
  });

  socket.on('disconnect', () => {
    console.log('User disconnected');
  });
});

// ─── AI Provider Configuration ────────────────────────────────────────────────
// Switch between "nvidia" and "gemini" via the AI_PROVIDER env variable.
const AI_PROVIDER = (process.env.AI_PROVIDER || 'nvidia').toLowerCase();

// ─── Shared System Prompt & Knowledge Base ────────────────────────────────────
let systemPrompt = "You are Commute Copilot, the AI assistant for Reliance Commuter Connect — a corporate carpooling platform for Reliance Industries employees. You help users find and book rides, list new commutes, answer questions about personal stats/earnings, and clarify carpool policies. IMPORTANT: Use the draft_booking tool when a user wants to find or book a ride. Use the draft_listing tool when a driver wants to offer a ride. Never invent ride details — if origin, destination, or time are unclear, ask the user. When answering stats questions, use the live data in the [System Note] prefix.";
try {
  const reqPath = 'C:\\Users\\saxen\\Downloads\\carpool_requirements.md';
  if (fs.existsSync(reqPath)) {
    systemPrompt += "\n\n--- KNOWLEDGE BASE ---\n" + fs.readFileSync(reqPath, 'utf8');
  }
} catch (e) {
  console.log('Could not load knowledge base file.');
}

// ─── OpenAI-compatible tool definitions (used by NVIDIA NIM & Gemini adapter) ─
const CARPOOL_TOOLS = [
  {
    type: 'function',
    function: {
      name: 'draft_booking',
      description: 'Drafts a ride booking request when the user wants to find or book a ride. Call this whenever the user expresses intent to book, search, or request a ride.',
      parameters: {
        type: 'object',
        properties: {
          origin:      { type: 'string', description: 'Pickup location (street, area or landmark)' },
          destination: { type: 'string', description: 'Drop-off location (street, area or landmark)' },
          time:        { type: 'string', description: 'Desired departure time in HH:MM 24-hour format (e.g., 09:00)' }
        },
        required: ['origin', 'destination', 'time']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'draft_listing',
      description: 'Drafts a new commute ride listing when a Pool Host (driver) wants to offer seats. Call this when the driver mentions offering a ride, adding a commute, or listing seats.',
      parameters: {
        type: 'object',
        properties: {
          origin:      { type: 'string', description: 'Start location of the commute' },
          destination: { type: 'string', description: 'End location of the commute' },
          time:        { type: 'string', description: 'Departure time in HH:MM 24-hour format (e.g., 08:30)' },
          seats:       { type: 'integer', description: 'Number of seats being offered (1–6)' },
          price:       { type: 'integer', description: 'Price per seat in INR (e.g., 50)' }
        },
        required: ['origin', 'destination', 'time', 'seats', 'price']
      }
    }
  }
];

// ─── NVIDIA NIM Client (OpenAI-compatible) ────────────────────────────────────
let nvidiaClient = null;
const NVIDIA_MODEL = process.env.NVIDIA_MODEL || 'meta/llama-3.3-70b-instruct';

if (AI_PROVIDER === 'nvidia') {
  if (!process.env.NVIDIA_API_KEY || process.env.NVIDIA_API_KEY === 'nvapi-YOUR_KEY_HERE') {
    console.warn('[AI] ⚠️  NVIDIA_API_KEY not configured. AI Copilot will be unavailable.');
    console.warn('[AI]    Get your key at https://build.nvidia.com → "Get API Key"');
  } else {
    try {
      const OpenAI = require('openai');
      nvidiaClient = new OpenAI({
        apiKey: process.env.NVIDIA_API_KEY,
        baseURL: 'https://integrate.api.nvidia.com/v1',
      });
      console.log(`[AI] ✅ NVIDIA NIM ready — model: ${NVIDIA_MODEL}`);
    } catch (e) {
      console.error('[AI] Failed to initialise NVIDIA client:', e.message);
    }
  }
}

// ─── Google Gemini Client (fallback / legacy) ─────────────────────────────────
let geminiModel = null;

if (AI_PROVIDER === 'gemini' || !nvidiaClient) {
  try {
    const { GoogleGenerativeAI } = require('@google/generative-ai');
    const genAI = process.env.GEMINI_API_KEY ? new GoogleGenerativeAI(process.env.GEMINI_API_KEY) : null;
    if (genAI) {
      geminiModel = genAI.getGenerativeModel({
        model: 'gemini-2.5-flash-lite',
        systemInstruction: systemPrompt,
        tools: [{
          functionDeclarations: CARPOOL_TOOLS.map(t => ({
            name: t.function.name,
            description: t.function.description,
            parameters: {
              type: 'OBJECT',
              properties: Object.fromEntries(
                Object.entries(t.function.parameters.properties).map(([k, v]) => [
                  k, { type: v.type.toUpperCase(), description: v.description }
                ])
              ),
              required: t.function.parameters.required
            }
          }))
        }]
      });
      console.log(`[AI] ✅ Google Gemini ready (fallback) — model: gemini-2.5-flash-lite`);
    }
  } catch(e) {
    console.warn('[AI] Gemini SDK not available:', e.message);
  }
}

// Convenience: which AI is active?
const activeAI = nvidiaClient ? 'nvidia' : (geminiModel ? 'gemini' : null);
if (!activeAI) console.warn('[AI] ⚠️  No AI provider configured. /api/chat will return 500.');
else console.log(`[AI] Active provider: ${activeAI.toUpperCase()}`);

const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const webpush = require('web-push');

if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    process.env.VAPID_EMAIL || 'mailto:admin@reliance.com',
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );
}

// Push notification helper
const sendPushToUser = (userId, title, body, url = '/') => {
  if (!process.env.VAPID_PUBLIC_KEY) return;
  
  db.all(`SELECT * FROM push_subscriptions WHERE user_id = ?`, [userId], (err, subscriptions) => {
    if (err || !subscriptions) return;
    const payload = JSON.stringify({ title, body, url });
    subscriptions.forEach(sub => {
      const pushSubscription = {
        endpoint: sub.endpoint,
        keys: { p256dh: sub.p256dh, auth: sub.auth }
      };
      webpush.sendNotification(pushSubscription, payload).catch(error => {
        if (error.statusCode === 410 || error.statusCode === 404) {
          db.run(`DELETE FROM push_subscriptions WHERE endpoint = ?`, [sub.endpoint]);
        }
      });
    });
  });
};

// Strict Secret Check
if (!process.env.JWT_SECRET) {
  console.error("FATAL ERROR: JWT_SECRET is not defined in the environment. Please add JWT_SECRET to your .env file.");
  process.exit(1);
}

// Rate limiting middleware
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: { error: 'Too many requests, please try again later.' }
});

// Middleware
app.use(cors({ 
  origin: '*',
  exposedHeaders: ['X-New-Token'] 
}));
app.use(express.json());
app.use('/api/', apiLimiter);

const authenticateToken = (req, res, next) => {
  // Allow unauthenticated access to login, register, forgot-password, and reset-password
  if (req.path === '/auth/login' || req.path === '/register' || req.path === '/auth/forgot-password' || req.path === '/auth/reset-password') {
    return next();
  }

  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) return res.status(401).json({ error: 'Access token required.' });
  
  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) return res.status(401).json({ error: 'Invalid or expired token. Please log in again.' });
    
    // Refresh token on activity (sliding session)
    const newToken = jwt.sign(
      { id: user.id, email: user.email, role: user.role, name: user.name, gender: user.gender }, 
      process.env.JWT_SECRET, 
      { expiresIn: '15m' }
    );
    res.setHeader('X-New-Token', newToken);

    req.user = user;
    next();
  });
};

app.use('/api/', authenticateToken);

// Database setup
const db = new sqlite3.Database('./database.sqlite', (err) => {
  if (err) {
    console.error('Error connecting to database:', err.message);
  } else {
    console.log('Connected to the SQLite database.');
    initializeSchema();
  }
});

function initializeSchema() {
  db.serialize(() => {
    // Users Table
    db.run(`CREATE TABLE IF NOT EXISTS users (
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
      no_show_count INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(email, role)
    )`, [], (err) => {
      if (!err) {
        db.serialize(() => {
          db.run(`ALTER TABLE users ADD COLUMN status TEXT DEFAULT 'Active'`, [], () => {});
          db.run(`ALTER TABLE users ADD COLUMN no_show_count INTEGER DEFAULT 0`, [], () => {});
          db.run(`ALTER TABLE users ADD COLUMN emp_id TEXT`, [], () => {});
          db.run(`ALTER TABLE users ADD COLUMN gender TEXT`, [], () => {});
          db.run(`ALTER TABLE users ADD COLUMN avatar_url TEXT`, [], () => {});
          db.run(`ALTER TABLE users ADD COLUMN penalty_points INTEGER DEFAULT 0`, [], () => {});
          db.run(`ALTER TABLE users ADD COLUMN suspended_until DATETIME`, [], () => {});
          db.run(`ALTER TABLE users ADD COLUMN password TEXT`, [], () => {
            // Seed default passwords for existing users
            const defaultHash = '$2b$10$RmRqG9A5Q68w4jGd1L4YjOCD/z76Sb/O1V4eH9eVKyvyf.npBA/AO'; // Password123!
            db.run(`UPDATE users SET password = ? WHERE password IS NULL OR password = ''`, [defaultHash]);
            
            // Seed Admin User
            const adminHash = '$2b$10$kzOslSASLTVaqbM0mRtbDOQQJOARQTLlwzmvtuafDMnHSawIEvugK'; // Reliance@1024
            db.run(`INSERT OR IGNORE INTO users (name, email, password, role, status) VALUES (?, ?, ?, ?, ?)`, ['Admin Commute Controller', 'admin@reliance.com', adminHash, 'Admin', 'Active']);
          });
        });
      }
    });

    // Password Resets Table
    db.run(`CREATE TABLE IF NOT EXISTS password_resets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL,
      token TEXT NOT NULL,
      expires_at DATETIME NOT NULL,
      used BOOLEAN DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // Rides Table
    db.run(`CREATE TABLE IF NOT EXISTS rides (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      driver_id INTEGER NOT NULL,
      origin TEXT NOT NULL,
      destination TEXT NOT NULL,
      origin_lat REAL,
      origin_lng REAL,
      dest_lat REAL,
      dest_lng REAL,
      route_polyline TEXT,
      departure_time TEXT NOT NULL,
      recurring_days TEXT DEFAULT 'Mon,Tue,Wed,Thu,Fri',
      seats_offered INTEGER,
      original_seats INTEGER,
      price_per_seat REAL,
      women_only BOOLEAN DEFAULT 0,
      status TEXT DEFAULT 'Scheduled',
      expected_duration_mins INTEGER,
      actual_start_time DATETIME,
      delay_reminder_sent INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (driver_id) REFERENCES users (id)
    )`, [], (err) => {
      if (!err) {
        // Safe Alter for new columns
        db.run(`ALTER TABLE rides ADD COLUMN expected_duration_mins INTEGER`, () => {});
        db.run(`ALTER TABLE rides ADD COLUMN actual_start_time DATETIME`, () => {});
        db.run(`ALTER TABLE rides ADD COLUMN delay_reminder_sent INTEGER DEFAULT 0`, () => {});
        db.run(`ALTER TABLE rides ADD COLUMN women_only BOOLEAN DEFAULT 0`, [], () => {});
        db.run(`ALTER TABLE rides ADD COLUMN original_seats INTEGER`, [], () => {
          db.run(`UPDATE rides SET original_seats = seats_offered WHERE original_seats IS NULL`);
        });
        db.run(`ALTER TABLE rides ADD COLUMN route_polyline TEXT`, [], () => {});
        db.run(`ALTER TABLE rides ADD COLUMN recurring_days TEXT DEFAULT 'Mon,Tue,Wed,Thu,Fri'`, [], () => {});
      }
    });

    // RideRequests Table
    db.run(`CREATE TABLE IF NOT EXISTS ride_requests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ride_id INTEGER,
      passenger_listing_id INTEGER,
      passenger_id INTEGER NOT NULL,
      requested_days TEXT DEFAULT 'Mon,Tue,Wed,Thu,Fri',
      status TEXT DEFAULT 'Pending',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (ride_id) REFERENCES rides (id),
      FOREIGN KEY (passenger_id) REFERENCES users (id)
    )`, [], (err) => {
      if (!err) {
        db.run(`ALTER TABLE ride_requests ADD COLUMN created_at DATETIME DEFAULT CURRENT_TIMESTAMP`, [], () => {});
        db.run(`ALTER TABLE ride_requests ADD COLUMN passenger_listing_id INTEGER`, [], () => {});
        db.run(`ALTER TABLE ride_requests ADD COLUMN requested_days TEXT DEFAULT 'Mon,Tue,Wed,Thu,Fri'`, [], () => {});
        db.run(`ALTER TABLE ride_requests ADD COLUMN pickup_lat REAL`, [], () => {});
        db.run(`ALTER TABLE ride_requests ADD COLUMN pickup_lng REAL`, [], () => {});
      }
    });

    // Passenger Listings Table (Reverse Matching)
    db.run(`CREATE TABLE IF NOT EXISTS passenger_listings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      passenger_id INTEGER NOT NULL,
      origin TEXT NOT NULL,
      destination TEXT NOT NULL,
      origin_lat REAL,
      origin_lng REAL,
      dest_lat REAL,
      dest_lng REAL,
      departure_time TEXT NOT NULL,
      recurring_days TEXT DEFAULT 'Mon,Tue,Wed,Thu,Fri',
      status TEXT DEFAULT 'Active',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (passenger_id) REFERENCES users (id)
    )`);

    // Trip Logs Table (Daily records for recurring rides)
    db.run(`CREATE TABLE IF NOT EXISTS trip_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ride_id INTEGER NOT NULL,
      date TEXT NOT NULL,
      status TEXT DEFAULT 'Completed',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (ride_id) REFERENCES rides (id),
      UNIQUE(ride_id, date)
    )`);

    // Incidents Table
    db.run(`CREATE TABLE IF NOT EXISTS incidents (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      reported_by INTEGER NOT NULL,
      type TEXT NOT NULL,
      status TEXT DEFAULT 'Open',
      sla_deadline DATETIME NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (reported_by) REFERENCES users (id)
    )`);

    // Notifications Table
    db.run(`CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      message TEXT NOT NULL,
      type TEXT NOT NULL,
      action_data TEXT,
      is_read BOOLEAN DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users (id)
    )`);

    // Messages Table
    db.run(`CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      request_id INTEGER NOT NULL,
      sender_id INTEGER NOT NULL,
      content TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (request_id) REFERENCES ride_requests(id),
      FOREIGN KEY (sender_id) REFERENCES users(id)
    )`);

    // Ratings Table
    db.run(`CREATE TABLE IF NOT EXISTS ratings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      trip_id INTEGER NOT NULL,
      rater_id INTEGER NOT NULL,
      ratee_id INTEGER NOT NULL,
      stars INTEGER NOT NULL CHECK(stars >= 1 AND stars <= 5),
      tags TEXT,
      comment TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (trip_id) REFERENCES rides(id),
      FOREIGN KEY (rater_id) REFERENCES users(id),
      FOREIGN KEY (ratee_id) REFERENCES users(id)
    )`);

    // Push Subscriptions Table
    db.run(`CREATE TABLE IF NOT EXISTS push_subscriptions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      endpoint TEXT NOT NULL UNIQUE,
      p256dh TEXT NOT NULL,
      auth TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users (id)
    )`);
  });
}

// Haversine formula in KM
function getDistanceFromLatLonInKm(lat1, lon1, lat2, lon2) {
  var R = 6371; // Radius of the earth in km
  var dLat = deg2rad(lat2-lat1);  
  var dLon = deg2rad(lon2-lon1); 
  var a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) * 
    Math.sin(dLon/2) * Math.sin(dLon/2)
    ; 
  var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
  var d = R * c; // Distance in km
  return d;
}

function deg2rad(deg) {
  return deg * (Math.PI/180)
}

// API Endpoints

// GET VAPID public key
app.get('/api/push/vapid-public-key', (req, res) => {
  res.json({ publicKey: process.env.VAPID_PUBLIC_KEY });
});

// POST save subscription
app.post('/api/push/subscribe', (req, res) => {
  const { endpoint, keys } = req.body;
  if (!endpoint || !keys) return res.status(400).json({ error: 'Invalid subscription object' });
  
  db.run(
    `INSERT OR IGNORE INTO push_subscriptions (user_id, endpoint, p256dh, auth) VALUES (?, ?, ?, ?)`,
    [req.user.id, endpoint, keys.p256dh, keys.auth],
    function(err) {
      if (err) return res.status(500).json({ error: 'Failed to save subscription' });
      res.status(201).json({ message: 'Subscribed successfully' });
    }
  );
});

// DELETE remove subscription
app.delete('/api/push/subscribe', (req, res) => {
  const { endpoint } = req.body;
  if (!endpoint) return res.status(400).json({ error: 'Endpoint required' });
  
  db.run(`DELETE FROM push_subscriptions WHERE user_id = ? AND endpoint = ?`, [req.user.id, endpoint], function(err) {
    if (err) return res.status(500).json({ error: 'Failed to remove subscription' });
    res.json({ message: 'Unsubscribed successfully' });
  });
});

async function recalculateMultiStopRoute(rideId, io) {
  db.get('SELECT * FROM rides WHERE id=?', [rideId], async (err, ride) => {
    if (!ride) return;
    // Fetch accepted passengers with pickup coords
    db.all(
      `SELECT rr.pickup_lat, rr.pickup_lng FROM ride_requests rr
       WHERE rr.ride_id=? AND rr.status='Accepted'
       AND rr.pickup_lat IS NOT NULL ORDER BY rr.created_at ASC`,
      [rideId],
      async (err, stops) => {
        // Build waypoints: driver_origin -> passenger stops -> destination
        const waypoints = [
          `${ride.origin_lng},${ride.origin_lat}`,
          ...stops.map(s => `${s.pickup_lng},${s.pickup_lat}`),
          `${ride.dest_lng},${ride.dest_lat}`
        ].join(';');
        try {
          const r = await fetch(
            `http://router.project-osrm.org/route/v1/driving/${waypoints}?geometries=geojson&overview=full`
          );
          if (!r.ok) return;
          const data = await r.json();
          if (!data.routes?.length) return;
          const polyline = JSON.stringify(data.routes[0].geometry.coordinates);
          const duration = Math.ceil(data.routes[0].duration / 60);
          db.run('UPDATE rides SET route_polyline=?, expected_duration_mins=? WHERE id=?',
            [polyline, duration, rideId]);
          // Emit new route to driver
          io.to(`user_${ride.driver_id}`).emit('route_updated', {
            ride_id: rideId, route_polyline: polyline, duration_mins: duration
          });
        } catch (e) { console.error('Multi-stop OSRM error', e); }
      }
    );
  });
}

// Get all roles for an email
app.get('/api/users/roles', (req, res) => {
  const email = req.query.email;
  if (!email) return res.status(400).json({ error: 'Email is required' });
  db.all(`SELECT DISTINCT role FROM users WHERE email = ?`, [email], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows.map(r => r.role));
  });
});

// Get all users
app.get('/api/users', (req, res) => {
  if (req.user.role !== 'Admin') {
    return res.status(403).json({ error: 'Access denied: Admin privileges required.' });
  }
  db.all(`SELECT * FROM users ORDER BY created_at DESC`, [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// Admin: Assign Admin Role
app.post('/api/users/:id/assign-admin', (req, res) => {
  if (req.user.role !== 'Admin') return res.status(403).json({ error: 'Admin only' });
  const userId = req.params.id;
  db.run(`UPDATE users SET role = 'Admin' WHERE id = ?`, [userId], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ message: 'User granted Admin privileges successfully' });
  });
});

// Admin: Verify user (grant vehicle pass)
app.post('/api/users/:id/verify', (req, res) => {
  if (req.user.role !== 'Admin') return res.status(403).json({ error: 'Admin only' });
  const userId = req.params.id;
  db.run(`UPDATE users SET has_vehicle_pass = 1 WHERE id = ?`, [userId], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ message: 'User verified successfully' });
  });
});

// Toggle user status (Active / Suspended)
app.post('/api/users/:id/toggle-status', (req, res) => {
  if (req.user.role !== 'Admin') return res.status(403).json({ error: 'Admin only' });
  const userId = req.params.id;
  db.get(`SELECT status FROM users WHERE id = ?`, [userId], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!row) return res.status(404).json({ error: 'User not found' });
    
    const newStatus = row.status === 'Active' ? 'Suspended' : 'Active';
    db.run(`UPDATE users SET status = ? WHERE id = ?`, [newStatus, userId], function(err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ message: `User status updated to ${newStatus}`, status: newStatus });
    });
  });
});

// Update user profile details
app.post('/api/users/:id/update', (req, res) => {
  const userId = req.params.id;
  if (req.user.id !== parseInt(userId) && req.user.role !== 'Admin') {
    return res.status(403).json({ error: 'Unauthorized to modify this profile' });
  }
  const { name, vehicle_no, vehicle_make, vehicle_model, vehicle_capacity } = req.body;
  if (!name || name.length > 100) {
    return res.status(400).json({ error: 'Valid name is required' });
  }
  
  db.run(`
    UPDATE users 
    SET name = ?, vehicle_no = ?, vehicle_make = ?, vehicle_model = ?, vehicle_capacity = ?
    WHERE id = ?
  `, [name, vehicle_no || null, vehicle_make || null, vehicle_model || null, vehicle_capacity || null, userId], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    
    // Fetch and return the updated user object
    db.get(`SELECT * FROM users WHERE id = ?`, [userId], (err, row) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ message: 'Profile updated successfully', user: row });
    });
  });
});

// Login endpoint with bcrypt and JWT
app.post('/api/auth/login', (req, res) => {
  const { email, password, role } = req.body;
  if (!email || !password || !role) {
    return res.status(400).json({ error: 'Email, password, and role are required' });
  }
  db.get(`SELECT * FROM users WHERE email = ? AND role = ?`, [email, role], async (err, user) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!user) return res.status(404).json({ error: 'User not found. Please register first.' });
    const processLogin = async () => {
      try {
        const match = await bcrypt.compare(password, user.password);
        if (!match) {
          return res.status(401).json({ error: 'Invalid password' });
        }

        // Generate JWT
        const token = jwt.sign(
          { id: user.id, email: user.email, role: user.role, name: user.name, gender: user.gender }, 
          process.env.JWT_SECRET, 
          { expiresIn: '15m' }
        );

        // Don't send password hash back to client
        delete user.password;
        res.json({ user, token });
      } catch (compareErr) {
        console.error(compareErr);
        res.status(500).json({ error: 'Authentication processing failed' });
      }
    };

    if (user.status === 'Suspended') {
      if (user.suspended_until && new Date(user.suspended_until) < new Date()) {
        db.run(`UPDATE users SET status = 'Active', penalty_points = 0, suspended_until = NULL WHERE id = ?`, [user.id], (err) => {
          if (err) return res.status(500).json({ error: 'Failed to lift suspension' });
          user.status = 'Active';
          user.penalty_points = 0;
          user.suspended_until = null;
          processLogin();
        });
      } else {
        const msg = user.suspended_until ? `Account suspended until ${new Date(user.suspended_until).toLocaleString()}.` : 'Account suspended.';
        return res.status(403).json({ status: 'Suspended', error: msg });
      }
    } else {
      processLogin();
    }
  });
});

// Forgot Password Endpoint
app.post('/api/auth/forgot-password', (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email is required' });

  db.get(`SELECT id FROM users WHERE email = ?`, [email], (err, user) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!user) {
      // Return success even if not found to prevent email enumeration
      return res.json({ message: 'If an account with that email exists, a reset token has been generated.' });
    }

    const token = require('crypto').randomBytes(3).toString('hex').toUpperCase();
    const expiresAt = new Date(Date.now() + 15 * 60000).toISOString(); // 15 mins

    db.run(`INSERT INTO password_resets (email, token, expires_at) VALUES (?, ?, ?)`, [email, token, expiresAt], function(err) {
      if (err) return res.status(500).json({ error: err.message });
      console.log(`\n\n=== PASSWORD RESET TOKEN FOR ${email}: ${token} ===\n\n`);
      res.json({ message: 'If an account with that email exists, a reset token has been generated. Check backend console.' });
    });
  });
});

// Reset Password Endpoint
app.post('/api/auth/reset-password', (req, res) => {
  const { email, token, newPassword } = req.body;
  if (!email || !token || !newPassword) {
    return res.status(400).json({ error: 'Email, token, and new password are required' });
  }

  if (newPassword.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters long' });
  }

  // Find valid token
  db.get(`SELECT * FROM password_resets WHERE email = ? AND token = ? AND used = 0 AND expires_at > datetime('now')`, [email, token], async (err, resetRecord) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!resetRecord) {
      return res.status(400).json({ error: 'Invalid or expired reset token.' });
    }

    try {
      const hashedPassword = await bcrypt.hash(newPassword, 10);
      db.run(`UPDATE users SET password = ? WHERE email = ?`, [hashedPassword, email], function(err) {
        if (err) return res.status(500).json({ error: 'Failed to update password' });
        
        // Mark token as used
        db.run(`UPDATE password_resets SET used = 1 WHERE id = ?`, [resetRecord.id]);
        res.json({ message: 'Password has been successfully reset. You can now log in.' });
      });
    } catch (hashErr) {
      res.status(500).json({ error: 'Failed to process new password' });
    }
  });
});

// Avatar Upload Endpoint
app.post('/api/users/:id/avatar', upload.single('avatar'), (req, res) => {
  const userId = req.params.id;
  if (req.user.id !== parseInt(userId) && req.user.role !== 'Admin') {
    return res.status(403).json({ error: 'Unauthorized' });
  }
  if (!req.file) {
    return res.status(400).json({ error: 'No image file uploaded' });
  }

  const avatarUrl = `/uploads/${req.file.filename}`;
  db.run(`UPDATE users SET avatar_url = ? WHERE id = ?`, [avatarUrl, userId], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ message: 'Avatar updated successfully', avatar_url: avatarUrl });
  });
});

// Pool Host: get listed rides with pending and accepted passenger counts
app.get('/api/users/:id/rides', (req, res) => {
  const driverId = req.params.id;
  const today = new Date().toISOString().split('T')[0];
  if (req.user.id !== parseInt(driverId) && req.user.role !== 'Admin') {
    return res.status(403).json({ error: 'Unauthorized' });
  }
  db.all(`
    SELECT r.*,
      COALESCE(tl.status, r.status) as status,
      (SELECT COUNT(*) FROM ride_requests rr WHERE rr.ride_id = r.id AND rr.status = 'Pending') as pending_requests,
      (SELECT COUNT(*) FROM ride_requests rr WHERE rr.ride_id = r.id AND rr.status = 'Accepted') as accepted_requests
    FROM rides r
    LEFT JOIN trip_logs tl ON r.id = tl.ride_id AND tl.date = ?
    WHERE r.driver_id = ?
    ORDER BY r.created_at DESC
  `, [today, driverId], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    
    // For each ride, fetch passenger requests details
    const promises = rows.map(ride => {
      return new Promise((resolve, reject) => {
        db.all(`
          SELECT rr.id as request_id, rr.status as request_status, rr.created_at as requested_at,
                 u.id as passenger_id, u.name as passenger_name, u.email as passenger_email, u.avatar_url as passenger_avatar_url
          FROM ride_requests rr
          JOIN users u ON rr.passenger_id = u.id
          WHERE rr.ride_id = ?
        `, [ride.id], (err, requests) => {
          if (err) reject(err);
          else {
            ride.requests = requests;
            resolve(ride);
          }
        });
      });
    });

    Promise.all(promises)
      .then(completedRides => res.json(completedRides))
      .catch(err => res.status(500).json({ error: err.message }));
  });
});

// Passenger: get request history
app.get('/api/users/:id/requests', (req, res) => {
  const passengerId = req.params.id;
  const today = new Date().toISOString().split('T')[0];
  if (req.user.id !== parseInt(passengerId) && req.user.role !== 'Admin') {
    return res.status(403).json({ error: 'Unauthorized' });
  }
  db.all(`
    SELECT rr.id as request_id, rr.status as request_status, rr.created_at as requested_at,
           r.id as ride_id, r.origin, r.destination, r.departure_time, r.price_per_seat, 
           COALESCE(tl.status, r.status) as ride_status,
           u.name as driver_name, u.avatar_url as driver_avatar_url, u.vehicle_no, u.vehicle_make, u.vehicle_model
    FROM ride_requests rr
    JOIN rides r ON rr.ride_id = r.id
    LEFT JOIN trip_logs tl ON r.id = tl.ride_id AND tl.date = ?
    JOIN users u ON r.driver_id = u.id
    WHERE rr.passenger_id = ?
    ORDER BY rr.created_at DESC
  `, [today, passengerId], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// Passenger: submit ride request OR Host: offer ride
app.post('/api/rides/request', (req, res) => {
  const { ride_id, passenger_id, passenger_listing_id, request_type, pickup_lat, pickup_lng } = req.body;
  if (!ride_id || !passenger_id) {
    return res.status(400).json({ error: 'ride_id and passenger_id are required' });
  }

  if (request_type !== 'HostOffer' && req.user.id !== parseInt(passenger_id) && req.user.role !== 'Admin') {
    return res.status(403).json({ error: 'Unauthorized' });
  }

  // Check if request already exists
  db.get(`SELECT id FROM ride_requests WHERE ride_id = ? AND passenger_id = ?`, [ride_id, passenger_id], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    if (row) return res.status(409).json({ error: 'A request/offer already exists.' });

    // Verify ride has seats and is Scheduled
    db.get(`SELECT driver_id, seats_offered, status FROM rides WHERE id = ?`, [ride_id], (err, ride) => {
      if (err) return res.status(500).json({ error: err.message });
      if (!ride) return res.status(404).json({ error: 'Ride not found.' });
      if (ride.status !== 'Scheduled') return res.status(400).json({ error: 'Ride is no longer active.' });
      if (ride.seats_offered <= 0) return res.status(400).json({ error: 'No seats available.' });

      if (request_type === 'HostOffer' && req.user.id !== ride.driver_id && req.user.role !== 'Admin') {
        return res.status(403).json({ error: 'Unauthorized to offer this ride.' });
      }

      const initialStatus = request_type === 'HostOffer' ? 'Offered' : 'Pending';

      const stmt = db.prepare(`INSERT INTO ride_requests (ride_id, passenger_id, passenger_listing_id, pickup_lat, pickup_lng, status) VALUES (?, ?, ?, ?, ?, ?)`);
      stmt.run([ride_id, passenger_id, passenger_listing_id || null, pickup_lat || null, pickup_lng || null, initialStatus], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        
        if (request_type === 'HostOffer') {
          req.app.get('io').to(`user_${passenger_id}`).emit('ride_offered', { message: 'A host has offered to pick you up!', ride_id });
          sendPushToUser(passenger_id, 'Ride Offered', 'A host has offered to pick you up!');
        } else {
          req.app.get('io').to(`user_${ride.driver_id}`).emit('ride_requested', { message: 'You have a new ride request!', ride_id });
          sendPushToUser(ride.driver_id, 'New Ride Request', 'You have a new ride request!');
        }
        
        res.status(201).json({ message: 'Request submitted successfully', requestId: this.lastID });
      });
      stmt.finalize();
    });
  });
});

// Pool Host: cancel ride
app.post('/api/rides/:id/cancel', (req, res) => {
  const rideId = req.params.id;
  db.get(`SELECT * FROM rides WHERE id = ?`, [rideId], (err, cancelledRide) => {
    if (err || !cancelledRide) return res.status(500).json({ error: 'Failed to find ride.' });
    if (cancelledRide.driver_id !== req.user.id && req.user.role !== 'Admin') {
      return res.status(403).json({ error: 'Unauthorized to cancel this ride' });
    }

    // Time-check logic: Block cancellation within 15 mins of departure
    const now = new Date();
    const current_minutes = now.getHours() * 60 + now.getMinutes();
    const [c_hh, c_mm] = cancelledRide.departure_time.split(':').map(Number);
    const cancelled_minutes = c_hh * 60 + c_mm;
    
    if (cancelled_minutes - current_minutes >= 0 && cancelled_minutes - current_minutes <= 15) {
      return res.status(403).json({ error: 'Cancellation is blocked within 15 minutes of departure.' });
    }

    db.run(`UPDATE rides SET status = 'Cancelled' WHERE id = ?`, [rideId], function(err) {
      if (err) return res.status(500).json({ error: err.message });
      
      // Get all passengers with Pending or Accepted requests
      db.all(`SELECT passenger_id FROM ride_requests WHERE ride_id = ? AND status IN ('Pending', 'Accepted')`, [rideId], (err, passengers) => {
        if (err) console.error('Failed to get affected passengers:', err.message);
        
        // Auto-reject any Pending or Accepted requests
        db.run(`UPDATE ride_requests SET status = 'Rejected' WHERE ride_id = ? AND status IN ('Pending', 'Accepted')`, [rideId], (err) => {
          if (err) console.error('Failed to cancel requests:', err.message);
          
          if (passengers && passengers.length > 0) {
            // Convert cancelled ride departure time to minutes
            const [c_hh, c_mm] = cancelledRide.departure_time.split(':').map(Number);
            const cancelled_minutes = c_hh * 60 + c_mm;

            // Fetch alternative Scheduled rides
            db.all(`
              SELECT r.*, u.name as driver_name, u.vehicle_make, u.vehicle_model, u.vehicle_no 
              FROM rides r
              JOIN users u ON r.driver_id = u.id
              WHERE r.status = 'Scheduled' AND r.seats_offered > 0 AND r.id != ?
            `, [rideId], (err, allActiveRides) => {
              if (err || !allActiveRides) return;

              passengers.forEach(p => {
                let matches = [];
                // Helper to find matches within a time deviation window
                const findMatches = (minDev, maxDev) => {
                  let found = [];
                  allActiveRides.forEach(ride => {
                    const [r_hh, r_mm] = ride.departure_time.split(':').map(Number);
                    const ride_minutes = r_hh * 60 + r_mm;
                    const diff = ride_minutes - cancelled_minutes;
                    
                    if (diff >= minDev && diff <= maxDev) {
                      const distOrigin = getDistanceFromLatLonInKm(cancelledRide.origin_lat, cancelledRide.origin_lng, ride.origin_lat, ride.origin_lng);
                      const distDest = getDistanceFromLatLonInKm(cancelledRide.dest_lat, cancelledRide.dest_lng, ride.dest_lat, ride.dest_lng);
                      if (distOrigin <= 3 && distDest <= 3) {
                        found.push({
                          ...ride,
                          dist_origin_km: parseFloat(distOrigin.toFixed(2)),
                          dist_dest_km: parseFloat(distDest.toFixed(2)),
                          total_dist_km: parseFloat((distOrigin + distDest).toFixed(2)),
                          time_deviation_mins: diff
                        });
                      }
                    }
                  });
                  return found;
                };

                // Phase 1: Try +/- 15 mins
                matches = findMatches(-15, 15);
                if (matches.length === 0) {
                  // Phase 2: Try -15 to +30 mins
                  matches = findMatches(-15, 30);
                }

                if (matches.length > 0) {
                  matches.sort((a, b) => a.total_dist_km - b.total_dist_km);
                  // Insert notification
                  const actionData = JSON.stringify(matches);
                  const msg = `Your ride was cancelled by the driver. We found ${matches.length} alternative ride(s) near your original time.`;
                  db.run(`INSERT INTO notifications (user_id, message, type, action_data) VALUES (?, ?, 'RideCancelled_Alternatives', ?)`, [p.passenger_id, msg, actionData]);
                }
              });
            });
          }

          res.json({ message: 'Ride successfully cancelled.' });
        });
      });
    });
  });
});

// Pool Host: complete ride (Daily Log)
app.post('/api/rides/:id/complete', (req, res) => {
  const rideId = req.params.id;
  const today = new Date().toISOString().split('T')[0];
  
  db.get(`SELECT driver_id FROM rides WHERE id = ?`, [rideId], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!row) return res.status(404).json({ error: 'Ride not found' });
    
    db.get(`SELECT id FROM ride_requests WHERE ride_id = ? AND passenger_id = ? AND status = 'Accepted'`, [rideId, req.user.id], (err2, reqRow) => {
      if (row.driver_id !== req.user.id && req.user.role !== 'Admin' && !reqRow) {
        return res.status(403).json({ error: 'Unauthorized to complete this ride' });
      }
      
      db.run(`INSERT INTO trip_logs (ride_id, date, status) VALUES (?, ?, 'Completed') 
              ON CONFLICT(ride_id, date) DO UPDATE SET status = 'Completed'`, [rideId, today], function(err) {
        if (err && err.message.includes('syntax error')) {
           db.run(`UPDATE trip_logs SET status = 'Completed' WHERE ride_id = ? AND date = ?`, [rideId, today]);
        }
        
        // Broadcast ride completion event to driver and all passengers
        db.all(`SELECT passenger_id FROM ride_requests WHERE ride_id = ? AND status = 'Accepted'`, [rideId], (err, passengers) => {
          if (!err) {
            req.app.get('io').to(`user_${row.driver_id}`).emit('ride_completed', { ride_id: rideId });
            passengers.forEach(p => {
              req.app.get('io').to(`user_${p.passenger_id}`).emit('ride_completed', { ride_id: rideId });
            });
          }
        });

        res.json({ message: 'Ride successfully completed for today.' });
      });
    });
  });
});

// Pool Host: notify passengers
// Pool Host: live location update
const last_osrm_check = {};

app.post('/api/rides/:id/location', (req, res) => {
  const rideId = req.params.id;
  const { lat, lng } = req.body;
  
  db.get(`SELECT driver_id, dest_lat, dest_lng FROM rides WHERE id = ?`, [rideId], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!row) return res.status(404).json({ error: 'Ride not found' });
    if (row.driver_id !== req.user.id && req.user.role !== 'Admin') {
      return res.status(403).json({ error: 'Unauthorized' });
    }
    
    const now = Date.now();
    const shouldCheckOsrm = !last_osrm_check[rideId] || (now - last_osrm_check[rideId] > 60000);
    
    db.all(`
      SELECT rr.passenger_id, pl.dest_lat, pl.dest_lng 
      FROM ride_requests rr 
      LEFT JOIN passenger_listings pl ON rr.passenger_listing_id = pl.id 
      WHERE rr.ride_id = ? AND rr.status = 'Accepted'
    `, [rideId], async (err, passengers) => {
      
      let driverEta = null;
      let passengerEtas = {};
      
      if (shouldCheckOsrm) {
        last_osrm_check[rideId] = now;
        try {
          // Driver ETA
          const osrmRes = await fetch(`http://router.project-osrm.org/route/v1/driving/${lng},${lat};${row.dest_lng},${row.dest_lat}`);
          if (osrmRes.ok) {
            const data = await osrmRes.json();
            if (data.routes && data.routes.length > 0) driverEta = Math.ceil(data.routes[0].duration / 60);
          }
          
          // Passenger ETAs
          for (let p of passengers || []) {
            const pDestLat = p.dest_lat || row.dest_lat;
            const pDestLng = p.dest_lng || row.dest_lng;
            const pRes = await fetch(`http://router.project-osrm.org/route/v1/driving/${lng},${lat};${pDestLng},${pDestLat}`);
            if (pRes.ok) {
              const pData = await pRes.json();
              if (pData.routes && pData.routes.length > 0) passengerEtas[p.passenger_id] = Math.ceil(pData.routes[0].duration / 60);
            }
          }
        } catch (e) {
          console.error("OSRM ETA fetch error:", e);
        }
      }

      // Emit driver location & ETA
      req.app.get('io').to(`user_${row.driver_id}`).emit('eta_update', { eta_mins: driverEta });

      // Broadcast to passengers
      if (!err && passengers) {
        passengers.forEach(p => {
          req.app.get('io').to(`user_${p.passenger_id}`).emit('location_update', { 
            ride_id: rideId, 
            lat, 
            lng,
            eta_mins: passengerEtas[p.passenger_id] !== undefined ? passengerEtas[p.passenger_id] : driverEta
          });
        });
      }
      res.json({ message: 'Location broadcasted.' });
    });
  });
});

app.post('/api/rides/:id/notify', (req, res) => {
  const rideId = req.params.id;
  db.get(`SELECT driver_id, departure_time, status FROM rides WHERE id = ?`, [rideId], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!row) return res.status(404).json({ error: 'Ride not found' });
    if (row.driver_id !== req.user.id && req.user.role !== 'Admin') {
      return res.status(403).json({ error: 'Unauthorized' });
    }
    if (row.status !== 'Scheduled') {
      return res.status(400).json({ error: 'Ride is not in Scheduled state' });
    }

    // Enforce +/- 10 minutes window
    const now = new Date();
    const current_minutes = now.getHours() * 60 + now.getMinutes();
    const [d_hh, d_mm] = row.departure_time.split(':').map(Number);
    const departure_minutes = d_hh * 60 + d_mm;
    
    if (Math.abs(departure_minutes - current_minutes) > 10) {
      return res.status(400).json({ error: 'You can only notify passengers within 10 minutes of the scheduled departure time.' });
    }

    db.all(`SELECT passenger_id FROM ride_requests WHERE ride_id = ? AND status = 'Accepted'`, [rideId], (err, passengers) => {
      if (err) return res.status(500).json({ error: err.message });
      
      passengers.forEach(p => {
        req.app.get('io').to(`user_${p.passenger_id}`).emit('host_arriving', { message: 'Your Pool Host will be arriving soon. Please be ready at the pickup location.', ride_id: rideId });
      });

      res.json({ message: 'Passengers notified successfully.' });
    });
  });
});

// Pool Host: start ride
app.post('/api/rides/:id/start', (req, res) => {
  const rideId = req.params.id;
  db.get(`SELECT driver_id, departure_time, status FROM rides WHERE id = ?`, [rideId], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!row) return res.status(404).json({ error: 'Ride not found' });
    if (row.driver_id !== req.user.id && req.user.role !== 'Admin') {
      return res.status(403).json({ error: 'Unauthorized' });
    }
    if (row.status !== 'Scheduled') {
      return res.status(400).json({ error: 'Ride is not in Scheduled state' });
    }

    // Enforce +/- 10 minutes window
    const now = new Date();
    const current_minutes = now.getHours() * 60 + now.getMinutes();
    const [d_hh, d_mm] = row.departure_time.split(':').map(Number);
    const departure_minutes = d_hh * 60 + d_mm;
    
    if (Math.abs(departure_minutes - current_minutes) > 10) {
      return res.status(400).json({ error: 'You can only start the ride within 10 minutes of the scheduled departure time.' });
    }

    const today = new Date().toISOString().split('T')[0];
    db.run(`INSERT INTO trip_logs (ride_id, date, status) VALUES (?, ?, 'In Progress') 
            ON CONFLICT(ride_id, date) DO UPDATE SET status = 'In Progress'`, [rideId, today], function(err) {
      if (err && err.message.includes('syntax error')) {
         db.run(`INSERT INTO trip_logs (ride_id, date, status) VALUES (?, ?, 'In Progress')`, [rideId, today]);
      }
      
      // Update the rides table for current day's tracking
      db.run(`UPDATE rides SET actual_start_time = CURRENT_TIMESTAMP, delay_reminder_sent = 0 WHERE id = ?`, [rideId]);
      
      db.all(`SELECT passenger_id FROM ride_requests WHERE ride_id = ? AND status = 'Accepted'`, [rideId], (err, passengers) => {
        if (!err) {
          passengers.forEach(p => {
            req.app.get('io').to(`user_${p.passenger_id}`).emit('ride_started', { message: 'Your commute has started. Have a safe journey!', ride_id: rideId });
          });
        }
        res.json({ message: 'Ride started successfully for today.' });
      });
    });
  });
});

// Pool Host: accept request OR Passenger: accept offer
app.post('/api/rides/request/:id/accept', (req, res) => {
  const requestId = req.params.id;

  db.get(`SELECT rr.*, r.seats_offered, r.status as ride_status, r.driver_id FROM ride_requests rr JOIN rides r ON rr.ride_id = r.id WHERE rr.id = ?`, [requestId], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!row) return res.status(404).json({ error: 'Request not found' });
    
    const isDriver = row.driver_id === req.user.id;
    const isPassenger = row.passenger_id === req.user.id;
    
    if (!isDriver && !isPassenger && req.user.role !== 'Admin') {
      return res.status(403).json({ error: 'Unauthorized to accept this request/offer' });
    }
    
    if (row.ride_status !== 'Scheduled') return res.status(400).json({ error: 'Ride is no longer active' });
    if (row.seats_offered <= 0) return res.status(400).json({ error: 'No seats available to accept this request' });

    db.serialize(() => {
      // Update request status
      db.run(`UPDATE ride_requests SET status = 'Accepted' WHERE id = ?`, [requestId], function(err) {
        if (err) return res.status(500).json({ error: err.message });

        // Decrement seats offered
        db.run(`UPDATE rides SET seats_offered = seats_offered - 1 WHERE id = ?`, [row.ride_id], function(err) {
          if (err) return res.status(500).json({ error: err.message });
          
          if (isDriver) {
            req.app.get('io').to(`user_${row.passenger_id}`).emit('ride_accepted', { message: 'Your ride request was accepted!' });
            sendPushToUser(row.passenger_id, 'Ride Accepted', 'Your ride request was accepted!');
          } else {
            req.app.get('io').to(`user_${row.driver_id}`).emit('ride_accepted', { message: 'A passenger accepted your ride offer!' });
            sendPushToUser(row.driver_id, 'Ride Accepted', 'A passenger accepted your ride offer!');
          }
          
          recalculateMultiStopRoute(row.ride_id, req.app.get('io'));
          
          res.json({ message: 'Request accepted successfully.' });
        });
      });
    });
  });
});

// Pool Host: reject request OR Passenger: reject offer
app.post('/api/rides/request/:id/reject', (req, res) => {
  const requestId = req.params.id;
  db.get(`SELECT rr.*, r.driver_id FROM ride_requests rr JOIN rides r ON rr.ride_id = r.id WHERE rr.id = ?`, [requestId], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!row) return res.status(404).json({ error: 'Request not found' });
    
    const isDriver = row.driver_id === req.user.id;
    const isPassenger = row.passenger_id === req.user.id;
    
    if (!isDriver && !isPassenger && req.user.role !== 'Admin') {
      return res.status(403).json({ error: 'Unauthorized to reject this request/offer' });
    }

    db.run(`UPDATE ride_requests SET status = 'Rejected' WHERE id = ?`, [requestId], function(err) {
      if (err) return res.status(500).json({ error: err.message });
      
      if (isDriver) {
        req.app.get('io').to(`user_${row.passenger_id}`).emit('ride_rejected', { message: 'Your ride request was declined.' });
        sendPushToUser(row.passenger_id, 'Ride Declined', 'Your ride request was declined.');
      } else {
        req.app.get('io').to(`user_${row.driver_id}`).emit('ride_rejected', { message: 'A passenger declined your ride offer.' });
        sendPushToUser(row.driver_id, 'Ride Declined', 'A passenger declined your ride offer.');
      }
      
      recalculateMultiStopRoute(row.ride_id, req.app.get('io'));
      
      res.json({ message: 'Request rejected successfully.' });
    });
  });
});

// Mark a No-Show
app.post('/api/rides/request/:id/no-show', (req, res) => {
  const requestId = req.params.id;
  const { reported_by_role } = req.body; // 'Host' or 'Passenger'

  db.get(`SELECT rr.*, r.driver_id, r.status as ride_status FROM ride_requests rr JOIN rides r ON rr.ride_id = r.id WHERE rr.id = ?`, [requestId], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!row) return res.status(404).json({ error: 'Request not found' });
    
    let targetUserId = null;
    if (reported_by_role === 'Host' && req.user.id === row.driver_id) {
      targetUserId = row.passenger_id;
    } else if (reported_by_role === 'Passenger' && req.user.id === row.passenger_id) {
      targetUserId = row.driver_id;
    } else {
      return res.status(403).json({ error: 'Unauthorized to report no-show for this ride' });
    }

    db.serialize(() => {
      const newStatus = reported_by_role === 'Host' ? 'Passenger No-Show' : 'Host No-Show';
      db.run(`UPDATE ride_requests SET status = ? WHERE id = ?`, [newStatus, requestId], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        
        if (reported_by_role === 'Host') {
           db.run(`UPDATE rides SET seats_offered = seats_offered + 1 WHERE id = ?`, [row.ride_id], () => {});
        }

        db.run(`UPDATE users SET no_show_count = no_show_count + 1 WHERE id = ?`, [targetUserId], function(err) {
          if (err) return res.status(500).json({ error: err.message });
          
          db.get(`SELECT no_show_count FROM users WHERE id = ?`, [targetUserId], (err, userRow) => {
             if (userRow && userRow.no_show_count >= 3) {
                const type = `Auto-Escalation: User ${targetUserId} has reached ${userRow.no_show_count} No-Shows.`;
                const escalateStmt = db.prepare(`INSERT INTO incidents (reported_by, type, sla_deadline) VALUES (?, ?, datetime('now', '+24 hours'))`);
                escalateStmt.run([req.user.id, type], (err2) => {
                  if (err2) console.error('Failed to escalate incident:', err2);
                });
                escalateStmt.finalize();
             }
             res.json({ message: 'No-Show reported successfully.' });
          });
        });
      });
    });
  });
});

// Passenger: Cancel request
app.post('/api/rides/request/:id/cancel', (req, res) => {
  const requestId = req.params.id;
  
  db.get(`SELECT rr.*, r.departure_time, r.driver_id, u.name as passenger_name 
          FROM ride_requests rr 
          JOIN rides r ON rr.ride_id = r.id 
          JOIN users u ON rr.passenger_id = u.id 
          WHERE rr.id = ?`, [requestId], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!row) return res.status(404).json({ error: 'Request not found' });
    if (row.passenger_id !== req.user.id && req.user.role !== 'Admin') {
      return res.status(403).json({ error: 'Unauthorized to cancel this request' });
    }
    if (row.status !== 'Pending' && row.status !== 'Accepted') {
      return res.status(400).json({ error: 'Only pending or accepted requests can be cancelled.' });
    }

    // Time-check logic: Block cancellation within 15 mins of departure
    const now = new Date();
    const current_minutes = now.getHours() * 60 + now.getMinutes();
    const [c_hh, c_mm] = row.departure_time.split(':').map(Number);
    const departure_minutes = c_hh * 60 + c_mm;
    
    if (departure_minutes - current_minutes >= 0 && departure_minutes - current_minutes <= 15) {
      return res.status(403).json({ error: 'Cancellation is blocked within 15 minutes of departure.' });
    }

    db.serialize(() => {
      // Mark request as cancelled
      db.run(`UPDATE ride_requests SET status = 'Cancelled' WHERE id = ?`, [requestId], function(err) {
        if (err) return res.status(500).json({ error: err.message });

        // If it was accepted, give the seat back to the driver
        if (row.status === 'Accepted') {
          db.run(`UPDATE rides SET seats_offered = seats_offered + 1 WHERE id = ?`, [row.ride_id], function(err) {
            if (err) console.error('Failed to increment seats:', err.message);
          });
        }
        
        // Notify the driver
        const msg = `Passenger ${row.passenger_name} has cancelled their request for your ride at ${row.departure_time}.`;
        db.run(`INSERT INTO notifications (user_id, message, type) VALUES (?, ?, 'RequestCancelled')`, [row.driver_id, msg]);

        res.json({ message: 'Request successfully cancelled.' });
      });
    });
  });
});

// No-Show Reporting
app.post('/api/rides/request/:id/no-show', (req, res) => {
  const requestId = req.params.id;
  const { reported_by_role } = req.body; // 'Host' or 'Passenger'

  db.get(`
    SELECT rr.*, r.driver_id, r.departure_time,
           u_pass.name as passenger_name, u_pass.id as passenger_id,
           u_drv.name as driver_name
    FROM ride_requests rr
    JOIN rides r ON rr.ride_id = r.id
    JOIN users u_pass ON rr.passenger_id = u_pass.id
    JOIN users u_drv ON r.driver_id = u_drv.id
    WHERE rr.id = ?
  `, [requestId], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!row) return res.status(404).json({ error: 'Request not found' });
    
    let offenderId;
    let reporterName;
    if (reported_by_role === 'Host') {
      if (req.user.id !== row.driver_id && req.user.role !== 'Admin') return res.status(403).json({ error: 'Unauthorized' });
      offenderId = row.passenger_id;
      reporterName = row.driver_name;
    } else {
      if (req.user.id !== row.passenger_id && req.user.role !== 'Admin') return res.status(403).json({ error: 'Unauthorized' });
      offenderId = row.driver_id;
      reporterName = row.passenger_name;
    }

    db.serialize(() => {
      // 1. Mark request as No-Show
      db.run(`UPDATE ride_requests SET status = 'No-Show' WHERE id = ?`, [requestId]);
      
      // 2. Give seat back if reported by Host
      if (reported_by_role === 'Host') {
        db.run(`UPDATE rides SET seats_offered = seats_offered + 1 WHERE id = ?`, [row.ride_id]);
      }

      // 3. Increment penalty points
      db.get(`SELECT penalty_points FROM users WHERE id = ?`, [offenderId], (err, offender) => {
        if (err || !offender) return res.status(500).json({ error: 'Failed to find offender' });
        
        const newPoints = (offender.penalty_points || 0) + 1;
        if (newPoints >= 3) {
          // Suspend for 15 days
          const suspendedUntil = new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString();
          db.run(`UPDATE users SET penalty_points = ?, status = 'Suspended', suspended_until = ? WHERE id = ?`, [newPoints, suspendedUntil, offenderId]);
          db.run(`INSERT INTO notifications (user_id, message, type) VALUES (?, ?, 'Suspension')`, 
            [offenderId, `Your account has been suspended for 15 days due to accumulating 3 No-Show penalties.`]);
        } else {
          db.run(`UPDATE users SET penalty_points = ? WHERE id = ?`, [newPoints, offenderId]);
          db.run(`INSERT INTO notifications (user_id, message, type) VALUES (?, ?, 'Penalty')`, 
            [offenderId, `You were marked as a No-Show by ${reporterName}. You now have ${newPoints}/3 penalty points.`]);
        }
        res.json({ message: 'No-Show reported successfully.' });
      });
    });
  });
});

// Get user stats (KPIs)
app.get('/api/users/:id/stats', (req, res) => {
  const userId = req.params.id;
  if (req.user.id !== parseInt(userId) && req.user.role !== 'Admin') {
    return res.status(403).json({ error: 'Unauthorized' });
  }
  db.get(`SELECT * FROM users WHERE id = ?`, [userId], (err, user) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!user) return res.status(404).json({ error: 'User not found' });

    if (user.role === 'Passenger') {
      // Passenger KPIs: Rides Taken, Upcoming Ride, CO₂ Saved, Avg. Cost/Ride (₹)
      db.get(`
        SELECT 
          (
            SELECT COUNT(*) 
            FROM ride_requests rr2 
            JOIN trip_logs tl2 ON rr2.ride_id = tl2.ride_id 
            WHERE rr2.passenger_id = ? AND rr2.status = 'Accepted' AND tl2.status = 'Completed'
          ) as rides_taken,
          COALESCE(AVG(r.price_per_seat), 0) as avg_cost
        FROM ride_requests rr
        JOIN rides r ON rr.ride_id = r.id
        WHERE rr.passenger_id = ? AND rr.status = 'Accepted'
      `, [userId, userId], (err, stats) => {
        if (err) return res.status(500).json({ error: err.message });

        db.get(`
          SELECT r.*, u.name as driver_name, u.vehicle_no, u.avatar_url,
                 tl.status as today_status
          FROM ride_requests rr
          JOIN rides r ON rr.ride_id = r.id
          JOIN users u ON r.driver_id = u.id
          LEFT JOIN trip_logs tl ON r.id = tl.ride_id AND tl.date = ?
          WHERE rr.passenger_id = ? AND rr.status = 'Accepted' 
            AND (tl.status IS NULL OR tl.status != 'Completed')
          ORDER BY r.created_at DESC
          LIMIT 1
        `, [new Date().toISOString().split('T')[0], userId], (err, upcoming) => {
          if (err) return res.status(500).json({ error: err.message });

          const ridesTaken = stats.rides_taken || 0;
          const co2Saved = (ridesTaken * 15 * 0.21).toFixed(1);

          res.json({
            role: 'Passenger',
            rides_taken: ridesTaken,
            avg_cost: parseFloat(stats.avg_cost.toFixed(1)),
            co2_saved: parseFloat(co2Saved),
            upcoming_ride: upcoming || null,
            penalty_points: user.penalty_points || 0
          });
        });
      });
    } else {
      // Pool Host KPIs: Rides Offered, People Carpooled, Pending Requests, Avg. Earning/Ride (₹), CO₂ Saved
      db.get(`
        SELECT COUNT(*) as rides_offered FROM rides WHERE driver_id = ?
      `, [userId], (err, offerStats) => {
        if (err) return res.status(500).json({ error: err.message });

        db.get(`
          SELECT 
            COUNT(DISTINCT CASE WHEN rr.status = 'Accepted' THEN rr.id END) as people_carpooled,
            COUNT(DISTINCT CASE WHEN rr.status = 'Pending' THEN rr.id END) as pending_requests,
            (
              SELECT COALESCE(SUM(r2.price_per_seat), 0)
              FROM rides r2
              JOIN ride_requests rr2 ON r2.id = rr2.ride_id
              JOIN trip_logs tl2 ON r2.id = tl2.ride_id
              WHERE r2.driver_id = ? AND rr2.status = 'Accepted' AND tl2.status = 'Completed'
            ) as total_earnings
          FROM rides r
          LEFT JOIN ride_requests rr ON r.id = rr.ride_id
          WHERE r.driver_id = ?
        `, [userId, userId], (err, reqStats) => {
          if (err) return res.status(500).json({ error: err.message });

          const ridesOffered = offerStats.rides_offered || 0;
          const peopleCarpooled = reqStats.people_carpooled || 0;
          const avgEarning = ridesOffered > 0 ? (reqStats.total_earnings / ridesOffered) : 0;
          const co2Saved = (peopleCarpooled * 15 * 0.21).toFixed(1);

          res.json({
            role: 'Pool Host',
            rides_offered: ridesOffered,
            people_carpooled: peopleCarpooled,
            pending_requests: reqStats.pending_requests || 0,
            avg_earning: parseFloat(avgEarning.toFixed(1)),
            co2_saved: parseFloat(co2Saved),
            penalty_points: user.penalty_points || 0
          });
        });
      });
    }
  });
});

// Register a new user
app.post('/api/register', async (req, res) => {
  const { name, email, password, role, hasVehiclePass, vehicleNo, vehicleMake, vehicleModel, vehicleCapacity, gender } = req.body;
  
  if (!name || !email || !password || !role) {
    return res.status(400).json({ error: 'Name, email, password, and role are required' });
  }

  // Input Validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ error: 'Invalid email format' });
  }
  if (password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters long' });
  }
  if (name.length > 100) {
    return res.status(400).json({ error: 'Name is too long' });
  }

  // Role Validation - explicitly block Admin registration
  if (role !== 'Passenger' && role !== 'Pool Host') {
    return res.status(403).json({ error: 'Invalid role for public registration' });
  }

  try {
    const hashedPassword = await bcrypt.hash(password, 10);

    // Check if email exists
    db.get(`SELECT emp_id FROM users WHERE email = ?`, [email], (err, row) => {
      if (err) return res.status(500).json({ error: err.message });
      
      // Auto-generate or reuse EMP ID
      const emp_id = (row && row.emp_id) ? row.emp_id : `EMP${Math.floor(Math.random() * 90000) + 10000}`;

      const stmt = db.prepare(`INSERT INTO users (name, email, password, emp_id, role, has_vehicle_pass, vehicle_no, vehicle_make, vehicle_model, vehicle_capacity, gender) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
      stmt.run([name, email, hashedPassword, emp_id, role, hasVehiclePass ? 1 : 0, vehicleNo || null, vehicleMake || null, vehicleModel || null, vehicleCapacity || null, gender || null], function(err) {
        if (err) {
          if (err.message.includes('UNIQUE constraint failed')) {
            return res.status(409).json({ error: `This email is already registered as a ${role}.` });
          }
          return res.status(500).json({ error: err.message });
        }
        res.status(201).json({ message: 'User registered successfully', userId: this.lastID });
      });
      stmt.finalize();
    });
  } catch (hashErr) {
    res.status(500).json({ error: 'Failed to hash password' });
  }
});

// Pool Host: Offer a ride
app.post('/api/rides/create', (req, res) => {
  const { driver_id, origin, destination, origin_lat, origin_lng, dest_lat, dest_lng, departure_time, recurring_days, seats_offered, price_per_seat, women_only } = req.body;
  
  if (req.user.id !== parseInt(driver_id) && req.user.role !== 'Admin') {
    return res.status(403).json({ error: 'Unauthorized to create ride for this driver' });
  }

  db.get(`SELECT gender FROM users WHERE id = ?`, [driver_id], async (err, driver) => {
    if (err) return res.status(500).json({ error: err.message });
    
    if (women_only && driver.gender !== 'Female') {
      return res.status(403).json({ error: 'Only Female drivers can list Women-Only rides.' });
    }

    let route_polyline = null;
    let expected_duration_mins = null;
    try {
      const osrmRes = await fetch(`http://router.project-osrm.org/route/v1/driving/${origin_lng},${origin_lat};${dest_lng},${dest_lat}?geometries=geojson`);
      if (osrmRes.ok) {
        const osrmData = await osrmRes.json();
        if (osrmData.routes && osrmData.routes.length > 0) {
          route_polyline = JSON.stringify(osrmData.routes[0].geometry.coordinates);
          expected_duration_mins = Math.ceil(osrmData.routes[0].duration / 60);
        }
      }
    } catch (fetchErr) {
      console.error("Failed to fetch route polyline:", fetchErr);
    }

    const stmt = db.prepare(`INSERT INTO rides (driver_id, origin, destination, origin_lat, origin_lng, dest_lat, dest_lng, route_polyline, expected_duration_mins, departure_time, recurring_days, seats_offered, original_seats, price_per_seat, women_only) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
    const finalRecurringDays = recurring_days || 'Mon,Tue,Wed,Thu,Fri';
    stmt.run([driver_id, origin, destination, origin_lat, origin_lng, dest_lat, dest_lng, route_polyline, expected_duration_mins, departure_time, finalRecurringDays, seats_offered, seats_offered, price_per_seat, women_only ? 1 : 0], function(err) {
      if (err) return res.status(500).json({ error: err.message });
      res.status(201).json({ message: 'Ride created successfully', rideId: this.lastID });
    });
    stmt.finalize();
  });
});

// Passenger: Match rides
app.post('/api/rides/match', (req, res) => {
  const { passenger_id, origin_lat, origin_lng, dest_lat, dest_lng, departure_time } = req.body;
  
  if (passenger_id && req.user.id !== parseInt(passenger_id) && req.user.role !== 'Admin') {
    return res.status(403).json({ error: 'Unauthorized' });
  }

  // 1. Convert departure_time (HH:MM string) to minutes since midnight for comparison
  const [pass_hh, pass_mm] = departure_time.split(':').map(Number);
  const pass_total_minutes = pass_hh * 60 + pass_mm;

  // Pre-flight check: Ensure this passenger doesn't already have a ride listed as a driver +/- 30 mins
  if (passenger_id) {
    db.get(`SELECT emp_id FROM users WHERE id = ?`, [passenger_id], (err, user) => {
      if (err) return res.status(500).json({ error: err.message });
      if (user && user.emp_id) {
        db.all(`
          SELECT r.departure_time 
          FROM rides r
          JOIN users u ON r.driver_id = u.id
          WHERE u.emp_id = ? AND r.status = 'Scheduled'
        `, [user.emp_id], (err, driverRides) => {
          if (err) return res.status(500).json({ error: err.message });
          
          for (let dride of driverRides) {
            const [d_hh, d_mm] = dride.departure_time.split(':').map(Number);
            const d_total = d_hh * 60 + d_mm;
            if (Math.abs(d_total - pass_total_minutes) <= 30) {
              return res.status(403).json({ error: 'You cannot search for a ride because you already have a commute listed as a Pool Host within 30 minutes of this time.' });
            }
          }
          
          proceedWithMatching();
        });
      } else {
        proceedWithMatching();
      }
    });
  } else {
    proceedWithMatching();
  }

  function proceedWithMatching() {
    db.get(`SELECT gender FROM users WHERE id = ?`, [passenger_id], (err, passUser) => {
      const isFemalePassenger = passUser && passUser.gender === 'Female';
      const wantsWomenOnly = req.body.women_only && isFemalePassenger;
      
      // 2. Fetch all Scheduled rides with available seats that haven't been logged today
      const todayDate = new Date().toISOString().split('T')[0];
      const currentDay = new Date().toLocaleDateString('en-US', { weekday: 'short' });
      const verifiedOnly = req.body.verified_only === true;
      let queryStr = `
        SELECT r.*, u.name as driver_name, u.avatar_url as driver_avatar_url, u.vehicle_make, u.vehicle_model, u.vehicle_no, u.gender as driver_gender, u.has_vehicle_pass as driver_has_vehicle_pass 
        FROM rides r
        JOIN users u ON r.driver_id = u.id
        WHERE r.status = 'Scheduled' AND r.seats_offered > 0
        AND NOT EXISTS (
          SELECT 1 FROM trip_logs tl 
          WHERE tl.ride_id = r.id AND tl.date = ?
        )
      `;
      if (verifiedOnly) {
        queryStr += ` AND u.has_vehicle_pass = 1`;
      }

      db.all(queryStr, [todayDate], (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });

      const doMatching = (threshold) => {
        const resultMatches = [];
        rows.forEach(ride => {
          if (ride.recurring_days && !ride.recurring_days.includes(currentDay)) return;

          // Enforce Women-Only rule
          if (ride.women_only && !isFemalePassenger) return;
          if (wantsWomenOnly && ride.driver_gender !== 'Female') return;
          
          // Check time constraint (+/- 15 mins)
          const [drv_hh, drv_mm] = ride.departure_time.split(':').map(Number);
          const drv_total_minutes = drv_hh * 60 + drv_mm;
          const timeDiff = Math.abs(drv_total_minutes - pass_total_minutes);
          if (timeDiff > 15) return;

          let distOrigin, distDest;

          if (ride.route_polyline) {
            try {
              const coords = JSON.parse(ride.route_polyline);
              // coords is array of [lng, lat]
              let minOrigDist = Infinity;
              let origIdx = -1;
              for (let i = 0; i < coords.length; i++) {
                const [lng, lat] = coords[i];
                const dist = getDistanceFromLatLonInKm(origin_lat, origin_lng, lat, lng);
                if (dist < minOrigDist) {
                  minOrigDist = dist;
                  origIdx = i;
                }
              }

              let minDestDist = Infinity;
              let destIdx = -1;
              for (let i = origIdx; i < coords.length; i++) { // enforce direction
                const [lng, lat] = coords[i];
                const dist = getDistanceFromLatLonInKm(dest_lat, dest_lng, lat, lng);
                if (dist < minDestDist) {
                  minDestDist = dist;
                  destIdx = i;
                }
              }

              distOrigin = minOrigDist;
              distDest = minDestDist;
            } catch (e) {
              console.error("Polyline parse error", e);
              distOrigin = getDistanceFromLatLonInKm(origin_lat, origin_lng, ride.origin_lat, ride.origin_lng);
              distDest = getDistanceFromLatLonInKm(dest_lat, dest_lng, ride.dest_lat, ride.dest_lng);
            }
          } else {
            // Fallback to simple point-to-point if no polyline
            distOrigin = getDistanceFromLatLonInKm(origin_lat, origin_lng, ride.origin_lat, ride.origin_lng);
            distDest = getDistanceFromLatLonInKm(dest_lat, dest_lng, ride.dest_lat, ride.dest_lng);
          }
          
          if (distOrigin <= threshold && distDest <= threshold) {
            resultMatches.push({
              ...ride,
              route_polyline: ride.route_polyline,
              dist_origin_km: parseFloat(distOrigin.toFixed(2)),
              dist_dest_km: parseFloat(distDest.toFixed(2)),
              total_dist_km: parseFloat((distOrigin + distDest).toFixed(2)),
              time_deviation_mins: drv_total_minutes - pass_total_minutes
            });
          }
        });
        
        resultMatches.sort((a, b) => a.total_dist_km - b.total_dist_km);
        return resultMatches;
      };

      let matches = doMatching(3);
      let expandedRadius = false;

      if (matches.length === 0) {
        matches = doMatching(5); // increase to 5km
        if (matches.length > 0) {
          expandedRadius = true;
        }
      }

      res.json({ matches, expandedRadius });
    });
    });
  }
});

// Passenger: Post a Commute Need
app.post('/api/passenger-listings/create', (req, res) => {
  const { passenger_id, origin, destination, origin_lat, origin_lng, dest_lat, dest_lng, departure_time, recurring_days } = req.body;
  if (req.user.id !== parseInt(passenger_id) && req.user.role !== 'Admin') {
    return res.status(403).json({ error: 'Unauthorized to list for this passenger' });
  }

  const stmt = db.prepare(`INSERT INTO passenger_listings (passenger_id, origin, destination, origin_lat, origin_lng, dest_lat, dest_lng, departure_time, recurring_days) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`);
  const finalRecurringDays = recurring_days || 'Mon,Tue,Wed,Thu,Fri';
  stmt.run([passenger_id, origin, destination, origin_lat, origin_lng, dest_lat, dest_lng, departure_time, finalRecurringDays], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.status(201).json({ message: 'Commute need posted successfully', listingId: this.lastID });
  });
  stmt.finalize();
});

// Host: Browse passenger listings (Reverse Matching)
app.get('/api/passenger-listings/match/:driverId', (req, res) => {
  const driverId = req.params.driverId;
  if (req.user.id !== parseInt(driverId) && req.user.role !== 'Admin') {
    return res.status(403).json({ error: 'Unauthorized' });
  }

  db.get(`SELECT id, route_polyline, origin_lat, origin_lng, dest_lat, dest_lng, departure_time FROM rides WHERE driver_id = ? AND status = 'Scheduled' ORDER BY id DESC LIMIT 1`, [driverId], (err, ride) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!ride) return res.json({ matches: [], error: 'You need an active scheduled ride to find passengers.' });

    const verifiedOnly = req.query.verified_only === 'true';
    let queryStr = `
      SELECT pl.*, u.name as passenger_name, u.gender as passenger_gender, u.avatar_url as passenger_avatar_url, u.has_vehicle_pass 
      FROM passenger_listings pl
      JOIN users u ON pl.passenger_id = u.id
      WHERE pl.status = 'Active'
    `;
    if (verifiedOnly) {
      queryStr += ` AND u.has_vehicle_pass = 1`;
    }

    db.all(queryStr, [], (err, listings) => {
      if (err) return res.status(500).json({ error: err.message });

      const matches = [];
      const currentDay = new Date().toLocaleDateString('en-US', { weekday: 'short' });
      listings.forEach(listing => {
        if (listing.recurring_days && !listing.recurring_days.includes(currentDay)) return;

        let distOrigin, distDest;
        if (ride.route_polyline) {
          try {
            const coords = JSON.parse(ride.route_polyline);
            let minOrigDist = Infinity;
            let origIdx = -1;
            for (let i = 0; i < coords.length; i++) {
              const [lng, lat] = coords[i];
              const dist = getDistanceFromLatLonInKm(listing.origin_lat, listing.origin_lng, lat, lng);
              if (dist < minOrigDist) { minOrigDist = dist; origIdx = i; }
            }
            let minDestDist = Infinity;
            let destIdx = -1;
            for (let i = origIdx; i < coords.length; i++) {
              const [lng, lat] = coords[i];
              const dist = getDistanceFromLatLonInKm(listing.dest_lat, listing.dest_lng, lat, lng);
              if (dist < minDestDist) { minDestDist = dist; destIdx = i; }
            }
            distOrigin = minOrigDist;
            distDest = minDestDist;
          } catch (e) {
            distOrigin = getDistanceFromLatLonInKm(listing.origin_lat, listing.origin_lng, ride.origin_lat, ride.origin_lng);
            distDest = getDistanceFromLatLonInKm(listing.dest_lat, listing.dest_lng, ride.dest_lat, ride.dest_lng);
          }
        } else {
          distOrigin = getDistanceFromLatLonInKm(listing.origin_lat, listing.origin_lng, ride.origin_lat, ride.origin_lng);
          distDest = getDistanceFromLatLonInKm(listing.dest_lat, listing.dest_lng, ride.dest_lat, ride.dest_lng);
        }

        if (distOrigin <= 5 && distDest <= 5) {
          matches.push({
            ...listing,
            ride_id: ride.id,
            dist_origin_km: parseFloat(distOrigin.toFixed(2)),
            dist_dest_km: parseFloat(distDest.toFixed(2)),
            total_dist_km: parseFloat((distOrigin + distDest).toFixed(2))
          });
        }
      });
      
      matches.sort((a, b) => a.total_dist_km - b.total_dist_km);
      res.json({ matches });
    });
  });
});

// Create an Incident (SOS)
app.post('/api/incidents/create', (req, res) => {
  const { reported_by, type } = req.body;
  if (!type || type.length > 200) {
    return res.status(400).json({ error: 'Valid incident type is required (max 200 chars)' });
  }
  
  // Set SLA deadline to 15 minutes from now
  const slaDeadline = new Date(Date.now() + 15 * 60000).toISOString();

  const stmt = db.prepare(`INSERT INTO incidents (reported_by, type, sla_deadline) VALUES (?, ?, ?)`);
  stmt.run([reported_by, type, slaDeadline], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    
    req.app.get('io').to('admin_room').emit('sos_alert', { message: `New SOS Alert triggered: ${type}` });
    db.all(`SELECT id FROM users WHERE role = 'Admin'`, [], (err, admins) => {
      if (!err) admins.forEach(admin => sendPushToUser(admin.id, 'SOS Alert', `New SOS Alert: ${type}`));
    });
    
    res.status(201).json({ message: 'SOS Alert triggered successfully', incidentId: this.lastID });
  });
  stmt.finalize();
});

// Get all incidents
app.get('/api/incidents', (req, res) => {
  if (req.user.role !== 'Admin') return res.status(403).json({ error: 'Admin only' });
  db.all(`
    SELECT i.*, u.name as reporter_name, u.role as reporter_role, u.vehicle_no 
    FROM incidents i
    JOIN users u ON i.reported_by = u.id
    ORDER BY i.created_at DESC
  `, [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// Resolve an incident
app.post('/api/incidents/resolve', (req, res) => {
  if (req.user.role !== 'Admin') return res.status(403).json({ error: 'Admin only' });
  const { incident_id } = req.body;
  db.run(`UPDATE incidents SET status = 'Resolved' WHERE id = ?`, [incident_id], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ message: 'Incident resolved' });
  });
});

// Escalate an incident
app.post('/api/incidents/escalate', (req, res) => {
  if (req.user.role !== 'Admin') return res.status(403).json({ error: 'Admin only' });
  const { incident_id } = req.body;
  db.run(`UPDATE incidents SET status = 'Escalated' WHERE id = ?`, [incident_id], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ message: 'Incident escalated to ERT' });
  });
});

// Get user notifications
app.get('/api/users/:id/notifications', (req, res) => {
  const userId = req.params.id;
  if (req.user.id !== parseInt(userId) && req.user.role !== 'Admin') {
    return res.status(403).json({ error: 'Unauthorized to view these notifications' });
  }
  db.all(`SELECT * FROM notifications WHERE user_id = ? AND is_read = 0 ORDER BY created_at DESC`, [userId], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// Mark notification as read
app.post('/api/notifications/:id/read', (req, res) => {
  const notifId = req.params.id;
  db.get(`SELECT user_id FROM notifications WHERE id = ?`, [notifId], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!row) return res.status(404).json({ error: 'Notification not found' });
    if (row.user_id !== req.user.id && req.user.role !== 'Admin') {
      return res.status(403).json({ error: 'Unauthorized to mark this notification as read' });
    }
    
    db.run(`UPDATE notifications SET is_read = 1 WHERE id = ?`, [notifId], function(err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ message: 'Notification marked as read' });
    });
  });
});

// Get all trips (Rides)
app.get('/api/trips', (req, res) => {
  if (req.user.role !== 'Admin') return res.status(403).json({ error: 'Admin only' });
  db.all(`
    SELECT r.*, u.name as driver_name, u.vehicle_no
    FROM rides r
    JOIN users u ON r.driver_id = u.id
    ORDER BY r.created_at DESC
  `, [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// Admin: Reset penalty points
app.post('/api/users/:id/reset-penalty', (req, res) => {
  const userId = req.params.id;
  if (req.user.role !== 'Admin') {
    return res.status(403).json({ error: 'Only Admins can reset penalty points.' });
  }
  
  db.run(`UPDATE users SET penalty_points = 0 WHERE id = ?`, [userId], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    if (this.changes === 0) return res.status(404).json({ error: 'User not found' });
    
    // Also log notification
    db.run(`INSERT INTO notifications (user_id, message, type) VALUES (?, ?, 'Penalty')`, 
      [userId, `Your penalty points have been forgiven by an Admin.`]);
      
    res.json({ message: 'Penalty points reset successfully', status: 'Active' });
  });
});

// ─── AI Chat Endpoint ─────────────────────────────────────────────────────────
app.post('/api/chat', async (req, res) => {
  if (!activeAI) {
    return res.status(500).json({
      error: AI_PROVIDER === 'nvidia'
        ? 'NVIDIA API key not configured. Add NVIDIA_API_KEY to server/.env (get key at https://build.nvidia.com)'
        : 'AI provider not configured. Check server/.env'
    });
  }

  try {
    const { message, context, history } = req.body;

    // Build the user's final message with injected context
    const userContent = context
      ? `[System Note: The current user is a ${context.userRole}. Their live stats/KPIs are: ${JSON.stringify(context.stats)}]\n\nUser Query: ${message}`
      : message;

    // ── NVIDIA NIM path (OpenAI-compatible) ────────────────────────────────────
    if (activeAI === 'nvidia') {
      // Convert Gemini-style history { role:'model', parts:[{text}] }
      // → OpenAI-style { role:'assistant'|'user', content:string }
      const openaiHistory = (history || []).map(m => ({
        role: m.role === 'model' ? 'assistant' : 'user',
        content: Array.isArray(m.parts) ? m.parts.map(p => p.text || '').join('') : (m.content || '')
      }));

      const messages = [
        { role: 'system', content: systemPrompt },
        ...openaiHistory,
        { role: 'user', content: userContent }
      ];

      const completion = await nvidiaClient.chat.completions.create({
        model: NVIDIA_MODEL,
        messages,
        tools: CARPOOL_TOOLS,
        tool_choice: 'auto',
        temperature: 0.6,
        max_tokens: 1024,
      });

      const choice = completion.choices[0];
      const assistantMsg = choice.message;

      // Check for tool calls
      if (assistantMsg.tool_calls && assistantMsg.tool_calls.length > 0) {
        const call = assistantMsg.tool_calls[0];
        let params;
        try {
          params = typeof call.function.arguments === 'string'
            ? JSON.parse(call.function.arguments)
            : call.function.arguments;
        } catch (e) {
          params = {};
        }
        return res.json({
          type: 'action',
          action: call.function.name,
          params,
          text: `I've prepared a draft for your ${call.function.name === 'draft_booking' ? 'ride request' : 'commute listing'}. Please review and confirm the details below.`
        });
      }

      // Plain text response
      return res.json({
        type: 'text',
        text: assistantMsg.content || ''
      });
    }

    // ── Gemini fallback path ───────────────────────────────────────────────────
    if (activeAI === 'gemini') {
      const chat = geminiModel.startChat({ history: history || [] });
      const result = await chat.sendMessage(userContent);
      const response = result.response;
      const functionCalls = response.functionCalls();

      if (functionCalls && functionCalls.length > 0) {
        const call = functionCalls[0];
        return res.json({
          type: 'action',
          action: call.name,
          params: call.args,
          text: `I've prepared a draft for your ${call.name === 'draft_booking' ? 'ride request' : 'commute listing'}. Please confirm the details.`
        });
      }

      return res.json({ type: 'text', text: response.text() });
    }

  } catch (err) {
    console.error('[AI] Chat error:', err.message || err);
    // Return a helpful message so the UI doesn't break
    const isAuthError = err?.status === 401 || (err?.message || '').includes('401');
    const isQuotaError = err?.status === 429 || (err?.message || '').includes('429');
    res.status(500).json({
      error: isAuthError
        ? 'Invalid NVIDIA API key. Please check NVIDIA_API_KEY in server/.env'
        : isQuotaError
        ? 'NVIDIA API rate limit reached. Please wait a moment and try again.'
        : 'AI service temporarily unavailable. Please try again.'
    });
  }
});

// Chat Endpoints
app.get('/api/messages/:request_id', (req, res) => {
  const requestId = req.params.request_id;
  
  // Verify request is accepted and user is involved
  db.get(`
    SELECT rr.status, rr.passenger_id, r.driver_id 
    FROM ride_requests rr 
    JOIN rides r ON rr.ride_id = r.id 
    WHERE rr.id = ?
  `, [requestId], (err, request) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!request || request.status !== 'Accepted') {
      return res.status(403).json({ error: 'Chat is only available for accepted rides.' });
    }
    if (req.user.id !== request.passenger_id && req.user.id !== request.driver_id && req.user.role !== 'Admin') {
      return res.status(403).json({ error: 'Unauthorized to view these messages' });
    }

    db.all(`
      SELECT m.*, u.name as sender_name 
      FROM messages m 
      JOIN users u ON m.sender_id = u.id 
      WHERE m.request_id = ? 
      ORDER BY m.created_at ASC
    `, [requestId], (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(rows);
    });
  });
});

app.post('/api/messages/:request_id', (req, res) => {
  const requestId = req.params.request_id;
  const { sender_id, content } = req.body;

  if (!sender_id || !content) return res.status(400).json({ error: 'sender_id and content required' });

  if (req.user.id !== parseInt(sender_id) && req.user.role !== 'Admin') {
    return res.status(403).json({ error: 'Unauthorized to send message as this user' });
  }

  // Verify request is accepted and user is involved
  db.get(`
    SELECT rr.status, rr.passenger_id, r.driver_id 
    FROM ride_requests rr 
    JOIN rides r ON rr.ride_id = r.id 
    WHERE rr.id = ?
  `, [requestId], (err, request) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!request || request.status !== 'Accepted') {
      return res.status(403).json({ error: 'Chat is only available for accepted rides.' });
    }
    if (req.user.id !== request.passenger_id && req.user.id !== request.driver_id && req.user.role !== 'Admin') {
      return res.status(403).json({ error: 'Unauthorized to participate in this chat' });
    }

    const stmt = db.prepare(`INSERT INTO messages (request_id, sender_id, content) VALUES (?, ?, ?)`);
    stmt.run([requestId, sender_id, content], function(err) {
      if (err) return res.status(500).json({ error: err.message });
      res.status(201).json({ message: 'Message sent successfully', messageId: this.lastID });
    });
    stmt.finalize();
  });
});

// --- Ratings API ---
app.post('/api/ratings', (req, res) => {
  const { trip_id, ratee_id, stars, tags, comment } = req.body;
  const rater_id = req.user.id;

  if (!stars) {
    return res.status(400).json({ error: 'stars are required.' });
  }

  const finalTripId = trip_id || 0;
  const finalRateeId = ratee_id || 0;

  // 1. Insert rating
  const stmt = db.prepare(`INSERT INTO ratings (trip_id, rater_id, ratee_id, stars, tags, comment) VALUES (?, ?, ?, ?, ?, ?)`);
  stmt.run([finalTripId, rater_id, finalRateeId, stars, tags || '', comment || ''], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    
    // 2. Auto-escalate to Incident Queue if negative safety tags present
    const tagsLower = (tags || '').toLowerCase();
    if (tagsLower.includes('harassment') || tagsLower.includes('unsafe driving') || tagsLower.includes('rash driving')) {
      const type = `Auto-Escalation: Safety tag triggered by User ${rater_id} against User ${ratee_id}`;
      const escalateStmt = db.prepare(`INSERT INTO incidents (reported_by, type, sla_deadline) VALUES (?, ?, datetime('now', '+24 hours'))`);
      escalateStmt.run([rater_id, type], (err2) => {
        if (err2) console.error('Failed to escalate incident:', err2);
      });
      escalateStmt.finalize();
    }
    
    res.status(201).json({ message: 'Rating submitted successfully.' });
  });
  stmt.finalize();
});

app.get('/api/users/:id/rating', (req, res) => {
  const userId = req.params.id;
  db.get(`SELECT AVG(stars) as avg_rating, COUNT(id) as total_ratings FROM ratings WHERE ratee_id = ?`, [userId], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({
      avg_rating: row.avg_rating ? parseFloat(row.avg_rating).toFixed(1) : null,
      total_ratings: row.total_ratings || 0
    });
  });
});

// Background task for ETA delay monitoring
setInterval(() => {
  db.all(`
    SELECT r.id, r.driver_id, r.expected_duration_mins, r.actual_start_time, r.delay_reminder_sent 
    FROM rides r 
    JOIN trip_logs tl ON r.id = tl.ride_id AND tl.date = ?
    WHERE tl.status = 'In Progress' AND r.actual_start_time IS NOT NULL AND r.expected_duration_mins IS NOT NULL
  `, [new Date().toISOString().split('T')[0]], (err, rides) => {
    if (err || !rides) return;
    
    const now = new Date();
    rides.forEach(ride => {
      const startTime = new Date(ride.actual_start_time);
      const elapsedMins = (now - startTime) / 60000;
      
      if (elapsedMins > ride.expected_duration_mins + 30 && ride.delay_reminder_sent === 0) {
        // Step 1: Push reminder to host
        io.to(`user_${ride.driver_id}`).emit('eta_alert', { 
          message: `Your ride has exceeded the expected ETA by over 30 mins! Please remember to complete the ride if you have dropped off passengers, or contact support if delayed.`
        });
        db.run(`UPDATE rides SET delay_reminder_sent = 1 WHERE id = ?`, [ride.id]);
      } else if (elapsedMins > ride.expected_duration_mins + 35 && ride.delay_reminder_sent === 1) {
        // Step 2: Escalate to Admin SOS
        const incidentType = `Auto-Escalation: Ride #${ride.id} exceeded ETA by >35 mins without completion.`;
        db.run(`INSERT INTO incidents (reported_by, type, sla_deadline) VALUES (?, ?, datetime('now', '+15 minutes'))`, 
          [ride.driver_id, incidentType], function(err2) {
            if (!err2) {
              io.to('admin_room').emit('sos_alert', { message: `Urgent: ${incidentType}` });
              db.all(`SELECT id FROM users WHERE role = 'Admin'`, [], (err, admins) => {
                if (!err) admins.forEach(admin => sendPushToUser(admin.id, 'SOS Alert', `Urgent: ${incidentType}`));
              });
              db.run(`UPDATE rides SET delay_reminder_sent = 2 WHERE id = ?`, [ride.id]);
            }
        });
      }
    });
  });
}, 60000); // Check every minute

// Serve static frontend files
app.use(express.static(path.join(__dirname, '../dist')));

// Catch-all to serve index.html for React Router
app.use((req, res) => {
  res.sendFile(path.join(__dirname, '../dist', 'index.html'));
});

server.listen(port, () => {
  console.log(`Server & WebSocket running at http://localhost:${port}`);
});
