// === 🧪 DEBUG: รันตรงนี้เพื่อดูข้อมูลทั้งหมดในชีต ===
// ไปที่ Apps Script → เลือกฟังก์ชันนี้ → กด ▶ รัน (Run)
function debugShowAllData() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  const sheets = [
    { name: "พนักงาน", filter: null },
    { name: "เวลางาน", filter: null },
    { name: "คำขอลา", filter: null },
    { name: "บันทึกเบิกเงินกลางเดือน", filter: null },
    { name: "สลิปเงินเดือน", filter: null },
    { name: "คำขอแก้ไขเวลา", filter: null }
  ];

  sheets.forEach(({ name }) => {
    const sheet = ss.getSheetByName(name);
    if (!sheet) {
      Logger.log(`❌ ชีต "${name}" ไม่มีในสมุดงานนี้`);
      return;
    }
    const rows = sheet.getDataRange().getValues();
    Logger.log(`\n========== ${name} ==========`);
    Logger.log(`จำนวน rows (รวม header): ${rows.length}`);
    if (rows.length > 0) {
      Logger.log(`Headers: ${JSON.stringify(rows[0])}`);
    }
    if (rows.length > 1) {
      // แสดง 5 rows แรก (หลัง header)
      const sampleRows = rows.slice(1, Math.min(6, rows.length));
      sampleRows.forEach((row, idx) => {
        // ตัด empty rows
        const nonEmpty = row.filter(cell => cell !== "" && cell !== null);
        if (nonEmpty.length > 0) {
          Logger.log(`Row ${idx + 2}: ${JSON.stringify(row)}`);
        }
      });
    }
  });
}

// === 🧪 DEBUG: ดูข้อมูลพนักงานเฉพาะคน ===
function debugGetEmployee(empId) {
  const result = getEmployeeData(empId || "EMP001");
  Logger.log(JSON.stringify(result, null, 2));
}

// === 🧪 DEBUG: ดูข้อมูลเวลางาน (filter เฉพาะ empId) ===
// Usage: debugGetTimeRecords("102003")  → เฉพาะคน (default: 102003)
function debugGetTimeRecords(empId) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName("เวลางาน");
  if (!sheet) { Logger.log("❌ ชีต เวลางาน ไม่มี"); return; }
  const rows = sheet.getDataRange().getValues();
  // Default to 102003 if no argument
  const target = (empId || "102003").toString().trim();
  Logger.log(`\n========== เวลางาน (${rows.length - 1} รายการ) ==========`);
  Logger.log("Header: " + JSON.stringify(rows[0]));
  Logger.log(`🔍 Filter: emp = ${target}`);
  let matchCount = 0;
  rows.slice(1).forEach((row, i) => {
    if (row[3].toString() !== target) return;
    matchCount++;
    Logger.log(`[${i + 2}] วันที่=${row[0]} | เข้า=${row[1]} | ออก=${row[2]} | สถานะ=${row[12]}`);
  });
  Logger.log(`📊 รวม ${matchCount} รายการ (emp ${target})`);
}

// === 🧪 DEBUG: ดูข้อมูลการลาทั้งหมด ===
function debugGetLeaveRequests() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName("คำขอลา");
  if (!sheet) { Logger.log("❌ ชีต คำขอลา ไม่มี"); return; }
  const rows = sheet.getDataRange().getValues();
  Logger.log(`\n========== คำขอลา (${rows.length - 1} รายการ) ==========`);
  Logger.log("Header: " + JSON.stringify(rows[0]));
  rows.slice(1).forEach((row, i) => {
    if (row.filter(c => c !== "").length > 0) {
      Logger.log(`[${i + 1}] ${JSON.stringify(row)}`);
    }
  });
}

// === 🧪 DEBUG: ดูว่าชีตไหนมีบ้าง ===
function debugListSheets() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheets = ss.getSheets();
  Logger.log("ชีตทั้งหมดในสมุดงานนี้:");
  sheets.forEach(s => {
    const rows = s.getDataRange().getValues();
    Logger.log(` - ${s.getName()} (${rows.length} rows)`);
  });
}

// ═══════════════════════════════════════════════════════════════════════
// HRBTC - Google Apps Script Backend v2
// Supports: attendance, leave, advance salary, payslips + accounting period filter
// ═══════════════════════════════════════════════════════════════════════

// ─── [DEFAULT SYSTEM SETTINGS] ─────────────────────────────
const DEFAULT_SYSTEM_SETTINGS = {
  dailyDivisor: 30,
  workHoursPerDay: 8,
  workStartTimeStr: '08:00',
  workEndTimeStr: '17:00',
  lateCutoffTimeStr: '08:15',
  otStartTimeStr: '17:15',
  defaultOtRate: 1.0,
  billingCycleStartDay: 26,
  billingCycleEndDay: 25,
  lunchStartTimeStr: '12:00',
  lunchEndTimeStr: '13:00',
  halfDayOutLunchMinStr: '12:00',
  halfDayOutLunchMaxStr: '13:30',
  halfDayInLunchMinStr: '11:30',
  halfDayInLunchMaxStr: '13:30',
  otIntervalMinutes: 30,
  otIntervalValue: 0.5,
  defaultCentralProject: '(00)บุรีรัมย์',
  defaultFoodAllowance: 50,
  latePenaltyPerMinute: 1.0,
  lateHalfDayThreshold: 240,
  ssoRate: 0.05,
  ssoMinSalary: 1650,
  ssoMaxSalary: 17500,
  includeOTinSSO: false,
  holidayOtRate: 2.0,
  holidayWorkRate: 1.0,
  // Leave entitlements
  annualLeaveDays: 10,
  sickLeaveDays: 30,
  personalLeaveDays: 3,
  maternityLeaveDays: 90,
  maternityLeavePaid: 45,
  militaryLeaveDays: 60,
  leaveAccrualRate: 0.0833,
  leaveCutoff: '25/12',
  symbolRules: {
    'W': { fillIn: '08:00', fillOut: '17:00' },
    'L': { fillIn: '08:00', fillOut: '17:00' }, // L = มาสาย (Late)
    'A': { clearIn: true, clearOut: true },
    'B': { clearIn: true, clearOut: true },
    'H': { clearIn: true, clearOut: true },
    'S': { clearIn: true, clearOut: true },
    'SM': { clearIn: true, clearOut: true },
    'A½': { fillIn: '13:00', fillOut: '17:00' },
    'P½': { fillIn: '08:00', fillOut: '12:00' },
    'พร': { fillIn: '08:00', fillOut: '17:00' },
    'คส': { clearIn: true, clearOut: true }
  },
  roundSalary: 'none',
  roundDiligent: 'none',
  roundTax: 'none',
  roundPenalty: 'none',
  roundSSO: 'down',
  roundNetPay: 'down',
  roundProvidentFund: 'none',
  roundWelfare: 'none'
};

