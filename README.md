# Web-Frontend-GitHub — โฟลเดอร์จัดกลุ่มไฟล์ Frontend (Deploy ขึ้น GitHub)

> โฟลเดอร์นี้คือ**ที่อยู่จริงของไฟล์ frontend ทั้งหมด** — ไฟล์เหล่านี้คือชุด push ขึ้น GitHub repo `btcbrhr-rgb/HRBTC` (branch `main`)
> Vercel auto-deploy + GAS ดึงไฟล์จาก GitHub raw เพื่อเสิร์ฟหน้าเว็บ

## ไฟล์ทั้งหมดในโฟลเดอร์นี้ (กลุ่ม GitHub / Vercel)

| ลำดับ | ไฟล์ | บทบาท | ถูก GAS fetch? |
|---|---|---|---|
| 1 | `index.html` | SPA หลัก (พนักงาน + Admin ~35K บรรทัด) | ✅ `main/index.html` |
| 2 | `config.js` | Config กลาง (GAS URL / Supabase / บริษัท) — ถูก `index.html` โหลดแบบ relative | ✅ (โหลดโดย index.html) |
| 3 | `design-tokens.css` | Design Tokens ต้นฉบับ (ถูก inline ใน index.html แล้ว) | ❌ (source-only) |
| 4 | `leave_template.html` | ใบคำขอลา (รับ `__LEAVE_DATA__` inject) | ✅ `main/leave_template.html` |
| 5 | `Print_QRCard.html` | บัตรพนักงาน CR80 + QR (2-phase load) | ✅ `main/Print_QRCard.html` |
| 6 | `Print_Invoice.html` | ใบตั้งเบิกค่าแรง | ❌ แบบ standalone |
| 7 | `Print_LeaveCycle.html` | รายงานสรุปการลารอบบัญชี A4 | ❌ แบบ standalone |
| 8 | `api/gas-proxy.ts` | Vercel serverless (เลี่ยง CORS — คั่นหน้า GAS) | — |

## หลักการ Deploy

1. Push ไฟล์ทั้งหมดในโฟลเดอร์นี้ขึ้น GitHub repo `btcbrhr-rgb/HRBTC` branch `main`
2. Vercel auto-deploy หน้าเว็บจาก repo นี้
3. `api/gas-proxy.ts` ต้องอยู่ในโฟลเดอร์ `api/` (Vercel detect serverless จากโฟลเดอร์นี้)

## หมายเหตุสำคัญ

- ⚠️ ไฟล์ frontend ทั้งหมดอยู่**ในโฟลเดอร์นี้จริง** ไม่มีไฟล์ซ้ำที่ root
- ไฟล์ที่ GAS fetch (index.html, leave_template.html, Print_QRCard.html, config.js) — path ที่อ้างใน `Code.gs` ต้องตรงกับที่ push ขึ้น GitHub
- แก้ `design-tokens.css` → ต้อง sync inline copy ใน `index.html` `<style>` ด้วย (2 ที่)

## ไฟล์ที่อยู่นอกโฟลเดอร์นี้ (ปลายทางอื่น)

| ไฟล์ | ปลายทาง |
|---|---|
| `supabase_rebuild_all.sql` | รันใน Supabase SQL Editor |
| `Agent/` (Python scan_agent.py) | ติดตั้งที่เครื่องหน้างาน |
| `tools/`, `CODE_MAP.md`, docs | เก็บไว้ใน GitHub (ไม่ใช่ส่วนของหน้าเว็บ) |