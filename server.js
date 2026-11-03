const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const PORT = process.env.PORT || 3000;
const ROOT = __dirname;
const PUBLIC = path.join(ROOT, "public");
const DATA = path.join(ROOT, "data", "db.json");
const sessions = new Map();

if (!fs.existsSync(path.dirname(DATA))) fs.mkdirSync(path.dirname(DATA), { recursive: true });
if (!fs.existsSync(DATA)) fs.writeFileSync(DATA, JSON.stringify({ users: [], timetables: [] }, null, 2));

function readDB() { return JSON.parse(fs.readFileSync(DATA, "utf8")); }
function writeDB(db) { fs.writeFileSync(DATA, JSON.stringify(db, null, 2)); }
function send(res, status, data, type = "application/json") {
  res.writeHead(status, { "Content-Type": type, "Cache-Control": "no-store" });
  res.end(type === "application/json" ? JSON.stringify(data) : data);
}
function body(req) {
  return new Promise((resolve, reject) => {
    let raw = "";
    req.on("data", chunk => { raw += chunk; if (raw.length > 1e6) reject(new Error("Request too large")); });
    req.on("end", () => { try { resolve(raw ? JSON.parse(raw) : {}); } catch { reject(new Error("Invalid JSON")); } });
  });
}
function tokenFor(req) {
  const token = (req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  return sessions.get(token) || null;
}
function makeToken(userId) {
  const token = crypto.randomBytes(32).toString("hex");
  sessions.set(token, userId);
  return token;
}
function hashPassword(password, salt = crypto.randomBytes(16).toString("hex")) {
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return { salt, hash };
}
function safeUser(user) { return { id: user.id, name: user.name, email: user.email }; }

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
const DEFAULT_SLOTS = ["09:00 - 10:00", "10:00 - 11:00", "11:15 - 12:15", "12:15 - 13:15", "14:00 - 15:00", "15:00 - 16:00"];

function generateTimetable(input) {
  const subjects = Array.isArray(input.subjects) ? input.subjects : [];
  const days = Array.isArray(input.days) && input.days.length ? input.days : DAYS;
  const slots = Array.isArray(input.slots) && input.slots.length ? input.slots : DEFAULT_SLOTS;
  const rooms = Array.isArray(input.rooms) && input.rooms.length ? input.rooms : ["Room 101", "Room 102", "Lab 1"];
  if (!subjects.length) throw new Error("Add at least one subject before generating.");
  const normalized = subjects.map(s => ({
    name: String(s.name || "").trim(),
    teacher: String(s.teacher || "Faculty").trim(),
    periods: Math.max(1, Math.min(10, Number(s.periods) || 1)),
    type: String(s.type || "Theory")
  })).filter(s => s.name);
  if (!normalized.length) throw new Error("Enter valid subject names.");

  const lessons = [];
  normalized.forEach(s => { for (let i = 0; i < s.periods; i++) lessons.push({ ...s }); });
  // Spread repeated lessons across the week before filling adjacent slots.
  lessons.sort((a, b) => b.periods - a.periods);
  const grid = [];
  days.forEach(day => slots.forEach(slot => grid.push({ day, slot, subject: "", teacher: "", room: "", type: "" })));
  const teacherBusy = new Set(), subjectDayCount = {};
  let cursor = 0;
  for (const lesson of lessons) {
    let placed = false;
    for (let offset = 0; offset < grid.length; offset++) {
      const idx = (cursor + offset) % grid.length;
      const cell = grid[idx];
      const teacherKey = `${cell.day}|${cell.slot}|${lesson.teacher.toLowerCase()}`;
      const subjectDayKey = `${cell.day}|${lesson.name.toLowerCase()}`;
      if (!cell.subject && !teacherBusy.has(teacherKey) && (subjectDayCount[subjectDayKey] || 0) < 2) {
        Object.assign(cell, { subject: lesson.name, teacher: lesson.teacher, room: rooms[idx % rooms.length], type: lesson.type });
        teacherBusy.add(teacherKey);
        subjectDayCount[subjectDayKey] = (subjectDayCount[subjectDayKey] || 0) + 1;
        cursor = (idx + 1) % grid.length;
        placed = true;
        break;
      }
    }
    if (!placed) throw new Error("There are more requested periods than available timetable slots. Add more days/slots or reduce periods.");
  }
  return { days, slots, grid, generatedAt: new Date().toISOString() };
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
  if (url.pathname.startsWith("/api/")) {
    try {
      if (req.method === "POST" && url.pathname === "/api/register") {
        const b = await body(req);
        const name = String(b.name || "").trim(), email = String(b.email || "").trim().toLowerCase();
        const password = String(b.password || "");
        if (!name || !email || password.length < 6) return send(res, 400, { error: "Enter your name, email and a password with at least 6 characters." });
        const db = readDB();
        if (db.users.some(u => u.email === email)) return send(res, 409, { error: "An account with this email already exists." });
        const secured = hashPassword(password);
        const user = { id: crypto.randomUUID(), name, email, ...secured, createdAt: new Date().toISOString() };
        db.users.push(user); writeDB(db);
        return send(res, 201, { user: safeUser(user), token: makeToken(user.id) });
      }
      if (req.method === "POST" && url.pathname === "/api/login") {
        const b = await body(req), email = String(b.email || "").trim().toLowerCase();
        const db = readDB(), user = db.users.find(u => u.email === email);
        if (!user || hashPassword(String(b.password || ""), user.salt).hash !== user.hash)
          return send(res, 401, { error: "Email or password is incorrect." });
        return send(res, 200, { user: safeUser(user), token: makeToken(user.id) });
      }
      if (req.method === "POST" && url.pathname === "/api/logout") {
        const token = (req.headers.authorization || "").replace(/^Bearer\s+/i, "");
        sessions.delete(token); return send(res, 200, { message: "Logged out." });
      }
      const userId = tokenFor(req);
      if (!userId) return send(res, 401, { error: "Please sign in to continue." });
      if (req.method === "GET" && url.pathname === "/api/me") {
        const user = readDB().users.find(u => u.id === userId);
        return user ? send(res, 200, { user: safeUser(user) }) : send(res, 401, { error: "Session expired." });
      }
      if (req.method === "POST" && url.pathname === "/api/generate") {
        const b = await body(req), timetable = generateTimetable(b);
        const db = readDB();
        const record = { id: crypto.randomUUID(), userId, title: String(b.title || "My Timetable").slice(0, 70), ...timetable };
        db.timetables.unshift(record); writeDB(db);
        return send(res, 201, { timetable: record });
      }
      if (req.method === "GET" && url.pathname === "/api/timetables") {
        const records = readDB().timetables.filter(t => t.userId === userId);
        return send(res, 200, { timetables: records });
      }
      const match = url.pathname.match(/^\/api\/timetables\/([a-f0-9-]+)$/i);
      if (match && req.method === "DELETE") {
        const db = readDB(), before = db.timetables.length;
        db.timetables = db.timetables.filter(t => !(t.id === match[1] && t.userId === userId));
        writeDB(db);
        return send(res, before === db.timetables.length ? 404 : 200, { message: "Timetable deleted." });
      }
      return send(res, 404, { error: "API route not found." });
    } catch (err) { return send(res, 400, { error: err.message || "Something went wrong." }); }
  }

  let requested = decodeURIComponent(url.pathname === "/" ? "/index.html" : url.pathname);
  const file = path.normalize(path.join(PUBLIC, requested));
  if (!file.startsWith(PUBLIC)) return send(res, 403, "Forbidden", "text/plain");
  fs.readFile(file, (err, content) => {
    if (err) return send(res, 404, "Page not found", "text/plain");
    const ext = path.extname(file);
    const types = { ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".svg": "image/svg+xml" };
    send(res, 200, content, types[ext] || "application/octet-stream");
  });
});

server.listen(PORT, () => console.log(`Smart Timetable Generator running at http://localhost:${PORT}`));
