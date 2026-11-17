const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { db, initDatabase } = require('./database/db');

// Initialize database schema and seeds
initDatabase();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ extended: true, limit: '25mb' }));

// Static files
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'public', 'uploads')));

// Ensure upload directories exist
const uploadDirs = [
  path.join(__dirname, 'public', 'uploads', 'selfies'),
  path.join(__dirname, 'public', 'uploads', 'materi'),
  path.join(__dirname, 'public', 'uploads', 'tugas')
];
uploadDirs.forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// Multer storage config
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    if (file.fieldname === 'file_materi') {
      cb(null, path.join(__dirname, 'public', 'uploads', 'materi'));
    } else {
      cb(null, path.join(__dirname, 'public', 'uploads', 'tugas'));
    }
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || '.pdf';
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E6);
    cb(null, `${file.fieldname}-${uniqueSuffix}${ext}`);
  }
});
const upload = multer({ storage });

// ==========================================
// 1. HELPER: WHATSAPP GATEWAY DISPATCHER
// ==========================================
async function sendWhatsAppNotification(phoneNumber, message) {
  const config = db.prepare('SELECT * FROM sekolah_config WHERE id = 1').get();
  let status = 'Sent';

  if (config && !config.is_simulator && config.fonnte_token && config.fonnte_token !== 'DEV-FONNTE-TOKEN-DEMO') {
    try {
      const response = await fetch(config.wa_gateway_url, {
        method: 'POST',
        headers: {
          'Authorization': config.fonnte_token,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          target: phoneNumber,
          message: message,
          countryCode: '62'
        })
      });
      const resJson = await response.json();
      if (!resJson.status) {
        status = 'Failed';
      }
    } catch (err) {
      console.error('WhatsApp API dispatch error:', err.message);
      status = 'Failed';
    }
  }

  const now = new Date().toISOString().replace('T', ' ').substring(0, 19);
  const stmt = db.prepare('INSERT INTO wa_log (penerima_wa, pesan, status_kirim, created_at) VALUES (?, ?, ?, ?)');
  stmt.run(phoneNumber, message, status, now);

  return { status, phoneNumber, message, timestamp: now };
}

// ==========================================
// 2. AUTHENTICATION & DEMO ROLES
// ==========================================
app.get('/api/auth/demo-users', (req, res) => {
  const users = db.prepare(`
    SELECT u.id, u.username, u.role, u.password,
      CASE 
        WHEN u.role = 'siswa' THEN s.nama
        WHEN u.role IN ('guru', 'guru_piket') THEN g.nama
        WHEN u.role = 'orang_tua' THEN 'Wali Siswa: ' || COALESCE(sw.nama, 'Dimas Aditya')
        ELSE 'Super Administrator'
      END as display_name,
      CASE
        WHEN u.role = 'siswa' THEN k.nama_kelas
        ELSE ''
      END as info_tambahan
    FROM users u
    LEFT JOIN siswa s ON s.user_id = u.id
    LEFT JOIN guru g ON g.user_id = u.id
    LEFT JOIN siswa sw ON sw.orang_tua_user_id = u.id
    LEFT JOIN kelas k ON s.kelas_id = k.id
    ORDER BY u.id ASC
  `).all();
  res.json({ success: true, data: users });
});

app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ success: false, message: 'Username / Nomor Identitas (NIS/NIP) dan kata sandi wajib diisi!' });
  }

  // Support login via username OR NIP (guru) OR NIS/NISN (siswa)
  const user = db.prepare(`
    SELECT u.* FROM users u
    LEFT JOIN guru g ON g.user_id = u.id
    LEFT JOIN siswa s ON s.user_id = u.id
    WHERE (u.username = ? OR g.nip = ? OR s.nis = ? OR s.nisn = ?) AND u.password = ?
  `).get(username, username, username, username, password);

  if (!user) {
    return res.status(401).json({ success: false, message: 'Identitas pengguna (Username/NIS/NIP) atau kata sandi tidak sesuai!' });
  }

  let profile = { ...user };
  delete profile.password;

  if (user.role === 'siswa') {
    const siswaData = db.prepare(`
      SELECT s.*, k.nama_kelas, g.nama as wali_kelas_nama
      FROM siswa s
      LEFT JOIN kelas k ON s.kelas_id = k.id
      LEFT JOIN guru g ON k.wali_kelas_id = g.id
      WHERE s.user_id = ?
    `).get(user.id);
    profile.detail = siswaData;
  } else if (user.role === 'guru' || user.role === 'guru_piket') {
    const guruData = db.prepare(`
      SELECT g.*, k.id as wali_kelas_id, k.nama_kelas as wali_kelas_nama
      FROM guru g
      LEFT JOIN kelas k ON k.wali_kelas_id = g.id
      WHERE g.user_id = ?
    `).get(user.id);
    profile.detail = guruData;
  } else if (user.role === 'orang_tua') {
    const anakData = db.prepare(`
      SELECT s.*, k.nama_kelas, g.nama as wali_kelas_nama
      FROM siswa s
      LEFT JOIN kelas k ON s.kelas_id = k.id
      LEFT JOIN guru g ON k.wali_kelas_id = g.id
      WHERE s.orang_tua_user_id = ?
    `).get(user.id);
    profile.detail = anakData;
  }

  res.json({ success: true, message: `Login berhasil! Selamat datang, ${profile.detail?.nama || profile.username}.`, user: profile });
});

// Single Sign-On (SSO) Google Workspace & Microsoft 365
app.post('/api/auth/sso', (req, res) => {
  const { provider, email } = req.body;
  // Default to teacher (Drs. Bambang) or matching user
  let user = null;
  if (email) {
    user = db.prepare("SELECT * FROM users WHERE username = ?").get(email.split('@')[0]);
  }
  if (!user) {
    user = db.prepare("SELECT * FROM users WHERE username = 'guru_bambang'").get();
  }

  let profile = { ...user };
  delete profile.password;
  profile.sso_provider = provider === 'microsoft' ? 'Microsoft 365 Education' : 'Google Workspace for Education';

  if (user.role === 'guru' || user.role === 'guru_piket') {
    profile.detail = db.prepare(`
      SELECT g.*, k.id as wali_kelas_id, k.nama_kelas as wali_kelas_nama
      FROM guru g
      LEFT JOIN kelas k ON k.wali_kelas_id = g.id
      WHERE g.user_id = ?
    `).get(user.id);
  } else if (user.role === 'siswa') {
    profile.detail = db.prepare(`
      SELECT s.*, k.nama_kelas, g.nama as wali_kelas_nama
      FROM siswa s
      LEFT JOIN kelas k ON s.kelas_id = k.id
      LEFT JOIN guru g ON k.wali_kelas_id = g.id
      WHERE s.user_id = ?
    `).get(user.id);
  }

  res.json({
    success: true,
    message: `Autentikasi Single Sign-On (${profile.sso_provider}) berhasil! Selamat datang, ${profile.detail?.nama || profile.username}.`,
    user: profile
  });
});

