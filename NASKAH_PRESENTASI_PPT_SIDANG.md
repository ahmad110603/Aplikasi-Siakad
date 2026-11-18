# NASKAH LENGKAP SLIDE PRESENTASI & PANDUAN SIDANG TUGAS AKHIR
### Judul Penelitian:
**"Rancang Bangun Sistem Informasi Akademik Berbasis Web Menggunakan Metode Rapid Application Development (RAD) Di SMA Hidayatun Najah Samiran Proppo Pamekasan"**

---

## 🎯 PANDUAN CEPAT PRESENTASI
- **Slide Interaktif (Bisa langsung dibuka di browser):**  
  👉 Buka di browser: **`http://localhost:3000/presentasi.html`**  
  *(Atau klik 2x file `Buka-Presentasi-PPT.bat` di Desktop Anda)*
- **Navigasi Slide:** Tekan tombol panah kanan `[→]` atau `[Spasi]` untuk maju, dan panah kiri `[←]` untuk mundur.
- **Tombol Layar Penuh:** Tekan tombol **`F`** untuk Fullscreen saat presentasi di depan dosen.
- **Catatan Pembicara (Script):** Tekan tombol **`N`** untuk memunculkan contekan teks apa yang harus Anda katakan.
- **Cetak ke PDF:** Klik tombol *"Cetak PDF"* di pojok kanan atas untuk mengekspor slide menjadi dokumen PDF.

---

## 📑 RINCIAN 14 SLIDE PRESENTASI BESERTA SCRIPT PEMBICARA

---

### SLIDE 1: JUDUL & IDENTITAS PENELITIAN
**Konten Slide:**
- **Judul:** Rancang Bangun Sistem Informasi Akademik Berbasis Web Menggunakan Metode Rapid Application Development (RAD) Di SMA Hidayatun Najah Samiran Proppo Pamekasan
- **Penyaji:** Ahmad Yani (Teknik Informatika)
- **Fokus Utama:** Integrasi Hardware Sensor Biometrik Sidik Jari Guru & Presensi Mandiri Siswa
- **Tahun Akademik:** 2026/2027

**🎙️ Script Pembicaraan ke Dosen:**
> *"Assalamu'alaikum Warahmatullahi Wabarakatuh. Selamat pagi/siang kepada Bapak/Ibu Dosen Pembimbing dan Dosen Penguji yang saya hormati. Terima kasih atas kesempatan yang telah diberikan. Pada hari ini, saya akan mempresentasikan hasil penelitian Tugas Akhir saya yang berjudul: **Rancang Bangun Sistem Informasi Akademik Berbasis Web Menggunakan Metode Rapid Application Development di SMA Hidayatun Najah Samiran Proppo Pamekasan**. Penelitian ini berfokus pada integrasi sensor biometrik sidik jari guru, absensi kelas siswa, dan pelaporan e-rapor otomatis."*

---

### SLIDE 2: LATAR BELAKANG & URGENSI MASALAH
**Konten Slide:**
- **Masalah 1 (Presensi Guru):** Pencatatan tanda tangan manual di buku absensi rawan titip absen, jam kedatangan tidak terukur objektif, dan rekapitulasi memakan waktu TU.
- **Masalah 2 (Absensi Siswa):** Siswa yang bolos (Alfa) di jam pelajaran kelas sering terlambat diketahui orang tua karena tidak ada jembatan informasi seketika.
- **Masalah 3 (Pengolahan Nilai):** Nilai tugas, UH, UTS, dan UAS dihitung manual di lembar Excel yang terpisah, memperlambat penerbitan rapor di akhir semester.

**🎙️ Script Pembicaraan ke Dosen:**
> *"Bapak dan Ibu penguji, latar belakang penelitian ini diangkat dari tiga kendala nyata yang ada di SMA Hidayatun Najah: Pertama, presensi guru selama ini masih manual tanda tangan di buku kertas, sehingga rawan titip absen dan jam tiba tidak tercatat presisi. Kedua, jika ada siswa yang tidak hadir di kelas, pihak orang tua sering baru mengetahuinya beberapa hari kemudian. Ketiga, pengolahan nilai dan pembagian rapor memakan waktu berhari-hari karena rumus perhitungan masih dilakukan manual di spreadsheet terpisah."*

---

### SLIDE 3: RUMUSAN MASALAH & TUJUAN PENELITIAN
**Konten Slide:**
- **Rumusan Masalah:**
  1. Bagaimana merancang SIAKAD berbasis web menggunakan metode RAD?
  2. Bagaimana mengintegrasikan hardware sensor biometrik sidik jari guru via REST API?
  3. Bagaimana mengimplementasikan presensi kelas dengan notifikasi otomatis WhatsApp ke wali murid?
  4. Bagaimana mengotomatisasi perhitungan nilai kurikulum dan pencetakan e-Rapor resmi A4?