// ─── [GLOBAL STATUS CONFIG] ────────────────────────────────
const GLOBAL_STATUS_CONFIG = {
  'W':  { label: 'ทำงานปกติ', icon: '💼', lucide: 'briefcase',      bgColor: 'bg-[#DCFCE7]', textColor: 'text-[#166534]', accentHex: '#166534', badgeClass: 'badge-work',    category: 'work' },
  'L':  { label: 'มาสาย',      icon: '⏱️', lucide: 'clock',         bgColor: 'bg-[#FEF3C7]', textColor: 'text-[#92400E]', accentHex: '#92400E', badgeClass: 'badge-late',    category: 'work' },
  'A':  { label: 'ขาดงาน',     icon: '❌', lucide: 'x-circle',       bgColor: 'bg-rose-50',   textColor: 'text-rose-500',  accentHex: '#f43f5e', badgeClass: 'badge-absent',  category: 'absent' },
  'B+': { label: 'ลากิจ (+)',  icon: '📋', lucide: 'clipboard-list', bgColor: 'bg-violet-50', textColor: 'text-violet-700', accentHex: '#7c3aed', badgeClass: 'badge-leave',   category: 'leave' },
  'B-': { label: 'ลากิจ (-)',  icon: '📋', lucide: 'clipboard-list', bgColor: 'bg-rose-50',   textColor: 'text-rose-500',  accentHex: '#f43f5e', badgeClass: 'badge-absent',  category: 'absent' },
  'H+': { label: 'ลาพักร้อน (+)', icon: '🏖️', lucide: 'palmtree',    bgColor: 'bg-sky-50',    textColor: 'text-sky-700',    accentHex: '#0284c7', badgeClass: 'badge-leave',   category: 'leave' },
  'H-': { label: 'ลาพักร้อน (-)', icon: '🏖️', lucide: 'palmtree',    bgColor: 'bg-rose-50',   textColor: 'text-rose-500',  accentHex: '#f43f5e', badgeClass: 'badge-absent',  category: 'absent' },
  'S+': { label: 'ลาป่วย (+)', icon: '🏥', lucide: 'thermometer',    bgColor: 'bg-[#F3E8FF]', textColor: 'text-[#6B21A8]', accentHex: '#6B21A8', badgeClass: 'badge-leave',   category: 'leave' },
  'S-': { label: 'ลาป่วย (-)', icon: '🏥', lucide: 'thermometer',    bgColor: 'bg-rose-50',   textColor: 'text-rose-500',  accentHex: '#f43f5e', badgeClass: 'badge-absent',  category: 'absent' },
  'SM+':{ label: 'ลาป่วย+ใบรับรอง', icon: '📄', lucide: 'file-text', bgColor: 'bg-[#F3E8FF]', textColor: 'text-[#6B21A8]', accentHex: '#6B21A8', badgeClass: 'badge-leave',   category: 'leave' },
  'A½': { label: 'ลาครึ่งเช้า', icon: '⛅', lucide: 'sun',           bgColor: 'bg-orange-50', textColor: 'text-orange-600', accentHex: '#ea580c', badgeClass: 'badge-leave',   category: 'leave' },
  'P½': { label: 'ลาครึ่งบ่าย', icon: '🌤️', lucide: 'cloud-sun',    bgColor: 'bg-blue-50',   textColor: 'text-blue-600',  accentHex: '#2563eb', badgeClass: 'badge-leave',   category: 'leave' },
  'พร': { label: 'เพิ่มแรง',    icon: '💪', lucide: 'zap',           bgColor: 'bg-[#DBEAFE]', textColor: 'text-[#1E40AF]', accentHex: '#1E40AF', badgeClass: 'badge-work',    category: 'special' },
  'คส': { label: 'สวัสดิการ',   icon: '🎁', lucide: 'gift',          bgColor: 'bg-indigo-50', textColor: 'text-indigo-700', accentHex: '#4f46e5', badgeClass: 'badge-work',    category: 'special' },
  'ย':  { label: 'วันหยุดประจำสัปดาห์', icon: '⛱️', lucide: 'coffee', bgColor: 'bg-[#FFF1F2]', textColor: 'text-[#BE123C]', accentHex: '#BE123C', badgeClass: 'badge-rest',  category: 'off' },
  'นข':{ label: 'วันหยุดนักขัตฤกษ์', icon: '🗓️', lucide: 'calendar', bgColor: 'bg-[#FEF9C3]', textColor: 'text-[#854D0E]', accentHex: '#854D0E', badgeClass: 'badge-rest',  category: 'off' },
  'MI': { label: 'ลืมลงเวลาเข้า (MI)', icon: '⚠️', lucide: 'alert-triangle', bgColor: 'bg-orange-50', textColor: 'text-orange-600', accentHex: '#ea580c', badgeClass: 'badge-late', category: 'absent' },
  'MO': { label: 'ลืมลงเวลาออก (MO)', icon: '⚠️', lucide: 'alert-triangle', bgColor: 'bg-orange-50', textColor: 'text-orange-600', accentHex: '#ea580c', badgeClass: 'badge-late', category: 'absent' },
  RAW_MAP: {
    '1': 'W', 'W': 'W', '✓': 'W', 'ปกติ (W)': 'W', 'ปกติ': 'W',
    '3': 'L', 'L': 'L', 'สาย': 'L', 'สาย (L)': 'L',
    '0': 'A', 'A': 'A', 'ขาด': 'A', 'ขาดงาน': 'A',
    '2': 'B+', 'B': 'B+', 'B+': 'B+', 'กิจ': 'B+', 'ลากิจ': 'B+', 'ลา': 'B+',
    'B-': 'B-', 'ลากิจ (-)': 'B-', 'ลากิจไม่รับค่าจ้าง': 'B-', 'ลากิจ (ไม่รับค่าจ้าง)': 'B-', 'ลากิจเกินสิทธิ์': 'B-', 'ลากิจ (เกินสิทธิ์)': 'B-',
    'H': 'H+', 'H+': 'H+', 'ลาพักร้อน': 'H+',
    'H-': 'H-', 'ลาพักร้อน (-)': 'H-', 'ลาพักร้อนไม่รับค่าจ้าง': 'H-', 'ลาพักร้อน (ไม่รับค่าจ้าง)': 'H-', 'ลาพักร้อนเกินสิทธิ์': 'H-', 'ลาพักร้อน (เกินสิทธิ์)': 'H-',
    'S': 'S+', 'S+': 'S+', 'ลาป่วย': 'S+',
    'S-': 'S-', 'ลาป่วย (-)': 'S-', 'ลาป่วยไม่รับค่าจ้าง': 'S-', 'ลาป่วย (ไม่รับค่าจ้าง)': 'S-', 'ลป่วยเกินสิทธิ์': 'S-', 'ลาป่วย (เกินสิทธิ์)': 'S-',
    'SM': 'SM+', 'SM+': 'SM+', 'ลาป่วย+ใบรับรอง': 'SM+', 'ลาป่วย+ใบรับรองแพทย์': 'SM+',
    'ลาเกินสิทธิ์': 'A', 'ลาไม่รับค่าจ้าง': 'A',
    'A½': 'A½', 'A?': 'A½',
    'P½': 'P½', 'P?': 'P½',
    '5': 'พร', 'พร': 'พร', 'พร½': 'พร½',
    '6': 'คส', 'คส': 'คส',
    'ย': 'ย',
    'นข': 'นข',
    'MI': 'MI', 'ลืมเข้า': 'MI', 'ลงเวลาไม่สมบูรณ์': 'MI', 'ลืมบันทึกเข้า': 'MI',
    'MO': 'MO', 'ลืมออก': 'MO', 'ลืมบันทึกออก': 'MO'
  }
};

// ─── [LEAVE SYSTEM TYPES] ────────────────────────────────
const LEAVE_TYPES = ['ลาป่วย', 'ลากิจ', 'ลาพักร้อน', 'ลาคลอดบุตร', 'ลาเพื่อทำหมัน', 'ลาเพื่อรับราชการทหาร', 'ลาอื่นๆ'];

// ─── [UI CONSTANTS] ─────────────────────────────────────
const MONTH_NAMES = ['มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน','กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม'];
const STATUS_LEGEND_ORDER = ['W','L','A','B+','B-','H+','H-','S+','S-','SM+','A½','P½','พร','คส','ย'];

// ─── [SYSTEM SETTINGS SCHEMA] ───────────────────────────
// Key = ชื่อ row ในชีต "ตั้งค่าระบบ", Default = ค่าเริ่มต้น
// ใช้งานอยู่ = "default" (ใช้ค่า default) หรือ "custom" (ใช้ค่าในคอลัมน์ "ใช้งานอยู่")
const SYSTEM_SETTINGS_SCHEMA = {
  // ── Time基准 ──
  dailyDivisor:          { label: 'ตัวหารค่าแรง/วัน',              default: 30,        group: 'time基準' },
  workHoursPerDay:       { label: 'ชั่วโมงทำงาน/วัน',              default: 8,         group: 'time基準' },
  workStartTimeStr:      { label: 'เวลาเริ่มงาน',                  default: '08:00',   group: 'time基準' },
  workEndTimeStr:        { label: 'เวลาเลิกงาน',                   default: '17:00',   group: 'time基准' },
  lateCutoffTimeStr:     { label: 'เวลาตัดสาย (เริ่มนับสาย)',     default: '08:15',   group: 'time基準' },
  otStartTimeStr:        { label: 'เวลาเริ่มคิด OT',               default: '17:15',   group: 'time基準' },
  defaultOtRate:         { label: 'อัตรา OT ปกติ (เท่า)',          default: 1.5,      group: 'time基準' },
  // ── Accounting period ──
  billingCycleStartDay:  { label: 'วันเริ่มรอบบัญชี (วันที่)',     default: 26,        group: 'accounting' },
  billingCycleEndDay:    { label: 'วันสิ้นสุดรอบบัญชี (วันที่)',   default: 25,        group: 'accounting' },
  // ── Lunch / half-day ──
  lunchStartTimeStr:     { label: 'เวลาเริ่มพักเที่ยง',           default: '12:00',   group: 'lunch' },
  lunchEndTimeStr:       { label: 'เวลาสิ้นสุดพักเที่ยง',          default: '13:00',   group: 'lunch' },
  halfDayOutLunchMinStr: { label: 'ลาครึ่งบ่าย (ออกขั้นต่ำ)',      default: '12:00',   group: 'lunch' },
  halfDayOutLunchMaxStr: { label: 'ลาครึ่งบ่าย (ออกขั้นสูง)',      default: '13:30',   group: 'lunch' },
  halfDayInLunchMinStr:  { label: 'ลาครึ่งเช้า (เข้าขั้นต่ำ)',      default: '11:30',   group: 'lunch' },
  halfDayInLunchMaxStr:  { label: 'ลาครึ่งเช้า (เข้าขั้นสูง)',      default: '13:30',   group: 'lunch' },
  // ── OT intervals ──
  otIntervalMinutes:     { label: 'OT ขั้นต่ำ (นาที)',              default: 30,         group: 'ot' },
  otIntervalValue:      { label: 'OT คิดทีละ (ชั่วโมง)',          default: 0.5,       group: 'ot' },
  // ── Defaults ──
  defaultCentralProject: { label: 'โครงการกลางเริ่มต้น',           default: '(00)บุรีรัมย์', group: 'defaults' },
  defaultFoodAllowance:  { label: 'ค่าอาหาร/วัน (บาท)',           default: 50,        group: 'defaults' },
  // ── Deduction ──
  latePenaltyPerMinute:  { label: 'หักสาย/นาที (บาท)',              default: 1.0,       group: 'deduction' },
  lateHalfDayThreshold:  { label: 'สายครึ่งวัน (นาที)',            default: 240,       group: 'deduction' },
  // ── SSO ──
  ssoRate:               { label: 'อัตราประกันสังคม (%)',           default: 0.05,      group: 'sso' },
  ssoMinSalary:         { label: 'SSO เบี้ยขั้นต่ำ',              default: 1650,      group: 'sso' },
  ssoMaxSalary:         { label: 'SSO เบี้ยเพดินสูง',              default: 17500,     group: 'sso' },
  includeOTinSSO:       { label: 'รวม OT ในฐาน SSO (จริง/เท็จ)',  default: false,     group: 'sso' },
  // ── Holiday rates ──
  holidayOtRate:        { label: 'อัตรา OT วันหยุด (เท่า)',        default: 2.0,       group: 'holiday' },
  holidayWorkRate:      { label: 'อัตราวันหยุดทำงาน (เท่า)',     default: 1.0,       group: 'holiday' },
  // ── Leave entitlements ──
  annualLeaveDays:      { label: 'สิทธิ์ลาพักร้อน (วัน/ปี)',       default: 10,        group: 'leave' },
  sickLeaveDays:        { label: 'สิทธิ์ลาป่วย (วัน/ปี)',          default: 30,        group: 'leave' },
  personalLeaveDays:    { label: 'สิทธิ์ลากิจ (วัน/ปี)',           default: 3,         group: 'leave' },
  maternityLeaveDays:  { label: 'สิทธิ์ลาคลอด (วัน)',             default: 90,        group: 'leave' },
  maternityLeavePaid:   { label: 'ลาคลอดรับค่าจ้าง (วัน)',        default: 45,        group: 'leave' },
  militaryLeaveDays:    { label: 'สิทธิ์ลาทหาร (วัน)',             default: 60,        group: 'leave' },
  leaveAccrualRate:     { label: 'อัตราสะสมวันลา (วัน/เดือน)',    default: 0.0833,    group: 'leave' },
  leaveCutoff:           { label: 'วันตัดสิทธิ์ลา (dd/MM)',        default: '25/12',   group: 'leave' },
  // ── Rounding ──
  roundSalary:          { label: 'ปัดเศษเงินเดือน',               default: 'none',    group: 'rounding' },
  roundDiligent:        { label: 'ปัดเศษเบี้ยขยัน',               default: 'none',    group: 'rounding' },
  roundTax:             { label: 'ปัดเศษภาษี',                    default: 'none',    group: 'rounding' },
  roundPenalty:         { label: 'ปัดเศษค่าปรับ',                  default: 'none',    group: 'rounding' },
  roundSSO:             { label: 'ปัดเศษ SSO',                     default: 'down',   group: 'rounding' },
  roundNetPay:          { label: 'ปัดเศษเงินสุทธิ',               default: 'down',   group: 'rounding' },
  roundProvidentFund:   { label: 'ปัดเศษกองทุนสำรองเลี้ยงชีพ',    default: 'none',    group: 'rounding' },
  roundWelfare:         { label: 'ปัดเศษสวัสดิการ',                default: 'none',    group: 'rounding' },
  // ── Symbol rules (stored as JSON string) ──
  symbolRules:          { label: 'กฎสรุปสถานะ (Symbol Rules)',     default: JSON.stringify(DEFAULT_SYSTEM_SETTINGS.symbolRules), group: 'symbol' }
};

