// SIAKAD SMA RAD - End-to-End Automated Verification Script
const BASE_URL = 'http://localhost:3000';

async function runTests() {
  console.log('====================================================');
  console.log('🧪 RUNNING SIAKAD SMA RAD END-TO-END VERIFICATION');
  console.log('====================================================\n');

  let passed = 0;
  let failed = 0;

  async function assert(testName, fn) {
    try {
      await fn();
      console.log(`✅ [PASS] ${testName}`);
      passed++;
    } catch (e) {
      console.error(`❌ [FAIL] ${testName}:`, e.message);
      failed++;
    }
  }

  // TEST 1: Config Sekolah & Haversine Coords
  await assert('1. Ambil Konfigurasi Sekolah & Titik GPS', async () => {
    const res = await fetch(`${BASE_URL}/api/config/sekolah`);
    const json = await res.json();
    if (!json.success || !json.data.latitude_sekolah) throw new Error('Invalid config response');
  });

  // TEST 2: Presensi Guru via Biometrik Sidik Jari (Fingerprint)
  await assert('2. Presensi Guru: Absen Masuk Biometrik Sidik Jari', async () => {
    const res = await fetch(`${BASE_URL}/api/presensi-guru/fingerprint`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        guru_id: 1,
        fingerprint_code: 'FP-BAMBANG-1975',
        tipe_clock: 'masuk'
      })
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.message);
  });

  // TEST 3: Presensi Siswa Manual di Kelas oleh Guru Mapel
  await assert('3. Presensi Siswa Manual di Kelas (Batch Save & Trigger WA)', async () => {
    const res = await fetch(`${BASE_URL}/api/presensi-siswa/batch-save`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        kelas_id: 5, // XII-1
        mapel_id: 1,
        guru_id: 1,
        tanggal: new Date().toISOString().split('T')[0],
        attendance_list: [
          { siswa_id: 1, status: 'Hadir', keterangan: 'Hadir tepat waktu' },
          { siswa_id: 2, status: 'Hadir', keterangan: 'Hadir tepat waktu' }
        ]
      })
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.message);
  });

  // TEST 4: Guru Piket Entry (Dispensasi Izin / Sakit)
  await assert('4. Guru Piket Validasi Surat Izin + Otomatis Notifikasi WA Ortu', async () => {
    const res = await fetch(`${BASE_URL}/api/presensi/guru-piket-entry`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        siswa_id: 3, // Budi Santoso
        status: 'Izin',
        tanggal: new Date().toISOString().split('T')[0],
        keterangan: 'Mengikuti Olimpiade Sains Nasional Tingkat Provinsi',
        guru_piket_id: 2
      })
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.message);
  });

  // TEST 5: WhatsApp Broadcast Gateway per Kelas
  await assert('5. WhatsApp Gateway Broadcast Pengumuman ke Wali Murid X-1', async () => {
    const res = await fetch(`${BASE_URL}/api/wa/broadcast`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        kelas_id: 1,
        tipe: 'pengumuman',
        isi_pesan: 'Undangan Rapat Pleno Wali Murid dan Sosialisasi Ujian Akhir Sekolah Semester Ganjil.'
      })
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.message);
  });

  // TEST 6: E-Learning Mini: Buat Tugas Daring Baru
  await assert('6. E-Learning Mini: Guru Menerbitkan Tugas Online Baru', async () => {
    const res = await fetch(`${BASE_URL}/api/elearning/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mapel_id: 1,
        kelas_id: 1,
        guru_id: 1,
        tipe: 'Tugas',
        judul: 'Uji Pemahaman Hukum Termodinamika & Limit Lanjut',
        deskripsi: 'Selesaikan 3 soal terlampir pada lembar kerja.',
        deadline: '2026-10-30 23:59:00'
      })
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.message);
  });

  // TEST 7: Input & Perhitungan Nilai Akhir Otomatis (20% Tugas + 20% UH + 30% UTS + 30% UAS)
  await assert('7. Nilai Akademik: Perhitungan Formula Nilai Akhir Otomatis', async () => {
    const res = await fetch(`${BASE_URL}/api/nilai/save`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        siswa_id: 1,
        mapel_id: 2, // Fisika
        tugas: 90, // 20% = 18
        uh: 85,    // 20% = 17
        uts: 88,   // 30% = 26.4
        uas: 92    // 30% = 27.6 -> Total expected = 89.0
      })
    });
    const json = await res.json();
    if (!json.success || !json.message.includes('89')) {
      throw new Error('Kalkulasi nilai akhir tidak sesuai formula!');
    }
  });

  // TEST 8: Dashboard Analitik & Smart Early Warning Monitor (BK & Kepala Sekolah)
  await assert('8. Dashboard Analitik: Summary Statistik & Deteksi Dini BK', async () => {
    const res = await fetch(`${BASE_URL}/api/analytics/dashboard`);
    const json = await res.json();
    if (!json.success || !json.data.summary || !json.data.earlyWarnings) {
      throw new Error('Format respon analitik tidak valid');
    }
  });

  // TEST 9: Audit Log WhatsApp (wa_log)
  await assert('9. Audit Log WhatsApp: Verifikasi Pesan Masuk ke Tabel wa_log', async () => {
    const res = await fetch(`${BASE_URL}/api/wa/logs`);
    const json = await res.json();
    if (!json.success || json.data.length === 0) {
      throw new Error('Tabel wa_log kosong!');
    }
  });

  console.log('\n====================================================');
  console.log(`🏁 HASIL VERIFIKASI: ${passed} BERHASIL, ${failed} GAGAL`);
  console.log('====================================================\n');
}

runTests();
