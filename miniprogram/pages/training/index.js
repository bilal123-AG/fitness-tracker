const api = require("../../utils/api.js");
const storage = require("../../utils/storage.js");

Page({
  data: {
    sessionId: null,
    userId: null,
    elapsed: "00:00",
    focusMode: false,
    currentMove: null,
    currentGroup: 1,
    totalGroups: 0,
    weight: 20,
    reps: 8,
    resting: false,
    restTime: 90,
    upcoming: [],
    doneMoves: [],
    prShow: false,
    prDetail: "",
    timerInt: null,
    restInt: null,
    elapsedSec: 0,
    localExercises: [],
    offline: false,
  },

  onLoad() {
    this.setData({
      userId: storage.getUserId() || 1,
    });
    this.initTraining();
  },

  onUnload() {
    clearInterval(this.data.timerInt);
    clearInterval(this.data.restInt);
  },

  async initTraining() {
    this.startElapsedTimer();
    const userId = this.data.userId || 1;

    let moves = [];
    // 尝试获取今日计划
    try {
      const planData = await api.getTodayPlan(userId);
      if (planData.plan && planData.plan.details && planData.plan.details.length) {
        this.setData({ offline: planData._offline || false });
        moves = planData.plan.details.map((d, i) => ({
          movement_id: d.movement_id || d.id,
          movement_name: d.movement_name || d.name,
          target_sets: d.target_sets || 3,
          target_reps_min: d.target_reps_min || 8,
          target_reps_max: d.target_reps_max || 12,
          idx: i,
          done: false,
        }));
      }
    } catch (e) {}

    // 没有计划则从动作库取 6 个
    if (moves.length === 0) {
      const { suggestPlanMovements } = require("../../utils/movements-data.js");
      moves = suggestPlanMovements("").map((m, i) => ({
        movement_id: m.id,
        movement_name: m.name,
        target_sets: m.target_sets,
        target_reps_min: m.target_reps_min,
        target_reps_max: m.target_reps_max,
        idx: i,
        done: false,
      }));
    }

    if (moves.length === 0) {
      wx.showToast({ title: "无法加载动作", icon: "none" });
      return;
    }

    this.setData({
      upcoming: moves,
      currentMove: { name: moves[0].movement_name, id: moves[0].movement_id, targetSets: moves[0].target_sets || 3 },
      totalGroups: moves[0].target_sets || 3,
      currentGroup: 1,
    });

    // 异步获取渐进建议（不阻塞 UI）
    api.getProgression(userId, moves[0].movement_id).then(prog => {
      if (prog && prog.suggestion) {
        this.setData({ weight: prog.suggestion.weight, reps: prog.suggestion.reps });
      }
    }).catch(() => {});
  },

  startElapsedTimer() {
    const t = setInterval(() => {
      this.data.elapsedSec++;
      const m = Math.floor(this.data.elapsedSec / 60);
      const s = this.data.elapsedSec % 60;
      this.setData({ elapsed: String(m).padStart(2, "0") + ":" + String(s).padStart(2, "0") });
    }, 1000);
    this.setData({ timerInt: t });
  },

  async recordSet() {
    const { currentMove, currentGroup, weight, reps } = this.data;
    const sessionId = this.data.sessionId || Date.now();
    this.setData({ sessionId });

    // 调用 API（离线会降级）
    try {
      await api.recordSet(sessionId, currentMove.id, currentMove.name, parseFloat(weight), parseInt(reps), currentGroup);
    } catch (e) {}

    // 本地记录
    const local = [...this.data.localExercises];
    let ex = local.find(e => e.name === currentMove.name);
    if (!ex) {
      ex = { name: currentMove.name, movement_id: currentMove.id, sets: [] };
      local.push(ex);
    }
    ex.sets.push({ weight: parseFloat(weight), reps: parseInt(reps), setNo: currentGroup });

    // 检查本地 PR
    const allSets = local.flatMap(e => e.sets);
    const curScore = parseFloat(weight) * (1 + parseInt(reps) / 30.0);
    const bestPrev = Math.max(0, ...allSets.slice(0, -1).map(s => s.weight * (1 + s.reps / 30.0)));
    if (curScore > bestPrev && bestPrev > 0) {
      this.setData({
        prShow: true,
        prDetail: currentMove.name + " " + weight + "kg × " + reps + "次 新纪录！",
      });
    }

    this.setData({ localExercises: local });

    if (this.data.currentGroup >= this.data.totalGroups) {
      this.nextMovement();
    } else {
      this.setData({
        currentGroup: this.data.currentGroup + 1,
        resting: true,
        restTime: 90,
      });
      this.startRestTimer();
    }
  },

  nextMovement() {
    const { upcoming, currentMove } = this.data;
    const doneMoves = [...this.data.doneMoves, { ...currentMove, done: true }];
    const next = upcoming.find(m => !m.done);

    if (!next) {
      wx.showToast({ title: "所有动作完成！", icon: "none" });
      return this.setData({ currentMove: null, upcoming: doneMoves, doneMoves });
    }

    this.setData({
      currentMove: { name: next.movement_name, id: next.movement_id, targetSets: next.target_sets || 3 },
      totalGroups: next.target_sets || 3,
      currentGroup: 1,
      resting: true,
      restTime: 90,
      doneMoves,
      upcoming: this.data.upcoming.map(m => (m.idx === next.idx ? { ...m } : m)),
    });
    this.startRestTimer();
  },

  startRestTimer() {
    clearInterval(this.data.restInt);
    const t = setInterval(() => {
      const rt = this.data.restTime - 1;
      if (rt <= 0) {
        clearInterval(t);
        this.setData({ resting: false, restTime: 0 });
        wx.vibrateShort();
        return;
      }
      this.setData({ restTime: rt });
    }, 1000);
    this.setData({ restInt: t });
  },

  skipRest() {
    clearInterval(this.data.restInt);
    this.setData({ resting: false, restTime: 0 });
  },

  addRest() {
    this.setData({ restTime: this.data.restTime + 30 });
  },

  incWeight() { this.setData({ weight: (parseFloat(this.data.weight) || 20) + 2.5 }); },
  decWeight() { this.setData({ weight: Math.max(0, (parseFloat(this.data.weight) || 20) - 2.5) }); },
  setWeight(e) { this.setData({ weight: parseFloat(e.currentTarget.dataset.w) }); },
  incReps() { this.setData({ reps: (parseInt(this.data.reps) || 8) + 1 }); },
  decReps() { this.setData({ reps: Math.max(1, (parseInt(this.data.reps) || 8) - 1) }); },
  onWeightInput(e) { this.setData({ weight: e.detail.value }); },
  onRepsInput(e) { this.setData({ reps: e.detail.value }); },

  showActions() {
    wx.showActionSheet({
      itemList: ["替换动作", "添加超级组", "仅休息"],
      success: (res) => {
        if (res.tapIndex === 0) wx.navigateTo({ url: "/pages/movements/index" });
      },
    });
  },

  async finishTraining() {
    clearInterval(this.data.timerInt);
    clearInterval(this.data.restInt);

    const sessionId = this.data.sessionId || Date.now();

    // 调用 API 结束
    let serverResult = {};
    try {
      serverResult = await api.finishWorkout(sessionId, 0, "");
    } catch (e) {}

    // 保存到本地
    const durationSec = this.data.elapsedSec;
    const localExercises = this.data.localExercises;
    let totalVolume = 0;
    localExercises.forEach(ex => ex.sets.forEach(s => totalVolume += s.weight * s.reps));

    storage.saveWorkout({
      id: sessionId,
      sessionId,
      started_at: new Date(Date.now() - durationSec * 1000).toISOString(),
      finished_at: new Date().toISOString(),
      duration_sec: durationSec,
      exercises: localExercises,
      total_volume: totalVolume,
    });

    const content = serverResult._offline
      ? "训练数据已保存到本地\n时长: " + Math.floor(durationSec / 60) + "分"
      : "时长: " + Math.floor((serverResult.duration || durationSec) / 60) + "分\n总容量: " + (serverResult.totalVolume || totalVolume) + "kg\n消耗: " + (serverResult.calories || 0) + "kcal";

    wx.showModal({
      title: "训练完成！",
      content,
      showCancel: false,
      success: () => wx.switchTab({ url: "/pages/index/index" }),
    });
  },

  closePR() { this.setData({ prShow: false }); },
});