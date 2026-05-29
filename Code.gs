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

// === 🧪 DEBUG: ดูข้อมูลเวลางาน (ล่าสุด 20 รายการ) ===
function debugGetTimeRecords() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName("เวลางาน");
  if (!sheet) { Logger.log("❌ ชีต เวลางาน ไม่มี"); return; }
  const rows = sheet.getDataRange().getValues();
  Logger.log(`\n========== เวลางาน (${rows.length - 1} รายการ) ==========`);
  // แสดง header + 20 รายการล่าสุด
  Logger.log("Header: " + JSON.stringify(rows[0]));
  const lastRows = rows.slice(-20);
  lastRows.forEach((row, i) => {
    Logger.log(`[${rows.length - 20 + i}] ${JSON.stringify(row)}`);
  });
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

/**
 * HRBTC - Google Apps Script Backend
 * Supports: attendance, leave, advance salary, payslips + accounting period filter
 */

// ตั้งชื่อโฟลเดอร์หลักที่จะเก็บรูปภาพและเอกสารใน Google Drive ของคุณ
const MAIN_FOLDER_NAME = "HRBTC_Uploads";

function doGet(e) {
  // ตรวจสอบและสร้างชีตฐานข้อมูลที่จำเป็นทั้งหมดก่อนทำงาน
  initializeDatabase();

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
      responseData = getTimeRecords(empId, periodStart, periodEnd);
    } else if (action === "getLeaveRequests") {
      responseData = getLeaveRequests(empId, periodStart, periodEnd);
    } else if (action === "getAdvanceRequests") {
      responseData = getAdvanceRequests(empId, periodStart, periodEnd);
    } else if (action === "getPayslips") {
      responseData = getPayslips(empId);
    } else if (action === "getTimeCorrections") {
      responseData = getTimeCorrections(empId, periodStart, periodEnd);
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
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

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
// SYNC SYMBOL RULES + FIX HALF-DAY TIMES
// รันครั้งเดียวหลังอัปเดต Code.gs เวอร์ชันใหม่
// ═══════════════════════════════════════════════════════
function syncSymbolRules() {
  const SYMBOL_RULES = {
    'W':   { fillIn: '08:00', fillOut: '17:00' },
    'L':   { fillIn: '08:00', fillOut: '17:00' },
    'A':   { clearIn: true, clearOut: true },
    'B+':  { fillIn: '08:00', fillOut: '17:00' },
    'B-':  { clearIn: true, clearOut: true },
    'H+':  { fillIn: '08:00', fillOut: '17:00' },
    'H-':  { clearIn: true, clearOut: true },
    'S+':  { fillIn: '08:00', fillOut: '17:00' },
    'S-':  { clearIn: true, clearOut: true },
    'SM+': { clearIn: true, clearOut: true },
    'A½':  { fillIn: '13:00', fillOut: '17:00' },
    'P½':  { fillIn: '08:00', fillOut: '12:00' },
    'พร':  { fillIn: '08:00', fillOut: '17:00' },
    'คส':  { fillIn: '08:00', fillOut: '17:00' },
    'ย':   { clearIn: true, clearOut: true },
    'นข':  { clearIn: true, clearOut: true },
    'MI':  { clearIn: true, clearOut: true },
    'MO':  { clearIn: true, clearOut: true }
  };

  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('ตั้งค่าระบบ');
  const rows = sheet.getDataRange().getValues();
  let symbolRowIdx = -1;
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][0] === 'symbolRules') { symbolRowIdx = i + 1; break; }
  }
  const jsonValue = JSON.stringify(SYMBOL_RULES);
  if (symbolRowIdx === -1) {
    sheet.appendRow(['symbolRules', '{\"\":\"\"}', jsonValue, 'กฎสถานะสรุปวัน (อัปเดตอัตโนมัติ)']);
    symbolRowIdx = rows.length + 1;
  }
  sheet.getRange(symbolRowIdx, 2).setValue(jsonValue);
  sheet.getRange(symbolRowIdx, 3).setValue(jsonValue);

  // Fix half-day times: เปลี่ยน Excel bug date → string
  const halfDayFix = { halfDayInLunchMinStr:'11:30', halfDayInLunchMaxStr:'13:30', halfDayOutLunchMinStr:'12:00', halfDayOutLunchMaxStr:'13:30' };
  for (let i = 1; i < rows.length; i++) {
    const key = rows[i][0];
    if (halfDayFix.hasOwnProperty(key)) {
      const cur = rows[i][2];
      if (cur instanceof Date || (typeof cur === 'string' && cur.includes('1899'))) {
        sheet.getRange(i + 1, 2).setValue(halfDayFix[key]);
        sheet.getRange(i + 1, 3).setValue(halfDayFix[key]);
      }
    }
  }

  return { status: 'success', message: `อัปเดต ${Object.keys(SYMBOL_RULES).length} symbol codes + half-day times แล้ว` };
}

// ═══════════════════════════════════════════════════════
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