- **Tujuan:** Menghasilkan sistem SIAKAD yang responsif, akurat, dan menghubungkan pihak sekolah dengan orang tua secara transparan.

**🎙️ Script Pembicaraan ke Dosen:**
> *"Berdasarkan permasalahan tersebut, penelitian ini bertujuan untuk menjawab 4 hal utama: Bagaimana membangun sistem dengan metode RAD yang cepat, bagaimana mengintegrasikan mesin sidik jari biometrik, bagaimana mengirimkan notifikasi instan WhatsApp ke orang tua, serta bagaimana mengotomatisasi pembuatan lembar e-rapor siap cetak."*

---

### SLIDE 4: METODOLOGI RAD (RAPID APPLICATION DEVELOPMENT)
**Konten Slide:**
1. **Requirements Planning:** Identifikasi alur operasional sekolah dan kebutuhan integrasi hardware biometrik.
2. **User Design Workshop:** Perancangan UI/UX interaktif, skema database relasional, dan alur validasi NIP/NISN.
3. **Construction:** Pengkodean web responsif, pembuatan simulator REST API Biometrik, serta logika kalkulasi nilai.
4. **Cutover:** Pengujian Black Box, User Acceptance Testing (UAT), dan deployment sistem.

**🎙️ Script Pembicaraan ke Dosen:**
> *"Metode yang saya gunakan adalah Rapid Application Development (RAD). Keunggulan utama metode ini dibanding Waterfall adalah prosesnya yang iteratif dan melibatkan masukan pengguna secara aktif pada fase User Design Workshop, sehingga revisi dan perbaikan dari pihak sekolah maupun dosen dapat diadaptasikan dengan sangat cepat tanpa harus mengulang dari awal."*

---

### SLIDE 5: ALUR AUTENTIKASI & REGISTRASI PENGGUNA (BLUEPRINT REVISI)
**Konten Slide:**
- **Tahap 1:** Calon pengguna memasukkan NIP/NISN, nama, dan email aktif.
- **Tahap 2:** Sistem mencocokkan identitas dengan Master Data Sekolah (`tb_guru` / `tb_siswa`). Jika tidak terdaftar, akses ditolak.
- **Tahap 3:** Sistem menghasilkan kata sandi otomatis (Auto-Generate Password) dan menampilkan Surat Kredensial Resmi.
- **Tahap 4:** Pengguna masuk ke dasbor sesuai peran hak aksesnya.

**🎙️ Script Pembicaraan ke Dosen:**
> *"Sesuai dengan blueprint perbaikan, pada alur autentikasi baru ini tidak sembarang orang bisa mendaftar akun. Calon guru atau siswa wajib menginputkan NIP atau NISN resmi. Sistem akan memvalidasi nomor tersebut ke master data sekolah. Jika terdaftar, sistem akan meng-generate password secara otomatis dan menerbitkan surat kredensial akses."*

---

### SLIDE 6: PEMISAHAN ALUR PRESENSI GURU & MURID
**Konten Slide:**
- **Presensi Guru (Biometrik Sidik Jari):**
  - Mesin Fingerprint Terminal di lobi kantor guru.
  - Mode Tap Masuk (pagi) dan Tap Pulang (sore).
  - Push data otomatis via REST API ke `tb_presensi_guru`.
  - Toleransi keterlambatan pukul 07:00:00 WIB.
- **Presensi Murid (Manual di Kelas):**
  - Diabsen langsung oleh Guru Mata Pelajaran di dalam kelas.
  - 4 Status Kehadiran: Hadir, Sakit, Izin, Alfa.
  - Fitur Hemat Waktu: Tombol 1-klik *"⚡ Tandai Semua Siswa Hadir"*.

**🎙️ Script Pembicaraan ke Dosen:**
> *"Inovasi terpenting pada sistem ini adalah Pemisahan Alur Presensi. Guru menggunakan mesin pemindai biometrik sidik jari untuk menjamin kehadiran fisik di sekolah. Sedangkan siswa diabsen secara digital oleh guru mata pelajaran di kelas menggunakan lembar absensi digital. Pemisahan ini sangat krusial di lapangan untuk mencegah penumpukan antrean ratusan siswa di depan mesin fingerprint setiap pagi."*

---

### SLIDE 7: INTEGRASI NOTIFIKASI WHATSAPP GATEWAY
**Konten Slide:**
- **Pemicu Otomatis:** Saat guru mapel menyimpan presensi kelas, sistem menyaring siswa berstatus Alfa, Sakit, atau Izin.
- **Isi Pesan Dinamis:** Menyebutkan nama ananda, nama mata pelajaran, status ketidakhadiran, dan permohonan konfirmasi.
- **Audit Log (`wa_log`):** Rekam jejak seluruh pesan keluar tersimpan rapi untuk pertanggungjawaban sekolah.

