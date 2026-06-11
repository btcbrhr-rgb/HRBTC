"""
HRBTC Scan Agent — Setup Wizard
================================
แปลงเป็น .exe ด้วย PyInstaller:
  pyinstaller --onefile --windowed --name HRBTC_Setup setup_wizard.py

ผู้ใช้ดาวน์โหลด HRBTC_Setup.exe → ดับเบิ้ลคลิก → กรอก IP/Serial → กด ติดตั้ง → เสร็จ
ทุกอย่างอัตโนมัติ: สร้างโฟลเดอร์, สร้าง agent, ติดตั้ง pyzk, ตั้ง Task Scheduler
"""

import os
import sys
import json
import socket
import subprocess
import threading
import urllib.request
import urllib.error
import shutil
import textwrap
import ctypes
import winreg
from pathlib import Path
from datetime import datetime

import tkinter as tk
from tkinter import ttk, messagebox

# ─────────────────────────────────────────────────────────────────────────────
# Constants
# ─────────────────────────────────────────────────────────────────────────────
APP_NAME    = "HRBTC Scan Agent"
APP_VER     = "1.0.0"
TASK_NAME   = "HRBTC_ScanAgent"
INSTALL_DIR = Path(os.environ.get("ProgramFiles", "C:\\Program Files")) / "HRBTC_Agent"

SERVER_URL = (
    "https://script.google.com/macros/s/"
    "AKfycbycaWVV_K5EA7gJ3WTfbUJN1VSQ7vLvSsDytdGu7dg6yiFjKMIjQtK6KaWdE6jmrjAYew/exec"
)

# ── Theme ──────────────────────────────────────────────────────────────────
BG       = "#0F172A"
CARD     = "#1E293B"
BORDER   = "#334155"
ACCENT   = "#6366F1"
CYAN     = "#22D3EE"
GREEN    = "#22C55E"
WARN     = "#F59E0B"
RED      = "#EF4444"
TEXT     = "#F1F5F9"
MUTED    = "#94A3B8"

FT       = ("Segoe UI", 10)
FT_H     = ("Segoe UI", 11, "bold")
FT_BIG   = ("Segoe UI", 20, "bold")
FT_MONO  = ("Consolas", 9)

