-- =========================================================================
-- BLUEPRINT DATABASE SIAKAD TINGKAT SMA - METODE RAD (REVISI SISTEM ABSENSI)
-- Absensi Guru: Menggunakan Biometrik Sidik Jari (Fingerprint)
-- Absensi Siswa: Manual di Kelas oleh Guru Mata Pelajaran
-- =========================================================================

CREATE DATABASE IF NOT EXISTS `siakad_sma` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE `siakad_sma`;

-- 1. users
CREATE TABLE IF NOT EXISTS `users` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `username` VARCHAR(60) NOT NULL UNIQUE,
  `password` VARCHAR(255) NOT NULL,
  `role` ENUM('admin', 'guru', 'guru_piket', 'siswa', 'orang_tua') NOT NULL,
  `is_active` TINYINT(1) DEFAULT 1,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 2. sekolah_config
CREATE TABLE IF NOT EXISTS `sekolah_config` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `nama_sekolah` VARCHAR(150) NOT NULL,
  `kepala_sekolah` VARCHAR(150) NOT NULL DEFAULT 'AHMAD ANIS SUYUTI, S. Pd',
  `nip_kepala_sekolah` VARCHAR(50) NOT NULL DEFAULT '198004122006041005',
  `latitude_sekolah` DECIMAL(10, 8) NOT NULL,
  `longitude_sekolah` DECIMAL(11, 8) NOT NULL,
  `radius_meter` DECIMAL(8, 2) NOT NULL DEFAULT 150.00,
  `fonnte_token` VARCHAR(255) DEFAULT '',
  `wa_gateway_url` VARCHAR(255) DEFAULT 'https://api.fonnte.com/send',
  `is_simulator` TINYINT(1) DEFAULT 1
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 3. kelas
CREATE TABLE IF NOT EXISTS `kelas` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `nama_kelas` VARCHAR(50) NOT NULL,
  `wali_kelas_id` INT DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 4. siswa
