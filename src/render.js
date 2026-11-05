// Vẽ văn phòng top-down lên canvas bằng hình khối.
import { GRID, ITEMS, ROLES } from './config.js';
import { DOOR, deskSeat, canPlace, itemTiles } from './world.js';
import { currentWork } from './sim.js';

const T = GRID.tile;
const C = {
  floorA: '#efe4d2', floorB: '#e8dcc7', wall: '#5b4b3a', door: '#9fc3a8',
  desk: '#a5794f', deskTop: '#c19468', monitor: '#2c3340', screen: '#7fb3ff', chair: '#7b6f66',
  coffee: '#3d3d46', coffeeAccent: '#c9884f', plant: '#3f9a5a', pot: '#b86b45',
  sofa: '#6d8fc7', sofaDark: '#557ab3', ink: '#2b2622', select: '#ffb627',
  ok: 'rgba(63, 160, 90, 0.45)', bad: 'rgba(214, 69, 65, 0.45)',
};

function drawFloor(g) {
  for (let y = 0; y < GRID.rows; y++) for (let x = 0; x < GRID.cols; x++) {
    g.fillStyle = (x + y) % 2 ? C.floorA : C.floorB;
    g.fillRect(x * T, y * T, T, T);
  }
  g.fillStyle = C.door;
  g.fillRect(DOOR.x * T + 4, DOOR.y * T + T - 8, T - 8, 8);
  g.fillStyle = C.ink;
  g.font = '600 10px system-ui, sans-serif';
  g.textAlign = 'center';
  g.fillText('CỬA', DOOR.x * T + T / 2, DOOR.y * T + T - 12);
}

function drawItem(g, it, alpha = 1) {
  const def = ITEMS[it.type];
  const x = it.x * T, y = it.y * T, w = def.w * T, h = def.h * T;
  g.save();
  g.globalAlpha = alpha;
  if (it.type === 'desk') {
    const s = deskSeat(it);
    g.fillStyle = C.chair;
    g.beginPath(); g.arc(s.x * T + T / 2, s.y * T + T / 2 - 4, 9, 0, Math.PI * 2); g.fill();
    g.fillStyle = C.desk; g.fillRect(x + 2, y + 6, w - 4, h - 10);
    g.fillStyle = C.deskTop; g.fillRect(x + 4, y + 8, w - 8, h - 16);
    g.fillStyle = C.monitor; g.fillRect(x + w / 2 - 14, y + 10, 28, 14);
    g.fillStyle = C.screen; g.fillRect(x + w / 2 - 12, y + 12, 24, 10);
  } else if (it.type === 'coffee') {
    g.fillStyle = C.coffee; roundRect(g, x + 7, y + 5, w - 14, h - 10, 4); g.fill();
    g.fillStyle = C.coffeeAccent; g.fillRect(x + 13, y + 20, w - 26, 10);
    g.fillStyle = '#fff'; g.beginPath(); g.arc(x + w / 2, y + 13, 3, 0, Math.PI * 2); g.fill();
  } else if (it.type === 'plant') {
    g.fillStyle = C.pot; g.fillRect(x + 13, y + 24, 14, 11);
    g.fillStyle = C.plant;
    for (const [dx, dy, r] of [[0, -4, 9], [-7, 2, 7], [7, 2, 7]]) { g.beginPath(); g.arc(x + w / 2 + dx, y + 16 + dy, r, 0, Math.PI * 2); g.fill(); }
  } else if (it.type === 'sofa') {
    g.fillStyle = C.sofaDark; roundRect(g, x + 3, y + 4, w - 6, h - 8, 8); g.fill();
    g.fillStyle = C.sofa; roundRect(g, x + 8, y + 12, w - 16, h - 18, 5); g.fill();
  }
  g.restore();
}

function roundRect(g, x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
}