# ─────────────────────────────────────────────────────────────────────────────
# Embedded scan_agent.py source code (สร้าง Config ตอน install)
# ─────────────────────────────────────────────────────────────────────────────
AGENT_TEMPLATE = r'''"""
HRBTC Scan Agent  v{ver}
ติดตั้งโดย: HRBTC Setup  {date}
"""
import os, sys, time, json, socket, platform
import urllib.request, urllib.error
from datetime import datetime, timezone, timedelta

CONFIG = {config_json}

def get_device_id():
    return f"{CONFIG['DEVICE_MODEL']}-{CONFIG['DEVICE_SERIAL']}-{platform.node()}"

def get_os_info():
    return f"{platform.system()} {platform.release()}"

def http_post(payload, timeout=None):
    timeout = timeout or CONFIG["HTTP_TIMEOUT"]
    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        CONFIG["SERVER_URL"], data=data,
        headers={"Content-Type": "application/json"}, method="POST")
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return json.loads(r.read().decode("utf-8"))
    except urllib.error.URLError as e:
        return {"status": "error", "code": "NETWORK_ERROR", "message": str(e)}
    except Exception as e:
        return {"status": "error", "code": "UNKNOWN",        "message": str(e)}

def zk_get_attendance(ip, port=4370):
    try:
        from pyzk import ZK
    except ImportError:
        print("[ERROR] ยังไม่ได้ติดตั้ง pyzk")
        return []
    records, conn = [], None
    zk = ZK(ip, port=port, timeout=CONFIG["ZK_TIMEOUT"])
    try:
        conn = zk.connect()
        if not conn:
            print(f"[ERROR] เชื่อมต่อ {ip}:{port} ไม่ได้")
            return []
        attendances = conn.get_attendance()
        print(f"  [DEBUG] พบ {len(attendances)} records")
        for att in attendances:
            if not att or not att.user_id or not att.timestamp:
                continue
            records.append({
                "empId":     str(att.user_id),
                "timestamp": att.timestamp.strftime("%Y-%m-%dT%H:%M:%S"),
                "type":      int(att.status) if att.status is not None else 0,
                "punch":     int(att.punch)  if att.punch  is not None else 1,
            })
    except Exception as e:
        print(f"[ERROR] ZK fetch failed: {e}")
    finally:
        if conn:
            try: conn.disconnect()
            except: pass
    return records

STATE_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), ".scan_agent_state.json")

def load_state():
    try:
        if os.path.exists(STATE_FILE):
            with open(STATE_FILE, "r", encoding="utf-8") as f:
                return json.load(f)
    except: pass
    return {"lastTimestamp": None}

def save_state(state):
    try:
        with open(STATE_FILE, "w", encoding="utf-8") as f:
            json.dump(state, f, ensure_ascii=False, indent=2)
    except Exception as e:
        print(f"[WARN] save state: {e}")

def filter_new_records(records, state):
    if not state.get("lastTimestamp"):
        cutoff = datetime.now() - timedelta(days=2)
        return [r for r in records if r["timestamp"] >= cutoff.strftime("%Y-%m-%dT%H:%M:%S")]
    return [r for r in records if r["timestamp"] > state["lastTimestamp"]]

def register_device():
    res = http_post({
        "action": "agentRegister", "deviceId": get_device_id(),
        "deviceName": CONFIG["DEVICE_NAME"], "branchCode": CONFIG["DEVICE_BRANCH"],
        "model": CONFIG["DEVICE_MODEL"],     "serialNo":   CONFIG["DEVICE_SERIAL"],
        "ipAddress":  CONFIG["DEVICE_IP"],   "port":       CONFIG["DEVICE_PORT"],
        "agentVersion": CONFIG["AGENT_VERSION"], "osInfo": get_os_info(),
    }, timeout=15)
    print(f"[REGISTER] {res.get('message', res)}")
    return res.get("status") == "success"

def send_heartbeat(status="online", message="", stats=None):
    return http_post({"action": "agentHeartbeat", "deviceId": get_device_id(),
                      "status": status, "message": message, "stats": stats or {}}, timeout=10)

def push_records(records):
    if not records:
        return {"status": "success", "data": {"inserted": 0, "skipped": 0}}
    return http_post({"action": "agentPushTimeLog", "deviceId": get_device_id(),
                      "branchCode": CONFIG["DEVICE_BRANCH"], "records": records}, timeout=30)

def main():
    print("=" * 60)
    print(f"  HRBTC Scan Agent v{CONFIG['AGENT_VERSION']}")
    print(f"  Device : {CONFIG['DEVICE_MODEL']} ({CONFIG['DEVICE_SERIAL']})")
    print(f"  IP:Port: {CONFIG['DEVICE_IP']}:{CONFIG['DEVICE_PORT']}")
    print(f"  Branch : {CONFIG['DEVICE_BRANCH']} — {CONFIG['DEVICE_NAME']}")
    print("=" * 60)
    if not register_device():
        print("[FATAL] ลงทะเบียนไม่สำเร็จ")
        sys.exit(1)
    last_hb, last_fetch, cycle = 0, None, 0
    print("\n[START] เริ่มทำงาน — กด Ctrl+C เพื่อหยุด\n")
    while True:
        try:
            cycle += 1
            now = time.time()
            if now - last_hb >= CONFIG["HEARTBEAT_SECONDS"]:
                hb = send_heartbeat("online", "running",
                    {"lastFetchAt": last_fetch.isoformat() if last_fetch else None, "cycle": cycle})
                if hb.get("status") != "success":
                    print(f"[WARN] heartbeat: {hb.get('message')}")
                last_hb = now
            print(f"[CYCLE {cycle}] กำลังดึงข้อมูล...")
            try:
                all_rec = zk_get_attendance(CONFIG["DEVICE_IP"], CONFIG["DEVICE_PORT"])
                state   = load_state()
                records = filter_new_records(all_rec, state)
            except Exception as e:
                print(f"[ERROR] fetch: {e}")
                all_rec, records, state = [], [], load_state()
            last_fetch = datetime.now(timezone(timedelta(hours=7)))
            if records:
                total = 0
                for i in range(0, len(records), CONFIG["PUSH_BATCH"]):
                    batch = records[i:i + CONFIG["PUSH_BATCH"]]
                    res   = push_records(batch)
                    if res.get("status") == "success":
                        ins = res.get("data", {}).get("inserted", 0)
                        total += ins
                        print(f"  → batch {i//CONFIG['PUSH_BATCH']+1}: inserted={ins}/{len(batch)}")
                    else:
                        print(f"  → batch failed: {res.get('message')}")
                max_ts = max(r["timestamp"] for r in records)
                state["lastTimestamp"] = max_ts
                save_state(state)
                print(f"[CYCLE {cycle}] ส่ง {total} records (เครื่องมี {len(all_rec)})")
            else:
                print(f"[CYCLE {cycle}] ไม่มีข้อมูลใหม่ (เครื่องมี {len(all_rec)})")
            time.sleep(CONFIG["POLL_SECONDS"])
        except KeyboardInterrupt:
            print("\n[STOP] ปิดโปรแกรม — bye")
            break
        except Exception as e:
            print(f"[ERROR] main loop: {e}")
            time.sleep(10)

if __name__ == "__main__":
    main()
'''

