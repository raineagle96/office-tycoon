// Điểm vào: vòng lặp game, xử lý chuột/phím, giao diện HTML.
import { GRID, ITEMS, ROLES, TASK_NAMES, ECONOMY } from './config.js';
import * as sim from './sim.js';
import { render } from './render.js';
import * as audio from './audio.js';

const SAVE_KEY = 'office-tycoon-save';
const $ = (id) => document.getElementById(id);
const fmt = (n) => Math.round(n).toLocaleString('vi-VN');

const canvas = $('game');
const g = canvas.getContext('2d');

let state = null;
const view = { selectedId: null, tool: null, hover: null, panel: null };
let lastSpeed = 1;

// ---------- Lưu game (AC-05: lưu đầu mỗi ngày) ----------
const hasSave = () => { try { return !!localStorage.getItem(SAVE_KEY); } catch { return false; } };
const save = () => { try { localStorage.setItem(SAVE_KEY, sim.serialize(state)); } catch { /* bỏ qua */ } };
const clearSave = () => { try { localStorage.removeItem(SAVE_KEY); } catch { /* bỏ qua */ } };
function load() {
  try { const raw = localStorage.getItem(SAVE_KEY); return raw ? sim.deserialize(raw) : null; } catch { return null; }
}

// ---------- Modal ----------
function openModal(html, onClick) {
  $('modalCard').innerHTML = html;
  $('modalCard').className = 'card' + (html.includes('menu-card') ? ' menu-card' : '');
  $('modal').hidden = false;
  $('modalCard').onclick = (ev) => {
    const b = ev.target.closest('button[data-act]');
    if (b && !b.disabled) { audio.play('click'); onClick(b.dataset.act, b.dataset.id); }
  };
}
function closeModal() { $('modal').hidden = true; view.panel = null; }

function showMenu() {
  if (state && state.phase === 'playing') { lastSpeed = state.speed || lastSpeed; }
  view.panel = 'menu';
  const canContinue = hasSave();
  openModal(`<div class="menu-card">
      <h1>Office Tycoon</h1>
      <p class="sub">Mô phỏng quản lý văn phòng</p>
      <div class="actions">
        ${state && state.phase === 'playing' ? '<button class="primary" data-act="resume">Chơi tiếp</button>' : ''}
        <button class="${state && state.phase === 'playing' ? '' : 'primary'}" data-act="new">Chơi mới</button>
        <button data-act="continue" ${canContinue ? '' : 'disabled'}>Tiếp tục bản lưu (đầu ngày gần nhất)</button>
        <button data-act="help">Hướng dẫn</button>
      </div>
    </div>`, (act) => {
    if (act === 'resume') closeModal();
    if (act === 'new') { if (state && state.phase === 'playing' && !confirm('Bỏ ván đang chơi và bắt đầu lại?')) return; startGame(sim.newGame()); }
    if (act === 'continue') { const s = load(); if (s) startGame(s); }
    if (act === 'help') showHelp(showMenu);
  });
}

function startGame(s) {
  state = s;
  if (state.phase === 'report') sim.startNextDay(state);
  view.selectedId = null; view.tool = null;
  save();
  closeModal();
  audio.startMusic();
  buildToolbar();
  refreshPanels();
}

