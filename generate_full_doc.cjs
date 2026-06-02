const {
  Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell,
  WidthType, AlignmentType, BorderStyle, PageNumber, Header, Footer,
  NumberFormat, convertInchesToTwip
} = require('docx');
const fs = require('fs');

// ─── Color Palette ────────────────────────────────────────────────────────────
const C = {
  reliance: '0D47A1',
  accent:   '1565C0',
  teal:     '00695C',
  green:    '2E7D32',
  orange:   'E65100',
  red:      'B71C1C',
  white:    'FFFFFF',
  lightBlue:'DBEAFE',
  lightGray:'F8FAFC',
  text:     '1E293B',
  muted:    '64748B',
  darkRow:  'E3F2FD',
};

// ─── Helpers ─────────────────────────────────────────────────────────────────
function h1(text) {
  return new Paragraph({
    children: [new TextRun({ text, bold: true, size: 36, color: C.reliance, font: 'Helvetica Neue Bold' })],
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 480, after: 240 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 8, color: C.reliance } }
  });
}

function h2(text) {
  return new Paragraph({
    children: [new TextRun({ text, bold: true, size: 28, color: C.accent, font: 'Helvetica Neue Bold' })],
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 360, after: 180 },
  });
}

function h3(text) {
  return new Paragraph({
    children: [new TextRun({ text, bold: true, size: 24, color: C.teal, font: 'Helvetica Neue Bold' })],
    heading: HeadingLevel.HEADING_3,
    spacing: { before: 280, after: 140 },
  });
}

function h4(text) {
  return new Paragraph({
    children: [new TextRun({ text, bold: true, size: 22, color: C.text })],
    spacing: { before: 200, after: 100 },
  });
}

function para(text, indent = false) {
  return new Paragraph({
    children: [new TextRun({ text, size: 22, color: C.text })],
    spacing: { after: 140 },
    indent: indent ? { left: convertInchesToTwip(0.3) } : undefined,
  });
}

function boldPara(label, text) {
  return new Paragraph({
    children: [
      new TextRun({ text: label + ' ', bold: true, size: 22, color: C.text }),
      new TextRun({ text, size: 22, color: C.text })
    ],
    spacing: { after: 120 },
  });
}

function bullet(text, level = 0) {
  return new Paragraph({
    children: [new TextRun({ text, size: 22, color: C.text })],
    bullet: { level },
    spacing: { after: 80 },
    indent: { left: convertInchesToTwip(0.3 + level * 0.3) }
  });
}

function spacer(n = 1) {
  return new Paragraph({ text: '', spacing: { after: n * 120 } });
}

function codeBlock(text) {
  return new Paragraph({
    children: [new TextRun({ text, font: 'Courier New', size: 18, color: '374151' })],
    shading: { type: 'clear', fill: 'F3F4F6' },
    spacing: { after: 120 },
    border: {
      left: { style: BorderStyle.SINGLE, size: 8, color: '6B7280' },
    },
    indent: { left: convertInchesToTwip(0.3) }
  });
}

function makeTable(headers, rows, colWidths) {
  const headerCells = headers.map((h, i) =>
    new TableCell({
      children: [new Paragraph({
        children: [new TextRun({ text: h, bold: true, size: 20, color: C.white })],
        alignment: AlignmentType.CENTER,
      })],
      shading: { type: 'clear', fill: C.reliance },
      width: { size: colWidths[i], type: WidthType.PERCENTAGE },
      margins: { top: 80, bottom: 80, left: 120, right: 120 },
    })
  );

  const dataRows = rows.map((row, ri) =>
    new TableRow({
      children: row.map((cell, ci) =>
        new TableCell({
          children: [new Paragraph({
            children: [new TextRun({ text: cell, size: 20, color: C.text })],
          })],
          shading: { type: 'clear', fill: ri % 2 === 0 ? C.white : C.lightGray },
          width: { size: colWidths[ci], type: WidthType.PERCENTAGE },
          margins: { top: 60, bottom: 60, left: 120, right: 120 },
        })
      ),
    })
  );

  return new Table({
    rows: [new TableRow({ children: headerCells, tableHeader: true }), ...dataRows],
    width: { size: 100, type: WidthType.PERCENTAGE },
    margins: { top: 60, bottom: 60, left: 0, right: 0 },
  });
}

function infoBox(title, text, color = C.teal) {
  return new Paragraph({
    children: [
      new TextRun({ text: title + ': ', bold: true, size: 22, color: C.white }),
      new TextRun({ text, size: 22, color: C.white }),
    ],
    shading: { type: 'clear', fill: color },
    spacing: { after: 140 },
    border: { left: { style: BorderStyle.SINGLE, size: 10, color: C.white } },
    indent: { left: convertInchesToTwip(0.2) },
    margins: { left: 120, right: 120, top: 80, bottom: 80 },
  });
}

// ─── Document Sections ────────────────────────────────────────────────────────

const coverPage = [
  spacer(4),
  new Paragraph({
    children: [new TextRun({ text: 'RELIANCE INDUSTRIES LIMITED', bold: true, size: 52, color: C.reliance, font: 'Helvetica Neue Bold' })],
    alignment: AlignmentType.CENTER,
    spacing: { after: 160 },
  }),
  new Paragraph({
    children: [new TextRun({ text: 'Commuter Connect — Corporate Carpool Platform', size: 36, color: C.accent, font: 'Helvetica Neue Bold' })],
    alignment: AlignmentType.CENTER,
    spacing: { after: 160 },
  }),
  new Paragraph({
    children: [new TextRun({ text: '────────────────────────────────────────', size: 24, color: C.muted })],
    alignment: AlignmentType.CENTER,
    spacing: { after: 240 },
  }),
  new Paragraph({
    children: [new TextRun({ text: 'Full Technical & Product Documentation', bold: true, size: 28, color: C.text })],
    alignment: AlignmentType.CENTER,
    spacing: { after: 160 },
  }),
  new Paragraph({
    children: [new TextRun({ text: 'Prepared by: AI-Assisted Documentation', size: 22, color: C.muted })],
    alignment: AlignmentType.CENTER,
    spacing: { after: 80 },
  }),
  new Paragraph({
    children: [new TextRun({ text: `Date: ${new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}`, size: 22, color: C.muted })],
    alignment: AlignmentType.CENTER,
    spacing: { after: 80 },
  }),
  new Paragraph({
    children: [new TextRun({ text: 'Classification: Internal – Confidential', size: 22, color: C.red, bold: true })],
    alignment: AlignmentType.CENTER,
    spacing: { after: 80 },
  }),
  spacer(6),
  new Paragraph({ children: [], pageBreakBefore: true }),
];

const tocSection = [
  h1('Table of Contents'),
  bullet('1. Executive Summary', 0),
  bullet('2. Project Overview & Purpose', 0),
  bullet('3. Technology Stack', 0),
  bullet('4. System Architecture', 0),
  bullet('5. Database Design', 0),
  bullet('   5.1 Users Table', 1),
  bullet('   5.2 Rides Table', 1),
  bullet('   5.3 Ride Requests Table', 1),
  bullet('   5.4 Passenger Listings Table', 1),
  bullet('   5.5 Trip Logs Table', 1),
  bullet('   5.6 Incidents Table', 1),
  bullet('   5.7 Notifications Table', 1),
  bullet('   5.8 Messages Table', 1),
  bullet('   5.9 Ratings Table', 1),
  bullet('   5.10 Push Subscriptions Table', 1),
  bullet('   5.11 Password Resets Table', 1),
  bullet('6. User Roles & Permissions', 0),
  bullet('7. Authentication & Security', 0),
  bullet('8. Frontend Components', 0),
  bullet('   8.1 App.jsx – Entry Point & Routing', 1),
  bullet('   8.2 UserPortal.jsx – Login & Authentication', 1),
  bullet('   8.3 Registration.jsx – Account Creation', 1),
  bullet('   8.4 PassengerDashboard.jsx', 1),
  bullet('   8.5 PoolHostDashboard.jsx', 1),
  bullet('   8.6 AppLayout.jsx – Shared Layout', 1),
  bullet('   8.7 MapComponent.jsx – Interactive Maps', 1),
  bullet('   8.8 AIChat.jsx – AI Copilot', 1),
  bullet('   8.9 ESGDashboard.jsx', 1),
  bullet('   8.10 Admin Modules', 1),
  bullet('9. Backend API Reference', 0),
  bullet('10. Core Business Logic & Algorithms', 0),
  bullet('11. Real-Time Features (WebSocket)', 0),
  bullet('12. Safety & Incident Management', 0),
  bullet('13. AI Integration (NVIDIA NIM + Gemini Fallback)', 0),
  bullet('14. ESG Impact Tracking', 0),
  bullet('15. Notification System', 0),
  bullet('16. Penalty & Trust System', 0),
  bullet('17. UI/UX Design System', 0),
  bullet('18. Deployment Configuration', 0),
  bullet('19. Known Limitations & Future Roadmap', 0),
  bullet('20. Glossary', 0),
  spacer(2),
  new Paragraph({ children: [], pageBreakBefore: true }),
];

const executiveSummary = [
  h1('1. Executive Summary'),
  para('Reliance Commuter Connect (internally referred to as "Carpool") is a full-stack, corporate-grade carpooling platform developed exclusively for Reliance Industries Limited employees. The platform digitises and automates the entire end-to-end commute-sharing process — from ride listing and matching to live GPS tracking, SOS emergency handling, and ESG environmental reporting — within a secure, role-based web application.'),
  spacer(),
  h3('Purpose'),
  para('The application addresses the following organisational pain points:'),
  bullet('Reduction of single-occupancy vehicle commutes across Reliance campuses in Mumbai, Navi Mumbai, and Bangalore'),
  bullet('Enabling employees to share transport costs and reduce carbon footprint'),
  bullet('Providing a safe, traceable, and verifiable commute ecosystem for all employees'),
  bullet('Delivering real-time operational visibility to administrators'),
  bullet('Generating ESG (Environmental, Social, Governance) data for Reliance\'s sustainability reporting'),
  spacer(),
  h3('Platform Highlights'),
  makeTable(
    ['Feature', 'Description'],
    [
      ['Three-Role System', 'Admin, Pool Host (Driver), Passenger – each with distinct dashboards and capabilities'],
      ['Smart Ride Matching', 'Geospatial matching with route polyline analysis, time-window filtering, and Women-Only mode'],
      ['Live GPS Tracking', 'Real-time driver location broadcast via WebSocket to all passengers in a ride'],
      ['AI Copilot', 'NVIDIA NIM (meta/llama-3.3-70b-instruct) powered Commute Copilot — conversational ride booking and policy Q&A with tool calling'],
      ['SOS & Safety', 'One-tap SOS triggers an incident with 15-minute SLA and real-time admin alerts'],
      ['ESG Dashboard', 'Tracks CO₂ avoided, fuel saved, employee cost savings, and tree-equivalents'],
      ['Penalty System', 'Automated no-show penalty and 15-day suspension enforcement'],
      ['Push Notifications', 'Web Push (VAPID) for real-time alerts even when app is closed'],
    ],
    [35, 65]
  ),
  spacer(2),
  new Paragraph({ children: [], pageBreakBefore: true }),
];

