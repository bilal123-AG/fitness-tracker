// ========== 健身追踪 PWA v6 ==========
const API = "/api";
let offlineMode = false;
let db = null;

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open("fitness_pwa", 3);
    req.onupgradeneeded = (e) => {
      const d = e.target.result;
      if (!d.objectStoreNames.contains("workouts")) d.createObjectStore("workouts", { keyPath: "id" });
      if (!d.objectStoreNames.contains("plans")) d.createObjectStore("plans", { keyPath: "id" });
      if (!d.objectStoreNames.contains("user")) d.createObjectStore("user", { keyPath: "key" });
    };
    req.onsuccess = (e) => { db = e.target.result; resolve(db); };
    req.onerror = () => reject(req.error);
  });
}
function idbPut(store, data) { return new Promise((r, x) => { const tx = db.transaction(store, "readwrite"); const req = tx.objectStore(store).put(data); req.onsuccess = () => r(req.result); req.onerror = () => x(req.error); }); }
function idbGetAll(store) { return new Promise((r, x) => { const tx = db.transaction(store, "readonly"); const req = tx.objectStore(store).getAll(); req.onsuccess = () => r(req.result); req.onerror = () => x(req.error); }); }
function idbGet(store, key) { return new Promise((r, x) => { const tx = db.transaction(store, "readonly"); const req = tx.objectStore(store).get(key); req.onsuccess = () => r(req.result); req.onerror = () => x(req.error); }); }
function idbDelete(store, key) { return new Promise((r, x) => { const tx = db.transaction(store, "readwrite"); const req = tx.objectStore(store).delete(key); req.onsuccess = () => r(); req.onerror = () => x(req.error); }); }

const MOVEMENTS = [
  { id:1,name:"杠铃卧推",cat:"胸",eq:"杠铃",sets:4,reps:8 },{ id:2,name:"哑铃飞鸟",cat:"胸",eq:"哑铃",sets:3,reps:12 },
  { id:3,name:"上斜哑铃卧推",cat:"胸",eq:"哑铃",sets:3,reps:10 },{ id:4,name:"双杠臂屈伸",cat:"胸",eq:"自重",sets:3,reps:10 },
  { id:5,name:"绳索夹胸",cat:"胸",eq:"器械",sets:3,reps:12 },{ id:6,name:"引体向上",cat:"背",eq:"自重",sets:3,reps:8 },
  { id:7,name:"杠铃划船",cat:"背",eq:"杠铃",sets:4,reps:8 },{ id:8,name:"哑铃单臂划船",cat:"背",eq:"哑铃",sets:3,reps:10 },
  { id:9,name:"高位下拉",cat:"背",eq:"器械",sets:3,reps:10 },{ id:10,name:"硬拉(传统)",cat:"背",eq:"杠铃",sets:3,reps:5 },
  { id:11,name:"杠铃深蹲(高杆)",cat:"腿",eq:"杠铃",sets:4,reps:8 },{ id:12,name:"腿举",cat:"腿",eq:"器械",sets:3,reps:10 },
  { id:13,name:"弓步蹲",cat:"腿",eq:"哑铃",sets:3,reps:10 },{ id:14,name:"腿弯举",cat:"腿",eq:"器械",sets:3,reps:12 },
  { id:15,name:"哑铃肩推",cat:"肩",eq:"哑铃",sets:3,reps:10 },{ id:16,name:"侧平举",cat:"肩",eq:"哑铃",sets:3,reps:12 },
  { id:17,name:"面拉",cat:"肩",eq:"绳索",sets:3,reps:12 },{ id:18,name:"杠铃二头弯举",cat:"手臂",eq:"杠铃",sets:3,reps:10 },
  { id:19,name:"锤式弯举",cat:"手臂",eq:"哑铃",sets:3,reps:10 },{ id:20,name:"三头下压",cat:"手臂",eq:"绳索",sets:3,reps:12 },
  { id:21,name:"卷腹",cat:"腹肌",eq:"自重",sets:3,reps:15 },{ id:22,name:"平板支撑",cat:"腹肌",eq:"自重",sets:3,reps:1 },
  { id:23,name:"俄罗斯转体",cat:"腹肌",eq:"自重",sets:3,reps:15 },{ id:24,name:"悬垂举腿",cat:"腹肌",eq:"自重",sets:3,reps:10 },
];
const CATS = [...new Set(MOVEMENTS.map(m => m.cat))];

