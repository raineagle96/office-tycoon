# Office Tycoon

Game mô phỏng quản lý văn phòng 2D (top-down), chạy trên trình duyệt. Chơi sandbox vô tận: tuyển và điều khiển nhân viên, nhận dự án, giữ công ty có lãi.

## Chạy game

Game dùng ES module nên cần một web server tĩnh (mở thẳng file `index.html` sẽ bị trình duyệt chặn):

```bash
python3 -m http.server 8000
# mở http://localhost:8000
```

Hoặc bật GitHub Pages cho repo (Settings → Pages → Deploy from branch `main`) để chơi online.

## Cách chơi

- **Click trái** vào nhân viên để chọn, **click phải** vào ô để ra lệnh: đi tới, ngồi vào bàn, uống cà phê, nằm sofa.
- Nhân viên ngồi ở ô ngay dưới bàn sẽ tự làm phần việc đúng vai trò (Developer: Code, Designer: Thiết kế, Tester: Test).
- Phím tắt: `Space` tạm dừng, `1` `2` `3` tốc độ, `Esc` hủy công cụ, `M` tắt tiếng.

## Cấu trúc

| File | Vai trò |
| --- | --- |
| `src/config.js` | Toàn bộ con số cân bằng game, đánh mã theo luật GR-xx trong SDD |
| `src/world.js` | Lưới văn phòng, kiểm tra đặt đồ, tìm đường A* |
| `src/sim.js` | Mô phỏng: thời gian, nhân viên, dự án, kinh tế (không phụ thuộc DOM) |
| `src/render.js` | Vẽ canvas |
| `src/audio.js` | Nhạc nền và hiệu ứng tổng hợp bằng Web Audio |
| `src/main.js` | Vòng lặp, chuột/phím, giao diện, lưu game |
| `test/sim.test.mjs` | Kiểm thử logic theo tiêu chí chấp nhận AC-01..AC-05 |

## Kiểm thử

```bash
node test/sim.test.mjs
```