function showHelp(back) {
  view.panel = 'help';
  openModal(`<h2>Hướng dẫn</h2>
    <p class="sub">Chơi vô tận: giữ công ty có lãi càng lâu càng tốt.</p>
    <ul class="help-list">
      <li><b>Click trái</b> vào nhân viên để chọn. <b>Click phải</b> vào ô để ra lệnh: đi tới, ngồi vào bàn, uống cà phê, nằm sofa.</li>
      <li>Nhân viên ngồi ở <b>ô ngay dưới bàn</b> sẽ tự làm phần việc đúng vai trò (Developer: Code, Designer: Thiết kế, Tester: Test).</li>
      <li>Làm việc tốn năng lượng. Năng lượng về 0 thì nhân viên <b>kiệt sức</b>, nghỉ đến hết ngày và mất hạnh phúc.</li>
      <li>Cây xanh tăng hạnh phúc trong bán kính 2 ô. Hạnh phúc dưới 20 suốt 3 ngày thì nhân viên xin nghỉ.</li>
      <li>Hoàn thành dự án đúng hạn nhận 100% thưởng, trễ hạn chỉ 50%.</li>
      <li>Cuối ngày trả lương và tiền thuê ${fmt(ECONOMY.rentPerDay)}. Tiền âm 3 ngày liên tiếp là phá sản.</li>
      <li>Phím tắt: <kbd>Space</kbd> tạm dừng, <kbd>1</kbd> <kbd>2</kbd> <kbd>3</kbd> tốc độ, <kbd>Esc</kbd> hủy công cụ, <kbd>M</kbd> tắt tiếng.</li>
    </ul>
    <div class="actions"><button class="primary" data-act="close">Đã hiểu</button></div>`, () => (back ? back() : closeModal()));
}

function showHire() {
  view.panel = 'hire';
  const rows = state.candidates.map((c) => `<div class="cand">
      <div><b>${c.name}</b><span class="role-tag" style="background:${ROLES[c.role].color}">${ROLES[c.role].name}</span>
        <div class="meta">Kỹ năng ${c.skill}/10 · Lương ${fmt(c.salary)}/ngày · Phí tuyển ${fmt(c.salary * ECONOMY.hireFeeDays)}</div></div>
      <button data-act="hire" data-id="${c.id}" ${state.money < c.salary ? 'disabled' : ''}>Tuyển</button>
    </div>`).join('') || '<p class="empty">Hôm nay đã hết ứng viên. Ngày mai có ứng viên mới.</p>';
  const freeDesks = state.items.filter((d) => d.type === 'desk' && !state.employees.some((e) => e.deskId === d.id)).length;
  openModal(`<h2>Tuyển dụng</h2><p class="sub">Mỗi ngày có ${ECONOMY.candidatesPerDay} ứng viên mới. Bàn trống: ${freeDesks}.</p>${rows}
    <div class="actions"><button data-act="close">Đóng</button></div>`, (act, id) => {
    if (act === 'hire') { sim.hire(state, Number(id)); flushEvents(); showHire(); refreshPanels(); }
    else closeModal();
  });
}

function showStaff() {
  view.panel = 'staff';
  const rows = state.employees.map((e) => `<div class="cand">
      <div><b>${e.name}</b><span class="role-tag" style="background:${ROLES[e.role].color}">${ROLES[e.role].name}</span>
        <div class="meta">Kỹ năng ${e.skill} · Năng lượng ${Math.round(e.energy)} · Hạnh phúc ${Math.round(e.happy)} · Lương ${fmt(e.salary)}</div></div>
      <button data-act="fire" data-id="${e.id}">Cho nghỉ</button>
    </div>`).join('') || '<p class="empty">Chưa có nhân viên.</p>';
  openModal(`<h2>Nhân sự</h2><p class="sub">Tổng lương mỗi ngày: ${fmt(state.employees.reduce((s, e) => s + e.salary, 0))}</p>${rows}
    <div class="actions"><button data-act="close">Đóng</button></div>`, (act, id) => {
    if (act === 'fire') {
      const e = state.employees.find((x) => x.id === Number(id));
      if (e && confirm(`Cho ${e.name} nghỉ việc?`)) { sim.fire(state, e.id); if (view.selectedId === e.id) view.selectedId = null; flushEvents(); }
      showStaff(); refreshPanels();
    } else closeModal();
  });
}

