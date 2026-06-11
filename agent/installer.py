"""
HRBTC Scan Agent — Installer GUI
=================================
โปรแกรมติดตั้ง Scan Agent บน Windows
ใช้ Tkinter (ไม่ต้องลงเพิ่ม — มากับ Python)

ฟีเจอร์:
  1. ตรวจสอบ Python + ติดตั้ง pyzk อัตโนมัติ
  2. GUI กรอก Config เครื่องสแกน
  3. ทดสอบเชื่อมต่อเครื่องสแกน + Server
  4. บันทึก Config และ Deploy scan_agent.py
  5. ตั้ง Windows Task Scheduler ให้เปิดอัตโนมัติ

รันด้วย: python installer.py
"""

import os
import sys
import json
import socket
import subprocess
import threading
import urllib.request
import urllib.error
import winreg
import shutil
import textwrap
from pathlib import Path
from datetime import datetime

# ── Tkinter ────────────────────────────────────────────────────────────────
try:
    import tkinter as tk
    from tkinter import ttk, messagebox, filedialog, scrolledtext
except ImportError:
    print("[FATAL] Tkinter ไม่พบ — ติดตั้ง Python ใหม่และติ๊ก tcl/tk option")
    sys.exit(1)

# ── Constants ───────────────────────────────────────────────────────────────
APP_NAME   = "HRBTC Scan Agent"
APP_VER    = "1.0.0"
AGENT_FILE = "scan_agent.py"
STATE_FILE = ".scan_agent_state.json"
TASK_NAME  = "HRBTC_ScanAgent"

SERVER_URL = (
    "https://script.google.com/macros/s/"
    "AKfycbycaWVV_K5EA7gJ3WTfbUJN1VSQ7vLvSsDytdGu7dg6yiFjKMIjQtK6KaWdE6jmrjAYew/exec"
)

# สีธีม
CLR_BG      = "#0F172A"   # navy dark
CLR_CARD    = "#1E293B"   # card bg
CLR_BORDER  = "#334155"   # border
CLR_ACCENT  = "#6366F1"   # indigo
CLR_ACCENT2 = "#22D3EE"   # cyan
CLR_SUCCESS = "#22C55E"
CLR_WARN    = "#F59E0B"
CLR_ERROR   = "#EF4444"
CLR_TEXT    = "#F1F5F9"
CLR_MUTED   = "#94A3B8"
CLR_INPUT   = "#0F172A"

FONT_TITLE  = ("Segoe UI", 18, "bold")
FONT_HEAD   = ("Segoe UI", 11, "bold")
FONT_BODY   = ("Segoe UI", 10)
FONT_SMALL  = ("Segoe UI", 9)
FONT_MONO   = ("Consolas", 9)


# ═══════════════════════════════════════════════════════════════════════════════
# Helper utilities
# ═══════════════════════════════════════════════════════════════════════════════

def get_default_install_dir() -> str:
    home = Path.home()
    return str(home / "HRBTC_Agent")


def check_python_path() -> bool:
    """ตรวจสอบว่า python อยู่ใน PATH"""
    return shutil.which("python") is not None or shutil.which("py") is not None


def get_python_exe() -> str:
    if shutil.which("python"):
        return "python"
    if shutil.which("py"):
        return "py"
    return sys.executable


def check_pyzk_installed() -> bool:
    try:
        result = subprocess.run(
            [get_python_exe(), "-c", "import pyzk"],
            capture_output=True, timeout=10
        )
        return result.returncode == 0
    except Exception:
        return False


def test_port(ip: str, port: int, timeout: float = 5.0) -> bool:
    """ทดสอบ TCP connection ไปยัง IP:Port"""
    try:
        with socket.create_connection((ip, port), timeout=timeout):
            return True
    except Exception:
        return False


def test_server(url: str, timeout: int = 15) -> tuple[bool, str]:
    """ทดสอบเชื่อมต่อ Apps Script server"""
    payload = json.dumps({"action": "ping"}).encode("utf-8")
    req = urllib.request.Request(
        url, data=payload,
        headers={"Content-Type": "application/json"}, method="POST"
    )
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            body = resp.read().decode("utf-8")
            data = json.loads(body)
            return True, data.get("message", "OK")
    except urllib.error.HTTPError as e:
        return False, f"HTTP {e.code}: {e.reason}"
    except urllib.error.URLError as e:
        return False, f"URL Error: {e.reason}"
    except Exception as e:
        return False, str(e)


