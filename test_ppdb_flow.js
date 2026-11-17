// Automated Test Suite for PPDB SMA Hidayatun Najah Feature
const BASE_URL = 'http://localhost:3000';

async function testPpdbSuite() {
  console.log('================================================================');
  console.log('🧪 TESTING PPDB (PENDAFTARAN SISWA BARU SMA) FEATURE SUITE');
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

  // 1. Verifikasi Elemen UI PPDB di HTML Halaman Depan
  await test('1. Verifikasi Elemen Antarmuka Portal PPDB di HTML', async () => {
    const res = await fetch(`${BASE_URL}/`);
    const html = await res.text();

    const expectedSnippets = [
      'id="tab-portal-siakad"',
      'id="tab-portal-ppdb"',
      'id="container-portal-ppdb"',
      'id="left-notice-ppdb"',
      'Papan Informasi & Pengumuman PPDB TA 2026/2027',
      'id="ppdb-login-nisn"',
      'Kolom NISN (Nomor Induk Siswa Nasional)',
      '10 Digit NISN',
      'id="ppdb-login-password"',
      'Kolom Kata Sandi / PIN / Token',
      'id="btn-toggle-eye-ppdb"',
      'App.openForgotPpdbModal()',
      'id="ppdb-login-jalur"',
      'Jalur Zonasi',
      'Jalur Prestasi',
      'Jalur Afirmasi',
      'Jalur Perpindahan Tugas Orang Tua',
      'id="ppdb-captcha-display"',
      'id="ppdb-captcha-input"',
      'App.refreshPpdbCaptcha()',
      'id="btn-ppdb-login-submit"',
      'App.openRegisterPpdbModal()',
      'Buat Akun Baru / Pendaftaran Calon Siswa',
      'id="modal-register-ppdb"',
      'id="modal-forgot-ppdb"',
      'id="modal-dashboard-ppdb"',
      'KARTU TANDA BUKTI PENDAFTARAN PESERTA DIDIK BARU (PPDB)',
      'App.printPpdbCard()'
    ];

    for (const snippet of expectedSnippets) {
      if (!html.includes(snippet)) {
        throw new Error(`Elemen atau teks tidak ditemukan di HTML: "${snippet}"`);
      }
    }
  });

  // 2. Test Endpoint Informasi PPDB (Jadwal, Kuota, Syarat, SOP)
  await test('2. Endpoint Info PPDB (/api/ppdb/info)', async () => {
    const res = await fetch(`${BASE_URL}/api/ppdb/info`);
    const json = await res.json();

    if (!json.success || !json.data) {
      throw new Error('Gagal mengambil data info PPDB');
    }
    const d = json.data;
    if (!d.jadwal || d.jadwal.length < 3) throw new Error('Jadwal PPDB tidak lengkap');
    if (!d.kuota_jalur && !d.jalur) throw new Error('Data kuota jalur tidak ditemukan');
    if (!d.syarat_pendaftaran && !d.syarat) throw new Error('Syarat pendaftaran tidak ditemukan');
  });

  // 3. Test Login PPDB Calon Siswa Terdaftar (Muhammad Bayu Pratama)
  await test('3. Login PPDB menggunakan NISN & PIN Terdaftar', async () => {
    const res = await fetch(`${BASE_URL}/api/ppdb/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nisn: '0081234567',
        password_token: 'ppdb2026',
        jalur: 'Zonasi'
      })
    });
    const json = await res.json();
    const applicant = json.data || json.pendaftar;
    if (!json.success || !applicant || applicant.nisn !== '0081234567' || applicant.nama_lengkap !== 'Muhammad Bayu Pratama') {
      throw new Error(`Login PPDB gagal: ${JSON.stringify(json)}`);
    }
  });

  // 4. Test Penolakan Login PPDB dengan PIN Salah
  await test('4. Penolakan Login PPDB jika PIN Salah', async () => {
    const res = await fetch(`${BASE_URL}/api/ppdb/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nisn: '0081234567',
        password_token: 'pinsalah999'
      })
    });
    const json = await res.json();
    if (json.success || res.status !== 401) {
      throw new Error('Sistem harus menolak login jika PIN salah!');
    }
  });

  // 5. Test Pendaftaran Calon Siswa Baru (Registrasi)
  const testNisn = '008' + Math.floor(1000000 + Math.random() * 9000000);
  await test(`5. Pendaftaran Akun Baru Calon Siswa (NISN: ${testNisn})`, async () => {
    const res = await fetch(`${BASE_URL}/api/ppdb/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nisn: testNisn,
        nama_lengkap: 'Fathur Rahman Al-Ghifari',
        asal_sekolah: 'MTs Negeri 1 Pamekasan',
        jalur_pendaftaran: 'Prestasi',
        nilai_rata_rata: 92.5,
        skor_jarak_km: 2.1,
        no_wa: '081299887766',
        password_token: 'pinrahasia123'
      })
    });
    const json = await res.json();
    const newStudent = json.data || json.pendaftar;
    if (!json.success || !newStudent || !newStudent.no_registrasi.startsWith('PPDB-2026-')) {
      throw new Error(`Registrasi PPDB gagal: ${JSON.stringify(json)}`);
    }

    // Verifikasi dapat login menggunakan akun yang baru dibuat
    const resLogin = await fetch(`${BASE_URL}/api/ppdb/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nisn: testNisn,
        password_token: 'pinrahasia123'
      })
    });
    const jsonLogin = await resLogin.json();
    if (!jsonLogin.success) {
      throw new Error('Gagal login dengan akun siswa yang baru didaftarkan!');
    }
  });

  // 6. Test Fitur Lupa Kata Sandi / PIN PPDB
  await test('6. Pemulihan Lupa Kata Sandi / PIN via WhatsApp Gateway', async () => {
    const res = await fetch(`${BASE_URL}/api/ppdb/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        identifier: testNisn
      })
    });
    const json = await res.json();
    const pin = json.pin || json.code;
    if (!json.success || !pin || pin.length !== 6) {
      throw new Error(`Reset PIN PPDB gagal: ${JSON.stringify(json)}`);
    }

    // Login dengan PIN baru hasil reset
    const resNewLogin = await fetch(`${BASE_URL}/api/ppdb/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nisn: testNisn,
        password_token: pin
      })
    });
    const jsonNewLogin = await resNewLogin.json();
    if (!jsonNewLogin.success) {
      throw new Error('Gagal login menggunakan PIN baru hasil reset!');
    }
  });

  // 7. Test Endpoint Detail Calon Siswa (Preview Kartu Pendaftaran)
  await test('7. Pengambilan Detail Data Calon Siswa untuk Kartu A4', async () => {
    const res = await fetch(`${BASE_URL}/api/ppdb/applicant/0089876543`);
    const json = await res.json();
    const applicant = json.data || json.pendaftar;
    if (!json.success || !applicant || applicant.nama_lengkap !== 'Aisyah Nur Salsabila') {
      throw new Error(`Detail calon siswa tidak sesuai: ${JSON.stringify(json)}`);
    }
  });

  console.log(`\n================================================================`);
  console.log(`📊 HASIL PENGUJIAN PPDB: ${passed} BERHASIL, ${failed} GAGAL`);
  console.log(`================================================================\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

testPpdbSuite().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
