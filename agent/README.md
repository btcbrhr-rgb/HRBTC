# คู่มือติดตั้ง HRBTC Scan Agent

โปรแกรมเล็กๆ ที่จะรันบนคอม Windows ที่หน้างาน
ดึงข้อมูลการสแกนนิ้วจากเครื่อง **HIP/IEI MB40-VL** → ส่งเข้า **Google Sheets** (HRBTC)

---

## 1) เตรียมคอม Windows

### 1.1 ติดตั้ง Python
1. ดาวน์โหลด: https://www.python.org/downloads/
2. ตอนติดตั้ง **ติ๊ก ☐ Add Python to PATH** (สำคัญมาก!)
3. เสร็จแล้วเปิด PowerShell พิมพ์:
   ```powershell
   python --version
   ```
   ถ้าขึ้น `Python 3.11.x` หรือสูงกว่า = ติดตั้งสำเร็จ

### 1.2 ติดตั้งไลบรารี
เปิด PowerShell ที่โฟลเดอร์ `agent` แล้วพิมพ์:
```powershell
cd "C:\Users\PC\OneDrive\Documents\GitHub\HRBTC\agent"
pip install pyzk requests
```

> **หมายเหตุ:** `pyzk` ใช้สำหรับเครื่องที่ต่อ port 4370 (PUSH protocol)
> ถ้าเครื่องของคุณต่อ port 8080 (HTTP) ให้ข้าม pyzk ได้ (จะเขียน HTTP parser เพิ่มทีหลัง)

---

## 2) แก้ค่าใน `scan_agent.py`

เปิดไฟล์ `scan_agent.py` ด้วย Notepad แก้ค่าตรงนี้:

```python
CONFIG = {
    "DEVICE_IP": "192.168.1.230",      # ← IP เครื่องสแกนของคุณ
    "DEVICE_PORT": 8080,                # ← Port (8080 หรือ 4370)
    "DEVICE_USE_HTTP": True,            # ← True=HTTP, False=PUSH
    "DEVICE_SERIAL": "CJH8193260074",   # ← Serial ของเครื่อง
    "DEVICE_BRANCH": "HQ",              # ← รหัสสาขา (ตั้งเอง)
    "DEVICE_NAME": "สำนักงานใหญ่",       # ← ชื่อที่แสดงใน HRBTC
    "SERVER_URL": "https://script.google.com/...",  # ← Apps Script URL
    ...
}
```

---

## 3) Deploy Apps Script

1. เปิด https://script.google.com
2. เปิดโปรเจกต์ HRBTC
3. เพิ่มไฟล์ใหม่ ชื่อ `ScanAgent`
4. Copy เนื้อหาจาก `ScanAgent.gs` ไปวาง
5. ใน `Code.gs` ตรวจว่ามี `ADMIN_ACTIONS` ครอบคลุม actions ใหม่แล้ว (ดูใน `Code.gs` บรรทัด ~1224)
6. **Deploy > New deployment**
   - Type: Web app
   - Execute as: Me
   - Who has access: Anyone
7. Copy URL ใหม่ → เอาไปใส่ใน `SERVER_URL` ของ agent

---

## 4) ทดสอบ

เปิด PowerShell:
```powershell
cd "C:\Users\PC\OneDrive\Documents\GitHub\HRBTC\agent"
python scan_agent.py
```

ถ้าสำเร็จจะเห็น:
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

---

## 5) ตรวจสอบใน Google Sheets

1. เปิด Sheets ของ HRBTC
2. จะเห็น sheet ใหม่ 2 ตัว:
   - **Devices** — รายการเครื่องสแกน + สถานะ online/offline
   - **Attendance_raw** — ข้อมูลดิบที่ agent ส่งมา

---

## Troubleshooting

| ปัญหา | วิธีแก้ |
|--------|----------|
| `[FATAL] ลงทะเบียนไม่สำเร็จ` | เช็คว่า Apps Script deploy แล้ว และ URL ถูกต้อง |
| `[ERROR] fetch failed` | เช็ค IP/Port ของเครื่องสแกน, ping ได้มั้ย |
| `pyzk import error` | รัน `pip install pyzk` |
| ข้อมูลไม่เข้า Sheets | เช็ค `Attendance_raw` sheet ว่าถูกสร้าง + agent ต่อเน็ตได้ |

---

## โครงสร้างไฟล์

```
HRBTC/
├── Code.gs           (ไฟล์หลักเดิม — แก้แค่ 2 จุด)
├── ScanAgent.gs      (ไฟล์ใหม่ — handle agent requests)
└── agent/
    ├── scan_agent.py (Python agent — รันบน Windows)
    └── README.md     (ไฟล์นี้)
```