const projectOverview = [
  h1('2. Project Overview & Purpose'),
  h2('2.1 Background'),
  para('Reliance Industries Limited operates large campuses including RCP (Reliance Corporate Park) in Ghansoli, Navi Mumbai. Thousands of employees commute daily using personal vehicles, leading to parking congestion, increased traffic, higher fuel expenditure per employee, and significant CO₂ emissions. The Commuter Connect platform was conceived to solve this challenge through a peer-to-peer, technology-enabled carpooling network that is exclusive to RIL employees.'),
  spacer(),
  h2('2.2 Target Users'),
  makeTable(
    ['Role', 'Who They Are', 'Primary Goal'],
    [
      ['Admin', 'Platform administrators (e.g., facility management, HR)', 'Monitor operations, verify hosts, respond to incidents'],
      ['Pool Host', 'Employees who own vehicles and drive to work', 'Offer rides, earn cost-sharing, reduce fuel cost'],
      ['Passenger', 'Employees who need a ride', 'Find and book convenient rides to/from campus'],
    ],
    [20, 40, 40]
  ),
  spacer(),
  h2('2.3 Key Operational Locations'),
  bullet('Reliance Corporate Park (RCP), Ghansoli, Navi Mumbai – Primary campus with specific gate/TC location presets in the system'),
  bullet('Mumbai – Bandra Kurla Complex, Nariman Point, etc.'),
  bullet('Bangalore – Whitefield, Electronic City'),
  bullet('The map system is pre-loaded with 30+ RCP internal locations (Gates A-G, Twin Towers, LDC, TCs 1-30)'),
  spacer(),
  h2('2.4 Business Value'),
  para('The platform delivers value across multiple dimensions:'),
  makeTable(
    ['Stakeholder', 'Value Delivered'],
    [
      ['Employees (Passengers)', 'Reduced commute cost (ride-sharing), convenient booking, trusted co-worker network'],
      ['Employees (Hosts)', 'Partial fuel cost recovery, social commuting, ESG contribution recognition'],
      ['HR / Admin', 'Real-time operational visibility, incident response, compliance audit trail'],
      ['Reliance (Corporate)', 'ESG reporting metrics, reduced parking pressure, improved employee satisfaction'],
      ['Environment', 'Reduced vehicular CO₂ emissions, fuel consumption tracking'],
    ],
    [35, 65]
  ),
  spacer(2),
  new Paragraph({ children: [], pageBreakBefore: true }),
];

const techStack = [
  h1('3. Technology Stack'),
  h2('3.1 Frontend'),
  makeTable(
    ['Technology', 'Version', 'Purpose'],
    [
      ['React', '19.2.6', 'UI component framework – all dashboards are React SPA'],
      ['Vite', '8.0.12', 'Build tool and development server with HMR'],
      ['TailwindCSS', '4.3.0', 'Utility-first CSS for rapid UI development'],
      ['React Leaflet', '5.0.0', 'Interactive map components built on Leaflet.js'],
      ['Leaflet.js', '1.9.4', 'Open-source mapping library (OpenStreetMap tiles)'],
      ['Recharts', '3.8.1', 'SVG-based charting library for ESG dashboard'],
      ['Socket.IO Client', '4.8.3', 'WebSocket client for real-time events'],
      ['docx', '9.7.1', 'Word document generation (used for reporting)'],
    ],
    [25, 15, 60]
  ),
  spacer(),
  h2('3.2 Backend'),
  makeTable(
    ['Technology', 'Version', 'Purpose'],
    [
      ['Node.js', 'LTS', 'JavaScript runtime environment'],
      ['Express.js', '5.2.1', 'HTTP web framework for REST API'],
      ['SQLite3', '6.0.1', 'File-based relational database'],
      ['Socket.IO', '4.8.3', 'WebSocket server for real-time bidirectional events'],
      ['bcrypt', '6.0.0', 'Password hashing with salt (cost factor 10)'],
      ['jsonwebtoken', '9.0.3', 'JWT generation and verification (15-min sliding sessions)'],
      ['multer', '2.1.1', 'Multipart form-data handling for file uploads (avatars)'],
      ['web-push', '3.6.7', 'VAPID-based Web Push notification delivery'],
      ['express-rate-limit', '8.5.2', 'API rate limiting (100 req / 15 min per IP)'],
      ['openai', '4.x', 'OpenAI-compatible SDK used to call NVIDIA NIM API (primary AI provider)'],
      ['@google/generative-ai', '0.24.1', 'Gemini AI SDK — legacy fallback provider (AI_PROVIDER=gemini)'],
      ['dotenv', '17.4.2', 'Environment variable loading from .env file'],
      ['cors', '2.8.6', 'Cross-Origin Resource Sharing middleware'],
    ],
    [25, 15, 60]
  ),
  spacer(),
  h2('3.3 External APIs & Services'),
  makeTable(
    ['Service', 'Usage'],
    [
      ['OpenStreetMap (via Leaflet)', 'Map tiles for interactive route planning and live tracking'],
      ['Photon by Komoot', 'Geocoding and reverse geocoding API (location search suggestions)'],
      ['OSRM (Open Source Routing Machine)', 'Driving route calculation, polyline generation, and ETA computation'],
      ['NVIDIA NIM API (build.nvidia.com)', 'Primary AI Copilot — meta/llama-3.3-70b-instruct with OpenAI-compatible tool calling'],
      ['Google Gemini 2.5 Flash Lite', 'Legacy/fallback AI Copilot (activated via AI_PROVIDER=gemini in .env)'],
      ['VAPID Web Push', 'Browser push notifications (requires service worker)'],
    ],
    [35, 65]
  ),
  spacer(),
  h2('3.4 Development & Build Tools'),
  makeTable(
    ['Tool', 'Purpose'],
    [
      ['ESLint', 'JavaScript/React linting (eslint-plugin-react-hooks, react-refresh)'],
      ['PostCSS + Autoprefixer', 'CSS processing pipeline for TailwindCSS'],
      ['Puppeteer', 'Headless browser automation (testing/PDF generation)'],
      ['Vite (--host flag)', 'Development server accessible on local network'],
    ],
    [30, 70]
  ),
  spacer(2),
  new Paragraph({ children: [], pageBreakBefore: true }),
];

const architecture = [
  h1('4. System Architecture'),
  h2('4.1 Architecture Overview'),
  para('The platform follows a classic client-server architecture with real-time extensions:'),
  bullet('Frontend: Single-Page Application (SPA) built with React and Vite, served statically in production'),
  bullet('Backend: Node.js / Express.js REST API server (port 3001) with an embedded WebSocket server'),
  bullet('Database: SQLite file-based database (./database.sqlite) co-located with the server'),
  bullet('Real-Time Layer: Socket.IO for bidirectional WebSocket communication between server and clients'),
  bullet('External Integrations: OSRM routing, Photon geocoding, NVIDIA NIM AI (primary) / Gemini AI (fallback), Web Push notifications'),
  spacer(),
  h2('4.2 Request Flow'),
  para('A typical user interaction flows as follows:'),
  bullet('1. Browser loads the React SPA (index.html → main.jsx → App.jsx)'),
  bullet('2. User authenticates via POST /api/auth/login → receives JWT token'),
  bullet('3. JWT is stored in localStorage and attached to all subsequent API requests as Bearer token'),
  bullet('4. Server validates JWT via authenticateToken middleware (sliding 15-min session)'),
  bullet('5. On login, the client establishes a Socket.IO connection and joins their personal room (user_<id>) or admin_room'),
  bullet('6. Role-based rendering: Admin → Admin dashboard, Pool Host → PoolHostDashboard, Passenger → PassengerDashboard'),
  spacer(),
  h2('4.3 Port Configuration'),
  makeTable(
    ['Service', 'Port', 'Notes'],
    [
      ['Frontend Dev Server', '5173 (default Vite)', 'Proxies /api/* to backend'],
      ['Backend API + WebSocket', '3001', 'Single Express + Socket.IO server'],
      ['SQLite Database', 'File: server/database.sqlite', 'No network port; embedded'],
    ],
    [30, 30, 40]
  ),
  spacer(),
  h2('4.4 Security Layers'),
  bullet('JWT-based stateless authentication with 15-minute token expiry (sliding sessions via X-New-Token header)'),
  bullet('bcrypt password hashing (cost factor 10) – no plaintext passwords stored'),
  bullet('Rate limiting: 100 requests per 15 minutes per IP on all /api/ routes'),
  bullet('Role-based endpoint guards: every sensitive endpoint checks req.user.role'),
  bullet('CORS configured for cross-origin requests (wildcard origin – suitable for internal network)'),
  bullet('Input validation: email format, password length (min 8), name length (max 100), enum role validation'),
  bullet('Admin-only registration blocked: only Passenger and Pool Host roles can self-register'),
  bullet('File upload security: server-side filename randomisation prevents path traversal'),
  spacer(2),
  new Paragraph({ children: [], pageBreakBefore: true }),
];