def build_agent_code(config: dict) -> str:
    """สร้างไฟล์ scan_agent.py พร้อม Config ที่กำหนด"""
    cfg = json.dumps(config, ensure_ascii=False, indent=4)
    return textwrap.dedent(f"""\
        \"\"\"
        HRBTC Scan Agent  v{APP_VER}
        ติดตั้งโดย: HRBTC Installer  {datetime.now():%Y-%m-%d %H:%M}
        \"\"\"
        import os, sys, time, json, socket, struct, hashlib, platform
        import urllib.request, urllib.error
        from datetime import datetime, timezone, timedelta

        CONFIG = {cfg}

        def get_device_id():
            raw = f"{{CONFIG['DEVICE_MODEL']}}-{{CONFIG['DEVICE_SERIAL']}}-{{platform.node()}}"
            return raw

        def get_os_info():
            return f"{{platform.system()}} {{platform.release()}}"

        def http_post(payload, timeout=None):
            if timeout is None:
                timeout = CONFIG["HTTP_TIMEOUT"]
            data = json.dumps(payload).encode("utf-8")
            req = urllib.request.Request(
                CONFIG["SERVER_URL"], data=data,
                headers={{"Content-Type": "application/json"}}, method="POST",
            )
            try:
                with urllib.request.urlopen(req, timeout=timeout) as resp:
                    return json.loads(resp.read().decode("utf-8"))
            except urllib.error.URLError as e:
                return {{"status": "error", "code": "NETWORK_ERROR", "message": str(e)}}
            except Exception as e:
                return {{"status": "error", "code": "UNKNOWN", "message": str(e)}}

        def zk_get_attendance(ip, port=4370):
            try:
                from pyzk import ZK
            except ImportError:
                print("[ERROR] ยังไม่ได้ติดตั้ง pyzk — รัน: pip install pyzk")
                return []
            records = []
            zk = ZK(ip, port=port, timeout=CONFIG["ZK_TIMEOUT"])
            conn = None
            try:
                conn = zk.connect()
                if not conn:
                    print(f"[ERROR] เชื่อมต่อ {{ip}}:{{port}} ไม่ได้")
                    return []
                attendances = conn.get_attendance()
                print(f"  [DEBUG] พบ {{len(attendances)}} records ในเครื่องสแกน")
                for att in attendances:
                    if not att or not att.user_id or not att.timestamp:
                        continue
                    records.append({{
                        "empId":     str(att.user_id),
                        "timestamp": att.timestamp.strftime("%Y-%m-%dT%H:%M:%S"),
                        "type":      int(att.status) if att.status is not None else 0,
                        "punch":     int(att.punch)  if att.punch  is not None else 1,
                    }})
            except Exception as e:
                print(f"[ERROR] ZK fetch failed: {{e}}")
            finally:
                if conn:
                    try: conn.disconnect()
                    except Exception: pass
            return records

        STATE_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), ".scan_agent_state.json")

        def load_state():
            try:
                if os.path.exists(STATE_FILE):
                    with open(STATE_FILE, "r", encoding="utf-8") as f:
                        return json.load(f)
            except Exception as e:
                print(f"[WARN] load state failed: {{e}}")
            return {{"lastTimestamp": None}}

        def save_state(state):
            try:
                with open(STATE_FILE, "w", encoding="utf-8") as f:
                    json.dump(state, f, ensure_ascii=False, indent=2)
            except Exception as e:
                print(f"[WARN] save state failed: {{e}}")

        def filter_new_records(records, state):
            if not state.get("lastTimestamp"):
                cutoff = datetime.now() - timedelta(days=2)
                return [r for r in records if r["timestamp"] >= cutoff.strftime("%Y-%m-%dT%H:%M:%S")]
            last_ts = state["lastTimestamp"]
            return [r for r in records if r["timestamp"] > last_ts]

        def fetch_attendance():
            all_records = zk_get_attendance(CONFIG["DEVICE_IP"], CONFIG["DEVICE_PORT"])
            state = load_state()
            new_records = filter_new_records(all_records, state)
            return new_records, all_records, state

        def register_device():
            payload = {{
                "action":       "agentRegister",
                "deviceId":     get_device_id(),
                "deviceName":   CONFIG["DEVICE_NAME"],
                "branchCode":   CONFIG["DEVICE_BRANCH"],
                "model":        CONFIG["DEVICE_MODEL"],
                "serialNo":     CONFIG["DEVICE_SERIAL"],
                "ipAddress":    CONFIG["DEVICE_IP"],
                "port":         CONFIG["DEVICE_PORT"],
                "agentVersion": CONFIG["AGENT_VERSION"],
                "osInfo":       get_os_info(),
            }}
            res = http_post(payload, timeout=15)
            print(f"[REGISTER] {{res.get('message', res)}}")
            return res.get("status") == "success"

        def send_heartbeat(status="online", message="", stats=None):
            return http_post({{
                "action":   "agentHeartbeat",
                "deviceId": get_device_id(),
                "status":   status,
                "message":  message,
                "stats":    stats or {{}},
            }}, timeout=10)

        def push_records(records):
            if not records:
                return {{"status": "success", "data": {{"inserted": 0, "skipped": 0}}}}
            return http_post({{
                "action":     "agentPushTimeLog",
                "deviceId":   get_device_id(),
                "branchCode": CONFIG["DEVICE_BRANCH"],
                "records":    records,
            }}, timeout=30)

        def main():
            print("=" * 60)
            print(f"  HRBTC Scan Agent v{{CONFIG['AGENT_VERSION']}}")
            print(f"  Device : {{CONFIG['DEVICE_MODEL']}} ({{CONFIG['DEVICE_SERIAL']}})")
            print(f"  IP:Port: {{CONFIG['DEVICE_IP']}}:{{CONFIG['DEVICE_PORT']}}")
            print(f"  Server : {{CONFIG['SERVER_URL'][:60]}}...")
            print(f"  Branch : {{CONFIG['DEVICE_BRANCH']}} — {{CONFIG['DEVICE_NAME']}}")
            print("=" * 60)
            if not register_device():
                print("[FATAL] ลงทะเบียนไม่สำเร็จ — เช็ค SERVER_URL และเน็ต")
                sys.exit(1)
            last_heartbeat = 0
            last_fetch_at  = None
            cycle = 0
            print("\\n[START] เริ่มทำงาน — กด Ctrl+C เพื่อหยุด\\n")
            while True:
                try:
                    cycle += 1
                    now = time.time()
                    if now - last_heartbeat >= CONFIG["HEARTBEAT_SECONDS"]:
                        stats = {{"lastFetchAt": last_fetch_at.isoformat() if last_fetch_at else None, "cycle": cycle}}
                        hb = send_heartbeat("online", "running", stats)
                        if hb.get("status") != "success":
                            print(f"[WARN] heartbeat failed: {{hb.get('message')}}")
                        last_heartbeat = now
                    print(f"[CYCLE {{cycle}}] กำลังดึงข้อมูลจากเครื่องสแกน...")
                    try:
                        records, all_records, state = fetch_attendance()
                    except Exception as e:
                        print(f"[ERROR] fetch failed: {{e}}")
                        records, all_records, state = [], [], load_state()
                    last_fetch_at = datetime.now(timezone(timedelta(hours=7)))
                    if records:
                        total_pushed = 0
                        for i in range(0, len(records), CONFIG["PUSH_BATCH"]):
                            batch = records[i:i + CONFIG["PUSH_BATCH"]]
                            res = push_records(batch)
                            if res.get("status") == "success":
                                ins = res.get("data", {{}}).get("inserted", 0)
                                total_pushed += ins
                                print(f"  → batch {{i//CONFIG['PUSH_BATCH']+1}}: inserted={{ins}}/{{len(batch)}}")
                            else:
                                print(f"  → batch failed: {{res.get('message')}}")
                        max_ts = max(r["timestamp"] for r in records)
                        state["lastTimestamp"] = max_ts
                        save_state(state)
                        print(f"[CYCLE {{cycle}}] ส่งข้อมูลเข้าระบบ {{total_pushed}} records (จากทั้งหมด {{len(all_records)}} ในเครื่อง)")
                    else:
                        print(f"[CYCLE {{cycle}}] ไม่มีข้อมูลใหม่ (เครื่องมี {{len(all_records)}} records)")
                    time.sleep(CONFIG["POLL_SECONDS"])
                except KeyboardInterrupt:
                    print("\\n[STOP] ปิดโปรแกรม — bye")
                    break
                except Exception as e:
                    print(f"[ERROR] main loop: {{e}}")
                    time.sleep(10)

        if __name__ == "__main__":
            main()
        """)


