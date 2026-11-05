// Mọi con số cân bằng game nằm ở đây, đánh mã theo SDD (GR-xx) để dễ đối chiếu.

export const GRID = { cols: 20, rows: 15, tile: 40 }; // GR-08

export const TIME = {
  realSecondsPerDay: 120, // GR-01: 1 ngày game = 2 phút thật ở tốc độ x1
  startHour: 8,
  endHour: 17,
  speeds: [0, 1, 2, 3],
};

export const START = { money: 10000, staff: 2, desks: 3 };

export const ENERGY = {
  max: 100,
  workDrainPerHour: 10, // GR-03
  coffeeBoost: 30, // GR-03
  coffeeCooldownHours: 1,
  sofaRestPerHour: 25,
  idleRestPerHour: 4,
  overnightRecover: 60,
};

export const HAPPY = {
  max: 100,
  exhaustedPenalty: 20, // GR-04
  plantRadius: 2,
  plantPerHour: 1.5,
  lowEnergyDrainPerHour: 2, // khi năng lượng < 30
  quitThreshold: 20, // GR-05
  quitDays: 3,
};

export const ECONOMY = {
  rentPerDay: 500,
  bankruptDays: 3, // tiền âm 3 ngày liên tiếp
  lateRewardRate: 0.5, // GR-06
  hireFeeDays: 1, // GR-09: phí tuyển = 1 ngày lương
  candidatesPerDay: 3,
  maxActiveProjects: 3,
  offersPerDay: 2,
};

// GR-02: điểm/giờ = WORK_RATE × kỹ năng × (năng lượng / 100)
export const WORK_RATE = 4;

export const ROLES = {
  dev: { name: 'Developer', task: 'code', color: '#4f7cff', baseSalary: 300 },
  designer: { name: 'Designer', task: 'design', color: '#e0619b', baseSalary: 250 },
  tester: { name: 'Tester', task: 'test', color: '#2fa36b', baseSalary: 200 },
};

export const TASK_NAMES = { design: 'Thiết kế', code: 'Code', test: 'Test' };

export const ITEMS = {
  desk: { name: 'Bàn làm việc', w: 2, h: 1, price: 500, solid: true, desc: 'Nhân viên ngồi ở ô ngay dưới bàn để làm việc' },
  coffee: { name: 'Máy pha cà phê', w: 1, h: 1, price: 800, solid: true, desc: '+30 năng lượng, đứng cạnh máy để dùng' },
  plant: { name: 'Cây xanh', w: 1, h: 1, price: 100, solid: true, desc: '+Hạnh phúc trong bán kính 2 ô' },
  sofa: { name: 'Sofa nghỉ', w: 2, h: 1, price: 600, solid: false, desc: 'Ngồi lên để hồi năng lượng nhanh' },
};

export const PROJECT_TEMPLATES = [
  { name: 'Website bán hàng', client: 'Công ty A', tasks: { design: 100, code: 300, test: 80 }, days: 5, reward: 5000 },
  { name: 'Landing page khuyến mãi', client: 'Shop B', tasks: { design: 80, code: 120, test: 40 }, days: 3, reward: 2600 },
  { name: 'App đặt lịch', client: 'Phòng khám C', tasks: { design: 150, code: 420, test: 140 }, days: 7, reward: 8200 },
  { name: 'Trang quản trị nội bộ', client: 'Công ty D', tasks: { design: 60, code: 350, test: 120 }, days: 6, reward: 6000 },
  { name: 'Bộ nhận diện thương hiệu', client: 'Quán E', tasks: { design: 220, code: 0, test: 30 }, days: 4, reward: 3200 },
  { name: 'Sửa lỗi hệ thống', client: 'Ngân hàng F', tasks: { design: 0, code: 160, test: 160 }, days: 3, reward: 3400 },
];

export const NAMES = [
  'An', 'Bình', 'Chi', 'Dũng', 'Giang', 'Hà', 'Hải', 'Hiếu', 'Hoa', 'Huy', 'Khánh', 'Lan',
  'Linh', 'Long', 'Mai', 'Minh', 'Nam', 'Ngọc', 'Phong', 'Phúc', 'Quân', 'Sơn', 'Tâm', 'Thảo',
  'Trang', 'Trung', 'Tú', 'Vân', 'Việt', 'Yến',
];
