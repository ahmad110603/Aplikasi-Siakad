// Verification test for updated attendance requirements
const BASE_URL = 'http://localhost:3000';

async function testUpdatedAttendance() {
  console.log('===========================================================');
  console.log('🧪 TESTING PEMISAHAN ABSENSI GURU (FINGERPRINT) & MURID (MANUAL)');
  console.log('===========================================================\n');

  let passed = 0;

  // 1. Guru Fingerprint Scan
  const resFp = await fetch(`${BASE_URL}/api/presensi-guru/fingerprint`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      guru_id: 1, // Bambang
      tipe_clock: 'masuk',
      fingerprint_code: 'FP-TEST'
    })
  });
  const jsonFp = await resFp.json();
  if (jsonFp.success) {
    console.log('✅ [PASS] 1. Guru Berhasil Absensi Masuk Menggunakan Sidik Jari:', jsonFp.message);
    passed++;
  } else {
    console.error('❌ [FAIL] 1. Fingerprint Guru gagal:', jsonFp);
  }

  // 2. Guru Absen Pulang Fingerprint
  const resFpPulang = await fetch(`${BASE_URL}/api/presensi-guru/fingerprint`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      guru_id: 1,
      tipe_clock: 'pulang'
    })
  });
  const jsonFpPulang = await resFpPulang.json();
  if (jsonFpPulang.success) {
    console.log('✅ [PASS] 2. Guru Berhasil Absen Pulang via Sidik Jari:', jsonFpPulang.message);
    passed++;
  } else {
    console.error('❌ [FAIL] 2. Fingerprint Pulang gagal:', jsonFpPulang);
  }

  // 3. Guru Muat Lembar Absensi Siswa Manual
  const resSheet = await fetch(`${BASE_URL}/api/presensi-siswa/kelas-sheet?kelas_id=5&mapel_id=1`);
  const jsonSheet = await resSheet.json();
  if (jsonSheet.success && jsonSheet.data.length > 0) {
    console.log(`✅ [PASS] 3. Guru Muat Lembar Absensi Siswa Kelas XII-1 (${jsonSheet.data.length} siswa ditemukan)`);
    passed++;
  } else {
    console.error('❌ [FAIL] 3. Lembar absensi siswa gagal:', jsonSheet);
  }

  // 4. Guru Menyimpan Presensi Siswa di Kelas (Dimas: Hadir, Siti: Hadir, Budi: Alfa)
  const resSave = await fetch(`${BASE_URL}/api/presensi-siswa/batch-save`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      kelas_id: 5,
      mapel_id: 1, // Matematika
      guru_id: 1,  // Drs. Bambang
      tanggal: new Date().toISOString().split('T')[0],
      attendance_list: [
        { siswa_id: 1, status: 'Hadir', keterangan: 'Hadir aktif' },
        { siswa_id: 2, status: 'Hadir', keterangan: 'Hadir aktif' },
        { siswa_id: 3, status: 'Alfa', keterangan: 'Tidak hadir di kelas Matematika tanpa surat' }
      ]
    })
  });
  const jsonSave = await resSave.json();
  if (jsonSave.success && jsonSave.saved_count === 3 && jsonSave.wa_sent_count >= 1) {
    console.log('✅ [PASS] 4. Guru Berhasil Simpan Absensi Kelas & Kirim Notifikasi WA ke Ortu Siswa Alfa:', jsonSave.message);
    passed++;
  } else {
    console.error('❌ [FAIL] 4. Batch save presensi siswa gagal:', jsonSave);
  }

  // 5. Verifikasi Log WhatsApp untuk Siswa Alfa
  const resWa = await fetch(`${BASE_URL}/api/wa/logs`);
  const jsonWa = await resWa.json();
  const foundAlert = jsonWa.data.some(log => log.pesan.includes('Budi Santoso') && log.pesan.includes('ALFA'));
  if (foundAlert) {
    console.log('✅ [PASS] 5. Verifikasi Audit Log WA: Notifikasi Alfa Siswa Tercatat di wa_log');
    passed++;
  } else {
    console.error('❌ [FAIL] 5. Log WA siswa alfa tidak ditemukan');
  }

  console.log('\n===========================================================');
  console.log(`🏁 HASIL VERIFIKASI: ${passed}/5 PENGUJIAN BERHASIL SEMPURNA`);
  console.log('===========================================================\n');
}

testUpdatedAttendance();
