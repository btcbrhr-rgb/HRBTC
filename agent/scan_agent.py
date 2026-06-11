"""
HRBTC Scan Agent
================
โปรแกรมเล็กๆ ที่ทำงานบนคอม Windows
ดึงข้อมูลการสแกนนิ้ว/หน้าจากเครื่อง MB40-VL (HIP/IEI)
แล้วส่งเข้า Google Apps Script (HRBTC) เพื่อเก็บใน Google Sheets

ใช้ pyzk (ZK/IKP PUSH protocol) — ดึงตรงจาก port 4370

วิธีใช้:
  1) ตั้งเครื่องสแกนนิ้วให้ใช้ port 4370 (PUSH protocol)
  2) แก้ค่า DEVICE_* และ SERVER_URL ด้านล่าง
  3) รัน: python scan_agent.py
  4) กด Ctrl+C เพื่อปิด
"""
import os
import sys
import time
import json
import socket
import struct
import hashlib
import platform
import urllib.request
import urllib.error
from datetime import datetime, timezone, timedelta

# ============================================================================
# CONFIG — แก้ค่าตรงนี้
# ============================================================================
CONFIG = {
    # ----- เครื่องสแกนนิ้ว -----
    "DEVICE_IP": "192.168.1.230",   # IP ของเครื่องสแกน
    "DEVICE_PORT": 4370,             # Port 4370 (PUSH protocol) — แนะนำ
    "DEVICE_MODEL": "MB40-VL",       # รุ่นเครื่อง
    "DEVICE_SERIAL": "CJH8193260074",# Serial Number (ดูจากหน้าจอ TAS Time)
    "DEVICE_BRANCH": "HQ",          # รหัสสาขา (ตั้งเอง เช่น HQ, KM3, PRJ-A)
    "DEVICE_NAME": "สำนักงานใหญ่",   # ชื่อที่แสดงในระบบ

    # ----- Apps Script (HRBTC) -----
    "SERVER_URL": "https://script.google.com/macros/s/AKfycbycaWVV_K5EA7gJ3WTfbUJN1VSQ7vLvSsDytdGu7dg6yiFjKMIjQtK6KaWdE6jmrjAYew/exec",
    "AGENT_VERSION": "1.0.0",

    # ----- การทำงาน -----
    "POLL_SECONDS": 60,              # ดึงข้อมูลทุก 60 วินาที
    "HEARTBEAT_SECONDS": 60,         # ส่ง heartbeat ทุก 60 วินาที
    "PUSH_BATCH": 200,               # ส่งข้อมูลครั้งละไม่เกิน 200 records
    "HTTP_TIMEOUT": 30,              # timeout สำหรับ HTTP request
    "ZK_TIMEOUT": 10,                # timeout สำหรับเชื่อมต่อเครื่องสแกน
}


# ============================================================================
# Device fingerprint
# ============================================================================
def get_device_id():
    """สร้าง deviceId ที่ไม่ซ้ำจาก Serial + Model + ชื่อเครื่อง"""
    raw = f"{CONFIG['DEVICE_MODEL']}-{CONFIG['DEVICE_SERIAL']}-{platform.node()}"
    return raw


def get_os_info():
    return f"{platform.system()} {platform.release()}"


# ============================================================================
# HTTP transport
# ============================================================================
def http_post(payload, timeout=None):
    """ส่ง POST ไป Apps Script"""
    if timeout is None:
        timeout = CONFIG["HTTP_TIMEOUT"]
    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        CONFIG["SERVER_URL"],
        data=data,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            body = resp.read().decode("utf-8")
            return json.loads(body)
    except urllib.error.URLError as e:
        return {"status": "error", "code": "NETWORK_ERROR", "message": str(e)}
    except Exception as e:
        return {"status": "error", "code": "UNKNOWN", "message": str(e)}