function drawEmployee(g, state, e, selected, time) {
  const cx = e.x * T + T / 2;
  let cy = e.y * T + T / 2;
  const walking = e.path.length > 0;
  if (walking) cy += Math.sin(time * 14 + e.id) * 1.5;
  const color = ROLES[e.role].color;
  if (selected) {
    g.strokeStyle = C.select; g.lineWidth = 3;
    g.beginPath(); g.arc(cx, cy, 16, 0, Math.PI * 2); g.stroke();
  }
  // thân + đầu
  g.fillStyle = 'rgba(0,0,0,0.15)';
  g.beginPath(); g.ellipse(cx, cy + 12, 11, 4, 0, 0, Math.PI * 2); g.fill();
  g.fillStyle = color;
  g.beginPath(); g.arc(cx, cy + 2, 11, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#f2c9a0';
  g.beginPath(); g.arc(cx, cy - 6, 7, 0, Math.PI * 2); g.fill();
  if (e.status === 'working' && currentWork(state, e)) {
    // tay gõ phím
    const k = Math.sin(time * 20 + e.id) > 0 ? 1 : -1;
    g.fillStyle = '#f2c9a0';
    g.fillRect(cx - 9, cy - 16 + k, 4, 4); g.fillRect(cx + 5, cy - 16 - k, 4, 4);
  }
  // biểu tượng trạng thái
  let icon = null;
  if (e.status === 'exhausted') icon = { bg: '#d64541', t: 'z' };
  else if (e.energy < 30) icon = { bg: '#e8a33d', t: '!' };
  else if (e.happy >= 75) icon = { bg: '#3fa05a', t: '♥' };
  else if (e.happy < 30) icon = { bg: '#7a6f9b', t: '☹' };
  else if (e.status === 'working' && !currentWork(state, e)) icon = { bg: '#8a8a8a', t: '…' };
  if (icon) {
    g.fillStyle = icon.bg;
    g.beginPath(); g.arc(cx + 12, cy - 16, 7, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#fff'; g.font = '700 10px system-ui, sans-serif'; g.textAlign = 'center';
    g.fillText(icon.t, cx + 12, cy - 12.5);
  }
  // thanh năng lượng
  g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(cx - 12, cy + 16, 24, 3);
  g.fillStyle = e.energy > 50 ? '#3fa05a' : e.energy > 25 ? '#e8a33d' : '#d64541';
  g.fillRect(cx - 12, cy + 16, 24 * (e.energy / 100), 3);
  // tên
  g.fillStyle = C.ink; g.font = '600 10px system-ui, sans-serif'; g.textAlign = 'center';
  g.fillText(e.name, cx, cy + 28);
}

export function render(g, state, view, time) {
  g.clearRect(0, 0, GRID.cols * T, GRID.rows * T);
  drawFloor(g);
  for (const it of state.items) drawItem(g, it);

  // đường đi của nhân viên được chọn
  const sel = state.employees.find((e) => e.id === view.selectedId);
  if (sel && sel.path.length) {
    g.strokeStyle = 'rgba(255, 182, 39, 0.7)'; g.lineWidth = 2; g.setLineDash([4, 4]);
    g.beginPath(); g.moveTo(sel.x * T + T / 2, sel.y * T + T / 2);
    for (const p of sel.path) g.lineTo(p.x * T + T / 2, p.y * T + T / 2);
    g.stroke(); g.setLineDash([]);
  }
  if (sel?.deskId) {
    const d = state.items.find((i) => i.id === sel.deskId);
    if (d) { g.strokeStyle = C.select; g.lineWidth = 2; g.strokeRect(d.x * T + 1, d.y * T + 1, ITEMS.desk.w * T - 2, T - 2); }
  }

  const sorted = [...state.employees].sort((a, b) => a.y - b.y);
  for (const e of sorted) drawEmployee(g, state, e, e.id === view.selectedId, time);

  // xem trước khi xây
  if (view.hover && view.tool && view.tool !== 'remove') {
    const ghost = { type: view.tool, x: view.hover.x, y: view.hover.y };
    const ok = !canPlace(state, view.tool, ghost.x, ghost.y) && state.money >= ITEMS[view.tool].price;
    drawItem(g, ghost, 0.6);
    g.fillStyle = ok ? C.ok : C.bad;
    for (const t of itemTiles(ghost)) g.fillRect(t.x * T, t.y * T, T, T);
    if (view.tool === 'plant') {
      g.strokeStyle = 'rgba(63,154,90,0.6)'; g.setLineDash([3, 3]);
      g.strokeRect((ghost.x - 2) * T, (ghost.y - 2) * T, 5 * T, 5 * T); g.setLineDash([]);
    }
  } else if (view.hover && view.tool === 'remove') {
    g.strokeStyle = '#d64541'; g.lineWidth = 2; g.strokeRect(view.hover.x * T + 1, view.hover.y * T + 1, T - 2, T - 2);
  } else if (view.hover && sel) {
    g.strokeStyle = 'rgba(255,182,39,0.8)'; g.lineWidth = 1.5;
    g.strokeRect(view.hover.x * T + 2, view.hover.y * T + 2, T - 4, T - 4);
  }
}