CREATE TABLE IF NOT EXISTS `siswa` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `user_id` INT UNIQUE,
  `nis` VARCHAR(30) NOT NULL UNIQUE,
  `nisn` VARCHAR(30) NOT NULL UNIQUE,
  `nama` VARCHAR(120) NOT NULL,
  `kelas_id` INT,
  `no_wa_ortu` VARCHAR(25) NOT NULL,
  `orang_tua_user_id` INT DEFAULT NULL,
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`kelas_id`) REFERENCES `kelas`(`id`) ON DELETE SET NULL,
  FOREIGN KEY (`orang_tua_user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 5. guru
CREATE TABLE IF NOT EXISTS `guru` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `user_id` INT UNIQUE,
  `nip` VARCHAR(40) NOT NULL UNIQUE,
  `nama` VARCHAR(120) NOT NULL,
  `no_wa` VARCHAR(25) NOT NULL,
  `is_piket` TINYINT(1) DEFAULT 0,
  `fingerprint_template` VARCHAR(255) DEFAULT 'FP-HASH-REGISTERED',
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

ALTER TABLE `kelas` ADD CONSTRAINT `fk_kelas_wali` FOREIGN KEY (`wali_kelas_id`) REFERENCES `guru`(`id`) ON DELETE SET NULL;

-- 6. mata_pelajaran
CREATE TABLE IF NOT EXISTS `mata_pelajaran` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `kode_mapel` VARCHAR(20) NOT NULL UNIQUE,
  `nama_mapel` VARCHAR(100) NOT NULL,
  `kkm` DECIMAL(5,2) NOT NULL DEFAULT 75.00
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 7. jadwal_pelajaran
CREATE TABLE IF NOT EXISTS `jadwal_pelajaran` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `kelas_id` INT NOT NULL,
  `mapel_id` INT NOT NULL,
  `guru_id` INT NOT NULL,
  `hari` ENUM('Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu') NOT NULL,
  `jam_mulai` TIME NOT NULL,
  `jam_selesai` TIME NOT NULL,
  FOREIGN KEY (`kelas_id`) REFERENCES `kelas`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`mapel_id`) REFERENCES `mata_pelajaran`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`guru_id`) REFERENCES `guru`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 8. presensi_guru (ABSENSI GURU MENGGUNAKAN SIDIK JARI / FINGERPRINT)
CREATE TABLE IF NOT EXISTS `presensi_guru` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `guru_id` INT NOT NULL,
  `tanggal` DATE NOT NULL,
  `jam_masuk` TIME NOT NULL,
  `jam_pulang` TIME DEFAULT NULL,
  `metode_verifikasi` VARCHAR(60) DEFAULT 'Biometrik Sidik Jari',
  `status` ENUM('Hadir', 'Izin', 'Sakit', 'Dinas Luar') NOT NULL DEFAULT 'Hadir',
  `keterangan` TEXT,
  FOREIGN KEY (`guru_id`) REFERENCES `guru`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 9. presensi_smart (ABSENSI SISWA MANUAL DIINPUT OLEH GURU MAPEL DI KELAS)
CREATE TABLE IF NOT EXISTS `presensi_smart` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `siswa_id` INT NOT NULL,
  `mapel_id` INT DEFAULT NULL,
  `guru_id` INT DEFAULT NULL,
  `tanggal` DATE NOT NULL,
  `jam_masuk` TIME NOT NULL,
  `status` ENUM('Hadir', 'Izin', 'Sakit', 'Alfa') NOT NULL,
  `keterangan` TEXT,
  `verified_by` INT DEFAULT NULL,
  FOREIGN KEY (`siswa_id`) REFERENCES `siswa`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`mapel_id`) REFERENCES `mata_pelajaran`(`id`) ON DELETE SET NULL,
  FOREIGN KEY (`guru_id`) REFERENCES `guru`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 10. nilai_akademik
CREATE TABLE IF NOT EXISTS `nilai_akademik` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `siswa_id` INT NOT NULL,
  `mapel_id` INT NOT NULL,
  `tahun_ajaran` VARCHAR(30) NOT NULL,
  `tugas` DECIMAL(5, 2) DEFAULT 0,
  `uh` DECIMAL(5, 2) DEFAULT 0,
  `uts` DECIMAL(5, 2) DEFAULT 0,
  `uas` DECIMAL(5, 2) DEFAULT 0,
  `nilai_akhir` DECIMAL(5, 2) DEFAULT 0,
  FOREIGN KEY (`siswa_id`) REFERENCES `siswa`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`mapel_id`) REFERENCES `mata_pelajaran`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 11. tugas_materi (E-Learning Mini)
CREATE TABLE IF NOT EXISTS `tugas_materi` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `mapel_id` INT NOT NULL,
  `kelas_id` INT NOT NULL,
  `guru_id` INT NOT NULL,
  `tipe` ENUM('Materi', 'Tugas') NOT NULL,
  `judul` VARCHAR(200) NOT NULL,
  `deskripsi` TEXT,
  `file_path` VARCHAR(255),
  `deadline` DATETIME NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`mapel_id`) REFERENCES `mata_pelajaran`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`kelas_id`) REFERENCES `kelas`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`guru_id`) REFERENCES `guru`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 12. pengumpulan_tugas
CREATE TABLE IF NOT EXISTS `pengumpulan_tugas` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `tugas_id` INT NOT NULL,
  `siswa_id` INT NOT NULL,
  `file_jawaban` VARCHAR(255),
  `waktu_kirim` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `nilai` DECIMAL(5, 2) DEFAULT NULL,
  `catatan_guru` TEXT,
  FOREIGN KEY (`tugas_id`) REFERENCES `tugas_materi`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`siswa_id`) REFERENCES `siswa`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 13. wa_log
CREATE TABLE IF NOT EXISTS `wa_log` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `penerima_wa` VARCHAR(30) NOT NULL,
  `pesan` TEXT NOT NULL,
  `status_kirim` ENUM('Pending', 'Sent', 'Failed') NOT NULL DEFAULT 'Sent',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
