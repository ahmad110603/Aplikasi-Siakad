const { DatabaseSync } = require('node:sqlite');
const path = require('path');
const fs = require('fs');

const dbPath = path.join(__dirname, 'siakad.sqlite');
const db = new DatabaseSync(dbPath);

// Enable Foreign Keys
db.exec('PRAGMA foreign_keys = ON;');

function initDatabase() {
  db.exec(`
    -- 1. users
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      role TEXT CHECK(role IN ('admin', 'guru', 'guru_piket', 'siswa', 'orang_tua')) NOT NULL,
      is_active INTEGER DEFAULT 1
    );

    -- 2. sekolah_config
    CREATE TABLE IF NOT EXISTS sekolah_config (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nama_sekolah TEXT NOT NULL,
      kepala_sekolah TEXT DEFAULT 'AHMAD ANIS SUYUTI, S. Pd',
      nip_kepala_sekolah TEXT DEFAULT '198004122006041005',
      latitude_sekolah REAL NOT NULL,
      longitude_sekolah REAL NOT NULL,
      radius_meter REAL NOT NULL,
      fonnte_token TEXT DEFAULT '',
      wa_gateway_url TEXT DEFAULT 'https://api.fonnte.com/send',
      is_simulator INTEGER DEFAULT 1
    );

    -- 3. kelas (6 Kelas Resmi: X-1, X-2, XI-1, XI-2, XII-1, XII-2)
    CREATE TABLE IF NOT EXISTS kelas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nama_kelas TEXT NOT NULL,
      wali_kelas_id INTEGER
    );

    -- 4. siswa
    CREATE TABLE IF NOT EXISTS siswa (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER UNIQUE,
      nis TEXT UNIQUE NOT NULL,
      nisn TEXT UNIQUE NOT NULL,
      nama TEXT NOT NULL,
      kelas_id INTEGER,
      no_wa_ortu TEXT NOT NULL,
      orang_tua_user_id INTEGER,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (kelas_id) REFERENCES kelas(id),
      FOREIGN KEY (orang_tua_user_id) REFERENCES users(id)
    );

    -- 5. guru
    CREATE TABLE IF NOT EXISTS guru (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER UNIQUE,
      nip TEXT UNIQUE NOT NULL,
      nama TEXT NOT NULL,
      no_wa TEXT NOT NULL,
      is_piket INTEGER DEFAULT 0,
      fingerprint_template TEXT,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    -- 6. mata_pelajaran
    CREATE TABLE IF NOT EXISTS mata_pelajaran (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      kode_mapel TEXT UNIQUE NOT NULL,
      nama_mapel TEXT NOT NULL,
      kkm REAL NOT NULL DEFAULT 75.0
    );

    -- 7. jadwal_pelajaran
    CREATE TABLE IF NOT EXISTS jadwal_pelajaran (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      kelas_id INTEGER NOT NULL,
      mapel_id INTEGER NOT NULL,
      guru_id INTEGER NOT NULL,
      hari TEXT NOT NULL,
      jam_mulai TEXT NOT NULL,
      jam_selesai TEXT NOT NULL,
      FOREIGN KEY (kelas_id) REFERENCES kelas(id),
      FOREIGN KEY (mapel_id) REFERENCES mata_pelajaran(id),
      FOREIGN KEY (guru_id) REFERENCES guru(id)
    );

    -- 8. presensi_guru (ABSENSI GURU MENGGUNAKAN SIDIK JARI / BIOMETRIK)
    CREATE TABLE IF NOT EXISTS presensi_guru (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      guru_id INTEGER NOT NULL,
      tanggal TEXT NOT NULL,
      jam_masuk TEXT NOT NULL,
      jam_pulang TEXT,
      metode_verifikasi TEXT DEFAULT 'Biometrik Sidik Jari',
      status TEXT CHECK(status IN ('Hadir', 'Izin', 'Sakit', 'Dinas Luar')) NOT NULL DEFAULT 'Hadir',
      keterangan TEXT,
      FOREIGN KEY (guru_id) REFERENCES guru(id)
    );

    -- 9. presensi_smart (ABSENSI SISWA MANUAL DIINPUT OLEH GURU MATA PELAJARAN)
    CREATE TABLE IF NOT EXISTS presensi_smart (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      siswa_id INTEGER NOT NULL,
      mapel_id INTEGER,
      guru_id INTEGER,
      tanggal TEXT NOT NULL,
      jam_masuk TEXT NOT NULL,
      latitude REAL DEFAULT 0,
      longitude REAL DEFAULT 0,
      foto_selfie_path TEXT,
      status TEXT CHECK(status IN ('Hadir', 'Izin', 'Sakit', 'Alfa')) NOT NULL,
      keterangan TEXT,
      verified_by INTEGER,
      FOREIGN KEY (siswa_id) REFERENCES siswa(id),
      FOREIGN KEY (mapel_id) REFERENCES mata_pelajaran(id),
      FOREIGN KEY (guru_id) REFERENCES guru(id)
    );

    -- 10. nilai_akademik
    CREATE TABLE IF NOT EXISTS nilai_akademik (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      siswa_id INTEGER NOT NULL,
      mapel_id INTEGER NOT NULL,
      tahun_ajaran TEXT NOT NULL,
      tugas REAL DEFAULT 0,
      uh REAL DEFAULT 0,
      uts REAL DEFAULT 0,
      uas REAL DEFAULT 0,
      nilai_akhir REAL DEFAULT 0,
      FOREIGN KEY (siswa_id) REFERENCES siswa(id),
      FOREIGN KEY (mapel_id) REFERENCES mata_pelajaran(id)
    );

    -- 11. tugas_materi (E-Learning Mini)
    CREATE TABLE IF NOT EXISTS tugas_materi (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      mapel_id INTEGER NOT NULL,
      kelas_id INTEGER NOT NULL,
      guru_id INTEGER NOT NULL,
      tipe TEXT CHECK(tipe IN ('Tugas', 'Materi')) NOT NULL,
      judul TEXT NOT NULL,
      deskripsi TEXT,
      file_path TEXT,
      deadline DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (mapel_id) REFERENCES mata_pelajaran(id),
      FOREIGN KEY (kelas_id) REFERENCES kelas(id),
      FOREIGN KEY (guru_id) REFERENCES guru(id)
    );

    -- 12. pengumpulan_tugas
    CREATE TABLE IF NOT EXISTS pengumpulan_tugas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tugas_id INTEGER NOT NULL,
      siswa_id INTEGER NOT NULL,
      file_jawaban TEXT,
      waktu_kirim DATETIME DEFAULT CURRENT_TIMESTAMP,
      nilai REAL,
      catatan_guru TEXT,
      FOREIGN KEY (tugas_id) REFERENCES tugas_materi(id),
      FOREIGN KEY (siswa_id) REFERENCES siswa(id)
    );

    -- 13. wa_log
    CREATE TABLE IF NOT EXISTS wa_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      penerima_wa TEXT NOT NULL,
      pesan TEXT NOT NULL,
      status_kirim TEXT CHECK(status_kirim IN ('Pending', 'Sent', 'Failed')) NOT NULL DEFAULT 'Sent',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- 14. ppdb_pendaftar (PENERIMAAN PESERTA DIDIK BARU / CALON SISWA BARU SMA)
    CREATE TABLE IF NOT EXISTS ppdb_pendaftar (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      no_registrasi TEXT UNIQUE NOT NULL,
      nisn TEXT UNIQUE NOT NULL,
      nama_lengkap TEXT NOT NULL,
      asal_sekolah TEXT NOT NULL,
      jalur_pendaftaran TEXT CHECK(jalur_pendaftaran IN ('Zonasi', 'Prestasi', 'Afirmasi', 'Perpindahan Tugas Orang Tua')) NOT NULL DEFAULT 'Zonasi',
      password_token TEXT NOT NULL,
      no_wa TEXT NOT NULL,
      status_seleksi TEXT CHECK(status_seleksi IN ('Menunggu Verifikasi Berkas', 'Lolos Verifikasi Administrasi', 'Diterima di SMA Hidayatun Najah', 'Cadangan', 'Tidak Diterima')) DEFAULT 'Menunggu Verifikasi Berkas',
      skor_jarak_km REAL DEFAULT 1.2,
      nilai_rata_rata REAL DEFAULT 86.5,
      tanggal_daftar DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Seed PPDB sample applicants if empty
  const ppdbCount = db.prepare('SELECT COUNT(*) as count FROM ppdb_pendaftar').get().count;
  if (ppdbCount === 0) {
    const insertPpdb = db.prepare(`
      INSERT INTO ppdb_pendaftar (no_registrasi, nisn, nama_lengkap, asal_sekolah, jalur_pendaftaran, password_token, no_wa, status_seleksi, skor_jarak_km, nilai_rata_rata)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    insertPpdb.run('PPDB-2026-0001', '0081234567', 'Muhammad Bayu Pratama', 'SMP Negeri 1 Proppo', 'Zonasi', 'ppdb2026', '081234567891', 'Lolos Verifikasi Administrasi', 0.8, 88.5);
    insertPpdb.run('PPDB-2026-0002', '0089876543', 'Aisyah Nur Salsabila', 'MTs Negeri 2 Pamekasan', 'Prestasi', 'ppdb2026', '081234567892', 'Diterima di SMA Hidayatun Najah', 2.4, 93.0);
    insertPpdb.run('PPDB-2026-0003', '0085544332', 'Farid Anshori', 'SMP Plus Hidayatun Najah', 'Afirmasi', 'ppdb2026', '081234567893', 'Menunggu Verifikasi Berkas', 1.1, 84.0);
  }

  seedData();
}