const state = { tab:"home", userId:null, nickname:"健身达人", timerSec:0, timerRunning:false, timerInterval:null, musicBpm:130, musicPlaying:false };
let trainingState = null;

// ====== 音乐引擎 ======
let musicCtx = null, musicTimer = null, musicNextBeat = 0, musicBeatCount = 0;

function renderMusic() {
  var platforms = [
    { name:"网易云音乐", icon:"🎵", color:"#ec4141", scheme:"orpheus://", web:"https://music.163.com/", desc:"搜索健身歌单" },
    { name:"QQ音乐", icon:"🎶", color:"#31c27c", scheme:"qqmusic://", web:"https://y.qq.com/", desc:"热门运动BGM" },
    { name:"汽水音乐", icon:"🎧", color:"#ff3b3b", scheme:"snssdk1128://", web:"https://music.douyin.com/", desc:"抖音热歌健身" },
  ];
  var h = '';
  h += '<div class="card"><h3 style="margin-bottom:12px">选择音乐平台</h3>';
  h += '<p style="color:var(--dim);font-size:13px;margin-bottom:16px">点击打开对应 App，搜索「健身」「运动」即可获取歌单</p>';
  platforms.forEach(function(p) {
    h += '<div class="music-platform" style="background:'+p.color+';margin-bottom:10px" onclick="openMusicApp(\''+p.scheme+'\',\''+p.web+'\')">';
    h += '<span style="font-size:32px">'+p.icon+'</span>';
    h += '<div style="flex:1"><b>'+p.name+'</b><br><span style="font-size:12px;opacity:.8">'+p.desc+'</span></div>';
    h += '<span style="font-size:18px">→</span>';
    h += '</div>';
  });
  h += '</div>';
  // built-in BPM
  h += '<div class="card music-card" style="margin-top:12px">';
  h += '<h3 style="margin-bottom:12px">内置节拍器</h3>';
  h += '<div class="music-label">BPM</div>';
  h += '<div class="music-bpm" id="musicBpm">'+state.musicBpm+'</div>';
  h += '<input type="range" class="bpm-slider" min="80" max="180" value="'+state.musicBpm+'" oninput="changeBpm(this.value)">';
  h += '<div class="bpm-presets">'+[100,120,130,140,150].map(function(b){return '<span class="bpm-preset'+(state.musicBpm==b?' active':'')+'" onclick="setBpm('+b+')">'+b+' BPM</span>'}).join("")+'</div>';
  h += '<button class="btn btn-primary-big" onclick="toggleMusic()" style="width:100%;margin-top:12px">'+(state.musicPlaying?'⏸ 暂停节拍':'▶ 播放节拍')+'</button>';
  h += '<div class="music-status">'+(state.musicPlaying?'节拍进行中...':'内置节拍，无需网络')+'</div>';
  h += '</div>';
  document.getElementById("tab-music").innerHTML = h;
}

function openMusicApp(scheme, web) {
  // 尝试唤起 App
  var iframe = document.createElement("iframe");
  iframe.style.display = "none";
  iframe.src = scheme;
  document.body.appendChild(iframe);
  setTimeout(function() {
    window.open(web, "_blank");
  }, 2000);
}

