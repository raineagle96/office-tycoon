// Mô phỏng game: không dùng DOM, để có thể chạy kiểm thử bằng Node.
import { GRID, WORK_RATE, TIME, START, ENERGY, HAPPY, ECONOMY, ROLES, TASK_NAMES, ITEMS, PROJECT_TEMPLATES, NAMES } from './config.js';
import { DOOR, deskSeat, itemAt, buildBlockMap, findPath, adjacentFreeTile, canPlace, itemTiles } from './world.js';

const HOURS_PER_DAY = TIME.endHour - TIME.startHour;
const WALK_TILES_PER_SEC = 3; // thời gian thật, nhân với tốc độ game

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const randInt = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

function emit(state, type, data = {}) { state.events.push({ type, ...data }); }
function toast(state, text, kind = 'info') { emit(state, 'toast', { text, kind }); }

function nextId(state) { return state.nextId++; }

export function salaryFor(role, skill) { return ROLES[role].baseSalary + (skill - 5) * 20; }

export function makeCandidate(state) {
  const role = pick(Object.keys(ROLES));
  const skill = randInt(3, 8);
  return { id: nextId(state), name: pick(NAMES), role, skill, salary: salaryFor(role, skill) };
}

function makeEmployee(state, cand) {
  return {
    id: cand.id, name: cand.name, role: cand.role, skill: cand.skill, salary: cand.salary,
    energy: ENERGY.max, happy: 70, x: DOOR.x, y: DOOR.y, path: [], goal: null,
    status: 'idle', deskId: null, lastCoffee: -99, exhaustedToday: false, lowHappyDays: 0,
  };
}

export function makeOffer(state) {
  const t = pick(PROJECT_TEMPLATES);
  const scale = 1 + Math.min(state.day, 40) * 0.025; // GR: dự án sau lớn hơn
  const tasks = {};
  for (const k of Object.keys(t.tasks)) tasks[k] = Math.round(t.tasks[k] * scale);
  return { id: nextId(state), name: t.name, client: t.client, tasks, days: t.days, reward: Math.round(t.reward * scale) };
}

export function newGame() {
  const state = {
    version: 1, day: 1, minutes: 0, money: START.money, negDays: 0, speed: 1, over: false,
    phase: 'playing', items: [], employees: [], projects: [], offers: [], candidates: [],
    stats: emptyStats(), lastReport: null, events: [], nextId: 1,
  };
  // 3 bàn khởi đầu ở hàng giữa
  const deskSpots = [{ x: 4, y: 5 }, { x: 9, y: 5 }, { x: 14, y: 5 }];
  for (const d of deskSpots.slice(0, START.desks)) state.items.push({ id: nextId(state), type: 'desk', x: d.x, y: d.y });
  for (let i = 0; i < START.staff; i++) {
    const c = makeCandidate(state);
    if (i === 0) { c.role = 'dev'; } else { c.role = 'designer'; }
    c.salary = salaryFor(c.role, c.skill);
    const e = makeEmployee(state, c);
    state.employees.push(e);
    assignDesk(state, e, state.items[i]);
  }
  state.offers = [makeOffer(state), makeOffer(state)];
  state.candidates = Array.from({ length: ECONOMY.candidatesPerDay }, () => makeCandidate(state));
  return state;
}

function emptyStats() { return { income: 0, completed: [], quits: [], events: [] }; }

export const clockText = (state) => {
  const total = TIME.startHour * 60 + Math.floor(state.minutes);
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
};

// ---------- Lệnh của người chơi ----------

function setGoal(state, e, goal) {
  const blocked = buildBlockMap(state.items);
  const path = findPath(blocked, e, goal.tile);
  if (!path) return false;
  e.path = path;
  e.goal = goal;
  e.status = path.length ? 'walking' : e.status;
  if (!path.length) arrive(state, e);
  return true;
}

export function assignDesk(state, e, desk) {
  const owner = state.employees.find((o) => o.deskId === desk.id && o !== e);
  if (owner) { toast(state, `Bàn này của ${owner.name}`, 'warn'); return false; }
  e.deskId = desk.id;
  return setGoal(state, e, { kind: 'desk', id: desk.id, tile: deskSeat(desk) });
}