// ─── [HELPER: Read system settings from sheet (with defaults)] ──
function getSystemSettings() {
  const defaults = {};
  for (let k in SYSTEM_SETTINGS_SCHEMA) {
    defaults[k] = SYSTEM_SETTINGS_SCHEMA[k].default;
  }

  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('ตั้งค่าระบบ');
    if (!sheet) return defaults;

    const rows = sheet.getDataRange().getValues();
    const overrides = {};
    for (let i = 1; i < rows.length; i++) {
      const key = (rows[i][0] || '').toString().trim();
      const mode = (rows[i][2] || '').toString().trim().toLowerCase();
      if (!key || mode !== 'custom') continue;

      let val = rows[i][1];
      // Parse typed values
      if (val === true || val === 'true' || val === 'จริง') val = true;
      else if (val === false || val === 'false' || val === 'เท็จ') val = false;
      else if (!isNaN(parseFloat(val))) val = parseFloat(val);

      overrides[key] = val;
    }
    return Object.assign({}, defaults, overrides);
  } catch (e) {
    Logger.log('[getSystemSettings] Error: ' + e);
    return defaults;
  }
}

// ตั้งชื่อโฟลเดอร์หลักที่จะเก็บรูปภาพและเอกสารใน Google Drive ของคุณ
const MAIN_FOLDER_NAME = "HRBTC_Uploads";

function doGet(e) {
  // ตรวจสอบและสร้างชีตฐานข้อมูลที่จำเป็นทั้งหมดก่อนทำงาน
  initializeDatabase();
  initSystemSettingsSheet(); // sync schema → sheet on every request

  const action = e.parameter.action;
  const empId = e.parameter.empId;

  // รับ parameter รอบบัญชี (format: yyyy-MM-dd)
  const periodStart = e.parameter.periodStart || null;
  const periodEnd = e.parameter.periodEnd || null;

  let responseData = { status: "error", message: "ไม่พบ Action ที่ระบุ" };

  try {
    if (action === "getEmployee") {
      responseData = getEmployeeData(empId);
    } else if (action === "getTimeRecords") {
      responseData = getTimeRecords(empId, null, null); // return all — frontend filters by date
    } else if (action === "getLeaveRequests") {
      responseData = getLeaveRequests(empId, null, null); // return all — frontend filters by date
    } else if (action === "getAdvanceRequests") {
      responseData = getAdvanceRequests(empId, null, null); // return all — frontend filters by date
    } else if (action === "getPayslips") {
      responseData = getPayslips(empId);
    } else if (action === "getTimeCorrections") {
      responseData = getTimeCorrections(empId, periodStart, periodEnd);

    // ── [ADMIN] ──────────────────────────────────────
    } else if (action === "getAllEmployees") {
      responseData = adminGetAllEmployees();
    } else if (action === "getSystemSettingsAll") {
      responseData = adminGetSystemSettings();
    } else if (action === "getAnnouncements") {
      responseData = adminGetAnnouncements();
    } else if (action === "getHolidays") {
      responseData = adminGetHolidays(e.parameter.year || null);
    } else if (action === "getAllLeaveRequests") {
      responseData = adminGetAllLeaveRequests(periodStart, periodEnd, e.parameter.status || null);
    } else if (action === "getAllTimeCorrections") {
      responseData = adminGetAllTimeCorrections(periodStart, periodEnd, e.parameter.status || null);
    } else if (action === "getAllAdvanceRequests") {
      responseData = adminGetAllAdvanceRequests(periodStart, periodEnd, e.parameter.status || null);
    } else if (action === "getAllTimeRecords") {
      responseData = adminGetAllTimeRecords(periodStart, periodEnd);
    }
  } catch (err) {
    responseData = { status: "error", message: err.toString() };
  }

  return ContentService.createTextOutput(JSON.stringify(responseData))
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  // ตรวจสอบและสร้างชีตฐานข้อมูลที่จำเป็นทั้งหมดก่อนทำงาน
  initializeDatabase();
  initSystemSettingsSheet(); // sync schema → sheet on every request

  let responseData = { status: "error", message: "ไม่พบฟังก์ชันที่ระบุ" };

  try {
    const jsonString = e.postData.contents;
    const data = JSON.parse(jsonString);
    const action = data.action;

    if (action === "registerAttendance") {
      responseData = registerAttendance(data);
    } else if (action === "submitTimeCorrection") {
      responseData = submitTimeCorrection(data);
    } else if (action === "submitLeave") {
      responseData = submitLeaveRequest(data);
    } else if (action === "submitAdvance") {
      responseData = submitAdvanceRequest(data);
    } else if (action === "uploadProfilePhoto") {
      responseData = uploadProfilePhoto(data);
    } else if (action === "uploadPayslipFile") {
      responseData = uploadPayslipFile(data);
    } else if (action === "importTimeRecords") {
      responseData = doImportTimeRecords(data);
    } else if (action === "syncSymbolRules") {
      responseData = syncSymbolRules();

    // ── [ADMIN] ──────────────────────────────────────
    } else if (action === "approveLeave") {
      responseData = adminApproveLeave(data);
    } else if (action === "approveTimeCorrection") {
      responseData = adminApproveTimeCorrection(data);
    } else if (action === "approveAdvance") {
      responseData = adminApproveAdvance(data);
    } else if (action === "postAnnouncement") {
      responseData = adminPostAnnouncement(data);
    } else if (action === "addHoliday") {
      responseData = adminAddHoliday(data);
    }
  } catch (err) {
    responseData = { status: "error", message: err.toString() };
  }

  return ContentService.createTextOutput(JSON.stringify(responseData))
    .setMimeType(ContentService.MimeType.JSON);
}

