// 本地存储管理 —— 所有数据以 JSON 格式存在 wx.storage 中
const STORAGE_KEYS = {
  USER: "fit_user",
  WORKOUTS: "fit_workouts",
  PLANS: "fit_plans",
  BODY_WEIGHT: "fit_body_weight",
};

function _read(key) {
  const raw = wx.getStorageSync(key);
  return raw ? JSON.parse(raw) : null;
}

function _write(key, data) {
  wx.setStorageSync(key, JSON.stringify(data));
}

// ====== 用户 ======
function getUser() { return _read(STORAGE_KEYS.USER); }
function saveUser(user) {
  _write(STORAGE_KEYS.USER, { ...user, _offline: true });
  return user;
}
function getUserId() {
  const u = getUser();
  return u ? u.userId || u.id : null;
}

// ====== 训练记录 ======
function getWorkouts() { return _read(STORAGE_KEYS.WORKOUTS) || []; }

function saveWorkout(workout) {
  const list = getWorkouts();
  list.unshift(workout);
  _write(STORAGE_KEYS.WORKOUTS, list);
  return workout;
}

function getWorkoutById(sessionId) {
  return getWorkouts().find(w => w.id == sessionId || w.sessionId == sessionId) || null;
}

function deleteWorkout(idx) {
  const list = getWorkouts();
  list.splice(idx, 1);
  _write(STORAGE_KEYS.WORKOUTS, list);
}

function getTodayWorkouts() {
  const today = new Date().toISOString().split("T")[0];
  return getWorkouts().filter(w => {
    const d = (w.started_at || w.date || "").split("T")[0];
    return d === today;
  });
}

function getWeekStats() {
  const d = new Date();
  d.setDate(d.getDate() - d.getDay() + (d.getDay() === 0 ? -6 : 1));
  const weekStart = d.toISOString().split("T")[0];
  const days = new Set();
  getWorkouts().forEach(w => {
    const dd = (w.started_at || w.date || "").split("T")[0];
    if (dd >= weekStart) days.add(dd);
  });
  return { trainDays: days.size };
}

function getStreakDays() {
  let streak = 0;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dates = new Set(getWorkouts().map(w => (w.started_at || w.date || "").split("T")[0]));
  for (let i = 0; i < 365; i++) {
    const check = new Date(today);
    check.setDate(check.getDate() - i);
    const ds = check.toISOString().split("T")[0];
    if (dates.has(ds)) streak++;
    else if (i > 0) break;
  }
  return streak;
}

// ====== 训练计划 ======
function getPlans() { return _read(STORAGE_KEYS.PLANS) || []; }

function savePlan(plan) {
  const plans = getPlans();
  plan.id = plan.id || Date.now();
  plan.active = 1;
  const idx = plans.findIndex(p => p.id === plan.id);
  if (idx >= 0) plans[idx] = plan;
  else plans.push(plan);
  _write(STORAGE_KEYS.PLANS, plans);
  return plan;
}

function getTodayPlan() {
  const day = new Date().getDay();
  const plans = getPlans().filter(p => p.active === 1);
  return plans.find(p => p.week_day === day || p.week_day === 0) || null;
}

function getActivePlans() {
  return getPlans().filter(p => p.active === 1);
}

// ====== 身体数据 ======
function getBodyWeights() { return _read(STORAGE_KEYS.BODY_WEIGHT) || []; }
function saveBodyWeight(entry) {
  const list = getBodyWeights();
  list.push({ ...entry, date: new Date().toISOString() });
  _write(STORAGE_KEYS.BODY_WEIGHT, list);
  return entry;
}

// ====== 训练趋势（从本地 workouts 推算）=====
function getStrengthTrend(movementName) {
  const rows = [];
  getWorkouts().forEach(w => {
    if (w.exercises) {
      w.exercises.forEach(ex => {
        if (ex.name === movementName && ex.sets) {
          ex.sets.forEach(s => {
            if (s.weight > 0) {
              rows.push({
                date: (w.started_at || w.date || "").split("T")[0],
                weight: s.weight,
                reps: s.reps,
                estimated1RM: Math.round(s.weight * (1 + s.reps / 30.0) * 10) / 10,
              });
            }
          });
        }
      });
    }
  });
  return rows.sort((a, b) => a.date.localeCompare(b.date));
}

function getTotalStats() {
  const workouts = getWorkouts();
  let totalVolume = 0, totalSets = 0;
  workouts.forEach(w => {
    if (w.exercises) {
      w.exercises.forEach(ex => {
        if (ex.sets) {
          ex.sets.forEach(s => {
            totalVolume += (s.weight || 0) * (s.reps || 0);
            totalSets++;
          });
        }
      });
    }
  });
  return { trainDays: workouts.length, totalVolume, totalSets };
}

module.exports = {
  getUser, saveUser, getUserId,
  getWorkouts, saveWorkout, getWorkoutById, deleteWorkout,
  getTodayWorkouts, getWeekStats, getStreakDays,
  getPlans, savePlan, getTodayPlan, getActivePlans,
  getBodyWeights, saveBodyWeight,
  getStrengthTrend, getTotalStats,
};