const api = require("../../utils/api.js");
const storage = require("../../utils/storage.js");

const catMap = { Chest: "胸", Back: "背", Legs: "腿", Shoulders: "肩", Arms: "手臂", Core: "腹肌" };

Page({
  data: { plans: [], offline: false },

  onShow() { this.loadPlans(); },

  async loadPlans() {
    const userId = storage.getUserId() || 1;
    try {
      const data = await api.getActivePlans(userId);
      this.setData({ plans: data || [], offline: data._offline || false });
    } catch (e) {
      this.setData({ plans: [], offline: true });
    }
  },

  startPlanTraining() {
    wx.navigateTo({ url: "/pages/training/index" });
  },

  async suggestPlan(e) {
    const cat = catMap[e.currentTarget.dataset.cat] || "胸";
    try {
      const details = await api.suggestPlan(cat);
      const content = details.map((m, i) => (i + 1) + ". " + m.name + " " + m.target_sets + "组").join("\n");
      wx.showModal({
        title: "推荐计划",
        content,
        showCancel: true,
        confirmText: "保存",
        success: (r2) => {
          if (r2.confirm) {
            const userId = storage.getUserId() || 1;
            api.saveCustomPlan(userId, cat + " Day", details).then(() => {
              wx.showToast({ title: "已保存" });
              this.loadPlans();
            }).catch(() => {
              wx.showToast({ title: "保存失败", icon: "none" });
            });
          }
        },
      });
    } catch (e) {
      wx.showToast({ title: "获取推荐失败", icon: "none" });
    }
  },
});