const database = [
  h1('5. Database Design'),
  para('The system uses SQLite as its embedded relational database. The schema is initialised automatically on first server start via the initializeSchema() function. All tables use INTEGER PRIMARY KEY AUTOINCREMENT for primary keys and FOREIGN KEY constraints for referential integrity.'),
  spacer(),
  h2('5.1 Users Table'),
  makeTable(
    ['Column', 'Type', 'Description'],
    [
      ['id', 'INTEGER PK', 'Auto-incremented primary key'],
      ['name', 'TEXT NOT NULL', 'Employee full name (max 100 chars)'],
      ['email', 'TEXT NOT NULL', 'Corporate email address (unique per role)'],
      ['emp_id', 'TEXT', 'Employee ID (e.g., EMP12345) – auto-generated if not provided'],
      ['gender', 'TEXT', 'Male / Female / Prefer Not to Say – used for Women-Only rides'],
      ['password', 'TEXT', 'bcrypt hashed password (cost factor 10)'],
      ['role', 'TEXT NOT NULL', 'ENUM: Pool Host | Passenger | Admin'],
      ['has_vehicle_pass', 'BOOLEAN', '0 = Pending verification, 1 = Admin verified'],
      ['vehicle_no', 'TEXT', 'Vehicle registration number (e.g., MH 04 AB 1234)'],
      ['vehicle_make', 'TEXT', 'Vehicle manufacturer (e.g., Maruti Suzuki)'],
      ['vehicle_model', 'TEXT', 'Vehicle model (e.g., Swift)'],
      ['vehicle_capacity', 'TEXT', 'Seating capacity: 4+1, 5+1, 6+1, 7+1'],
      ['status', 'TEXT', 'Active | Suspended'],
      ['no_show_count', 'INTEGER', 'Legacy no-show counter'],
      ['penalty_points', 'INTEGER', 'Current penalty points (0–3; 3 triggers 15-day suspension)'],
      ['suspended_until', 'DATETIME', 'Suspension expiry timestamp (nullable)'],
      ['avatar_url', 'TEXT', 'Path to uploaded profile image (e.g., /uploads/xxx.jpg)'],
      ['created_at', 'DATETIME', 'Account creation timestamp'],
    ],
    [25, 20, 55]
  ),
  para('Unique constraint: (email, role) – a single email can register as both a Passenger and Pool Host.', true),
  spacer(),
  h2('5.2 Rides Table'),
  makeTable(
    ['Column', 'Type', 'Description'],
    [
      ['id', 'INTEGER PK', 'Auto-incremented ride ID'],
      ['driver_id', 'INTEGER FK', 'References users(id) – the Pool Host offering the ride'],
      ['origin', 'TEXT NOT NULL', 'Human-readable start location'],
      ['destination', 'TEXT NOT NULL', 'Human-readable end location'],
      ['origin_lat / origin_lng', 'REAL', 'GPS coordinates of origin'],
      ['dest_lat / dest_lng', 'REAL', 'GPS coordinates of destination'],
      ['route_polyline', 'TEXT', 'JSON array of [lng, lat] coordinates from OSRM routing'],
      ['departure_time', 'TEXT NOT NULL', 'Scheduled departure time in HH:MM format'],
      ['recurring_days', 'TEXT', 'Comma-separated days: e.g., Mon,Tue,Wed,Thu,Fri'],
      ['seats_offered', 'INTEGER', 'Current available seat count (decrements on acceptance)'],
      ['original_seats', 'INTEGER', 'Initial seat count at ride creation'],
      ['price_per_seat', 'REAL', 'Cost sharing per seat in INR'],
      ['women_only', 'BOOLEAN', '1 = Only female passengers accepted; female driver required'],
      ['status', 'TEXT', 'Scheduled | Cancelled'],
      ['expected_duration_mins', 'INTEGER', 'Route duration from OSRM in minutes'],
      ['actual_start_time', 'DATETIME', 'Timestamp when ride was started'],
      ['delay_reminder_sent', 'INTEGER', '0 = None, 1 = Reminder sent, 2 = Escalated'],
      ['created_at', 'DATETIME', 'Ride creation timestamp'],
    ],
    [28, 18, 54]
  ),
  spacer(),
  h2('5.3 Ride Requests Table'),
  makeTable(
    ['Column', 'Type', 'Description'],
    [
      ['id', 'INTEGER PK', 'Auto-incremented request ID'],
      ['ride_id', 'INTEGER FK', 'References rides(id)'],
      ['passenger_listing_id', 'INTEGER FK', 'References passenger_listings(id) – for reverse matching'],
      ['passenger_id', 'INTEGER FK', 'References users(id) – the requesting passenger'],
      ['requested_days', 'TEXT', 'Days this request is valid for'],
      ['status', 'TEXT', 'Pending | Offered | Accepted | Rejected | Cancelled | No-Show | Passenger No-Show | Host No-Show'],
      ['pickup_lat / pickup_lng', 'REAL', 'Passenger\'s specific pickup GPS coordinates (for multi-stop routing)'],
      ['created_at', 'DATETIME', 'Request submission timestamp'],
    ],
    [28, 18, 54]
  ),
  spacer(),
  h2('5.4 Passenger Listings Table (Reverse Matching)'),
  para('Passengers can post their commute needs independently, allowing Pool Hosts to discover and proactively offer rides.'),
  makeTable(
    ['Column', 'Type', 'Description'],
    [
      ['id', 'INTEGER PK', 'Auto-incremented listing ID'],
      ['passenger_id', 'INTEGER FK', 'References users(id)'],
      ['origin / destination', 'TEXT NOT NULL', 'Passenger\'s commute route'],
      ['origin_lat/lng, dest_lat/lng', 'REAL', 'GPS coordinates for geospatial matching'],
      ['departure_time', 'TEXT NOT NULL', 'Preferred departure time (HH:MM)'],
      ['recurring_days', 'TEXT', 'Preferred days (default: Mon-Fri)'],
      ['status', 'TEXT', 'Active | Fulfilled | Expired'],
      ['created_at', 'DATETIME', 'Creation timestamp'],
    ],
    [30, 18, 52]
  ),
  spacer(),
  h2('5.5 Trip Logs Table (Daily Execution Records)'),
  para('Rides in this system are recurring weekly schedules. Each day a ride runs, a trip log entry is created. This allows the same ride entity to track daily completion status without duplicating ride records.'),
  makeTable(
    ['Column', 'Type', 'Description'],
    [
      ['id', 'INTEGER PK', 'Auto-incremented log ID'],
      ['ride_id', 'INTEGER FK', 'References rides(id)'],
      ['date', 'TEXT NOT NULL', 'YYYY-MM-DD format date of the trip instance'],
      ['status', 'TEXT', 'In Progress | Completed'],
      ['created_at', 'DATETIME', 'Log creation timestamp'],
    ],
    [25, 18, 57]
  ),
  para('Unique constraint: (ride_id, date) – ensures only one log per ride per day.', true),
  spacer(),
  h2('5.6 Incidents Table (SOS & Escalations)'),
  makeTable(
    ['Column', 'Type', 'Description'],
    [
      ['id', 'INTEGER PK', 'Auto-incremented incident ID'],
      ['reported_by', 'INTEGER FK', 'References users(id) – reporter'],
      ['type', 'TEXT NOT NULL', 'Incident description (max 200 chars)'],
      ['status', 'TEXT', 'Open | Resolved | Escalated'],
      ['sla_deadline', 'DATETIME NOT NULL', '15 minutes from creation for SOS; 24 hours for auto-escalations'],
      ['created_at', 'DATETIME', 'Incident creation timestamp'],
    ],
    [25, 18, 57]
  ),
  spacer(),
  h2('5.7 Notifications Table'),
  makeTable(
    ['Column', 'Type', 'Description'],
    [
      ['id', 'INTEGER PK', 'Notification ID'],
      ['user_id', 'INTEGER FK', 'Target user'],
      ['message', 'TEXT NOT NULL', 'Notification text'],
      ['type', 'TEXT NOT NULL', 'RideCancelled_Alternatives | RequestCancelled | Suspension | Penalty | etc.'],
      ['action_data', 'TEXT', 'Optional JSON payload (e.g., list of alternative rides)'],
      ['is_read', 'BOOLEAN', '0 = Unread, 1 = Read'],
      ['created_at', 'DATETIME', 'Creation timestamp'],
    ],
    [25, 18, 57]
  ),
  spacer(),
  h2('5.8 Messages Table (In-Ride Chat)'),
  makeTable(
    ['Column', 'Type', 'Description'],
    [
      ['id', 'INTEGER PK', 'Message ID'],
      ['request_id', 'INTEGER FK', 'References ride_requests(id) – chat is per accepted request'],
      ['sender_id', 'INTEGER FK', 'References users(id)'],
      ['content', 'TEXT NOT NULL', 'Message text'],
      ['created_at', 'DATETIME', 'Send timestamp'],
    ],
    [25, 18, 57]
  ),
  para('Chat is restricted to Accepted ride requests only. Both driver and passenger can access the same thread.', true),
  spacer(),
  h2('5.9 Ratings Table'),
  makeTable(
    ['Column', 'Type', 'Description'],
    [
      ['id', 'INTEGER PK', 'Rating ID'],
      ['trip_id', 'INTEGER FK', 'References rides(id)'],
      ['rater_id', 'INTEGER FK', 'User submitting the rating'],
      ['ratee_id', 'INTEGER FK', 'User being rated'],
      ['stars', 'INTEGER NOT NULL', '1–5 stars (CHECK constraint enforced)'],
      ['tags', 'TEXT', 'Comma-separated behaviour tags (e.g., harassment, rash driving)'],
      ['comment', 'TEXT', 'Free-text feedback'],
      ['created_at', 'DATETIME', 'Submission timestamp'],
    ],
    [25, 18, 57]
  ),
  para('Auto-escalation: Ratings with safety tags (harassment, unsafe driving, rash driving) automatically create an Incident record with 24-hour SLA.', true),
  spacer(),
  h2('5.10 Push Subscriptions Table'),
  makeTable(
    ['Column', 'Type', 'Description'],
    [
      ['id', 'INTEGER PK', 'Subscription ID'],
      ['user_id', 'INTEGER FK', 'References users(id)'],
      ['endpoint', 'TEXT NOT NULL UNIQUE', 'Browser push service endpoint URL'],
      ['p256dh', 'TEXT NOT NULL', 'Public key for encryption'],
      ['auth', 'TEXT NOT NULL', 'Auth secret for push message'],
      ['created_at', 'DATETIME', 'Registration timestamp'],
    ],
    [25, 18, 57]
  ),
  spacer(),
  h2('5.11 Password Resets Table'),
  makeTable(
    ['Column', 'Type', 'Description'],
    [
      ['id', 'INTEGER PK', 'Reset record ID'],
      ['email', 'TEXT NOT NULL', 'User email for the reset request'],
      ['token', 'TEXT NOT NULL', '6-character hex token (e.g., A3F7C2)'],
      ['expires_at', 'DATETIME NOT NULL', '15 minutes from creation'],
      ['used', 'BOOLEAN', '0 = Unused, 1 = Token consumed'],
      ['created_at', 'DATETIME', 'Creation timestamp'],
    ],
    [25, 18, 57]
  ),
  spacer(2),
  new Paragraph({ children: [], pageBreakBefore: true }),
];