// Click chuột phải vào ô (x, y) khi đang chọn nhân viên e.
export function commandEmployee(state, e, x, y) {
  if (e.status === 'exhausted') { toast(state, `${e.name} kiệt sức, nghỉ đến hết ngày`, 'warn'); return false; }
  const blocked = buildBlockMap(state.items);
  const desks = state.items.filter((i) => i.type === 'desk');
  const deskBySeat = desks.find((d) => { const s = deskSeat(d); return s.x === x && s.y === y; });
  const item = itemAt(state.items, x, y);
  let ok = false;
  if (deskBySeat) ok = assignDesk(state, e, deskBySeat);
  else if (item?.type === 'desk') ok = assignDesk(state, e, item);
  else if (item?.type === 'coffee') {
    const tile = adjacentFreeTile(blocked, item, e);
    ok = tile ? setGoal(state, e, { kind: 'coffee', id: item.id, tile }) : false;
  } else if (item?.type === 'sofa') ok = setGoal(state, e, { kind: 'sofa', id: item.id, tile: { x, y } });
  else ok = setGoal(state, e, { kind: 'move', tile: { x, y } });
  if (!ok) toast(state, 'Không đi tới đó được', 'warn');
  else emit(state, 'sfx', { name: 'command' });
  return ok;
}

function arrive(state, e) {
  const g = e.goal;
  e.goal = null;
  if (!g) { e.status = 'idle'; return; }
  if (g.kind === 'desk' && e.deskId === g.id) { e.status = e.exhaustedToday ? 'idle' : 'working'; return; }
  if (g.kind === 'coffee') {
    const hoursNow = (state.day - 1) * HOURS_PER_DAY + state.minutes / 60;
    if (hoursNow - e.lastCoffee < ENERGY.coffeeCooldownHours) {
      toast(state, `${e.name} vừa uống cà phê rồi`, 'warn');
    } else {
      e.energy = clamp(e.energy + ENERGY.coffeeBoost, 0, ENERGY.max);
      e.lastCoffee = hoursNow;
      emit(state, 'sfx', { name: 'coffee' });
    }
    e.status = 'idle';
    return;
  }
  if (g.kind === 'sofa') { e.status = 'resting'; return; }
  e.status = e.status === 'exhausted' ? 'exhausted' : 'idle';
}

// ---------- Xây dựng, tuyển dụng, dự án ----------

export function placeItem(state, type, x, y) {
  const def = ITEMS[type];
  const reason = canPlace(state, type, x, y);
  if (reason) { toast(state, reason, 'warn'); return false; }
  if (state.money < def.price) { toast(state, 'Không đủ tiền', 'warn'); return false; }
  state.money -= def.price;
  state.items.push({ id: nextId(state), type, x, y });
  // Tính lại đường đi cho người đang di chuyển, phòng khi đồ mới chắn đường
  if (def.solid) {
    const blocked = buildBlockMap(state.items);
    for (const e of state.employees) {
      if (!e.path.length || !e.goal) continue;
      const path = findPath(blocked, { x: Math.round(e.x), y: Math.round(e.y) }, e.goal.tile);
      if (path) e.path = path; else { e.path = []; e.goal = null; e.status = e.status === 'exhausted' ? 'exhausted' : 'idle'; }
    }
  }
  emit(state, 'sfx', { name: 'place' });
  return true;
}

export function removeItemAt(state, x, y) {
  const it = itemAt(state.items, x, y);
  if (!it) return false;
  state.items = state.items.filter((i) => i !== it);
  state.money += Math.floor(ITEMS[it.type].price / 2);
  for (const e of state.employees) {
    if (e.deskId === it.id) { e.deskId = null; if (e.status === 'working') e.status = 'idle'; }
    if (e.goal?.id === it.id) { e.goal = null; e.path = []; e.status = 'idle'; }
  }
  emit(state, 'sfx', { name: 'remove' });
  return true;
}

export function hire(state, candId) {
  const c = state.candidates.find((x) => x.id === candId);
  if (!c) return false;
  const fee = c.salary * ECONOMY.hireFeeDays;
  if (state.money < fee) { toast(state, 'Không đủ tiền trả phí tuyển', 'warn'); return false; }
  state.money -= fee;
  state.candidates = state.candidates.filter((x) => x !== c);
  const e = makeEmployee(state, c);
  state.employees.push(e);
  const freeDesk = state.items.find((d) => d.type === 'desk' && !state.employees.some((o) => o.deskId === d.id));
  if (freeDesk) assignDesk(state, e, freeDesk);
  toast(state, `Đã tuyển ${e.name} (${ROLES[e.role].name})`, 'good');
  emit(state, 'sfx', { name: 'hire' });
  return true;
}