function showReport() {
  const r = state.lastReport;
  view.panel = 'report';
  const lines = [
    ...r.completed.map((c) => `<tr><td>Hoàn thành "${c.name}"${c.late ? ' (trễ hạn)' : ''}</td><td class="pos">+${fmt(c.pay)}</td></tr>`),
    `<tr><td>Lương nhân viên</td><td class="neg">-${fmt(r.salaries)}</td></tr>`,
    `<tr><td>Tiền thuê văn phòng</td><td class="neg">-${fmt(r.rent)}</td></tr>`,
    `<tr class="total"><td>Lãi / lỗ trong ngày</td><td class="${r.net >= 0 ? 'pos' : 'neg'}">${r.net >= 0 ? '+' : ''}${fmt(r.net)}</td></tr>`,
    `<tr class="total"><td>Tiền hiện có</td><td class="${r.money >= 0 ? '' : 'neg'}">${fmt(r.money)}</td></tr>`,
  ].join('');
  const notes = [
    ...r.quits.map((n) => `<li>${n} đã xin nghỉ vì không vui.</li>`),
    ...r.lateProjects.map((n) => `<li>Dự án "${n}" đã quá hạn, hoàn thành chỉ nhận 50% thưởng.</li>`),
    r.negDays > 0 ? `<li class="neg">Tiền âm ${r.negDays}/${ECONOMY.bankruptDays} ngày liên tiếp. Âm đủ ${ECONOMY.bankruptDays} ngày là phá sản.</li>` : '',
  ].join('');
  if (state.phase === 'bankrupt') {
    clearSave();
    openModal(`<h2>Phá sản</h2><p class="sub">Công ty âm tiền ${ECONOMY.bankruptDays} ngày liên tiếp. Ông trụ được ${r.day} ngày.</p>
      <table>${lines}</table>
      <div class="actions"><button data-act="menu">Về menu</button><button class="primary" data-act="new">Chơi lại</button></div>`,
    (act) => { if (act === 'new') startGame(sim.newGame()); else { state = null; showMenu(); } });
    return;
  }
  openModal(`<h2>Báo cáo cuối ngày ${r.day}</h2><p class="sub">17:00, hết giờ làm.</p>
    <table>${lines}</table>${notes ? `<ul class="help-list" style="margin-top:12px">${notes}</ul>` : ''}
    <div class="actions"><button class="primary" data-act="next">Sang ngày ${r.day + 1}</button></div>`,
  () => { sim.startNextDay(state); save(); closeModal(); flushEvents(); refreshPanels(); });
}

// ---------- Thanh công cụ và panel ----------
function buildToolbar() {
  const tools = Object.entries(ITEMS).map(([k, d]) =>
    `<button class="tool" data-tool="${k}" title="${d.desc}">${d.name}<small>${fmt(d.price)}</small></button>`).join('');
  $('build').innerHTML = tools + '<button class="tool" data-tool="remove" title="Bán lại 50% giá">Dỡ bỏ<small>hoàn 50%</small></button>';
}

function setTool(tool) {
  view.tool = view.tool === tool ? null : tool;
  if (view.tool) view.selectedId = null;
  document.querySelectorAll('[data-tool]').forEach((b) => b.classList.toggle('active', b.dataset.tool === view.tool));
}

function projectHtml(p, offer) {
  const rows = Object.entries(offer ? Object.fromEntries(Object.entries(p.tasks).filter(([, v]) => v > 0).map(([k, v]) => [k, { need: v, done: 0 }])) : p.tasks)
    .map(([k, t]) => `<div class="taskrow"><span>${TASK_NAMES[k]}</span><div class="bar"><i style="width:${(Math.min(t.done, t.need) / t.need) * 100}%"></i></div><span>${offer ? fmt(t.need) : `${fmt(Math.min(t.done, t.need))}/${fmt(t.need)}`}</span></div>`).join('');
  let due = '';
  if (offer) due = `<span class="meta">${p.days} ngày</span>`;
  else {
    const left = p.deadlineDay - state.day;
    due = left < 0 ? '<span class="meta due late">Quá hạn</span>' : left === 0 ? '<span class="meta due soon">Hạn hôm nay</span>' : `<span class="meta due ${left <= 1 ? 'soon' : ''}">Còn ${left + 1} ngày</span>`;
  }
  return `<div class="proj"><div class="top"><span class="name">${p.name}</span>${due}</div>
    <div class="meta">${p.client} · Thưởng ${fmt(p.reward)}</div>${rows}
    ${offer ? `<button data-accept="${p.id}" ${state.projects.length >= ECONOMY.maxActiveProjects ? 'disabled' : ''}>Nhận dự án</button>` : ''}</div>`;
}