# ─────────────────────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────────────────────

def is_admin() -> bool:
    try:
        return ctypes.windll.shell32.IsUserAnAdmin()
    except Exception:
        return False


def get_python_exe() -> str:
    for exe in ("python", "py", "python3"):
        if shutil.which(exe):
            return exe
    return sys.executable


def check_python() -> tuple[bool, str]:
    py = get_python_exe()
    try:
        r = subprocess.run([py, "--version"], capture_output=True, text=True, timeout=10)
        ver = (r.stdout + r.stderr).strip()
        return True, ver
    except Exception:
        return False, ""


def check_pyzk() -> bool:
    py = get_python_exe()
    try:
        r = subprocess.run([py, "-c", "import pyzk"], capture_output=True, timeout=10)
        return r.returncode == 0
    except Exception:
        return False


def install_pyzk(cb) -> bool:
    py = get_python_exe()
    try:
        proc = subprocess.Popen(
            [py, "-m", "pip", "install", "pyzk", "--upgrade"],
            stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, bufsize=1
        )
        for line in proc.stdout:
            cb(line.rstrip())
        proc.wait()
        return proc.returncode == 0
    except Exception as e:
        cb(f"[ERROR] {e}")
        return False


def test_tcp(ip: str, port: int, timeout=5) -> bool:
    try:
        with socket.create_connection((ip, port), timeout=timeout):
            return True
    except Exception:
        return False


def build_agent_code(config: dict) -> str:
    cfg_json = json.dumps(config, ensure_ascii=False, indent=4)
    return AGENT_TEMPLATE.replace("{ver}", APP_VER) \
                         .replace("{date}", datetime.now().strftime("%Y-%m-%d %H:%M")) \
                         .replace("{config_json}", cfg_json)