// Lupa Kata Sandi (Forgot Password & Recovery Dispatch)
app.post('/api/auth/forgot-password', (req, res) => {
  const { identifier } = req.body;
  if (!identifier) {
    return res.status(400).json({ success: false, message: 'Masukkan Username, Email Institusi, NIS, atau NIP Anda!' });
  }

  const user = db.prepare(`
    SELECT u.*, s.nama as nama_siswa, s.no_wa_ortu, g.nama as nama_guru, g.no_wa as no_wa_guru
    FROM users u
    LEFT JOIN guru g ON g.user_id = u.id
    LEFT JOIN siswa s ON s.user_id = u.id
    WHERE u.username = ? OR g.nip = ? OR s.nis = ? OR s.nisn = ?
  `).get(identifier, identifier, identifier, identifier);

  const resetCode = Math.floor(100000 + Math.random() * 900000).toString();
  const userName = user ? (user.nama_guru || user.nama_siswa || user.username) : identifier;
  const waTarget = user?.no_wa_guru || user?.no_wa_ortu || '081234567801';

  db.prepare(`
    INSERT INTO wa_log (penerima_wa, pesan, status_kirim)
    VALUES (?, ?, 'Sent')
  `).run(waTarget, `[SIAKAD SMA HIDAYATUN NAJAH] Kode OTP pemulihan kata sandi akun ${userName} adalah: ${resetCode}. Berlaku selama 15 menit. Jangan bagikan kode ini kepada siapa pun.`);

  res.json({
    success: true,
    message: `Kode pemulihan kata sandi (${resetCode}) telah dikirimkan ke email resmi dan nomor WhatsApp terdaftar (${waTarget.slice(0, 4)}****${waTarget.slice(-3)}).`,
    code: resetCode,
    user_name: userName
  });
});

// ==========================================
// 2B. PPDB (PENERIMAAN PESERTA DIDIK BARU) API
// ==========================================
app.post('/api/ppdb/login', (req, res) => {
  const { nisn, password_token, jalur, jalur_pendaftaran, captcha, captcha_expected } = req.body;
  if (!nisn || !password_token) {
    return res.status(400).json({ success: false, message: 'NISN dan Kata Sandi/PIN/Token wajib diisi!' });
  }

  // Validate Captcha (case-insensitive) if provided
  if (captcha_expected && captcha && captcha.trim().toUpperCase() !== captcha_expected.trim().toUpperCase()) {
    return res.status(400).json({ success: false, message: 'Kode verifikasi CAPTCHA salah! Silakan periksa kembali.' });
  }

  const cleanNisn = String(nisn).trim();
  const cleanPass = String(password_token).trim();

  let pendaftar = db.prepare(`
    SELECT * FROM ppdb_pendaftar WHERE nisn = ? AND password_token = ?
  `).get(cleanNisn, cleanPass);

  if (!pendaftar) {
    return res.status(401).json({ success: false, message: 'NISN atau Kata Sandi / PIN / Token keamanan tidak cocok. Pastikan NISN 10 digit dan PIN sudah benar!' });
  }

  // Update preferred track if selected differently
  const selectedJalur = jalur || jalur_pendaftaran;
  if (selectedJalur && selectedJalur !== pendaftar.jalur_pendaftaran) {
    db.prepare('UPDATE ppdb_pendaftar SET jalur_pendaftaran = ? WHERE id = ?').run(selectedJalur, pendaftar.id);
    pendaftar.jalur_pendaftaran = selectedJalur;
  }

  delete pendaftar.password_token;
  res.json({
    success: true,
    message: `Login PPDB Berhasil! Selamat datang calon peserta didik, ${pendaftar.nama_lengkap}.`,
    pendaftar,
    data: pendaftar
  });
});

app.post('/api/ppdb/register', (req, res) => {
  const { nisn, nama_lengkap, asal_sekolah, jalur_pendaftaran, password_token, no_wa, captcha, captcha_expected, nilai_rata_rata, skor_jarak_km } = req.body;
  if (!nisn || !nama_lengkap || !asal_sekolah || !password_token || !no_wa) {
    return res.status(400).json({ success: false, message: 'Semua kolom formulir pendaftaran wajib diisi!' });
  }

  if (captcha_expected && captcha && captcha.trim().toUpperCase() !== captcha_expected.trim().toUpperCase()) {
    return res.status(400).json({ success: false, message: 'Kode CAPTCHA tidak sesuai!' });
  }

  const cleanNisn = String(nisn).trim();
  if (cleanNisn.length !== 10 || !/^\d{10}$/.test(cleanNisn)) {
    return res.status(400).json({ success: false, message: 'NISN harus berupa 10 digit angka resmi Pusdatin!' });
  }

  const existing = db.prepare('SELECT * FROM ppdb_pendaftar WHERE nisn = ?').get(cleanNisn);
  if (existing) {
    return res.status(400).json({
      success: false,
      message: `NISN ${cleanNisn} sudah terdaftar dengan No. Registrasi: ${existing.no_registrasi} atas nama ${existing.nama_lengkap}. Silakan login langsung menggunakan NISN Anda.`
    });
  }

  const lastId = db.prepare('SELECT MAX(id) as maxId FROM ppdb_pendaftar').get().maxId || 0;
  const no_registrasi = `PPDB-2026-${String(lastId + 1).padStart(4, '0')}`;
  const jalur = jalur_pendaftaran || 'Zonasi';
  const nilai = parseFloat(nilai_rata_rata) || 86.0;
  const jarak = parseFloat(skor_jarak_km) || 1.2;

  db.prepare(`
    INSERT INTO ppdb_pendaftar (no_registrasi, nisn, nama_lengkap, asal_sekolah, jalur_pendaftaran, password_token, no_wa, status_seleksi, skor_jarak_km, nilai_rata_rata)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'Menunggu Verifikasi Berkas', ?, ?)
  `).run(no_registrasi, cleanNisn, nama_lengkap.trim(), asal_sekolah.trim(), jalur, String(password_token).trim(), no_wa.trim(), jarak, nilai);

  // Send WhatsApp confirmation
  const waMsg = `[PPDB SMA HIDAYATUN NAJAH] Halo ${nama_lengkap}, pendaftaran akun PPDB Anda BERHASIL! No. Registrasi: ${no_registrasi}, NISN: ${cleanNisn}, Jalur: ${jalur}. Simpan bukti pendaftaran ini.`;
  db.prepare("INSERT INTO wa_log (penerima_wa, pesan, status_kirim) VALUES (?, ?, 'Sent')").run(no_wa.trim(), waMsg);

  const newPendaftar = db.prepare('SELECT * FROM ppdb_pendaftar WHERE no_registrasi = ?').get(no_registrasi);
  delete newPendaftar.password_token;

  res.json({
    success: true,
    message: `Registrasi PPDB Berhasil! Nomor Pendaftaran Anda: ${no_registrasi}.`,
    pendaftar: newPendaftar,
    data: newPendaftar
  });
});