function changeBpm(v) { state.musicBpm = parseInt(v); document.getElementById("musicBpm").textContent=state.musicBpm; document.querySelectorAll(".bpm-preset").forEach(function(el){el.classList.toggle("active",parseInt(el.textContent)==state.musicBpm)}); if(state.musicPlaying){stopBeats();startBeats();} }
function setBpm(b) { state.musicBpm=b; document.getElementById("musicBpm").textContent=b; document.querySelectorAll(".bpm-preset").forEach(function(el){el.classList.toggle("active",parseInt(el.textContent)==b)}); if(state.musicPlaying){stopBeats();startBeats();} }
function toggleMusic() { if(state.musicPlaying){stopBeats();state.musicPlaying=false}else{startBeats();state.musicPlaying=true}; updateMusicUI(); }
function updateMusicUI() { var el=document.getElementById("musicToggle"); if(el){el.textContent=state.musicPlaying?"🔊":"🔇";el.className="music-toggle"+(state.musicPlaying?" on":"");} var m=document.getElementById("btnMusicPlay"); if(m){m.textContent=state.musicPlaying?"🔊 关闭节拍":"🔇 开启节拍";} }
function startBeats() { if(!musicCtx) musicCtx=new(window.AudioContext||window.webkitAudioContext)(); musicBeatCount=0; scheduleNextBeat(); }
function stopBeats() { clearTimeout(musicTimer); musicNextBeat=0; if(musicCtx){musicCtx.close();musicCtx=null;} }
function scheduleNextBeat() { if(!state.musicPlaying)return; var iv=60/state.musicBpm, n=musicCtx.currentTime; if(musicNextBeat<n)musicNextBeat=n; musicNextBeat+=iv; playBeat(musicNextBeat,musicBeatCount); musicBeatCount++; var d=(musicNextBeat-musicCtx.currentTime)*1000-10; musicTimer=setTimeout(scheduleNextBeat,Math.max(10,d)); }
function playBeat(w,c) {
  var db=c%4===0;
  var o=musicCtx.createOscillator(), g=musicCtx.createGain(); o.connect(g); g.connect(musicCtx.destination);
  o.frequency.setValueAtTime(db?60:50,w); o.frequency.exponentialRampToValueAtTime(30,w+0.08); o.type="sine";
  g.gain.setValueAtTime(db?0.6:0.35,w); g.gain.exponentialRampToValueAtTime(0.01,w+0.12); o.start(w); o.stop(w+0.15);
  var h=musicCtx.createOscillator(), hg=musicCtx.createGain(); h.connect(hg); hg.connect(musicCtx.destination);
  h.frequency.value=8000; h.type="square"; hg.gain.setValueAtTime(db?0.15:0.1,w); hg.gain.exponentialRampToValueAtTime(0.001,w+0.03); h.start(w); h.stop(w+0.04);
  if(c%4===1||c%4===3){var ns=musicCtx.createBufferSource(),bf=musicCtx.createBuffer(1,musicCtx.sampleRate*0.1,musicCtx.sampleRate),bd=bf.getChannelData(0);for(var i=0;i<bd.length;i++)bd[i]=(Math.random()*2-1)*Math.exp(-i/(musicCtx.sampleRate*0.02));ns.buffer=bf;var ng=musicCtx.createGain();ns.connect(ng);ng.connect(musicCtx.destination);ng.gain.setValueAtTime(0.25,w);ng.gain.exponentialRampToValueAtTime(0.001,w+0.08);ns.start(w);ns.stop(w+0.1);}
}

// ====== 初始化 ======
async function init() {
  await openDB();
  var user = await idbGet("user", "me");
  if (user) { state.userId = user.id; state.nickname = user.nickname; }
  if (!state.userId) { renderLogin(); } else { showNav(); switchTab("home"); renderHome(); }
  checkOnline(); setInterval(checkOnline, 30000);
}
function showNav() { document.querySelector("nav").style.display = "flex"; }
function hideNav() { document.querySelector("nav").style.display = "none"; }

async function checkOnline() {
  try { var ctrl = new AbortController(); setTimeout(function(){ctrl.abort()},3000); var r = await fetch(API+"/movements/search?size=1",{signal:ctrl.signal}); offlineMode = !r.ok; } catch(e) { offlineMode = true; }
  var el = document.getElementById("offlineBar"); if(el) el.style.display = offlineMode ? "block" : "none";
}