def create_task_scheduler(python_exe: str, agent_path: str) -> tuple[bool, str]:
    """ตั้ง Windows Task Scheduler ให้รัน agent อัตโนมัติเมื่อ Windows เริ่ม"""
    xml_content = f"""<?xml version="1.0" encoding="UTF-16"?>
<Task version="1.2" xmlns="http://schemas.microsoft.com/windows/2004/02/mit/task">
  <RegistrationInfo>
    <Description>HRBTC Scan Agent — ดึงข้อมูลการสแกนนิ้วจากเครื่อง MB40-VL</Description>
  </RegistrationInfo>
  <Triggers>
    <BootTrigger>
      <Enabled>true</Enabled>
      <Delay>PT30S</Delay>
    </BootTrigger>
    <LogonTrigger>
      <Enabled>false</Enabled>
    </LogonTrigger>
  </Triggers>
  <Settings>
    <MultipleInstancesPolicy>IgnoreNew</MultipleInstancesPolicy>
    <DisallowStartIfOnBatteries>false</DisallowStartIfOnBatteries>
    <StopIfGoingOnBatteries>false</StopIfGoingOnBatteries>
    <ExecutionTimeLimit>PT0S</ExecutionTimeLimit>
    <RestartOnFailure>
      <Interval>PT1M</Interval>
      <Count>999</Count>
    </RestartOnFailure>
    <Enabled>true</Enabled>
  </Settings>
  <Actions>
    <Exec>
      <Command>{python_exe}</Command>
      <Arguments>"{agent_path}"</Arguments>
      <WorkingDirectory>{os.path.dirname(agent_path)}</WorkingDirectory>
    </Exec>
  </Actions>
</Task>"""

    xml_path = os.path.join(os.environ.get("TEMP", "C:\\Temp"), "hrbtc_task.xml")
    try:
        with open(xml_path, "w", encoding="utf-16") as f:
            f.write(xml_content)

        result = subprocess.run(
            ["schtasks", "/Create", "/TN", TASK_NAME, "/XML", xml_path, "/F"],
            capture_output=True, text=True, timeout=30
        )
        os.remove(xml_path)
        if result.returncode == 0:
            return True, "ตั้ง Task Scheduler สำเร็จ — Agent จะเริ่มเมื่อ Windows บูต"
        else:
            return False, result.stderr.strip() or result.stdout.strip()
    except Exception as e:
        return False, str(e)


def remove_task_scheduler() -> tuple[bool, str]:
    try:
        result = subprocess.run(
            ["schtasks", "/Delete", "/TN", TASK_NAME, "/F"],
            capture_output=True, text=True, timeout=10
        )
        if result.returncode == 0:
            return True, "ลบ Task Scheduler สำเร็จ"
        return False, result.stderr.strip()
    except Exception as e:
        return False, str(e)


def install_pyzk(log_callback) -> bool:
    """ติดตั้ง pyzk ผ่าน pip"""
    py = get_python_exe()
    try:
        proc = subprocess.Popen(
            [py, "-m", "pip", "install", "pyzk", "--upgrade"],
            stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
            text=True, bufsize=1
        )
        for line in proc.stdout:
            log_callback(line.rstrip())
        proc.wait()
        return proc.returncode == 0
    except Exception as e:
        log_callback(f"[ERROR] {e}")
        return False


# ═══════════════════════════════════════════════════════════════════════════════
# GUI Application
# ═══════════════════════════════════════════════════════════════════════════════