// === ฟังก์ชันสร้างโครงสร้างตารางฐานข้อมูลอัตโนมัติ ===
function initializeDatabase() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  const databaseSchema = {
    "พนักงาน": [
      "รหัสพนักงาน", "ชื่อ-นามสกุล", "ตำแหน่ง", "สถานะ", "วันหยุดประจําสัปดาห์",
      "ชื่อบริษัท", "วันที่เริ่มงาน", "เบอร์โทรศัพท์", "ที่อยู่", "เลขบัตรประชาชน",
      "วันเดือนปีเกิด", "ธนาคาร", "สาขาธนาคาร", "หมายเลขบัญชี", "ลิ้งภาพโปรไฟล์",
      "ฐานเงินเดือน", "ตัวหารค่าแรง", "ชั่วโมงทำงานต่อวัน", "ตัวคูณโอที",
      "สิทธิ์การใช้งาน", "LineUserId"
    ],
    "เวลางาน": [
      "วันที่", "เวลาเข้า", "เวลาออก", "รหัสพนักงาน", "แก้ไขเวลา", "แหล่งข้อมูล",
      "ละติจูด (เข้า)", "ลองจิจูด (เข้า)", "ละติจูด (ออก)", "ลองจิจูด (ออก)",
      "ภาพถ่าย", "วันที่บันทึก", "สถานะสรุป", "นาทีสาย", "ชั่วโมง OT",
      "ค่าข้าว", "เบี้ยเลี้ยง", "เบี้ยอื่นๆ", "โครงการ (เข้า)", "โครงการ (ออก)",
      "หมายเหตุ", "เอกสารแนบ"
    ],
    "คำขอแก้ไขเวลา": [
      "รหัสพนักงาน", "วันที่", "เวลาเข้าใหม่", "เวลาออกใหม่", "เหตุผล", "สถานะ",
      "โครงการ", "วันที่ส่ง", "วันที่อนุมัติ", "อนุมัติโดย", "หมายเหตุ"
    ],
    "คำขอลา": [
      "เลขที่เอกสาร", "รหัสพนักงาน", "ประเภทการลา", "วันที่เริ่ม", "วันที่สิ้นสุด",
      "จำนวนวัน", "เหตุผล", "สถานะ", "วันที่ส่ง", "วันที่อนุมัติ", "อนุมัติโดย",
      "หมายเหตุ", "ละติจูด", "ลองจิจูด", "ลายมือชื่อ", "เอกสารแนบ", "ขั้นตอนการอนุมัติ"
    ],
    "บันทึกเบิกเงินกลางเดือน": [
      "รหัสพนักงาน", "จำนวนเงิน", "วันที่เบิก", "รอบจ่าย", "สถานะ", "หมายเหตุ",
      "ช่องทางรับเงิน", "เบิกประจำ", "จำนวนครั้งที่แก้ไข"
    ],
    "สลิปเงินเดือน": [
      "รหัสพนักงาน", "รอบเงินเดือน", "ชื่อไฟล์", "ID ไฟล์", "URL สลิป", "วันที่บันทึก", "ยอดสุทธิ"
    ],
    "ตั้งค่าระบบ": [
      "Key", "Default", "ใช้งานอยู่", "คำอธิบาย"
    ]
  };

  for (let sheetName in databaseSchema) {
    let sheet = ss.getSheetByName(sheetName);
    if (!sheet) {
      sheet = ss.insertSheet(sheetName);
      const headers = databaseSchema[sheetName];
      sheet.appendRow(headers);

      const headerRange = sheet.getRange(1, 1, 1, headers.length);
      headerRange.setBackground("#0F172A");
      headerRange.setFontColor("#FFFFFF");
      headerRange.setFontWeight("bold");
      headerRange.setHorizontalAlignment("center");
      sheet.autoResizeColumns(1, headers.length);
    }
  }
}

// === ฟังก์ชันค้นหาหรือสร้างโฟลเดอร์ (ข้ามถังขยะ) ===
function getOrCreateFolder(folderName, parentFolder) {
  const target = parentFolder ? parentFolder : DriveApp;
  const folders = target.getFoldersByName(folderName);

  while (folders.hasNext()) {
    const folder = folders.next();
    if (!folder.isTrashed()) {
      return folder;
    }
  }
  return target.createFolder(folderName);
}

// === ฟังก์ชันบันทึกไฟล์ลง Google Drive ===
function saveFileToDrive(base64Data, employeeId, subFolderName, filePrefix) {
  if (!base64Data || !base64Data.includes("base64,")) {
    return "";
  }

  try {
    const splitData = base64Data.split("base64,");
    const contentType = splitData[0].split(":")[1].split(";")[0];
    const rawData = splitData[1];
    const decoded = Utilities.base64Decode(rawData);

    let ext = "bin";
    if (contentType.includes("jpeg") || contentType.includes("jpg")) ext = "jpg";
    else if (contentType.includes("png")) ext = "png";
    else if (contentType.includes("pdf")) ext = "pdf";
    else if (contentType.includes("sheet")) ext = "xlsx";

    const dateStr = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyyMMdd_HHmmss");
    const fileName = `${employeeId}_${filePrefix}_${dateStr}.${ext}`;
    const blob = Utilities.newBlob(decoded, contentType, fileName);

    const mainFolder = getOrCreateFolder(MAIN_FOLDER_NAME);
    const empFolder = getOrCreateFolder(employeeId, mainFolder);
    const targetFolder = getOrCreateFolder(subFolderName, empFolder);
    const file = targetFolder.createFile(blob);
    // Private by default — only owner can view. Access managed via Apps Script API.
    // file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW); // commented out for privacy

    return file.getUrl();
  } catch (e) {
    Logger.log("Error: " + e.toString());
    return "Error: " + e.toString();
  }
}

// === ฟังก์ชันแปลงค่าวันที่ในชีตเป็น string format ===
function formatSheetDate(value) {
  if (value instanceof Date) {
    return Utilities.formatDate(value, Session.getScriptTimeZone(), "yyyy-MM-dd");
  }
  // ถ้าเป็น string ลอง parse
  if (typeof value === "string" && value.trim()) {
    const parsed = new Date(value);
    if (!isNaN(parsed.getTime())) {
      return Utilities.formatDate(parsed, Session.getScriptTimeZone(), "yyyy-MM-dd");
    }
  }
  return value ? value.toString() : "";
}

// === ฟังก์ชันแปลงค่าเวลา (HH:MM:SS) จาก Excel time serial ===
// Excel เก็บเวลาอย่างเดียวเป็น fraction ของวัน → Google Sheets อ่านเป็น "30 ธ.ค. 1899"
// ต้องดึง hour/minute/second จาก date object แทน
function formatSheetTime(value) {
  if (value instanceof Date) {
    return Utilities.formatDate(value, Session.getScriptTimeZone(), "HH:mm:ss");
  }
  // ถ้าเป็น string ที่มีเครื่องหมาย : อยู่ แปลงเป็น HH:mm:ss
  if (typeof value === "string" && value.trim()) {
    // รองรับ "01:07:56" หรือ "1:07:56 AM"
    const timeMatch = value.match(/(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)?/i);
    if (timeMatch) {
      let h = parseInt(timeMatch[1]);
      const m = timeMatch[2];
      const s = timeMatch[3] || "00";
      const ampm = (timeMatch[4] || "").toUpperCase();
      if (ampm === "PM" && h < 12) h += 12;
      if (ampm === "AM" && h === 12) h = 0;
      return `${String(h).padStart(2, "0")}:${m}:${s}`;
    }
    const parsed = new Date("1970-01-01 " + value);
    if (!isNaN(parsed.getTime())) {
      return Utilities.formatDate(parsed, Session.getScriptTimeZone(), "HH:mm:ss");
    }
  }
  return value ? value.toString() : "";
}

// === [API] อัปโหลดภาพโปรไฟล์พนักงาน ===
function uploadProfilePhoto(data) {
  const fileUrl = saveFileToDrive(data.photo, data.empId, "Profile_Photos", "PROFILE");
  if (fileUrl.startsWith("Error")) {
    return { status: "error", message: fileUrl };
  }

  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("พนักงาน");
  const rows = sheet.getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][0].toString() === data.empId) {
      sheet.getRange(i + 1, 15).setValue(fileUrl);
      return { status: "success", data: fileUrl, message: "อัปเดตภาพโปรไฟล์สำเร็จ" };
    }
  }
  return { status: "success", data: fileUrl, message: "บันทึกภาพลง Drive แล้ว แต่ไม่พบรหัสพนักงานในชีตเพื่ออัปเดตลิงก์" };
}

// === [API] อัปโหลดไฟล์สลิปเงินเดือน (PDF) ===
function uploadPayslipFile(data) {
  const fileUrl = saveFileToDrive(data.pdfFile, data.empId, "Payslips", "PAYSLIP_" + data.month.replace("/", "_"));
  if (fileUrl.startsWith("Error")) {
    return { status: "error", message: fileUrl };
  }

  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("สลิปเงินเดือน");
  const fileId = fileUrl.split("/d/")[1]?.split("/")[0] || "N/A";

  sheet.appendRow([
    data.empId,
    data.month,
    `Payslip_${data.empId}_${data.month.replace("/", "_")}`,
    fileId,
    fileUrl,
    Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd HH:mm:ss"),
    data.netAmount
  ]);

  return { status: "success", data: fileUrl, message: "อัปโหลดสลิปเงินเดือนสำเร็จ" };
}

// === ฟังก์ชันดึงข้อมูลพนักงาน ===
function getEmployeeData(empId) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("พนักงาน");
  const rows = sheet.getDataRange().getValues();
  const headers = rows[0];

  for (let i = 1; i < rows.length; i++) {
    if (rows[i][0].toString() === empId) {
      let empObj = {};
      headers.forEach((header, index) => {
        empObj[header] = rows[i][index];
      });
      return { status: "success", data: empObj };
    }
  }
  return { status: "error", message: "ไม่พบรหัสพนักงานนี้ในระบบ" };
}