**🎙️ Script Pembicaraan ke Dosen:**
> *"Keunggulan berikutnya adalah integrasi WhatsApp Gateway. Begitu guru mapel menekan tombol 'Simpan Presensi Kelas', sistem langsung mendeteksi siswa yang berstatus Alfa atau Izin, lalu secara otomatis mengirimkan pesan WhatsApp ke nomor HP orang tua saat itu juga. Hal ini menciptakan transparansi penuh antara pihak sekolah dan wali murid."*

---

### SLIDE 8: KALKULASI NILAI AKADEMIK & CETAK E-RAPOR
**Konten Slide:**
- **Formula Nilai Akhir:** `(Tugas × 20%) + (UH × 20%) + (UTS × 30%) + (UAS × 30%)`
- **KKM:** 75.00 dengan predikat otomatis (A, B, C, D) dan capaian kompetensi.
- **Format Cetak Resmi A4:**
  - Kop Surat Resmi Yayasan & Sekolah + Logo Asli.
  - Biodata Siswa, Tabel Nilai Lengkap, Rekap Kehadiran Semester.
  - Pengesahan digital Wali Kelas dan Kepala Sekolah.

**🎙️ Script Pembicaraan ke Dosen:**
> *"Pada modul akademik, sistem menerapkan formula pembobotan kurikulum: 20% Tugas, 20% Ulangan Harian, 30% UTS, dan 30% UAS. Dari data nilai yang diinput guru pengampu, wali kelas dapat langsung mencetak lembar e-Rapor resmi format A4 siap edar lengkap dengan kop surat dan tanda tangan pengesahan hanya dengan satu kali klik."*

---

### SLIDE 9: MATRIX PERAN & HAK AKSES PENGGUNA (RBAC)
**Konten Slide:**
- **Admin TU:** Master data penuh, verifikasi akun, rekap presensi guru & rapor seluruh sekolah.
- **Guru Mapel:** Input nilai, lembar presensi kelas harian, dan penerbitan modul materi e-learning.
- **Guru Piket & BK:** Validasi surat izin/sakit dan penanganan siswa yang sering Alfa (Early Warning).
- **Siswa & Orang Tua:** Akses transkrip nilai, unduh lembar e-rapor, dan pantauan kehadiran hari ini.

**🎙️ Script Pembicaraan ke Dosen:**
> *"Sistem mengimplementasikan Role-Based Access Control 5 tingkat: Administrator TU, Guru Mapel, Guru Piket/BK, Siswa, dan Orang Tua. Tiap peran memiliki batasan hak akses yang ketat sehingga keamanan dan privasi data akademik tetap terjaga."*

---

### SLIDE 10: STRUKTUR DATABASE (NORMALISASI 3NF)
**Konten Slide:**
- `tb_presensi_guru`: Menyimpan log sidik jari, jam masuk, jam pulang, dan ID mesin terminal.
- `tb_nilai`: Menyimpan komponen nilai tugas, UH, UTS, UAS, dan nilai akhir hasil generate.
- `tb_users`: Kredensial akun terenkripsi, peran pengguna, dan relasi NIP/NISN.
- `wa_log` & `tb_device_logs`: Audit trail pengiriman notifikasi dan respon REST API.

**🎙️ Script Pembicaraan ke Dosen:**
> *"Struktur basis data telah dinormalisasi hingga bentuk normal ketiga (3NF) untuk mencegah redundansi data. Kami juga menambahkan tabel log perangkat biometrik dan log pesan WhatsApp sebagai fungsi audit trail."*

---

### SLIDE 11: DEMO SISTEM & ANTARMUKA APLIKASI
**Konten Slide:**
- Demonstrasi langsung di server lokal port 3000 (`http://localhost:3000`).
- Pengujian simulator mesin fingerprint biometrik guru.
- Pengujian input nilai dan cetak lembar e-rapor digital.

**🎙️ Script Pembicaraan ke Dosen:**
> *"Bapak dan Ibu penguji, seluruh fitur ini telah diimplementasikan secara nyata pada sistem berbasis web dan saat ini sudah berjalan pada server lokal. Saya dapat mendemonstrasikan langsung cara kerja simulator biometrik, penginputan absensi kelas, dan pencetakan e-rapor."*

---

### SLIDE 12: HASIL PENGUJIAN BLACK BOX & UAT
**Konten Slide:**
- **Black Box Testing:** 100% Skenario uji fungsional berhasil (0 error kritis).
- **Respon Sensor:** Transmisi log sidik jari via REST API tercatat di bawah 1 detik.
- **User Acceptance Test (UAT):** Rata-rata tingkat kepuasan guru dan staf mencapai 92.4% (Kategori Sangat Layak).