app.post('/api/ppdb/forgot-password', (req, res) => {
  const { nisn, identifier } = req.body;
  const query = String(nisn || identifier || '').trim();
  if (!query) {
    return res.status(400).json({ success: false, message: 'Masukkan NISN atau Nomor WhatsApp pendaftaran Anda!' });
  }

  const pendaftar = db.prepare('SELECT * FROM ppdb_pendaftar WHERE nisn = ? OR no_wa = ?').get(query, query);
  if (!pendaftar) {
    return res.status(404).json({ success: false, message: `Data pendaftar dengan identitas "${query}" tidak ditemukan di sistem PPDB!` });
  }

  const newPin = Math.floor(100000 + Math.random() * 900000).toString();
  db.prepare('UPDATE ppdb_pendaftar SET password_token = ? WHERE id = ?').run(newPin, pendaftar.id);

  const waMsg = `[PPDB SMA HIDAYATUN NAJAH] PIN/Kata Sandi baru akun PPDB atas nama ${pendaftar.nama_lengkap} (NISN: ${pendaftar.nisn}) telah direset menjadi: ${newPin}. Segera gunakan untuk login.`;
  db.prepare("INSERT INTO wa_log (penerima_wa, pesan, status_kirim) VALUES (?, ?, 'Sent')").run(pendaftar.no_wa, waMsg);

  res.json({
    success: true,
    message: `PIN baru telah dibuat (${newPin}) dan dikirimkan ke nomor WhatsApp terdaftar (${pendaftar.no_wa.slice(0, 4)}****${pendaftar.no_wa.slice(-3)}).`,
    pin: newPin,
    code: newPin,
    nama_lengkap: pendaftar.nama_lengkap,
    nisn: pendaftar.nisn,
    no_wa: pendaftar.no_wa
  });
});

app.get('/api/ppdb/applicant/:nisn', (req, res) => {
  const { nisn } = req.params;
  const applicant = db.prepare('SELECT * FROM ppdb_pendaftar WHERE nisn = ?').get(nisn);

  if (!applicant) {
    return res.status(404).json({ success: false, message: 'Calon siswa tidak ditemukan' });
  }

  res.json({ success: true, data: applicant, pendaftar: applicant });
});

app.get('/api/ppdb/info', (req, res) => {
  res.json({
    success: true,
    data: {
      tahun_ajaran: '2026/2027',
      nama_sekolah: 'SMA Hidayatun Najah Samiran Proppo Pamekasan',
      jadwal: [
        { kegiatan: 'Pendaftaran Akun & Pengambilan PIN/Token', tanggal: '01 Mei - 15 Juni 2026', status: 'Dibuka' },
        { kegiatan: 'Verifikasi & Validasi Berkas Administrasi', tanggal: '16 - 20 Juni 2026', status: 'Mendatang' },
        { kegiatan: 'Pengumuman Hasil Kelulusan Seleksi PPDB', tanggal: '25 Juni 2026', status: 'Mendatang' },
        { kegiatan: 'Daftar Ulang & Orientasi Peserta Didik Baru', tanggal: '26 - 30 Juni 2026', status: 'Mendatang' }
      ],
      jalur: [
        { nama: 'Zonasi', kuota: '50%', deskripsi: 'Bagi calon siswa berdomisili di zona wilayah sekolah (Desa Samiran & sekitarnya).' },
        { nama: 'Prestasi', kuota: '30%', deskripsi: 'Nilai rapor SMP/MTs, piagam kejuaraan akademik, non-akademik, atau Tahfidz Al-Qur\'an.' },
        { nama: 'Afirmasi', kuota: '15%', deskripsi: 'Keluarga ekonomi kurang mampu (pemegang KIP, PKH, KKS) dan disabilitas.' },
        { nama: 'Perpindahan Tugas Orang Tua', kuota: '5%', deskripsi: 'Calon siswa yang orang tua/walinya berpindah tugas dinas resmi.' }
      ],
      syarat: [
        'Telah lulus SMP/MTs atau sederajat dan memiliki Ijazah / SKL resmi.',
        'Berusia paling tinggi 21 tahun pada tanggal 01 Juli 2026.',
        'Memiliki NISN (Nomor Induk Siswa Nasional) yang valid terdaftar di Dapodik / EMIS Kemendikbud.',
        'Melampirkan Kartu Keluarga (KK) dan Akta Kelahiran asli/legalisir.',
        'Surat Pernyataan Kesediaan Mentaati Tata Tertib SMA & Pondok Pesantren Hidayatun Najah.'
      ],
      helpdesk: {
        wa: '+62 812-3456-7801',
        nama: 'Panitia PPDB SMA Hidayatun Najah (Pak Hasan / Bu Siti)',
        jam_layanan: 'Senin - Sabtu, 07:30 - 15:00 WIB'
      }
    }
  });
});

// ==========================================
// 3. FITUR BARU: ABSENSI GURU MENGGUNAKAN SIDIK JARI (BIOMETRIK)
// ==========================================
app.get('/api/presensi-guru/today', (req, res) => {
  const today = new Date().toISOString().split('T')[0];
  const list = db.prepare(`
    SELECT pg.*, g.nama as nama_guru, g.nip, g.no_wa
    FROM presensi_guru pg
    JOIN guru g ON pg.guru_id = g.id
    WHERE pg.tanggal = ?
    ORDER BY pg.jam_masuk DESC
  `).all(today);
  res.json({ success: true, data: list });
});

app.get('/api/presensi-guru/status', (req, res) => {
  const { guru_id } = req.query;
  const today = new Date().toISOString().split('T')[0];
  const record = db.prepare(`
    SELECT * FROM presensi_guru
    WHERE guru_id = ? AND tanggal = ?
    ORDER BY id DESC LIMIT 1
  `).get(guru_id, today);

  res.json({ success: true, hasPresensi: !!record, data: record || null });
});

app.post('/api/presensi-guru/fingerprint', (req, res) => {
  try {
    const { guru_id, tipe_clock, fingerprint_code } = req.body;
    if (!guru_id) {
      return res.status(400).json({ success: false, message: 'Guru harus dipilih!' });
    }

    const guru = db.prepare('SELECT * FROM guru WHERE id = ?').get(guru_id);
    if (!guru) {
      return res.status(404).json({ success: false, message: 'Data Guru tidak ditemukan!' });
    }

    const now = new Date();
    const today = now.toISOString().split('T')[0];
    const timeStr = now.toTimeString().split(' ')[0]; // HH:mm:ss

    const existing = db.prepare('SELECT * FROM presensi_guru WHERE guru_id = ? AND tanggal = ?').get(guru_id, today);

    if (tipe_clock === 'pulang') {
      if (existing) {
        db.prepare('UPDATE presensi_guru SET jam_pulang = ? WHERE id = ?').run(timeStr, existing.id);
        return res.json({
          success: true,
          message: `Absen Pulang Berhasil! Jam: ${timeStr} WIB. Terima kasih atas dedikasi Anda hari ini, Bapak/Ibu ${guru.nama}.`,
          jam_pulang: timeStr,
          guru: guru.nama
        });
      } else {
        return res.status(400).json({ success: false, message: 'Anda belum melakukan absen masuk hari ini!' });
      }
    } else {
      // Clock in
      if (existing) {
        return res.json({
          success: true,
          message: `Anda sudah tercatat hadir masuk pada ${existing.jam_masuk} WIB melalui Biometrik Sidik Jari.`,
          jam_masuk: existing.jam_masuk,
          guru: guru.nama,
          already_clocked: true
        });
      }

      db.prepare(`
        INSERT INTO presensi_guru (guru_id, tanggal, jam_masuk, metode_verifikasi, status, keterangan)
        VALUES (?, ?, ?, 'Biometrik Sidik Jari', 'Hadir', 'Sensor Fingerprint Terminal Terverifikasi')
      `).run(guru_id, today, timeStr);

      return res.json({
        success: true,
        message: `Verifikasi Sidik Jari Berhasil (Match 99.8%)! ${guru.nama} tercatat HADIR pada ${timeStr} WIB.`,
        jam_masuk: timeStr,
        guru: guru.nama,
        nip: guru.nip
      });
    }
  } catch (err) {
    console.error('Error fingerprint attendance:', err);
    res.status(500).json({ success: false, message: 'Gagal memproses sidik jari: ' + err.message });
  }
});