// === ฟังก์ชันบันทึกเวลาทำงาน (เวลางาน) ===
function registerAttendance(data) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("เวลางาน");
  const rows = sheet.getDataRange().getValues();
  const todayStr = data.date;
  const empId = data.empId;

  let recordIndex = -1;
  for (let i = 1; i < rows.length; i++) {
    const rowDate = formatSheetDate(rows[i][0]);
    if (rows[i][3].toString() === empId && rowDate === todayStr) {
      recordIndex = i + 1;
      break;
    }
  }

  if (data.type === "IN") {
    if (recordIndex !== -1) {
      return { status: "error", message: "คุณได้ลงเวลาเข้างานวันนี้ไปแล้ว" };
    }

    let photoUrl = "";
    if (data.photo) {
      photoUrl = saveFileToDrive(data.photo, empId, "Attendance_Photos", "IN");
    }

    const photoJson = JSON.stringify({ in: photoUrl, out: "" });
    const todayDateTime = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd HH:mm:ss");

    sheet.appendRow([
      todayStr,
      data.time,
      "",
      empId,
      "ปกติ",
      "Mobile App",
      data.lat,
      data.lng,
      "",
      "",
      photoJson,
      todayDateTime,
      data.late > 0 ? "สาย" : "ปกติ",
      data.late || 0,
      0,
      0,
      0,
      0,
      data.project,
      "",
      "",
      ""
    ]);
    return { status: "success", message: "บันทึกเวลาเข้างานเรียบร้อยแล้ว" };

  } else if (data.type === "OUT") {
    if (recordIndex === -1) {
      return { status: "error", message: "กรุณาลงเวลาเข้างานก่อนลงเวลาออกงาน" };
    }

    sheet.getRange(recordIndex, 3).setValue(data.time);
    sheet.getRange(recordIndex, 9).setValue(data.lat);
    sheet.getRange(recordIndex, 10).setValue(data.lng);
    sheet.getRange(recordIndex, 20).setValue(data.project);

    let photoUrl = "";
    if (data.photo) {
      photoUrl = saveFileToDrive(data.photo, empId, "Attendance_Photos", "OUT");
    }

    let currentPhotoVal = sheet.getRange(recordIndex, 11).getValue();
    let photoObj = { in: "", out: "" };
    try {
      photoObj = JSON.parse(currentPhotoVal);
    } catch (e) {
      photoObj.in = currentPhotoVal;
    }
    photoObj.out = photoUrl;
    sheet.getRange(recordIndex, 11).setValue(JSON.stringify(photoObj));

    if (data.ot) {
      sheet.getRange(recordIndex, 15).setValue(data.ot);
    } else {
      // Calculate OT from workEndTimeStr setting when OUT is registered
      const settings = getSystemSettings();
      const workEndParts = (settings.workEndTimeStr || '17:00').split(':');
      const workEndMin = parseInt(workEndParts[0]) * 60 + parseInt(workEndParts[1]);

      const timeOutParts = data.time.split(':');
      const timeOutMin = parseInt(timeOutParts[0]) * 60 + parseInt(timeOutParts[1]);

      if (timeOutMin > workEndMin) {
        const otMin = timeOutMin - workEndMin;
        const otInterval = settings.otIntervalMinutes || 30;
        const otHours = Math.floor(otMin / otInterval) * (settings.otIntervalValue || 0.5);
        if (otHours > 0) {
          sheet.getRange(recordIndex, 15).setValue(otHours);
        }
      }
    }
    return { status: "success", message: "บันทึกเวลาออกงานเรียบร้อยแล้ว" };
  }
}

// === ฟังก์ชันยื่นคำขอแก้ไขเวลา ===
function submitTimeCorrection(data) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("คำขอแก้ไขเวลา");
  const todayDate = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd");

  sheet.appendRow([
    data.empId,
    data.date,
    data.timeInNew,
    data.timeOutNew,
    data.reason,
    "รออนุมัติ",
    data.project || "สำนักงานใหญ่",
    todayDate,
    "",
    "",
    ""
  ]);

  return { status: "success", message: "ส่งคำขอแก้ไขเวลางานแล้ว" };
}

// === ฟังก์ชันส่งคำขอลาพร้อมเอกสารแนบ ===
function submitLeaveRequest(data) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("คำขอลา");
  const docId = "LV-" + Math.floor(100000 + Math.random() * 900000);
  const todayDate = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd");

  let attachmentUrl = "";
  if (data.attachment) {
    attachmentUrl = saveFileToDrive(data.attachment, data.empId, "Leave_Documents", "LEAVE_ATTACH");
  }

  sheet.appendRow([
    docId,
    data.empId,
    data.type,
    data.start,
    data.end,
    data.days || 1,
    data.reason,
    "รออนุมัติ",
    todayDate,
    "",
    "",
    "",
    data.lat || "",
    data.lng || "",
    "",
    attachmentUrl,
    "ฝ่ายบุคคลตรวจสอบ"
  ]);

  return { status: "success", message: "บันทึกใบคำขอลาและอัปโหลดเอกสารแนบเข้าสู่ระบบสำเร็จ" };
}

// === ฟังก์ชันเบิกเงินกลางเดือน ===
function submitAdvanceRequest(data) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("บันทึกเบิกเงินกลางเดือน");
  const todayDate = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd");

  sheet.appendRow([
    data.empId,
    data.amount,
    todayDate,
    data.paymentRound || "รอบสิ้นเดือน",
    "รอตรวจสอบ",
    data.reason,
    data.channel || "โอนผ่านบัญชีธนาคาร",
    "ไม่ใช่",
    0
  ]);

  return { status: "success", message: "ยื่นคำขอเบิกเงินกลางเดือนเรียบร้อยแล้ว" };
}

// === [อัปเดต] ฟังก์ชันดึงข้อมูลเวลางานพร้อม filter รอบบัญชี ===
function getTimeRecords(empId, periodStart, periodEnd) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("เวลางาน");
  return getFilteredRecords(sheet, empId, 3, periodStart, periodEnd); // คอลัมน์ที่ 4 (index 3) = รหัสพนักงาน, คอลัมน์ที่ 1 = วันที่
}

// === [อัปเดต] ฟังก์ชันดึงข้อมูลการลาพร้อม filter รอบบัญชี ===
function getLeaveRequests(empId, periodStart, periodEnd) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("คำขอลา");
  return getFilteredRecords(sheet, empId, 1, periodStart, periodEnd, 3, 4); // คอลัมน์ที่ 2 (index 1) = รหัสพนักงาน, คอลัมน์ที่ 4 (index 3) = วันที่เริ่ม, คอลัมน์ที่ 5 (index 4) = วันที่สิ้นสุด
}

// === [อัปเดต] ฟังก์ชันดึงข้อมูลการเบิกเงินพร้อม filter รอบบัญชี ===
function getAdvanceRequests(empId, periodStart, periodEnd) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("บันทึกเบิกเงินกลางเดือน");
  return getFilteredRecords(sheet, empId, 0, periodStart, periodEnd, 2); // คอลัมน์ที่ 1 (index 0) = รหัสพนักงาน, คอลัมน์ที่ 3 (index 2) = วันที่เบิก
}

// === ฟังก์ชันดึงข้อมูลสลิป (ไม่กรองรอบบัญชี — เพราะมีรอบเงินเดือนของตัวเอง) ===
function getPayslips(empId) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("สลิปเงินเดือน");
  return getFilteredRecords(sheet, empId, 0, null, null); // ไม่กรองรอบ แสดงทั้งหมด
}

// === [อัปเดต] ฟังก์ชันดึงข้อมูลการแก้ไขเวลาพร้อม filter รอบบัญชี ===
function getTimeCorrections(empId, periodStart, periodEnd) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("คำขอแก้ไขเวลา");
  return getFilteredRecords(sheet, empId, 0, periodStart, periodEnd, 1); // คอลัมน์ที่ 1 (index 0) = รหัสพนักงาน, คอลัมน์ที่ 2 (index 1) = วันที่
}

// === [Core] ฟังก์ชันกรองข้อมูลแบบระบุรอบบัญชี ===
// dateColIndex: คอลัมน์ที่เป็นวันที่ (0-based) — ใช้สำหรับ filter ในชีตเวลางาน, คำขอแก้ไขเวลา
// leaveDateColEnd: สำหรับชีตคำขอลา (วันที่เริ่ม/สิ้นสุด)
function getFilteredRecords(sheet, empId, empColIndex, periodStart, periodEnd, dateColIndex, leaveDateColEnd) {
  const rows = sheet.getDataRange().getValues();
  const headers = rows[0];
  let records = [];

  for (let i = 1; i < rows.length; i++) {
    // --- กรองรหัสพนักงาน ---
    if (!rows[i][empColIndex] || rows[i][empColIndex].toString() !== empId) {
      continue;
    }

    // --- กรองรอบบัญชี ---
    if (periodStart && periodEnd) {
      let recDateStr = null;

      if (typeof leaveDateColEnd === "number") {
        // ชีตคำขอลา: ใช้ช่วง วันที่เริ่ม–สิ้นสุด
        const startDate = formatSheetDate(rows[i][dateColIndex]);
        const endDate = formatSheetDate(rows[i][leaveDateColEnd]);

        if (!startDate || !endDate) continue;
        if (startDate > periodEnd) continue;
        if (endDate < periodStart) continue;
        recDateStr = startDate;
      } else if (typeof dateColIndex === "number") {
        // ชีตที่มีวันที่เดียว (เวลางาน, คำขอแก้ไขเวลา, การเบิก)
        recDateStr = formatSheetDate(rows[i][dateColIndex]);
        if (!recDateStr) continue;
        if (recDateStr < periodStart || recDateStr > periodEnd) continue;
      }

      // ถ้า formatSheetDate คืนค่าที่ไม่ใช่ date string ให้ข้าม
      if (recDateStr && !recDateStr.match(/\d{4}-\d{2}-\d{2}/)) {
        continue;
      }
    }

    // --- สร้าง object จาก row ---
    let recObj = {};
    headers.forEach((header, index) => {
      let val = rows[i][index];

      if (val instanceof Date) {
        // แยกว่าเป็น "วันที่" (มี keyword วันที่/วันเดือนปี) หรือ "เวลา" (มี keyword เวลา/ครั้ง)
        const h = header.toString().toLowerCase();
        if (h.includes("วันที่") || h.includes("วันเดือน") || h.includes("วันเริ่ม") || h.includes("วันสิ้น") || h.includes("วันทำงาน") || h.includes("วันบันทึก") || h.includes("วันอนุมัติ") || h.includes("วันส่ง") || h.includes("วันเบิก") || h.includes("วันสุด")) {
          // วันที่ → format วันที่
          val = Utilities.formatDate(val, Session.getScriptTimeZone(), "yyyy-MM-dd");
        } else if (h.includes("เวลา") || h.includes("ครั้ง")) {
          // เวลา → format เฉพาะ HH:mm:ss
          val = formatSheetTime(val);
        } else {
          // default: format วันที่
          val = Utilities.formatDate(val, Session.getScriptTimeZone(), "yyyy-MM-dd");
        }
      }
      recObj[header] = val;
    });
    records.push(recObj);
  }

  // Sort by date descending (newest first) — works with "วันที่" field
  records.sort((a, b) => {
    const da = a['วันที่'] || '';
    const db = b['วันที่'] || '';
    return db.localeCompare(da); // desc
  });

  return { status: "success", data: records };
}