const rolesAndPermissions = [
  h1('6. User Roles & Permissions'),
  para('The platform implements a strict three-role RBAC (Role-Based Access Control) system. Roles are stored in the database and validated on every API call.'),
  spacer(),
  h2('6.1 Admin Role'),
  para('Admins are seeded directly into the database. They cannot self-register. Default credentials: admin@reliance.com / Reliance@1024.'),
  bullet('View all registered users, rides, and incidents'),
  bullet('Approve / reject Pool Host vehicle pass verification'),
  bullet('Suspend or reactivate any user account'),
  bullet('Assign Admin role to existing users'),
  bullet('View and resolve all SOS incidents'),
  bullet('Escalate incidents to ERT (Emergency Response Team)'),
  bullet('Access ESG Impact Dashboard'),
  bullet('View Trips & Disputes register'),
  bullet('Reset user penalty points'),
  bullet('Receive real-time SOS WebSocket alerts via admin_room'),
  bullet('Receive Web Push notifications for new SOS events'),
  spacer(),
  h2('6.2 Pool Host Role'),
  para('Employees who own vehicles and choose to offer rides. Must be verified (has_vehicle_pass) before the vehicle pass badge is shown, though they can still offer rides before verification.'),
  bullet('Create ride listings with full geospatial data, recurring schedule, and seat count'),
  bullet('View their listed rides and all passenger requests per ride'),
  bullet('Accept or reject passenger ride requests'),
  bullet('Offer rides to passengers who posted commute needs (Reverse Matching)'),
  bullet('Start a ride (within ±10 minutes of scheduled time)'),
  bullet('Broadcast live GPS location to passengers during an active ride'),
  bullet('Notify passengers of imminent departure'),
  bullet('Mark a ride as completed for the day'),
  bullet('Report passenger No-Shows'),
  bullet('View personal KPIs: rides offered, people carpooled, avg earnings, CO₂ saved'),
  bullet('Access in-ride chat with accepted passengers'),
  bullet('Trigger SOS from their dashboard'),
  bullet('View ESG contribution stats'),
  spacer(),
  h2('6.3 Passenger Role'),
  para('Employees seeking carpooling. They browse and request available rides.'),
  bullet('Search for available rides by origin, destination, and time (with geospatial matching)'),
  bullet('Post their own commute needs for Pool Hosts to discover (Reverse Matching)'),
  bullet('Send ride requests to Pool Hosts'),
  bullet('Accept or reject ride offers from Pool Hosts'),
  bullet('Cancel requests (blocked within 15 minutes of departure)'),
  bullet('View live GPS tracking of their driver during an active ride'),
  bullet('Complete a ride via Swipe-to-Complete gesture'),
  bullet('Rate drivers after a completed trip'),
  bullet('Report Pool Host No-Shows'),
  bullet('Trigger SOS from their dashboard'),
  bullet('View personal KPIs: rides taken, avg cost, CO₂ saved'),
  bullet('Filter rides by Women-Only mode'),
  bullet('Toggle Verified Hosts filter to see only admin-verified drivers'),
  spacer(2),
  new Paragraph({ children: [], pageBreakBefore: true }),
];

const authSecurity = [
  h1('7. Authentication & Security'),
  h2('7.1 Registration'),
  para('New users self-register via the /api/register endpoint. The system:'),
  bullet('Validates email format with regex'),
  bullet('Enforces minimum password length of 8 characters'),
  bullet('Blocks Admin role self-registration (only Passenger / Pool Host allowed)'),
  bullet('Auto-generates a unique Employee ID (EMP + 5 digits) if the email is new'),
  bullet('Reuses the EMP ID if the email already exists with a different role'),
  bullet('Hashes password with bcrypt (salt rounds: 10) before storage'),
  spacer(),
  h2('7.2 Authentication'),
  para('The login flow (POST /api/auth/login):'),
  bullet('Requires email, password, and role (to disambiguate dual-role users)'),
  bullet('Fetches user record by (email, role) pair'),
  bullet('Checks account suspension status and auto-lifts if suspended_until has passed'),
  bullet('Compares submitted password against stored bcrypt hash'),
  bullet('Signs a JWT containing { id, email, role, name, gender } with 15-minute expiry'),
  bullet('Returns the user object (without password) and token to the client'),
  bullet('Client stores the JWT in localStorage under the key "token"'),
  spacer(),
  h2('7.3 Session Management (Sliding Sessions)'),
  para('The authenticateToken middleware re-issues a new token on every authenticated API call:'),
  bullet('Extracts Bearer token from Authorization header'),
  bullet('Verifies JWT signature and expiry'),
  bullet('Signs a fresh token with a new 15-minute window'),
  bullet('Returns the new token in the X-New-Token response header'),
  bullet('The client-side (AppLayout) intercepts this header and updates localStorage automatically'),
  para('This implements a sliding session — the session remains active as long as the user interacts with the system every 15 minutes.', true),
  spacer(),
  h2('7.4 Password Recovery'),
  para('The forgot/reset flow (no authentication required):'),
  bullet('User submits email via POST /api/auth/forgot-password'),
  bullet('Server generates a 6-character hex token and stores with 15-minute expiry'),
  bullet('Token is printed to server console (no email service configured)'),
  bullet('User submits token + new password via POST /api/auth/reset-password'),
  bullet('Token is validated (unused + not expired) before updating the hashed password'),
  bullet('Token is marked as used after a successful reset'),
  para('Note: Email delivery is not implemented. The reset token appears in the backend console log. This is suitable for internal IT-facilitated resets.', true),
  spacer(),
  h2('7.5 Rate Limiting'),
  para('All /api/* routes are protected by express-rate-limit:'),
  bullet('Window: 15 minutes'),
  bullet('Limit: 100 requests per IP per window'),
  bullet('Response on breach: HTTP 429 with error message'),
  spacer(2),
  new Paragraph({ children: [], pageBreakBefore: true }),
];

const frontendComponents = [
  h1('8. Frontend Components'),
  h2('8.1 App.jsx – Entry Point & Routing'),
  para('The main application entry component handles role-based conditional rendering. It manages:'),
  bullet('Session state (localStorage.getItem("carpool_session"))'),
  bullet('WebSocket connection lifecycle (Socket.IO client)'),
  bullet('Global toast notification system'),
  bullet('Role-based dashboard routing: Admin, Pool Host, Passenger'),
  bullet('Admin KPI data fetching (users, trips, incidents) for the Overview tab'),
  bullet('Admin action handlers: approveVerification, resolveIncident'),
  bullet('Navigation tab state for the Admin dashboard'),
  spacer(),
  para('Routing logic:'),
  codeBlock('if (!session) → Login / Registration screens'),
  codeBlock('if (session.role === "Passenger") → PassengerDashboard'),
  codeBlock('if (session.role === "Pool Host") → PoolHostDashboard'),
  codeBlock('else (Admin) → Admin Dashboard with tabbed navigation'),
  spacer(),
  h2('8.2 UserPortal.jsx – Login & Authentication'),
  para('Provides the unified sign-in interface with three view modes:'),
  bullet('"login" – Standard email/password/role login form'),
  bullet('"forgot" – Email input to request a password reset token'),
  bullet('"reset" – Token + new password submission form'),
  para('Features:'),
  bullet('Role selector toggle: Passenger or Pool Host (or Admin via direct input)'),
  bullet('Handles suspended account messaging with expiry details'),
  bullet('JWT stored in localStorage on successful login'),
  spacer(),
  h2('8.3 Registration.jsx – Account Creation'),
  para('Self-registration form for new employees. Supports role selection:'),
  bullet('Passenger: Name, Gender, Corporate Email, Password'),
  bullet('Pool Host: All Passenger fields + Vehicle Make, Model, Registration No., Capacity, Vehicle Pass checkbox'),
  para('The form dynamically shows vehicle details only when Pool Host role is selected. Submits to POST /api/register.'),
  spacer(),
  h2('8.4 PassengerDashboard.jsx (993 lines)'),
  para('The most feature-rich passenger-facing interface. Contains:'),
  h4('Discovery View'),
  bullet('Origin / Destination autocomplete inputs (with Photon API + RCP internal locations)'),
  bullet('Departure time picker and day-of-week selector'),
  bullet('Women-Only filter toggle'),
  bullet('Verified Hosts filter'),
  bullet('Interactive map (Leaflet) for pickup/dropoff pin placement'),
  bullet('Match results list with distance, price, driver info, and seat count'),
  bullet('One-click ride request submission'),
  h4('Dashboard View'),
  bullet('KPI cards: Rides Taken, Avg Cost, CO₂ Saved, Upcoming Ride'),
  bullet('Active request management: Accept/Reject offers, Cancel accepted rides'),
  bullet('Live driver location display on map with ETA'),
  bullet('Swipe-to-Complete gesture for trip completion'),
  bullet('Post-ride rating modal with stars, behaviour tags, and comment'),
  bullet('Notification bell with inline action cards for alternative rides'),
  bullet('SOS trigger modal with incident type selection'),
  bullet('In-ride chat modal with driver'),
  bullet('Profile edit modal'),
  h4('Commute Need Listing (Reverse Matching)'),
  bullet('Passengers can post their own commute requirement for hosts to find them'),
  spacer(),
  h2('8.5 PoolHostDashboard.jsx (1081 lines)'),
  para('The driver-facing command centre. Contains:'),
  h4('Ride Listing Flow'),
  bullet('Origin / Destination with full autocomplete and map pin selection'),
  bullet('Departure time, seats offered (capped by vehicle capacity), price per seat'),
  bullet('Recurring days selector (Mon–Sun)'),
  bullet('Women-Only toggle (restricted to Female gender profiles)'),
  bullet('OSRM route calculation triggered automatically on submission'),
  h4('Active Ride Management'),
  bullet('Listed rides card with pending/accepted passenger counts'),
  bullet('Per-ride expandable section showing all passenger requests with status'),
  bullet('Accept / Reject / No-Show actions per request'),
  bullet('Start Ride (within ±10 min window), Notify Passengers, Complete Ride, Cancel Ride buttons'),
  bullet('Live GPS location broadcast (navigator.geolocation.watchPosition → POST /api/rides/:id/location)'),
  bullet('Route polyline displayed on map with multi-stop optimization'),
  h4('Reverse Matching (Find Passengers)'),
  bullet('Browse passengers who posted commute needs that match the host\'s scheduled route'),
  bullet('Send ride offer directly to matching passengers'),
  h4('Stats & Other Features'),
  bullet('KPI cards: Rides Offered, People Carpooled, Pending Requests, Avg Earnings, CO₂ Saved'),
  bullet('SOS trigger, profile edit, notifications, in-ride chat'),
  spacer(),
  h2('8.6 AppLayout.jsx – Shared Shell'),
  para('Reusable layout wrapper used by Admin, Passenger, and Pool Host. Provides:'),
  bullet('Responsive sidebar navigation (desktop) / bottom navigation bar (mobile)'),
  bullet('User avatar, name, and role badge in the profile dropdown'),
  bullet('Multi-role switcher: if a user is registered as both Passenger and Pool Host, they can switch dashboards without logging out'),
  bullet('Notification bell with badge count'),
  bullet('SOS emergency button in the header'),
  bullet('Global search bar (destination search – UI only)'),
  spacer(),
  h2('8.7 MapComponent.jsx – Interactive Maps'),
  para('Wraps React Leaflet with custom enhancements:'),
  bullet('Custom colour-coded pin icons: Teal for pickup, Red for dropoff, Amber car emoji for live driver'),
  bullet('MapBoundsUpdater: auto-fits map bounds to show both pickup and dropoff markers'),
  bullet('LocationSelector: click-to-set coordinates on the map'),
  bullet('AutocompleteInput component: debounced search with Photon API + RCP internal locations preloaded'),
  bullet('RCP internal location database: 30+ locations including Gates A-G, Twin Towers, LDC, TC 1-30'),
  bullet('Route polyline rendering from OSRM (converts [lng, lat] to Leaflet [lat, lng])'),
  bullet('Live driver location marker updates in real-time'),
  spacer(),
  h2('8.8 AIChat.jsx – AI Copilot'),
  para('"Reliance Copilot" – a floating chat interface powered by Gemini AI:'),
  bullet('Floating action button (✨) – fixed bottom-left'),
  bullet('Slide-in chat window (380×500px)'),
  bullet('Conversational interface with role-aware context injection'),
  bullet('Supports two AI tool actions: draft_booking and draft_listing'),
  bullet('When a tool action is triggered, renders an "Action Card" with ride details for user confirmation'),
  bullet('Confirms the action by pre-filling the main booking / listing form'),
  bullet('Maintains full conversation history for multi-turn dialogue'),
  spacer(),
  h2('8.9 ESGDashboard.jsx'),
  para('Environmental, Social, Governance metrics display. Features:'),
  bullet('4 KPI cards: CO₂ Avoided (31,400 kg), Fuel Saved (9,420 litres), Employee ₹ Saved (₹7,84,000), Trees Equivalent (1,450)'),
  bullet('CO₂ Avoided Trend – Area chart (Recharts) showing 6-month monthly data'),
  bullet('Fuel Saved by Business Unit – Horizontal bar chart broken down by Jio Platforms, Reliance Retail, RIL O2C, Reliance Foundation'),
  spacer(),
  h2('8.10 Admin Dashboard Modules'),
  h4('Overview Tab (App.jsx)'),
  bullet('4 KPI tiles: Daily Active Users, CO₂ Saved, Active Rides Now, Pending Verifications'),
  bullet('Verification Queue: List of unverified Pool Hosts with Approve/Reject actions'),
  bullet('Active Alerts panel: Open SOS incidents with Investigate & Resolve button'),
  h4('VerificationQueue.jsx'),
  bullet('Detailed view of Pool Hosts awaiting vehicle pass verification'),
  bullet('Displays vehicle details, submission date, and document status'),
  h4('UserManagement.jsx'),
  bullet('Full user directory with search and filter'),
  bullet('Suspend/reactivate user accounts'),
  bullet('Reset penalty points'),
  bullet('Assign Admin role to users'),
  h4('IncidentQueue.jsx'),
  bullet('SOS and auto-escalated incident management'),
  bullet('Resolve and Escalate to ERT actions'),
  bullet('SLA deadline display and overdue highlighting'),
  h4('TripsDashboard.jsx'),
  bullet('Admin view of all rides in the system'),
  bullet('Filter by status, driver, date'),
  h4('Settings.jsx'),
  bullet('Profile editing (name, phone)'),
  bullet('Avatar upload (supported for all roles)'),
  bullet('Push notification toggle (Web Push subscription management)'),
  bullet('Payment mode preference (Corporate Wallet, UPI, Cash)'),
  spacer(2),
  new Paragraph({ children: [], pageBreakBefore: true }),
];

