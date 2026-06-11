# คู่มือติดตั้ง HRBTC Scan Agent (ฉบับสมบูรณ์)

> โปรแกรมเล็กๆ ที่รันบนคอม Windows
> ดึงข้อมูลการสแกนนิ้ว/หน้าจากเครื่อง **MB40-VL**
> ส่งเข้า **Google Sheets** (HRBTC) อัตโนมัติ

---

## 📋 สิ่งที่ต้องเตรียม

| สิ่งที่ต้องมี | หมายเหตุ |
|--------------|----------|
| คอม Windows 10/11 | เปิดบ่อยๆ ที่หน้างาน |
| เครื่องสแกนนิ้ว MB40-VL | ต่อ LAN/WiFi เดียวกับคอม |
| เน็ต (WiFi/4G) | ส่งข้อมูลเข้า Sheets |
| สิทธิ์ Admin บน Windows | ติดตั้งครั้งแ�ียว |

---

## 🚀 ขั้นตอนที่ 1: ติดตั้ง Python

### 1.1 ดาวน์โหลด Python

ไปที่: **https://www.python.org/downloads/**

กดปุ่ม **"Download Python 3.x.x"** (ใหญ่สุดบนหน้า)

### 1.2 ติดตั้ง — **ติ๊ก ☐ Add Python to PATH** ก่อนกด Install

```
┌─────────────────────────────────────┐
│  Install Python 3.11.x             │
│                                    │
│  ☑ Add Python.exe to PATH  ← ติ๊ก! │
│                                    │
│  [ Install Now ]                    │
└─────────────────────────────────────┘
```

> ⚠️ **ถ้าลืมติ๊ก** = ต้อง uninstall แล้วลงใหม่ (หรือแก้ PATH เอง ซึ่งยากกว่า)

### 1.3 ตรวจสอบการติดตั้ง

1. กดปุ่ม **Windows** พิมพ์ `powershell` → Enter
2. พิมพ์:

```powershell
python --version
```

✅ ถ้าเห็น `Python 3.11.x` หรือสูงกว่า = สำเร็จ
❌ ถ้าเห็น "'python' is not recognized" = ลืมติ๊ก PATH ต้องลงใหม่

---

## 📁 ขั้นตอนที่ 2: เตรียมโฟลเดอร์ Agent

### 2.1 สร้างโฟลเดอร์

เปิด File Explorer ไปที่:
```
C:\Users\PC\OneDrive\Documents\GitHub\HRBTC\agent\
```

(โฟลเดอร์นี้มี `scan_agent.py` กับ `README.md` อยู่แล้ว)

### 2.2 เปิด PowerShell ในโฟลเดอร์นี้

**วิธี A:** กด Shift + คลิกขวาในโฟลเดอร์ → "Open PowerShell window here"

**วิธี B:** พิมพ์ใน PowerShell:
```powershell
cd "C:\Users\PC\OneDrive\Documents\GitHub\HRBTC\agent"
```

---

## 📦 ขั้นตอนที่ 3: ติดตั้งไลบรารี

ใน PowerShell พิมพ์:

```powershell
pip install pyzk requests
```

รอจนเสร็จ (ประมาณ 30 วินาที - 2 นาที)

✅ ถ้าเห็น `Successfully installed pyzk-x.x.x` = สำเร็จ

---

## ⚙️ ขั้นตอนที่ 4: แก้ค่า Config

### 4.1 เปิดไฟล์ `scan_agent.py` ด้วย Notepad

คลิกขวาที่ไฟล์ → Open with → Notepad

### 4.2 แก้ค่าตรงนี้:

```python
CONFIG = {
    # ----- เครื่องสแกนนิ้ว (แก้ตามของคุณ) -----
    "DEVICE_IP": "192.168.1.230",     # ← IP เครื่องสแกน
    "DEVICE_PORT": 8080,              # ← 8080 (HTTP) หรือ 4370 (PUSH)
    "DEVICE_USE_HTTP": True,          # ← True ถ้า port 8080, False ถ้า 4370
    "DEVICE_MODEL": "MB40-VL",
    "DEVICE_SERIAL": "CJH8193260074", # ← Serial (ดูจากหน้าจอ TAS Time)
    "DEVICE_BRANCH": "HQ",            # ← รหัสสาขา
    "DEVICE_NAME": "สำนักงานใหญ่",      # ← ชื่อที่แสดงใน HRBTC
    ...
}
```

### 4.3 ค่าที่ต้องเปลี่ยนตามเครื่องคุณ:

| ตัวแปร | เครื่องสำนักงาน | เครื่อง KM3 |
|--------|----------------|------------|
| DEVICE_IP | `192.168.1.230` | `192.168.1.134` |
| DEVICE_PORT | `8080` | `4370` |
| DEVICE_USE_HTTP | `True` | `False` |
| DEVICE_SERIAL | `CJH8193260074` | `CJH8210560031` |
| DEVICE_BRANCH | `HQ` | `KM3` |
| DEVICE_NAME | `สำนักงานใหญ่` | `หน้างาน KM3` |

### 4.4 Save (Ctrl+S)

---

## 🧪 ขั้นตอนที่ 5: ทดสอบรัน

ใน PowerShell พิมพ์:

```powershell
python scan_agent.py
```

### ถ้าสำเร็จจะเห็น:

