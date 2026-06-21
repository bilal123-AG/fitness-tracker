// 本地动作库（24个动作，离线时使用）
const movementsDB = [
  { id: 1, name: "杠铃卧推", category: "胸", equipment: "杠铃", default_sets: 4, default_reps: 8 },
  { id: 2, name: "哑铃飞鸟", category: "胸", equipment: "哑铃", default_sets: 3, default_reps: 12 },
  { id: 3, name: "上斜哑铃卧推", category: "胸", equipment: "哑铃", default_sets: 3, default_reps: 10 },
  { id: 4, name: "双杠臂屈伸", category: "胸", equipment: "自重", default_sets: 3, default_reps: 10 },
  { id: 5, name: "绳索夹胸", category: "胸", equipment: "器械", default_sets: 3, default_reps: 12 },
  { id: 6, name: "引体向上", category: "背", equipment: "自重", default_sets: 3, default_reps: 8 },
  { id: 7, name: "杠铃划船", category: "背", equipment: "杠铃", default_sets: 4, default_reps: 8 },
  { id: 8, name: "哑铃单臂划船", category: "背", equipment: "哑铃", default_sets: 3, default_reps: 10 },
  { id: 9, name: "高位下拉", category: "背", equipment: "器械", default_sets: 3, default_reps: 10 },
  { id: 10, name: "硬拉(传统)", category: "背", equipment: "杠铃", default_sets: 3, default_reps: 5 },
  { id: 11, name: "杠铃深蹲(高杆)", category: "腿", equipment: "杠铃", default_sets: 4, default_reps: 8 },
  { id: 12, name: "腿举", category: "腿", equipment: "器械", default_sets: 3, default_reps: 10 },
  { id: 13, name: "弓步蹲", category: "腿", equipment: "哑铃", default_sets: 3, default_reps: 10 },
  { id: 14, name: "腿弯举", category: "腿", equipment: "器械", default_sets: 3, default_reps: 12 },
  { id: 15, name: "哑铃肩推", category: "肩", equipment: "哑铃", default_sets: 3, default_reps: 10 },
  { id: 16, name: "侧平举", category: "肩", equipment: "哑铃", default_sets: 3, default_reps: 12 },
  { id: 17, name: "面拉", category: "肩", equipment: "绳索", default_sets: 3, default_reps: 12 },
  { id: 18, name: "杠铃二头弯举", category: "手臂", equipment: "杠铃", default_sets: 3, default_reps: 10 },
  { id: 19, name: "锤式弯举", category: "手臂", equipment: "哑铃", default_sets: 3, default_reps: 10 },
  { id: 20, name: "三头下压", category: "手臂", equipment: "绳索", default_sets: 3, default_reps: 12 },
  { id: 21, name: "卷腹", category: "腹肌", equipment: "自重", default_sets: 3, default_reps: 15 },
  { id: 22, name: "平板支撑", category: "腹肌", equipment: "自重", default_sets: 3, default_reps: 1 },
  { id: 23, name: "俄罗斯转体", category: "腹肌", equipment: "自重", default_sets: 3, default_reps: 15 },
  { id: 24, name: "悬垂举腿", category: "腹肌", equipment: "自重", default_sets: 3, default_reps: 10 },
];

const muscleGroups = ["全部", "胸", "背", "腿", "肩", "手臂", "腹肌"];
const equipmentTypes = ["全部", "杠铃", "哑铃", "自重", "器械", "绳索"];

function searchMovements({ keyword, category, equipment, size }) {
  let list = movementsDB;
  if (category && category !== "全部") list = list.filter(m => m.category === category);
  if (equipment && equipment !== "全部") list = list.filter(m => m.equipment === equipment);
  if (keyword) list = list.filter(m => m.name.includes(keyword));
  if (size) list = list.slice(0, parseInt(size));
  return list;
}

function getMovementById(id) {
  return movementsDB.find(m => m.id == id) || null;
}

function suggestPlanMovements(category) {
  const cat = typeof category === "string" ? category : "";
  const pool = cat ? movementsDB.filter(m => m.category === cat) : movementsDB;
  const shuffled = pool.sort(() => Math.random() - 0.5);
  return shuffled.slice(0, 6).map((m, i) => ({
    id: m.id,
    name: m.name,
    target_sets: m.default_sets,
    target_reps_min: m.default_reps,
    target_reps_max: m.default_reps + 4,
    equipment: m.equipment,
    sort_order: i,
  }));
}

module.exports = { movementsDB, muscleGroups, equipmentTypes, searchMovements, getMovementById, suggestPlanMovements };