const apiReference = [
  h1('9. Backend API Reference'),
  para('All API endpoints are prefixed with /api/. Authentication is required for all endpoints except /api/auth/login, /api/register, /api/auth/forgot-password, and /api/auth/reset-password.'),
  spacer(),
  h2('9.1 Authentication Endpoints'),
  makeTable(
    ['Method', 'Endpoint', 'Auth Required', 'Description'],
    [
      ['GET', '/api/users/roles?email=', 'Yes', 'Get all roles registered for an email'],
      ['POST', '/api/auth/login', 'No', 'Login with email, password, role. Returns user + JWT'],
      ['POST', '/api/register', 'No', 'Register new Passenger or Pool Host'],
      ['POST', '/api/auth/forgot-password', 'No', 'Request password reset token'],
      ['POST', '/api/auth/reset-password', 'No', 'Reset password using token'],
    ],
    [10, 35, 15, 40]
  ),
  spacer(),
  h2('9.2 User Management Endpoints'),
  makeTable(
    ['Method', 'Endpoint', 'Role', 'Description'],
    [
      ['GET', '/api/users', 'Admin', 'Get all users'],
      ['POST', '/api/users/:id/assign-admin', 'Admin', 'Grant admin role to a user'],
      ['POST', '/api/users/:id/verify', 'Admin', 'Grant vehicle pass (set has_vehicle_pass = 1)'],
      ['POST', '/api/users/:id/toggle-status', 'Admin', 'Toggle Active / Suspended status'],
      ['POST', '/api/users/:id/update', 'Self/Admin', 'Update name and vehicle details'],
      ['POST', '/api/users/:id/avatar', 'Self/Admin', 'Upload profile image (multipart/form-data)'],
      ['GET', '/api/users/:id/stats', 'Self/Admin', 'Get user KPI stats'],
      ['GET', '/api/users/:id/rides', 'Self/Admin', 'Get Pool Host ride list with requests'],
      ['GET', '/api/users/:id/requests', 'Self/Admin', 'Get Passenger request history'],
      ['GET', '/api/users/:id/notifications', 'Self/Admin', 'Get unread notifications'],
      ['GET', '/api/users/:id/rating', 'Any', 'Get average rating and total count for a user'],
      ['POST', '/api/users/:id/reset-penalty', 'Admin', 'Reset penalty points to 0'],
    ],
    [10, 30, 15, 45]
  ),
  spacer(),
  h2('9.3 Ride Endpoints'),
  makeTable(
    ['Method', 'Endpoint', 'Role', 'Description'],
    [
      ['POST', '/api/rides/create', 'Pool Host', 'Create a new ride listing (triggers OSRM route calc)'],
      ['POST', '/api/rides/match', 'Passenger', 'Match rides by geospatial proximity + time window'],
      ['POST', '/api/rides/:id/cancel', 'Host/Admin', 'Cancel a ride (blocked within 15 min of departure)'],
      ['POST', '/api/rides/:id/complete', 'Host/Passenger/Admin', 'Log ride completion for today'],
      ['POST', '/api/rides/:id/start', 'Host/Admin', 'Start a ride (within ±10 min window)'],
      ['POST', '/api/rides/:id/notify', 'Host/Admin', 'Notify accepted passengers of imminent departure (±10 min)'],
      ['POST', '/api/rides/:id/location', 'Host/Admin', 'Broadcast live GPS location to passengers'],
      ['GET', '/api/trips', 'Admin', 'Get all rides with driver info'],
    ],
    [10, 30, 20, 40]
  ),
  spacer(),
  h2('9.4 Ride Request Endpoints'),
  makeTable(
    ['Method', 'Endpoint', 'Role', 'Description'],
    [
      ['POST', '/api/rides/request', 'Passenger/Host', 'Submit passenger request OR host offer (request_type: HostOffer)'],
      ['POST', '/api/rides/request/:id/accept', 'Host/Passenger', 'Accept a request (decrements seats, triggers route recalc)'],
      ['POST', '/api/rides/request/:id/reject', 'Host/Passenger', 'Reject a request (triggers route recalc)'],
      ['POST', '/api/rides/request/:id/cancel', 'Passenger/Admin', 'Cancel a request (blocked within 15 min; returns seat if accepted)'],
      ['POST', '/api/rides/request/:id/no-show', 'Host/Passenger', 'Report no-show (increments penalty; auto-suspend at 3 points)'],
    ],
    [10, 35, 20, 35]
  ),
  spacer(),
  h2('9.5 Passenger Listing (Reverse Matching) Endpoints'),
  makeTable(
    ['Method', 'Endpoint', 'Role', 'Description'],
    [
      ['POST', '/api/passenger-listings/create', 'Passenger', 'Post a commute need listing'],
      ['GET', '/api/passenger-listings/match/:driverId', 'Pool Host', 'Find passenger listings matching the host\'s scheduled route'],
    ],
    [10, 45, 15, 30]
  ),
  spacer(),
  h2('9.6 Incident & Safety Endpoints'),
  makeTable(
    ['Method', 'Endpoint', 'Role', 'Description'],
    [
      ['POST', '/api/incidents/create', 'Any', 'Trigger an SOS incident (15-min SLA, real-time admin alert)'],
      ['GET', '/api/incidents', 'Admin', 'Get all incidents with reporter details'],
      ['POST', '/api/incidents/resolve', 'Admin', 'Mark incident as Resolved'],
      ['POST', '/api/incidents/escalate', 'Admin', 'Escalate incident to ERT'],
    ],
    [10, 35, 15, 40]
  ),
  spacer(),
  h2('9.7 Messaging & Ratings Endpoints'),
  makeTable(
    ['Method', 'Endpoint', 'Role', 'Description'],
    [
      ['GET', '/api/messages/:request_id', 'Host/Passenger', 'Get all messages for an accepted request thread'],
      ['POST', '/api/messages/:request_id', 'Host/Passenger', 'Send a message in an accepted request thread'],
      ['POST', '/api/ratings', 'Any', 'Submit a ride rating (1–5 stars, tags, comment)'],
    ],
    [10, 35, 20, 35]
  ),
  spacer(),
  h2('9.8 Push Notification Endpoints'),
  makeTable(
    ['Method', 'Endpoint', 'Role', 'Description'],
    [
      ['GET', '/api/push/vapid-public-key', 'Any', 'Get VAPID public key for push subscription'],
      ['POST', '/api/push/subscribe', 'Any', 'Save a push subscription (endpoint + keys)'],
      ['DELETE', '/api/push/subscribe', 'Any', 'Remove a push subscription'],
    ],
    [10, 35, 15, 40]
  ),
  spacer(),
  h2('9.9 Notification Management'),
  makeTable(
    ['Method', 'Endpoint', 'Role', 'Description'],
    [
      ['GET', '/api/users/:id/notifications', 'Self/Admin', 'Get all unread notifications for a user'],
      ['POST', '/api/notifications/:id/read', 'Self/Admin', 'Mark a notification as read'],
    ],
    [10, 35, 20, 35]
  ),
  spacer(),
  h2('9.10 AI Chat Endpoint'),
  makeTable(
    ['Method', 'Endpoint', 'Role', 'Description'],
    [
      ['POST', '/api/chat', 'Any', 'Send message to Gemini AI. Returns text response or action draft (draft_booking / draft_listing)'],
    ],
    [10, 35, 15, 40]
  ),
  spacer(2),
  new Paragraph({ children: [], pageBreakBefore: true }),
];