# ============================================================================
# ZK/IKP Protocol (PUSH protocol on port 4370)
# ใช้ pyzk ดึงข้อมูลการสแกนตรงจากเครื่อง
# ============================================================================
def zk_get_attendance(ip, port=4370):
    """
    ดึงข้อมูลการสแกนจากเครื่อง MB40-VL ผ่าน ZK PUSH protocol (port 4370)

    ZK Status codes (att.status):
      0 = Check-In (เข้า)
      1 = Check-Out (ออก)
      2 = Break-Out (ออกพัก)
      3 = Break-In (เข้าจากพัก)
      4 = OT-In (เข้า OT)
      5 = OT-Out (ออก OT)

    ZK Punch codes (att.punch):
      0 = Password
      1 = Fingerprint
      2 = Card
      15 = Face
    """
    try:
        from pyzk import ZK, const  # type: ignore
    except ImportError:
        print("[ERROR] ยังไม่ได้ติดตั้ง pyzk — รัน: pip install pyzk")
        return []

    records = []
    zk = ZK(ip, port=port, timeout=CONFIG["ZK_TIMEOUT"])
    conn = None
    try:
        conn = zk.connect()
        if not conn:
            print(f"[ERROR] เชื่อมต่อ {ip}:{port} ไม่ได้ — เช็ค IP/Port และเครื่องสแกนเปิดอยู่")
            return []

        # ดึงข้อมูลทั้งหมด (เครื่อง MB40-VL เก็บได้หลายหมื่น record)
        attendances = conn.get_attendance()
        print(f"  [DEBUG] พบ {len(attendances)} records ในเครื่องสแกน")

        for att in attendances:
            if not att or not att.user_id or not att.timestamp:
                continue
            records.append({
                "empId": str(att.user_id),
                "timestamp": att.timestamp.strftime("%Y-%m-%dT%H:%M:%S"),
                "type": int(att.status) if att.status is not None else 0,
                "punch": int(att.punch) if att.punch is not None else 1,
            })

    except Exception as e:
        print(f"[ERROR] ZK fetch failed: {e}")
    finally:
        if conn:
            try:
                conn.disconnect()
            except Exception:
                pass
    return records


# ============================================================================
# Local state — จำว่าดึง record ไหนไปแล้ว (กันส่งซ้ำทุกรอบ)
# ============================================================================
STATE_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), ".scan_agent_state.json")


def load_state():
    """โหลด state (timestamp ล่าสุดที่ดึงไป)"""
    try:
        if os.path.exists(STATE_FILE):
            with open(STATE_FILE, "r", encoding="utf-8") as f:
                return json.load(f)
    except Exception as e:
        print(f"[WARN] load state failed: {e}")
    return {"lastTimestamp": None}


def save_state(state):
    """บันทึก state"""
    try:
        with open(STATE_FILE, "w", encoding="utf-8") as f:
            json.dump(state, f, ensure_ascii=False, indent=2)
    except Exception as e:
        print(f"[WARN] save state failed: {e}")


def filter_new_records(records, state):
    """
    กรองเฉพาะ record ที่ใหม่กว่า lastTimestamp
    (เครื่องสแกนเก็บข้อมูลทั้งหมด เราดึงมาเช็ค timestamp)
    """
    if not state.get("lastTimestamp"):
        # รอบแรก — ดึงแค่ของเมื่อวาน+วันนี้ (กันส่งหลายพัน record ทันที)
        cutoff = datetime.now() - timedelta(days=2)
        return [r for r in records if r["timestamp"] >= cutoff.strftime("%Y-%m-%dT%H:%M:%S")]

    last_ts = state["lastTimestamp"]
    new_recs = [r for r in records if r["timestamp"] > last_ts]
    return new_recs


def fetch_attendance():
    """ดึงข้อมูลจากเครื่องสแกน + กรองเฉพาะ record ใหม่"""
    all_records = zk_get_attendance(CONFIG["DEVICE_IP"], CONFIG["DEVICE_PORT"])
    state = load_state()
    new_records = filter_new_records(all_records, state)
    return new_records, all_records, state


# ============================================================================
# Server interactions
# ============================================================================
def register_device():
    payload = {
        "action": "agentRegister",
        "deviceId": get_device_id(),
        "deviceName": CONFIG["DEVICE_NAME"],
        "branchCode": CONFIG["DEVICE_BRANCH"],
        "model": CONFIG["DEVICE_MODEL"],
        "serialNo": CONFIG["DEVICE_SERIAL"],
        "ipAddress": CONFIG["DEVICE_IP"],
        "port": CONFIG["DEVICE_PORT"],
        "agentVersion": CONFIG["AGENT_VERSION"],
        "osInfo": get_os_info(),
    }
    res = http_post(payload, timeout=15)
    print(f"[REGISTER] {res.get('message', res)}")
    return res.get("status") == "success"