export function fire(state, empId) {
  const e = state.employees.find((x) => x.id === empId);
  if (!e) return false;
  state.employees = state.employees.filter((x) => x !== e);
  toast(state, `${e.name} đã nghỉ việc`);
  return true;
}

export function acceptOffer(state, offerId) {
  if (state.projects.length >= ECONOMY.maxActiveProjects) { toast(state, `Tối đa ${ECONOMY.maxActiveProjects} dự án cùng lúc`, 'warn'); return false; }
  const o = state.offers.find((x) => x.id === offerId);
  if (!o) return false;
  state.offers = state.offers.filter((x) => x !== o);
  const tasks = {};
  for (const [k, need] of Object.entries(o.tasks)) if (need > 0) tasks[k] = { need, done: 0 };
  state.projects.push({ id: o.id, name: o.name, client: o.client, tasks, reward: o.reward, deadlineDay: state.day + o.days - 1 });
  emit(state, 'sfx', { name: 'accept' });
  return true;
}

export const projectProgress = (p) => {
  const need = Object.values(p.tasks).reduce((s, t) => s + t.need, 0);
  const done = Object.values(p.tasks).reduce((s, t) => s + Math.min(t.done, t.need), 0);
  return need ? done / need : 1;
};

function targetProject(state, task) {
  return state.projects
    .filter((p) => p.tasks[task] && p.tasks[task].done < p.tasks[task].need)
    .sort((a, b) => a.deadlineDay - b.deadlineDay)[0] || null;
}

export function currentWork(state, e) {
  const task = ROLES[e.role].task;
  const p = targetProject(state, task);
  return p ? { project: p, task, taskName: TASK_NAMES[task] } : null;
}

function completeProjects(state) {
  for (const p of [...state.projects]) {
    if (Object.values(p.tasks).every((t) => t.done >= t.need)) {
      const late = state.day > p.deadlineDay;
      const pay = Math.round(p.reward * (late ? ECONOMY.lateRewardRate : 1));
      state.money += pay;
      state.stats.income += pay;
      state.stats.completed.push({ name: p.name, pay, late });
      state.projects = state.projects.filter((x) => x !== p);
      toast(state, `Hoàn thành "${p.name}" +${pay.toLocaleString('vi-VN')}${late ? ' (trễ hạn, -50%)' : ''}`, 'good');
      emit(state, 'sfx', { name: 'complete' });
    }
  }
}

// ---------- Vòng lặp ----------

export function tick(state, realDt) {
  if (state.phase !== 'playing' || state.speed === 0) return;
  const dt = realDt * state.speed;
  const gameMinutes = dt * (HOURS_PER_DAY * 60) / TIME.realSecondsPerDay;
  const hours = gameMinutes / 60;
  state.minutes += gameMinutes;

  for (const e of state.employees) {
    moveEmployee(state, e, dt);
    updateNeeds(state, e, hours);
  }
  completeProjects(state);

  if (state.minutes >= HOURS_PER_DAY * 60) endDay(state);
}

function moveEmployee(state, e, dt) {
  if (!e.path.length) return;
  let step = WALK_TILES_PER_SEC * dt;
  while (step > 0 && e.path.length) {
    const n = e.path[0];
    const dx = n.x - e.x, dy = n.y - e.y;
    const dist = Math.hypot(dx, dy);
    if (dist <= step) { e.x = n.x; e.y = n.y; e.path.shift(); step -= dist; }
    else { e.x += (dx / dist) * step; e.y += (dy / dist) * step; step = 0; }
  }
  if (!e.path.length) arrive(state, e);
}

function updateNeeds(state, e, hours) {
  // Hạnh phúc: cây xanh xung quanh, mệt thì giảm
  const ex = Math.round(e.x), ey = Math.round(e.y);
  const nearPlant = state.items.some((it) => it.type === 'plant' && Math.abs(it.x - ex) <= HAPPY.plantRadius && Math.abs(it.y - ey) <= HAPPY.plantRadius);
  if (nearPlant) e.happy += HAPPY.plantPerHour * hours;
  if (e.energy < 30) e.happy -= HAPPY.lowEnergyDrainPerHour * hours;
  e.happy = clamp(e.happy, 0, HAPPY.max);

  if (e.status === 'working') {
    const desk = state.items.find((d) => d.id === e.deskId);
    const seat = desk && deskSeat(desk);
    if (!seat || Math.round(e.x) !== seat.x || Math.round(e.y) !== seat.y) { e.status = 'idle'; return; }
    const work = currentWork(state, e);
    if (!work) return; // ngồi chờ việc, không tốn năng lượng
    const pts = WORK_RATE * e.skill * (e.energy / 100) * hours; // GR-02
    const t = work.project.tasks[work.task];
    t.done = Math.min(t.need, t.done + pts);
    e.energy -= ENERGY.workDrainPerHour * hours; // GR-03
    if (e.energy <= 0) exhaust(state, e);
  } else if (e.status === 'resting') {
    e.energy = clamp(e.energy + ENERGY.sofaRestPerHour * hours, 0, ENERGY.max);
  } else if (e.status === 'idle' && !e.path.length) {
    e.energy = clamp(e.energy + ENERGY.idleRestPerHour * hours, 0, ENERGY.max);
  }
}

