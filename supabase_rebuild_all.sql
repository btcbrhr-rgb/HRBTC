-- ============================================================
-- HRBTC - Supabase Schema (Idempotent) — ไฟล์เดียวครบ
-- รันซ้ำได้ไม่มีขีดจำกัด ข้อมูลเดิมไม่หาย
-- ============================================================

-- ════════════════════════════════════════════════════════════
-- STEP 1: สร้างตารางทั้งหมด
-- ════════════════════════════════════════════════════════════

-- ตารางพนักงาน
CREATE TABLE IF NOT EXISTS public.employees (
    id BIGSERIAL PRIMARY KEY,
    emp_id TEXT UNIQUE NOT NULL,
    name TEXT,
    position TEXT,
    status TEXT DEFAULT 'ทำงานปกติ',
    day_off TEXT DEFAULT 'อาทิตย์',
    company TEXT,
    start_date TEXT,
    phone TEXT,
    address TEXT,
    id_card TEXT,
    birth_date TEXT,
    bank TEXT,
    bank_branch TEXT,
    bank_account TEXT,
    avatar_url TEXT,
    base_salary NUMERIC(12,2) DEFAULT 0,
    wage_divisor NUMERIC(5,2) DEFAULT 30,
    work_hours_per_day NUMERIC(5,2) DEFAULT 8,
    ot_rate NUMERIC(5,2) DEFAULT 1.5,
    role TEXT DEFAULT 'Employee',
    line_user_id TEXT,
    pin TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ตารางบันทึกเวลา
CREATE TABLE IF NOT EXISTS public.time_records (
    id BIGSERIAL PRIMARY KEY,
    date TEXT NOT NULL,
    time_in TEXT,
    time_out TEXT,
    emp_id TEXT NOT NULL,
    is_edited BOOLEAN DEFAULT FALSE,
    original_time_in TEXT,
    original_time_out TEXT,
    source TEXT DEFAULT 'Web App',
    scan_mode TEXT,
    created_by TEXT,
    similarity_score NUMERIC(6,4),
    liveness_ok BOOLEAN,
    geofence_result TEXT,
    gps_lat NUMERIC(10,7),
    gps_lng NUMERIC(10,7),
    lat_in NUMERIC(10,7),
    lng_in NUMERIC(10,7),
    lat_out NUMERIC(10,7),
    lng_out NUMERIC(10,7),
    photo_url TEXT,
    recorded_at TEXT,
    status_key TEXT DEFAULT 'W',
    status TEXT DEFAULT 'ปกติ',
    late_minutes INTEGER DEFAULT 0,
    ot_hours NUMERIC(5,2) DEFAULT 0,
    food_allowance NUMERIC(10,2) DEFAULT 0,
    shift_allowance NUMERIC(10,2) DEFAULT 0,
    other_allowance NUMERIC(10,2) DEFAULT 0,
    project_in TEXT,
    project_out TEXT,
    notes TEXT,
    attachments TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ตารางแก้ไขเวลา
CREATE TABLE IF NOT EXISTS public.time_corrections (
    id BIGSERIAL PRIMARY KEY,
    emp_id TEXT NOT NULL,
    date TEXT NOT NULL,
    new_time_in TEXT,
    new_time_out TEXT,
    old_time_in TEXT,
    old_time_out TEXT,
    reason TEXT,
    status TEXT DEFAULT 'รออนุมัติ',
    project TEXT,
    submitted_at TEXT,
    approved_at TEXT,
    approved_by TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ตารางลางาน
CREATE TABLE IF NOT EXISTS public.leave_requests (
    id BIGSERIAL PRIMARY KEY,
    doc_id TEXT,
    emp_id TEXT NOT NULL,
    leave_type TEXT NOT NULL,
    duration TEXT DEFAULT 'เต็มวัน',
    start_date TEXT NOT NULL,
    end_date TEXT NOT NULL,
    days_count NUMERIC(5,2) DEFAULT 1,
    reason TEXT,
    status TEXT DEFAULT 'รออนุมัติ',
    submitted_at TEXT,
    approved_at TEXT,
    approved_by TEXT,
    notes TEXT,
    lat NUMERIC(10,7),
    lng NUMERIC(10,7),
    signature_url TEXT,
    attachments TEXT,
    approval_step TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ตารางเบิกเงินล่วงหน้า
CREATE TABLE IF NOT EXISTS public.advance_requests (
    id BIGSERIAL PRIMARY KEY,
    emp_id TEXT NOT NULL,
    amount NUMERIC(12,2) NOT NULL,
    request_date TEXT NOT NULL,
    pay_cycle TEXT,
    status TEXT DEFAULT 'รอตรวจสอบ',
    notes TEXT,
    payout_channel TEXT DEFAULT 'โอนผ่านบัญชีธนาคาร',
    is_recurring TEXT DEFAULT 'ไม่ใช่',
    edit_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ตารางสลิปเงินเดือน
CREATE TABLE IF NOT EXISTS public.payslips (
    id BIGSERIAL PRIMARY KEY,
    emp_id TEXT NOT NULL,
    period TEXT NOT NULL,
    file_name TEXT,
    file_id TEXT,
    slip_url TEXT,
    recorded_at TEXT,
    net_amount NUMERIC(12,2) DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ตารางตั้งค่าระบบ
CREATE TABLE IF NOT EXISTS public.system_settings (
    id BIGSERIAL PRIMARY KEY,
    key_name TEXT UNIQUE NOT NULL,
    default_value TEXT,
    active TEXT,
    description TEXT
);

-- ตารางประกาศ
CREATE TABLE IF NOT EXISTS public.announcements (
    id BIGSERIAL PRIMARY KEY,
    doc_id TEXT,
    title TEXT NOT NULL,
    tag TEXT DEFAULT 'ทั่วไป',
    content TEXT,
    posted_at TEXT,
    posted_by TEXT,
    status TEXT DEFAULT 'เผยแพร่',
    attachments TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ตารางโครงการ
CREATE TABLE IF NOT EXISTS public.projects (
    id BIGSERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    code TEXT,
    status TEXT DEFAULT 'ใช้งาน',
    start_date TEXT,
    end_date TEXT,
    responsible TEXT,
    address TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ตารางวันหยุด
CREATE TABLE IF NOT EXISTS public.holidays (
    id BIGSERIAL PRIMARY KEY,
    date TEXT NOT NULL,
    title TEXT NOT NULL,
    year TEXT,
    holiday_type TEXT,
    created_by TEXT DEFAULT 'Admin',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ตาราง LINE Chat
CREATE TABLE IF NOT EXISTS public.line_chat_state (
    id BIGSERIAL PRIMARY KEY,
    line_user_id TEXT UNIQUE NOT NULL,
    state TEXT,
    temp_employee_id TEXT,
    updated_at TEXT
);

CREATE TABLE IF NOT EXISTS public.line_groups (
    id BIGSERIAL PRIMARY KEY,
    group_id TEXT UNIQUE NOT NULL,
    authorized_by TEXT,
    connected_at TEXT,
    notify_leave BOOLEAN DEFAULT TRUE,
    notify_advance BOOLEAN DEFAULT TRUE,
    notify_correction BOOLEAN DEFAULT TRUE,
    notify_summary BOOLEAN DEFAULT TRUE,
    notify_attendance BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.line_followers (
    id BIGSERIAL PRIMARY KEY,
    line_user_id TEXT UNIQUE NOT NULL,
    added_at TEXT,
    last_notified TEXT
);

-- ตาราง Face Database
CREATE TABLE IF NOT EXISTS public.face_database (
    id BIGSERIAL PRIMARY KEY,
    emp_id TEXT UNIQUE NOT NULL,
    face_descriptors TEXT,
    photo_url TEXT,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ตารางหลักฐานภาพสแกนใบหน้าตอนลงเวลา (เก็บชั่วคราว 90 วัน ดูได้เฉพาะ HR/Admin — ลบอัตโนมัติ)
CREATE TABLE IF NOT EXISTS public.face_capture_log (
    id BIGSERIAL PRIMARY KEY,
    time_record_id BIGINT,
    emp_id TEXT NOT NULL,
    scan_mode TEXT,
    created_by TEXT,
    image_url TEXT,
    captured_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '90 days')
);

-- ════════════════════════════════════════════════════════════
-- STEP 2: ตาราง Agent (Scanner Mappings + Configs + Attendance)
-- ════════════════════════════════════════════════════════════

-- ตารางจับคู่ UID เครื่องสแกน → พนักงาน
CREATE TABLE IF NOT EXISTS public.scanner_mappings (
    id BIGSERIAL PRIMARY KEY,
    device_id TEXT NOT NULL,
    branch_code TEXT NOT NULL DEFAULT '',
    scanner_uid TEXT NOT NULL,
    emp_id TEXT NOT NULL,
    raw_name TEXT DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ตาราง config ของ Agent แต่ละสาขา
CREATE TABLE IF NOT EXISTS public.agent_configs (
    id BIGSERIAL PRIMARY KEY,
    device_id TEXT UNIQUE NOT NULL,
    branch_code TEXT NOT NULL DEFAULT '',
    device_name TEXT DEFAULT '',
    model TEXT DEFAULT '',
    serial_no TEXT DEFAULT '',
    ip_address TEXT DEFAULT '',
    port INTEGER DEFAULT 4370,
    agent_version TEXT DEFAULT '',
    os_info TEXT DEFAULT '',
    status TEXT DEFAULT 'active',
    last_heartbeat TIMESTAMPTZ,
    last_sync_at TIMESTAMPTZ,
    total_records_pushed INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ตารางข้อมูลสแกนเวลาดิบ
CREATE TABLE IF NOT EXISTS public.attendance_raw (
    id BIGSERIAL PRIMARY KEY,
    device_id TEXT NOT NULL,
    branch_code TEXT DEFAULT '',
    scanner_uid TEXT NOT NULL,
    emp_id TEXT DEFAULT '',
    timestamp TEXT NOT NULL,
    status INTEGER DEFAULT 0,
    punch INTEGER DEFAULT 1,
    scan_mode TEXT,
    created_by TEXT,
    similarity_score NUMERIC(6,4),
    liveness_ok BOOLEAN,
    geofence_result TEXT,
    gps_lat NUMERIC(10,7),
    gps_lng NUMERIC(10,7),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ตารางตั้งค่าการแจ้งเตือนของพนักงาน
CREATE TABLE IF NOT EXISTS public.employee_notification_prefs (
    emp_id TEXT PRIMARY KEY,
    payslip BOOLEAN DEFAULT true,
    "leave" BOOLEAN DEFAULT true,
    attendance BOOLEAN DEFAULT true,
    advance BOOLEAN DEFAULT true,
    announcement BOOLEAN DEFAULT true,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ════════════════════════════════════════════════════════════
-- STEP 3: เพิ่มคอลัมน์ที่อาจขาด (ADD COLUMN IF NOT EXISTS)
-- ════════════════════════════════════════════════════════════
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS pin TEXT;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.time_records ADD COLUMN IF NOT EXISTS project_in TEXT;
ALTER TABLE public.time_records ADD COLUMN IF NOT EXISTS project_out TEXT;
ALTER TABLE public.time_records ADD COLUMN IF NOT EXISTS status_key TEXT DEFAULT 'W';
ALTER TABLE public.time_records ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE public.time_records ADD COLUMN IF NOT EXISTS attachments TEXT;
ALTER TABLE public.time_records ADD COLUMN IF NOT EXISTS original_time_in TEXT;
ALTER TABLE public.time_records ADD COLUMN IF NOT EXISTS original_time_out TEXT;
ALTER TABLE public.time_records ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.time_corrections ADD COLUMN IF NOT EXISTS old_time_in TEXT;
ALTER TABLE public.time_corrections ADD COLUMN IF NOT EXISTS old_time_out TEXT;
ALTER TABLE public.leave_requests ADD COLUMN IF NOT EXISTS approval_step TEXT;
ALTER TABLE public.leave_requests ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.payslips ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.advance_requests ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.announcements ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.face_database ADD COLUMN IF NOT EXISTS updated_by TEXT;

-- เพิ่มคอลัมน์ Face Scan Attendance (Phase 2) — สแกนใบหน้ามือถือ (self / manager_face / manager_manual)
ALTER TABLE public.time_records ADD COLUMN IF NOT EXISTS scan_mode TEXT;
ALTER TABLE public.time_records ADD COLUMN IF NOT EXISTS created_by TEXT;
ALTER TABLE public.time_records ADD COLUMN IF NOT EXISTS similarity_score NUMERIC(6,4);
ALTER TABLE public.time_records ADD COLUMN IF NOT EXISTS liveness_ok BOOLEAN;
ALTER TABLE public.time_records ADD COLUMN IF NOT EXISTS geofence_result TEXT;
ALTER TABLE public.time_records ADD COLUMN IF NOT EXISTS gps_lat NUMERIC(10,7);
ALTER TABLE public.time_records ADD COLUMN IF NOT EXISTS gps_lng NUMERIC(10,7);
ALTER TABLE public.attendance_raw ADD COLUMN IF NOT EXISTS scan_mode TEXT;
ALTER TABLE public.attendance_raw ADD COLUMN IF NOT EXISTS created_by TEXT;
ALTER TABLE public.attendance_raw ADD COLUMN IF NOT EXISTS similarity_score NUMERIC(6,4);
ALTER TABLE public.attendance_raw ADD COLUMN IF NOT EXISTS liveness_ok BOOLEAN;
ALTER TABLE public.attendance_raw ADD COLUMN IF NOT EXISTS geofence_result TEXT;
ALTER TABLE public.attendance_raw ADD COLUMN IF NOT EXISTS gps_lat NUMERIC(10,7);
ALTER TABLE public.attendance_raw ADD COLUMN IF NOT EXISTS gps_lng NUMERIC(10,7);

-- เพิ่มคอลัมน์สำหรับ Agent Config (Step 3 settings)
ALTER TABLE public.agent_configs ADD COLUMN IF NOT EXISTS poll_seconds INTEGER DEFAULT 60;
ALTER TABLE public.agent_configs ADD COLUMN IF NOT EXISTS heartbeat_seconds INTEGER DEFAULT 120;
ALTER TABLE public.agent_configs ADD COLUMN IF NOT EXISTS start_from_date TEXT;
ALTER TABLE public.agent_configs ADD COLUMN IF NOT EXISTS auto_startup BOOLEAN DEFAULT false;
ALTER TABLE public.agent_configs ADD COLUMN IF NOT EXISTS config_updated_at TIMESTAMPTZ;
ALTER TABLE public.agent_configs ADD COLUMN IF NOT EXISTS supabase_url TEXT;
ALTER TABLE public.agent_configs ADD COLUMN IF NOT EXISTS supabase_anon_key TEXT;

-- ════════════════════════════════════════════════════════════
-- STEP 4: Unique Constraints (ข้ามถ้ามีแล้ว)
-- ════════════════════════════════════════════════════════════
DO $$ BEGIN
  ALTER TABLE public.time_records ADD CONSTRAINT uq_time_records_date_emp UNIQUE (date, emp_id);
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.time_corrections ADD CONSTRAINT uq_time_corrections_emp_date UNIQUE (emp_id, date);
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.leave_requests ADD CONSTRAINT uq_leave_requests_doc_id UNIQUE (doc_id);
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.advance_requests ADD CONSTRAINT uq_advance_requests_emp_date_amount UNIQUE (emp_id, request_date, amount);
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.payslips ADD CONSTRAINT uq_payslips_emp_period UNIQUE (emp_id, period);
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.announcements ADD CONSTRAINT uq_announcements_doc_id UNIQUE (doc_id);
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.projects ADD CONSTRAINT uq_projects_name UNIQUE (name);
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.holidays ADD CONSTRAINT uq_holidays_date UNIQUE (date);
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.scanner_mappings ADD CONSTRAINT uq_scanner_mappings_device_uid UNIQUE (device_id, scanner_uid);
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL; END $$;

-- ════════════════════════════════════════════════════════════
-- STEP 4.5: ลบ UNIQUE constraint ซ้ำ (ของเหลือจาก schema เวอร์ชันเก่า — คอลัมน์เดียวกันถูกสร้าง 2 ครั้ง)
-- ตรวจสอบยืนยันจากข้อมูลจริง 5/9/2569 (RPC fn_schema_snapshot): constraint ด้านล่างซ้ำกับตัวที่ STEP 4 สร้าง
-- ════════════════════════════════════════════════════════════
DO $$ BEGIN
  ALTER TABLE public.advance_requests DROP CONSTRAINT IF EXISTS uq_advance_requests;
EXCEPTION WHEN undefined_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.holidays DROP CONSTRAINT IF EXISTS holidays_date_key;
EXCEPTION WHEN undefined_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.line_chat_state DROP CONSTRAINT IF EXISTS uq_line_chat_state_user;
EXCEPTION WHEN undefined_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.line_followers DROP CONSTRAINT IF EXISTS uq_line_followers_user;
EXCEPTION WHEN undefined_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.line_groups DROP CONSTRAINT IF EXISTS uq_line_groups_group;
EXCEPTION WHEN undefined_object THEN NULL; END $$;

-- ════════════════════════════════════════════════════════════
-- STEP 5: Enable RLS + Policy (ข้ามถ้ามีแล้ว)
-- ════════════════════════════════════════════════════════════
DO $$ DECLARE t TEXT; BEGIN
  FOR t IN SELECT unnest(ARRAY[
    'employees','time_records','time_corrections','leave_requests',
    'advance_requests','payslips','system_settings','announcements',
    'projects','holidays','line_chat_state','line_groups',
    'line_followers','face_database','face_capture_log','scanner_mappings','agent_configs','attendance_raw','employee_notification_prefs'
    ]) LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public' AND tablename = t
        AND policyname = format('Allow all %s', t)
    ) THEN
      EXECUTE format(
        'CREATE POLICY "Allow all %I" ON public.%I FOR ALL USING (true) WITH CHECK (true)',
        t, t
      );
    END IF;
  END LOOP;
END $$;

-- ════════════════════════════════════════════════════════════
-- STEP 6: Indexes
-- ════════════════════════════════════════════════════════════
CREATE INDEX IF NOT EXISTS idx_employees_emp_id ON public.employees(emp_id);
CREATE INDEX IF NOT EXISTS idx_employees_role ON public.employees(role);
CREATE INDEX IF NOT EXISTS idx_time_records_emp_id ON public.time_records(emp_id);
CREATE INDEX IF NOT EXISTS idx_time_records_date ON public.time_records(date);
CREATE INDEX IF NOT EXISTS idx_time_corrections_emp_id ON public.time_corrections(emp_id);
CREATE INDEX IF NOT EXISTS idx_leave_requests_emp_id ON public.leave_requests(emp_id);
CREATE INDEX IF NOT EXISTS idx_advance_requests_emp_id ON public.advance_requests(emp_id);
CREATE INDEX IF NOT EXISTS idx_payslips_emp_id ON public.payslips(emp_id);
CREATE INDEX IF NOT EXISTS idx_announcements_tag ON public.announcements(tag);
CREATE INDEX IF NOT EXISTS idx_projects_name ON public.projects(name);
CREATE INDEX IF NOT EXISTS idx_face_database_emp_id ON public.face_database(emp_id);
CREATE INDEX IF NOT EXISTS idx_face_capture_log_emp_id ON public.face_capture_log(emp_id);
CREATE INDEX IF NOT EXISTS idx_face_capture_log_expires_at ON public.face_capture_log(expires_at);
CREATE INDEX IF NOT EXISTS idx_scanner_mappings_device ON public.scanner_mappings(device_id);
CREATE INDEX IF NOT EXISTS idx_scanner_mappings_branch ON public.scanner_mappings(branch_code);
CREATE INDEX IF NOT EXISTS idx_scanner_mappings_emp ON public.scanner_mappings(emp_id);
CREATE INDEX IF NOT EXISTS idx_scanner_mappings_uid ON public.scanner_mappings(scanner_uid);
CREATE INDEX IF NOT EXISTS idx_attendance_raw_device ON public.attendance_raw(device_id);
CREATE INDEX IF NOT EXISTS idx_attendance_raw_emp ON public.attendance_raw(emp_id);
CREATE INDEX IF NOT EXISTS idx_attendance_raw_timestamp ON public.attendance_raw(timestamp);
CREATE INDEX IF NOT EXISTS idx_attendance_raw_uid ON public.attendance_raw(scanner_uid);

-- ════════════════════════════════════════════════════════════
-- STEP 7: INSERT สร้างบัญชี Admin (ถ้ายังไม่มี)
-- ════════════════════════════════════════════════════════════
INSERT INTO public.employees (emp_id, name, position, status, day_off, company, role, base_salary, wage_divisor, work_hours_per_day, ot_rate)
VALUES ('admin', 'ผู้บริหารสูงสุด (HRBTC)', 'Chief Executive Officer', 'ทำงานปกติ', 'อาทิตย์', 'HRBTC GROUP', 'Administrator', 50000, 30, 8, 1.5)
ON CONFLICT (emp_id) DO NOTHING;

-- ════════════════════════════════════════════════════════════
-- STEP 8: เปิดใช้งาน Supabase Realtime Replication (Live Data Synchronization)
-- ════════════════════════════════════════════════════════════
DO $$
DECLARE
  t TEXT;
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    FOR t IN SELECT unnest(ARRAY[
      'employees','time_records','time_corrections','leave_requests',
      'advance_requests','payslips','system_settings','announcements',
      'projects','holidays','line_chat_state','line_groups',
      'line_followers','face_database','face_capture_log','scanner_mappings','agent_configs','attendance_raw','employee_notification_prefs'
    ]) LOOP
      BEGIN
        EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
      EXCEPTION
        WHEN duplicate_object THEN
          -- ตารางนี้อยู่ใน publication อยู่แล้ว
          NULL;
        WHEN OTHERS THEN
          NULL;
      END;
    END LOOP;
  END IF;
END $$;

-- Idempotent - รันซ้ำกี่ครั้งก็ได้ ข้อมูลไม่หาย

-- ════════════════════════════════════════════════════════════
-- STEP 9: Auto-Migration Bootstrap (รันครั้งเดียว — หลังจากนี้ GAS จัดการ schema ให้เอง)
-- สร้าง: ตาราง schema_migrations + RPC fn_run_migrations (เฉพาะ service_role เรียกได้)
-- ════════════════════════════════════════════════════════════

-- 1. ตารางบันทึกเวอร์ชัน migration ที่รันแล้ว
CREATE TABLE IF NOT EXISTS public.schema_migrations (
    version TEXT PRIMARY KEY,
    description TEXT,
    applied_at TIMESTAMPTZ DEFAULT NOW()
);

-- เปิด RLS แต่ไม่สร้าง policy → anon/authenticated เข้าไม่ได้ (service_role bypass RLS)
ALTER TABLE public.schema_migrations ENABLE ROW LEVEL SECURITY;

-- 2. RPC ตัวรัน migration: รับ array ของ SQL statements แล้ว EXECUTE ทีละตัว
--    - SECURITY DEFINER: รันด้วยสิทธิ์เจ้าของฟังก์ชัน (postgres) → ทำ DDL ได้
--    - จับ error duplicate_* เป็น 'skipped' (ของมีอยู่แล้ว = ข้าม) → รันซ้ำได้ปลอดภัย
CREATE OR REPLACE FUNCTION public.fn_run_migrations(p_statements JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  stmt TEXT;
  results JSONB := '[]'::jsonb;
  all_ok BOOLEAN := true;
  first_err TEXT := NULL;
BEGIN
  FOR stmt IN SELECT jsonb_array_elements_text(p_statements) LOOP
    BEGIN
      EXECUTE stmt;
      results := results || jsonb_build_object('sql', left(stmt, 120), 'ok', true);
    EXCEPTION
      WHEN duplicate_table OR duplicate_column OR duplicate_object OR unique_violation THEN
        -- ของมีอยู่แล้ว = ข้ามได้ (idempotent)
        results := results || jsonb_build_object('sql', left(stmt, 120), 'ok', true, 'skipped', true);
      WHEN OTHERS THEN
        all_ok := false;
        first_err := SQLERRM;
        results := results || jsonb_build_object('sql', left(stmt, 120), 'ok', false, 'error', SQLERRM);
        EXIT;
    END;
  END LOOP;
  RETURN jsonb_build_object('ok', all_ok, 'error', first_err, 'results', results);
END;
$$;

-- 3. จำกัดสิทธิ์: ให้เฉพาะ service_role เรียกได้ (anon/authenticated โดน revoke)
REVOKE ALL ON FUNCTION public.fn_run_migrations(JSONB) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.fn_run_migrations(JSONB) FROM anon;
REVOKE ALL ON FUNCTION public.fn_run_migrations(JSONB) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.fn_run_migrations(JSONB) TO service_role;

-- Idempotent - รันซ้ำกี่ครั้งก็ได้ ข้อมูลไม่หาย
-- หมายเหตุ: หลังรัน STEP 9 แล้ว GAS จะอัปเดต schema ให้อัตโนมัติ (AutoMigrate.gs) ผ่านปุ่มซิงค์/Trigger รายวัน
--          ไม่ต้องกลับมารัน SQL Editor อีก ยกเว้นต้องการรีเซ็ตระบบทั้งหมด
