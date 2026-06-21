const api = require("./utils/api.js");

App({
  globalData: {
    apiBase: "http://localhost:3000/api",
    userId: null,
    userInfo: null,
    offlineMode: false,
  },

  onLaunch() {
    const user = wx.getStorageSync("fitness_user");
    if (user) {
      this.globalData.userId = user.userId || user.id;
      this.globalData.userInfo = user;
    }
    // 检测后端连通性
    api.checkConnection().then(online => {
      this.globalData.offlineMode = !online;
    });
  },

  login(openid, nickname, avatar) {
    return api.login(openid, nickname, avatar).then(data => {
      if (data.userId) {
        this.globalData.userId = data.userId;
        this.globalData.userInfo = data.user || data;
        wx.setStorageSync("fitness_user", data.user || { userId: data.userId, nickname });
      }
      this.globalData.offlineMode = data._offline || false;
      return data;
    });
  },
});