function switchTab(tab) {
  state.tab = tab;
  document.querySelectorAll(".nav-btn").forEach(function(b){ b.classList.toggle("active", b.dataset.tab === tab); });
  document.querySelectorAll(".tab").forEach(function(t){ t.classList.toggle("active", t.id === "tab-"+tab); });
  if (tab==="home") renderHome();
  if (tab==="library") renderLibrary();
  if (tab==="timer") renderTimer();
  if (tab==="music") renderMusic();
  if (tab==="data") renderData();
  if (tab==="training") renderTraining();
}

// ====== 登录 ======
function renderLogin() {
  hideNav();
  document.getElementById("app").innerHTML = '<div class="login-page"><div class="login-hero"><div style="font-size:80px">💪</div><h1>健身追踪</h1><p style="color:var(--dim)">你的专属训练伙伴</p></div><div class="login-form"><input id="nickInput" class="input" placeholder="输入昵称" value="'+(state.nickname||"健身达人")+'"><button class="btn btn-primary-big" onclick="doLogin()" style="width:100%">开始使用</button><button class="btn btn-ghost" onclick="guestLogin()" style="width:100%;margin-top:12px">跳过，直接开始</button></div></div>';
}
async function doLogin() { var n=document.getElementById("nickInput").value||"健身达人"; state.nickname=n; state.userId=Date.now(); await idbPut("user",{key:"me",id:state.userId,nickname:n}); showNav(); switchTab("home"); renderHome(); }
async function guestLogin() { state.userId=Date.now(); state.nickname="游客"; await idbPut("user",{key:"me",id:state.userId,nickname:"游客"}); showNav(); switchTab("home"); renderHome(); }

// ====== 首页 ======
async function renderHome() {
  var h=new Date().getHours(), g=h<6?"夜深了":h<12?"早上好":h<14?"中午好":h<18?"下午好":"晚上好";
  var today=new Date().toISOString().split("T")[0];
  var all=await idbGetAll("workouts");
  var todayW=all.filter(function(w){return (w.date||"").startsWith(today)});
  var weekDays=new Set();
  var d=new Date(); d.setDate(d.getDate()-d.getDay()+(d.getDay()===0?-6:1)); var ws=d.toISOString().split("T")[0];
  all.forEach(function(w){var dd=(w.date||"").split("T")[0]; if(dd>=ws) weekDays.add(dd)});
  var streak=0, dates=new Set(all.map(function(w){return (w.date||"").split("T")[0]}));
  for(var i=0;i<365;i++){var cd=new Date();cd.setDate(cd.getDate()-i);if(dates.has(cd.toISOString().split("T")[0]))streak++;else if(i>0)break;}
  var html='';
  html+='<div class="offline-bar" id="offlineBar"'+(offlineMode?'':' style="display:none"')+'>离线模式 · 数据保存在本地</div>';
  html+='<div class="hero"><h1>Hi, '+state.nickname+'</h1><p>'+g+'，今天练什么？</p></div>';
  html+='<div class="card status-card'+(todayW.length?' done':'')+'"><div style="display:flex;align-items:center;gap:16px"><span style="font-size:36px">'+(todayW.length?'✅':'📋')+'</span><div><b>今日'+(todayW.length?'已':'未')+'训练</b><br><span style="font-size:12px;opacity:.7">'+todayW.length+'次训练</span></div></div><span class="badge">本周 '+weekDays.size+'/7 天</span></div>';
  html+='<button class="btn btn-primary-big" onclick="startWorkout()" style="width:100%">💪 开始训练</button>';
  html+='<div class="card" style="margin-top:12px"><h3>🔥 连续打卡</h3><div style="font-size:48px;font-weight:700;color:var(--accent);text-align:center;padding:16px">'+streak+' <span style="font-size:16px">天</span></div></div>';
  html+='<div class="card" style="margin-top:12px"><h3>📋 最近训练</h3>';
  if(all.length){
    html+=all.slice(0,5).map(function(w){return '<div class="history-row">'+new Date(w.date).toLocaleDateString("zh-CN")+' - '+(w.exercises||[]).map(function(e){return e.name}).join("、")+'</div>'}).join("");
  }else{html+='<p style="color:var(--dim)">暂无记录</p>';}
  html+='</div>';
  document.getElementById("tab-home").innerHTML=html;
}