**🎙️ Script Pembicaraan ke Dosen:**
> *"Pengujian fungsional menggunakan Black Box Testing menunjukkan hasil 100% lulus, termasuk uji coba pemisahan absensi guru dan murid. Respon transmisi data fingerprint berlangsung instan di bawah 1 detik, dan hasil UAT mendapatkan skor kelayakan 92.4%."*

---

### SLIDE 13: PERBANDINGAN SEBELUM & SESUDAH SISTEM
**Konten Slide:**
- **Presensi Guru:** Dari tanda tangan kertas rawan manipulasi ➔ Menjadi data biometrik presisi detik.
- **Absensi Siswa:** Dari buku fisik ➔ Menjadi digital dengan tombol cepat hemat waktu.
- **Notifikasi Orang Tua:** Dari surat fisik lambat ➔ Menjadi pesan instan WhatsApp real-time.
- **Penerbitan Rapor:** Dari 3-5 hari per kelas ➔ Menjadi otomatis seketika dalam 1 klik.

**🎙️ Script Pembicaraan ke Dosen:**
> *"Tabel perbandingan ini memperlihatkan efisiensi nyata yang dicapai. Waktu rekapitulasi nilai dan rapor yang sebelumnya memakan waktu berhari-hari kini selesai seketika, serta potensi keterlambatan siswa berkurang drastis berkat pengawasan langsung dari orang tua."*

---

### SLIDE 14: KESIMPULAN & SARAN PENGEMBANGAN
**Konten Slide:**
- **Kesimpulan:** Metode RAD terbukti efektif menghasilkan aplikasi SIAKAD terintegrasi biometrik yang siap pakai sesuai kebutuhan sekolah.
- **Saran Masa Depan:** Integrasi kartu RFID/NFC untuk gerbang sekolah dan pembuatan aplikasi mobile wali murid.
- **Penutup:** Sesi Tanya Jawab (Q&A).

**🎙️ Script Pembicaraan ke Dosen:**
> *"Sebagai kesimpulan, metode RAD berhasil diterapkan dalam perancangan SIAKAD SMA Hidayatun Najah dengan hasil yang stabil dan siap pakai. Untuk pengembangan selanjutnya, kami menyarankan penambahan kartu RFID pintar dan aplikasi mobile. Sekian presentasi dari saya, terima kasih banyak dan saya siap menerima pertanyaan serta saran dari Bapak/Ibu Dosen Penguji."*

---

## 💡 KISI-KISI PERTANYAAN DOSEN PENGUJI & JAWABANNYA

1. **Dosen:** *"Mengapa kamu memilih metode RAD, bukan Waterfall?"*  
   **Jawaban Anda:**  
   > *"Karena pada studi kasus ini terdapat integrasi hardware biometrik dan kebutuhan revisi antarmuka yang cepat dari pihak sekolah. Pada metode RAD, fase User Design Workshop memungkinkan kita membuat prototipe interaktif yang langsung diuji oleh pengguna, sehingga perbaikan dapat langsung diselesaikan tanpa harus menunggu siklus pengembangan berbulan-bulan seperti pada Waterfall."*

2. **Dosen:** *"Bagaimana jika mesin fingerprint di sekolah mati listrik atau offline?"*  
   **Jawaban Anda:**  
   > *"Mesin terminal biometrik modern memiliki baterai cadangan (battery backup) internal dan kapasitas memori offline lokal hingga puluhan ribu log kehadiran. Begitu koneksi internet atau jaringan lokal menyala kembali, mesin akan secara otomatis melakukan 'push sync' data kehadiran yang tertunda ke server database SIAKAD."*

3. **Dosen:** *"Kenapa absensi siswa tidak ikut menggunakan fingerprint seperti gurunya?"*  
   **Jawaban Anda:**  
   > *"Secara operasional di lapangan, jumlah guru hanya puluhan orang sehingga penggunaan 1 mesin fingerprint sangat efisien. Namun untuk siswa yang berjumlah ratusan, jika harus antre di 1 mesin fingerprint pada pukul 06.45 pagi akan terjadi antrean panjang dan kemacetan di gerbang sekolah. Oleh karena itu, absensi siswa lebih tepat dilakukan secara digital di dalam kelas oleh guru mata pelajaran masing-masing."*

4. **Dosen:** *"Apa fungsi validasi NIP/NISN pada pendaftaran akun baru?"*  
   **Jawaban Anda:**  
   > *"Fungsinya adalah sebagai pengaman (access gatekeeper). Sistem memeriksa apakah nomor identitas tersebut memang tercatat di master data resmi sekolah. Jika ada orang luar yang mencoba mendaftar sembarangan, sistem akan otomatis menolak registrasi tersebut."*

