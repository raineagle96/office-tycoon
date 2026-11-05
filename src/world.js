// Lưới văn phòng: đặt đồ vật, kiểm tra ô đi được, tìm đường A*.
import { GRID, ITEMS } from './config.js';

export const DOOR = { x: Math.floor(GRID.cols / 2), y: GRID.rows - 1 };

export const inBounds = (x, y) => x >= 0 && y >= 0 && x < GRID.cols && y < GRID.rows;

export function itemTiles(item) {
  const def = ITEMS[item.type];
  const tiles = [];
  for (let dx = 0; dx < def.w; dx++) for (let dy = 0; dy < def.h; dy++) tiles.push({ x: item.x + dx, y: item.y + dy });
  return tiles;
}

// Ô ghế của bàn: ngay dưới ô trái của bàn.
export const deskSeat = (desk) => ({ x: desk.x, y: desk.y + 1 });

export function itemAt(items, x, y) {
  return items.find((it) => itemTiles(it).some((t) => t.x === x && t.y === y)) || null;
}

export function buildBlockMap(items) {
  const blocked = new Set();
  for (const it of items) if (ITEMS[it.type].solid) for (const t of itemTiles(it)) blocked.add(t.y * GRID.cols + t.x);
  return blocked;
}

export const isWalkable = (blocked, x, y) => inBounds(x, y) && !blocked.has(y * GRID.cols + x);

// Kiểm tra mọi ô trống còn nối với cửa (GR-08: không chặn lối đi).
function allConnected(blocked) {
  const seen = new Set([DOOR.y * GRID.cols + DOOR.x]);
  const queue = [DOOR];
  while (queue.length) {
    const c = queue.shift();
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = c.x + dx, ny = c.y + dy, k = ny * GRID.cols + nx;
      if (isWalkable(blocked, nx, ny) && !seen.has(k)) { seen.add(k); queue.push({ x: nx, y: ny }); }
    }
  }
  let free = 0;
  for (let y = 0; y < GRID.rows; y++) for (let x = 0; x < GRID.cols; x++) if (!blocked.has(y * GRID.cols + x)) free++;
  return seen.size === free;
}

// Trả về null nếu đặt được, hoặc lý do không đặt được.
export function canPlace(state, type, x, y) {
  const def = ITEMS[type];
  const cand = { type, x, y };
  const tiles = itemTiles(cand);
  const seats = state.items.filter((i) => i.type === 'desk').map(deskSeat);
  for (const t of tiles) {
    if (!inBounds(t.x, t.y)) return 'Ra ngoài văn phòng';
    if (itemAt(state.items, t.x, t.y)) return 'Ô đã có đồ';
    if (t.x === DOOR.x && t.y === DOOR.y) return 'Không được chặn cửa';
    if (seats.some((s) => s.x === t.x && s.y === t.y)) return 'Đây là chỗ ngồi của bàn';
    if (def.solid && state.employees.some((e) => Math.round(e.x) === t.x && Math.round(e.y) === t.y)) return 'Có nhân viên đang đứng';
  }
  if (type === 'desk') {
    const s = deskSeat(cand);
    if (!inBounds(s.x, s.y)) return 'Bàn cần chỗ ngồi phía dưới';
    const occ = itemAt(state.items, s.x, s.y);
    if (occ && ITEMS[occ.type].solid) return 'Chỗ ngồi bị chặn';
    if (s.x === DOOR.x && s.y === DOOR.y) return 'Không được chặn cửa';
  }
  if (def.solid) {
    const blocked = buildBlockMap(state.items);
    for (const t of tiles) blocked.add(t.y * GRID.cols + t.x);
    if (!allConnected(blocked)) return 'Sẽ chặn lối đi';
  }
  return null;
}

// A* 4 hướng. Trả về danh sách ô (không gồm ô xuất phát) hoặc null.
export function findPath(blocked, from, to) {
  const sx = Math.round(from.x), sy = Math.round(from.y);
  if (!isWalkable(blocked, to.x, to.y)) return null;
  const key = (x, y) => y * GRID.cols + x;
  const h = (x, y) => Math.abs(x - to.x) + Math.abs(y - to.y);
  const open = [{ x: sx, y: sy, g: 0, f: h(sx, sy) }];
  const came = new Map();
  const gScore = new Map([[key(sx, sy), 0]]);
  const closed = new Set();
  while (open.length) {
    let bi = 0;
    for (let i = 1; i < open.length; i++) if (open[i].f < open[bi].f) bi = i;
    const cur = open.splice(bi, 1)[0];
    const ck = key(cur.x, cur.y);
    if (cur.x === to.x && cur.y === to.y) {
      const path = [];
      let k = ck;
      while (came.has(k)) { path.unshift({ x: k % GRID.cols, y: Math.floor(k / GRID.cols) }); k = came.get(k); }
      return path;
    }
    if (closed.has(ck)) continue;
    closed.add(ck);
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = cur.x + dx, ny = cur.y + dy, nk = key(nx, ny);
      if (!isWalkable(blocked, nx, ny) || closed.has(nk)) continue;
      const g = cur.g + 1;
      if (g < (gScore.get(nk) ?? Infinity)) {
        gScore.set(nk, g);
        came.set(nk, ck);
        open.push({ x: nx, y: ny, g, f: g + h(nx, ny) });
      }
    }
  }
  return null;
}

// Ô đi được kề bên một đồ vật (để dùng máy cà phê), gần vị trí `from` nhất.
export function adjacentFreeTile(blocked, item, from) {
  const opts = [];
  for (const t of itemTiles(item)) {
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = t.x + dx, ny = t.y + dy;
      if (isWalkable(blocked, nx, ny)) opts.push({ x: nx, y: ny });
    }
  }
  opts.sort((a, b) => Math.abs(a.x - from.x) + Math.abs(a.y - from.y) - (Math.abs(b.x - from.x) + Math.abs(b.y - from.y)));
  return opts[0] || null;
}
