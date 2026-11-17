# SIAKAD SMA Hidayatun Najah Samiran Proppo Pamekasan - Berbasis RAD
### (Pembaruan: Pemisahan Absensi Sidik Jari Guru & Absensi Manual Siswa di Kelas)

Aplikasi Sistem Informasi Akademik (SIAKAD) untuk **SMA Hidayatun Najah Samiran Proppo Pamekasan** yang dibangun menggunakan metode **Rapid Application Development (RAD)** dengan alur presensi terpisah:
1. **Absensi Guru:** Menggunakan sensor **Biometrik Sidik Jari (*Fingerprint Scanner*)** saat tiba di sekolah.
2. **Absensi Murid:** Diabsen secara **Manual di Kelas oleh Guru Mata Pelajaran** saat jam pelajaran berlangsung, dilengkapi tombol cepat *"Tandai Semua Siswa Hadir"* serta notifikasi WhatsApp otomatis ke orang tua jika siswa tercatat Alfa/Izin/Sakit.

---

## 🌟 Rincian Modul & Fitur Terkini

### 1. Absensi Guru: Biometrik Sidik Jari (Fingerprint Scanner)
- **Terminal Pemindai Biometrik:** Antarmuka pemindai sidik jari beranimasi sinar laser (*cyan & emerald beam scan*) dan status verifikasi minutiae (*Match 99.8%*).
- **Mode Masuk & Pulang:** Guru dapat memilih aksi **Absen Masuk** pada pagi hari dan **Absen Pulang** saat selesai jam kerja.
- **Pencatatan Otomatis:** Tercatat pada tabel `presensi_guru` lengkap dengan NIP, jam masuk presisi, jam pulang, dan metode verifikasi.
- **Log Harian Guru:** Menampilkan tabel kehadiran sidik jari seluruh guru dan tenaga pendidik secara transparan.

### 2. Absensi Siswa: Manual di Kelas oleh Guru Mata Pelajaran
- **Lembar Absensi Digital Kelas:** Guru memilih **Kelas** (misal: XII MIPA 1) dan **Mata Pelajaran** (misal: Matematika Peminatan), lalu sistem menampilkan seluruh daftar siswa di kelas tersebut.
- **Opsi Kehadiran 4 Status:** Pilihan tombol interaktif per siswa:
  - 🟢 **Hadir**
  - 🔵 **Izin**
  - 🟡 **Sakit**
  - 🔴 **Alfa**
- **Fitur Cepat Hemat Waktu (Quick Action):** Tombol **"⚡ Tandai Semua Siswa Hadir"** sehingga guru cukup mengubah siswa yang berhalangan hadir.
- **Pemicu WhatsApp Real-Time Otomatis:** Begitu guru menekan **"Simpan Presensi Kelas"**, sistem secara otomatis mengirimkan notifikasi WhatsApp ke orang tua siswa yang berstatus **Alfa, Izin, atau Sakit**.
  > *Contoh Pesan:* "Pemberitahuan SIAKAD: Ananda Budi Santoso pada jam pelajaran Matematika Peminatan hari ini tercatat ALFA. Mohon konfirmasi ke pihak sekolah."

### 3. Portal Siswa & Orang Tua
- **Siswa:** Membuka menu **"Riwayat Presensi Saya"** untuk melihat rekapitulasi kehadiran di setiap mata pelajaran yang telah diinput guru pengampu.
- **Orang Tua:** Memantau kehadiran anak hari ini, mata pelajaran yang diikuti, dan riwayat pesan WhatsApp resmi dari sekolah.

### 4. Portal Guru Piket
- Form pengesahan surat izin keluarga atau surat dokter sakit secara digital.

### 5. Dashboard Analitik & Smart Early Warning (BK)
- Menampilkan grafik rasio kehadiran bulanan Chart.js, persentase kehadiran per kelas, dan kartu peringatan otomatis untuk siswa yang sering **Alfa di jam pelajaran (≥ 2 kali)** dengan tombol panggil orang tua via WhatsApp.

### 6. E-Learning Mini & Nilai Akademik
- Guru menerbitkan modul bahan ajar dan penugasan daring berbatas waktu (*deadline*).
- Siswa mengumpulkan tugas dan guru memberikan nilai (0–100) serta catatan umpan balik.
- Kalkulasi nilai akhir otomatis: **20% Tugas + 20% UH + 30% UTS + 30% UAS**.

---

## 👥 Akun Demo Pengujian (1-Click Switcher)

| Peran | Username | Password | Deskripsi Pengguna |
|---|---|---|---|
| **Guru Mapel** | `guru_bambang` | `guru123` | Drs. Bambang Suryono, M.Pd (Guru Matematika) |
| **Administrator** | `admin` | `admin123` | Super Administrator SIAKAD |
| **Guru Piket** | `guru_siti` | `guru123` | Siti Aminah, S.Pd (Guru Piket & BK) |
| **Siswa** | `siswa_dimas` | `siswa123` | Dimas Aditya (Siswa XII MIPA 1) |
| **Orang Tua** | `ortu_dimas` | `ortu123` | Bpk. Hartono (Orang Tua Dimas Aditya) |

---

## 🚀 Cara Menjalankan Aplikasi

Aplikasi berjalan di latar belakang pada:
👉 **[http://localhost:3000](http://localhost:3000)**

Untuk menjalankan uji otomatis pemisahan absensi guru & murid:
```powershell
cd C:\Users\User\.gemini\antigravity-ide\scratch\siakad-sma-rad
node test_updated_attendance.js
```
Hasil pengujian: **5/5 pengujian BERHASIL SEMPURNA (100% Pass)**.