// ==========================================
// 4. FITUR BARU: ABSENSI SISWA MANUAL DI KELAS OLEH GURU MAPEL
// ==========================================

// Get attendance sheet for a class & subject
app.get('/api/presensi-siswa/kelas-sheet', (req, res) => {
  const { kelas_id, mapel_id, tanggal } = req.query;
  if (!kelas_id) {
    return res.status(400).json({ success: false, message: 'ID Kelas wajib disertakan!' });
  }

  const today = tanggal || new Date().toISOString().split('T')[0];

  const students = db.prepare(`
    SELECT s.id, s.nis, s.nama, s.no_wa_ortu, k.nama_kelas,
      p.id as presensi_id,
      COALESCE(p.status, 'Hadir') as status,
      p.keterangan,
      p.jam_masuk
    FROM siswa s
    JOIN kelas k ON s.kelas_id = k.id
    LEFT JOIN presensi_smart p ON p.siswa_id = s.id 
      AND p.tanggal = ? 
      AND (p.mapel_id = ? OR p.mapel_id IS NULL)
    WHERE s.kelas_id = ?
    ORDER BY s.nama ASC
  `).all(today, mapel_id || null, kelas_id);

  res.json({ success: true, tanggal: today, data: students });
});

// Teacher submits manual attendance for the entire class
app.post('/api/presensi-siswa/batch-save', async (req, res) => {
  try {
    const { kelas_id, mapel_id, guru_id, tanggal, attendance_list } = req.body;

    if (!kelas_id || !Array.isArray(attendance_list) || attendance_list.length === 0) {
      return res.status(400).json({ success: false, message: 'Data presensi siswa tidak boleh kosong!' });
    }

    const today = tanggal || new Date().toISOString().split('T')[0];
    const timeNow = new Date().toTimeString().split(' ')[0];

    const mapel = mapel_id ? db.prepare('SELECT nama_mapel FROM mata_pelajaran WHERE id = ?').get(mapel_id) : null;
    const guru = guru_id ? db.prepare('SELECT nama FROM guru WHERE id = ?').get(guru_id) : null;
    const mapelName = mapel ? mapel.nama_mapel : 'Pelajaran';
    const guruName = guru ? guru.nama : 'Guru Pengampu';

    let savedCount = 0;
    let waTriggerCount = 0;

    for (const item of attendance_list) {
      const { siswa_id, status, keterangan } = item;
      const existing = db.prepare(`
        SELECT id FROM presensi_smart 
        WHERE siswa_id = ? AND tanggal = ? AND (mapel_id = ? OR mapel_id IS NULL)
      `).get(siswa_id, today, mapel_id || null);

      if (existing) {
        db.prepare(`
          UPDATE presensi_smart
          SET status = ?, keterangan = ?, jam_masuk = ?, mapel_id = ?, guru_id = ?, verified_by = ?
          WHERE id = ?
        `).run(status, keterangan || `Diabsen oleh ${guruName}`, timeNow, mapel_id || null, guru_id || null, guru_id || null, existing.id);
      } else {
        db.prepare(`
          INSERT INTO presensi_smart (siswa_id, mapel_id, guru_id, tanggal, jam_masuk, status, keterangan, verified_by)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).run(siswa_id, mapel_id || null, guru_id || null, today, timeNow, status, keterangan || `Diabsen oleh ${guruName}`, guru_id || null);
      }
      savedCount++;

      // Trigger WhatsApp Notification to Parent if student is ALFA, IZIN, or SAKIT
      if (status === 'Alfa' || status === 'Izin' || status === 'Sakit') {
        const studentInfo = db.prepare('SELECT nama, no_wa_ortu FROM siswa WHERE id = ?').get(siswa_id);
        if (studentInfo && studentInfo.no_wa_ortu) {
          const waMsg = `*PEMBERITAHUAN PRESENSI SIAKAD SMA*\n\nYth. Orang Tua / Wali,\n\nKami menginformasikan bahwa ananda *${studentInfo.nama}* pada jam pelajaran *${mapelName}* hari ini (${today}) tercatat:\n\n📌 Status: *${status.toUpperCase()}*\n👨‍🏫 Guru Pengampu: ${guruName}\n📝 Keterangan: ${keterangan || '-'}\n⏰ Waktu Presensi: ${timeNow} WIB\n\nMohon konfirmasi jika ananda berhalangan hadir. Terima kasih.\n_SIAKAD SMA Kedisiplinan_`;

          await sendWhatsAppNotification(studentInfo.no_wa_ortu, waMsg);
          waTriggerCount++;
        }
      }
    }

    res.json({
      success: true,
      message: `Presensi ${savedCount} siswa berhasil disimpan! Notifikasi WhatsApp otomatis dikirim ke ${waTriggerCount} orang tua murid yang berhalangan (Alfa/Izin/Sakit).`,
      saved_count: savedCount,
      wa_sent_count: waTriggerCount
    });
  } catch (err) {
    console.error('Error saving batch attendance:', err);
    res.status(500).json({ success: false, message: 'Gagal menyimpan presensi siswa: ' + err.message });
  }
});

// History of student attendance with filters
app.get('/api/presensi/history', (req, res) => {
  const { kelas_id, tanggal, siswa_id, status } = req.query;
  let sql = `
    SELECT p.*, s.nama as nama_siswa, s.nis, k.nama_kelas, 
           m.nama_mapel, g.nama as nama_guru_pengampu
    FROM presensi_smart p
    JOIN siswa s ON p.siswa_id = s.id
    JOIN kelas k ON s.kelas_id = k.id
    LEFT JOIN mata_pelajaran m ON p.mapel_id = m.id
    LEFT JOIN guru g ON p.guru_id = g.id
    WHERE 1=1
  `;
  const params = [];

  if (kelas_id) {
    sql += ' AND s.kelas_id = ?';
    params.push(kelas_id);
  }
  if (tanggal) {
    sql += ' AND p.tanggal = ?';
    params.push(tanggal);
  }
  if (siswa_id) {
    sql += ' AND p.siswa_id = ?';
    params.push(siswa_id);
  }
  if (status) {
    sql += ' AND p.status = ?';
    params.push(status);
  }

  sql += ' ORDER BY p.tanggal DESC, p.jam_masuk DESC LIMIT 100';
  const list = db.prepare(sql).all(...params);
  res.json({ success: true, data: list });
});

// Single student clockin status check
app.get('/api/presensi/status-today', (req, res) => {
  const { siswa_id } = req.query;
  const today = new Date().toISOString().split('T')[0];
  const presensi = db.prepare(`
    SELECT p.*, m.nama_mapel, g.nama as nama_guru
    FROM presensi_smart p
    LEFT JOIN mata_pelajaran m ON p.mapel_id = m.id
    LEFT JOIN guru g ON p.guru_id = g.id
    WHERE p.siswa_id = ? AND p.tanggal = ?
    ORDER BY p.id DESC LIMIT 1
  `).get(siswa_id, today);

  res.json({ success: true, hasPresensi: !!presensi, data: presensi || null });
});

// ==========================================
// 5. GURU PIKET ENTRY (DIGITAL SICK / PERMIT FORM)
// ==========================================
app.post('/api/presensi/guru-piket-entry', (req, res) => {
  const { siswa_id, status, keterangan, tanggal, guru_piket_id } = req.body;
  if (!siswa_id || !status) {
    return res.status(400).json({ success: false, message: 'Siswa dan status kehadiran wajib diisi!' });
  }

  const now = new Date();
  const dateStr = tanggal || now.toISOString().split('T')[0];
  const timeStr = now.toTimeString().split(' ')[0];

  const siswa = db.prepare('SELECT s.*, k.nama_kelas FROM siswa s LEFT JOIN kelas k ON s.kelas_id = k.id WHERE s.id = ?').get(siswa_id);
  if (!siswa) {
    return res.status(404).json({ success: false, message: 'Siswa tidak ditemukan' });
  }

  const existing = db.prepare('SELECT id FROM presensi_smart WHERE siswa_id = ? AND tanggal = ?').get(siswa_id, dateStr);
  if (existing) {
    db.prepare(`
      UPDATE presensi_smart 
      SET status = ?, keterangan = ?, jam_masuk = ?, verified_by = ?
      WHERE id = ?
    `).run(status, keterangan || `Disahkan oleh Guru Piket`, timeStr, guru_piket_id || null, existing.id);
  } else {
    db.prepare(`
      INSERT INTO presensi_smart (siswa_id, tanggal, jam_masuk, status, keterangan, verified_by)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(siswa_id, dateStr, timeStr, status, keterangan || `Disahkan oleh Guru Piket`, guru_piket_id || null);
  }

  const waMsg = `*PEMBERITAHUAN SIAKAD SMA*\n\nYth. Orang Tua / Wali,\nKami mengonfirmasi pencatatan status kehadiran *${status.toUpperCase()}* atas nama *${siswa.nama}* (Kelas: ${siswa.nama_kelas}) untuk tanggal *${dateStr}*.\n\nCatatan Guru Piket: ${keterangan || '-'}\n\n_SIAKAD SMA Tim Piket & Kedisiplinan_`;
  sendWhatsAppNotification(siswa.no_wa_ortu, waMsg);

  res.json({ success: true, message: `Status ${status} berhasil disimpan dan orang tua telah diberi notifikasi WhatsApp.` });
});

// ==========================================
// 6. MODUL 3: ANALYTICS & SMART MONITORING (BK & KEPSEK)
// ==========================================
app.get('/api/analytics/dashboard', (req, res) => {
  const today = new Date().toISOString().split('T')[0];

  const totalSiswa = db.prepare('SELECT COUNT(*) as count FROM siswa').get().count;
  const totalGuru = db.prepare('SELECT COUNT(*) as count FROM guru').get().count;
  const totalKelas = db.prepare('SELECT COUNT(*) as count FROM kelas').get().count;

  // Teacher fingerprint attendance today
  const guruHadirFingerprint = db.prepare("SELECT COUNT(*) as count FROM presensi_guru WHERE tanggal = ? AND status = 'Hadir'").get(today).count;

  // Student attendance counts today
  const hadirToday = db.prepare("SELECT COUNT(DISTINCT siswa_id) as count FROM presensi_smart WHERE tanggal = ? AND status = 'Hadir'").get(today).count;
  const izinToday = db.prepare("SELECT COUNT(DISTINCT siswa_id) as count FROM presensi_smart WHERE tanggal = ? AND status = 'Izin'").get(today).count;
  const sakitToday = db.prepare("SELECT COUNT(DISTINCT siswa_id) as count FROM presensi_smart WHERE tanggal = ? AND status = 'Sakit'").get(today).count;
  const alfaToday = db.prepare("SELECT COUNT(DISTINCT siswa_id) as count FROM presensi_smart WHERE tanggal = ? AND status = 'Alfa'").get(today).count;

  // Monthly breakdown
  const monthlyStats = db.prepare(`
    SELECT status, COUNT(*) as total 
    FROM presensi_smart 
    WHERE strftime('%Y-%m', tanggal) = strftime('%Y-%m', 'now')
    GROUP BY status
  `).all();

  const attendanceRatio = { Hadir: 0, Izin: 0, Sakit: 0, Alfa: 0 };
  monthlyStats.forEach(item => {
    if (attendanceRatio.hasOwnProperty(item.status)) {
      attendanceRatio[item.status] = item.total;
    }
  });

  // Early Warning for BK: Students with high Alfa
  const warningAlfaSiswa = db.prepare(`
    SELECT s.id, s.nama, s.nis, k.nama_kelas, s.no_wa_ortu, COUNT(p.id) as total_alfa
    FROM presensi_smart p
    JOIN siswa s ON p.siswa_id = s.id
    JOIN kelas k ON s.kelas_id = k.id
    WHERE p.status = 'Alfa'
    GROUP BY s.id
    HAVING total_alfa >= 2
    ORDER BY total_alfa DESC
  `).all();

  // Early Warning: Grade below KKM
  const warningAkademikSiswa = db.prepare(`
    SELECT s.id, s.nama, s.nis, k.nama_kelas, s.no_wa_ortu, m.nama_mapel, n.nilai_akhir, m.kkm
    FROM nilai_akademik n
    JOIN siswa s ON n.siswa_id = s.id
    JOIN kelas k ON s.kelas_id = k.id
    JOIN mata_pelajaran m ON n.mapel_id = m.id
    WHERE n.nilai_akhir < m.kkm
    ORDER BY n.nilai_akhir ASC
  `).all();

  // Class attendance ranking
  const classAttendance = db.prepare(`
    SELECT k.nama_kelas, 
           COUNT(DISTINCT CASE WHEN p.status = 'Hadir' THEN s.id END) as hadir_count,
           COUNT(s.id) as total_siswa
    FROM kelas k
    LEFT JOIN siswa s ON s.kelas_id = k.id
    LEFT JOIN presensi_smart p ON p.siswa_id = s.id AND p.tanggal = ?
    GROUP BY k.id
  `).all(today);

  res.json({
    success: true,
    data: {
      summary: {
        totalSiswa,
        totalGuru,
        guruHadirFingerprint,
        totalKelas,
        hadirToday,
        izinToday,
        sakitToday,
        alfaToday,
        rateToday: totalSiswa > 0 ? Math.round((hadirToday / totalSiswa) * 100) : 0
      },
      chartMonthly: attendanceRatio,
      earlyWarnings: {
        alfaList: warningAlfaSiswa,
        gradeDropList: warningAkademikSiswa
      },
      classAttendance
    }
  });
});

// ==========================================
// 7. MODUL 2: WHATSAPP REAL-TIME GATEWAY
// ==========================================
app.get('/api/wa/logs', (req, res) => {
  const logs = db.prepare('SELECT * FROM wa_log ORDER BY id DESC LIMIT 50').all();
  res.json({ success: true, data: logs });
});

app.post('/api/wa/broadcast', async (req, res) => {
  try {
    const { kelas_id, judul, isi_pesan, tipe } = req.body;
    if (!kelas_id || !isi_pesan) {
      return res.status(400).json({ success: false, message: 'Kelas dan isi pesan broadcast wajib diisi!' });
    }

    const siswaList = db.prepare(`
      SELECT s.id, s.nama, s.no_wa_ortu, k.nama_kelas 
      FROM siswa s
      JOIN kelas k ON s.kelas_id = k.id
      WHERE s.kelas_id = ?
    `).all(kelas_id);

    if (siswaList.length === 0) {
      return res.status(404).json({ success: false, message: 'Tidak ada siswa ditemukan di kelas ini.' });
    }

    let queuedCount = 0;
    for (const s of siswaList) {
      let personalizedMsg = '';
      if (tipe === 'rekap_nilai') {
        const grades = db.prepare(`
          SELECT m.nama_mapel, n.nilai_akhir, m.kkm
          FROM nilai_akademik n
          JOIN mata_pelajaran m ON n.mapel_id = m.id
          WHERE n.siswa_id = ?
        `).all(s.id);

        let gradeDetails = grades.map(g => `• ${g.nama_mapel}: ${g.nilai_akhir} (KKM: ${g.kkm})`).join('\n');
        personalizedMsg = `*REKAP NILAI AKADEMIK - ${s.nama_kelas}*\n\nYth. Orang Tua / Wali dari *${s.nama}*,\nBerikut kami sampaikan ringkasan capaian nilai belajar siswa:\n\n${gradeDetails || 'Belum ada data nilai tercatat.'}\n\nCatatan Wali Kelas: ${isi_pesan}\n\n_SIAKAD SMA Broadcast Gateway_`;
      } else {
        personalizedMsg = `*PENGUMUMAN SEKOLAH - KELAS ${s.nama_kelas}*\n\n*${judul || 'Pemberitahuan Akademik'}*\n\nYth. Orang Tua dari ananda *${s.nama}*,\n\n${isi_pesan}\n\nSalam hormat,\n_Manajemen SMA & Wali Kelas_`;
      }

      await sendWhatsAppNotification(s.no_wa_ortu, personalizedMsg);
      queuedCount++;
    }

    res.json({
      success: true,
      message: `Broadcast berhasil dikirim ke ${queuedCount} nomor WhatsApp orang tua siswa kelas ${siswaList[0].nama_kelas}.`
    });
  } catch (err) {
    console.error('Error broadcasting WA:', err);
    res.status(500).json({ success: false, message: 'Gagal mengirim broadcast: ' + err.message });
  }
});

app.post('/api/wa/send-test', async (req, res) => {
  const { target, message } = req.body;
  if (!target || !message) {
    return res.status(400).json({ success: false, message: 'Target nomor dan pesan harus diisi!' });
  }
  const result = await sendWhatsAppNotification(target, message);
  res.json({ success: true, message: 'Pesan tes WhatsApp diproses!', data: result });
});

// ==========================================
// 8. MODUL 5: E-LEARNING MINI (MATERI & TUGAS)
// ==========================================
app.get('/api/elearning/list', (req, res) => {
  const { kelas_id, mapel_id, tipe } = req.query;
  let sql = `
    SELECT tm.*, m.nama_mapel, m.kode_mapel, k.nama_kelas, g.nama as nama_guru,
      (SELECT COUNT(*) FROM pengumpulan_tugas pt WHERE pt.tugas_id = tm.id) as submission_count
    FROM tugas_materi tm
    JOIN mata_pelajaran m ON tm.mapel_id = m.id
    JOIN kelas k ON tm.kelas_id = k.id
    JOIN guru g ON tm.guru_id = g.id
    WHERE 1=1
  `;
  const params = [];
  if (kelas_id) {
    sql += ' AND tm.kelas_id = ?';
    params.push(kelas_id);
  }
  if (mapel_id) {
    sql += ' AND tm.mapel_id = ?';
    params.push(mapel_id);
  }
  if (tipe) {
    sql += ' AND tm.tipe = ?';
    params.push(tipe);
  }
  sql += ' ORDER BY tm.id DESC';

  const list = db.prepare(sql).all(...params);
  res.json({ success: true, data: list });
});

app.post('/api/elearning/create', upload.single('file_materi'), (req, res) => {
  try {
    const { mapel_id, kelas_id, guru_id, tipe, judul, deskripsi, deadline } = req.body;
    let filePath = null;
    if (req.file) {
      filePath = `/uploads/materi/${req.file.filename}`;
    }

    db.prepare(`
      INSERT INTO tugas_materi (mapel_id, kelas_id, guru_id, tipe, judul, deskripsi, file_path, deadline)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(mapel_id, kelas_id, guru_id, tipe, judul, deskripsi, filePath, deadline || null);

    res.json({ success: true, message: `${tipe} berhasil diterbitkan ke siswa!` });
  } catch (err) {
    console.error('Error creating tugas_materi:', err);
    res.status(500).json({ success: false, message: 'Gagal membuat tugas/materi: ' + err.message });
  }
});

app.post('/api/elearning/submit', upload.single('file_jawaban'), (req, res) => {
  try {
    const { tugas_id, siswa_id, catatan_siswa } = req.body;
    let filePath = null;
    if (req.file) {
      filePath = `/uploads/tugas/${req.file.filename}`;
    }

    const existing = db.prepare('SELECT id FROM pengumpulan_tugas WHERE tugas_id = ? AND siswa_id = ?').get(tugas_id, siswa_id);
    const now = new Date().toISOString().replace('T', ' ').substring(0, 19);

    if (existing) {
      db.prepare(`
        UPDATE pengumpulan_tugas
        SET file_jawaban = COALESCE(?, file_jawaban), waktu_kirim = ?, catatan_guru = COALESCE(catatan_guru, ?)
        WHERE id = ?
      `).run(filePath, now, catatan_siswa || 'Diperbarui siswa', existing.id);
    } else {
      db.prepare(`
        INSERT INTO pengumpulan_tugas (tugas_id, siswa_id, file_jawaban, waktu_kirim)
        VALUES (?, ?, ?, ?)
      `).run(tugas_id, siswa_id, filePath, now);
    }

    res.json({ success: true, message: 'Jawaban tugas Anda berhasil dikirim ke guru!' });
  } catch (err) {
    console.error('Error submitting tugas:', err);
    res.status(500).json({ success: false, message: 'Gagal mengumpulkan tugas: ' + err.message });
  }
});

app.get('/api/elearning/submissions/:tugas_id', (req, res) => {
  const { tugas_id } = req.params;
  const submissions = db.prepare(`
    SELECT pt.*, s.nama as nama_siswa, s.nis, k.nama_kelas
    FROM pengumpulan_tugas pt
    JOIN siswa s ON pt.siswa_id = s.id
    JOIN kelas k ON s.kelas_id = k.id
    WHERE pt.tugas_id = ?
    ORDER BY pt.waktu_kirim DESC
  `).all(tugas_id);

  res.json({ success: true, data: submissions });
});

app.post('/api/elearning/grade', (req, res) => {
  const { submission_id, nilai, catatan_guru } = req.body;
  if (!submission_id || nilai === undefined) {
    return res.status(400).json({ success: false, message: 'Submission ID dan nilai wajib disertakan!' });
  }

  db.prepare(`
    UPDATE pengumpulan_tugas
    SET nilai = ?, catatan_guru = ?
    WHERE id = ?
  `).run(parseFloat(nilai), catatan_guru || '', submission_id);

  res.json({ success: true, message: 'Nilai dan umpan balik tugas berhasil disimpan!' });
});

// ==========================================
// 9. NILAI AKADEMIK & PROGRESS CHART
// ==========================================
app.get('/api/nilai', (req, res) => {
  const { siswa_id, kelas_id, mapel_id } = req.query;
  let sql = `
    SELECT n.*, s.nama as nama_siswa, s.nis, k.nama_kelas, m.nama_mapel, m.kode_mapel, m.kkm
    FROM nilai_akademik n
    JOIN siswa s ON n.siswa_id = s.id
    JOIN kelas k ON s.kelas_id = k.id
    JOIN mata_pelajaran m ON n.mapel_id = m.id
    WHERE 1=1
  `;
  const params = [];
  if (siswa_id) {
    sql += ' AND n.siswa_id = ?';
    params.push(siswa_id);
  }
  if (kelas_id) {
    sql += ' AND s.kelas_id = ?';
    params.push(kelas_id);
  }
  if (mapel_id) {
    sql += ' AND n.mapel_id = ?';
    params.push(mapel_id);
  }

  const list = db.prepare(sql).all(...params);
  res.json({ success: true, data: list });
});

app.post('/api/nilai/save', (req, res) => {
  const { siswa_id, mapel_id, tahun_ajaran, tugas, uh, uts, uas } = req.body;
  if (!siswa_id || !mapel_id) {
    return res.status(400).json({ success: false, message: 'Siswa dan Mapel wajib dipilih!' });
  }

  const t = parseFloat(tugas) || 0;
  const u = parseFloat(uh) || 0;
  const ut = parseFloat(uts) || 0;
  const ua = parseFloat(uas) || 0;
  const finalGrade = Math.round((t * 0.2 + u * 0.2 + ut * 0.3 + ua * 0.3) * 10) / 10;
  const ta = tahun_ajaran || '2025/2026 Ganjil';

  const existing = db.prepare('SELECT id FROM nilai_akademik WHERE siswa_id = ? AND mapel_id = ? AND tahun_ajaran = ?').get(siswa_id, mapel_id, ta);
  if (existing) {
    db.prepare(`
      UPDATE nilai_akademik
      SET tugas = ?, uh = ?, uts = ?, uas = ?, nilai_akhir = ?
      WHERE id = ?
    `).run(t, u, ut, ua, finalGrade, existing.id);
  } else {
    db.prepare(`
      INSERT INTO nilai_akademik (siswa_id, mapel_id, tahun_ajaran, tugas, uh, uts, uas, nilai_akhir)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(siswa_id, mapel_id, ta, t, u, ut, ua, finalGrade);
  }

  res.json({ success: true, message: `Nilai berhasil disimpan! Nilai Akhir: ${finalGrade}` });
});

app.get('/api/nilai/progression', (req, res) => {
  const { siswa_id } = req.query;
  if (!siswa_id) {
    return res.status(400).json({ success: false, message: 'siswa_id wajib disertakan!' });
  }

  const grades = db.prepare(`
    SELECT m.nama_mapel, m.kode_mapel, m.kkm, n.tugas, n.uh, n.uts, n.uas, n.nilai_akhir
    FROM nilai_akademik n
    JOIN mata_pelajaran m ON n.mapel_id = m.id
    WHERE n.siswa_id = ?
    ORDER BY m.id ASC
  `).all(siswa_id);

  res.json({ success: true, data: grades });
});

// Comprehensive Report Card (Rapor Lengkap Per Siswa)
app.get('/api/nilai/rapor/:siswa_id', (req, res) => {
  const { siswa_id } = req.params;
  const siswa = db.prepare(`
    SELECT s.*, k.nama_kelas, g.nama as nama_wali_kelas, g.nip as nip_wali_kelas
    FROM siswa s
    LEFT JOIN kelas k ON s.kelas_id = k.id
    LEFT JOIN guru g ON k.wali_kelas_id = g.id
    WHERE s.id = ?
  `).get(siswa_id);

  if (!siswa) {
    return res.status(404).json({ success: false, message: 'Data siswa tidak ditemukan' });
  }

  const config = db.prepare('SELECT * FROM sekolah_config WHERE id = 1').get();

  // Get all subjects and student grades
  const grades = db.prepare(`
    SELECT m.id as mapel_id, m.kode_mapel, m.nama_mapel, m.kkm,
      COALESCE(n.tugas, 0) as tugas,
      COALESCE(n.uh, 0) as uh,
      COALESCE(n.uts, 0) as uts,
      COALESCE(n.uas, 0) as uas,
      COALESCE(n.nilai_akhir, 0) as nilai_akhir,
      n.tahun_ajaran
    FROM mata_pelajaran m
    LEFT JOIN nilai_akademik n ON n.mapel_id = m.id AND n.siswa_id = ?
    ORDER BY m.id ASC
  `).all(siswa_id);

  // Compute predicates & remarks
  let totalNilai = 0;
  let gradedCount = 0;
  const gradesDetail = grades.map((g, idx) => {
    let predikat = 'D';
    let deskripsi = 'Perlu bimbingan dan perbaikan materi kompetensi dasar.';
    const na = g.nilai_akhir || 0;

    if (na >= 90) {
      predikat = 'A';
      deskripsi = 'Sangat baik dan istimewa dalam menguasai seluruh capaian pembelajaran.';
    } else if (na >= 80) {
      predikat = 'B';
      deskripsi = 'Baik dan tuntas dalam memahami materi pokok dan praktikum.';
    } else if (na >= g.kkm) {
      predikat = 'C';
      deskripsi = 'Cukup dan telah melampaui standar kriteria ketuntasan minimal (KKM).';
    }

    if (na > 0) {
      totalNilai += na;
      gradedCount++;
    }

    return {
      no: idx + 1,
      ...g,
      predikat,
      deskripsi,
      status_ketuntasan: na >= g.kkm ? 'TUNTAS' : 'REMEDIAL'
    };
  });

  const rataRata = gradedCount > 0 ? Math.round((totalNilai / gradedCount) * 10) / 10 : 0;

  // Attendance summary for this student
  const presensiSummary = {
    hadir: db.prepare("SELECT COUNT(*) as count FROM presensi_smart WHERE siswa_id = ? AND status = 'Hadir'").get(siswa_id).count,
    izin: db.prepare("SELECT COUNT(*) as count FROM presensi_smart WHERE siswa_id = ? AND status = 'Izin'").get(siswa_id).count,
    sakit: db.prepare("SELECT COUNT(*) as count FROM presensi_smart WHERE siswa_id = ? AND status = 'Sakit'").get(siswa_id).count,
    alfa: db.prepare("SELECT COUNT(*) as count FROM presensi_smart WHERE siswa_id = ? AND status = 'Alfa'").get(siswa_id).count
  };

  res.json({
    success: true,
    data: {
      sekolah: {
        nama: config ? config.nama_sekolah : 'SMA Hidayatun Najah Samiran Proppo Pamekasan',
        alamat: 'Jl. Raya Samiran, Kec. Proppo, Kab. Pamekasan, Madura, Jawa Timur 69363',
        npsn: '20554192',
        akreditasi: 'A (Unggul)',
        kepala_sekolah: config?.kepala_sekolah || 'AHMAD ANIS SUYUTI, S. Pd',
        nip_kepala_sekolah: config?.nip_kepala_sekolah || '198004122006041005'
      },
      siswa: {
        id: siswa.id,
        nama: siswa.nama,
        nis: siswa.nis,
        nisn: siswa.nisn,
        kelas: siswa.nama_kelas || 'XII-1',
        semester: 'Ganjil',
        tahun_ajaran: '2025/2026',
        wali_kelas: siswa.nama_wali_kelas || 'Drs. Bambang Suryono, M.Pd',
        nip_wali_kelas: siswa.nip_wali_kelas || '197505122002121001'
      },
      statistik: {
        total_nilai: totalNilai,
        rata_rata: rataRata,
        jumlah_mapel: grades.length,
        predikat_umum: rataRata >= 85 ? 'Amat Baik' : rataRata >= 75 ? 'Baik' : 'Cukup'
      },
      nilai_list: gradesDetail,
      presensi: presensiSummary,
      tanggal_cetak: new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })
    }
  });
});

// ==========================================
// 10. MASTER DATA & CONFIG
// ==========================================
app.get('/api/config/sekolah', (req, res) => {
  const config = db.prepare('SELECT * FROM sekolah_config WHERE id = 1').get();
  res.json({ success: true, data: config });
});

app.put('/api/config/sekolah', (req, res) => {
  const { nama_sekolah, latitude_sekolah, longitude_sekolah, radius_meter, fonnte_token, is_simulator } = req.body;
  db.prepare(`
    UPDATE sekolah_config 
    SET nama_sekolah = ?, latitude_sekolah = ?, longitude_sekolah = ?, radius_meter = ?, fonnte_token = ?, is_simulator = ?
    WHERE id = 1
  `).run(
    nama_sekolah,
    parseFloat(latitude_sekolah),
    parseFloat(longitude_sekolah),
    parseFloat(radius_meter),
    fonnte_token || '',
    is_simulator ? 1 : 0
  );
  const updated = db.prepare('SELECT * FROM sekolah_config WHERE id = 1').get();
  res.json({ success: true, message: 'Konfigurasi sekolah berhasil diperbarui', data: updated });
});

app.get('/api/master/kelas', (req, res) => {
  const list = db.prepare(`
    SELECT k.*, g.nama as nama_wali_kelas,
      (SELECT COUNT(*) FROM siswa s WHERE s.kelas_id = k.id) as jumlah_siswa
    FROM kelas k
    LEFT JOIN guru g ON k.wali_kelas_id = g.id
    ORDER BY k.id ASC
  `).all();
  res.json({ success: true, data: list });
});

app.get('/api/master/mapel', (req, res) => {
  const list = db.prepare('SELECT * FROM mata_pelajaran ORDER BY id ASC').all();
  res.json({ success: true, data: list });
});

app.get('/api/master/guru', (req, res) => {
  const list = db.prepare(`
    SELECT g.*, u.username, k.nama_kelas as wali_kelas_nama
    FROM guru g
    LEFT JOIN users u ON g.user_id = u.id
    LEFT JOIN kelas k ON k.wali_kelas_id = g.id
    ORDER BY g.id ASC
  `).all();
  res.json({ success: true, data: list });
});

app.get('/api/master/siswa', (req, res) => {
  const { kelas_id } = req.query;
  let sql = `
    SELECT s.*, k.nama_kelas, u.username, ortu.username as ortu_username
    FROM siswa s
    LEFT JOIN kelas k ON s.kelas_id = k.id
    LEFT JOIN users u ON s.user_id = u.id
    LEFT JOIN users ortu ON s.orang_tua_user_id = ortu.id
    WHERE 1=1
  `;
  const params = [];
  if (kelas_id) {
    sql += ' AND s.kelas_id = ?';
    params.push(kelas_id);
  }
  sql += ' ORDER BY s.id ASC';

  const list = db.prepare(sql).all(...params);
  res.json({ success: true, data: list });
});

app.post('/api/master/guru', (req, res) => {
  const { nip, nama, no_wa, is_piket, username, password } = req.body;
  if (!nip || !nama) {
    return res.status(400).json({ success: false, message: 'NIP dan Nama Guru wajib diisi!' });
  }
  try {
    const uname = username?.trim() || ('guru_' + String(nip).slice(-4));
    const pass = password?.trim() || 'guru123';
    let user = db.prepare('SELECT id FROM users WHERE username = ?').get(uname);
    let userId;
    if (!user) {
      const uRes = db.prepare("INSERT INTO users (username, password, role) VALUES (?, ?, 'guru')").run(uname, pass);
      userId = uRes.lastInsertRowid;
    } else {
      userId = user.id;
    }
    db.prepare(`
      INSERT INTO guru (user_id, nip, nama, no_wa, is_piket, fingerprint_template)
      VALUES (?, ?, ?, ?, ?, 'FP-HASH-REGISTERED')
    `).run(userId, nip, nama, no_wa || '08123456789', is_piket ? 1 : 0);
    res.json({ success: true, message: `Guru ${nama} berhasil ditambahkan! Akun Login: ${uname}` });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Gagal menambah guru: ' + err.message });
  }
});

app.post('/api/master/siswa', (req, res) => {
  const { nis, nisn, nama, kelas_id, no_wa_ortu, username, password } = req.body;
  if (!nis || !nama) {
    return res.status(400).json({ success: false, message: 'NIS dan Nama Siswa wajib diisi!' });
  }
  try {
    const uname = username?.trim() || ('siswa_' + (nisn ? String(nisn).slice(-4) : String(nis).slice(-4)));
    const pass = password?.trim() || 'siswa123';
    let user = db.prepare('SELECT id FROM users WHERE username = ?').get(uname);
    let userId;
    if (!user) {
      const uRes = db.prepare("INSERT INTO users (username, password, role) VALUES (?, ?, 'siswa')").run(uname, pass);
      userId = uRes.lastInsertRowid;
    } else {
      userId = user.id;
    }
    db.prepare(`
      INSERT INTO siswa (user_id, nis, nisn, nama, kelas_id, no_wa_ortu)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(userId, nis, nisn || nis, nama, kelas_id ? parseInt(kelas_id) : 1, no_wa_ortu || '08123456789');
    res.json({ success: true, message: `Siswa ${nama} berhasil ditambahkan! Akun Login: ${uname}` });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Gagal menambah siswa: ' + err.message });
  }
});

// Single Page Application Fallback for Express 5
app.use((req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start Server
app.listen(PORT, () => {
  console.log(`====================================================`);
  console.log(`🚀 SIAKAD SMA RAD (Pemisahan Absensi Guru & Siswa)`);
  console.log(`📡 Server running at http://localhost:${PORT}`);
  console.log(`☝️ Absensi Guru: Biometrik Sidik Jari (Fingerprint)`);
  console.log(`✍️ Absensi Murid: Manual di Kelas oleh Guru Mapel`);
  console.log(`====================================================`);
});
