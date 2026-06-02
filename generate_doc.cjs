const {
  Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell,
  WidthType, AlignmentType, BorderStyle, ShadingType, PageNumber, Header, Footer,
  NumberFormat, convertInchesToTwip, TableOfContents, StyleLevel
} = require('docx');
const fs = require('fs');
const path = require('path');

// ─── Color Palette ───────────────────────────────────────────────────────────
const C = {
  reliance: '0D47A1',  // Reliance deep blue
  accent:   '1565C0',  // Accent blue
  teal:     '00695C',  // Teal for security
  green:    '2E7D32',  // Success green
  orange:   'E65100',  // Warning orange
  red:      'B71C1C',  // Danger red
  white:    'FFFFFF',
  lightBlue:'DBEAFE',  // Light header fill
  lightGray:'F8FAFC',  // Alternating row fill
  text:     '1E293B',  // Dark body text
  muted:    '64748B',  // Muted text
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function heading1(text) {
  return new Paragraph({
    text,
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 400, after: 200 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: C.reliance } }
  });
}

function heading2(text) {
  return new Paragraph({
    text,
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 320, after: 160 },
  });
}

function heading3(text) {
  return new Paragraph({
    text,
    heading: HeadingLevel.HEADING_3,
    spacing: { before: 240, after: 100 },
  });
}

function para(runs) {
  if (typeof runs === 'string') {
    return new Paragraph({ children: [new TextRun({ text: runs, size: 22, color: C.text })], spacing: { after: 140 } });
  }
  return new Paragraph({ children: runs, spacing: { after: 140 } });
}

function bold(text, color = C.text) {
  return new TextRun({ text, bold: true, size: 22, color });
}

function normal(text, color = C.text) {
  return new TextRun({ text, size: 22, color });
}

function bullet(text, level = 0) {
  return new Paragraph({
    children: [new TextRun({ text, size: 22, color: C.text })],
    bullet: { level },
    spacing: { after: 80 },
  });
}

function spacer(lines = 1) {
  return new Paragraph({ text: '', spacing: { after: lines * 120 } });
}

// ─── Table Builder ────────────────────────────────────────────────────────────

function makeTable(headers, rows, colWidths) {
  const totalWidth = 9000; // total twips for table
  const defaultColWidth = Math.floor(totalWidth / headers.length);

  const headerRow = new TableRow({
    tableHeader: true,
    children: headers.map((h, i) =>
      new TableCell({
        shading: { type: ShadingType.SOLID, color: C.reliance },
        width: { size: colWidths ? colWidths[i] : defaultColWidth, type: WidthType.DXA },
        margins: { top: 80, bottom: 80, left: 100, right: 100 },
        children: [new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [new TextRun({ text: h, bold: true, color: C.white, size: 20 })]
        })]
      })
    )
  });

  const dataRows = rows.map((row, rowIdx) =>
    new TableRow({
      children: row.map((cell, i) =>
        new TableCell({
          shading: { type: ShadingType.SOLID, color: rowIdx % 2 === 0 ? C.white : C.lightGray },
          width: { size: colWidths ? colWidths[i] : defaultColWidth, type: WidthType.DXA },
          margins: { top: 60, bottom: 60, left: 100, right: 100 },
          children: [new Paragraph({
            children: [new TextRun({ text: String(cell ?? ''), size: 20, color: C.text })]
          })]
        })
      )
    })
  );

  return new Table({
    rows: [headerRow, ...dataRows],
    width: { size: 100, type: WidthType.PERCENTAGE },
  });
}

// ─── Cover Page ───────────────────────────────────────────────────────────────

function coverPage() {
  return [
    spacer(4),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: '🚗', size: 80 })],
      spacing: { after: 200 }
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: 'RELIANCE CARPOOL PLATFORM', bold: true, size: 56, color: C.reliance })],
      spacing: { after: 160 }
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: 'Product Requirements & Feature Documentation', size: 32, color: C.muted, italics: true })],
      spacing: { after: 80 }
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: 'Version 1.0  ·  Reliance Industries Limited', size: 24, color: C.muted })],
      spacing: { after: 80 }
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: `Date: ${new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })}`, size: 24, color: C.muted })],
      spacing: { after: 400 }
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      border: { top: { style: BorderStyle.SINGLE, size: 6, color: C.reliance }, bottom: { style: BorderStyle.SINGLE, size: 6, color: C.reliance } },
      children: [new TextRun({ text: 'CONFIDENTIAL — FOR INTERNAL USE ONLY', bold: true, size: 22, color: C.reliance })],
      spacing: { before: 200, after: 200 }
    }),
  ];
}

