const api = require("../../utils/api.js");
const movementsData = require("../../utils/movements-data.js");

Page({
  data: { movements: [], keyword: "", selCat: "", selEquip: "", offline: false },

  onLoad() { this.search(); },

  onSearch(e) {
    this.setData({ keyword: e.detail.value });
    this.search();
  },

  filterCat(e) {
    this.setData({ selCat: e.currentTarget.dataset.cat });
    this.search();
  },

  filterEquip(e) {
    this.setData({ selEquip: e.currentTarget.dataset.equip });
    this.search();
  },

  async search() {
    const params = {};
    if (this.data.keyword) params.keyword = this.data.keyword;
    if (this.data.selCat) params.category = this.data.selCat;
    if (this.data.selEquip) params.equipment = this.data.selEquip;
    params.size = 100;

    try {
      const res = await api.searchMovements(params);
      this.setData({
        movements: res.data || [],
        offline: res._offline || false,
      });
    } catch (e) {
      // 完全离线：直接用本地数据
      this.setData({
        movements: movementsData.searchMovements(params),
        offline: true,
      });
    }
  },

  selectMove(e) {
    const pages = getCurrentPages();
    const prev = pages[pages.length - 2];
    if (prev) {
      prev.setData({
        currentMove: {
          name: e.currentTarget.dataset.name,
          id: e.currentTarget.dataset.id,
          targetSets: 3,
        },
      });
    }
    wx.navigateBack();
  },
});