// ═══════════════════════════════════════════════════════
// IMPORT TIME RECORDS — Parse scanner log → เวลางาน sheet
// ═══════════════════════════════════════════════════════
//
// Format: DD/MM/YYYY HH:MM:SS\t\t\tEMPLOYEE_ID
// Algorithm:
//  1. Parse ทุกบรรทัด → [date, time, empId]
//  2. Group by empId + date
//  3. Sort scans by time
//  4. Cluster: ห่างจาก scan ก่อน > 2 นาที → cluster ใหม่
//  5. Deduplicate: เก็บ scan แรกของ cluster
//  6. Classify: IN = cluster แรก, OUT = cluster สุดท้าย
//  7. Warning: มีแค่ OUT cluster → MI, มีแค่ IN cluster → MO
function importTimeRecords(data) {
  const CLUSTER_GAP_MS = 2 * 60 * 1000;
  const lines = (data.fileContent || '').split('\n');
  const parseResults = [];

  // Step 1: Parse
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i].trim();
    if (!raw || raw.length < 20) continue;
    const tsMatch = raw.match(/^(\d{2}\/\d{2}\/\d{4})\s+(\d{2}:\d{2}:\d{2})/);
    if (!tsMatch) continue;
    const idMatch = raw.match(/(\d{5,7})\s*$/);
    if (!idMatch) continue;

    const [dd, mm, yyyy] = tsMatch[1].split('/');
    parseResults.push({
      date: `${yyyy}-${mm}-${dd}`,
      time: tsMatch[2],
      empId: idMatch[1],
      rawLine: raw
    });
  }

  if (parseResults.length === 0) {
    return { status: "error", message: "ไม่พบข้อมูล scan ในไฟล์" };
  }

  // Step 2–4: Group → Sort → Cluster → Deduplicate
  const grouped = {};
  for (const rec of parseResults) {
    const key = `${rec.empId}|${rec.date}`;
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(rec);
  }

  const processed = {};
  for (const key in grouped) {
    const scans = grouped[key].sort((a, b) => a.time.localeCompare(b.time));
    const clusters = [];
    for (let i = 0; i < scans.length; i++) {
      const scan = scans[i];
      if (clusters.length === 0) {
        clusters.push({ time: scan.time, count: 1, firstIndex: i });
      } else {
        const prev = clusters[clusters.length - 1].time.split(':').map(Number);
        const next = scan.time.split(':').map(Number);
        const prevMs = prev[0]*3600000 + prev[1]*60000 + prev[2]*1000;
        const nextMs = next[0]*3600000 + next[1]*60000 + next[2]*1000;
        if (nextMs - prevMs > CLUSTER_GAP_MS) {
          clusters.push({ time: scan.time, count: 1, firstIndex: i });
        } else {
          clusters[clusters.length - 1].count++;
        }
      }
    }

    const clusterIdByScan = {};
    for (let c = 0; c < clusters.length; c++) {
      clusterIdByScan[clusters[c].firstIndex] = c;
    }

    processed[key] = scans
      .map((s, i) => ({
        time: s.time, empId: s.empId, date: s.date,
        clusterId: clusterIdByScan[i],
        duplicateCount: clusters[clusterIdByScan[i]] ? clusters[clusterIdByScan[i]].count - 1 : 0
      }))
      .filter((s, i, arr) => i === 0 || s.clusterId !== arr[i - 1].clusterId);
  }

  // Step 5–7: Classify IN/OUT + Warning
  const records = [], warnings = [];

  for (const key in processed) {
    const [empId, date] = key.split('|');
    const cs = processed[key];
    if (cs.length === 0) continue;

    const inC = cs[0], outC = cs[cs.length - 1];
    const same = inC.clusterId === outC.clusterId;

    const countByCluster = {};
    for (const c of cs) countByCluster[c.clusterId] = (countByCluster[c.clusterId] || 0) + 1;
    const inCount = countByCluster[inC.clusterId];
    const outCount = same ? 0 : (countByCluster[outC.clusterId] || 0);

    if (same) {
      const h = parseInt(inC.time.split(':')[0]);
      if (h >= 12) {
        warnings.push({ empId, date, type: 'MI', label: 'ลืมลงเวลาเข้า (MI)', time: inC.time,
          message: `รหัส ${empId} วันที่ ${date}: มี scan แต่ไม่มีเวลาเข้า` });
        records.push({ empId, date, in: null, out: inC.time, inCount: 0, outCount, status: 'MI', duplicates: inC.duplicateCount });
      } else {
        warnings.push({ empId, date, type: 'MO', label: 'ลืมลงเวลาออก (MO)', time: inC.time,
          message: `รหัส ${empId} วันที่ ${date}: มี scan แต่ไม่มีเวลาออก` });
        records.push({ empId, date, in: inC.time, out: null, inCount, outCount: 0, status: 'MO', duplicates: inC.duplicateCount });
      }
    } else {
      records.push({ empId, date, in: inC.time, out: outC.time, inCount, outCount, status: 'W', duplicates: 0 });
    }
  }

  const summary = { totalLines: lines.length, parsedScans: parseResults.length, processedDays: records.length, warnings: warnings.length, byStatus: {} };
  for (const r of records) summary.byStatus[r.status] = (summary.byStatus[r.status] || 0) + 1;

  return { status: 'success', data: { records, warnings, summary } };
}

// ═══════════════════════════════════════════════════════
// WRITE IMPORTED RECORDS TO SHEET
// dryRun=true → preview only | dryRun=false → เขียนจริง
// ═══════════════════════════════════════════════════════
function doImportTimeRecords(data) {
  const result = importTimeRecords(data);
  if (result.status !== 'success') return result;
  const { records, warnings, summary } = result.data;

  if (data.dryRun !== false) {
    return { status: 'success', data: { records, warnings, summary }, message: `ดูตัวอย่าง ${records.length} วัน · warnings ${warnings.length} (dry-run)` };
  }

  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('เวลางาน');
  const today = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss');
  let written = 0, skipped = 0;
  const existing = sheet.getDataRange().getValues();

  for (const rec of records) {
    let exists = false;
    for (let i = 1; i < existing.length; i++) {
      const rowDate = formatSheetDate(existing[i][0]);
      if (existing[i][3]?.toString() === rec.empId && rowDate === rec.date) { exists = true; break; }
    }
    if (exists) { skipped++; continue; }
    sheet.appendRow([rec.date, rec.in || '', rec.out || '', rec.empId, rec.status, 'Import File', '', '', '', '', today, rec.status === 'W' ? 'ปกติ' : rec.status, 0,0,0,0,0, '', '', '']);
    written++;
  }

  return { status: 'success', data: { records, warnings, summary }, message: `เขียน ${written} · skip ${skipped} · warnings ${warnings.length}` };
}

// ═══════════════════════════════════════════════════════
// INIT SYSTEM SETTINGS SHEET + LEGACY SYNC
// ═══════════════════════════════════════════════════════

// Run once after Code.gs update — syncs schema to ตั้งค่าระบบ sheet
function initSystemSettingsSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName('ตั้งค่าระบบ');
  if (!sheet) {
    sheet = ss.insertSheet('ตั้งค่าระบบ');
    sheet.appendRow(['Key', 'Default', 'ใช้งานอยู่', 'คำอธิบาย']);
    const hr = sheet.getRange(1, 1, 1, 4);
    hr.setBackground('#0F172A');
    hr.setFontColor('#FFFFFF');
    hr.setFontWeight('bold');
    hr.setHorizontalAlignment('center');
  }

  const rows = sheet.getDataRange().getValues();
  const existingKeys = {};
  for (let i = 1; i < rows.length; i++) {
    const k = (rows[i][0] || '').toString().trim();
    if (k) existingKeys[k] = i + 1;
  }

  // Group settings by group for ordering
  const groups = {};
  for (let key in SYSTEM_SETTINGS_SCHEMA) {
    const g = SYSTEM_SETTINGS_SCHEMA[key].group || 'other';
    if (!groups[g]) groups[g] = [];
    groups[g].push(key);
  }

  let added = 0;
  for (let g in groups) {
    for (let i = 0; i < groups[g].length; i++) {
      const key = groups[g][i];
      const schema = SYSTEM_SETTINGS_SCHEMA[key];

      if (!existingKeys[key]) {
        sheet.appendRow([key, schema.default, 'default', schema.label]);
        existingKeys[key] = sheet.getLastRow();
        added++;
      }
    }
  }

  sheet.autoResizeColumns(1, 4);
  return { status: 'success', message: `Synced schema. Added ${added} new rows.` };
}

// Legacy alias — now uses schema-based init
function syncSymbolRules() {
  initSystemSettingsSheet();
  const settings = getSystemSettings();
  Logger.log('[syncSymbolRules] Loaded ' + Object.keys(settings).length + ' settings.');
  return { status: 'success', message: `Loaded ${Object.keys(settings).length} system settings from sheet (or defaults).` };
}

// DEBUG: Preview import (แทนที่ fileContent ก่อนรัน)
// ═══════════════════════════════════════════════════════
function debugImportPreview() {
  // แทนที่ด้วย content จริงจากไฟล์ .txt
  const fileContent = `26/12/2025 07:47:43\t\t\t800139
26/12/2025 16:54:11\t\t\t800139
06/01/2026 07:41:08\t\t\t630001
06/01/2026 17:17:42\t\t\t630001
03/01/2026 17:11:47\t\t\t623001`;
  const r = importTimeRecords({ fileContent });
  Logger.log(JSON.stringify(r, null, 2));
  r.data.warnings.forEach(w => Logger.log(`⚠️ [${w.type}] ${w.empId} | ${w.date} | ${w.time} | ${w.label}`));
  return r;
}