function refreshPanels() {
  if (!state) return;
  $('day').textContent = state.day;
  $('clock').textContent = sim.clockText(state);
  $('money').textContent = fmt(state.money);
  $('money').classList.toggle('neg', state.money < 0);
  document.querySelectorAll('[data-speed]').forEach((b) => b.classList.toggle('active', Number(b.dataset.speed) === state.speed));
  $('pausedTag').hidden = state.speed !== 0;
  $('mute').textContent = audio.isMuted() ? '🔇' : '🔊';

  $('projects').innerHTML = state.projects.map((p) => projectHtml(p, false)).join('') || '<p class="empty">Chưa có dự án. Nhận một dự án bên dưới.</p>';
  $('offers').innerHTML = state.offers.map((p) => projectHtml(p, true)).join('') || '<p class="empty">Ngày mai sẽ có lời mời mới.</p>';

  const e = state.employees.find((x) => x.id === view.selectedId);
  if (!e) { view.selectedId = null; $('info').innerHTML = '<p class="empty">Click vào một nhân viên để chọn.</p>'; }
  else {
    const work = sim.currentWork(state, e);
    const statusText = {
      idle: 'Đang rảnh', walking: 'Đang di chuyển', resting: 'Đang nghỉ trên sofa', exhausted: 'Kiệt sức, nghỉ đến hết ngày',
      working: work ? `Đang làm ${work.taskName}: ${work.project.name}` : 'Ngồi chờ việc (không có dự án hợp vai trò)',
    }[e.status];
    $('info').innerHTML = `<div class="emp-info">
      <div class="title">${e.name}<span class="role-tag" style="background:${ROLES[e.role].color}">${ROLES[e.role].name}</span></div>
      <div class="row"><span>Trạng thái</span><b>${statusText}</b></div>
      <div class="row"><span>Kỹ năng</span><b>${e.skill}/10</b></div>
      <div class="row"><span>Năng lượng</span><b>${Math.round(e.energy)}</b></div><div class="bar"><i style="width:${e.energy}%;background:${e.energy > 50 ? 'var(--good)' : e.energy > 25 ? 'var(--warn)' : 'var(--bad)'}"></i></div>
      <div class="row"><span>Hạnh phúc</span><b>${Math.round(e.happy)}</b></div><div class="bar"><i style="width:${e.happy}%;background:#e0619b"></i></div>
      <div class="row"><span>Lương</span><b>${fmt(e.salary)}/ngày</b></div>
      <div class="row"><span>Bàn</span><b>${e.deskId ? 'Đã có' : 'Chưa có'}</b></div>
      <div class="help">Click phải vào bàn, máy cà phê, sofa hoặc ô trống để ra lệnh.</div>
    </div>`;
  }

  let hint = '';
  if (view.tool === 'remove') hint = 'Click vào đồ vật để dỡ bỏ (hoàn 50%). Esc để hủy.';
  else if (view.tool) hint = `Click để đặt ${ITEMS[view.tool].name}. Esc để hủy.`;
  else if (e) hint = `Click phải để ra lệnh cho ${e.name}.`;
  $('hint').textContent = hint;
}

function toastEl(text, kind) {
  const el = document.createElement('div');
  el.className = `toast ${kind}`;
  el.textContent = text;
  $('toasts').appendChild(el);
  setTimeout(() => el.remove(), 2600);
  while ($('toasts').children.length > 4) $('toasts').firstChild.remove();
}

function flushEvents() {
  if (!state) return;
  for (const ev of state.events) {
    if (ev.type === 'toast') toastEl(ev.text, ev.kind);
    if (ev.type === 'sfx') audio.play(ev.name);
    if (ev.type === 'dayEnded') showReport();
  }
  state.events.length = 0;
}

// ---------- Chuột và phím ----------
function tileFromEvent(ev) {
  const r = canvas.getBoundingClientRect();
  const x = Math.floor(((ev.clientX - r.left) / r.width) * GRID.cols);
  const y = Math.floor(((ev.clientY - r.top) / r.height) * GRID.rows);
  return { x, y, fx: ((ev.clientX - r.left) / r.width) * GRID.cols - 0.5, fy: ((ev.clientY - r.top) / r.height) * GRID.rows - 0.5 };
}

