const api = require("../../utils/api.js");
const storage = require("../../utils/storage.js");

Page({
  data: {
    nickname: "健身达人",
    greetingText: "",
    todayStatus: { trained: false, count: 0, calories: 0 },
    weekStatus: { trainDays: 0 },
    todayPlan: null,
    offline: false,
  },

  onShow() {
    this.init();
    this.loadToday();
  },

  init() {
    const user = wx.getStorageSync("fitness_user");
    if (user && (user.nickname || user.user?.nickname)) {
      this.setData({ nickname: user.nickname || user.user?.nickname || "健身达人" });
    }
    const h = new Date().getHours();
    const g = h < 6 ? "夜深了，注意休息" : h < 12 ? "早上好" : h < 14 ? "中午好" : h < 18 ? "下午好" : "晚上好";
    this.setData({ greetingText: g + "，今天练什么？" });
    this.setData({ offline: api.isOffline() });
  },

  async loadToday() {
    const app = getApp();
    const userId = app.globalData.userId || storage.getUserId();
    if (!userId) return;

    try {
      const data = await api.getDashboard(userId);
      this.setData({
        todayStatus: data.today,
        weekStatus: data.week,
        offline: data._offline || false,
      });
    } catch (e) {
      this.setData({ offline: true });
    }

    try {
      const planData = await api.getTodayPlan(userId);
      this.setData({ todayPlan: planData.plan, offline: this.data.offline || planData._offline || false });
    } catch (e) {}
  },

  startTraining() {
    wx.navigateTo({ url: "/pages/training/index" });
  },
});