class HRBTCInstaller(tk.Tk):
    def __init__(self):
        super().__init__()
        self.title(f"{APP_NAME} Installer  v{APP_VER}")
        self.geometry("780x640")
        self.minsize(720, 580)
        self.configure(bg=CLR_BG)
        self.resizable(True, True)

        # ── icon (ถ้ามี) ──
        try:
            self.iconbitmap(default="")
        except Exception:
            pass

        # ── State ──
        self.install_dir = tk.StringVar(value=get_default_install_dir())
        self.device_ip   = tk.StringVar(value="192.168.1.230")
        self.device_port = tk.StringVar(value="4370")
        self.device_model  = tk.StringVar(value="MB40-VL")
        self.device_serial = tk.StringVar(value="")
        self.device_branch = tk.StringVar(value="HQ")
        self.device_name   = tk.StringVar(value="สำนักงานใหญ่")
        self.poll_seconds  = tk.StringVar(value="60")
        self.autostart_var = tk.BooleanVar(value=True)

        self._build_ui()
        self._check_env_status()

    # ─────────────────────────────────────────────────────────────────────────
    # UI Construction
    # ─────────────────────────────────────────────────────────────────────────

    def _build_ui(self):
        # ── Header ──
        header = tk.Frame(self, bg=CLR_ACCENT, height=64)
        header.pack(fill="x")
        header.pack_propagate(False)

        tk.Label(
            header, text=f"🔧  {APP_NAME}  Installer",
            font=FONT_TITLE, fg="white", bg=CLR_ACCENT, pady=14
        ).pack(side="left", padx=20)
        tk.Label(
            header, text=f"v{APP_VER}",
            font=FONT_SMALL, fg="#C7D2FE", bg=CLR_ACCENT
        ).pack(side="right", padx=20)

        # ── Notebook (tabs) ──
        style = ttk.Style(self)
        style.theme_use("default")
        style.configure("TNotebook",           background=CLR_BG, borderwidth=0)
        style.configure("TNotebook.Tab",       background=CLR_CARD, foreground=CLR_MUTED,
                        padding=[14, 8], font=FONT_BODY)
        style.map("TNotebook.Tab",
                  background=[("selected", CLR_ACCENT)],
                  foreground=[("selected", "white")])

        self.nb = ttk.Notebook(self)
        self.nb.pack(fill="both", expand=True, padx=0, pady=0)

        self._tab_check   = self._build_tab_check()
        self._tab_config  = self._build_tab_config()
        self._tab_install = self._build_tab_install()
        self._tab_log     = self._build_tab_log()

        self.nb.add(self._tab_check,   text=" 1. ตรวจสอบระบบ ")
        self.nb.add(self._tab_config,  text=" 2. ตั้งค่า Agent ")
        self.nb.add(self._tab_install, text=" 3. ติดตั้ง ")
        self.nb.add(self._tab_log,     text=" 4. Log ")

    # ── Tab 1: System Check ─────────────────────────────────────────────────
    def _build_tab_check(self) -> tk.Frame:
        tab = tk.Frame(self.nb, bg=CLR_BG)

        self._make_section_title(tab, "🔍 ตรวจสอบสภาพแวดล้อม")

        # Status grid
        grid = tk.Frame(tab, bg=CLR_BG)
        grid.pack(padx=24, pady=8, fill="x")

        items = [
            ("python_row",  "🐍 Python",         "ตรวจสอบ..."),
            ("pyzk_row",    "📦 pyzk Library",   "ตรวจสอบ..."),
            ("net_row",     "🌐 เน็ต / Server",   "ตรวจสอบ..."),
        ]
        self._status_labels = {}
        for key, label, default in items:
            row = tk.Frame(grid, bg=CLR_CARD, pady=10, padx=14)
            row.pack(fill="x", pady=4)
            tk.Label(row, text=label, font=FONT_HEAD, fg=CLR_TEXT, bg=CLR_CARD,
                     width=20, anchor="w").pack(side="left")
            lbl = tk.Label(row, text=default, font=FONT_BODY, fg=CLR_MUTED, bg=CLR_CARD)
            lbl.pack(side="left", padx=8)
            self._status_labels[key] = lbl

        # Buttons
        btn_frame = tk.Frame(tab, bg=CLR_BG)
        btn_frame.pack(pady=12)
        self._make_btn(btn_frame, "🔄  ตรวจสอบอีกครั้ง", self._check_env_status).pack(side="left", padx=6)
        self._make_btn(btn_frame, "📦  ติดตั้ง pyzk", self._install_pyzk_gui,
                       bg=CLR_WARN).pack(side="left", padx=6)

        # Info
        info = tk.Frame(tab, bg=CLR_CARD, padx=14, pady=10)
        info.pack(padx=24, pady=8, fill="x")
        tk.Label(info, text="💡 คำแนะนำ", font=FONT_HEAD, fg=CLR_ACCENT2, bg=CLR_CARD).pack(anchor="w")
        for txt in [
            "• Python 3.9+ ต้องติดตั้งและติ๊ก 'Add Python to PATH'",
            "• pyzk เป็นไลบรารีที่ใช้คุยกับเครื่องสแกนนิ้ว",
            "• ถ้าติดตั้ง pyzk ไม่ผ่าน ให้รันใน Admin PowerShell",
        ]:
            tk.Label(info, text=txt, font=FONT_SMALL, fg=CLR_MUTED,
                     bg=CLR_CARD, anchor="w").pack(anchor="w", pady=1)

        return tab

    # ── Tab 2: Config ───────────────────────────────────────────────────────
    def _build_tab_config(self) -> tk.Frame:
        tab = tk.Frame(self.nb, bg=CLR_BG)

        canvas = tk.Canvas(tab, bg=CLR_BG, highlightthickness=0)
        scroll = ttk.Scrollbar(tab, orient="vertical", command=canvas.yview)
        canvas.configure(yscrollcommand=scroll.set)
        scroll.pack(side="right", fill="y")
        canvas.pack(side="left", fill="both", expand=True)

        inner = tk.Frame(canvas, bg=CLR_BG)
        win_id = canvas.create_window((0, 0), window=inner, anchor="nw")

        def on_resize(e):
            canvas.itemconfig(win_id, width=e.width)
        canvas.bind("<Configure>", on_resize)
        inner.bind("<Configure>", lambda e: canvas.configure(
            scrollregion=canvas.bbox("all")))

        # ── โฟลเดอร์ติดตั้ง ──
        self._make_section_title(inner, "📁 โฟลเดอร์ติดตั้ง")
        dir_row = tk.Frame(inner, bg=CLR_CARD, pady=10, padx=14)
        dir_row.pack(padx=24, pady=4, fill="x")
        tk.Label(dir_row, text="ที่เก็บไฟล์ Agent:", font=FONT_BODY,
                 fg=CLR_TEXT, bg=CLR_CARD, width=18, anchor="w").grid(row=0, column=0, sticky="w")
        self._make_entry(dir_row, self.install_dir, width=36).grid(row=0, column=1, padx=6)
        self._make_btn(dir_row, "เลือก", self._browse_dir, padx=6).grid(row=0, column=2)

        # ── เครื่องสแกน ──
        self._make_section_title(inner, "📡 เครื่องสแกนนิ้ว")
        fields_scan = [
            ("IP เครื่องสแกน",   self.device_ip,     "เช่น 192.168.1.230"),
            ("Port",              self.device_port,   "4370 (ZK) หรือ 8080 (HTTP)"),
            ("รุ่นเครื่อง",       self.device_model,  "เช่น MB40-VL"),
            ("Serial Number",    self.device_serial, "ดูจากหน้าจอ TAS Time บนเครื่อง"),
            ("รหัสสาขา",         self.device_branch, "เช่น HQ, KM3, SITE-A"),
            ("ชื่อเครื่อง",       self.device_name,   "ชื่อที่แสดงในระบบ HRBTC"),
        ]
        scan_frame = tk.Frame(inner, bg=CLR_CARD, padx=14, pady=10)
        scan_frame.pack(padx=24, pady=4, fill="x")
        for i, (label, var, hint) in enumerate(fields_scan):
            self._make_field_row(scan_frame, i, label, var, hint)

        # ── ปุ่มทดสอบ ──
        test_row = tk.Frame(inner, bg=CLR_BG)
        test_row.pack(padx=24, pady=8)
        self._make_btn(test_row, "🔌  ทดสอบเชื่อมต่อเครื่องสแกน",
                       self._test_device).pack(side="left", padx=6)
        self._make_btn(test_row, "🌐  ทดสอบ Server HRBTC",
                       self._test_server).pack(side="left", padx=6)

        # ── การทำงาน ──
        self._make_section_title(inner, "⚙️ การทำงาน")
        ops_frame = tk.Frame(inner, bg=CLR_CARD, padx=14, pady=10)
        ops_frame.pack(padx=24, pady=4, fill="x")
        self._make_field_row(ops_frame, 0, "ดึงข้อมูลทุก (วินาที)", self.poll_seconds,
                             "แนะนำ: 60 วินาที")
        autostart_row = tk.Frame(ops_frame, bg=CLR_CARD)
        autostart_row.grid(row=1, column=0, columnspan=3, sticky="w", pady=4)
        tk.Checkbutton(
            autostart_row, text="ตั้งให้ Agent เปิดอัตโนมัติเมื่อ Windows บูต (Task Scheduler)",
            variable=self.autostart_var,
            bg=CLR_CARD, fg=CLR_TEXT, selectcolor=CLR_ACCENT,
            activebackground=CLR_CARD, activeforeground=CLR_TEXT,
            font=FONT_BODY
        ).pack(anchor="w")

        return tab

    # ── Tab 3: Install ──────────────────────────────────────────────────────
    def _build_tab_install(self) -> tk.Frame:
        tab = tk.Frame(self.nb, bg=CLR_BG)

        self._make_section_title(tab, "🚀 ติดตั้ง / อัปเดต Agent")

        # Progress
        prog_frame = tk.Frame(tab, bg=CLR_CARD, padx=14, pady=14)
        prog_frame.pack(padx=24, pady=8, fill="x")

        self._progress_lbl = tk.Label(
            prog_frame, text="พร้อมติดตั้ง", font=FONT_BODY, fg=CLR_MUTED, bg=CLR_CARD
        )
        self._progress_lbl.pack(anchor="w", pady=(0, 8))

        style = ttk.Style()
        style.configure("Accent.Horizontal.TProgressbar",
                        troughcolor=CLR_BORDER, background=CLR_ACCENT, thickness=8)
        self._progress_bar = ttk.Progressbar(
            prog_frame, style="Accent.Horizontal.TProgressbar",
            mode="determinate", length=680
        )
        self._progress_bar.pack(fill="x")

        # Steps
        steps_frame = tk.Frame(tab, bg=CLR_CARD, padx=14, pady=10)
        steps_frame.pack(padx=24, pady=8, fill="x")
        tk.Label(steps_frame, text="ขั้นตอนการติดตั้ง:", font=FONT_HEAD,
                 fg=CLR_TEXT, bg=CLR_CARD).pack(anchor="w", pady=(0, 6))

        self._step_labels = {}
        steps = [
            ("s1", "สร้างโฟลเดอร์ติดตั้ง"),
            ("s2", "คัดลอก scan_agent.py พร้อม Config"),
            ("s3", "ตรวจสอบ/ติดตั้ง pyzk"),
            ("s4", "ตั้ง Windows Task Scheduler"),
            ("s5", "เสร็จสิ้น"),
        ]
        for key, text in steps:
            row = tk.Frame(steps_frame, bg=CLR_CARD)
            row.pack(anchor="w", pady=2)
            dot = tk.Label(row, text="⬜", font=FONT_BODY, fg=CLR_MUTED, bg=CLR_CARD)
            dot.pack(side="left")
            lbl = tk.Label(row, text=f"  {text}", font=FONT_BODY, fg=CLR_MUTED, bg=CLR_CARD)
            lbl.pack(side="left")
            self._step_labels[key] = (dot, lbl)

        # Action buttons
        btn_frame = tk.Frame(tab, bg=CLR_BG)
        btn_frame.pack(pady=16)
        self._install_btn = self._make_btn(
            btn_frame, "🚀  เริ่มติดตั้ง", self._start_install,
            bg=CLR_SUCCESS, font=("Segoe UI", 11, "bold"), padx=20, pady=8
        )
        self._install_btn.pack(side="left", padx=8)

        self._make_btn(
            btn_frame, "🗑️  ถอนการติดตั้ง Task Scheduler",
            self._uninstall_task, bg=CLR_ERROR
        ).pack(side="left", padx=8)

        self._make_btn(
            btn_frame, "▶️  รัน Agent ทันที",
            self._run_agent_now, bg=CLR_WARN
        ).pack(side="left", padx=8)

        return tab

    # ── Tab 4: Log ──────────────────────────────────────────────────────────
    def _build_tab_log(self) -> tk.Frame:
        tab = tk.Frame(self.nb, bg=CLR_BG)
        self._make_section_title(tab, "📋 Log การทำงาน")

        self._log_box = scrolledtext.ScrolledText(
            tab, bg="#0D1117", fg="#A5F3FC", font=FONT_MONO,
            state="disabled", relief="flat", borderwidth=0,
            insertbackground=CLR_TEXT
        )
        self._log_box.pack(fill="both", expand=True, padx=24, pady=(0, 12))

        tk.Button(
            tab, text="🗑️  ล้าง Log",
            command=self._clear_log,
            bg=CLR_BORDER, fg=CLR_TEXT, relief="flat",
            font=FONT_SMALL, cursor="hand2", padx=10, pady=4
        ).pack(pady=(0, 12))

        return tab

    # ─────────────────────────────────────────────────────────────────────────
    # Helper widget builders
    # ─────────────────────────────────────────────────────────────────────────

    def _make_section_title(self, parent, text: str):
        f = tk.Frame(parent, bg=CLR_BG)
        f.pack(padx=24, pady=(16, 4), fill="x")
        tk.Label(f, text=text, font=FONT_HEAD, fg=CLR_ACCENT2, bg=CLR_BG).pack(side="left")
        tk.Frame(f, bg=CLR_BORDER, height=1).pack(side="left", fill="x", expand=True, padx=(8, 0), pady=6)

    def _make_entry(self, parent, var: tk.StringVar, width=24) -> tk.Entry:
        return tk.Entry(
            parent, textvariable=var, width=width,
            bg=CLR_INPUT, fg=CLR_TEXT, font=FONT_BODY,
            insertbackground=CLR_TEXT, relief="flat",
            highlightthickness=1, highlightbackground=CLR_BORDER,
            highlightcolor=CLR_ACCENT
        )

    def _make_btn(self, parent, text: str, cmd, bg=CLR_ACCENT,
                  font=FONT_BODY, padx=14, pady=6) -> tk.Button:
        return tk.Button(
            parent, text=text, command=cmd,
            bg=bg, fg="white", font=font,
            relief="flat", cursor="hand2",
            padx=padx, pady=pady,
            activebackground=CLR_BORDER, activeforeground="white"
        )

    def _make_field_row(self, parent, row: int, label: str, var: tk.StringVar, hint: str):
        tk.Label(parent, text=label + ":", font=FONT_BODY, fg=CLR_TEXT,
                 bg=CLR_CARD, width=20, anchor="w").grid(
            row=row, column=0, sticky="w", pady=5)
        entry = self._make_entry(parent, var, width=28)
        entry.grid(row=row, column=1, padx=8, sticky="w")
        tk.Label(parent, text=hint, font=FONT_SMALL, fg=CLR_MUTED,
                 bg=CLR_CARD).grid(row=row, column=2, sticky="w", padx=4)

    # ─────────────────────────────────────────────────────────────────────────
    # Logging
    # ─────────────────────────────────────────────────────────────────────────

    def _log(self, msg: str):
        def _append():
            self._log_box.configure(state="normal")
            ts = datetime.now().strftime("%H:%M:%S")
            self._log_box.insert("end", f"[{ts}] {msg}\n")
            self._log_box.see("end")
            self._log_box.configure(state="disabled")
        self.after(0, _append)

    def _clear_log(self):
        self._log_box.configure(state="normal")
        self._log_box.delete("1.0", "end")
        self._log_box.configure(state="disabled")

    # ─────────────────────────────────────────────────────────────────────────
    # Actions
    # ─────────────────────────────────────────────────────────────────────────

    def _browse_dir(self):
        d = filedialog.askdirectory(title="เลือกโฟลเดอร์ติดตั้ง")
        if d:
            self.install_dir.set(d)

    def _set_status(self, key: str, text: str, ok: bool | None = None):
        lbl = self._status_labels[key]
        if ok is True:
            lbl.configure(text=f"✅  {text}", fg=CLR_SUCCESS)
        elif ok is False:
            lbl.configure(text=f"❌  {text}", fg=CLR_ERROR)
        else:
            lbl.configure(text=f"🔄  {text}", fg=CLR_WARN)

    def _check_env_status(self):
        def run():
            # Python
            self._set_status("python_row", "ตรวจสอบ...")
            if check_python_path():
                py = get_python_exe()
                res = subprocess.run([py, "--version"], capture_output=True, text=True)
                ver = res.stdout.strip() or res.stderr.strip()
                self._set_status("python_row", ver, True)
                self._log(f"Python: {ver}")
            else:
                self._set_status("python_row", "ไม่พบ Python — ติดตั้งจาก python.org", False)
                self._log("Python: ไม่พบ")

            # pyzk
            self._set_status("pyzk_row", "ตรวจสอบ...")
            if check_pyzk_installed():
                self._set_status("pyzk_row", "ติดตั้งแล้ว", True)
                self._log("pyzk: ติดตั้งแล้ว")
            else:
                self._set_status("pyzk_row", "ยังไม่ได้ติดตั้ง — กดปุ่ม 'ติดตั้ง pyzk'", False)
                self._log("pyzk: ยังไม่ได้ติดตั้ง")

            # Server
            self._set_status("net_row", "ตรวจสอบ...")
            ok, msg = test_server(SERVER_URL, timeout=10)
            self._set_status("net_row", f"HRBTC Server: {msg}" if ok else f"ข้อผิดพลาด: {msg}", ok)
            self._log(f"Server: {msg}")

        threading.Thread(target=run, daemon=True).start()

    def _install_pyzk_gui(self):
        self.nb.select(3)  # switch to log tab
        self._log("=== ติดตั้ง pyzk ===")

        def run():
            ok = install_pyzk(self._log)
            if ok:
                self._log("✅ ติดตั้ง pyzk สำเร็จ")
                messagebox.showinfo("สำเร็จ", "ติดตั้ง pyzk สำเร็จแล้ว!")
            else:
                self._log("❌ ติดตั้ง pyzk ไม่สำเร็จ — ลองรัน installer ในฐานะ Administrator")
                messagebox.showerror("ข้อผิดพลาด",
                    "ติดตั้ง pyzk ไม่สำเร็จ\nลองคลิกขวาที่ installer แล้ว 'Run as administrator'")
            self._check_env_status()

        threading.Thread(target=run, daemon=True).start()

    def _test_device(self):
        ip   = self.device_ip.get().strip()
        port = int(self.device_port.get().strip())
        self._log(f"ทดสอบเชื่อมต่อเครื่องสแกน {ip}:{port} ...")

        def run():
            ok = test_port(ip, port)
            if ok:
                self._log(f"✅ เชื่อมต่อ {ip}:{port} สำเร็จ")
                messagebox.showinfo("เชื่อมต่อสำเร็จ",
                    f"✅ เชื่อมต่อเครื่องสแกน {ip}:{port} ได้!")
            else:
                self._log(f"❌ เชื่อมต่อ {ip}:{port} ไม่ได้ — เช็ค IP/Port และเครื่องสแกนเปิดอยู่")
                messagebox.showwarning("เชื่อมต่อไม่ได้",
                    f"❌ ไม่สามารถเชื่อมต่อ {ip}:{port}\n"
                    "• เช็คว่าเครื่องสแกนเปิดอยู่\n"
                    "• เช็ค IP และ Port\n"
                    "• อยู่ใน LAN เดียวกับเครื่องสแกน")

        threading.Thread(target=run, daemon=True).start()

    def _test_server(self):
        self._log("ทดสอบเชื่อมต่อ HRBTC Server ...")

        def run():
            ok, msg = test_server(SERVER_URL)
            if ok:
                self._log(f"✅ Server: {msg}")
                messagebox.showinfo("Server OK", f"✅ เชื่อมต่อ HRBTC Server สำเร็จ\n{msg}")
            else:
                self._log(f"❌ Server: {msg}")
                messagebox.showerror("Server Error",
                    f"❌ เชื่อมต่อ Server ไม่ได้\n{msg}\n\nเช็คการเชื่อมต่ออินเตอร์เน็ต")

        threading.Thread(target=run, daemon=True).start()

    def _set_step(self, key: str, state: str):
        """state: pending | running | done | error"""
        dot, lbl = self._step_labels[key]
        icons   = {"pending": ("⬜", CLR_MUTED), "running": ("🔄", CLR_WARN),
                   "done":    ("✅", CLR_SUCCESS), "error":  ("❌", CLR_ERROR)}
        icon, color = icons.get(state, ("⬜", CLR_MUTED))
        self.after(0, lambda: dot.configure(text=icon))
        self.after(0, lambda: lbl.configure(fg=color))

    def _update_progress(self, val: int, msg: str):
        self.after(0, lambda: self._progress_bar.configure(value=val))
        self.after(0, lambda: self._progress_lbl.configure(text=msg))

    def _start_install(self):
        # Validate
        if not self.device_serial.get().strip():
            messagebox.showwarning("กรอกข้อมูลไม่ครบ",
                "กรุณากรอก Serial Number ของเครื่องสแกนก่อน")
            self.nb.select(1)
            return

        self._install_btn.configure(state="disabled")
        self.nb.select(2)

        def run():
            try:
                self._do_install()
            except Exception as e:
                self._log(f"[FATAL] {e}")
                messagebox.showerror("ข้อผิดพลาด", str(e))
            finally:
                self.after(0, lambda: self._install_btn.configure(state="normal"))

        threading.Thread(target=run, daemon=True).start()

    def _do_install(self):
        steps = ["s1", "s2", "s3", "s4", "s5"]
        for s in steps:
            self._set_step(s, "pending")

        install_path = Path(self.install_dir.get().strip())

        # Step 1: Create folder
        self._set_step("s1", "running")
        self._update_progress(10, "สร้างโฟลเดอร์...")
        self._log(f"สร้างโฟลเดอร์: {install_path}")
        try:
            install_path.mkdir(parents=True, exist_ok=True)
            self._set_step("s1", "done")
            self._log("✅ สร้างโฟลเดอร์สำเร็จ")
        except Exception as e:
            self._set_step("s1", "error")
            self._log(f"❌ สร้างโฟลเดอร์ไม่ได้: {e}")
            self._update_progress(0, f"ข้อผิดพลาด: {e}")
            return

        # Step 2: Write agent
        self._set_step("s2", "running")
        self._update_progress(30, "เขียนไฟล์ Agent...")
        config = {
            "DEVICE_IP":          self.device_ip.get().strip(),
            "DEVICE_PORT":        int(self.device_port.get().strip()),
            "DEVICE_MODEL":       self.device_model.get().strip(),
            "DEVICE_SERIAL":      self.device_serial.get().strip(),
            "DEVICE_BRANCH":      self.device_branch.get().strip(),
            "DEVICE_NAME":        self.device_name.get().strip(),
            "SERVER_URL":         SERVER_URL,
            "AGENT_VERSION":      APP_VER,
            "POLL_SECONDS":       int(self.poll_seconds.get().strip()),
            "HEARTBEAT_SECONDS":  60,
            "PUSH_BATCH":         200,
            "HTTP_TIMEOUT":       30,
            "ZK_TIMEOUT":         10,
        }
        try:
            agent_path = install_path / AGENT_FILE
            code = build_agent_code(config)
            agent_path.write_text(code, encoding="utf-8")
            self._set_step("s2", "done")
            self._log(f"✅ บันทึก {agent_path}")
        except Exception as e:
            self._set_step("s2", "error")
            self._log(f"❌ เขียนไฟล์ไม่ได้: {e}")
            self._update_progress(0, f"ข้อผิดพลาด: {e}")
            return

        # Step 3: pyzk
        self._set_step("s3", "running")
        self._update_progress(55, "ตรวจสอบ pyzk...")
        if check_pyzk_installed():
            self._log("✅ pyzk ติดตั้งแล้ว — ข้ามขั้นตอนนี้")
            self._set_step("s3", "done")
        else:
            self._log("กำลังติดตั้ง pyzk...")
            ok = install_pyzk(self._log)
            if ok:
                self._set_step("s3", "done")
                self._log("✅ ติดตั้ง pyzk สำเร็จ")
            else:
                self._set_step("s3", "error")
                self._log("⚠️ ติดตั้ง pyzk ไม่สำเร็จ — Agent ยังใช้ได้แต่ไม่สามารถดึงข้อมูลจากเครื่องสแกนได้")

        # Step 4: Task Scheduler
        self._set_step("s4", "running")
        self._update_progress(75, "ตั้ง Task Scheduler...")
        if self.autostart_var.get():
            py_exe = get_python_exe()
            ok, msg = create_task_scheduler(py_exe, str(agent_path))
            if ok:
                self._set_step("s4", "done")
                self._log(f"✅ {msg}")
            else:
                self._set_step("s4", "error")
                self._log(f"⚠️ Task Scheduler: {msg} — ลองรันในฐานะ Administrator")
        else:
            self._set_step("s4", "done")
            self._log("⬛ ข้าม Task Scheduler (ไม่ได้เลือก)")

        # Step 5: Done
        self._set_step("s5", "done")
        self._update_progress(100, "✅ ติดตั้งเสร็จสมบูรณ์!")
        self._log(f"=== ติดตั้งเสร็จสมบูรณ์ ===")
        self._log(f"📂 ไฟล์ Agent: {agent_path}")

        self.after(0, lambda: messagebox.showinfo(
            "ติดตั้งสำเร็จ",
            f"✅ ติดตั้ง HRBTC Scan Agent เสร็จแล้ว!\n\n"
            f"📂 ที่อยู่ไฟล์:\n{agent_path}\n\n"
            f"{'🔄 Task Scheduler ตั้งแล้ว — Agent จะเปิดอัตโนมัติ' if self.autostart_var.get() else '⬛ Task Scheduler ไม่ได้ตั้ง'}"
        ))

    def _uninstall_task(self):
        if not messagebox.askyesno("ยืนยัน", "ต้องการลบ Task Scheduler ของ HRBTC Scan Agent?"):
            return

        def run():
            ok, msg = remove_task_scheduler()
            self._log(f"Task Scheduler: {msg}")
            if ok:
                messagebox.showinfo("สำเร็จ", msg)
            else:
                messagebox.showerror("ข้อผิดพลาด", msg)

        threading.Thread(target=run, daemon=True).start()

    def _run_agent_now(self):
        agent_path = Path(self.install_dir.get().strip()) / AGENT_FILE
        if not agent_path.exists():
            messagebox.showwarning("ไม่พบไฟล์",
                f"ไม่พบ {agent_path}\nกรุณาติดตั้งก่อน")
            return
        try:
            py = get_python_exe()
            subprocess.Popen(
                [py, str(agent_path)],
                creationflags=subprocess.CREATE_NEW_CONSOLE,
                cwd=str(agent_path.parent)
            )
            self._log(f"▶️ รัน Agent: {agent_path}")
            messagebox.showinfo("กำลังรัน",
                f"✅ เปิด HRBTC Scan Agent แล้ว\nดูผลลัพธ์ในหน้าต่าง Command Prompt ที่เปิดขึ้น")
        except Exception as e:
            self._log(f"❌ รัน Agent ไม่ได้: {e}")
            messagebox.showerror("ข้อผิดพลาด", str(e))


# ═══════════════════════════════════════════════════════════════════════════════
# Entry point
# ═══════════════════════════════════════════════════════════════════════════════
if __name__ == "__main__":
    app = HRBTCInstaller()
    app.mainloop()