```
============================================================
  HRBTC Scan Agent v1.0.0
  Device : MB40-VL (CJH8193260074)
  IP:Port: 192.168.1.230:8080
  Server : https://script.google.com/...
  Branch : HQ — สำนักงานใหญ่
============================================================
[REGISTER] ลงทะเบียนเครื่องใหม่
[START] เริ่มทำงาน — กด Ctrl+C เพื่อหยุด

[CYCLE 1] กำลังดึงข้อมูลจากเครื่องสแกน...
[CYCLE 1] ไม่มีข้อมูลใหม่
```

> **ถ้าเห็น `[CYCLE 1] ไม่มีข้อมูลใหม่` = ทำงานปกติ** (ยังไม่มีใครสแกนนิ้วหลังติดตั้ง)
>
> ลองให้พนักงานสแกนนิ้วสัก 1 ครั้ง → รอ 1-2 นาที → ดูว่าขึ้น `[CYCLE X] ส่งข้อมูลเข้าระบบ 1 records`

### ถ้ามีปัญหา:

| ข้อความ | ความหมาย | วิธีแก้ |
|--------|---------|---------|
| `[FATAL] ลงทะเบียนไม่สำเร็จ` | ต่อ Apps Script ไม่ได้ | เช็ค `SERVER_URL` และเน็ต |
| `[ERROR] HTTP fetch failed` | ดึงจากเครื่องสแกนไม่ได้ | เช็ค IP/Port, ping เครื่องสแกน |
| `ModuleNotFoundError: No module named 'pyzk'` | ลง pyzk ไม่สำเร็จ | รัน `pip install pyzk` อีกครั้ง |

---

## ✅ ขั้นตอนที่ 6: ตรวจสอบใน Google Sheets

1. เปิด Google Sheets ของ HRBTC
2. ดู sheet **Devices** (จะมีเครื่องของคุณปรากฏ)
3. ดู sheet **Attendance_raw** (จะมีข้อมูลการสแกน)

### Devices sheet จะมีหน้าตาแบบนี้:

| Device ID | ชื่อเครื่อง | รหัสสาขา | IP | Port | สถานะ | Last Heartbeat |
|-----------|-----------|----------|-----|------|------|---------------|
| MB40-VL-CJH8193260074-PC01 | สำนักงานใหญ่ | HQ | 192.168.1.230 | 8080 | online | 2026-06-09 09:30 |

### Attendance_raw sheet:

| Device ID | Branch | Emp ID | Timestamp | Type | Punch |
|-----------|--------|--------|-----------|------|-------|
| MB40-VL-CJH... | HQ | 800139 | 2026-06-09T08:15:23 | 0 | 1 |

---

## 🔧 ขั้นตอนที่ 7: ตั้งให้เปิดอัตโนมัติ (Optional)

ถ้าอยากให้ agent เปิดเองทุกครั้งที่เปิดคอม:

### วิธี A: ใส่ใน Startup folder

1. กด **Windows + R** พิมพ์ `shell:startup` → Enter
2. เปิดโฟลเดอร์ที่เปิดขึ้นมา
3. สร้าง shortcut ของ `scan_agent.py` ไปวาง

### วิธี B: ตั้ง Task Scheduler

1. กด **Windows** → พิมพ์ `Task Scheduler`
2. คลิกขวา "Create Basic Task..."
3. Name: `HRBTC Scan Agent`
4. Trigger: `When the computer starts`
5. Action: `Start a program`
   - Program: `python`
   - Arguments: `C:\Users\PC\OneDrive\Documents\GitHub\HRBTC\agent\scan_agent.py`
6. ✅ Done

---

## 🆘 แก้ปัญหาเบื้องต้น

### ปัญหา: Python ไม่เจอใน PATH
```powershell
# ลองใช้ py แทน python
py scan_agent.py
```

### ปัญหา: pip install ไม่ได้
```powershell
# ลองอัปเกรด pip ก่อน
python -m pip install --upgrade pip
pip install pyzk requests
```

### ปัญหา: ต่อเครื่องสแกนไม่ได้
```powershell
# ทดสอบ ping
ping 192.168.1.230

# ทดสอบ port (ถ้าได้ "Open" = ใช้ได้)
Test-NetConnection -ComputerName 192.168.1.230 -Port 8080
```

### ปัญหา: ดึงข้อมูลจาก port 8080 ไม่ได้
Firmware ของ MB40-VL บางรุ่นตอบ HTTP ในรูปแบบที่ต้อง parse เป็นพิเศษ
→ บอกผม ผมจะช่วยปรับ `http_get_attendance()`

---

## 📞 ติดต่อขอความช่วยเหลือ

ถ้าเจอปัญหา → copy ข้อความ error จาก PowerShell มาให้ผมดู พร้อมบอกว่า:
1. เครื่องสแกน IP/Port อะไร
2. Firmware รุ่นอะไร (ถ้ารู้)
3. เครื่องสแกนตอบอะไรกลับมาเมื่อเปิด `http://192.168.1.230:8080` ในเบราว์เซอร์

---

## 🎯 ขั้นตอนถัดไป (เมื่อทดสอบผ่าน)

1. ติดตั้ง agent ที่เครื่อง KM3 (port 4370)
2. เพิ่มหน้า "จัดการเครื่องสแกน" ใน HRBTC (ดูออนไลน์/ออฟไลน์)
3. เชื่อม LINE แจ้งเตือน real-time
4. เพิ่มเครื่องสาขาใหม่ๆ ได้ง่ายๆ
