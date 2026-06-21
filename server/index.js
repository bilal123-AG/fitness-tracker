const express = require("express");
const cors = require("cors");
const initSqlJs = require("sql.js");
const fs = require("fs");
const path = require("path");

const app = express();
const pwaDir = path.resolve(__dirname, "..", "pwa");
app.use((req, res, next) => {
  const filePath = path.join(pwaDir, req.path === "/" ? "index.html" : req.path);
  if (fs.existsSync(filePath)) {
    res.sendFile(filePath);
  } else {
    next();
  }
});
app.use(cors());
app.use(express.json());

const DB_PATH = path.join(__dirname, "fitness.db");
let db;

async function initDB(SQL) {
  if (fs.existsSync(DB_PATH)) {
    db = new SQL.Database(fs.readFileSync(DB_PATH));
  } else {
    db = new SQL.Database();
  }
  db.run("PRAGMA journal_mode=WAL");
  db.run("PRAGMA foreign_keys=ON");
  db.run("CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT, openid TEXT UNIQUE NOT NULL, nickname TEXT DEFAULT '', avatar TEXT DEFAULT '', created_at TEXT DEFAULT (datetime('now')))");
  db.run("CREATE TABLE IF NOT EXISTS movements (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, category TEXT NOT NULL, equipment TEXT DEFAULT '', default_sets INTEGER DEFAULT 3, default_reps INTEGER DEFAULT 10)");
  db.run("CREATE TABLE IF NOT EXISTS plans (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL, name TEXT NOT NULL, week_day INTEGER DEFAULT 0, active INTEGER DEFAULT 1, created_at TEXT DEFAULT (datetime('now')))");
  db.run("CREATE TABLE IF NOT EXISTS plan_details (id INTEGER PRIMARY KEY AUTOINCREMENT, plan_id INTEGER NOT NULL, movement_id INTEGER NOT NULL, sort_order INTEGER DEFAULT 0, target_sets INTEGER DEFAULT 3, target_reps_min INTEGER DEFAULT 8, target_reps_max INTEGER DEFAULT 12)");
  db.run("CREATE TABLE IF NOT EXISTS workouts (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL, plan_id INTEGER, started_at TEXT DEFAULT (datetime('now')), finished_at TEXT, duration_sec INTEGER DEFAULT 0, total_volume REAL DEFAULT 0, calories INTEGER DEFAULT 0, score INTEGER DEFAULT 0, note TEXT DEFAULT '')");
  db.run("CREATE TABLE IF NOT EXISTS workout_sets (id INTEGER PRIMARY KEY AUTOINCREMENT, workout_id INTEGER NOT NULL, movement_id INTEGER, movement_name TEXT NOT NULL, set_no INTEGER DEFAULT 1, weight REAL DEFAULT 0, reps INTEGER DEFAULT 0, is_pr INTEGER DEFAULT 0, recorded_at TEXT DEFAULT (datetime('now')))");
  db.run("CREATE TABLE IF NOT EXISTS body_weight (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL, weight REAL NOT NULL, record_date TEXT DEFAULT (date('now')))");
  seedMovements();
  saveDB();
}

function saveDB() { fs.writeFileSync(DB_PATH, Buffer.from(db.export())); }