const businessLogic = [
  h1('10. Core Business Logic & Algorithms'),
  h2('10.1 Ride Matching Algorithm'),
  para('When a passenger searches for rides (POST /api/rides/match), the server runs a multi-criteria geospatial matching process:'),
  h4('Step 1 – Pre-flight Check'),
  bullet('If the passenger already has a Pool Host ride listed within ±30 minutes of the requested time, the request is blocked with an error (prevents double-booking conflict)'),
  h4('Step 2 – Filter Active Rides'),
  bullet('Only "Scheduled" rides with seats_offered > 0 are considered'),
  bullet('Rides already logged as Completed for today are excluded'),
  bullet('Verified-Only filter applied if passenger requests it'),
  h4('Step 3 – Gender / Women-Only Enforcement'),
  bullet('If the ride is women_only = 1, only female passengers may match'),
  bullet('If the passenger requests women_only filter, only female drivers are shown'),
  h4('Step 4 – Time Window Check'),
  bullet('The ride departure time must be within ±15 minutes of the passenger\'s requested time'),
  h4('Step 5 – Geospatial Proximity Check'),
  bullet('If the ride has a route polyline, each point on the route is checked against the passenger\'s origin/destination'),
  bullet('The closest point on the route to the passenger\'s origin is found (scanning forward only to enforce direction)'),
  bullet('Minimum distance: passenger origin must be ≤3 km from the route, AND passenger destination ≤3 km from the route'),
  bullet('Fallback: if no polyline, direct point-to-point Haversine distance is used'),
  h4('Step 6 – Radius Expansion'),
  bullet('If no matches found at 3 km, the algorithm automatically retries at 5 km (expandedRadius flag returned to UI)'),
  h4('Step 7 – Sorting'),
  bullet('Results sorted by total_dist_km (origin dist + dest dist) ascending – closest matches first'),
  spacer(),
  h2('10.2 Reverse Matching Algorithm'),
  para('Pool Hosts can browse passenger listings that match their route (GET /api/passenger-listings/match/:driverId):'),
  bullet('Takes the host\'s most recent Scheduled ride route polyline'),
  bullet('Scans all Active passenger listings'),
  bullet('Applies the same polyline proximity check: ≤5 km for both origin and destination'),
  bullet('Filters by current day of week against recurring_days'),
  bullet('Returns sorted results by total_dist_km'),
  spacer(),
  h2('10.3 Cancellation Policy'),
  makeTable(
    ['Scenario', 'Timing Rule', 'Consequence'],
    [
      ['Pool Host cancels ride', 'Blocked within 15 min of departure', 'All pending/accepted requests auto-rejected; notifications with alternative rides sent to passengers'],
      ['Passenger cancels request', 'Blocked within 15 min of departure', 'If Accepted, seat returned to driver; driver notified'],
    ],
    [30, 35, 35]
  ),
  spacer(),
  h2('10.4 Ride Start Window'),
  para('The "Start Ride" and "Notify Passengers" actions are gated by a strict ±10 minute window from the scheduled departure time. Attempting to start outside this window returns HTTP 400.'),
  spacer(),
  h2('10.5 Multi-Stop Route Optimization'),
  para('When a passenger request is accepted or rejected, the system automatically recalculates the optimal route:'),
  bullet('Fetches all accepted passengers with pickup coordinates'),
  bullet('Constructs a waypoint string: driver_origin → passenger_stop_1 → ... → destination'),
  bullet('Calls OSRM with all waypoints to get an optimised multi-stop polyline'),
  bullet('Updates the ride\'s route_polyline and expected_duration_mins'),
  bullet('Emits route_updated WebSocket event to the driver'),
  spacer(),
  h2('10.6 ETA Monitoring (Background Process)'),
  para('A setInterval timer runs every 60 seconds on the server to monitor active rides:'),
  bullet('Step 1 (elapsed > expected + 30 min): Emits eta_alert WebSocket event to driver reminding them to complete the ride; sets delay_reminder_sent = 1'),
  bullet('Step 2 (elapsed > expected + 35 min): Auto-creates an incident with 15-min SLA; notifies admin room and sends push to all admins; sets delay_reminder_sent = 2'),
  spacer(2),
  new Paragraph({ children: [], pageBreakBefore: true }),
];

const realTimeFeatures = [
  h1('11. Real-Time Features (WebSocket)'),
  h2('11.1 Socket.IO Architecture'),
  para('The server uses Socket.IO rooms to target notifications:'),
  bullet('user_{id} – Each user joins their personal room on login; used for direct messages'),
  bullet('admin_room – All Admin users join this room; used for SOS alerts broadcast'),
  spacer(),
  h2('11.2 WebSocket Events'),
  makeTable(
    ['Event Name', 'Direction', 'Trigger', 'Recipient'],
    [
      ['ride_requested', 'Server → Client', 'Passenger submits request', 'Pool Host (driver)'],
      ['ride_accepted', 'Server → Client', 'Request/offer accepted', 'Other party'],
      ['ride_rejected', 'Server → Client', 'Request/offer rejected', 'Other party'],
      ['ride_offered', 'Server → Client', 'Host offers to passenger', 'Passenger'],
      ['ride_started', 'Server → Client', 'Host starts the ride', 'All accepted passengers'],
      ['ride_completed', 'Server → Client', 'Ride completed for today', 'Driver + all passengers'],
      ['host_arriving', 'Server → Client', 'Host sends departure notification', 'All accepted passengers'],
      ['location_update', 'Server → Client', 'Host broadcasts GPS', 'All accepted passengers (with ETA)'],
      ['eta_update', 'Server → Client', 'OSRM ETA computed', 'Driver'],
      ['eta_alert', 'Server → Client', 'Ride exceeds ETA by 30+ min', 'Driver'],
      ['route_updated', 'Server → Client', 'Multi-stop route recalculated', 'Driver'],
      ['sos_alert', 'Server → Client', 'SOS incident created', 'admin_room'],
    ],
    [22, 15, 33, 30]
  ),
  spacer(),
  h2('11.3 Live Location Tracking Flow'),
  para('The GPS tracking pipeline works as follows:'),
  bullet('1. Driver starts ride → navigator.geolocation.watchPosition activated in PoolHostDashboard'),
  bullet('2. Every position update → POST /api/rides/:id/location { lat, lng }'),
  bullet('3. Server fetches all accepted passengers for this ride'),
  bullet('4. OSRM ETA computed for driver (to destination) and each passenger (to their individual dropoff)'),
  bullet('5. Socket.IO emits location_update to each passenger\'s room with { ride_id, lat, lng, eta_mins }'),
  bullet('6. Passenger client catches the live_location custom event and updates the map marker'),
  bullet('7. OSRM is throttled to one call per minute per ride (last_osrm_check cache) to prevent API overload'),
  spacer(2),
  new Paragraph({ children: [], pageBreakBefore: true }),
];

const safetySection = [
  h1('12. Safety & Incident Management'),
  h2('12.1 SOS System'),
  para('Any authenticated user can trigger an SOS alert:'),
  bullet('Accessible from a red emergency button in the navigation header'),
  bullet('A modal appears with an incident type selector (Safety Concern, Vehicle Breakdown, Medical Emergency, Other)'),
  bullet('On submission: POST /api/incidents/create'),
  bullet('Server creates an incident with 15-minute SLA deadline'),
  bullet('Real-time admin alert via Socket.IO: sos_alert event to admin_room'),
  bullet('Web Push notification sent to all Admin users'),
  bullet('Admin receives an in-app toast notification immediately'),
  spacer(),
  h2('12.2 Auto-Escalation Triggers'),
  makeTable(
    ['Trigger Condition', 'Action Taken', 'SLA'],
    [
      ['User accumulates 3 penalty points from No-Shows', 'Account suspended for 15 days; notification sent to user', 'Immediate'],
      ['Ride exceeds expected duration by > 30 minutes', 'Driver receives eta_alert reminder via WebSocket', 'N/A'],
      ['Ride exceeds expected duration by > 35 minutes', 'Auto-incident created, admin notified via SOS alert', '15 minutes'],
      ['Rating submitted with harassment/unsafe driving/rash driving tags', 'Auto-incident created with 24-hour SLA', '24 hours'],
    ],
    [40, 40, 20]
  ),
  spacer(),
  h2('12.3 Incident Lifecycle'),
  bullet('Open – Newly created incident (SOS or auto-escalated)'),
  bullet('Resolved – Admin investigated and closed the incident'),
  bullet('Escalated – Admin escalated to ERT (Emergency Response Team)'),
  para('The Admin dashboard displays Open incidents prominently with red visual indicators and the count badge.'),
  spacer(),
  h2('12.4 No-Show & Penalty System'),
  para('The No-Show system ensures reliability and discourages ghost bookings:'),
  bullet('After an accepted ride, either party (Host or Passenger) can report the other as a No-Show'),
  bullet('Each report adds 1 penalty point to the offender\'s account'),
  bullet('At 3 penalty points: account is automatically suspended for 15 days with a notification'),
  bullet('Admins can reset penalty points at any time'),
  bullet('If suspended_until has passed at login time, the suspension is automatically lifted'),
  spacer(2),
  new Paragraph({ children: [], pageBreakBefore: true }),
];