// ====== 训练 ======
function startWorkout() {
  trainingState={id:Date.now(),date:new Date().toISOString(),exercises:[],elapsed:0,timerInterval:null,currentMove:null,resting:false};
  document.querySelectorAll(".nav-btn").forEach(function(b){b.classList.remove("active")});
  document.querySelectorAll(".tab").forEach(function(t){t.classList.remove("active")});
  document.getElementById("tab-training").classList.add("active");
  renderTraining();
  trainingState.timerInterval=setInterval(function(){
    trainingState.elapsed++;
    var m=Math.floor(trainingState.elapsed/60),s=trainingState.elapsed%60;
    var el=document.getElementById("trainTimer"); if(el) el.textContent=String(m).padStart(2,"0")+":"+String(s).padStart(2,"0");
  },1000);
}

function renderTraining() {
  var ts=trainingState, cur=ts.currentMove;
  var em=Math.floor(ts.elapsed/60), es=ts.elapsed%60;
  var h='';
  h+='<div class="train-header">';
  h+='<span class="train-timer" id="trainTimer">'+String(em).padStart(2,"0")+":"+String(es).padStart(2,"0")+'</span>';
  h+='<span class="train-badge">训练中</span>';
  h+='<span id="musicToggle" class="music-toggle'+(state.musicPlaying?' on':'')+'" onclick="toggleMusic()" title="健身节拍">'+(state.musicPlaying?'🔊':'🔇')+'</span>';
  h+='</div>';
  if(cur){
    h+='<div class="train-main">';
    h+='<h2 style="text-align:center">'+cur.name+'</h2>';
    h+='<p style="color:var(--accent);text-align:center">第 '+cur.setNo+'/'+cur.totalSets+' 组</p>';
    h+='<div class="input-cards">';
    h+='<div class="input-card"><span class="input-label">重量 kg</span><div class="stepper"><button class="stepper-btn" onclick="adjWeight(-2.5)">-</button><input id="weightInput" class="stepper-val" type="number" value="'+cur.weight+'" step="2.5" min="0" onchange="onWeightChange()"><button class="stepper-btn" onclick="adjWeight(2.5)">+</button></div><div class="quick-picks">'+[20,40,60,80,100].map(function(w){return '<span class="qp '+(cur.weight==w?'active':'')+'" onclick="setWeight('+w+')">'+w+'</span>'}).join("")+'</div></div>';
    h+='<div class="input-card"><span class="input-label">次数</span><div class="stepper"><button class="stepper-btn" onclick="adjReps(-1)">-</button><input id="repsInput" class="stepper-val" type="number" value="'+cur.reps+'" min="1" onchange="onRepsChange()"><button class="stepper-btn" onclick="adjReps(1)">+</button></div></div>';
    h+='</div>';
    h+='<button class="btn btn-primary-big" onclick="recordSet()" style="width:100%">✅ 记录这组</button>';
    if(ts.resting) h+='<div class="rest-card"><p>休息中...</p><h2 id="restTimer">'+ts.restSec+'s</h2><button class="btn btn-sm" onclick="skipRest()">跳过休息</button></div>';
    h+='</div>';
  } else {
    h+='<div style="text-align:center;padding:40px 0"><h2>选择动作</h2><p style="color:var(--dim)">开始训练</p></div>';
  }
  h+='<div class="add-section"><select id="exerciseSelect" onchange="selectExercise()" class="input"><option value="">+ 添加动作</option>'+MOVEMENTS.map(function(m){return '<option value="'+m.id+'">'+m.name+' ('+m.cat+')</option>'}).join("")+'</select></div>';
  if(ts.exercises.length>0){
    h+='<div class="card"><h3>已完成</h3>';
    ts.exercises.forEach(function(e){
      h+='<div style="margin-top:8px"><b>'+e.name+'</b><div class="set-badges">'+e.sets.map(function(s,i){return '<span class="set-badge">'+(i+1)+': '+s.weight+'kg × '+s.reps+'</span>'}).join("")+'</div></div>';
    });
    h+='</div>';
  }
  h+='<button class="btn btn-danger" onclick="finishWorkout()" style="width:100%;margin-top:12px">结束训练</button>';
  document.getElementById("tab-training").innerHTML=h;
}