// GR-04: kiệt sức → rời bàn, đi về khu nghỉ, không làm việc đến hết ngày
function exhaust(state, e) {
  e.energy = 0;
  e.exhaustedToday = true;
  e.happy = clamp(e.happy - HAPPY.exhaustedPenalty, 0, HAPPY.max);
  e.status = 'exhausted';
  toast(state, `${e.name} kiệt sức!`, 'bad');
  emit(state, 'sfx', { name: 'alert' });
  const blocked = buildBlockMap(state.items);
  const sofas = state.items.filter((i) => i.type === 'sofa');
  const spots = sofas.flatMap((s) => itemTiles(s)).filter((t) => !state.employees.some((o) => o !== e && Math.round(o.x) === t.x && Math.round(o.y) === t.y));
  spots.sort((a, b) => Math.abs(a.x - e.x) + Math.abs(a.y - e.y) - (Math.abs(b.x - e.x) + Math.abs(b.y - e.y)));
  for (const s of spots) {
    const path = findPath(blocked, e, s);
    if (path) { e.path = path; e.goal = { kind: 'sofa-exhausted', tile: s }; return; }
  }
  // Không có sofa: đứng dậy khỏi ghế, sang ô trống bên cạnh
  const step = adjacentFreeTile(blocked, { type: 'plant', x: Math.round(e.x), y: Math.round(e.y) }, e);
  if (step) { e.path = [step]; e.goal = { kind: 'leave', tile: step }; }
}

export function endDay(state) {
  const salaries = state.employees.reduce((s, e) => s + e.salary, 0);
  const rent = ECONOMY.rentPerDay;
  state.money -= salaries + rent; // GR-07
  state.negDays = state.money < 0 ? state.negDays + 1 : 0;

  const quits = [];
  for (const e of [...state.employees]) {
    e.lowHappyDays = e.happy < HAPPY.quitThreshold ? e.lowHappyDays + 1 : 0;
    if (e.lowHappyDays >= HAPPY.quitDays) { quits.push(e.name); state.employees = state.employees.filter((x) => x !== e); }
  }

  const lateProjects = state.projects.filter((p) => p.deadlineDay === state.day).map((p) => p.name);

  state.lastReport = {
    day: state.day, income: state.stats.income, salaries, rent,
    net: state.stats.income - salaries - rent, money: state.money,
    completed: state.stats.completed, quits, lateProjects, negDays: state.negDays,
  };
  state.over = state.negDays >= ECONOMY.bankruptDays;
  state.phase = state.over ? 'bankrupt' : 'report';
  emit(state, 'sfx', { name: state.over ? 'gameover' : 'dayend' });
  emit(state, 'dayEnded');
}

// Gọi khi người chơi bấm "Sang ngày mới" trên báo cáo.
export function startNextDay(state) {
  state.day += 1;
  state.minutes = 0;
  state.stats = emptyStats();
  for (const e of state.employees) {
    e.energy = clamp(e.energy + ENERGY.overnightRecover, 0, ENERGY.max);
    e.exhaustedToday = false;
    e.x = DOOR.x; e.y = DOOR.y; e.path = []; e.goal = null; e.status = 'idle';
    const desk = state.items.find((d) => d.id === e.deskId);
    if (desk) assignDesk(state, e, desk); else e.deskId = null;
  }
  while (state.offers.length < ECONOMY.offersPerDay) state.offers.push(makeOffer(state));
  if (state.offers.length > 4) state.offers = state.offers.slice(-4);
  state.candidates = Array.from({ length: ECONOMY.candidatesPerDay }, () => makeCandidate(state));
  state.phase = 'playing';
}

export function serialize(state) {
  const { events, ...rest } = state;
  return JSON.stringify(rest);
}

export function deserialize(json) {
  const s = JSON.parse(json);
  s.events = [];
  return s;
}

export { GRID };
