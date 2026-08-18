-- ==============================================================================
-- HRBTC SYSTEM - SUPABASE POSTGRESQL SCHEMA INITIALIZATION
-- ==============================================================================
-- Run this script in the Supabase SQL Editor (Dashboard > SQL Editor > New Query)
-- ==============================================================================

-- 1. EMPLOYEES (ตารางพนักงาน)
CREATE TABLE IF NOT EXISTS public.employees (
    emp_id VARCHAR(50) PRIMARY KEY,
    name TEXT NOT NULL,
    position TEXT,
    status TEXT DEFAULT 'ทำงานปกติ',
    day_off TEXT DEFAULT 'อาทิตย์',
    company TEXT,
    start_date DATE,
    phone TEXT,
    address TEXT,
    id_card TEXT,
    birth_date DATE,
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
    pin_hash TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. TIME_RECORDS (ประวัติเวลางาน)
CREATE TABLE IF NOT EXISTS public.time_records (
    id BIGSERIAL PRIMARY KEY,
    date DATE NOT NULL,
    time_in VARCHAR(10),
    time_out VARCHAR(10),
    emp_id VARCHAR(50) NOT NULL,
    is_edited BOOLEAN DEFAULT FALSE,
    source TEXT DEFAULT 'Web App',
    lat_in NUMERIC(10,7),
    lng_in NUMERIC(10,7),
    lat_out NUMERIC(10,7),
    lng_out NUMERIC(10,7),
    photo_url TEXT,
    recorded_at TIMESTAMPTZ DEFAULT NOW(),
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
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT uq_time_records_date_emp UNIQUE (date, emp_id)
);

-- 3. TIME_CORRECTIONS (คำขอแก้ไขเวลา)
CREATE TABLE IF NOT EXISTS public.time_corrections (
    id BIGSERIAL PRIMARY KEY,
    emp_id VARCHAR(50) NOT NULL,
    date DATE NOT NULL,
    new_time_in VARCHAR(10),
    new_time_out VARCHAR(10),
    reason TEXT,
    status TEXT DEFAULT 'รออนุมัติ',
    project TEXT,
    submitted_at TIMESTAMPTZ DEFAULT NOW(),
    approved_at TIMESTAMPTZ,
    approved_by TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. LEAVE_REQUESTS (คำขอลา)
CREATE TABLE IF NOT EXISTS public.leave_requests (
    id BIGSERIAL PRIMARY KEY,
    doc_id VARCHAR(50) UNIQUE,
    emp_id VARCHAR(50) NOT NULL,
    leave_type TEXT NOT NULL,
    duration TEXT DEFAULT 'เต็มวัน',
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    days_count NUMERIC(5,2) DEFAULT 1,
    reason TEXT,
    status TEXT DEFAULT 'รออนุมัติ',
    submitted_at TIMESTAMPTZ DEFAULT NOW(),
    approved_at TIMESTAMPTZ,
    approved_by TEXT,
    notes TEXT,
    lat NUMERIC(10,7),
    lng NUMERIC(10,7),
    signature_url TEXT,
    attachments TEXT,
    approval_step TEXT DEFAULT 'ฝ่ายบุคคลตรวจสอบ',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. ADVANCE_REQUESTS (คำขอเบิกเงินกลางเดือน)
CREATE TABLE IF NOT EXISTS public.advance_requests (
    id BIGSERIAL PRIMARY KEY,
    emp_id VARCHAR(50) NOT NULL,
    amount NUMERIC(12,2) NOT NULL,
    request_date DATE NOT NULL,
    pay_cycle TEXT,
    status TEXT DEFAULT 'รอตรวจสอบ',
    notes TEXT,
    payout_channel TEXT DEFAULT 'โอนผ่านบัญชีธนาคาร',
    is_recurring TEXT DEFAULT 'ไม่ใช่',
    edit_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. PAYSLIPS (สลิปเงินเดือน)
CREATE TABLE IF NOT EXISTS public.payslips (
    id BIGSERIAL PRIMARY KEY,
    emp_id VARCHAR(50) NOT NULL,
    period VARCHAR(20) NOT NULL,
    file_name TEXT,
    file_id TEXT,
    slip_url TEXT,
    recorded_at TIMESTAMPTZ DEFAULT NOW(),
    net_amount NUMERIC(12,2) DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. SYSTEM_SETTINGS (การตั้งค่าระบบ)
CREATE TABLE IF NOT EXISTS public.system_settings (
    key VARCHAR(100) PRIMARY KEY,
    value TEXT,
    default_value TEXT,
    description TEXT,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. ANNOUNCEMENTS (ข่าวสารและประกาศ)
CREATE TABLE IF NOT EXISTS public.announcements (
    id BIGSERIAL PRIMARY KEY,
    title TEXT NOT NULL,
    type TEXT DEFAULT 'ทั่วไป',
    content TEXT,
    posted_date DATE DEFAULT CURRENT_DATE,
    posted_by TEXT,
    status TEXT DEFAULT 'ใช้งาน',
    attachments TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 9. PROJECTS (โครงการ)
CREATE TABLE IF NOT EXISTS public.projects (
    id BIGSERIAL PRIMARY KEY,
    name TEXT UNIQUE NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 10. HOLIDAYS (วันหยุดนักขัตฤกษ์)
CREATE TABLE IF NOT EXISTS public.holidays (
    id BIGSERIAL PRIMARY KEY,
    date DATE UNIQUE NOT NULL,
    name TEXT NOT NULL,
    year INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==============================================================================
-- INDEXES FOR HIGH-SPEED PERFORMANCE (< 30ms)
-- ==============================================================================
CREATE INDEX IF NOT EXISTS idx_time_records_emp_date ON public.time_records(emp_id, date);
CREATE INDEX IF NOT EXISTS idx_time_records_date ON public.time_records(date);
CREATE INDEX IF NOT EXISTS idx_leave_requests_emp ON public.leave_requests(emp_id, start_date);
CREATE INDEX IF NOT EXISTS idx_time_corrections_emp ON public.time_corrections(emp_id, date);
CREATE INDEX IF NOT EXISTS idx_advance_requests_emp ON public.advance_requests(emp_id, request_date);
CREATE INDEX IF NOT EXISTS idx_payslips_emp_period ON public.payslips(emp_id, period);

-- ==============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ==============================================================================
-- Enable RLS on all tables
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.time_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.time_corrections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leave_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.advance_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payslips ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.holidays ENABLE ROW LEVEL SECURITY;

-- Allow public read & write via anon API key (For Dual-Database Web App client)
CREATE POLICY "Allow public read employees" ON public.employees FOR SELECT USING (true);
CREATE POLICY "Allow public insert employees" ON public.employees FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update employees" ON public.employees FOR UPDATE USING (true);

CREATE POLICY "Allow public read time_records" ON public.time_records FOR SELECT USING (true);
CREATE POLICY "Allow public insert time_records" ON public.time_records FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update time_records" ON public.time_records FOR UPDATE USING (true);

CREATE POLICY "Allow public read time_corrections" ON public.time_corrections FOR SELECT USING (true);
CREATE POLICY "Allow public insert time_corrections" ON public.time_corrections FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update time_corrections" ON public.time_corrections FOR UPDATE USING (true);

CREATE POLICY "Allow public read leave_requests" ON public.leave_requests FOR SELECT USING (true);
CREATE POLICY "Allow public insert leave_requests" ON public.leave_requests FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update leave_requests" ON public.leave_requests FOR UPDATE USING (true);

CREATE POLICY "Allow public read advance_requests" ON public.advance_requests FOR SELECT USING (true);
CREATE POLICY "Allow public insert advance_requests" ON public.advance_requests FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update advance_requests" ON public.advance_requests FOR UPDATE USING (true);

CREATE POLICY "Allow public read payslips" ON public.payslips FOR SELECT USING (true);
CREATE POLICY "Allow public insert payslips" ON public.payslips FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow public read system_settings" ON public.system_settings FOR SELECT USING (true);
CREATE POLICY "Allow public insert system_settings" ON public.system_settings FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update system_settings" ON public.system_settings FOR UPDATE USING (true);

CREATE POLICY "Allow public read announcements" ON public.announcements FOR SELECT USING (true);
CREATE POLICY "Allow public insert announcements" ON public.announcements FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow public read projects" ON public.projects FOR SELECT USING (true);
CREATE POLICY "Allow public insert projects" ON public.projects FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow public read holidays" ON public.holidays FOR SELECT USING (true);
CREATE POLICY "Allow public insert holidays" ON public.holidays FOR INSERT WITH CHECK (true);
