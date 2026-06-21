// API 代理 —— 优先请求后端，失败时降级到本地存储
const app = getApp();
const storage = require("./storage.js");
const movementsData = require("./movements-data.js");

const API_TIMEOUT = 5000;
let offlineMode = false;

function isOffline() { return offlineMode; }

function checkConnection() {
  return new Promise((resolve) => {
    wx.request({
      url: app.globalData.apiBase + "/movements/search?size=1",
      method: "GET",
      timeout: 3000,
      success: () => { offlineMode = false; resolve(true); },
      fail: () => { offlineMode = true; resolve(false); },
    });
  });
}

function request(options) {
  return new Promise((resolve, reject) => {
    if (offlineMode) return reject(new Error("OFFLINE"));
    wx.request({
      ...options,
      timeout: API_TIMEOUT,
      success: (res) => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          offlineMode = false;
          resolve(res.data);
        } else {
          reject(new Error("HTTP " + res.statusCode));
        }
      },
      fail: () => {
        offlineMode = true;
        reject(new Error("OFFLINE"));
      },
    });
  });
}

// ========== 认证 ==========
async function login(openid, nickname, avatar) {
  try {
    const data = await request({
      url: app.globalData.apiBase + "/auth/login",
      method: "POST",
      data: { openid: openid || "wx_local_" + Date.now(), nickname, avatar },
    });
    // 同步到本地
    storage.saveUser(data.user || { userId: data.userId, openid, nickname });
    return data;
  } catch (e) {
    // 离线：创建本地用户
    const user = {
      userId: storage.getUserId() || Date.now(),
      openid: openid || "local_" + Date.now(),
      nickname: nickname || "健身达人",
    };
    storage.saveUser(user);
    return { userId: user.userId, user, _offline: true };
  }
}

// ========== 仪表盘 ==========
async function getDashboard(userId) {
  try {
    return await request({ url: app.globalData.apiBase + "/dashboard/today/" + userId });
  } catch (e) {
    // 离线：从本地计算
    const todayWorkouts = storage.getTodayWorkouts();
    const weekStats = storage.getWeekStats();
    return {
      today: {
        trained: todayWorkouts.length > 0,
        count: todayWorkouts.length,
        calories: 0,
      },
      week: { trainDays: weekStats.trainDays },
      _offline: true,
    };
  }
}

// ========== 趋势 ==========
async function getTrend(userId, type) {
  try {
    return await request({ url: app.globalData.apiBase + "/dashboard/trend/" + userId + "?type=" + type });
  } catch (e) {
    if (type === "weight") return storage.getBodyWeights();
    if (type === "strength") {
      return {
        "杠铃深蹲(高杆)": storage.getStrengthTrend("杠铃深蹲(高杆)"),
        "杠铃平板卧推": storage.getStrengthTrend("杠铃平板卧推"),
        "硬拉(传统)": storage.getStrengthTrend("硬拉(传统)"),
      };
    }
    return [];
  }
}

// ========== 训练计划 ==========
async function getTodayPlan(userId) {
  try {
    return await request({ url: app.globalData.apiBase + "/plan/today/" + userId });
  } catch (e) {
    return { plan: storage.getTodayPlan() || null, _offline: true };
  }
}

async function getActivePlans(userId) {
  try {
    return await request({ url: app.globalData.apiBase + "/plan/active/" + userId });
  } catch (e) {
    return storage.getActivePlans();
  }
}

async function suggestPlan(category) {
  try {
    return await request({
      url: app.globalData.apiBase + "/plan/suggest",
      method: "POST",
      data: { category },
    });
  } catch (e) {
    return movementsData.suggestPlanMovements(category);
  }
}

async function saveCustomPlan(userId, name, details) {
  try {
    return await request({
      url: app.globalData.apiBase + "/plan/custom",
      method: "POST",
      data: { userId, name, details },
    });
  } catch (e) {
    const plan = { id: Date.now(), user_id: userId, name, details, week_day: 0, active: 1 };
    storage.savePlan(plan);
    return { planId: plan.id, _offline: true };
  }
}

// ========== 训练流程 ==========
async function startWorkout(userId, planId) {
  try {
    return await request({
      url: app.globalData.apiBase + "/workout/start",
      method: "POST",
      data: { userId, planId },
    });
  } catch (e) {
    const sessionId = Date.now();
    return { sessionId, _offline: true };
  }
}

async function recordSet(sessionId, movementId, movementName, weight, reps, setNo) {
  try {
    return await request({
      url: app.globalData.apiBase + "/workout/set",
      method: "POST",
      data: { sessionId, movementId, movementName, weight, reps, setNo },
    });
  } catch (e) {
    return { isPR: false, _offline: true };
  }
}

async function getProgression(userId, movementId) {
  try {
    return await request({
      url: app.globalData.apiBase + "/workout/progression",
      method: "POST",
      data: { userId, movementId },
    });
  } catch (e) {
    const trend = storage.getStrengthTrend(movementsData.getMovementById(movementId)?.name || "");
    const last = trend[trend.length - 1];
    return { suggestion: last || { weight: 20, reps: 8 } };
  }
}

async function finishWorkout(sessionId, score, note) {
  try {
    return await request({
      url: app.globalData.apiBase + "/workout/finish",
      method: "POST",
      data: { sessionId, score, note },
    });
  } catch (e) {
    return { duration: 0, totalVolume: 0, calories: 0, newPRs: 0, _offline: true };
  }
}

// ========== 动作库 ==========
async function searchMovements(params) {
  try {
    const qs = Object.entries(params).filter(([, v]) => v).map(([k, v]) => k + "=" + encodeURIComponent(v)).join("&");
    return await request({ url: app.globalData.apiBase + "/movements/search?" + qs });
  } catch (e) {
    return { data: movementsData.searchMovements(params), _offline: true };
  }
}

module.exports = {
  isOffline, checkConnection,
  login,
  getDashboard, getTrend,
  getTodayPlan, getActivePlans, suggestPlan, saveCustomPlan,
  startWorkout, recordSet, getProgression, finishWorkout,
  searchMovements,
};