// ─── Build Document ───────────────────────────────────────────────────────────

async function buildDoc() {
  const sections = [];

  // ── 1. EXECUTIVE SUMMARY ────────────────────────────────────────────────────
  sections.push(
    heading1('1. Executive Summary'),
    para([bold('Reliance Carpool Platform'), normal(' is an internal, enterprise-grade carpooling solution developed exclusively for employees of Reliance Industries Limited and its subsidiaries — including Jio Platforms, Reliance Retail, and RIL Oil-to-Chemicals (O2C). The platform aims to reduce the commuting cost burden on employees, alleviate vehicular congestion around Reliance campuses, and contribute measurably to the organisation\'s Environmental, Social, and Governance (ESG) commitments by reducing carbon emissions.')]),
    para('The system is a full-stack web application built on a React (Vite) frontend with a Node.js/Express backend and an SQLite database. It supports three distinct roles — Passenger, Pool Host, and Admin — with real-time WebSocket-based notifications and a comprehensive Admin control panel.'),
    heading2('Key Highlights'),
    bullet('Role-based access control with three tiers: Passenger, Pool Host, and Admin.'),
    bullet('Live, map-assisted ride discovery using geospatial matching (Haversine algorithm, ≤3 km tolerance).'),
    bullet('Real-time push notifications via Socket.io for ride events and SOS alerts.'),
    bullet('AI-powered chatbot (Gemini 2.5 Flash) for in-app assistance and ride booking.'),
    bullet('Women-Only Rides filter for enhanced commuter safety.'),
    bullet('SOS/Incident reporting system with 15-minute SLA and immediate Admin alerts.'),
    bullet('ESG Impact Dashboard tracking CO₂ avoided, fuel saved, and employee cost savings.'),
    bullet('Secure JWT-based authentication with sliding session management and bcrypt password hashing.'),
    bullet('Enterprise-grade API security: rate limiting, CORS whitelisting, input validation, and IDOR prevention.'),
    spacer()
  );

  // ── 2. INTENT & BUSINESS OBJECTIVE ─────────────────────────────────────────
  sections.push(
    heading1('2. Intent & Business Objective'),
    heading2('2.1 Problem Statement'),
    para('A significant portion of Reliance employees commute daily across long distances using personal vehicles. This leads to:'),
    bullet('High individual commuting costs, particularly with rising fuel prices.'),
    bullet('Traffic congestion around Reliance campuses and facilities.'),
    bullet('Increased per-capita carbon footprint, adversely affecting ESG goals.'),
    bullet('Absence of a verified, trusted carpooling platform among colleagues.'),
    heading2('2.2 Solution'),
    para('The Reliance Carpool Platform provides a closed, internally-governed carpooling network where:'),
    bullet('Employees can offer or request rides along verified daily commute routes.'),
    bullet('Pool Hosts (drivers) can monetise their commute by sharing fuel costs.'),
    bullet('Passengers save money by splitting travel costs.'),
    bullet('Admins can monitor the entire platform, resolve disputes, and track ESG impact in real time.'),
    heading2('2.3 Strategic Alignment'),
    para('This platform directly supports Reliance\'s stated ESG targets under the New Energy and Green Initiatives umbrella, contributing to Scope 3 emission reductions from employee commuting — a category reportable to frameworks such as GRI and CDP.'),
    spacer()
  );

  // ── 3. SYSTEM ARCHITECTURE ──────────────────────────────────────────────────
  sections.push(
    heading1('3. System Architecture'),
    heading2('3.1 Technology Stack'),
    makeTable(
      ['Layer', 'Technology', 'Purpose'],
      [
        ['Frontend', 'React 19 + Vite 8', 'SPA with component-based UI'],
        ['Styling', 'Tailwind CSS 4', 'Utility-first responsive design'],
        ['Mapping', 'Leaflet + react-leaflet', 'Interactive map & geolocation'],
        ['Charts', 'Recharts', 'ESG trend visualisations'],
        ['Backend', 'Node.js + Express 5', 'REST API server'],
        ['Real-Time', 'Socket.io', 'WebSocket push notifications'],
        ['Database', 'SQLite 3', 'Lightweight embedded relational DB'],
        ['Auth', 'JWT (jsonwebtoken) + bcrypt', 'Secure session & password management'],
        ['AI Assistant', 'Google Gemini 2.5 Flash Lite', 'In-app chat & ride booking tool calls'],
        ['Geocoding', 'Photon (Komoot) API', 'Reverse geocoding for map selections'],
        ['Security', 'express-rate-limit, cors, dotenv', 'Rate limiting, CORS, secrets management'],
      ],
      [2200, 3200, 3600]
    ),
    spacer(),
    heading2('3.2 Database Schema'),
    para('The platform uses the following core database tables:'),
    makeTable(
      ['Table', 'Description', 'Key Columns'],
      [
        ['users', 'All registered users across all roles', 'id, name, email, password, role, status, gender, vehicle_no, has_vehicle_pass'],
        ['rides', 'Rides listed by Pool Hosts', 'id, driver_id, origin, destination, departure_time, seats_offered, price_per_seat, women_only, status'],
        ['ride_requests', 'Passenger requests to join a ride', 'id, ride_id, passenger_id, status (Pending/Accepted/Rejected/Cancelled)'],
        ['incidents', 'SOS alerts and safety incidents', 'id, reported_by, type, status (Open/Resolved), sla_deadline'],
        ['notifications', 'In-app notification bell messages', 'id, user_id, message, type, is_read'],
        ['messages', 'In-ride chat between passenger and host', 'id, request_id, sender_id, content'],
        ['ratings', 'Post-trip ratings and feedback', 'id, trip_id, rater_id, ratee_id, stars, tags, comment'],
      ],
      [1800, 2600, 4600]
    ),
    spacer()
  );

  // ── 4. USER ROLES & PERMISSIONS ─────────────────────────────────────────────
  sections.push(
    heading1('4. User Roles & Permissions'),
    para('The platform enforces a three-tier Role-Based Access Control (RBAC) model. Each role has distinct capabilities and restricted access enforced at both the frontend and backend levels.'),
    spacer(0.5),
    heading2('4.1 Passenger'),
    para('A Passenger is any verified Reliance employee who wishes to avail carpooling services as a rider.'),
    makeTable(
      ['Capability', 'Details'],
      [
        ['Registration', 'Self-register via the public portal. Email must follow a corporate format.'],
        ['Login', 'Login using corporate email + password, selecting the Passenger role.'],
        ['Ride Discovery', 'Search for available rides by specifying pickup/dropoff coordinates and departure time on an interactive map.'],
        ['Geo-matching', 'System auto-matches rides within a 3 km radius of pickup and dropoff points using the Haversine formula.'],
        ['Women-Only Filter', 'Female passengers may filter for rides flagged as Women-Only by the Pool Host.'],
        ['Request a Ride', 'Submit a booking request for a matching ride; the Pool Host then accepts or rejects.'],
        ['Cancel a Request', 'Cancel a Pending or Accepted request (blocked within 15 minutes of departure).'],
        ['Track Requests', 'View history of all ride requests with statuses: Pending, Accepted, Rejected, Cancelled.'],
        ['In-ride Chat', 'Communicate with the Pool Host through an in-app messaging interface.'],
        ['SOS / Incident', 'File an SOS alert or safety concern, which immediately notifies all online Admins.'],
        ['Rate a Trip', 'Submit a 1–5 star rating with tags and comments for the Pool Host after a completed trip.'],
        ['Notifications', 'Receive in-app notifications and real-time WebSocket push toasts for ride events.'],
        ['AI Assistant', 'Interact with the Gemini AI chatbot for ride recommendations and booking assistance.'],
        ['Profile & Settings', 'Update display name, phone number, and commute preferences.'],
        ['Personal KPIs', 'View rides taken, average cost, CO₂ saved, and upcoming ride on the dashboard.'],
      ],
      [2500, 6500]
    ),
    spacer(),
    heading2('4.2 Pool Host'),
    para('A Pool Host is a verified Reliance employee who owns a vehicle and wishes to offer rides to colleagues.'),
    makeTable(
      ['Capability', 'Details'],
      [
        ['Registration', 'Self-register, providing vehicle details (make, model, number, capacity).'],
        ['Vehicle Pass Verification', 'Must upload a Vehicle Pass; Admin must approve before they can list rides.'],
        ['Login', 'Login using corporate email + password, selecting the Pool Host role.'],
        ['List a Ride', 'Create a ride listing with origin, destination (via map), departure time, seats offered, price per seat, and optional Women-Only flag.'],
        ['Manage Requests', 'View, accept, or reject pending passenger requests from the dashboard.'],
        ['Cancel a Ride', 'Cancel a scheduled ride (blocked within 15 minutes of departure). All accepted passengers are notified.'],
        ['Complete a Ride', 'Mark a ride as Completed; all pending requests are auto-rejected.'],
        ['In-ride Chat', 'Communicate with passengers through the in-app messaging interface.'],
        ['SOS / Incident', 'File an SOS alert or safety concern with immediate Admin notification.'],
        ['Notifications', 'Receive real-time push notifications when passengers request a seat.'],
        ['AI Assistant', 'Interact with the Gemini AI chatbot for ride management assistance.'],
        ['Profile & Settings', 'Update name, phone, vehicle details (number, make, model, capacity).'],
        ['Host KPIs', 'View rides offered, total people carpooled, pending requests, average earnings, and CO₂ saved.'],
      ],
      [2500, 6500]
    ),
    spacer(),
    heading2('4.3 Admin'),
    para('An Admin is a designated Reliance HR or Commute Management staff member with full platform oversight. Admin accounts are seeded directly in the database; they cannot be self-registered.'),
    makeTable(
      ['Capability', 'Details'],
      [
        ['Admin Login', 'Login via a dedicated Admin credential. Admin role cannot be publicly registered.'],
        ['Admin Overview Dashboard', 'Real-time KPIs: Active Trips, Total Users, Total Rides Listed, Open SOS count, Verification Backlog.'],
        ['Corporate Registration', 'Register new employee accounts on behalf of the organisation from within the Admin panel.'],
        ['Verification Backlog', 'Review and approve Pool Host Vehicle Pass submissions, enabling them to list rides.'],
        ['User Directory', 'View all registered users with search, filter, and export (CSV) capabilities.'],
        ['Suspend / Activate Users', 'Toggle the status of any user account between Active and Suspended. Suspended users cannot log in.'],
        ['Promote to Admin', 'Elevate any existing user account to Admin privileges (Admin-only action).'],
        ['Live Incidents Queue', 'View all open SOS/incident tickets with SLA deadlines. Receive instant real-time alerts via WebSocket.'],
        ['Resolve Incidents', 'Mark incidents as Resolved, removing them from the open queue.'],
        ['Trips & Disputes', 'Full visibility into all rides and their statuses across the platform.'],
        ['ESG Impact Dashboard', 'View aggregate CO₂ avoided, fuel saved, employee cost savings, and breakdown by Business Unit.'],
        ['Platform Settings', 'Configure platform-level settings (profile, preferences, security/SSO information).'],
        ['City Filter', 'Filter the overview dashboard by city to view location-specific metrics.'],
      ],
      [2500, 6500]
    ),
    spacer()
  );

  // ── 5. CORE FEATURES ────────────────────────────────────────────────────────
  sections.push(
    heading1('5. Core Features'),
    heading2('5.1 Ride Discovery & Geospatial Matching'),
    para('The ride discovery system is the core of the Passenger experience. Passengers enter a pickup location and dropoff location either via the autocomplete search bar (powered by Photon/Komoot) or by clicking directly on an interactive Leaflet map.'),
    para('The backend applies the Haversine formula to calculate the great-circle distance between the passenger\'s requested coordinates and each listed ride\'s origin/destination. A ride is considered a match only if:'),
    bullet('The distance from the passenger\'s pickup to the ride\'s origin is ≤ 3 km, AND'),
    bullet('The distance from the passenger\'s dropoff to the ride\'s destination is ≤ 3 km.'),
    para('Matched rides are returned sorted by total deviation distance (shortest first), providing the most convenient options at the top.'),
    spacer(0.5),
    heading2('5.2 Real-Time WebSocket Notifications (Socket.io)'),
    para('The platform uses Socket.io to deliver instant, server-pushed notifications to active browser sessions without requiring page refreshes.'),
    makeTable(
      ['Event', 'Trigger', 'Recipient'],
      [
        ['ride_requested', 'A Passenger submits a ride request', 'Pool Host (private room: user_{id})'],
        ['ride_accepted', 'Pool Host accepts a request', 'Passenger (private room: user_{id})'],
        ['ride_rejected', 'Pool Host rejects a request', 'Passenger (private room: user_{id})'],
        ['sos_alert', 'Any user triggers an SOS incident', 'All online Admins (admin_room broadcast)'],
      ],
      [2200, 3800, 3000]
    ),
    para('Each user is placed in an isolated private room (user_{id}) on login, ensuring notifications are never broadcast to unintended recipients. Admins join a dedicated admin_room.'),
    spacer(0.5),
    heading2('5.3 AI-Powered Chatbot (Gemini Assistant)'),
    para('An integrated AI assistant powered by Google Gemini 2.5 Flash Lite is available within the dashboard for all logged-in users. The chatbot can:'),
    bullet('Answer questions about carpool policies and guidelines.'),
    bullet('Provide live stats and KPI summaries to users in natural language.'),
    bullet('Draft ride booking requests (using structured tool calls) that the user can confirm.'),
    bullet('List new commutes on behalf of Pool Hosts.'),
    para('The chatbot is grounded with a knowledge base loaded from a Reliance Carpool requirements document, enabling contextually accurate responses.'),
    spacer(0.5),
    heading2('5.4 In-App Messaging (Ride Chat)'),
    para('Once a ride request is accepted, both the Pool Host and Passenger can exchange messages through a dedicated, request-scoped chat interface. Messages are stored in the database against the ride_request ID and are accessible to both parties throughout the lifecycle of the request.'),
    spacer(0.5),
    heading2('5.5 Rating & Feedback System'),
    para('After a trip is completed, Passengers may submit a structured rating for their Pool Host. The rating system includes:'),
    bullet('A 1–5 star numerical rating.'),
    bullet('Predefined tag selection (e.g., "Punctual", "Safe Driver", "Harassment", "Rash Driving").'),
    bullet('An optional free-text comment field.'),
    para([bold('Auto-Escalation Policy: ', C.red), normal('If a submitted rating contains safety-related tags such as "Harassment", "Unsafe Driving", or "Rash Driving", the system automatically creates an incident ticket in the Admin\'s Incident Queue, flagging the driver for review without requiring a manual report.')]),
    spacer(0.5),
    heading2('5.6 SOS & Incident Reporting'),
    para('Any logged-in user (Passenger or Pool Host) can trigger an SOS alert from within their dashboard. The report includes:'),
    bullet('A category selection (e.g., Safety Concern, Medical Emergency, Vehicle Breakdown).'),
    bullet('Automatic 15-minute SLA deadline attached to the incident.'),
    bullet('Immediate real-time notification pushed to all online Admin sessions via WebSocket.'),
    para('Admins can view all open incidents in the Live Incidents Queue, with SLA countdown status, and mark them as Resolved.'),
    spacer(0.5),
    heading2('5.7 ESG Impact Dashboard'),
    para('The Admin-facing ESG Impact Dashboard provides a visual summary of the environmental and financial benefits of the carpooling platform, including:'),
    bullet('Total CO₂ Avoided (kg) — estimated based on rides taken and ARAI fuel norms.'),
    bullet('Total Fuel Saved (litres) — aggregated across all completed rides.'),
    bullet('Employee Cost Savings (₹) — total amount saved by employees through shared rides.'),
    bullet('Active Carpool Users — total number of verified platform participants.'),
    bullet('Monthly trend charts (CO₂ savings and fuel savings) rendered using Recharts.'),
    bullet('Business Unit breakdown — showing contribution per Reliance subsidiary.'),
    spacer(0.5),
    heading2('5.8 Women-Only Rides'),
    para('Pool Hosts may flag a ride listing as Women-Only when creating a ride. Female Passengers can apply a filter in the ride discovery flow to exclusively see these rides. This feature is designed to improve the safety and comfort of female employees using the platform.'),
    spacer()
  );

  // ── 6. POLICIES ─────────────────────────────────────────────────────────────
  sections.push(
    heading1('6. Platform Policies'),
    heading2('6.1 Registration & Eligibility'),
    bullet('Only Reliance Industries Limited employees and affiliates are eligible to register.'),
    bullet('Corporate email addresses are required for registration and must follow a valid email format.'),
    bullet('Passwords must be at least 8 characters long.'),
    bullet('The "Admin" role cannot be self-registered; Admin accounts are created only by the system or by an existing Admin.'),
    bullet('Pool Hosts must provide vehicle details at the time of registration and must have their Vehicle Pass verified by an Admin before they can list rides.'),
    bullet('A single email address may hold both a Passenger and a Pool Host profile simultaneously (dual-role registration is permitted).'),
    spacer(0.5),
    heading2('6.2 Ride Listing Policy'),
    bullet('Pool Hosts may only list rides for genuine, planned commute routes.'),
    bullet('A Pool Host cannot list a ride if they do not have an approved Vehicle Pass (pending verification blocks ride listing).'),
    bullet('Ride prices are set by the Pool Host and must reflect fair cost-sharing, not commercial profit.'),
    bullet('The number of seats offered cannot exceed the vehicle\'s registered seating capacity.'),
    spacer(0.5),
    heading2('6.3 Cancellation Policy'),
    bullet('A Passenger may cancel an Accepted or Pending ride request at any time.'),
    bullet('A Pool Host may cancel a scheduled ride at any time, but cancellation is blocked within 15 minutes of the stated departure time.'),
    bullet('An Admin may cancel any ride at any time, without the 15-minute restriction.'),
    bullet('When a Pool Host cancels a ride, all passengers who have Accepted requests on that ride are automatically notified.'),
    spacer(0.5),
    heading2('6.4 Account Suspension Policy'),
    bullet('An Admin may suspend any user account at any time.'),
    bullet('A suspended user is prevented from logging in and receives an "Account Suspended" error upon login attempt.'),
    bullet('Suspension is reversible; an Admin may re-activate a suspended account at any time.'),
    bullet('Grounds for suspension include: repeated cancellations, safety-related rating tags, verified complaints, or policy violations.'),
    spacer(0.5),
    heading2('6.5 SLA (Service Level Agreement) for Incidents'),
    bullet('All SOS/Incident tickets carry an automatic SLA deadline of 15 minutes from the time of creation.'),
    bullet('An Admin is expected to acknowledge and begin resolving an incident within this SLA window.'),
    bullet('Unresolved incidents past their SLA are visually flagged in the Admin Incident Queue.'),
    spacer(0.5),
    heading2('6.6 Rating & Dispute Policy'),
    bullet('Ratings may only be submitted after a ride has been marked as Completed.'),
    bullet('Ratings containing safety-critical tags (Harassment, Unsafe Driving, Rash Driving) are auto-escalated to the Incident Queue.'),
    bullet('Users who receive consistent negative safety ratings may be reviewed and suspended by an Admin.'),
    bullet('Rating content is stored permanently and may be used in dispute resolution.'),
    spacer()
  );

  // ── 7. SECURITY ─────────────────────────────────────────────────────────────
  sections.push(
    heading1('7. Security Architecture'),
    heading2('7.1 Authentication & Session Management'),
    para('The platform uses JSON Web Tokens (JWT) for stateless, secure authentication.'),
    bullet('All passwords are hashed using bcrypt (10 salt rounds) before storage. Plaintext passwords are never stored.'),
    bullet('JWTs are signed with a strong, application-specific secret (JWT_SECRET) stored in a server-side .env file.'),
    bullet('The JWT_SECRET is mandatory; the server will refuse to start if it is absent.'),
    bullet('Tokens are set with a 15-minute expiry to minimise the impact of token theft.'),
    bullet('Sliding Session Management: The backend auto-renews tokens on each authenticated request by emitting an X-New-Token response header. The frontend intercepts this header and updates the stored token seamlessly, ensuring active users remain logged in without re-authentication.'),
    bullet('On receiving a 401 Unauthorized response, the frontend automatically clears the session and redirects the user to the login page.'),
    spacer(0.5),
    heading2('7.2 API Security'),
    makeTable(
      ['Control', 'Implementation'],
      [
        ['Rate Limiting', 'express-rate-limit middleware limits each IP to a maximum of 100 requests per 15-minute window across all API endpoints.'],
        ['CORS Whitelisting', 'CORS is restricted to only two pre-approved origins: http://localhost:5173 and http://localhost:5174. All other origins are blocked.'],
        ['Authentication Middleware', 'A global authenticateToken middleware validates the JWT Bearer token on every API request except the public /login and /register endpoints.'],
        ['Role-Based Guards', 'Each sensitive route includes explicit role checks (e.g., Admin-only routes return 403 Forbidden to non-Admin users).'],
        ['IDOR Prevention', 'Users can only access or modify their own data (verified via req.user.id). Admins are granted broader access where required.'],
        ['Input Validation', 'The registration endpoint validates email format via regex, enforces minimum password length (8 chars), and caps name length (100 chars).'],
        ['Admin Role Block', 'The public /api/register endpoint explicitly rejects any request to register the "Admin" role with a 403 Forbidden response.'],
      ],
      [2500, 6500]
    ),
    spacer()
  );

  // ── 8. API REFERENCE ────────────────────────────────────────────────────────
  sections.push(
    heading1('8. API Reference Summary'),
    makeTable(
      ['Method', 'Endpoint', 'Role', 'Description'],
      [
        ['POST', '/api/auth/login', 'Public', 'User login; returns JWT token and user object.'],
        ['POST', '/api/register', 'Public', 'Register a new Passenger or Pool Host. Admin role is blocked.'],
        ['GET', '/api/users', 'Admin', 'List all registered users.'],
        ['POST', '/api/users/:id/toggle-status', 'Admin', 'Suspend or activate a user account.'],
        ['POST', '/api/users/:id/verify', 'Admin', 'Approve a Pool Host vehicle pass.'],
        ['POST', '/api/users/:id/assign-admin', 'Admin', 'Promote a user to Admin role.'],
        ['GET', '/api/users/:id/stats', 'Self', 'Fetch KPI stats for the logged-in user.'],
        ['POST', '/api/users/:id/update', 'Self', 'Update the user\'s name/phone/vehicle details.'],
        ['GET', '/api/users/:id/rides', 'Self/Admin', 'List rides created by a Pool Host.'],
        ['POST', '/api/rides', 'Pool Host', 'Create a new ride listing.'],
        ['GET', '/api/rides/available', 'Passenger', 'Geo-search for matching available rides.'],
        ['POST', '/api/rides/request', 'Passenger', 'Request a seat on a specific ride.'],
        ['POST', '/api/rides/request/:id/accept', 'Pool Host', 'Accept a passenger\'s ride request.'],
        ['POST', '/api/rides/request/:id/reject', 'Pool Host', 'Reject a passenger\'s ride request.'],
        ['POST', '/api/rides/request/:id/cancel', 'Passenger', 'Cancel a ride request.'],
        ['POST', '/api/rides/:id/cancel', 'Pool Host/Admin', 'Cancel a scheduled ride.'],
        ['POST', '/api/rides/:id/complete', 'Pool Host/Admin', 'Mark a ride as Completed.'],
        ['POST', '/api/incidents/create', 'Any', 'File an SOS/incident alert.'],
        ['GET', '/api/incidents', 'Admin', 'List all incidents.'],
        ['POST', '/api/incidents/resolve', 'Admin', 'Mark an incident as Resolved.'],
        ['GET', '/api/users/:id/notifications', 'Self', 'Fetch unread notifications for a user.'],
        ['GET', '/api/messages/:requestId', 'Self', 'Fetch chat messages for a ride request.'],
        ['POST', '/api/messages', 'Self', 'Send a chat message.'],
        ['POST', '/api/ratings', 'Passenger', 'Submit a post-trip rating.'],
        ['GET', '/api/users/:id/rating', 'Any', 'Get average rating for a user.'],
        ['POST', '/api/chat', 'Any', 'Send a message to the Gemini AI chatbot.'],
      ],
      [800, 3000, 1500, 3700]
    ),
    spacer()
  );

  // ── 9. NON-FUNCTIONAL REQUIREMENTS ─────────────────────────────────────────
  sections.push(
    heading1('9. Non-Functional Requirements'),
    makeTable(
      ['Attribute', 'Requirement'],
      [
        ['Performance', 'API responses for ride search should complete within 500ms for datasets up to 10,000 rides.'],
        ['Availability', 'Backend service should target 99.5% uptime during business hours (07:00–22:00 IST).'],
        ['Scalability', 'The architecture is designed to be migrated from SQLite to PostgreSQL as user numbers grow, with no API contract changes.'],
        ['Security', 'All user passwords are bcrypt-hashed. JWTs expire in 15 minutes. Rate limiting is applied on all endpoints.'],
        ['Responsiveness', 'The frontend UI must be fully usable on desktop browsers (1280px+) and tablets (768px+).'],
        ['Real-Time Latency', 'WebSocket push notifications must be delivered to active client sessions within 1 second of the triggering event.'],
        ['Data Integrity', 'Foreign key constraints are enforced across all database tables to prevent orphaned records.'],
        ['Auditability', 'All incidents, ride actions, and status changes include a created_at timestamp for audit trail purposes.'],
      ],
      [2500, 6500]
    ),
    spacer()
  );

  // ── 10. FUTURE ROADMAP ──────────────────────────────────────────────────────
  sections.push(
    heading1('10. Future Roadmap'),
    heading2('Planned Enhancements'),
    bullet('Forgot Password / OTP-based password reset via corporate email.'),
    bullet('Recurring ride scheduling (e.g., "list this ride every Monday to Friday").'),
    bullet('Mobile application (React Native) for iOS and Android.'),
    bullet('Integration with Reliance HR systems for automatic employee verification.'),
    bullet('In-app payment and corporate wallet integration for cashless ride payments.'),
    bullet('Advanced analytics: heatmaps of commute corridors, peak usage hours.'),
    bullet('Migration from SQLite to PostgreSQL for production deployment.'),
    bullet('SSO integration with Reliance Active Directory / Azure AD.'),
    bullet('Passenger-to-Passenger ride sharing (multi-stop pickup).'),
    spacer()
  );

  // ── 11. GLOSSARY ─────────────────────────────────────────────────────────────
  sections.push(
    heading1('11. Glossary'),
    makeTable(
      ['Term', 'Definition'],
      [
        ['Pool Host', 'A verified Reliance employee with an approved vehicle who lists rides for colleagues.'],
        ['Passenger', 'A Reliance employee who uses the platform to find and request rides.'],
        ['Admin', 'A platform administrator with full oversight, user management, and incident resolution capabilities.'],
        ['Ride Request', 'A Passenger\'s application to join a specific ride listed by a Pool Host.'],
        ['Vehicle Pass', 'An official document proving a Pool Host\'s vehicle is approved for corporate carpooling. Must be verified by Admin.'],
        ['SOS Alert', 'An emergency or safety incident triggered by any user, routed immediately to online Admins.'],
        ['SLA', 'Service Level Agreement — the 15-minute window within which an Admin must acknowledge an SOS/incident.'],
        ['IDOR', 'Insecure Direct Object Reference — a security vulnerability where a user can access another user\'s data by manipulating IDs.'],
        ['JWT', 'JSON Web Token — a compact, URL-safe token used for stateless user authentication.'],
        ['ESG', 'Environmental, Social, and Governance — corporate sustainability and ethical impact framework.'],
        ['Haversine', 'A formula to calculate the great-circle distance between two points on a sphere (used for geo-matching rides).'],
        ['Sliding Session', 'An authentication pattern where the session token is automatically renewed on each user action, preventing abrupt logouts.'],
        ['WebSocket', 'A persistent, bi-directional communication channel between a client and server, enabling real-time data push.'],
      ],
      [2200, 6800]
    ),
    spacer()
  );

  // ── ASSEMBLE DOCUMENT ────────────────────────────────────────────────────────

  const doc = new Document({
    creator: 'Reliance Commute Management',
    title: 'Reliance Carpool Platform — Product Documentation',
    description: 'Full product requirements, features, policies, and roles document for the Reliance Carpool Platform.',
    styles: {
      paragraphStyles: [
        {
          id: 'Heading1', name: 'Heading 1',
          basedOn: 'Normal', next: 'Normal',
          run: { bold: true, size: 36, color: C.reliance, font: 'Arial' },
          paragraph: { spacing: { before: 400, after: 200 } }
        },
        {
          id: 'Heading2', name: 'Heading 2',
          basedOn: 'Normal', next: 'Normal',
          run: { bold: true, size: 28, color: C.accent, font: 'Arial' },
          paragraph: { spacing: { before: 280, after: 140 } }
        },
        {
          id: 'Heading3', name: 'Heading 3',
          basedOn: 'Normal', next: 'Normal',
          run: { bold: true, size: 24, color: C.teal, font: 'Arial' },
          paragraph: { spacing: { before: 200, after: 100 } }
        },
      ]
    },
    sections: [
      {
        properties: {
          page: {
            margin: {
              top:    convertInchesToTwip(1),
              bottom: convertInchesToTwip(1),
              left:   convertInchesToTwip(1),
              right:  convertInchesToTwip(1),
            }
          }
        },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({ text: 'Reliance Carpool Platform  ·  Internal Document  ·  Page ', size: 18, color: C.muted }),
                  new TextRun({ children: [PageNumber.CURRENT], size: 18, color: C.muted }),
                  new TextRun({ text: ' of ', size: 18, color: C.muted }),
                  new TextRun({ children: [PageNumber.TOTAL_PAGES], size: 18, color: C.muted }),
                ]
              })
            ]
          })
        },
        children: [
          ...coverPage(),
          spacer(3),
          ...sections,
        ]
      }
    ]
  });

  return doc;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

(async () => {
  try {
    console.log('Building document...');
    const doc = await buildDoc();
    const buffer = await Packer.toBuffer(doc);
    const outPath = path.join(__dirname, 'Reliance_Carpool_Product_Document.docx');
    fs.writeFileSync(outPath, buffer);
    console.log(`✅ Document saved to: ${outPath}`);
    console.log(`   File size: ${(buffer.length / 1024).toFixed(1)} KB`);
  } catch (err) {
    console.error('Error generating document:', err);
    process.exit(1);
  }
})();