function selectExercise() {
  var id=parseInt(document.getElementById("exerciseSelect").value), m=MOVEMENTS.find(function(x){return x.id===id});
  if(!m)return;
  var sw=20,sr=m.reps, prev=trainingState.exercises.find(function(e){return e.movementId===id});
  if(prev&&prev.sets.length>0){var ls=prev.sets[prev.sets.length-1];sw=ls.weight;sr=ls.reps;}
  trainingState.currentMove={id:m.id,name:m.name,totalSets:m.sets,setNo:1,weight:sw,reps:sr};
  trainingState.resting=false; renderTraining();
}
function adjWeight(d){if(!trainingState.currentMove)return;trainingState.currentMove.weight=Math.max(0,(trainingState.currentMove.weight||20)+d);document.getElementById("weightInput").value=trainingState.currentMove.weight;}
function setWeight(w){trainingState.currentMove.weight=w;renderTraining();}
function adjReps(d){if(!trainingState.currentMove)return;trainingState.currentMove.reps=Math.max(1,(trainingState.currentMove.reps||8)+d);document.getElementById("repsInput").value=trainingState.currentMove.reps;}
function onWeightChange(){trainingState.currentMove.weight=parseFloat(document.getElementById("weightInput").value)||0;}
function onRepsChange(){trainingState.currentMove.reps=parseInt(document.getElementById("repsInput").value)||1;}

function recordSet(){
  var cur=trainingState.currentMove; if(!cur)return;
  var w=parseFloat(document.getElementById("weightInput").value)||cur.weight;
  var r=parseInt(document.getElementById("repsInput").value)||cur.reps;
  var ex=trainingState.exercises.find(function(e){return e.movementId===cur.id});
  if(!ex){ex={movementId:cur.id,name:cur.name,sets:[]};trainingState.exercises.push(ex);}
  ex.sets.push({weight:w,reps:r});
  if(cur.setNo>=cur.totalSets){trainingState.currentMove=null;trainingState.resting=false;}
  else{cur.setNo++;cur.weight=w;cur.reps=r;trainingState.resting=true;trainingState.restSec=90;startRestTimer();}
  document.getElementById("exerciseSelect").value=""; renderTraining();
}
function startRestTimer(){
  clearInterval(trainingState.restInterval);
  trainingState.restInterval=setInterval(function(){
    trainingState.restSec--; var el=document.getElementById("restTimer");
    if(el)el.textContent=trainingState.restSec+"s";
    if(trainingState.restSec<=0){clearInterval(trainingState.restInterval);trainingState.resting=false;renderTraining();}
  },1000);
}
function skipRest(){clearInterval(trainingState.restInterval);trainingState.resting=false;renderTraining();}
async function finishWorkout(){
  clearInterval(trainingState.timerInterval); clearInterval(trainingState.restInterval);
  var ts=trainingState; if(ts.exercises.length===0){alert("至少完成一个动作");return;}
  await idbPut("workouts",{id:ts.id,date:ts.date,exercises:ts.exercises,elapsed:ts.elapsed});
  trainingState=null; switchTab("home"); renderHome();
}

// ====== 动作库 ======
function renderLibrary(filter){
  filter=filter||"全部"; var list=filter==="全部"?MOVEMENTS:MOVEMENTS.filter(function(m){return m.cat===filter});
  var h='<div class="filter-row">'+["全部"].concat(CATS).map(function(c){return '<span class="filter-item'+(filter===c?' active':'')+'" onclick="renderLibrary(\''+c+'\')">'+c+'</span>'}).join("")+'</div>';
  h+='<div class="move-list">'+list.map(function(m){return '<div class="move-card" onclick="addFromLib('+m.id+')"><b>'+m.name+'</b><span class="move-meta">'+m.cat+' · '+m.eq+' · '+m.sets+'组 × '+m.reps+'次</span></div>'}).join("")+'</div>';
  document.getElementById("tab-library").innerHTML=h;
}
function addFromLib(id){
  var m=MOVEMENTS.find(function(x){return x.id===id}); if(!m)return;
  if(!trainingState)startWorkout();
  trainingState.currentMove={id:m.id,name:m.name,totalSets:m.sets,setNo:1,weight:20,reps:m.reps};
  document.querySelectorAll(".nav-btn").forEach(function(b){b.classList.remove("active")});
  document.querySelectorAll(".tab").forEach(function(t){t.classList.remove("active")});
  document.getElementById("tab-training").classList.add("active"); renderTraining();
}