function seedData() {
  const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get().count;
  if (userCount > 0) {
    return;
  }

  console.log('Seeding initial data for SMA Hidayatun Najah Samiran Proppo Pamekasan (6 Kelas & Kepala Sekolah)...');

  // 1. Config Sekolah
  db.prepare(`
    INSERT INTO sekolah_config (id, nama_sekolah, kepala_sekolah, nip_kepala_sekolah, latitude_sekolah, longitude_sekolah, radius_meter, fonnte_token, wa_gateway_url, is_simulator)
    VALUES (1, 'SMA Hidayatun Najah Samiran Proppo Pamekasan', 'AHMAD ANIS SUYUTI, S. Pd', '198004122006041005', -7.142512, 113.435810, 150.0, 'DEV-FONNTE-TOKEN-DEMO', 'https://api.fonnte.com/send', 1)
  `).run();

  // 2. Users (5 Roles)
  const insertUser = db.prepare('INSERT INTO users (username, password, role, is_active) VALUES (?, ?, ?, 1)');
  const adminUser = insertUser.run('admin', 'admin123', 'admin');
  
  // Teachers
  const guru1User = insertUser.run('guru_bambang', 'guru123', 'guru');
  const guru2User = insertUser.run('guru_siti', 'guru123', 'guru_piket');
  const guru3User = insertUser.run('guru_ratna', 'guru123', 'guru');
  const guru4User = insertUser.run('guru_fauzi', 'guru123', 'guru');
  const guru5User = insertUser.run('guru_nurul', 'guru123', 'guru');
  const guru6User = insertUser.run('guru_halim', 'guru123', 'guru');
  
  // Parents
  const ortu1User = insertUser.run('ortu_dimas', 'ortu123', 'orang_tua');
  const ortu2User = insertUser.run('ortu_nurhaliza', 'ortu123', 'orang_tua');
  const ortu3User = insertUser.run('ortu_budi', 'ortu123', 'orang_tua');
  const ortu4User = insertUser.run('ortu_farhan', 'ortu123', 'orang_tua');
  const ortu5User = insertUser.run('ortu_fajar', 'ortu123', 'orang_tua');
  
  // Students
  const siswa1User = insertUser.run('siswa_dimas', 'siswa123', 'siswa');
  const siswa2User = insertUser.run('siswa_nurhaliza', 'siswa123', 'siswa');
  const siswa3User = insertUser.run('siswa_budi', 'siswa123', 'siswa');
  const siswa4User = insertUser.run('siswa_anisa', 'siswa123', 'siswa');
  const siswa5User = insertUser.run('siswa_rizky', 'siswa123', 'siswa');
  const siswa6User = insertUser.run('siswa_dwi', 'siswa123', 'siswa');
  const siswa7User = insertUser.run('siswa_farhan', 'siswa123', 'siswa');
  const siswa8User = insertUser.run('siswa_nabila', 'siswa123', 'siswa');
  const siswa9User = insertUser.run('siswa_ilham', 'siswa123', 'siswa');
  const siswa10User = insertUser.run('siswa_rina', 'siswa123', 'siswa');
  const siswa11User = insertUser.run('siswa_fajar', 'siswa123', 'siswa');
  const siswa12User = insertUser.run('siswa_putri', 'siswa123', 'siswa');
  const siswa13User = insertUser.run('siswa_ridho', 'siswa123', 'siswa');
  const siswa14User = insertUser.run('siswa_dewi', 'siswa123', 'siswa');

  // 3. Guru & Guru Piket (6 Guru)
  const insertGuru = db.prepare('INSERT INTO guru (user_id, nip, nama, no_wa, is_piket, fingerprint_template) VALUES (?, ?, ?, ?, ?, ?)');
  const g1 = insertGuru.run(guru1User.lastInsertRowid, '197505122002121001', 'Drs. Bambang Suryono, M.Pd', '081234567801', 0, 'FP-BAMBANG-1975');
  const g2 = insertGuru.run(guru2User.lastInsertRowid, '198208152008012003', 'Siti Aminah, S.Pd', '081234567802', 1, 'FP-SITI-1982');
  const g3 = insertGuru.run(guru3User.lastInsertRowid, '198703212011012004', 'Ratna Dewi, M.Si', '081234567803', 0, 'FP-RATNA-1987');
  const g4 = insertGuru.run(guru4User.lastInsertRowid, '198506142010011002', 'Moh. Fauzi, S.Pd', '081234567804', 0, 'FP-FAUZI-1985');
  const g5 = insertGuru.run(guru5User.lastInsertRowid, '199002182015032001', 'Nurul Hidayati, S.Pd', '081234567805', 0, 'FP-NURUL-1990');
  const g6 = insertGuru.run(guru6User.lastInsertRowid, '198811052014021003', 'Abdul Halim, M.Pd', '081234567806', 0, 'FP-HALIM-1988');

  // 4. Kelas (6 Kelas Resmi SMA Hidayatun Najah: X-1, X-2, XI-1, XI-2, XII-1, XII-2)
  const insertKelas = db.prepare('INSERT INTO kelas (nama_kelas, wali_kelas_id) VALUES (?, ?)');
  const k1 = insertKelas.run('X-1', g5.lastInsertRowid);
  const k2 = insertKelas.run('X-2', g6.lastInsertRowid);
  const k3 = insertKelas.run('XI-1', g2.lastInsertRowid);
  const k4 = insertKelas.run('XI-2', g4.lastInsertRowid);
  const k5 = insertKelas.run('XII-1', g1.lastInsertRowid);
  const k6 = insertKelas.run('XII-2', g3.lastInsertRowid);

  // 5. Siswa (Tersebar pada seluruh 6 Kelas)
  const insertSiswa = db.prepare('INSERT INTO siswa (user_id, nis, nisn, nama, kelas_id, no_wa_ortu, orang_tua_user_id) VALUES (?, ?, ?, ?, ?, ?, ?)');
  
  // Kelas XII-1 (Dimas Aditya, Siti Nurhaliza, Budi Santoso, Anisa Rahmawati)
  const s1 = insertSiswa.run(siswa1User.lastInsertRowid, '220101', '0054231901', 'Dimas Aditya', k5.lastInsertRowid, '081398765401', ortu1User.lastInsertRowid);
  const s2 = insertSiswa.run(siswa2User.lastInsertRowid, '220102', '0054231902', 'Siti Nurhaliza', k5.lastInsertRowid, '081398765402', ortu2User.lastInsertRowid);
  const s3 = insertSiswa.run(siswa3User.lastInsertRowid, '220103', '0054231903', 'Budi Santoso', k5.lastInsertRowid, '081398765403', ortu3User.lastInsertRowid);
  const s4 = insertSiswa.run(siswa4User.lastInsertRowid, '220104', '0054231904', 'Anisa Rahmawati', k5.lastInsertRowid, '081398765404', null);

  // Kelas XII-2
  const s5 = insertSiswa.run(siswa5User.lastInsertRowid, '220201', '0054231905', 'Rizky Pratama', k6.lastInsertRowid, '081398765405', null);
  const s6 = insertSiswa.run(siswa6User.lastInsertRowid, '220202', '0054231906', 'Dwi Septian', k6.lastInsertRowid, '081398765406', null);

  // Kelas XI-1
  const s7 = insertSiswa.run(siswa7User.lastInsertRowid, '230101', '0064231901', 'Ahmad Farhan', k3.lastInsertRowid, '081398765421', ortu4User.lastInsertRowid);
  const s8 = insertSiswa.run(siswa8User.lastInsertRowid, '230102', '0064231902', 'Nabila Zahra', k3.lastInsertRowid, '081398765422', null);

  // Kelas XI-2
  const s9 = insertSiswa.run(siswa9User.lastInsertRowid, '230201', '0064231903', 'Ilham Wahyudi', k4.lastInsertRowid, '081398765423', null);
  const s10 = insertSiswa.run(siswa10User.lastInsertRowid, '230202', '0064231904', 'Rina Kurniawati', k4.lastInsertRowid, '081398765424', null);

  // Kelas X-1
  const s11 = insertSiswa.run(siswa11User.lastInsertRowid, '240101', '0074231901', 'Fajar Maulana', k1.lastInsertRowid, '081398765411', ortu5User.lastInsertRowid);
  const s12 = insertSiswa.run(siswa12User.lastInsertRowid, '240102', '0074231902', 'Putri Ayu Lestari', k1.lastInsertRowid, '081398765412', null);

  // Kelas X-2
  const s13 = insertSiswa.run(siswa13User.lastInsertRowid, '240201', '0074231903', 'Muhammad Ridho', k2.lastInsertRowid, '081398765413', null);
  const s14 = insertSiswa.run(siswa14User.lastInsertRowid, '240202', '0074231904', 'Dewi Anggraini', k2.lastInsertRowid, '081398765414', null);

  // 6. Mata Pelajaran
  const insertMapel = db.prepare('INSERT INTO mata_pelajaran (kode_mapel, nama_mapel, kkm) VALUES (?, ?, ?)');
  const m1 = insertMapel.run('MAT-SMA', 'Matematika Peminatan', 75.0);
  const m2 = insertMapel.run('FIS-SMA', 'Fisika', 75.0);
  const m3 = insertMapel.run('KIM-SMA', 'Kimia', 75.0);
  const m4 = insertMapel.run('BIO-SMA', 'Biologi', 75.0);
  const m5 = insertMapel.run('IND-SMA', 'Bahasa Indonesia', 78.0);
  const m6 = insertMapel.run('ING-SMA', 'Bahasa Inggris', 75.0);

  // 7. Jadwal Pelajaran
  const insertJadwal = db.prepare('INSERT INTO jadwal_pelajaran (kelas_id, mapel_id, guru_id, hari, jam_mulai, jam_selesai) VALUES (?, ?, ?, ?, ?, ?)');
  insertJadwal.run(k5.lastInsertRowid, m1.lastInsertRowid, g1.lastInsertRowid, 'Senin', '07:15', '08:45');
  insertJadwal.run(k5.lastInsertRowid, m2.lastInsertRowid, g3.lastInsertRowid, 'Senin', '09:00', '10:30');
  insertJadwal.run(k5.lastInsertRowid, m5.lastInsertRowid, g2.lastInsertRowid, 'Selasa', '07:15', '08:45');
  insertJadwal.run(k3.lastInsertRowid, m1.lastInsertRowid, g1.lastInsertRowid, 'Senin', '07:15', '08:45');
  insertJadwal.run(k1.lastInsertRowid, m5.lastInsertRowid, g5.lastInsertRowid, 'Senin', '07:15', '08:45');

  // 8. PRESENSI GURU (SIDIK JARI BIOMETRIK)
  const today = new Date().toISOString().split('T')[0];
  const insertPresensiGuru = db.prepare('INSERT INTO presensi_guru (guru_id, tanggal, jam_masuk, jam_pulang, metode_verifikasi, status, keterangan) VALUES (?, ?, ?, ?, ?, ?, ?)');
  insertPresensiGuru.run(g1.lastInsertRowid, today, '06:42:15', null, 'Biometrik Sidik Jari', 'Hadir', 'Sensor Fingerprint Terminal 1 - Terverifikasi');
  insertPresensiGuru.run(g2.lastInsertRowid, today, '06:48:30', null, 'Biometrik Sidik Jari', 'Hadir', 'Sensor Fingerprint Terminal 1 - Terverifikasi');
  insertPresensiGuru.run(g3.lastInsertRowid, today, '06:55:10', null, 'Biometrik Sidik Jari', 'Hadir', 'Sensor Fingerprint Terminal 2 - Terverifikasi');
  insertPresensiGuru.run(g4.lastInsertRowid, today, '06:50:22', null, 'Biometrik Sidik Jari', 'Hadir', 'Sensor Fingerprint Terminal 2 - Terverifikasi');
  insertPresensiGuru.run(g5.lastInsertRowid, today, '06:45:00', null, 'Biometrik Sidik Jari', 'Hadir', 'Sensor Fingerprint Terminal 1 - Terverifikasi');
  insertPresensiGuru.run(g6.lastInsertRowid, today, '06:52:14', null, 'Biometrik Sidik Jari', 'Hadir', 'Sensor Fingerprint Terminal 2 - Terverifikasi');

  // 9. PRESENSI SISWA (MANUAL DIINPUT OLEH GURU MAPEL DI KELAS)
  const insertPresensiSiswa = db.prepare('INSERT INTO presensi_smart (siswa_id, mapel_id, guru_id, tanggal, jam_masuk, status, keterangan, verified_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
  
  // Helper to add attendance history
  function seedAttendanceForStudent(sId, mId, gId, hadirCount, sakitCount, izinCount, alfaCount) {
    let day = 1;
    for (let i = 0; i < hadirCount; i++) {
      const d = '2026-10-' + String(day++).padStart(2, '0');
      insertPresensiSiswa.run(sId, mId, gId, d, '07:20:00', 'Hadir', 'Hadir aktif di kelas', gId);
    }
    for (let i = 0; i < sakitCount; i++) {
      const d = '2026-10-' + String(day++).padStart(2, '0');
      insertPresensiSiswa.run(sId, mId, gId, d, '07:20:00', 'Sakit', 'Surat keterangan sakit', gId);
    }
    for (let i = 0; i < izinCount; i++) {
      const d = '2026-10-' + String(day++).padStart(2, '0');
      insertPresensiSiswa.run(sId, mId, gId, d, '07:20:00', 'Izin', 'Izin urusan keluarga', gId);
    }
    for (let i = 0; i < alfaCount; i++) {
      const d = '2026-10-' + String(day++).padStart(2, '0');
      insertPresensiSiswa.run(sId, mId, gId, d, '07:20:00', 'Alfa', 'Tidak hadir di kelas tanpa keterangan', gId);
    }
  }

  // Attendance for XII-1
  seedAttendanceForStudent(s1.lastInsertRowid, m1.lastInsertRowid, g1.lastInsertRowid, 22, 1, 1, 0); // Dimas
  seedAttendanceForStudent(s2.lastInsertRowid, m1.lastInsertRowid, g1.lastInsertRowid, 24, 0, 0, 0); // Siti
  seedAttendanceForStudent(s3.lastInsertRowid, m1.lastInsertRowid, g1.lastInsertRowid, 19, 1, 1, 3); // Budi
  seedAttendanceForStudent(s4.lastInsertRowid, m1.lastInsertRowid, g1.lastInsertRowid, 22, 2, 0, 0); // Anisa

  // Attendance for XII-2
  seedAttendanceForStudent(s5.lastInsertRowid, m1.lastInsertRowid, g3.lastInsertRowid, 23, 1, 0, 0); // Rizky
  seedAttendanceForStudent(s6.lastInsertRowid, m1.lastInsertRowid, g3.lastInsertRowid, 22, 1, 1, 0); // Dwi

  // Attendance for XI-1
  seedAttendanceForStudent(s7.lastInsertRowid, m1.lastInsertRowid, g2.lastInsertRowid, 24, 0, 0, 0); // Farhan
  seedAttendanceForStudent(s8.lastInsertRowid, m1.lastInsertRowid, g2.lastInsertRowid, 23, 1, 0, 0); // Nabila

  // Attendance for XI-2
  seedAttendanceForStudent(s9.lastInsertRowid, m1.lastInsertRowid, g4.lastInsertRowid, 22, 1, 1, 0); // Ilham
  seedAttendanceForStudent(s10.lastInsertRowid, m1.lastInsertRowid, g4.lastInsertRowid, 23, 0, 1, 0); // Rina

  // Attendance for X-1
  seedAttendanceForStudent(s11.lastInsertRowid, m1.lastInsertRowid, g5.lastInsertRowid, 24, 0, 0, 0); // Fajar
  seedAttendanceForStudent(s12.lastInsertRowid, m1.lastInsertRowid, g5.lastInsertRowid, 23, 1, 0, 0); // Putri

  // Attendance for X-2
  seedAttendanceForStudent(s13.lastInsertRowid, m1.lastInsertRowid, g6.lastInsertRowid, 22, 1, 1, 0); // Ridho
  seedAttendanceForStudent(s14.lastInsertRowid, m1.lastInsertRowid, g6.lastInsertRowid, 24, 0, 0, 0); // Dewi

  // 10. Nilai Akademik Lengkap untuk Seluruh Siswa
  const insertNilai = db.prepare('INSERT INTO nilai_akademik (siswa_id, mapel_id, tahun_ajaran, tugas, uh, uts, uas, nilai_akhir) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
  
  function seedGradesForStudent(sId, gradesArr) {
    const mapels = [m1.lastInsertRowid, m2.lastInsertRowid, m3.lastInsertRowid, m4.lastInsertRowid, m5.lastInsertRowid, m6.lastInsertRowid];
    gradesArr.forEach((g, idx) => {
      const final = Math.round((g[0] * 0.2 + g[1] * 0.2 + g[2] * 0.3 + g[3] * 0.3) * 10) / 10;
      insertNilai.run(sId, mapels[idx], '2025/2026 Ganjil', g[0], g[1], g[2], g[3], final);
    });
  }

  // XII-1
  seedGradesForStudent(s1.lastInsertRowid, [[88, 85, 90, 88], [84, 82, 85, 89], [80, 85, 83, 86], [90, 92, 88, 91], [85, 88, 86, 87], [92, 90, 94, 95]]); // Dimas
  seedGradesForStudent(s2.lastInsertRowid, [[95, 94, 96, 98], [92, 90, 95, 94], [90, 92, 91, 93], [96, 95, 98, 97], [90, 92, 94, 95], [94, 92, 96, 95]]); // Siti
  seedGradesForStudent(s3.lastInsertRowid, [[65, 60, 68, 62], [70, 68, 72, 70], [65, 65, 70, 68], [72, 70, 75, 73], [75, 74, 78, 76], [70, 72, 74, 75]]); // Budi
  seedGradesForStudent(s4.lastInsertRowid, [[82, 80, 85, 84], [80, 82, 84, 85], [78, 80, 82, 80], [85, 88, 86, 88], [84, 85, 88, 87], [82, 84, 85, 86]]); // Anisa

  // XII-2
  seedGradesForStudent(s5.lastInsertRowid, [[85, 84, 88, 87], [82, 85, 84, 86], [80, 82, 85, 84], [88, 90, 86, 89], [86, 88, 85, 87], [84, 85, 88, 88]]); // Rizky
  seedGradesForStudent(s6.lastInsertRowid, [[83, 85, 84, 86], [80, 82, 83, 85], [82, 84, 85, 86], [86, 88, 85, 87], [85, 86, 84, 86], [82, 84, 86, 85]]); // Dwi

  // XI-1 & XI-2
  seedGradesForStudent(s7.lastInsertRowid, [[90, 92, 94, 93], [88, 89, 90, 92], [85, 88, 89, 90], [92, 94, 93, 95], [89, 90, 91, 92], [91, 92, 93, 94]]); // Farhan
  seedGradesForStudent(s8.lastInsertRowid, [[85, 88, 87, 89], [84, 86, 88, 87], [82, 85, 86, 88], [88, 90, 89, 91], [86, 88, 87, 89], [85, 87, 88, 90]]); // Nabila
  seedGradesForStudent(s9.lastInsertRowid, [[80, 82, 84, 85], [82, 84, 83, 85], [79, 81, 82, 84], [84, 86, 85, 87], [83, 85, 86, 87], [81, 83, 84, 85]]); // Ilham
  seedGradesForStudent(s10.lastInsertRowid, [[86, 88, 89, 90], [84, 85, 87, 88], [83, 85, 86, 87], [88, 90, 91, 92], [87, 89, 88, 90], [86, 88, 89, 90]]); // Rina

  // X-1 & X-2
  seedGradesForStudent(s11.lastInsertRowid, [[88, 90, 92, 91], [86, 88, 89, 90], [84, 86, 88, 89], [90, 92, 93, 94], [88, 89, 90, 91], [89, 91, 92, 93]]); // Fajar
  seedGradesForStudent(s12.lastInsertRowid, [[85, 87, 88, 90], [83, 85, 86, 88], [82, 84, 85, 87], [87, 89, 90, 92], [86, 88, 87, 89], [85, 87, 88, 89]]); // Putri
  seedGradesForStudent(s13.lastInsertRowid, [[82, 84, 85, 86], [80, 82, 84, 85], [78, 80, 82, 83], [85, 87, 88, 89], [83, 85, 86, 87], [81, 83, 85, 86]]); // Ridho
  seedGradesForStudent(s14.lastInsertRowid, [[87, 89, 91, 92], [85, 87, 88, 90], [84, 86, 87, 89], [89, 91, 92, 93], [88, 90, 89, 91], [87, 89, 90, 92]]); // Dewi

  // 11. E-Learning Mini
  const insertTugasMateri = db.prepare('INSERT INTO tugas_materi (mapel_id, kelas_id, guru_id, tipe, judul, deskripsi, file_path, deadline) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
  const tm1 = insertTugasMateri.run(m1.lastInsertRowid, k5.lastInsertRowid, g1.lastInsertRowid, 'Materi', 'Modul 4: Limit Fungsi Trigonometri & Kalkulus Lanjut', 'Silakan unduh dan pelajari rangkuman materi rumus identitas limit.', null, null);
  const tm2 = insertTugasMateri.run(m1.lastInsertRowid, k5.lastInsertRowid, g1.lastInsertRowid, 'Tugas', 'Latihan Soal Uji Kompetensi Limit Tak Hingga', 'Kerjakan 5 soal essay pada halaman 42 buku cetak.', null, '2026-10-25 23:59:00');

  // 12. Pengumpulan Tugas
  const insertPengumpulan = db.prepare('INSERT INTO pengumpulan_tugas (tugas_id, siswa_id, file_jawaban, waktu_kirim, nilai, catatan_guru) VALUES (?, ?, ?, ?, ?, ?)');
  insertPengumpulan.run(tm2.lastInsertRowid, s1.lastInsertRowid, '/uploads/tugas/jawaban_dimas.pdf', '2026-10-17 14:22:00', 95.0, 'Penyelesaian langkah sangat sistematis dan tepat!');

  // 13. WhatsApp Log
  const insertWaLog = db.prepare('INSERT INTO wa_log (penerima_wa, pesan, status_kirim, created_at) VALUES (?, ?, ?, ?)');
  insertWaLog.run('081398765401', 'Pemberitahuan SIAKAD SMA Hidayatun Najah: Ananda Dimas Aditya tercatat HADIR pada mata pelajaran Matematika Peminatan (Guru: Drs. Bambang Suryono, M.Pd).', 'Sent', '2026-10-18 07:20:05');
  insertWaLog.run('081398765403', 'Pemberitahuan SIAKAD SMA Hidayatun Najah: Ananda Budi Santoso tercatat ALFA pada mata pelajaran Matematika Peminatan hari ini. Mohon perhatian orang tua.', 'Sent', '2026-10-18 07:20:10');

  console.log('Seeding completed successfully with 6 official classes and headmaster AHMAD ANIS SUYUTI, S. Pd!');
}

module.exports = {
  db,
  initDatabase
};