const aiSection = [
  h1('13. AI Integration (NVIDIA NIM + Gemini Fallback)'),
  h2('13.1 Overview'),
  para('The platform integrates NVIDIA NIM as its primary AI agent, branded as "Commute Copilot". NVIDIA NIM (Inference Microservices) provides access to state-of-the-art LLMs via an OpenAI-compatible REST API (https://integrate.api.nvidia.com/v1). The active model is meta/llama-3.3-70b-instruct — Meta\'s most capable instruction-tuned LLM with robust function/tool calling.'),
  para('Google Gemini 2.5 Flash Lite is retained as a legacy fallback provider, switchable via a single environment variable. All AI logic is server-side; the client (AIChat.jsx) is provider-agnostic.'),
  spacer(),
  h2('13.2 Dual-Provider Architecture'),
  makeTable(
    ['Attribute', 'NVIDIA NIM (Primary)', 'Google Gemini (Fallback)'],
    [
      ['Model', 'meta/llama-3.3-70b-instruct', 'gemini-2.5-flash-lite'],
      ['SDK', 'openai npm package (OpenAI-compatible)', '@google/generative-ai SDK'],
      ['Base URL', 'https://integrate.api.nvidia.com/v1', 'generativelanguage.googleapis.com'],
      ['Tool Calling Format', 'OpenAI tools[] / tool_calls', 'Gemini functionDeclarations / functionCalls()'],
      ['Activation', 'AI_PROVIDER=nvidia (default)', 'AI_PROVIDER=gemini'],
      ['API Key Env Var', 'NVIDIA_API_KEY (nvapi-...)', 'GEMINI_API_KEY'],
      ['Auto-fallback', 'Yes — if NVIDIA key missing, falls back to Gemini', 'N/A'],
    ],
    [28, 36, 36]
  ),
  spacer(),
  h2('13.3 System Prompt & Context Injection'),
  para('Both providers share the same system prompt and context injection mechanism:'),
  bullet('System Identity: "You are Commute Copilot, the AI assistant for Reliance Commuter Connect — a corporate carpooling platform for Reliance Industries employees."'),
  bullet('Tool directive: "Use the draft_booking tool when a user wants to find or book a ride. Use the draft_listing tool when a driver wants to offer a ride. Never invent ride details."'),
  bullet('An optional knowledge base file (carpool_requirements.md) is appended to the system prompt if it exists on the server'),
  bullet('Each user query is prefixed with a [System Note] containing the user\'s role and live KPI stats, enabling personalised and context-aware responses'),
  spacer(),
  h2('13.4 Tool Calling (Function Calling)'),
  para('The AI is configured with two tools defined in OpenAI function-calling format (CARPOOL_TOOLS). These are auto-translated to Gemini format when Gemini is the active provider:'),
  makeTable(
    ['Tool Function', 'Parameters', 'Triggered When'],
    [
      ['draft_booking', 'origin (string), destination (string), time (HH:MM string)', 'User expresses intent to find, search, or book a ride as a Passenger'],
      ['draft_listing', 'origin, destination, time, seats (int), price (int INR)', 'Pool Host expresses intent to offer a ride or add a commute'],
    ],
    [22, 42, 36]
  ),
  para('When a tool is called: the server returns { type: "action", action, params, text }. The client (AIChat.jsx) renders an interactive Action Card showing the draft details with a "Confirm & Send" button that pre-fills the booking or listing form.'),
  spacer(),
  h2('13.5 Chat Request Flow'),
  bullet('1. User types a message in the Commute Copilot floating panel (✨ bottom-left)'),
  bullet('2. AIChat.jsx sends: POST /api/chat { message, context: { userRole, stats }, history: [...] }'),
  bullet('3. Server detects active provider (activeAI: "nvidia" | "gemini")'),
  bullet('4. NVIDIA path: history is converted from Gemini format (role: "model") to OpenAI format (role: "assistant")'),
  bullet('5. Messages array built: [system prompt, ...history, user message with injected context]'),
  bullet('6. openai.chat.completions.create() called with model, messages, tools, tool_choice: "auto"'),
  bullet('7. If choice.message.tool_calls present → return { type: "action", action, params }'),
  bullet('8. Otherwise → return { type: "text", text: choice.message.content }'),
  bullet('9. Client renders text bubble or Action Card accordingly'),
  spacer(),
  h2('13.6 Validated Test Results (Production Key)'),
  para('The NVIDIA NIM integration was validated with the following live test results after key configuration:'),
  makeTable(
    ['Test Case', 'Result', 'Detail'],
    [
      ['Plain text — Policy Q&A', 'PASSED', 'Answered ride cancellation policy correctly; 43 completion tokens used'],
      ['Tool calling — draft_booking', 'PASSED', 'Triggered draft_booking with origin: Kharghar, destination: RCP Twin Towers, time: 09:00'],
      ['Context injection — User stats', 'PASSED', 'Returned: "You\'ve taken 14 rides and saved 44.1 kg of CO2" from injected live stats'],
    ],
    [35, 15, 50]
  ),
  spacer(),
  h2('13.7 Error Handling'),
  bullet('HTTP 401 (Invalid key): Returns user-friendly message — "Invalid NVIDIA API key. Please check NVIDIA_API_KEY in server/.env"'),
  bullet('HTTP 429 (Rate limit): Returns — "NVIDIA API rate limit reached. Please wait a moment and try again."'),
  bullet('Key not configured: Returns — "NVIDIA API key not configured. Add NVIDIA_API_KEY to server/.env (get key at https://build.nvidia.com)"'),
  bullet('All errors are caught and returned as readable JSON — the UI displays these as assistant messages, never crashing the chat'),
  spacer(),
  h2('13.8 Frontend Branding (AIChat.jsx)'),
  bullet('Assistant name: "Commute Copilot" (previously "Reliance Copilot")'),
  bullet('Header displays an "NVIDIA" badge pill alongside the copilot name'),
  bullet('Floating action button: ✨ fixed at bottom-left'),
  bullet('Greeting message: "Hi! I\'m Commute Copilot ✨ — powered by NVIDIA NIM. I can help you find a ride or book one, answer carpool policy questions, or look up your personal stats."'),
  spacer(2),
  new Paragraph({ children: [], pageBreakBefore: true }),
];

const esgSection = [
  h1('14. ESG Impact Tracking'),
  h2('14.1 ESG Metrics Calculation'),
  para('The platform tracks environmental impact using the following formulas:'),
  makeTable(
    ['Metric', 'Formula', 'Assumption'],
    [
      ['CO₂ Saved per ride', '15 km avg trip × 0.21 kg CO₂/km = 3.15 kg CO₂', 'ARAI emission factor for petrol cars'],
      ['Fuel Saved', 'Total km saved ÷ 15 km/litre', 'ARAI average fuel efficiency'],
      ['Employee ₹ Saved', 'Sum of price_per_seat for completed accepted rides', 'Actual cost-sharing data from rides'],
      ['Trees Equivalent', 'CO₂ avoided ÷ 21.6 kg CO₂/tree/year', 'Standard forestry CO₂ absorption estimate'],
    ],
    [25, 40, 35]
  ),
  spacer(),
  h2('14.2 User-Level Stats'),
  para('Individual KPIs shown on dashboards:'),
  bullet('Passenger CO₂ Saved: rides_taken × 15 km × 0.21 kg CO₂/km'),
  bullet('Pool Host CO₂ Saved: people_carpooled × 15 km × 0.21 kg CO₂/km'),
  spacer(),
  h2('14.3 Platform-Level Dashboard'),
  para('The Admin ESG Dashboard shows aggregated 6-month data with Business Unit breakdown:'),
  bullet('Jio Platforms, Reliance Retail, RIL (O2C), Reliance Foundation (currently seeded with representative data)'),
  bullet('Area chart for CO₂ trend and bar chart for BU fuel savings'),
  spacer(2),
  new Paragraph({ children: [], pageBreakBefore: true }),
];

const notificationSection = [
  h1('15. Notification System'),
  h2('15.1 In-App Notifications'),
  para('The notifications table stores persistent, actionable notifications for users. The system uses:'),
  bullet('Polling via fetchStatsAndRequests() on mount and after key events'),
  bullet('Displayed in the notification bell dropdown in AppLayout'),
  bullet('Inline action cards for RideCancelled_Alternatives notifications (allows requesting an alternative ride directly from the notification)'),
  spacer(),
  h2('15.2 Real-Time Toast Notifications'),
  para('The App.jsx global toast system displays ephemeral messages:'),
  bullet('4-second auto-dismiss'),
  bullet('Types: success (green), danger (red), warning (orange), info (blue)'),
  bullet('Triggered by WebSocket events: ride_requested, ride_accepted, ride_rejected, sos_alert'),
  spacer(),
  h2('15.3 Web Push Notifications'),
  para('Web Push (VAPID) notifications are delivered even when the app is closed:'),
  bullet('Requires service worker (public/sw.js) to be registered in the browser'),
  bullet('User enables push via Settings → toggle (subscribeToPush / unsubscribeFromPush)'),
  bullet('VAPID public/private keys and email configured in server/.env'),
  bullet('Notifications sent for: ride accepted, ride offered, ride declined, SOS alerts to admins'),
  bullet('Stale subscriptions (410/404 responses) are automatically removed from the database'),
  spacer(2),
  new Paragraph({ children: [], pageBreakBefore: true }),
];

const penaltySection = [
  h1('16. Penalty & Trust System'),
  h2('16.1 Penalty Point Mechanics'),
  makeTable(
    ['Action', 'Points Added', 'Automatic Consequence'],
    [
      ['Host reports Passenger No-Show', '+1 to Passenger', 'At 3 pts: 15-day suspension + notification'],
      ['Passenger reports Host No-Show', '+1 to Host', 'At 3 pts: 15-day suspension + notification'],
      ['Safety rating tag submitted (harassment etc.)', '0 (indirect)', 'Auto-incident created with 24h SLA'],
      ['Admin resets penalty', 'Reset to 0', 'Forgiveness notification sent to user'],
    ],
    [40, 20, 40]
  ),
  spacer(),
  h2('16.2 Suspension Flow'),
  bullet('When penalty_points reaches 3, status is set to "Suspended" and suspended_until = now + 15 days'),
  bullet('A notification is sent to the user explaining the suspension'),
  bullet('On next login attempt: server checks if suspended_until has passed and auto-lifts if so'),
  bullet('Admin can manually lift suspension via User Management (toggle-status endpoint)'),
  spacer(),
  h2('16.3 Trust Indicators'),
  bullet('has_vehicle_pass: Admin-verified Pool Hosts display a verification badge; passengers can filter for these hosts'),
  bullet('Star rating: Average rating and total count displayed on host profiles (via GET /api/users/:id/rating)'),
  spacer(2),
  new Paragraph({ children: [], pageBreakBefore: true }),
];

const uiSection = [
  h1('17. UI/UX Design System'),
  h2('17.1 Design Philosophy'),
  para('The UI follows a dark-mode glassmorphism aesthetic with a premium, modern feel. It uses a custom TailwindCSS v4 design token system defined in tailwind.config.js.'),
  spacer(),
  h2('17.2 Color System'),
  makeTable(
    ['Token', 'Hex', 'Usage'],
    [
      ['surface-base', '#13172A', 'Main background'],
      ['surface-deep', '#0D1020', 'Sidebar and dark areas'],
      ['surface-container', '#1C2030', 'Card and panel backgrounds'],
      ['surface-bright', '#2A2F45', 'Hover states and interactive elements'],
      ['on-surface', '#E5EAF2', 'Primary text'],
      ['on-surface-variant', '#87948D', 'Secondary / muted text'],
      ['primary', '#029676', 'Reliance teal – buttons, active states, links'],
      ['secondary', '#5B7FA6', 'Accent blue'],
      ['tertiary', '#8CDA6D', 'Pool Host green'],
      ['accent-green', '#549E39', 'ESG indicators'],
      ['accent-blue', '#4AB5C4', 'Informational accents'],
      ['error-red', '#E53935', 'SOS, errors, danger states'],
      ['warning-orange', '#F57C00', 'Pending, warnings'],
    ],
    [25, 20, 55]
  ),
  spacer(),
  h2('17.3 Typography'),
  makeTable(
    ['Scale', 'Font Size', 'Font Weight', 'Usage'],
    [
      ['headline-xl', '32px', 'Bold', 'Dashboard KPI values'],
      ['headline-md', '24px', 'Bold', 'Card titles, section headers'],
      ['label-lg', '16px', 'SemiBold', 'Navigation labels, button text'],
      ['label-md', '14px', 'SemiBold', 'Tags, badges, small buttons'],
      ['body-lg', '18px', 'Regular', 'Paragraphs, descriptions'],
      ['body-md', '16px', 'Regular', 'Default body text'],
      ['body-sm', '14px', 'Regular', 'Captions, secondary info'],
    ],
    [20, 20, 20, 40]
  ),
  spacer(),
  h2('17.4 Key UI Patterns'),
  bullet('glass-panel: frosted glass card with backdrop-blur, bg-glass-fill (rgba white/5), and border white/10'),
  bullet('glass-input: Input fields styled with glass aesthetic and focus:border-primary glow'),
  bullet('btn-primary: Teal gradient button with hover glow effect'),
  bullet('animate-slide-in: CSS keyframe animation for modals and panels sliding in'),
  bullet('SwipeToComplete: Custom touch/mouse swipe gesture component for ride completion'),
  bullet('Material Symbols Outlined: Google Material Icons font used throughout'),
  bullet('Responsive: Desktop sidebar (lg: breakpoint), mobile bottom navigation bar'),
  spacer(2),
  new Paragraph({ children: [], pageBreakBefore: true }),
];