def send_heartbeat(status="online", message="", stats=None):
    payload = {
        "action": "agentHeartbeat",
        "deviceId": get_device_id(),
        "status": status,
        "message": message,
        "stats": stats or {},
    }
    return http_post(payload, timeout=10)


def push_records(records):
    if not records:
        return {"status": "success", "data": {"inserted": 0, "skipped": 0}}
    payload = {
        "action": "agentPushTimeLog",
        "deviceId": get_device_id(),
        "branchCode": CONFIG["DEVICE_BRANCH"],
        "records": records,
    }
    return http_post(payload, timeout=30)


# ============================================================================
# Main loop
# ============================================================================
def main():
    print("=" * 60)
    print(f"  HRBTC Scan Agent v{CONFIG['AGENT_VERSION']}")
    print(f"  Device : {CONFIG['DEVICE_MODEL']} ({CONFIG['DEVICE_SERIAL']})")
    print(f"  IP:Port: {CONFIG['DEVICE_IP']}:{CONFIG['DEVICE_PORT']}")
    print(f"  Server : {CONFIG['SERVER_URL'][:60]}...")
    print(f"  Branch : {CONFIG['DEVICE_BRANCH']} — {CONFIG['DEVICE_NAME']}")
    print("=" * 60)

    # Register
    if not register_device():
        print("[FATAL] ลงทะเบียนไม่สำเร็จ — เช็ค SERVER_URL และเน็ต")
        sys.exit(1)

    last_heartbeat = 0
    last_fetch_at = None
    cycle = 0

    print("\n[START] เริ่มทำงาน — กด Ctrl+C เพื่อหยุด\n")

    while True:
        try:
            cycle += 1
            now = time.time()

            # 1) Heartbeat (ทุก HEARTBEAT_SECONDS)
            if now - last_heartbeat >= CONFIG["HEARTBEAT_SECONDS"]:
                stats = {
                    "lastFetchAt": last_fetch_at.isoformat() if last_fetch_at else None,
                    "cycle": cycle,
                }
                hb = send_heartbeat("online", "running", stats)
                if hb.get("status") != "success":
                    print(f"[WARN] heartbeat failed: {hb.get('message')}")
                last_heartbeat = now

            # 2) Fetch + Push (ทุก POLL_SECONDS)
            print(f"[CYCLE {cycle}] กำลังดึงข้อมูลจากเครื่องสแกน...")
            try:
                records, all_records, state = fetch_attendance()
            except Exception as e:
                print(f"[ERROR] fetch failed: {e}")
                records, all_records, state = [], [], load_state()

            last_fetch_at = datetime.now(timezone(timedelta(hours=7)))

            if records:
                # batch
                total_pushed = 0
                for i in range(0, len(records), CONFIG["PUSH_BATCH"]):
                    batch = records[i:i + CONFIG["PUSH_BATCH"]]
                    res = push_records(batch)
                    if res.get("status") == "success":
                        ins = res.get("data", {}).get("inserted", 0)
                        total_pushed += ins
                        print(f"  → batch {i//CONFIG['PUSH_BATCH']+1}: "
                              f"inserted={ins}/{len(batch)}")
                    else:
                        print(f"  → batch failed: {res.get('message')}")

                # อัปเดต state — เก็บ timestamp สูงสุดที่ส่งไปแล้ว
                max_ts = max(r["timestamp"] for r in records)
                state["lastTimestamp"] = max_ts
                save_state(state)
                print(f"[CYCLE {cycle}] ส่งข้อมูลเข้าระบบ {total_pushed} records "
                      f"(จากทั้งหมด {len(all_records)} ในเครื่อง)")
            else:
                print(f"[CYCLE {cycle}] ไม่มีข้อมูลใหม่ "
                      f"(เครื่องมี {len(all_records)} records)")

            time.sleep(CONFIG["POLL_SECONDS"])

        except KeyboardInterrupt:
            print("\n[STOP] ปิดโปรแกรม — bye")
            break
        except Exception as e:
            print(f"[ERROR] main loop: {e}")
            time.sleep(10)


if __name__ == "__main__":
    main()
