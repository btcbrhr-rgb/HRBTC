// ============================================================================
// HRBTC V1.1 - Centralized Configuration
// Single Source of Truth for all external URLs and config values
// ============================================================================

window.HRBT_CONFIG = {
  // Google Apps Script Web App URL
  // แก้ที่นี่จุดเดียวเมื่อ Deploy ใหม่
  GAS_WEB_APP_URL: 'https://script.google.com/macros/s/AKfycbzAjYIvySRYzpiAV2ppzwrYDzN41OHBy_pwTlB_t3dwMJ6fPxPUcmfzb586fcdsrXKFdQ/exec',

  // Supabase Config (public anon key - safe for client)
  SUPABASE: {
    url: 'https://uldeugqrkabplavusoci.supabase.co',
    anonKey: 'sb_publishable__MbMYXLfBvlHHb6bKwigfA_vtGnn5Ll',
    mode: 'hybrid'
  },

  // Company Info (used across the app)
  COMPANY: {
    name: 'บริษัท บุรีรัมย์ธงชัยก่อสร้าง จำกัด',
    address: '31/2 ถนนอินจันทร์ณรงค์ ต.ในเมือง อ.เมือง จ.บุรีรัมย์ 31000',
    taxId: '0315559001144',
    phone: '044-611134',
    fax: '044-611134',
    logoUrl: 'https://img2.pic.in.th/pic/Screenshot-2025-03-03-132721e6cc77cbcea28f01.png',
    portalName: 'Buriram Thongchai Portal',
    adminTitle: 'Buriram Thongchai Admin'
  },

  // Billing Cycle Defaults
  BILLING: {
    startDay: 26,
    endDay: 25
  },

  // Helper methods
  getGasUrl: function() {
    return this.GAS_WEB_APP_URL;
  },

  getSupabaseUrl: function() {
    return this.SUPABASE.url;
  },

  getSupabaseKey: function() {
    return this.SUPABASE.anonKey;
  }
};

// Backward compatibility - expose as global for existing code
window.GAS_WEB_APP_URL = window.HRBT_CONFIG.GAS_WEB_APP_URL;
window.SERVER_API_URL = window.HRBT_CONFIG.GAS_WEB_APP_URL;