// Kiểm thử logic theo tiêu chí chấp nhận AC-01..AC-05 trong SDD. Chạy: node test/sim.test.mjs
import assert from 'node:assert/strict';
import * as sim from '../src/sim.js';
import { canPlace } from '../src/world.js';
import { ECONOMY } from '../src/config.js';

const run = (state, seconds, step = 0.05) => { for (let t = 0; t < seconds && state.phase === 'playing'; t += step) sim.tick(state, step); };
let passed = 0;
const test = (name, fn) => { fn(); passed++; console.log('✓', name); };

test('Khởi tạo đúng: 10.000 tiền, 2 nhân viên, 3 bàn', () => {
  const s = sim.newGame();
  assert.equal(s.money, 10000);
  assert.equal(s.employees.length, 2);
  assert.equal(s.items.filter((i) => i.type === 'desk').length, 3);
});

test('Nhân viên tự đi tới bàn và làm việc', () => {
  const s = sim.newGame();
  sim.acceptOffer(s, s.offers[0].id);
  run(s, 10);
  assert.ok(s.employees.every((e) => e.status === 'working'), s.employees.map((e) => e.status).join(','));
});

test('AC-01: năng lượng về 0 thì kiệt sức, rời bàn, không tạo điểm đến hết ngày', () => {
  const s = sim.newGame();
  s.offers.push(sim.makeOffer(s));
  for (const o of [...s.offers]) sim.acceptOffer(s, o.id);
  // dự án rất lớn để luôn có việc
  for (const p of s.projects) for (const t of Object.values(p.tasks)) t.need = 99999;
  const e = s.employees[0];
  run(s, 10);
  e.energy = 1;
  run(s, 3);
  assert.equal(e.status, 'exhausted');
  assert.ok(e.exhaustedToday);
  const snapshot = JSON.stringify(s.projects.map((p) => p.tasks));
  const devDone = s.projects.reduce((sum, p) => sum + (p.tasks.code?.done || 0), 0);
  // ra lệnh quay lại bàn bị từ chối
  assert.equal(sim.commandEmployee(s, e, 4, 6), false);
  run(s, 20);
  const devDoneAfter = s.projects.reduce((sum, p) => sum + (p.tasks.code?.done || 0), 0);
  assert.equal(e.role, 'dev');
  assert.ok(devDoneAfter - devDone < 0.001, 'không tạo thêm điểm code');
  assert.ok(!(Math.round(e.x) === 4 && Math.round(e.y) === 6), 'đã rời ghế');
  assert.ok(snapshot.length > 0);
});

test('AC-02: hoàn thành trước hạn được 100% thưởng', () => {
  const s = sim.newGame();
  const o = s.offers[0];
  sim.acceptOffer(s, o.id);
  const p = s.projects[0];
  const before = s.money;
  for (const t of Object.values(p.tasks)) t.done = t.need;
  sim.tick(s, 0.01);
  assert.equal(s.money, before + o.reward);
  assert.equal(s.projects.length, 0);
});

test('Trễ hạn chỉ nhận 50% thưởng (GR-06)', () => {
  const s = sim.newGame();
  const o = s.offers[0];
  sim.acceptOffer(s, o.id);
  const p = s.projects[0];
  s.day = p.deadlineDay + 1;
  const before = s.money;
  for (const t of Object.values(p.tasks)) t.done = t.need;
  sim.tick(s, 0.01);
  assert.equal(s.money, before + Math.round(o.reward * ECONOMY.lateRewardRate));
});

test('AC-03: không đặt được đồ vào ô đã có đồ', () => {
  const s = sim.newGame();
  const desk = s.items[0];
  assert.equal(canPlace(s, 'plant', desk.x, desk.y), 'Ô đã có đồ');
  assert.equal(canPlace(s, 'plant', 0, 0), null);
  assert.equal(sim.placeItem(s, 'plant', desk.x, desk.y), false);
});

test('Không đặt đồ chặn kín lối đi', () => {
  const s = sim.newGame();
  sim.placeItem(s, 'plant', 1, 0);
  assert.equal(canPlace(s, 'plant', 0, 1), 'Sẽ chặn lối đi');
});

test('Hết giờ làm thì có báo cáo cuối ngày, trừ lương và tiền thuê', () => {
  const s = sim.newGame();
  const salaries = s.employees.reduce((a, e) => a + e.salary, 0);
  run(s, 125);
  assert.equal(s.phase, 'report');
  assert.equal(s.lastReport.salaries, salaries);
  assert.equal(s.money, 10000 - salaries - ECONOMY.rentPerDay);
  sim.startNextDay(s);
  assert.equal(s.day, 2);
  assert.equal(s.phase, 'playing');
});

test('AC-04: tiền âm 3 ngày liên tiếp thì phá sản', () => {
  const s = sim.newGame();
  s.money = -100000;
  for (let d = 0; d < 3; d++) {
    run(s, 125);
    if (d < 2) { assert.equal(s.phase, 'report'); sim.startNextDay(s); }
  }
  assert.equal(s.phase, 'bankrupt');
});

test('AC-05: lưu và tải lại giữ nguyên trạng thái', () => {
  const s = sim.newGame();
  sim.acceptOffer(s, s.offers[0].id);
  sim.placeItem(s, 'coffee', 1, 1);
  const s2 = sim.deserialize(sim.serialize(s));
  assert.equal(s2.money, s.money);
  assert.equal(s2.items.length, s.items.length);
  assert.equal(s2.projects[0].name, s.projects[0].name);
  run(s2, 5);
});

test('Uống cà phê +30 năng lượng, có thời gian chờ', () => {
  const s = sim.newGame();
  sim.placeItem(s, 'coffee', 1, 1);
  const e = s.employees[0];
  e.energy = 40;
  assert.ok(sim.commandEmployee(s, e, 1, 1));
  run(s, 15);
  assert.ok(e.energy >= 69, `energy ${e.energy}`);
});

test('Tuyển dụng trừ phí 1 ngày lương và tự xếp bàn trống', () => {
  const s = sim.newGame();
  const c = s.candidates[0];
  const before = s.money;
  assert.ok(sim.hire(s, c.id));
  assert.equal(s.money, before - c.salary);
  assert.equal(s.employees.length, 3);
  assert.ok(s.employees[2].deskId);
});

console.log(`\n${passed} kiểm thử đạt`);