const deploymentSection = [
  h1('18. Deployment Configuration'),
  h2('18.1 Environment Variables (server/.env)'),
  makeTable(
    ['Variable', 'Required', 'Description'],
    [
      ['JWT_SECRET', 'Yes', 'Secret key for JWT signing (min 32 chars recommended)'],
      ['NVIDIA_API_KEY', 'Required for AI', 'NVIDIA NIM API key (format: nvapi-...). Get at https://build.nvidia.com'],
      ['NVIDIA_MODEL', 'Optional', 'LLM model to use (default: meta/llama-3.3-70b-instruct). Alternatives: nvidia/llama-3.1-nemotron-70b-instruct, mistralai/mistral-large-2-instruct'],
      ['AI_PROVIDER', 'Optional', '"nvidia" (default) or "gemini" — switches active AI provider without code changes'],
      ['GEMINI_API_KEY', 'Optional', 'Google AI Studio key — only needed if AI_PROVIDER=gemini or as fallback'],
      ['VAPID_PUBLIC_KEY', 'Optional', 'VAPID public key for Web Push notifications'],
      ['VAPID_PRIVATE_KEY', 'Optional', 'VAPID private key for Web Push notifications'],
      ['VAPID_EMAIL', 'Optional', 'Admin email for VAPID (e.g., mailto:admin@reliance.com)'],
    ],
    [25, 15, 60]
  ),
  para('Note: The server will refuse to start (process.exit(1)) if JWT_SECRET is not set. If NVIDIA_API_KEY is missing but GEMINI_API_KEY is set, the system automatically falls back to Gemini.', true),
  spacer(),
  h2('18.2 Running the Application'),
  h4('Frontend (Development)'),
  codeBlock('cd C:\\LLM\\carpool'),
  codeBlock('npm install'),
  codeBlock('npm run dev    # Starts Vite dev server on port 5173'),
  h4('Backend'),
  codeBlock('cd C:\\LLM\\carpool\\server'),
  codeBlock('npm install'),
  codeBlock('node server.js    # Starts Express + Socket.IO on port 3001'),
  h4('Production Build'),
  codeBlock('npm run build    # Vite builds to ./dist/'),
  para('In production, the dist/ folder should be served via nginx or Express static middleware, with all /api/* requests proxied to port 3001.'),
  spacer(),
  h2('18.3 Vite Proxy Configuration'),
  para('The vite.config.js includes a proxy to forward /api/* requests from the Vite dev server to the Express backend, enabling seamless development without CORS issues.'),
  spacer(),
  h2('18.4 Tunnel / Remote Access'),
  para('The project includes localtunnel and SSH tunnel configuration files (localtunnel.log, ssh_tunnel.txt) suggesting the platform has been accessed remotely during development/testing.'),
  spacer(2),
  new Paragraph({ children: [], pageBreakBefore: true }),
];

const roadmapSection = [
  h1('19. Known Limitations & Future Roadmap'),
  h2('19.1 Current Limitations'),
  makeTable(
    ['Area', 'Limitation'],
    [
      ['Database', 'SQLite is not suitable for concurrent write-heavy production loads; PostgreSQL or MySQL recommended for scale'],
      ['Email Service', 'Password reset tokens are logged to server console only; no actual email delivery implemented'],
      ['File Storage', 'Avatars stored on local server filesystem; not suitable for multi-server deployments (use S3/GCS)'],
      ['ESG Data', 'Aggregated ESG dashboard data is partially seeded/estimated; real-time aggregation from completed trips needed'],
      ['Authentication', 'No OAuth/SSO integration; separate credential management from existing Reliance IT systems'],
      ['Mobile App', 'Web-only; no native iOS/Android app with GPS background tracking'],
      ['Payment', 'Payment preference stored but no actual payment gateway integration'],
      ['Admin Email', 'No automated email alerts for SOS events; relies on real-time browser session'],
      ['Data Retention', 'No archival policy or data purge mechanism implemented'],
    ],
    [25, 75]
  ),
  spacer(),
  h2('19.2 Suggested Future Enhancements'),
  bullet('OAuth / SAML SSO integration with Reliance Active Directory'),
  bullet('Native mobile apps (React Native or Flutter) with background GPS tracking'),
  bullet('In-app payment gateway (UPI, corporate wallet deduction)'),
  bullet('Email notification delivery (SendGrid/SES) for SOS, ride events, and reset tokens'),
  bullet('Advanced ESG analytics with real-time aggregation pipeline'),
  bullet('Automated ARAI-certified carbon credit generation from CO₂ data'),
  bullet('Driver route optimisation with traffic-aware ETA (Google Maps Platform or HERE)'),
  bullet('In-app schedule calendar integration (Google Calendar, Outlook)'),
  bullet('AI-based demand forecasting for popular routes'),
  bullet('PostgreSQL migration for production scalability'),
  bullet('Redis for caching and session management at scale'),
  bullet('Kubernetes deployment with horizontal scaling'),
  spacer(2),
  new Paragraph({ children: [], pageBreakBefore: true }),
];

const glossary = [
  h1('20. Glossary'),
  makeTable(
    ['Term', 'Definition'],
    [
      ['RCP', 'Reliance Corporate Park – Main Reliance campus in Ghansoli, Navi Mumbai'],
      ['Pool Host', 'An employee who owns a vehicle and offers rides to colleagues (the driver)'],
      ['Passenger', 'An employee who books and rides in a Pool Host\'s vehicle'],
      ['Ride Request', 'A Passenger\'s application to join a Pool Host\'s listed ride'],
      ['Host Offer', 'A Pool Host proactively offering a seat to a Passenger who posted a commute need (Reverse Matching)'],
      ['Reverse Matching', 'The workflow where Passengers post their commute needs and Hosts discover and offer to them'],
      ['Vehicle Pass', 'Admin-verified vehicle registration indicating the host meets Reliance vehicle entry requirements'],
      ['Women-Only', 'A ride option where only female drivers can list and only female passengers can book'],
      ['Trip Log', 'A daily execution record for a recurring ride (one per day per ride)'],
      ['SOS', 'Safety One-Stop – Emergency trigger that alerts admins in real-time with 15-min SLA'],
      ['SLA', 'Service Level Agreement – Target response time for incidents'],
      ['ERT', 'Emergency Response Team – Reliance\'s on-ground safety team for escalated incidents'],
      ['ESG', 'Environmental, Social, Governance – Sustainability and corporate responsibility metrics'],
      ['OSRM', 'Open Source Routing Machine – Free routing engine used for driving directions and ETA'],
      ['Photon', 'Open geocoding API by Komoot used for location search suggestions'],
      ['VAPID', 'Voluntary Application Server Identification – Standard for authenticating Web Push notifications'],
      ['JWT', 'JSON Web Token – Stateless authentication token issued on login'],
      ['Haversine', 'Formula to calculate great-circle distance between two GPS coordinates'],
      ['No-Show', 'When a confirmed ride participant fails to appear at the arranged time'],
      ['Penalty Points', 'Accumulated demerits from No-Show reports; 3 points triggers automatic 15-day suspension'],
    ],
    [25, 75]
  ),
  spacer(2),
];

// ─── Assemble Document ────────────────────────────────────────────────────────

const doc = new Document({
  numbering: {
    config: [{
      reference: 'bullet-list',
      levels: [{
        level: 0,
        format: NumberFormat.BULLET,
        text: '\u2022',
        alignment: AlignmentType.LEFT,
      }],
    }],
  },
  styles: {
    default: {
      document: {
        run: { font: 'Helvetica Neue', size: 22, color: C.text },
      },
    },
    paragraphStyles: [
      {
        id: 'Heading1',
        name: 'Heading 1',
        run: { font: 'Helvetica Neue Bold', size: 36, bold: true, color: C.reliance },
      },
      {
        id: 'Heading2',
        name: 'Heading 2',
        run: { font: 'Helvetica Neue Bold', size: 28, bold: true, color: C.accent },
      },
      {
        id: 'Heading3',
        name: 'Heading 3',
        run: { font: 'Helvetica Neue Bold', size: 24, bold: true, color: C.teal },
      },
    ],
  },
  sections: [
    {
      properties: {
        page: {
          margin: { top: 1440, bottom: 1440, left: 1260, right: 1260 },
        },
      },
      headers: {
        default: new Header({
          children: [
            new Paragraph({
              children: [
                new TextRun({ text: 'Reliance Industries Limited – Commuter Connect Platform Documentation', size: 18, color: C.muted }),
                new TextRun({ text: '\t', size: 18 }),
                new TextRun({ text: 'Internal Confidential', size: 18, color: C.red, bold: true }),
              ],
              border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: C.reliance } },
            }),
          ],
        }),
      },
      footers: {
        default: new Footer({
          children: [
            new Paragraph({
              children: [
                new TextRun({ text: '© 2026 Reliance Industries Limited. All rights reserved.   Page ', size: 18, color: C.muted }),
                new TextRun({ children: [PageNumber.CURRENT], size: 18, color: C.muted }),
                new TextRun({ text: ' of ', size: 18, color: C.muted }),
                new TextRun({ children: [PageNumber.TOTAL_PAGES], size: 18, color: C.muted }),
              ],
              border: { top: { style: BorderStyle.SINGLE, size: 4, color: C.reliance } },
            }),
          ],
        }),
      },
      children: [
        ...coverPage,
        ...tocSection,
        ...executiveSummary,
        ...projectOverview,
        ...techStack,
        ...architecture,
        ...database,
        ...rolesAndPermissions,
        ...authSecurity,
        ...frontendComponents,
        ...apiReference,
        ...businessLogic,
        ...realTimeFeatures,
        ...safetySection,
        ...aiSection,
        ...esgSection,
        ...notificationSection,
        ...penaltySection,
        ...uiSection,
        ...deploymentSection,
        ...roadmapSection,
        ...glossary,
      ],
    },
  ],
});

Packer.toBuffer(doc).then((buffer) => {
  const outputPath = 'Reliance_Carpool_Full_Documentation.docx';
  fs.writeFileSync(outputPath, buffer);
  console.log(`✅ Document generated: ${outputPath}`);
  console.log(`   Size: ${(buffer.length / 1024).toFixed(1)} KB`);
}).catch((err) => {
  console.error('❌ Error generating document:', err);
  process.exit(1);
});