canvas.addEventListener('mousemove', (ev) => { view.hover = tileFromEvent(ev); });
canvas.addEventListener('mouseleave', () => { view.hover = null; });
canvas.addEventListener('contextmenu', (ev) => ev.preventDefault());
canvas.addEventListener('mousedown', (ev) => {
  if (!state || state.phase !== 'playing') return;
  const t = tileFromEvent(ev);
  if (ev.button === 2) {
    if (view.tool) { setTool(null); refreshPanels(); return; }
    const e = state.employees.find((x) => x.id === view.selectedId);
    if (e) sim.commandEmployee(state, e, t.x, t.y);
  } else if (ev.button === 0) {
    if (view.tool === 'remove') sim.removeItemAt(state, t.x, t.y);
    else if (view.tool) sim.placeItem(state, view.tool, t.x, t.y);
    else {
      const hit = state.employees
        .map((e) => ({ e, d: Math.hypot(e.x - t.fx, e.y - t.fy) }))
        .filter((o) => o.d < 0.6).sort((a, b) => a.d - b.d)[0];
      view.selectedId = hit ? hit.e.id : null;
      if (hit) audio.play('click');
    }
  }
  flushEvents();
  refreshPanels();
});

document.addEventListener('keydown', (ev) => {
  if (!state || state.phase !== 'playing' || view.panel) return;
  if (ev.code === 'Space') { ev.preventDefault(); setSpeed(state.speed === 0 ? lastSpeed : 0); }
  else if (['Digit1', 'Digit2', 'Digit3'].includes(ev.code)) setSpeed(Number(ev.code.slice(-1)));
  else if (ev.code === 'Escape') { setTool(null); view.selectedId = null; }
  else if (ev.code === 'KeyM') audio.toggleMute();
  refreshPanels();
});

function setSpeed(s) {
  if (s > 0) lastSpeed = s;
  state.speed = s;
  audio.play('click');
}

$('speed').addEventListener('click', (ev) => { const b = ev.target.closest('[data-speed]'); if (b && state) { setSpeed(Number(b.dataset.speed)); refreshPanels(); } });
$('mute').addEventListener('click', () => { audio.toggleMute(); audio.startMusic(); refreshPanels(); });
$('toMenu').addEventListener('click', showMenu);
$('build').addEventListener('click', (ev) => { const b = ev.target.closest('[data-tool]'); if (b && state) { audio.play('click'); setTool(b.dataset.tool); refreshPanels(); } });
$('offers').addEventListener('click', (ev) => { const b = ev.target.closest('[data-accept]'); if (b && state) { sim.acceptOffer(state, Number(b.dataset.accept)); flushEvents(); refreshPanels(); } });
document.querySelector('#toolbar').addEventListener('click', (ev) => {
  const b = ev.target.closest('[data-panel]');
  if (!b || !state || state.phase !== 'playing') return;
  audio.play('click');
  if (b.dataset.panel === 'hire') showHire();
  if (b.dataset.panel === 'staff') showStaff();
  if (b.dataset.panel === 'help') showHelp();
});

// ---------- Vòng lặp ----------
let last = performance.now();
let uiTimer = 0;
function frame(now) {
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  if (state) {
    // Mở bảng (tuyển dụng, nhân sự…) thì game tạm ngưng
    if (!view.panel) sim.tick(state, dt);
    flushEvents();
    uiTimer += dt;
    if (uiTimer > 0.25) { uiTimer = 0; refreshPanels(); }
    render(g, state, view, now / 1000);
  } else {
    g.fillStyle = '#efe4d2'; g.fillRect(0, 0, canvas.width, canvas.height);
  }
  requestAnimationFrame(frame);
}

buildToolbar();
showMenu();
requestAnimationFrame(frame);

// Cho phép kiểm thử trên trình duyệt
window.__game = { get state() { return state; }, view };
