const api = require("../../utils/api.js");

Page({
  data: { nickname: "", loading: false, offline: false },

  onLoad() {
    const user = wx.getStorageSync("fitness_user");
    if (user && user.userId) {
      // 检查后端连通性，不通则直接进离线首页
      api.checkConnection().then(online => {
        if (online || user._offline) {
          wx.switchTab({ url: "/pages/index/index" });
        }
      });
    }
  },

  onNickname(e) { this.setData({ nickname: e.detail.value }); },

  async handleLogin() {
    this.setData({ loading: true });
    wx.login({
      success: async (res) => {
        try {
          const data = await api.login(res.code, this.data.nickname || "健身达人", "");
          // 保存到全局
          const app = getApp();
          app.globalData.userId = data.userId;
          app.globalData.userInfo = data.user;
          wx.setStorageSync("fitness_user", data.user || { userId: data.userId, nickname: this.data.nickname });
          this.setData({ loading: false });
          wx.switchTab({ url: "/pages/index/index" });
        } catch (e) {
          this.setData({ loading: false });
          wx.showToast({ title: "登录失败，请重试", icon: "none" });
        }
      },
      fail: () => {
        this.setData({ loading: false });
        this.confirmSkip();
      },
    });
  },

  confirmSkip() {
    wx.showModal({
      title: "提示",
      content: "不登录将以游客模式使用，数据仅保存在本地。\n\n确定跳过登录吗？",
      confirmText: "确定跳过",
      cancelText: "去登录",
      success: (r) => { if (r.confirm) this.guestLogin(); },
    });
  },

  async guestLogin() {
    const data = await api.login("guest_" + Date.now(), "游客", "");
    const app = getApp();
    app.globalData.userId = data.userId;
    app.globalData.userInfo = data.user;
    wx.setStorageSync("fitness_user", data.user || { userId: data.userId, nickname: "游客" });
    wx.switchTab({ url: "/pages/index/index" });
  },
});