// ═══════════════════════════════════════════════════════════════════════
// [ADMIN] BACKEND FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════

// ─── [ADMIN] ดึงพนักงานทั้งหมด ──────────────────────────────────────────
function adminGetAllEmployees() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('พนักงาน');
  if (!sheet) return { status: 'error', message: 'ไม่พบชีตพนักงาน' };
  const rows = sheet.getDataRange().getValues();
  const headers = rows[0];
  const records = [];
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    // ข้าม row ว่างทั้งหมด
    if (!row[0] || row[0].toString().trim() === '') continue;
    const obj = {};
    headers.forEach((h, idx) => {
      let val = row[idx];
      if (val instanceof Date) {
        val = Utilities.formatDate(val, Session.getScriptTimeZone(), 'yyyy-MM-dd');
      }
      obj[h] = val !== undefined && val !== null ? val : '';
    });
    records.push(obj);
  }
  return { status: 'success', data: records };
}

// ─── [ADMIN] ดึง System Settings ทั้งหมด ────────────────────────────────
function adminGetSystemSettings() {
  const settings = getSystemSettings();
  return { status: 'success', data: settings };
}

// ─── [ADMIN] ดึงใบลาทั้งหมด (ทุก empId) ──────────────────────────────
function adminGetAllLeaveRequests(periodStart, periodEnd, filterStatus) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('คำขอลา');
  if (!sheet) return { status: 'error', message: 'ไม่พบชีตคำขอลา' };
  const rows = sheet.getDataRange().getValues();
  const headers = rows[0];
  const records = [];
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row[0] && !row[1]) continue; // skip empty rows
    // กรองสถานะ
    const status = (row[7] || '').toString();
    if (filterStatus && filterStatus !== '' && status !== filterStatus) continue;
    // กรองรอบบัญชี (ใช้วันที่เริ่ม index 3)
    if (periodStart && periodEnd) {
      const recDate = formatSheetDate(row[3]);
      if (recDate && (recDate < periodStart || recDate > periodEnd)) continue;
    }
    const obj = {};
    headers.forEach((h, idx) => {
      let val = row[idx];
      if (val instanceof Date) {
        const hStr = h.toString().toLowerCase();
        if (hStr.includes('วันที่') || hStr.includes('วันเริ่ม') || hStr.includes('วันสิ้น') || hStr.includes('วันส่ง') || hStr.includes('วันอนุมัติ')) {
          val = Utilities.formatDate(val, Session.getScriptTimeZone(), 'yyyy-MM-dd');
        } else if (hStr.includes('เวลา')) {
          val = formatSheetTime(val);
        } else {
          val = Utilities.formatDate(val, Session.getScriptTimeZone(), 'yyyy-MM-dd');
        }
      }
      obj[h] = val !== undefined && val !== null ? val : '';
    });
    obj['__rowIndex'] = i + 1; // เก็บ row index สำหรับการอัปเดตทีหลัง
    records.push(obj);
  }
  records.sort((a, b) => (b['วันที่ส่ง'] || '').localeCompare(a['วันที่ส่ง'] || ''));
  return { status: 'success', data: records };
}

// ─── [ADMIN] ดึงคำขอแก้ไขเวลาทั้งหมด ──────────────────────────────────
function adminGetAllTimeCorrections(periodStart, periodEnd, filterStatus) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('คำขอแก้ไขเวลา');
  if (!sheet) return { status: 'error', message: 'ไม่พบชีตคำขอแก้ไขเวลา' };
  const rows = sheet.getDataRange().getValues();
  const headers = rows[0];
  const records = [];
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row[0]) continue;
    const status = (row[5] || '').toString();
    if (filterStatus && filterStatus !== '' && status !== filterStatus) continue;
    if (periodStart && periodEnd) {
      const recDate = formatSheetDate(row[1]);
      if (recDate && (recDate < periodStart || recDate > periodEnd)) continue;
    }
    const obj = {};
    headers.forEach((h, idx) => {
      let val = row[idx];
      if (val instanceof Date) {
        const hStr = h.toString().toLowerCase();
        if (hStr.includes('เวลา')) val = formatSheetTime(val);
        else val = Utilities.formatDate(val, Session.getScriptTimeZone(), 'yyyy-MM-dd');
      }
      obj[h] = val !== undefined && val !== null ? val : '';
    });
    obj['__rowIndex'] = i + 1;
    records.push(obj);
  }
  records.sort((a, b) => (b['วันที่ส่ง'] || '').localeCompare(a['วันที่ส่ง'] || ''));
  return { status: 'success', data: records };
}

// ─── [ADMIN] ดึงคำขอเบิกทั้งหมด ──────────────────────────────────────
function adminGetAllAdvanceRequests(periodStart, periodEnd, filterStatus) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('บันทึกเบิกเงินกลางเดือน');
  if (!sheet) return { status: 'error', message: 'ไม่พบชีตเบิกเงิน' };
  const rows = sheet.getDataRange().getValues();
  const headers = rows[0];
  const records = [];
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row[0]) continue;
    const status = (row[4] || '').toString();
    if (filterStatus && filterStatus !== '' && status !== filterStatus) continue;
    if (periodStart && periodEnd) {
      const recDate = formatSheetDate(row[2]);
      if (recDate && (recDate < periodStart || recDate > periodEnd)) continue;
    }
    const obj = {};
    headers.forEach((h, idx) => {
      let val = row[idx];
      if (val instanceof Date) {
        val = Utilities.formatDate(val, Session.getScriptTimeZone(), 'yyyy-MM-dd');
      }
      obj[h] = val !== undefined && val !== null ? val : '';
    });
    obj['__rowIndex'] = i + 1;
    records.push(obj);
  }
  records.sort((a, b) => (b['วันที่เบิก'] || '').localeCompare(a['วันที่เบิก'] || ''));
  return { status: 'success', data: records };
}

// ─── [ADMIN] ดึงเวลางานทั้งหมด (ทุก empId) ────────────────────────────
function adminGetAllTimeRecords(periodStart, periodEnd) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('เวลางาน');
  if (!sheet) return { status: 'error', message: 'ไม่พบชีตเวลางาน' };
  const rows = sheet.getDataRange().getValues();
  const headers = rows[0];
  const records = [];
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row[0] && !row[3]) continue;
    if (periodStart && periodEnd) {
      const recDate = formatSheetDate(row[0]);
      if (!recDate || recDate < periodStart || recDate > periodEnd) continue;
    }
    const obj = {};
    headers.forEach((h, idx) => {
      let val = row[idx];
      if (val instanceof Date) {
        const hStr = h.toString().toLowerCase();
        if (hStr.includes('เวลา')) val = formatSheetTime(val);
        else val = Utilities.formatDate(val, Session.getScriptTimeZone(), 'yyyy-MM-dd');
      }
      obj[h] = val !== undefined && val !== null ? val : '';
    });
    records.push(obj);
  }
  records.sort((a, b) => (b['วันที่'] || '').localeCompare(a['วันที่'] || ''));
  return { status: 'success', data: records };
}

// ─── [ADMIN] อนุมัติ / ปฏิเสธ ใบลา ──────────────────────────────────
function adminApproveLeave(data) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('คำขอลา');
  if (!sheet) return { status: 'error', message: 'ไม่พบชีตคำขอลา' };

  const docId = (data.docId || '').toString().trim();
  const newStatus = data.status || '';
  const approvedBy = data.approvedBy || 'Admin';
  const note = data.note || '';
  const today = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss');

  if (!docId || !newStatus) return { status: 'error', message: 'ข้อมูลไม่ครบถ้วน (docId, status)' };

  const rows = sheet.getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) {
    const rowDocId = (rows[i][0] || '').toString().trim();
    if (rowDocId !== docId) continue;
    // col 7 = สถานะ, col 9 = วันที่อนุมัติ, col 10 = อนุมัติโดย, col 11 = หมายเหตุ (1-indexed: 8, 10, 11, 12)
    sheet.getRange(i + 1, 8).setValue(newStatus);
    sheet.getRange(i + 1, 10).setValue(today);
    sheet.getRange(i + 1, 11).setValue(approvedBy);
    if (note) sheet.getRange(i + 1, 12).setValue(note);
    return { status: 'success', message: `อัปเดตสถานะใบลา ${docId} เป็น "${newStatus}" สำเร็จ` };
  }
  return { status: 'error', message: `ไม่พบเอกสาร ${docId} ในชีต` };
}

