const api = require("../../utils/api.js");
const storage = require("../../utils/storage.js");

Page({
  data: {
    tab: 0,
    stats: { trainDays: 0, totalVolume: 0, totalSets: 0 },
    todayData: { trained: false, count: 0 },
    weekData: { trainDays: 0 },
    weightData: [],
    bigThree: [],
    offline: false,
  },

  onShow() { this.loadData(); },

  async loadData() {
    const userId = storage.getUserId() || 1;
    let offline = false;

    // 仪表盘
    try {
      const d = await api.getDashboard(userId);
      this.setData({ todayData: d.today, weekData: d.week, offline: d._offline || false });
      offline = d._offline;
    } catch (e) { offline = true; }

    // 本地统计
    const localStats = storage.getTotalStats();
    this.setData({ stats: { ...localStats, totalSessions: localStats.trainDays }, offline });

    // 体重趋势
    try {
      const w = await api.getTrend(userId, "weight");
      const data = w || [];
      const maxW = Math.max(...data.map(d => d.weight || 0), 1);
      this.setData({ weightData: data.slice(-14).map(d => ({ ...d, date: (d.record_date || d.date || "").slice(5), percent: (d.weight / maxW) * 140 })) });
    } catch (e) {}

    // 力量趋势
    try {
      const s = await api.getTrend(userId, "strength");
      const names = ["杠铃深蹲(高杆)", "杠铃平板卧推", "硬拉(传统)"];
      const labels = ["深蹲", "卧推", "硬拉"];
      const bt = names.map((n, i) => {
        const data = (s[n] || []).slice(-14);
        const maxVal = Math.max(...data.map(d => d.estimated1RM || 0), 1);
        return { name: n, label: labels[i], data: data.map(d => ({ ...d, date: (d.date || "").slice(5), percent: (d.estimated1RM / maxVal) * 140 })) };
      });
      this.setData({ bigThree: bt });
    } catch (e) {}
  },

  switchTab(e) {
    this.setData({ tab: parseInt(e.currentTarget.dataset.tab) });
  },
});