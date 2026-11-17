// Verification Script for SIAKAD Login Dashboard
const BASE_URL = 'http://localhost:3000';

async function testLoginDashboard() {
  console.log('================================================================');
  console.log('🧪 TESTING SIAKAD LOGIN DASHBOARD & AUTHENTICATION SUITE');
  console.log('================================================================\n');

  let passed = 0;
  let failed = 0;

  async function test(name, fn) {
    try {
      await fn();
      console.log(`✅ [PASS] ${name}`);
      passed++;
    } catch (e) {
      console.error(`❌ [FAIL] ${name}:`, e.message);
      failed++;
    }
  }

  // 1. Verify HTML Structure & UI Elements
  await test('1. Verifikasi Elemen Dashboard Halaman Login di HTML', async () => {
    const res = await fetch(`${BASE_URL}/`);
    const html = await res.text();

    const expectedSnippets = [
      'id="page-login"',
      'id="app-wrapper"',
      'SMA HIDAYATUN NAJAH SAMIRAN',
      'Akreditasi "A" (Unggul) • NPSN: 20554192',
      'Papan Pengumuman & Jadwal Penting Akademik',
      'Batas Input Nilai Rapor',
      'UAS / ASAS Digital CBT',
      'Pembagian Rapor Resmi',
      'Jadwal Pemeliharaan Server',
      'Sabtu pukul 23:00 - 01:00 WIB',
      'Pusat Bantuan & Helpdesk IT',
      '+62 812-3456-7801',
      'helpdesk@smahidayatunnajah.sch.id',
      'id="login-username"',
      'id="login-password"',
      'id="btn-toggle-eye"',
      'eye-icon-open',
      'eye-icon-closed',
      'App.openForgotPasswordModal()',
      'id="btn-login-submit"',
      'Google Workspace',
      'Microsoft 365',
      'id="modal-forgot-password"',
      'id="forgot-identifier"',
      'id="btn-logout"',
      'App.handleLogout()',
      '© 2026'
    ];

    for (const snippet of expectedSnippets) {
      if (!html.includes(snippet)) {
        throw new Error(`Snippet tidak ditemukan di HTML: "${snippet}"`);
      }
    }
  });

  // 2. Test Login via NIS (Siswa)
  await test('2. Login Siswa menggunakan NIS (220101)', async () => {
    const res = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: '220101', password: 'siswa123' })
    });
    const json = await res.json();
    if (!json.success || json.user.role !== 'siswa' || json.user.detail.nama !== 'Dimas Aditya') {
      throw new Error(`Login NIS gagal: ${JSON.stringify(json)}`);
    }
  });

  // 3. Test Login via NIP (Guru)
  await test('3. Login Guru menggunakan NIP (197505122002121001)', async () => {
    const res = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: '197505122002121001', password: 'guru123' })
    });
    const json = await res.json();
    if (!json.success || json.user.role !== 'guru' || json.user.detail.nama !== 'Drs. Bambang Suryono, M.Pd') {
      throw new Error(`Login NIP gagal: ${JSON.stringify(json)}`);
    }
  });

  // 4. Test Login via Username (Admin)
  await test('4. Login Administrator menggunakan Username (admin)', async () => {
    const res = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'admin123' })
    });
    const json = await res.json();
    if (!json.success || json.user.role !== 'admin') {
      throw new Error(`Login Admin gagal: ${JSON.stringify(json)}`);
    }
  });

  // 5. Test Invalid Password Error Handling
  await test('5. Penanganan Error Kata Sandi Salah', async () => {
    const res = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: '220101', password: 'salahpassword' })
    });
    const json = await res.json();
    if (json.success || res.status !== 401) {
      throw new Error('Harusnya gagal autentikasi dengan status 401');
    }
  });

  // 6. Test Single Sign-On (Google Workspace)
  await test('6. Opsi Single Sign-On (SSO): Google Workspace for Education', async () => {
    const res = await fetch(`${BASE_URL}/api/auth/sso`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ provider: 'google' })
    });
    const json = await res.json();
    if (!json.success || !json.user.sso_provider.includes('Google')) {
      throw new Error(`SSO Google gagal: ${JSON.stringify(json)}`);
    }
  });

  // 7. Test Single Sign-On (Microsoft 365)
  await test('7. Opsi Single Sign-On (SSO): Microsoft 365 Education', async () => {
    const res = await fetch(`${BASE_URL}/api/auth/sso`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ provider: 'microsoft' })
    });
    const json = await res.json();
    if (!json.success || !json.user.sso_provider.includes('Microsoft')) {
      throw new Error(`SSO Microsoft gagal: ${JSON.stringify(json)}`);
    }
  });

  // 8. Test Lupa Kata Sandi (Forgot Password & WhatsApp OTP Dispatch)
  await test('8. Fitur Lupa Kata Sandi & Pengiriman OTP WhatsApp', async () => {
    const res = await fetch(`${BASE_URL}/api/auth/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: '220101' })
    });
    const json = await res.json();
    if (!json.success || !json.code || json.code.length !== 6) {
      throw new Error(`Forgot password gagal: ${JSON.stringify(json)}`);
    }

    // Check that wa_log recorded this OTP via /api/wa/logs
    const logRes = await fetch(`${BASE_URL}/api/wa/logs`);
    const logJson = await logRes.json();
    const hasOtpLog = logJson.data.some(l => l.pesan && l.pesan.includes(json.code));
    if (!hasOtpLog) {
      throw new Error('Log WhatsApp tidak mencatat kode OTP reset');
    }
  });

  console.log('\n================================================================');
  console.log(`📊 HASIL PENGUJIAN: ${passed} BERHASIL, ${failed} GAGAL`);
  console.log('================================================================\n');

  if (failed > 0) process.exit(1);
}

testLoginDashboard();