def set_task_scheduler(python_exe: str, agent_path: str) -> tuple[bool, str]:
    xml = f"""<?xml version="1.0" encoding="UTF-16"?>
<Task version="1.2" xmlns="http://schemas.microsoft.com/windows/2004/02/mit/task">
  <RegistrationInfo><Description>HRBTC Scan Agent</Description></RegistrationInfo>
  <Triggers>
    <BootTrigger><Enabled>true</Enabled><Delay>PT30S</Delay></BootTrigger>
  </Triggers>
  <Settings>
    <MultipleInstancesPolicy>IgnoreNew</MultipleInstancesPolicy>
    <DisallowStartIfOnBatteries>false</DisallowStartIfOnBatteries>
    <StopIfGoingOnBatteries>false</StopIfGoingOnBatteries>
    <ExecutionTimeLimit>PT0S</ExecutionTimeLimit>
    <RestartOnFailure><Interval>PT1M</Interval><Count>999</Count></RestartOnFailure>
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
    tmp = os.path.join(os.environ.get("TEMP", "C:\\Temp"), "hrbtc_task.xml")
    try:
        with open(tmp, "w", encoding="utf-16") as f:
            f.write(xml)
        r = subprocess.run(
            ["schtasks", "/Create", "/TN", TASK_NAME, "/XML", tmp, "/F"],
            capture_output=True, text=True, timeout=30
        )
        if os.path.exists(tmp):
            os.remove(tmp)
        if r.returncode == 0:
            return True, "Task Scheduler ตั้งแล้ว — Agent เปิดอัตโนมัติตอน Windows บูต"
        return False, r.stderr.strip() or r.stdout.strip()
    except Exception as e:
        return False, str(e)


# ─────────────────────────────────────────────────────────────────────────────
# Pages (Wizard steps)
# ─────────────────────────────────────────────────────────────────────────────

class WizardApp(tk.Tk):
    def __init__(self):
        super().__init__()
        self.title(f"{APP_NAME}  Setup  v{APP_VER}")
        self.geometry("620x560")
        self.resizable(False, False)
        self.configure(bg=BG)

        # ── state vars ──
        self.device_ip     = tk.StringVar(value="192.168.1.230")
        self.device_port   = tk.StringVar(value="4370")
        self.device_model  = tk.StringVar(value="MB40-VL")
        self.device_serial = tk.StringVar(value="")
        self.device_branch = tk.StringVar(value="HQ")
        self.device_name   = tk.StringVar(value="สำนักงานใหญ่")
        self.install_path  = tk.StringVar(value=str(INSTALL_DIR))
        self.autostart     = tk.BooleanVar(value=True)

        self._current_page = 0
        self._pages: list[tk.Frame] = []
        self._log_lines: list[str] = []

        self._build_shell()
        self._build_pages()
        self._show_page(0)

    # ── Shell (Header + Content area + Nav buttons) ────────────────────────

    def _build_shell(self):
        # Header
        hdr = tk.Frame(self, bg=ACCENT, height=72)
        hdr.pack(fill="x")
        hdr.pack_propagate(False)

        tk.Label(hdr, text="🔧", font=("Segoe UI Emoji", 22),
                 bg=ACCENT, fg="white").pack(side="left", padx=18, pady=10)
        col = tk.Frame(hdr, bg=ACCENT)
        col.pack(side="left", pady=10)
        self._title_lbl = tk.Label(col, text=APP_NAME, font=FT_BIG,
                                   bg=ACCENT, fg="white")
        self._title_lbl.pack(anchor="w")
        self._sub_lbl = tk.Label(col, text="Setup Wizard", font=FT,
                                 bg=ACCENT, fg="#C7D2FE")
        self._sub_lbl.pack(anchor="w")

        # Step indicator
        self._step_frame = tk.Frame(self, bg=CARD, height=36)
        self._step_frame.pack(fill="x")
        self._step_frame.pack_propagate(False)
        self._step_dots: list[tk.Label] = []
        step_names = ["ยินดีต้อนรับ", "ตั้งค่า", "ติดตั้ง", "เสร็จสิ้น"]
        dots_row = tk.Frame(self._step_frame, bg=CARD)
        dots_row.pack(expand=True)
        for i, name in enumerate(step_names):
            dot = tk.Label(dots_row, text=f" {i+1} ", font=("Segoe UI", 9, "bold"),
                           bg=BORDER, fg=TEXT, width=3, pady=2)
            dot.pack(side="left", padx=2, pady=6)
            tk.Label(dots_row, text=name, font=("Segoe UI", 9),
                     bg=CARD, fg=MUTED).pack(side="left", padx=(0, 8))
            self._step_dots.append(dot)

        # Content
        self._content = tk.Frame(self, bg=BG)
        self._content.pack(fill="both", expand=True)

        # Nav buttons
        nav = tk.Frame(self, bg=CARD, pady=10, padx=20)
        nav.pack(fill="x", side="bottom")
        self._back_btn = tk.Button(nav, text="◀  ย้อนกลับ",
                                   command=self._go_back,
                                   bg=BORDER, fg=TEXT, relief="flat",
                                   font=FT, padx=14, pady=6, cursor="hand2",
                                   activebackground=ACCENT, activeforeground="white")
        self._back_btn.pack(side="left")
        self._next_btn = tk.Button(nav, text="ถัดไป  ▶",
                                   command=self._go_next,
                                   bg=ACCENT, fg="white", relief="flat",
                                   font=("Segoe UI", 10, "bold"),
                                   padx=20, pady=6, cursor="hand2",
                                   activebackground="#4F46E5", activeforeground="white")
        self._next_btn.pack(side="right")
        self._cancel_btn = tk.Button(nav, text="ยกเลิก",
                                     command=self.destroy,
                                     bg=BG, fg=MUTED, relief="flat",
                                     font=FT, padx=12, pady=6, cursor="hand2")
        self._cancel_btn.pack(side="right", padx=8)

    # ── Pages ──────────────────────────────────────────────────────────────

    def _build_pages(self):
        self._pages = [
            self._page_welcome(),
            self._page_config(),
            self._page_install(),
            self._page_done(),
        ]

    def _page_welcome(self) -> tk.Frame:
        f = tk.Frame(self._content, bg=BG)

        tk.Label(f, text="ยินดีต้อนรับสู่\nHRBTC Scan Agent Setup",
                 font=("Segoe UI", 16, "bold"), fg=TEXT, bg=BG,
                 justify="center").pack(pady=(40, 12))
        tk.Label(f,
                 text="Setup นี้จะ:\n\n"
                      "  ✅  ติดตั้ง pyzk Library อัตโนมัติ\n"
                      "  ✅  สร้างโฟลเดอร์และไฟล์ Agent ให้\n"
                      "  ✅  ตั้ง Windows Task Scheduler ให้เปิดอัตโนมัติ\n"
                      "  ✅  เชื่อมต่อกับระบบ HRBTC ทันที\n\n"
                      "กด 'ถัดไป' เพื่อเริ่มต้น",
                 font=FT, fg=MUTED, bg=BG, justify="left").pack(padx=60)

        # Python check badge
        badge = tk.Frame(f, bg=CARD, padx=16, pady=10)
        badge.pack(padx=60, pady=20, fill="x")
        self._py_badge = tk.Label(badge, text="🔄  กำลังตรวจสอบ Python...",
                                  font=FT, fg=WARN, bg=CARD)
        self._py_badge.pack(anchor="w")

        def check():
            ok, ver = check_python()
            txt = f"✅  {ver}  — พร้อมใช้งาน" if ok else "❌  ไม่พบ Python — ดาวน์โหลดจาก python.org"
            col = GREEN if ok else RED
            self.after(0, lambda: self._py_badge.configure(text=txt, fg=col))

        threading.Thread(target=check, daemon=True).start()
        return f

    def _page_config(self) -> tk.Frame:
        f = tk.Frame(self._content, bg=BG)

        # Canvas + Scrollbar
        canvas = tk.Canvas(f, bg=BG, highlightthickness=0)
        sb = ttk.Scrollbar(f, orient="vertical", command=canvas.yview)
        canvas.configure(yscrollcommand=sb.set)
        sb.pack(side="right", fill="y")
        canvas.pack(side="left", fill="both", expand=True)
        inner = tk.Frame(canvas, bg=BG)
        wid = canvas.create_window((0, 0), window=inner, anchor="nw")
        canvas.bind("<Configure>", lambda e: canvas.itemconfig(wid, width=e.width))
        inner.bind("<Configure>", lambda e: canvas.configure(scrollregion=canvas.bbox("all")))

        def section(title):
            row = tk.Frame(inner, bg=BG)
            row.pack(fill="x", padx=24, pady=(14, 4))
            tk.Label(row, text=title, font=FT_H, fg=CYAN, bg=BG).pack(side="left")
            tk.Frame(row, bg=BORDER, height=1).pack(side="left", fill="x",
                                                     expand=True, padx=(8, 0), pady=6)

        def field(parent, row_idx, label, var, hint=""):
            tk.Label(parent, text=label + ":", font=FT, fg=TEXT, bg=CARD,
                     width=18, anchor="w").grid(row=row_idx, column=0, sticky="w", pady=5)
            e = tk.Entry(parent, textvariable=var, width=24,
                         bg="#0F172A", fg=TEXT, font=FT, insertbackground=TEXT,
                         relief="flat", highlightthickness=1,
                         highlightbackground=BORDER, highlightcolor=ACCENT)
            e.grid(row=row_idx, column=1, padx=8, sticky="w")
            if hint:
                tk.Label(parent, text=hint, font=("Segoe UI", 8),
                         fg=MUTED, bg=CARD).grid(row=row_idx, column=2, sticky="w", padx=2)

        # Section: Scanner
        section("📡 เครื่องสแกนนิ้ว")
        sc = tk.Frame(inner, bg=CARD, padx=14, pady=10)
        sc.pack(padx=24, fill="x")
        field(sc, 0, "IP เครื่องสแกน",  self.device_ip,     "เช่น 192.168.1.230")
        field(sc, 1, "Port",             self.device_port,   "4370 (ZK) หรือ 8080 (HTTP)")
        field(sc, 2, "รุ่นเครื่อง",      self.device_model,  "เช่น MB40-VL")
        field(sc, 3, "Serial Number",    self.device_serial, "★ ดูจากหน้าจอ TAS Time บนเครื่อง")
        field(sc, 4, "รหัสสาขา",         self.device_branch, "เช่น HQ, KM3, SITE-A")
        field(sc, 5, "ชื่อเครื่อง",       self.device_name,   "ชื่อในระบบ HRBTC")

        # Test connection
        test_row = tk.Frame(inner, bg=BG)
        test_row.pack(padx=24, pady=8)
        self._conn_lbl = tk.Label(test_row, text="", font=FT, fg=MUTED, bg=BG)
        self._conn_lbl.pack(side="right", padx=8)
        tk.Button(test_row, text="🔌  ทดสอบเชื่อมต่อ",
                  command=self._test_connection,
                  bg=BORDER, fg=TEXT, relief="flat", font=FT,
                  padx=12, pady=5, cursor="hand2").pack(side="left")

        # Section: Install path
        section("📁 โฟลเดอร์ติดตั้ง")
        pf = tk.Frame(inner, bg=CARD, padx=14, pady=10)
        pf.pack(padx=24, fill="x")
        tk.Label(pf, text="ติดตั้งที่:", font=FT, fg=TEXT, bg=CARD,
                 width=18, anchor="w").grid(row=0, column=0, sticky="w")
        tk.Entry(pf, textvariable=self.install_path, width=30,
                 bg="#0F172A", fg=TEXT, font=FT, insertbackground=TEXT,
                 relief="flat", highlightthickness=1,
                 highlightbackground=BORDER, highlightcolor=ACCENT).grid(row=0, column=1, padx=8)

        # Autostart checkbox
        section("⚙️ การเริ่มต้นอัตโนมัติ")
        af = tk.Frame(inner, bg=CARD, padx=14, pady=10)
        af.pack(padx=24, fill="x")
        tk.Checkbutton(
            af,
            text="เปิด Scan Agent อัตโนมัติเมื่อ Windows บูต  (Task Scheduler)",
            variable=self.autostart, bg=CARD, fg=TEXT,
            selectcolor=ACCENT, activebackground=CARD, activeforeground=TEXT,
            font=FT
        ).pack(anchor="w")

        return f

    def _page_install(self) -> tk.Frame:
        f = tk.Frame(self._content, bg=BG)

        # Progress
        tk.Label(f, text="กำลังติดตั้ง...", font=FT_H, fg=TEXT, bg=BG).pack(pady=(28, 6))

        prog_f = tk.Frame(f, bg=CARD, padx=20, pady=14)
        prog_f.pack(padx=32, fill="x")

        self._prog_lbl = tk.Label(prog_f, text="รอ...", font=FT, fg=MUTED, bg=CARD)
        self._prog_lbl.pack(anchor="w", pady=(0, 8))

        style = ttk.Style()
        style.configure("A.Horizontal.TProgressbar",
                        troughcolor=BORDER, background=ACCENT, thickness=10)
        self._prog_bar = ttk.Progressbar(
            prog_f, style="A.Horizontal.TProgressbar",
            mode="determinate", length=520)
        self._prog_bar.pack(fill="x")

        # Steps
        steps_f = tk.Frame(f, bg=CARD, padx=20, pady=12)
        steps_f.pack(padx=32, pady=10, fill="x")

        self._step_lbl: dict[str, tuple[tk.Label, tk.Label]] = {}
        for key, txt in [
            ("s1", "สร้างโฟลเดอร์ติดตั้ง"),
            ("s2", "เขียนไฟล์ scan_agent.py พร้อม Config"),
            ("s3", "ติดตั้ง pyzk Library"),
            ("s4", "ตั้ง Windows Task Scheduler"),
            ("s5", "เสร็จสิ้น"),
        ]:
            row = tk.Frame(steps_f, bg=CARD)
            row.pack(anchor="w", pady=3)
            icon = tk.Label(row, text="⬜", font=FT, fg=MUTED, bg=CARD)
            icon.pack(side="left")
            lbl  = tk.Label(row, text=f"  {txt}", font=FT, fg=MUTED, bg=CARD)
            lbl.pack(side="left")
            self._step_lbl[key] = (icon, lbl)

        # Log area (small)
        self._install_log = tk.Text(f, height=4, bg="#0D1117", fg="#94A3B8",
                                    font=FT_MONO, relief="flat", state="disabled",
                                    borderwidth=0)
        self._install_log.pack(padx=32, fill="x", pady=(0, 10))

        return f

    def _page_done(self) -> tk.Frame:
        f = tk.Frame(self._content, bg=BG)
        self._done_icon  = tk.Label(f, text="", font=("Segoe UI Emoji", 56), bg=BG)
        self._done_icon.pack(pady=(40, 10))
        self._done_title = tk.Label(f, text="", font=("Segoe UI", 18, "bold"), bg=BG, fg=TEXT)
        self._done_title.pack()
        self._done_sub   = tk.Label(f, text="", font=FT, bg=BG, fg=MUTED,
                                    wraplength=460, justify="center")
        self._done_sub.pack(pady=10)
        return f

    # ── Navigation ─────────────────────────────────────────────────────────

    def _show_page(self, idx: int):
        for p in self._pages:
            p.pack_forget()
        self._pages[idx].pack(fill="both", expand=True)
        self._current_page = idx

        # Update step dots
        for i, dot in enumerate(self._step_dots):
            if i < idx:
                dot.configure(bg=GREEN, fg="white")
            elif i == idx:
                dot.configure(bg=ACCENT, fg="white")
            else:
                dot.configure(bg=BORDER, fg=TEXT)

        # Update subtitle
        subs = ["ยินดีต้อนรับ", "ตั้งค่าเครื่องสแกน", "กำลังติดตั้ง", "เสร็จสมบูรณ์"]
        self._sub_lbl.configure(text=subs[idx])

        # Nav buttons
        self._back_btn.configure(state="normal" if idx > 0 else "disabled")

        if idx == 3:   # Done page
            self._next_btn.configure(text="✅  เสร็จสิ้น", command=self.destroy)
            self._cancel_btn.pack_forget()
        elif idx == 2: # Install page (no back/next — controlled by install thread)
            self._next_btn.configure(state="disabled", text="กำลังติดตั้ง...")
            self._back_btn.configure(state="disabled")
        else:
            self._next_btn.configure(text="ถัดไป  ▶", command=self._go_next,
                                     state="normal")

    def _go_next(self):
        if self._current_page == 1:
            if not self._validate_config():
                return
            self._show_page(2)
            threading.Thread(target=self._run_install, daemon=True).start()
        else:
            self._show_page(self._current_page + 1)

    def _go_back(self):
        if self._current_page > 0:
            self._show_page(self._current_page - 1)

    # ── Validation ─────────────────────────────────────────────────────────

    def _validate_config(self) -> bool:
        serial = self.device_serial.get().strip()
        if not serial:
            messagebox.showwarning("กรอกข้อมูลไม่ครบ",
                "กรุณากรอก Serial Number ของเครื่องสแกน\n(ดูจากหน้าจอ TAS Time บนเครื่อง)")
            return False
        try:
            port = int(self.device_port.get().strip())
            if not (1 <= port <= 65535):
                raise ValueError()
        except ValueError:
            messagebox.showwarning("Port ไม่ถูกต้อง", "Port ต้องเป็นตัวเลข 1–65535")
            return False
        return True

    # ── Test connection ─────────────────────────────────────────────────────

    def _test_connection(self):
        ip   = self.device_ip.get().strip()
        port_str = self.device_port.get().strip()
        try:
            port = int(port_str)
        except ValueError:
            self._conn_lbl.configure(text="Port ไม่ถูกต้อง", fg=RED)
            return
        self._conn_lbl.configure(text="🔄 กำลังทดสอบ...", fg=WARN)

        def check():
            ok = test_tcp(ip, port)
            txt = f"✅ เชื่อมต่อ {ip}:{port} ได้" if ok else f"❌ เชื่อมต่อ {ip}:{port} ไม่ได้"
            col = GREEN if ok else RED
            self.after(0, lambda: self._conn_lbl.configure(text=txt, fg=col))

        threading.Thread(target=check, daemon=True).start()

    # ── Install ─────────────────────────────────────────────────────────────

    def _ilog(self, msg: str):
        def _do():
            self._install_log.configure(state="normal")
            self._install_log.insert("end", msg + "\n")
            self._install_log.see("end")
            self._install_log.configure(state="disabled")
        self.after(0, _do)

    def _set_step(self, key: str, state: str):
        icon_map = {"pending": ("⬜", MUTED), "running": ("🔄", WARN),
                    "done": ("✅", GREEN), "error": ("❌", RED)}
        icon_txt, col = icon_map.get(state, ("⬜", MUTED))
        icon_lbl, txt_lbl = self._step_lbl[key]
        self.after(0, lambda: icon_lbl.configure(text=icon_txt))
        self.after(0, lambda: txt_lbl.configure(fg=col))

    def _prog(self, val: int, msg: str):
        self.after(0, lambda: self._prog_bar.configure(value=val))
        self.after(0, lambda: self._prog_lbl.configure(text=msg))

    def _run_install(self):
        for k in ["s1", "s2", "s3", "s4", "s5"]:
            self._set_step(k, "pending")

        install_dir = Path(self.install_path.get().strip())
        agent_path  = install_dir / "scan_agent.py"

        # ── Step 1: Create folder ──
        self._set_step("s1", "running")
        self._prog(10, "สร้างโฟลเดอร์...")
        self._ilog(f"สร้างโฟลเดอร์: {install_dir}")
        try:
            install_dir.mkdir(parents=True, exist_ok=True)
            self._set_step("s1", "done")
            self._ilog("✅ สร้างโฟลเดอร์สำเร็จ")
        except Exception as e:
            self._set_step("s1", "error")
            self._ilog(f"❌ {e}")
            self._prog(0, f"ข้อผิดพลาด: {e}")
            self._finish(False, str(e))
            return

        # ── Step 2: Write agent ──
        self._set_step("s2", "running")
        self._prog(28, "เขียนไฟล์ Agent...")
        config = {
            "DEVICE_IP":         self.device_ip.get().strip(),
            "DEVICE_PORT":       int(self.device_port.get().strip()),
            "DEVICE_MODEL":      self.device_model.get().strip(),
            "DEVICE_SERIAL":     self.device_serial.get().strip(),
            "DEVICE_BRANCH":     self.device_branch.get().strip(),
            "DEVICE_NAME":       self.device_name.get().strip(),
            "SERVER_URL":        SERVER_URL,
            "AGENT_VERSION":     APP_VER,
            "POLL_SECONDS":      60,
            "HEARTBEAT_SECONDS": 60,
            "PUSH_BATCH":        200,
            "HTTP_TIMEOUT":      30,
            "ZK_TIMEOUT":        10,
        }
        try:
            code = build_agent_code(config)
            agent_path.write_text(code, encoding="utf-8")
            self._set_step("s2", "done")
            self._ilog(f"✅ เขียน {agent_path.name} สำเร็จ")
        except Exception as e:
            self._set_step("s2", "error")
            self._ilog(f"❌ {e}")
            self._finish(False, str(e))
            return

        # ── Step 3: pyzk ──
        self._set_step("s3", "running")
        self._prog(50, "ติดตั้ง pyzk...")
        if check_pyzk():
            self._ilog("pyzk ติดตั้งแล้ว — ข้าม")
            self._set_step("s3", "done")
        else:
            ok = install_pyzk(self._ilog)
            if ok:
                self._set_step("s3", "done")
                self._ilog("✅ ติดตั้ง pyzk สำเร็จ")
            else:
                self._set_step("s3", "error")
                self._ilog("⚠️ ติดตั้ง pyzk ไม่สำเร็จ")

        # ── Step 4: Task Scheduler ──
        self._set_step("s4", "running")
        self._prog(75, "ตั้ง Task Scheduler...")
        if self.autostart.get():
            py_exe = get_python_exe()
            ok, msg = set_task_scheduler(py_exe, str(agent_path))
            if ok:
                self._set_step("s4", "done")
                self._ilog(f"✅ {msg}")
            else:
                self._set_step("s4", "error")
                self._ilog(f"⚠️ Task Scheduler: {msg}")
        else:
            self._set_step("s4", "done")
            self._ilog("ข้าม Task Scheduler")

        # ── Step 5 ──
        self._set_step("s5", "done")
        self._prog(100, "✅ ติดตั้งเสร็จสมบูรณ์!")
        self._ilog("=== ติดตั้งเสร็จสมบูรณ์ ===")
        self._finish(True, str(agent_path))

    def _finish(self, success: bool, detail: str):
        def _do():
            if success:
                self._done_icon.configure(text="✅")
                self._done_title.configure(text="ติดตั้งเสร็จสมบูรณ์!", fg=GREEN)
                self._done_sub.configure(
                    text=f"HRBTC Scan Agent พร้อมใช้งานแล้ว\n\n"
                         f"📂 ไฟล์ที่ติดตั้ง:\n{detail}\n\n"
                         f"{'🔄 Task Scheduler ตั้งแล้ว — Agent จะเปิดอัตโนมัติทุกครั้งที่ Windows บูต' if self.autostart.get() else ''}")
            else:
                self._done_icon.configure(text="❌")
                self._done_title.configure(text="ติดตั้งไม่สำเร็จ", fg=RED)
                self._done_sub.configure(
                    text=f"เกิดข้อผิดพลาด:\n{detail}\n\n"
                         "ลองรัน Setup ในฐานะ Administrator\n(คลิกขวา → Run as administrator)")
            self._show_page(3)
        self.after(0, _do)


# ─────────────────────────────────────────────────────────────────────────────
# Entry point
# ─────────────────────────────────────────────────────────────────────────────

def main():
    # Request admin if not already
    if not is_admin():
        try:
            ctypes.windll.shell32.ShellExecuteW(
                None, "runas", sys.executable, " ".join(sys.argv), None, 1)
        except Exception:
            pass
        sys.exit(0)

    app = WizardApp()
    app.mainloop()


if __name__ == "__main__":
    main()