// ====== 计时器 ======
function renderTimer(){
  var m=Math.floor(state.timerSec/60),s=state.timerSec%60;
  document.getElementById("tab-timer").innerHTML='<div class="card" style="text-align:center"><div class="timer-big" id="timerDisplay">'+String(m).padStart(2,"0")+":"+String(s).padStart(2,"0")+'</div><div style="display:flex;gap:8px;justify-content:center"><button class="btn btn-primary" onclick="toggleTimer()">'+(state.timerRunning?'暂停':'开始')+'</button><button class="btn btn-secondary" onclick="resetTimer()">重置</button></div><div class="preset-row">'+[30,60,90,120,180].map(function(s){return '<span class="preset-btn" onclick="setTimer('+s+')">'+s+'s</span>'}).join("")+'</div></div>';
}
function toggleTimer(){
  if(state.timerRunning){clearInterval(state.timerInterval);state.timerRunning=false;}
  else{if(state.timerSec<=0)state.timerSec=60;state.timerRunning=true;state.timerInterval=setInterval(function(){state.timerSec--;updateTimerDisplay();if(state.timerSec<=0){clearInterval(state.timerInterval);state.timerRunning=false;beep();renderTimer();}},1000);}
  renderTimer();
}
function resetTimer(){clearInterval(state.timerInterval);state.timerRunning=false;state.timerSec=60;renderTimer();}
function setTimer(sec){clearInterval(state.timerInterval);state.timerRunning=false;state.timerSec=sec;renderTimer();}
function updateTimerDisplay(){var el=document.getElementById("timerDisplay");if(el){var m=Math.floor(state.timerSec/60),s=state.timerSec%60;el.textContent=String(m).padStart(2,"0")+":"+String(s).padStart(2,"0");}}
function beep(){try{var c=new(window.AudioContext||window.webkitAudioContext)(),o=c.createOscillator(),g=c.createGain();o.connect(g);g.connect(c.destination);o.frequency.value=800;g.gain.value=0.3;o.start();o.stop(c.currentTime+0.4);}catch(e){}}

// ====== 数据 ======
async function renderData(){
  var all=await idbGetAll("workouts"), tv=0, ts=0;
  all.forEach(function(w){w.exercises.forEach(function(e){e.sets.forEach(function(s){tv+=s.weight*s.reps;ts++;})})});
  var h='<div class="stat-row"><div class="stat-card"><div class="stat-val">'+all.length+'</div><div class="stat-lbl">训练次数</div></div><div class="stat-card"><div class="stat-val">'+tv+'kg</div><div class="stat-lbl">总容量</div></div><div class="stat-card"><div class="stat-val">'+ts+'</div><div class="stat-lbl">总组数</div></div></div>';
  h+='<div class="card" style="margin-top:12px"><h3>训练历史</h3>';
  if(all.length){h+=all.slice(0,30).map(function(w){return '<div class="history-row" style="display:flex;justify-content:space-between;align-items:center"><span>'+new Date(w.date).toLocaleDateString("zh-CN")+'</span><span style="color:var(--dim);font-size:12px">'+(w.exercises||[]).map(function(e){return e.name}).join(", ")+'</span><span class="del-btn" onclick="delWorkout('+w.id+')">删除</span></div>'}).join("");}else{h+='<p style="color:var(--dim)">暂无记录</p>';}
  h+='</div>'; document.getElementById("tab-data").innerHTML=h;
}
async function delWorkout(id){await idbDelete("workouts",id);renderData();}

init();