// ─── [ADMIN] อนุมัติ / ปฏิเสธ คำขอแก้ไขเวลา ────────────────────────
function adminApproveTimeCorrection(data) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('คำขอแก้ไขเวลา');
  if (!sheet) return { status: 'error', message: 'ไม่พบชีตคำขอแก้ไขเวลา' };

  const empId = (data.empId || '').toString().trim();
  const targetDate = (data.date || '').toString().trim();
  const newStatus = data.status || '';
  const approvedBy = data.approvedBy || 'Admin';
  const note = data.note || '';
  const today = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss');

  if (!empId || !targetDate || !newStatus) {
    return { status: 'error', message: 'ข้อมูลไม่ครบถ้วน (empId, date, status)' };
  }

  const rows = sheet.getDataRange().getValues();
  let updated = 0;
  for (let i = 1; i < rows.length; i++) {
    const rowEmp = (rows[i][0] || '').toString().trim();
    const rowDate = formatSheetDate(rows[i][1]);
    const rowStatus = (rows[i][5] || '').toString();
    if (rowEmp !== empId || rowDate !== targetDate) continue;
    if (rowStatus !== 'รออนุมัติ') continue; // อนุมัติเฉพาะที่ยังรออนุมัติ
    // col: สถานะ=6, วันที่อนุมัติ=9, อนุมัติโดย=10, หมายเหตุ=11 (1-indexed)
    sheet.getRange(i + 1, 6).setValue(newStatus);
    sheet.getRange(i + 1, 9).setValue(today);
    sheet.getRange(i + 1, 10).setValue(approvedBy);
    if (note) sheet.getRange(i + 1, 11).setValue(note);

    // ถ้าอนุมัติ → อัปเดตเวลาจริงในชีตเวลางาน
    if (newStatus === 'อนุมัติแล้ว') {
      applyTimeCorrectionToSheet(empId, targetDate, rows[i][2], rows[i][3]);
    }
    updated++;
    break;
  }
  if (updated === 0) return { status: 'error', message: 'ไม่พบคำขอหรือสถานะไม่ใช่ "รออนุมัติ"' };
  return { status: 'success', message: `อัปเดตสถานะแก้ไขเวลาของ ${empId} วันที่ ${targetDate} เป็น "${newStatus}" สำเร็จ` };
}

// ─── [ADMIN] ฟังก์ชันย่อย: อัปเดตเวลาจริงในชีตเวลางานหลังอนุมัติ ──
function applyTimeCorrectionToSheet(empId, dateStr, newTimeIn, newTimeOut) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('เวลางาน');
  if (!sheet) return;
  const rows = sheet.getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) {
    const rowDate = formatSheetDate(rows[i][0]);
    const rowEmp = (rows[i][3] || '').toString();
    if (rowDate === dateStr && rowEmp === empId) {
      if (newTimeIn)  sheet.getRange(i + 1, 2).setValue(formatSheetTime(newTimeIn));
      if (newTimeOut) sheet.getRange(i + 1, 3).setValue(formatSheetTime(newTimeOut));
      sheet.getRange(i + 1, 5).setValue('แก้ไขโดย Admin');
      break;
    }
  }
}

// ─── [ADMIN] อนุมัติ / ปฏิเสธ คำขอเบิกเงิน ─────────────────────────
function adminApproveAdvance(data) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('บันทึกเบิกเงินกลางเดือน');
  if (!sheet) return { status: 'error', message: 'ไม่พบชีตเบิกเงิน' };

  const empId = (data.empId || '').toString().trim();
  const targetDate = (data.date || '').toString().trim();
  const amount = parseFloat(data.amount || 0);
  const newStatus = data.status || '';
  const approvedBy = data.approvedBy || 'Admin';
  const note = data.note || '';

  if (!empId || !newStatus) return { status: 'error', message: 'ข้อมูลไม่ครบถ้วน (empId, status)' };

  const today = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss');
  const rows = sheet.getDataRange().getValues();

  for (let i = 1; i < rows.length; i++) {
    const rowEmp = (rows[i][0] || '').toString().trim();
    const rowDate = formatSheetDate(rows[i][2]);
    const rowAmt = parseFloat(rows[i][1] || 0);
    const rowStatus = (rows[i][4] || '').toString();

    if (rowEmp !== empId) continue;
    if (targetDate && rowDate !== targetDate) continue;
    if (amount > 0 && Math.abs(rowAmt - amount) > 1) continue;
    if (!['รอตรวจสอบ', 'รออนุมัติ'].includes(rowStatus)) continue;

    // col: สถานะ=5, หมายเหตุ=6 (1-indexed)
    sheet.getRange(i + 1, 5).setValue(newStatus);
    if (note) sheet.getRange(i + 1, 6).setValue(note);
    return { status: 'success', message: `อัปเดตสถานะเบิกของ ${empId} เป็น "${newStatus}" สำเร็จ` };
  }
  return { status: 'error', message: 'ไม่พบรายการหรือสถานะไม่สามารถอัปเดตได้' };
}

// ─── [ADMIN] ดึงประกาศทั้งหมด ─────────────────────────────────────────
function adminGetAnnouncements() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName('ข่าวสาร');
  if (!sheet) {
    // สร้างชีตใหม่อัตโนมัติ
    sheet = ss.insertSheet('ข่าวสาร');
    sheet.appendRow(['เลขที่', 'หัวข้อ', 'ประเภท', 'เนื้อหา', 'วันที่โพสต์', 'โพสต์โดย', 'สถานะ']);
    const hr = sheet.getRange(1, 1, 1, 7);
    hr.setBackground('#0F172A'); hr.setFontColor('#FFFFFF'); hr.setFontWeight('bold');
    return { status: 'success', data: [] };
  }
  const rows = sheet.getDataRange().getValues();
  if (rows.length <= 1) return { status: 'success', data: [] };
  const headers = rows[0];
  const records = rows.slice(1).filter(r => r[0]).map(r => {
    const obj = {};
    headers.forEach((h, idx) => {
      let val = r[idx];
      if (val instanceof Date) val = Utilities.formatDate(val, Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss');
      obj[h] = val !== undefined ? val : '';
    });
    return obj;
  });
  records.sort((a, b) => (b['วันที่โพสต์'] || '').localeCompare(a['วันที่โพสต์'] || ''));
  return { status: 'success', data: records };
}

// ─── [ADMIN] โพสต์ประกาศใหม่ ─────────────────────────────────────────
function adminPostAnnouncement(data) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName('ข่าวสาร');
  if (!sheet) {
    sheet = ss.insertSheet('ข่าวสาร');
    sheet.appendRow(['เลขที่', 'หัวข้อ', 'ประเภท', 'เนื้อหา', 'วันที่โพสต์', 'โพสต์โดย', 'สถานะ']);
    const hr = sheet.getRange(1, 1, 1, 7);
    hr.setBackground('#0F172A'); hr.setFontColor('#FFFFFF'); hr.setFontWeight('bold');
  }

  const title   = (data.title || '').toString().trim();
  const content = (data.content || '').toString().trim();
  const type    = (data.type || 'ทั่วไป').toString();
  const author  = (data.postedBy || 'Admin').toString();

  if (!title || !content) return { status: 'error', message: 'กรุณาระบุหัวข้อและเนื้อหา' };

  const existingRows = sheet.getDataRange().getValues();
  const annId = 'ANN-' + String(existingRows.length).padStart(4, '0');
  const now = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss');

  sheet.appendRow([annId, title, type, content, now, author, 'เผยแพร่']);
  return { status: 'success', message: `โพสต์ประกาศ "${title}" สำเร็จ (${annId})` };
}

// ─── [ADMIN] ดึงวันหยุด ──────────────────────────────────────────────
function adminGetHolidays(yearFilter) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName('วันหยุด');
  if (!sheet) {
    sheet = ss.insertSheet('วันหยุด');
    sheet.appendRow(['วันที่', 'ชื่อวันหยุด', 'ปี', 'ประเภท', 'บันทึกโดย']);
    const hr = sheet.getRange(1, 1, 1, 5);
    hr.setBackground('#0F172A'); hr.setFontColor('#FFFFFF'); hr.setFontWeight('bold');
    return { status: 'success', data: [] };
  }
  const rows = sheet.getDataRange().getValues();
  if (rows.length <= 1) return { status: 'success', data: [] };
  const headers = rows[0];
  let records = rows.slice(1).filter(r => r[0]).map(r => {
    const obj = {};
    headers.forEach((h, idx) => {
      let val = r[idx];
      if (val instanceof Date) val = Utilities.formatDate(val, Session.getScriptTimeZone(), 'yyyy-MM-dd');
      obj[h] = val !== undefined ? val : '';
    });
    return obj;
  });
  if (yearFilter) {
    records = records.filter(r => (r['ปี'] || '').toString() === yearFilter.toString() ||
      (r['วันที่'] || '').toString().startsWith(yearFilter.toString()));
  }
  records.sort((a, b) => (a['วันที่'] || '').localeCompare(b['วันที่'] || ''));
  return { status: 'success', data: records };
}

// ─── [ADMIN] เพิ่มวันหยุด ─────────────────────────────────────────────
function adminAddHoliday(data) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName('วันหยุด');
  if (!sheet) {
    sheet = ss.insertSheet('วันหยุด');
    sheet.appendRow(['วันที่', 'ชื่อวันหยุด', 'ปี', 'ประเภท', 'บันทึกโดย']);
    const hr = sheet.getRange(1, 1, 1, 5);
    hr.setBackground('#0F172A'); hr.setFontColor('#FFFFFF'); hr.setFontWeight('bold');
  }

  const holidayDate = (data.date || '').toString().trim();
  const holidayName = (data.name || '').toString().trim();
  const year        = (data.year || '').toString().trim();
  const type        = (data.type || 'นักขัตฤกษ์').toString();

  if (!holidayDate || !holidayName) return { status: 'error', message: 'กรุณาระบุวันที่และชื่อวันหยุด' };

  // ตรวจ duplicate
  const rows = sheet.getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) {
    const existing = formatSheetDate(rows[i][0]);
    if (existing === holidayDate) {
      return { status: 'error', message: `วันที่ ${holidayDate} มีอยู่แล้ว: ${rows[i][1]}` };
    }
  }

  sheet.appendRow([holidayDate, holidayName, year, type, 'Admin']);
  return { status: 'success', message: `เพิ่มวันหยุด "${holidayName}" (${holidayDate}) สำเร็จ` };
}

// ─── [ADMIN] เพิ่มข้อมูลใน initializeDatabase ─────────────────────────
// ชีต "ข่าวสาร" และ "วันหยุด" จะถูกสร้างอัตโนมัติเมื่อเรียก admin functions
// ไม่จำเป็นต้องเพิ่มใน initializeDatabase เพราะมี auto-create ในแต่ละ function