function esc(v) {
  if (v === null || v === undefined) return "NULL";
  if (typeof v === "number") return String(v);
  return "'" + String(v).replace(/'/g, "''") + "'";
}

// 查询 - 返回对象数组
function q(sql, ...params) {
  let i = 0;
  const s = sql.replace(/\?/g, () => esc(params[i++]));
  const r = db.exec(s);
  if (!r.length) return [];
  return r[0].values.map(row => {
    const obj = {};
    r[0].columns.forEach((c, j) => obj[c] = row[j]);
    return obj;
  });
}

// 执行 - INSERT/UPDATE/DELETE
function ex(sql, ...params) {
  let i = 0;
  const s = sql.replace(/\?/g, () => esc(params[i++]));
  db.run(s);
  saveDB();
}

function today() { return new Date().toISOString().split("T")[0]; }
function weekStart() {
  const d = new Date();
  d.setDate(d.getDate() - d.getDay() + (d.getDay() === 0 ? -6 : 1));
  return d.toISOString().split("T")[0];
}

function seedMovements() {
  const r = db.exec("SELECT COUNT(*) as c FROM movements");
  if (r.length && r[0].values[0][0] > 10) return;
  [["杠铃卧推","胸","杠铃",4,8],["哑铃飞鸟","胸","哑铃",3,12],["上斜哑铃卧推","胸","哑铃",3,10],["双杠臂屈伸","胸","自重",3,10],["绳索夹胸","胸","器械",3,12],["引体向上","背","自重",3,8],["杠铃划船","背","杠铃",4,8],["哑铃单臂划船","背","哑铃",3,10],["高位下拉","背","器械",3,10],["硬拉(传统)","背","杠铃",3,5],["杠铃深蹲(高杆)","腿","杠铃",4,8],["腿举","腿","器械",3,10],["弓步蹲","腿","哑铃",3,10],["腿弯举","腿","器械",3,12],["哑铃肩推","肩","哑铃",3,10],["侧平举","肩","哑铃",3,12],["面拉","肩","绳索",3,12],["杠铃二头弯举","手臂","杠铃",3,10],["锤式弯举","手臂","哑铃",3,10],["三头下压","手臂","绳索",3,12],["卷腹","腹肌","自重",3,15],["平板支撑","腹肌","自重",3,1],["俄罗斯转体","腹肌","自重",3,15],["悬垂举腿","腹肌","自重",3,10]]
    .forEach(m => db.run("INSERT OR IGNORE INTO movements (name,category,equipment,default_sets,default_reps) VALUES (?,?,?,?,?)", m));
  saveDB();
}

// ========== 认证 ==========
app.post("/api/auth/login", (req, res) => {
  const { openid, nickname, avatar } = req.body;
  if (!openid) return res.status(400).json({ error: "openid required" });
  let user = q("SELECT * FROM users WHERE openid = ?", openid)[0];
  if (!user) {
    ex("INSERT INTO users (openid, nickname, avatar) VALUES (?,?,?)", openid, nickname || "建身达人", avatar || "");
    user = q("SELECT * FROM users WHERE openid = ?", openid)[0];
  } else if (nickname) {
    ex("UPDATE users SET nickname = ? WHERE id = ?", nickname, user.id);
    user.nickname = nickname;
  }
  res.json({ userId: user.id, user });
});

// ========== 仪表盘 ==========
app.get("/api/dashboard/today/:userId", (req, res) => {
  const uid = parseInt(req.params.userId);
  const td = today(), ws = weekStart();
  const t = q("SELECT COUNT(*) as count, COALESCE(SUM(calories),0) as calories FROM workouts WHERE user_id = ? AND date(started_at) = ?", uid, td)[0];
  const w = q("SELECT COUNT(DISTINCT date(started_at)) as trainDays FROM workouts WHERE user_id = ? AND date(started_at) >= ?", uid, ws)[0];
  res.json({ today: { trained: (t.count||0) > 0, count: t.count||0, calories: t.calories||0 }, week: { trainDays: w.trainDays||0 } });
});

// ========== 趋势 ==========
app.get("/api/dashboard/trend/:userId", (req, res) => {
  const uid = parseInt(req.params.userId);
  if (req.query.type === "weight") return res.json(q("SELECT weight, record_date FROM body_weight WHERE user_id = ? ORDER BY record_date", uid));
  if (req.query.type === "strength") {
    const r = {};
    ["杠铃深蹲(高杆)", "杠铃平板卧推", "硬拉(传统)"].forEach(n => {
      r[n] = q("SELECT ws.weight, ws.reps, date(w.started_at) as date, ROUND(ws.weight*(1+ws.reps/30.0),1) as estimated1RM FROM workout_sets ws JOIN workouts w ON ws.workout_id=w.id WHERE w.user_id=? AND ws.movement_name=? AND ws.weight>0 ORDER BY w.started_at", uid, n);
    });
    return res.json(r);
  }
  res.json([]);
});

// ========== 训练计划 ==========
app.get("/api/plan/today/:userId", (req, res) => {
  const uid = parseInt(req.params.userId), day = new Date().getDay();
  const plan = q("SELECT * FROM plans WHERE user_id=? AND active=1 AND (week_day=? OR week_day=0) ORDER BY id LIMIT 1", uid, day)[0];
  if (!plan) return res.json({ plan: null });
  plan.details = q("SELECT pd.*, m.name as movement_name, m.equipment, m.category FROM plan_details pd JOIN movements m ON pd.movement_id=m.id WHERE pd.plan_id=? ORDER BY pd.sort_order", plan.id);
  res.json({ plan });
});

app.get("/api/plan/active/:userId", (req, res) => {
  const plans = q("SELECT * FROM plans WHERE user_id=? AND active=1", parseInt(req.params.userId));
  plans.forEach(p => p.details = q("SELECT pd.*, m.name as movement_name, m.equipment FROM plan_details pd JOIN movements m ON pd.movement_id=m.id WHERE pd.plan_id=? ORDER BY pd.sort_order", p.id));
  res.json(plans);
});

app.post("/api/plan/suggest", (req, res) => {
  const movs = q("SELECT id, name, default_sets as target_sets, default_reps as target_reps_min, equipment FROM movements WHERE category=? ORDER BY RANDOM() LIMIT 6", req.body.category);
  res.json(movs.map((m, i) => ({ ...m, target_reps_max: m.target_reps_min + 4, sort_order: i })));
});

app.post("/api/plan/custom", (req, res) => {
  const { userId, name, details } = req.body;
  ex("INSERT INTO plans (user_id, name) VALUES (?,?)", userId, name);
  const pid = db.exec("SELECT MAX(id) as id FROM plans WHERE user_id=" + userId)[0].values[0][0];
  details.forEach((d, i) => ex("INSERT INTO plan_details (plan_id,movement_id,sort_order,target_sets,target_reps_min,target_reps_max) VALUES (?,?,?,?,?,?)", pid, d.id, i, d.target_sets||3, d.target_reps_min||8, d.target_reps_max||12));
  res.json({ planId: pid });
});

// ========== 训练 ==========
app.post("/api/workout/start", (req, res) => {
  const { userId, planId } = req.body;
  ex("INSERT INTO workouts (user_id, plan_id) VALUES (?,?)", userId, planId || null);
  const sid = db.exec("SELECT MAX(id) as id FROM workouts WHERE user_id=" + userId)[0].values[0][0];
  res.json({ sessionId: sid });
});

app.post("/api/workout/set", (req, res) => {
  const { sessionId, movementId, movementName, weight, reps, setNo } = req.body;
  const prev = q("SELECT MAX(ws.weight*(1+ws.reps/30.0)) as best FROM workout_sets ws JOIN workouts w ON ws.workout_id=w.id WHERE ws.movement_name=? AND w.user_id=(SELECT user_id FROM workouts WHERE id=?) AND ws.weight>0", movementName, sessionId)[0];
  const cur = parseFloat(weight)*(1+parseInt(reps)/30.0);
  const isPR = (prev && prev.best > 0 && cur > prev.best) ? 1 : 0;
  ex("INSERT INTO workout_sets (workout_id,movement_id,movement_name,set_no,weight,reps,is_pr) VALUES (?,?,?,?,?,?,?)", sessionId, movementId||null, movementName, setNo, weight, reps, isPR);
  ex("UPDATE workouts SET total_volume=total_volume+? WHERE id=?", parseFloat(weight)*parseInt(reps), sessionId);
  res.json({ isPR: !!isPR });
});

app.post("/api/workout/progression", (req, res) => {
  const m = q("SELECT name FROM movements WHERE id=?", req.body.movementId)[0];
  if (!m) return res.json({ suggestion: null });
  const last = q("SELECT weight, reps FROM workout_sets ws JOIN workouts w ON ws.workout_id=w.id WHERE w.user_id=? AND ws.movement_name=? AND ws.weight>0 ORDER BY ws.id DESC LIMIT 1", req.body.userId, m.name)[0];
  res.json({ suggestion: last || { weight: 20, reps: 8 } });
});

app.post("/api/workout/finish", (req, res) => {
  const { sessionId, score, note } = req.body;
  const w = q("SELECT * FROM workouts WHERE id=?", sessionId)[0];
  if (!w) return res.status(404).json({ error: "session not found" });
  const dur = Math.floor((new Date() - new Date(w.started_at + "Z")) / 1000);
  const sc = q("SELECT COUNT(*) as c FROM workout_sets WHERE workout_id=?", sessionId)[0].c;
  const prs = q("SELECT COUNT(*) as c FROM workout_sets WHERE workout_id=? AND is_pr=1", sessionId)[0].c;
  ex("UPDATE workouts SET finished_at=datetime('now'), duration_sec=?, calories=?, score=?, note=? WHERE id=?", dur, Math.round(sc*7), score||0, note||"", sessionId);
  res.json({ duration: dur, totalVolume: w.total_volume||0, calories: Math.round(sc*7), newPRs: prs });
});

// ========== 动作库 ==========
app.get("/api/movements/search", (req, res) => {
  const { keyword, category, equipment, size } = req.query;
  let sql = "SELECT * FROM movements WHERE 1=1", ps = [];
  if (keyword) { sql += " AND name LIKE ?"; ps.push("%"+keyword+"%"); }
  if (category) { sql += " AND category = ?"; ps.push(category); }
  if (equipment) { sql += " AND equipment = ?"; ps.push(equipment); }
  sql += " ORDER BY category, name";
  if (size) { sql += " LIMIT ?"; ps.push(parseInt(size)); }
  res.json({ data: q(sql, ...ps) });
});

// ========== 启动 ==========
async function start() {
  const SQL = await initSqlJs();
  await initDB(SQL);
// Fallback to index.html for SPA-sh routing
app.use((req, res, next) => {
  if (!req.path.startsWith("/api")) {
    res.sendFile(path.join(__dirname, "..", "pwa", "index.html"));
  } else {
    next();
  }
});

app.listen(process.env.PORT || 3000, () => console.log("Fitness API running on http://localhost:" + (process.env.PORT || 3000)));
}
start().catch(console.error);