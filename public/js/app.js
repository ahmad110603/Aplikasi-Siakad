// SIAKAD SMA RAD - Application Controller
// Absensi Guru: Biometrik Sidik Jari
// Absensi Murid: Manual di Kelas oleh Guru Mata Pelajaran

// Auto-fallback API endpoint to localhost:3000 if opened directly as local HTML file (file://)
if (typeof window !== 'undefined' && window.location && window.location.protocol === 'file:') {
  const originalFetch = window.fetch;
  window.fetch = function(url, options) {
    if (typeof url === 'string' && url.startsWith('/api/')) {
      url = 'http://localhost:3000' + url;
    }
    return originalFetch(url, options);
  };
}

const App = {
  currentUser: null,
  activeRole: 'admin',
  activeTab: 'dashboard',
  isLoggedIn: false,
  demoUsers: [],
  fingerprintClockType: 'masuk',
  cachedTeachers: [],
  cachedMapel: [],
  cachedKelas: [],
  currentPpdbCaptcha: '',
  currentPpdbRegCaptcha: '',
  currentPpdbUser: null,
  activeLoginPortal: 'siakad',

  async init() {
    this.initDarkMode();
    this.refreshPpdbCaptcha();
    this.refreshPpdbRegCaptcha();
    await this.fetchDemoUsers();
    await this.loadInitialMasterData();
    this.setupEventListeners();
    this.showLoginPage();
  },

  initDarkMode() {
    const savedTheme = localStorage.getItem('siakad_theme') || 'dark';
    if (savedTheme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    this.updateThemeButton();
  },

  toggleDarkMode() {
    const isDark = document.documentElement.classList.toggle('dark');
    localStorage.setItem('siakad_theme', isDark ? 'dark' : 'light');
    this.updateThemeButton();

    if (this.activeTab === 'dashboard') {
      this.loadDashboardData();
    } else if (this.activeTab === 'nilai') {
      this.loadNilaiView();
    }
  },

  updateThemeButton() {
    const isDark = document.documentElement.classList.contains('dark');
    const btn = document.getElementById('btn-theme-toggle');
    if (btn) {
      btn.innerHTML = isDark
        ? `<svg class="w-5 h-5 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"></path></svg>`
        : `<svg class="w-5 h-5 text-slate-700" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"></path></svg>`;
    }
    const loginThemeIcon = document.getElementById('login-theme-icon');
    if (loginThemeIcon) {
      loginThemeIcon.textContent = isDark ? '☀️' : '🌙';
    }
  },

  async loadInitialMasterData() {
    try {
      const [resG, resM, resK] = await Promise.all([
        fetch('/api/master/guru'),
        fetch('/api/master/mapel'),
        fetch('/api/master/kelas')
      ]);
      const [jsonG, jsonM, jsonK] = await Promise.all([resG.json(), resM.json(), resK.json()]);
      if (jsonG.success) this.cachedTeachers = jsonG.data;
      if (jsonM.success) this.cachedMapel = jsonM.data;
      if (jsonK.success) {
        this.cachedKelas = jsonK.data;
        this.populateKelasDropdowns();
      }
    } catch (e) {
      console.warn('Initial master data error:', e);
    }
  },

  populateKelasDropdowns() {
    if (!this.cachedKelas || this.cachedKelas.length === 0) return;

    const optionsHtml = this.cachedKelas.map(k => `
      <option value="${k.id}">${k.nama_kelas}</option>
    `).join('');

    const selAbsen = document.getElementById('manual-absen-kelas');
    if (selAbsen) {
      const prevVal = selAbsen.value;
      selAbsen.innerHTML = optionsHtml;
      if (prevVal && this.cachedKelas.some(k => String(k.id) === String(prevVal))) {
        selAbsen.value = prevVal;
      } else {
        const xii1 = this.cachedKelas.find(k => k.nama_kelas === 'XII-1');
        if (xii1) selAbsen.value = xii1.id;
      }
    }

    const selBroadcast = document.getElementById('broadcast-kelas-select');
    if (selBroadcast) {
      selBroadcast.innerHTML = `<option value="all">Semua Kelas (Seluruh Siswa)</option>` + this.cachedKelas.map(k => `
        <option value="${k.id}">${k.nama_kelas} (Semua Siswa)</option>
      `).join('');
    }

    const selFilterRapor = document.getElementById('rekap-rapor-kelas-filter');
    if (selFilterRapor) {
      selFilterRapor.innerHTML = `<option value="all">Semua Kelas (6 Kelas)</option>` + this.cachedKelas.map(k => `
        <option value="${k.id}" ${k.nama_kelas === 'XII-1' ? 'selected' : ''}>Kelas ${k.nama_kelas}</option>
      `).join('');
    }
  },

  async fetchDemoUsers() {
    try {
      const res = await fetch('/api/auth/demo-users');
      const json = await res.json();
      if (json.success) {
        this.demoUsers = json.data;
        this.renderDemoRoleBar();
      }
    } catch (e) {
      console.error('Failed to load demo users:', e);
    }
  },

  renderDemoRoleBar() {
    const container = document.getElementById('demo-role-buttons');
    if (!container) return;

    const roleBadges = [
      { role: 'guru', label: '👨‍🏫 Guru (Bambang)', username: 'guru_bambang' },
      { role: 'admin', label: '👑 Administrator', username: 'admin' },
      { role: 'guru_piket', label: '🛡️ Guru Piket', username: 'guru_siti' },
      { role: 'siswa', label: '🎒 Siswa (Dimas)', username: 'siswa_dimas' },
      { role: 'orang_tua', label: '👨‍👩‍👦 Orang Tua', username: 'ortu_dimas' }
    ];

    container.innerHTML = roleBadges.map(item => {
      const isActive = this.activeRole === item.role;
      return `
        <button onclick="App.loginAsUser('${item.username}')" 
          class="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 whitespace-nowrap ${
            isActive
              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/30 ring-2 ring-indigo-400'
              : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
          }">
          ${item.label}
        </button>
      `;
    }).join('');
  },

  // ==========================================
  // LOGIN DASHBOARD & SESSION MANAGEMENT
  // ==========================================
  showLoginPage() {
    this.isLoggedIn = false;
    const pageLogin = document.getElementById('page-login');
    const appWrapper = document.getElementById('app-wrapper');
    if (pageLogin) pageLogin.classList.remove('hidden');
    if (appWrapper) appWrapper.classList.add('hidden');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  },

  showDashboard() {
    this.isLoggedIn = true;
    const pageLogin = document.getElementById('page-login');
    const appWrapper = document.getElementById('app-wrapper');
    if (pageLogin) pageLogin.classList.add('hidden');
    if (appWrapper) appWrapper.classList.remove('hidden');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  },

  handleLogout() {
    this.currentUser = null;
    this.showLoginPage();
    // Reset form fields
    const passInput = document.getElementById('login-password');
    if (passInput) passInput.value = '';
    const alertBox = document.getElementById('login-alert-box');
    if (alertBox) alertBox.classList.add('hidden');
    this.showToast('Anda telah berhasil keluar dari sistem SIAKAD.', 'info');
  },

  toggleLoginPasswordVisibility() {
    const passwordInput = document.getElementById('login-password');
    const eyeOpen = document.getElementById('eye-icon-open');
    const eyeClosed = document.getElementById('eye-icon-closed');
    if (!passwordInput) return;

    if (passwordInput.type === 'password') {
      passwordInput.type = 'text';
      if (eyeOpen) eyeOpen.classList.add('hidden');
      if (eyeClosed) eyeClosed.classList.remove('hidden');
    } else {
      passwordInput.type = 'password';
      if (eyeOpen) eyeOpen.classList.remove('hidden');
      if (eyeClosed) eyeClosed.classList.add('hidden');
    }
  },

  async handleLoginFormSubmit(e) {
    if (e && e.preventDefault) e.preventDefault();
    const username = document.getElementById('login-username')?.value.trim();
    const password = document.getElementById('login-password')?.value;
    const alertBox = document.getElementById('login-alert-box');
    const btnSubmit = document.getElementById('btn-login-submit');
    const spinner = document.getElementById('btn-login-spinner');
    const icon = document.getElementById('btn-login-icon');
    const text = document.getElementById('btn-login-text');

    if (!username || !password) {
      if (alertBox) {
        alertBox.className = 'p-3.5 rounded-xl text-xs font-semibold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20';
        alertBox.textContent = 'Harap isi Nomor Identitas (NIS/NIP) / Username dan kata sandi Anda!';
        alertBox.classList.remove('hidden');
      }
      return;
    }

    // Loading State
    if (btnSubmit) btnSubmit.disabled = true;
    if (spinner) spinner.classList.remove('hidden');
    if (icon) icon.classList.add('hidden');
    if (text) text.textContent = 'Memverifikasi akun...';
    if (alertBox) alertBox.classList.add('hidden');

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      const json = await res.json();
      if (json.success) {
        this.currentUser = json.user;
        this.activeRole = json.user.role;
        this.showDashboard();
        this.renderDemoRoleBar();
        this.updateUserHeader();
        this.adjustNavigationForRole();

        // Default tab based on role
        if (this.activeRole === 'guru') {
          this.switchTab('presensi-siswa');
        } else if (this.activeRole === 'siswa') {
          this.switchTab('riwayat-siswa');
        } else if (this.activeRole === 'orang_tua') {
          this.switchTab('portal_ortu');
        } else if (this.activeRole === 'guru_piket') {
          this.switchTab('piket');
        } else {
          this.switchTab('dashboard');
        }

        this.showToast(json.message || `Selamat datang, ${this.currentUser.detail?.nama || this.currentUser.username}!`, 'success');
      } else {
        if (alertBox) {
          alertBox.className = 'p-3.5 rounded-xl text-xs font-semibold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20';
          alertBox.textContent = json.message || 'Identitas atau kata sandi tidak valid!';
          alertBox.classList.remove('hidden');
        }
        this.showToast(json.message || 'Gagal masuk ke sistem', 'error');
      }
    } catch (err) {
      if (alertBox) {
        alertBox.className = 'p-3.5 rounded-xl text-xs font-semibold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20';
        alertBox.textContent = 'Gangguan komunikasi server: ' + err.message;
        alertBox.classList.remove('hidden');
      }
      this.showToast('Gangguan komunikasi server: ' + err.message, 'error');
    } finally {
      if (btnSubmit) btnSubmit.disabled = false;
      if (spinner) spinner.classList.add('hidden');
      if (icon) icon.classList.remove('hidden');
      if (text) text.textContent = 'Masuk ke Sistem (Login)';
    }
  },

  async handleSSOLogin(provider) {
    const alertBox = document.getElementById('login-alert-box');
    const providerLabel = provider === 'microsoft' ? 'Microsoft 365 Education' : 'Google Workspace for Education';
    this.showToast(`Menghubungkan ke Single Sign-On ${providerLabel}...`, 'info');

    try {
      const res = await fetch('/api/auth/sso', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider })
      });
      const json = await res.json();
      if (json.success) {
        this.currentUser = json.user;
        this.activeRole = json.user.role;
        this.showDashboard();
        this.renderDemoRoleBar();
        this.updateUserHeader();
        this.adjustNavigationForRole();

        if (this.activeRole === 'guru') {
          this.switchTab('presensi-siswa');
        } else if (this.activeRole === 'siswa') {
          this.switchTab('riwayat-siswa');
        } else {
          this.switchTab('dashboard');
        }

        this.showToast(json.message, 'success');
      } else {
        if (alertBox) {
          alertBox.className = 'p-3.5 rounded-xl text-xs font-semibold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20';
          alertBox.textContent = json.message || 'Autentikasi SSO gagal.';
          alertBox.classList.remove('hidden');
        }
      }
    } catch (err) {
      this.showToast('Gagal memproses SSO: ' + err.message, 'error');
    }
  },

  quickDemoFill(usernameOrId, password) {
    const userInput = document.getElementById('login-username');
    const passInput = document.getElementById('login-password');
    if (userInput) userInput.value = usernameOrId;
    if (passInput) passInput.value = password;
    this.handleLoginFormSubmit(new Event('submit'));
  },

  openForgotPasswordModal() {
    const modal = document.getElementById('modal-forgot-password');
    const currentUsername = document.getElementById('login-username')?.value.trim();
    const input = document.getElementById('forgot-identifier');
    const resultBox = document.getElementById('forgot-password-result');
    if (resultBox) resultBox.classList.add('hidden');
    if (input && currentUsername) input.value = currentUsername;
    if (modal) {
      modal.classList.remove('hidden');
      modal.classList.add('flex');
      input?.focus();
    }
  },

  closeForgotPasswordModal() {
    const modal = document.getElementById('modal-forgot-password');
    if (modal) {
      modal.classList.add('hidden');
      modal.classList.remove('flex');
    }
  },

  async handleForgotPasswordSubmit(e) {
    if (e && e.preventDefault) e.preventDefault();
    const identifier = document.getElementById('forgot-identifier')?.value.trim();
    const resultBox = document.getElementById('forgot-password-result');
    const btn = document.getElementById('btn-forgot-submit');

    if (!identifier) return;
    if (btn) btn.disabled = true;

    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier })
      });
      const json = await res.json();
      if (resultBox) {
        resultBox.classList.remove('hidden');
        if (json.success) {
          resultBox.className = 'p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300 text-xs space-y-2';
          resultBox.innerHTML = `
            <div class="font-bold flex items-center gap-1.5">
              <span>✅</span>
              <span>Kode Pemulihan Berhasil Dikirim!</span>
            </div>
            <p class="leading-relaxed">${json.message}</p>
            <div class="p-2.5 rounded-xl bg-white dark:bg-slate-800 border border-emerald-300 dark:border-slate-700 font-mono text-[11px] text-slate-800 dark:text-slate-100 flex items-center justify-between">
              <span>Kode OTP Reset: <strong class="text-indigo-600 dark:text-indigo-400 text-sm tracking-widest">${json.code}</strong></span>
              <span class="text-[9px] px-2 py-0.5 rounded bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-200">Aktif 15 menit</span>
            </div>
          `;
          this.showToast(`Kode OTP ${json.code} berhasil dikirim ke nomor WhatsApp!`, 'success');
        } else {
          resultBox.className = 'p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-400 text-xs';
          resultBox.textContent = json.message || 'Gagal memproses pemulihan kata sandi.';
        }
      }
    } catch (err) {
      if (resultBox) {
        resultBox.classList.remove('hidden');
        resultBox.className = 'p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-400 text-xs';
        resultBox.textContent = 'Gangguan komunikasi server: ' + err.message;
      }
    } finally {
      if (btn) btn.disabled = false;
    }
  },

  // ==========================================
  // PPDB (PENDAFTARAN SISWA BARU SMA) PORTAL
  // ==========================================
  switchLoginPortal(portal) {
    this.activeLoginPortal = portal;
    const tabSiakad = document.getElementById('tab-portal-siakad');
    const tabPpdb = document.getElementById('tab-portal-ppdb');
    const containerSiakad = document.getElementById('container-portal-siakad');
    const containerPpdb = document.getElementById('container-portal-ppdb');
    const noticeSiakad = document.getElementById('left-notice-siakad');
    const noticePpdb = document.getElementById('left-notice-ppdb');

    if (portal === 'ppdb') {
      if (tabPpdb) {
        tabPpdb.className = 'flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 bg-emerald-600 text-white shadow-md';
      }
      if (tabSiakad) {
        tabSiakad.className = 'flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 text-slate-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-white';
      }
      if (containerPpdb) containerPpdb.classList.remove('hidden');
      if (containerSiakad) containerSiakad.classList.add('hidden');
      if (noticePpdb) noticePpdb.classList.remove('hidden');
      if (noticeSiakad) noticeSiakad.classList.add('hidden');

      if (!this.currentPpdbCaptcha) {
        this.refreshPpdbCaptcha();
      }
    } else {
      if (tabSiakad) {
        tabSiakad.className = 'flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 bg-indigo-600 text-white shadow-md';
      }
      if (tabPpdb) {
        tabPpdb.className = 'flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 text-slate-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-white';
      }
      if (containerSiakad) containerSiakad.classList.remove('hidden');
      if (containerPpdb) containerPpdb.classList.add('hidden');
      if (noticeSiakad) noticeSiakad.classList.remove('hidden');
      if (noticePpdb) noticePpdb.classList.add('hidden');
    }
  },

  generateRandomCaptcha(length = 5) {
    const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
    let result = '';
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  },

  refreshPpdbCaptcha() {
    this.currentPpdbCaptcha = this.generateRandomCaptcha(5);
    const display = document.getElementById('ppdb-captcha-display');
    if (display) display.textContent = this.currentPpdbCaptcha;
    const input = document.getElementById('ppdb-captcha-input');
    if (input) input.value = '';
  },

  refreshPpdbRegCaptcha() {
    this.currentPpdbRegCaptcha = this.generateRandomCaptcha(5);
    const display = document.getElementById('ppdb-reg-captcha-display');
    if (display) display.textContent = this.currentPpdbRegCaptcha;
    const input = document.getElementById('ppdb-reg-captcha-input');
    if (input) input.value = '';
  },

  togglePpdbPasswordVisibility() {
    const input = document.getElementById('ppdb-login-password');
    const eyeOpen = document.getElementById('eye-ppdb-open');
    const eyeClosed = document.getElementById('eye-ppdb-closed');
    if (!input) return;

    if (input.type === 'password') {
      input.type = 'text';
      if (eyeOpen) eyeOpen.classList.add('hidden');
      if (eyeClosed) eyeClosed.classList.remove('hidden');
    } else {
      input.type = 'password';
      if (eyeOpen) eyeOpen.classList.remove('hidden');
      if (eyeClosed) eyeClosed.classList.add('hidden');
    }
  },

  togglePpdbRegPasswordVisibility() {
    const input = document.getElementById('ppdb-reg-password');
    if (!input) return;
    input.type = input.type === 'password' ? 'text' : 'password';
  },

  quickPpdbDemoFill(nisn, pin, jalur) {
    this.switchLoginPortal('ppdb');
    const nisnInput = document.getElementById('ppdb-login-nisn');
    const passInput = document.getElementById('ppdb-login-password');
    const jalurSelect = document.getElementById('ppdb-login-jalur');
    const captchaInput = document.getElementById('ppdb-captcha-input');

    if (nisnInput) nisnInput.value = nisn;
    if (passInput) passInput.value = pin;
    if (jalurSelect && jalur) jalurSelect.value = jalur;
    if (captchaInput) captchaInput.value = this.currentPpdbCaptcha;

    this.handlePpdbLoginSubmit(new Event('submit'));
  },

  async handlePpdbLoginSubmit(e) {
    if (e && e.preventDefault) e.preventDefault();
    const nisn = document.getElementById('ppdb-login-nisn')?.value.trim();
    const password = document.getElementById('ppdb-login-password')?.value;
    const jalur = document.getElementById('ppdb-login-jalur')?.value;
    const captcha = document.getElementById('ppdb-captcha-input')?.value.trim();
    const alertBox = document.getElementById('ppdb-login-alert-box');
    const btnSubmit = document.getElementById('btn-ppdb-login-submit');
    const spinner = document.getElementById('btn-ppdb-spinner');
    const icon = document.getElementById('btn-ppdb-icon');
    const text = document.getElementById('btn-ppdb-text');

    if (!nisn || !password) {
      if (alertBox) {
        alertBox.className = 'p-3.5 rounded-xl text-xs font-semibold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20';
        alertBox.textContent = 'Harap masukkan 10 Digit NISN dan PIN/Kata Sandi pendaftaran!';
        alertBox.classList.remove('hidden');
      }
      return;
    }

    if (nisn.length !== 10) {
      if (alertBox) {
        alertBox.className = 'p-3.5 rounded-xl text-xs font-semibold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20';
        alertBox.textContent = 'NISN harus berjumlah tepat 10 digit angka!';
        alertBox.classList.remove('hidden');
      }
      return;
    }

    // Client-side captcha check
    if (!captcha || captcha.toUpperCase() !== (this.currentPpdbCaptcha || '').toUpperCase()) {
      if (alertBox) {
        alertBox.className = 'p-3.5 rounded-xl text-xs font-semibold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20';
        alertBox.textContent = 'Kode CAPTCHA tidak sesuai! Silakan periksa kembali kode di kotak abu-abu.';
        alertBox.classList.remove('hidden');
      }
      this.refreshPpdbCaptcha();
      return;
    }

    // Loading State
    if (btnSubmit) btnSubmit.disabled = true;
    if (spinner) spinner.classList.remove('hidden');
    if (icon) icon.classList.add('hidden');
    if (text) text.textContent = 'Memverifikasi berkas pendaftar...';
    if (alertBox) alertBox.classList.add('hidden');

    try {
      const res = await fetch('/api/ppdb/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nisn,
          password_token: password,
          jalur,
          captcha,
          captcha_expected: this.currentPpdbCaptcha
        })
      });
      const json = await res.json();
      if (json.success) {
        const applicant = json.data || json.pendaftar;
        this.currentPpdbUser = applicant;
        this.openPpdbDashboardModal(applicant);
        this.showToast(json.message || `Selamat datang calon siswa, ${applicant.nama_lengkap}!`, 'success');
      } else {
        if (alertBox) {
          alertBox.className = 'p-3.5 rounded-xl text-xs font-semibold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20';
          alertBox.textContent = json.message || 'NISN atau Kata Sandi / PIN tidak cocok!';
          alertBox.classList.remove('hidden');
        }
        this.refreshPpdbCaptcha();
        this.showToast(json.message || 'Gagal masuk akun PPDB', 'error');
      }
    } catch (err) {
      if (alertBox) {
        alertBox.className = 'p-3.5 rounded-xl text-xs font-semibold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20';
        alertBox.textContent = 'Gangguan komunikasi server: ' + err.message;
        alertBox.classList.remove('hidden');
      }
      this.showToast('Gangguan komunikasi server: ' + err.message, 'error');
    } finally {
      if (btnSubmit) btnSubmit.disabled = false;
      if (spinner) spinner.classList.add('hidden');
      if (icon) icon.classList.remove('hidden');
      if (text) text.textContent = 'Masuk ke Dasbor PPDB Calon Siswa';
    }
  },

  openRegisterPpdbModal() {
    const modal = document.getElementById('modal-register-ppdb');
    const alertBox = document.getElementById('ppdb-reg-alert-box');
    if (alertBox) alertBox.classList.add('hidden');
    this.refreshPpdbRegCaptcha();
    if (modal) {
      modal.classList.remove('hidden');
      modal.classList.add('flex');
      document.getElementById('ppdb-reg-nisn')?.focus();
    }
  },

  closeRegisterPpdbModal() {
    const modal = document.getElementById('modal-register-ppdb');
    if (modal) {
      modal.classList.add('hidden');
      modal.classList.remove('flex');
    }
  },

  async handleRegisterPpdbSubmit(e) {
    if (e && e.preventDefault) e.preventDefault();
    const nisn = document.getElementById('ppdb-reg-nisn')?.value.trim();
    const nama_lengkap = document.getElementById('ppdb-reg-nama')?.value.trim();
    const asal_sekolah = document.getElementById('ppdb-reg-asal')?.value.trim();
    const jalur_pendaftaran = document.getElementById('ppdb-reg-jalur')?.value;
    const nilai_rata_rata = document.getElementById('ppdb-reg-nilai')?.value;
    const skor_jarak_km = document.getElementById('ppdb-reg-jarak')?.value;
    const no_wa = document.getElementById('ppdb-reg-wa')?.value.trim();
    const password_token = document.getElementById('ppdb-reg-password')?.value;
    const captcha = document.getElementById('ppdb-reg-captcha-input')?.value.trim();
    const alertBox = document.getElementById('ppdb-reg-alert-box');
    const btnSubmit = document.getElementById('btn-ppdb-reg-submit');

    if (!nisn || !nama_lengkap || !asal_sekolah || !password_token || !no_wa) {
      if (alertBox) {
        alertBox.className = 'p-3 rounded-xl text-xs font-semibold bg-rose-500/10 text-rose-600 border border-rose-500/20';
        alertBox.textContent = 'Harap isi semua kolom formulir pendaftaran wajib!';
        alertBox.classList.remove('hidden');
      }
      return;
    }

    if (nisn.length !== 10) {
      if (alertBox) {
        alertBox.className = 'p-3 rounded-xl text-xs font-semibold bg-rose-500/10 text-rose-600 border border-rose-500/20';
        alertBox.textContent = 'NISN harus berupa 10 digit angka resmi!';
        alertBox.classList.remove('hidden');
      }
      return;
    }

    if (!captcha || captcha.toUpperCase() !== (this.currentPpdbRegCaptcha || '').toUpperCase()) {
      if (alertBox) {
        alertBox.className = 'p-3 rounded-xl text-xs font-semibold bg-rose-500/10 text-rose-600 border border-rose-500/20';
        alertBox.textContent = 'Kode CAPTCHA registrasi salah! Silakan coba lagi.';
        alertBox.classList.remove('hidden');
      }
      this.refreshPpdbRegCaptcha();
      return;
    }

    if (btnSubmit) btnSubmit.disabled = true;

    try {
      const res = await fetch('/api/ppdb/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nisn,
          nama_lengkap,
          asal_sekolah,
          jalur_pendaftaran,
          nilai_rata_rata,
          skor_jarak_km,
          no_wa,
          password_token,
          captcha,
          captcha_expected: this.currentPpdbRegCaptcha
        })
      });
      const json = await res.json();
      if (json.success) {
        const applicant = json.data || json.pendaftar;
        this.currentPpdbUser = applicant;
        this.closeRegisterPpdbModal();
        this.openPpdbDashboardModal(applicant);
        this.showToast(`Pendaftaran PPDB Berhasil! No. Registrasi: ${applicant.no_registrasi}`, 'success');
      } else {
        if (alertBox) {
          alertBox.className = 'p-3 rounded-xl text-xs font-semibold bg-rose-500/10 text-rose-600 border border-rose-500/20';
          alertBox.textContent = json.message || 'Registrasi gagal diproses.';
          alertBox.classList.remove('hidden');
        }
        this.refreshPpdbRegCaptcha();
      }
    } catch (err) {
      if (alertBox) {
        alertBox.className = 'p-3 rounded-xl text-xs font-semibold bg-rose-500/10 text-rose-600 border border-rose-500/20';
        alertBox.textContent = 'Gangguan server: ' + err.message;
        alertBox.classList.remove('hidden');
      }
    } finally {
      if (btnSubmit) btnSubmit.disabled = false;
    }
  },

  openForgotPpdbModal() {
    const modal = document.getElementById('modal-forgot-ppdb');
    const input = document.getElementById('ppdb-forgot-identifier');
    const resultBox = document.getElementById('ppdb-forgot-result');
    const currentNisn = document.getElementById('ppdb-login-nisn')?.value.trim();

    if (resultBox) resultBox.classList.add('hidden');
    if (input && currentNisn) input.value = currentNisn;
    if (modal) {
      modal.classList.remove('hidden');
      modal.classList.add('flex');
      input?.focus();
    }
  },

  closeForgotPpdbModal() {
    const modal = document.getElementById('modal-forgot-ppdb');
    if (modal) {
      modal.classList.add('hidden');
      modal.classList.remove('flex');
    }
  },

  async handleForgotPpdbSubmit(e) {
    if (e && e.preventDefault) e.preventDefault();
    const identifier = document.getElementById('ppdb-forgot-identifier')?.value.trim();
    const resultBox = document.getElementById('ppdb-forgot-result');
    const btn = document.getElementById('btn-ppdb-forgot-submit');

    if (!identifier) return;
    if (btn) btn.disabled = true;

    try {
      const res = await fetch('/api/ppdb/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier, nisn: identifier })
      });
      const json = await res.json();
      if (resultBox) {
        resultBox.classList.remove('hidden');
        if (json.success) {
          resultBox.className = 'p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300 text-xs space-y-2';
          resultBox.innerHTML = `
            <div class="font-bold flex items-center gap-1.5">
              <span>✅</span>
              <span>PIN Pemulihan Akun PPDB Diterbitkan!</span>
            </div>
            <p class="leading-relaxed">${json.message}</p>
            <div class="p-2.5 rounded-xl bg-white dark:bg-slate-800 border border-emerald-300 dark:border-slate-700 font-mono text-[11px] text-slate-800 dark:text-slate-100 flex items-center justify-between">
              <span>PIN Baru Anda: <strong class="text-emerald-600 dark:text-emerald-400 text-sm tracking-widest">${json.pin || json.code}</strong></span>
              <span class="text-[9px] px-2 py-0.5 rounded bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-200">Gunakan Untuk Login</span>
            </div>
          `;
          this.showToast(`PIN ${json.pin || json.code} berhasil dikirim ke WhatsApp!`, 'success');
          const passLogin = document.getElementById('ppdb-login-password');
          if (passLogin) passLogin.value = json.pin || json.code;
        } else {
          resultBox.className = 'p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-400 text-xs';
          resultBox.textContent = json.message || 'Gagal memulihkan PIN PPDB.';
        }
      }
    } catch (err) {
      if (resultBox) {
        resultBox.classList.remove('hidden');
        resultBox.className = 'p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-400 text-xs';
        resultBox.textContent = 'Gangguan server: ' + err.message;
      }
    } finally {
      if (btn) btn.disabled = false;
    }
  },

  openPpdbDashboardModal(data) {
    if (!data) return;
    this.currentPpdbUser = data;

    const modal = document.getElementById('modal-dashboard-ppdb');
    if (!modal) return;

    const setElem = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.textContent = val;
    };

    setElem('ppdb-card-noreg', data.no_registrasi || 'PPDB-2026-0001');
    setElem('ppdb-card-nama', ': ' + (data.nama_lengkap || '-'));
    setElem('ppdb-card-nisn', ': ' + (data.nisn || '-'));
    setElem('ppdb-card-asal', ': ' + (data.asal_sekolah || '-'));
    setElem('ppdb-card-jalur', ': Jalur ' + (data.jalur_pendaftaran || 'Zonasi'));
    setElem('ppdb-card-wa', ': ' + (data.no_wa || '-'));
    setElem('ppdb-card-nilai', ': ' + (data.nilai_rata_rata || '86.5'));
    setElem('ppdb-card-tanggal', ': ' + (data.tanggal_daftar || '18 Oktober 2026, 08:00 WIB'));
    setElem('ppdb-card-status-text', data.status_seleksi || 'Menunggu Verifikasi Berkas');
    setElem('ppdb-card-jalur-badge', 'Jalur ' + (data.jalur_pendaftaran || 'Zonasi'));
    setElem('ppdb-card-sign-nama', data.nama_lengkap || '-');
    setElem('ppdb-card-sign-nisn', data.nisn || '-');

    const statusBanner = document.getElementById('ppdb-card-status-banner');
    const statusIcon = document.getElementById('ppdb-card-status-icon');
    const statusText = document.getElementById('ppdb-card-status-text');

    if (data.status_seleksi === 'Diterima di SMA Hidayatun Najah') {
      if (statusBanner) statusBanner.className = 'mb-4 p-3.5 rounded-2xl bg-emerald-100 border border-emerald-300 flex flex-col sm:flex-row sm:items-center justify-between gap-2';
      if (statusIcon) statusIcon.textContent = '🎉';
      if (statusText) statusText.className = 'text-sm font-black text-emerald-900';
    } else if (data.status_seleksi === 'Lolos Verifikasi Administrasi') {
      if (statusBanner) statusBanner.className = 'mb-4 p-3.5 rounded-2xl bg-sky-50 border border-sky-300 flex flex-col sm:flex-row sm:items-center justify-between gap-2';
      if (statusIcon) statusIcon.textContent = '✅';
      if (statusText) statusText.className = 'text-sm font-black text-sky-900';
    } else {
      if (statusBanner) statusBanner.className = 'mb-4 p-3.5 rounded-2xl bg-amber-50 border border-amber-300 flex flex-col sm:flex-row sm:items-center justify-between gap-2';
      if (statusIcon) statusIcon.textContent = '⏳';
      if (statusText) statusText.className = 'text-sm font-black text-amber-900';
    }

    modal.classList.remove('hidden');
    modal.classList.add('flex');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  },

  closePpdbDashboardModal() {
    const modal = document.getElementById('modal-dashboard-ppdb');
    if (modal) {
      modal.classList.add('hidden');
      modal.classList.remove('flex');
    }
  },

  printPpdbCard() {
    window.print();
  },

  async loginAsUser(username) {
    const user = this.demoUsers.find(u => u.username === username);
    if (!user) return;

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: user.username, password: user.password })
      });
      const json = await res.json();
      if (json.success) {
        this.currentUser = json.user;
        this.activeRole = json.user.role;
        this.showDashboard();
        this.renderDemoRoleBar();
        this.updateUserHeader();
        this.adjustNavigationForRole();

        // Default tab based on role
        if (this.activeRole === 'guru') {
          this.switchTab('presensi-siswa');
        } else if (this.activeRole === 'siswa') {
          this.switchTab('riwayat-siswa');
        } else if (this.activeRole === 'orang_tua') {
          this.switchTab('portal_ortu');
        } else if (this.activeRole === 'guru_piket') {
          this.switchTab('piket');
        } else {
          this.switchTab('dashboard');
        }

        this.showToast(`Login sebagai: ${this.currentUser.detail?.nama || this.currentUser.username} (${this.getRoleDisplayName(this.activeRole)})`, 'success');
      }
    } catch (e) {
      this.showToast('Gagal login: ' + e.message, 'error');
    }
  },

  switchRole(roleName) {
    const user = this.demoUsers.find(u => u.role === roleName) || { username: 'guru_bambang', password: 'guru123' };
    this.loginAsUser(user.username);
  },

  getRoleDisplayName(role) {
    const map = {
      admin: 'Administrator SIAKAD',
      guru: 'Guru Mata Pelajaran',
      guru_piket: 'Guru Piket & Ketertiban',
      siswa: 'Siswa SMA',
      orang_tua: 'Orang Tua / Wali Siswa'
    };
    return map[role] || role;
  },

  updateUserHeader() {
    const nameEl = document.getElementById('user-display-name');
    const roleEl = document.getElementById('user-display-role');
    const avatarEl = document.getElementById('user-avatar-initials');

    if (!this.currentUser) return;

    let displayName = this.currentUser.username;
    let extra = '';

    if (this.currentUser.detail) {
      displayName = this.currentUser.detail.nama || displayName;
      if (this.currentUser.detail.nama_kelas) {
        extra = ` (${this.currentUser.detail.nama_kelas})`;
      }
    }

    if (nameEl) nameEl.textContent = displayName + extra;
    if (roleEl) roleEl.textContent = this.getRoleDisplayName(this.currentUser.role);
    if (avatarEl) avatarEl.textContent = displayName.substring(0, 2).toUpperCase();
  },

  adjustNavigationForRole() {
    const navItems = [
      { id: 'nav-dashboard', label: 'Dashboard Analitik', icon: '📊', roles: ['admin', 'guru', 'guru_piket', 'siswa', 'orang_tua'] },
      { id: 'nav-presensi-guru', label: 'Presensi Guru (Sidik Jari)', icon: '☝️', roles: ['admin', 'guru', 'guru_piket'] },
      { id: 'nav-presensi-siswa', label: 'Absensi Siswa (Oleh Guru Mapel)', icon: '✍️', roles: ['admin', 'guru'] },
      { id: 'nav-riwayat-siswa', label: 'Riwayat Presensi Saya', icon: '🎒', roles: ['siswa'] },
      { id: 'nav-piket', label: 'Piket & Dispensasi Siswa', icon: '🛡️', roles: ['admin', 'guru_piket'] },
      { id: 'nav-portal_ortu', label: 'Portal Orang Tua', icon: '👨‍👩‍👦', roles: ['admin', 'orang_tua'] },
      { id: 'nav-elearning', label: 'E-Learning (Materi & Tugas)', icon: '📚', roles: ['admin', 'guru', 'siswa', 'orang_tua'] },
      { id: 'nav-nilai', label: 'Nilai & Rapor Akademik', icon: '📈', roles: ['admin', 'guru', 'siswa', 'orang_tua'] },
      { id: 'nav-wa', label: 'WhatsApp Gateway & Log', icon: '💬', roles: ['admin', 'guru', 'guru_piket'] },
      { id: 'nav-master', label: 'Data Master & Konfigurasi', icon: '⚙️', roles: ['admin'] }
    ];

    const navContainer = document.getElementById('sidebar-nav-items');
    if (!navContainer) return;

    navContainer.innerHTML = navItems
      .filter(item => item.roles.includes(this.activeRole))
      .map(item => {
        const tabKey = item.id.replace('nav-', '');
        const isActive = this.activeTab === tabKey;
        return `
          <button onclick="App.switchTab('${tabKey}')"
            class="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl font-medium text-sm transition-all text-left ${
              isActive
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
                : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
            }">
            <span class="text-lg">${item.icon}</span>
            <span>${item.label}</span>
          </button>
        `;
      }).join('');
  },

  switchTab(tabName) {
    this.activeTab = tabName;
    this.adjustNavigationForRole();

    const allViews = document.querySelectorAll('.tab-view');
    allViews.forEach(v => v.classList.add('hidden'));

    const target = document.getElementById(`view-${tabName}`);
    if (target) {
      target.classList.remove('hidden');
      target.classList.add('animate-fade-in');
    }

    if (tabName === 'dashboard') {
      this.loadDashboardData();
    } else if (tabName === 'presensi-guru') {
      this.loadPresensiGuruView();
    } else if (tabName === 'presensi-siswa') {
      this.loadPresensiSiswaView();
    } else if (tabName === 'riwayat-siswa') {
      this.loadRiwayatSiswaView();
    } else if (tabName === 'piket') {
      this.loadPiketView();
    } else if (tabName === 'portal_ortu') {
      this.loadPortalOrtuView();
    } else if (tabName === 'elearning') {
      this.loadElearningView();
    } else if (tabName === 'nilai') {
      this.loadNilaiView();
    } else if (tabName === 'wa') {
      this.loadWaGatewayView();
    } else if (tabName === 'master') {
      this.loadMasterView();
    }
  },

  // ==========================================
  // VIEW 1: DASHBOARD ANALYTICS
  // ==========================================
  async loadDashboardData() {
    try {
      const res = await fetch('/api/analytics/dashboard');
      const json = await res.json();
      if (!json.success) return;

      const { summary, chartMonthly, earlyWarnings, classAttendance } = json.data;

      document.getElementById('stat-total-siswa').textContent = summary.totalSiswa;
      document.getElementById('stat-guru-fingerprint').textContent = `${summary.guruHadirFingerprint || 0} / ${summary.totalGuru}`;
      document.getElementById('stat-hadir-today').textContent = summary.hadirToday;
      document.getElementById('stat-alfa-today').textContent = summary.alfaToday;
      document.getElementById('stat-attendance-rate').textContent = `${summary.rateToday}%`;

      ChartEngine.initAttendanceChart('chart-attendance-ratio', chartMonthly);
      ChartEngine.initClassAttendanceChart('chart-class-attendance', classAttendance);

      this.renderEarlyWarningSection(earlyWarnings);
    } catch (e) {
      console.error('Failed to load dashboard:', e);
    }
  },

  renderEarlyWarningSection(warnings) {
    const container = document.getElementById('early-warning-container');
    if (!container) return;

    let html = '';

    if (warnings.alfaList && warnings.alfaList.length > 0) {
      warnings.alfaList.forEach(s => {
        html += `
          <div class="p-4 rounded-2xl bg-rose-50/80 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/50 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 rounded-full bg-rose-500/20 text-rose-600 dark:text-rose-400 flex items-center justify-center font-bold text-lg">⚠️</div>
              <div>
                <div class="flex items-center gap-2">
                  <h4 class="font-bold text-slate-800 dark:text-white">${s.nama}</h4>
                  <span class="px-2 py-0.5 rounded text-xs font-semibold bg-rose-500 text-white">${s.total_alfa}x Alfa di Kelas</span>
                </div>
                <p class="text-xs text-slate-500 dark:text-slate-400">Kelas ${s.nama_kelas} • NIS: ${s.nis} • Kontak Ortu: ${s.no_wa_ortu}</p>
              </div>
            </div>
            <div class="flex items-center gap-2 self-end md:self-auto">
              <button onclick="App.panggilOrtuViaWA('${s.nama}', '${s.no_wa_ortu}', ${s.total_alfa})" 
                class="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-sm">
                <span>💬 Panggil Ortu (WA)</span>
              </button>
            </div>
          </div>
        `;
      });
    }

    if (warnings.gradeDropList && warnings.gradeDropList.length > 0) {
      warnings.gradeDropList.forEach(s => {
        html += `
          <div class="p-4 rounded-2xl bg-amber-50/80 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 rounded-full bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold text-lg">📉</div>
              <div>
                <div class="flex items-center gap-2">
                  <h4 class="font-bold text-slate-800 dark:text-white">${s.nama}</h4>
                  <span class="px-2 py-0.5 rounded text-xs font-semibold bg-amber-500 text-white">Nilai: ${s.nilai_akhir} (KKM ${s.kkm})</span>
                </div>
                <p class="text-xs text-slate-500 dark:text-slate-400">Mapel: ${s.nama_mapel} • Kelas ${s.nama_kelas}</p>
              </div>
            </div>
          </div>
        `;
      });
    }

    if (!html) {
      container.innerHTML = `
        <div class="p-4 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-xl text-center text-xs text-emerald-700 dark:text-emerald-300">
          ✅ Tidak ada indikasi Alfa berlebih atau penurunan nilai di bawah standar KKM.
        </div>
      `;
    } else {
      container.innerHTML = html;
    }
  },

  async panggilOrtuViaWA(namaSiswa, noWa, alfaCount) {
    const msg = `*SURAT PERINGATAN KETERTIBAN SIAKAD*\n\nYth. Orang Tua / Wali dari *${namaSiswa}*,\nAnanda tercatat tidak mengikuti jam pelajaran (*ALFA*) sebanyak *${alfaCount} kali* berdasarkan catatan guru pengampu mata pelajaran.\n\nMohon kehadiran Bapak/Ibu ke sekolah menemui Guru BK untuk koordinasi pembinaan siswa.\n\nTerima kasih,\n_Tim Ketertiban SMA_`;
    try {
      const res = await fetch('/api/wa/send-test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target: noWa, message: msg })
      });
      const json = await res.json();
      if (json.success) {
        this.showToast(`Panggilan konseling WhatsApp dikirim ke orang tua ${namaSiswa}!`, 'success');
      }
    } catch (e) {
      this.showToast('Gagal kirim WA: ' + e.message, 'error');
    }
  },

  // ==========================================
  // VIEW 2: FITUR 1: ABSENSI GURU (SIDIK JARI)
  // ==========================================
  async loadPresensiGuruView() {
    this.populateGuruFingerprintSelect();
    this.loadPresensiGuruToday();
  },

  populateGuruFingerprintSelect() {
    const sel = document.getElementById('guru-fingerprint-select');
    if (!sel) return;

    sel.innerHTML = this.cachedTeachers.map(g => {
      const isSelected = this.currentUser?.detail?.id === g.id;
      return `<option value="${g.id}" ${isSelected ? 'selected' : ''}>${g.nama} (NIP: ${g.nip})</option>`;
    }).join('');
  },

  handleGuruFingerprintSelectChange() {
    const statusText = document.getElementById('fingerprint-status-text');
    if (statusText) statusText.textContent = 'Sensor Siap - Sentuh Sensor untuk Memindai';
  },

  setFingerprintClockType(type) {
    this.fingerprintClockType = type;
    const btnMasuk = document.getElementById('btn-fp-masuk');
    const btnPulang = document.getElementById('btn-fp-pulang');
    const clockBadge = document.getElementById('fingerprint-clock-type');

    if (type === 'masuk') {
      btnMasuk.className = 'flex-1 py-2 rounded-xl text-xs font-bold transition-all bg-emerald-600 text-white shadow-md shadow-emerald-600/30';
      btnPulang.className = 'flex-1 py-2 rounded-xl text-xs font-bold transition-all bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300';
      if (clockBadge) clockBadge.textContent = 'Masuk';
    } else {
      btnPulang.className = 'flex-1 py-2 rounded-xl text-xs font-bold transition-all bg-indigo-600 text-white shadow-md shadow-indigo-600/30';
      btnMasuk.className = 'flex-1 py-2 rounded-xl text-xs font-bold transition-all bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300';
      if (clockBadge) clockBadge.textContent = 'Pulang';
    }
  },

  async triggerFingerprintScan() {
    const pad = document.getElementById('fingerprint-pad');
    const statusText = document.getElementById('fingerprint-status-text');
    const guruSelect = document.getElementById('guru-fingerprint-select');
    const guruId = guruSelect?.value;

    if (!guruId) {
      this.showToast('Pilih guru terlebih dahulu!', 'warning');
      return;
    }

    // Biometric scanning animation
    pad.classList.add('scanning');
    statusText.textContent = '🔍 Memindai Alur Sidik Jari Biometrik...';

    setTimeout(async () => {
      statusText.textContent = '⚡ Mencocokkan Minutiae Template Sidik Jari...';

      try {
        const res = await fetch('/api/presensi-guru/fingerprint', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            guru_id: parseInt(guruId),
            tipe_clock: this.fingerprintClockType,
            fingerprint_code: 'FP-SIMULATED-SUCCESS'
          })
        });
        const json = await res.json();

        pad.classList.remove('scanning');

        if (json.success) {
          statusText.textContent = `✅ Terverifikasi (Match 99.8%) - Jam: ${json.jam_masuk || json.jam_pulang} WIB`;
          this.showToast(json.message, 'success');
          this.loadPresensiGuruToday();
        } else {
          statusText.textContent = `❌ ${json.message}`;
          this.showToast(json.message, 'error');
        }
      } catch (err) {
        pad.classList.remove('scanning');
        statusText.textContent = '❌ Gagal memproses sensor sidik jari.';
        this.showToast('Gagal memproses sidik jari: ' + err.message, 'error');
      }
    }, 1200);
  },

  async loadPresensiGuruToday() {
    const tbody = document.getElementById('presensi-guru-tbody');
    if (!tbody) return;

    try {
      const res = await fetch('/api/presensi-guru/today');
      const json = await res.json();

      if (!json.success || json.data.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" class="p-4 text-center text-slate-400">Belum ada guru yang melakukan presensi sidik jari hari ini.</td></tr>`;
        return;
      }

      tbody.innerHTML = json.data.map(item => `
        <tr class="border-b border-slate-100 dark:border-slate-800 text-xs">
          <td class="p-3 font-semibold text-slate-800 dark:text-white">
            ${item.nama_guru}
            <div class="text-[10px] text-slate-400 font-mono">NIP: ${item.nip}</div>
          </td>
          <td class="p-3 font-mono font-bold text-emerald-600 dark:text-emerald-400">${item.jam_masuk} WIB</td>
          <td class="p-3 font-mono text-slate-500">${item.jam_pulang ? item.jam_pulang + ' WIB' : '<span class="text-slate-400 italic">Belum Pulang</span>'}</td>
          <td class="p-3">
            <span class="inline-flex items-center gap-1 text-[11px] font-semibold text-sky-500">
              <span>☝️</span> ${item.metode_verifikasi}
            </span>
          </td>
          <td class="p-3">
            <span class="px-2 py-0.5 rounded text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
              ${item.status}
            </span>
          </td>
        </tr>
      `).join('');
    } catch (e) {
      console.warn('Load guru attendance error:', e);
    }
  },

  // ==========================================
  // VIEW 3: FITUR 2: ABSENSI SISWA MANUAL OLEH GURU MAPEL
  // ==========================================
  async loadPresensiSiswaView() {
    this.populateMapelSelectForAttendance();
    const todayInput = document.getElementById('manual-absen-tanggal');
    if (todayInput && !todayInput.value) {
      todayInput.value = new Date().toISOString().split('T')[0];
    }
    this.loadManualAttendanceSheet();
  },

  populateMapelSelectForAttendance() {
    const sel = document.getElementById('manual-absen-mapel');
    if (!sel) return;

    sel.innerHTML = this.cachedMapel.map(m => `
      <option value="${m.id}">${m.nama_mapel} (${m.kode_mapel})</option>
    `).join('');
  },

  async loadManualAttendanceSheet() {
    const kelasId = document.getElementById('manual-absen-kelas')?.value || 1;
    const mapelId = document.getElementById('manual-absen-mapel')?.value || 1;
    const tanggal = document.getElementById('manual-absen-tanggal')?.value || new Date().toISOString().split('T')[0];
    const tbody = document.getElementById('manual-students-tbody');

    if (!tbody) return;

    try {
      const res = await fetch(`/api/presensi-siswa/kelas-sheet?kelas_id=${kelasId}&mapel_id=${mapelId}&tanggal=${tanggal}`);
      const json = await res.json();

      if (!json.success || json.data.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" class="p-4 text-center text-slate-400">Tidak ada siswa terdaftar di kelas ini.</td></tr>`;
        return;
      }

      tbody.innerHTML = json.data.map((s, idx) => {
        const currentStatus = s.status || 'Hadir';
        return `
          <tr class="border-b border-slate-100 dark:border-slate-800 text-xs hover:bg-slate-50/50 dark:hover:bg-slate-800/30" data-siswa-id="${s.id}">
            <td class="p-3 text-center text-slate-400 font-mono">${idx + 1}</td>
            <td class="p-3 font-mono font-semibold">${s.nis}</td>
            <td class="p-3 font-semibold text-slate-800 dark:text-white">
              ${s.nama}
              <div class="text-[10px] text-slate-400">Ortu: ${s.no_wa_ortu}</div>
            </td>
            <td class="p-3 text-center">
              <div class="inline-flex items-center gap-1.5 status-pill-radio">
                <input type="radio" id="rad-h-${s.id}" name="status_${s.id}" value="Hadir" ${currentStatus === 'Hadir' ? 'checked' : ''} onchange="App.recalculateAttendanceCounters()" class="hidden" />
                <label for="rad-h-${s.id}" class="pill-hadir px-3 py-1 rounded-lg border border-slate-300 dark:border-slate-700 font-bold cursor-pointer text-xs transition-all">
                  Hadir
                </label>

                <input type="radio" id="rad-i-${s.id}" name="status_${s.id}" value="Izin" ${currentStatus === 'Izin' ? 'checked' : ''} onchange="App.recalculateAttendanceCounters()" class="hidden" />
                <label for="rad-i-${s.id}" class="pill-izin px-3 py-1 rounded-lg border border-slate-300 dark:border-slate-700 font-bold cursor-pointer text-xs transition-all">
                  Izin
                </label>

                <input type="radio" id="rad-s-${s.id}" name="status_${s.id}" value="Sakit" ${currentStatus === 'Sakit' ? 'checked' : ''} onchange="App.recalculateAttendanceCounters()" class="hidden" />
                <label for="rad-s-${s.id}" class="pill-sakit px-3 py-1 rounded-lg border border-slate-300 dark:border-slate-700 font-bold cursor-pointer text-xs transition-all">
                  Sakit
                </label>

                <input type="radio" id="rad-a-${s.id}" name="status_${s.id}" value="Alfa" ${currentStatus === 'Alfa' ? 'checked' : ''} onchange="App.recalculateAttendanceCounters()" class="hidden" />
                <label for="rad-a-${s.id}" class="pill-alfa px-3 py-1 rounded-lg border border-slate-300 dark:border-slate-700 font-bold cursor-pointer text-xs transition-all">
                  Alfa
                </label>
              </div>
            </td>
            <td class="p-3">
              <input type="text" id="keterangan_${s.id}" value="${s.keterangan || ''}" placeholder="Catatan guru jika izin/sakit..." class="w-full px-2.5 py-1 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800" />
            </td>
          </tr>
        `;
      }).join('');

      this.recalculateAttendanceCounters();
    } catch (e) {
      console.warn('Load manual attendance failed:', e);
    }
  },

  markAllStudentsAsHadir() {
    const tbody = document.getElementById('manual-students-tbody');
    if (!tbody) return;

    const rows = tbody.querySelectorAll('tr[data-siswa-id]');
    rows.forEach(row => {
      const hadirRadio = row.querySelector('input[value="Hadir"]');
      if (hadirRadio) hadirRadio.checked = true;
    });

    this.recalculateAttendanceCounters();
    this.showToast('Semua siswa ditandai HADIR. Silakan sesuaikan siswa yang Izin/Sakit/Alfa.', 'info');
  },

  recalculateAttendanceCounters() {
    const tbody = document.getElementById('manual-students-tbody');
    if (!tbody) return;

    let hadir = 0, izin = 0, sakit = 0, alfa = 0;
    const rows = tbody.querySelectorAll('tr[data-siswa-id]');

    rows.forEach(row => {
      const checked = row.querySelector('input[type="radio"]:checked');
      if (checked) {
        if (checked.value === 'Hadir') hadir++;
        else if (checked.value === 'Izin') izin++;
        else if (checked.value === 'Sakit') sakit++;
        else if (checked.value === 'Alfa') alfa++;
      }
    });

    document.getElementById('counter-hadir').textContent = hadir;
    document.getElementById('counter-izin').textContent = izin;
    document.getElementById('counter-sakit').textContent = sakit;
    document.getElementById('counter-alfa').textContent = alfa;
  },

  async handleSaveManualAttendance() {
    const kelasId = document.getElementById('manual-absen-kelas').value;
    const mapelId = document.getElementById('manual-absen-mapel').value;
    const tanggal = document.getElementById('manual-absen-tanggal').value;
    const tbody = document.getElementById('manual-students-tbody');
    const btn = document.getElementById('btn-save-manual-attendance');

    const rows = tbody.querySelectorAll('tr[data-siswa-id]');
    if (rows.length === 0) return;

    const attendanceList = [];
    rows.forEach(row => {
      const siswaId = row.getAttribute('data-siswa-id');
      const statusInput = row.querySelector('input[type="radio"]:checked');
      const ketInput = row.querySelector(`#keterangan_${siswaId}`);
      attendanceList.push({
        siswa_id: parseInt(siswaId),
        status: statusInput ? statusInput.value : 'Hadir',
        keterangan: ketInput ? ketInput.value : ''
      });
    });

    btn.disabled = true;
    btn.innerHTML = `<span>⏳ Menyimpan & Memicu Notifikasi WA...</span>`;

    try {
      const res = await fetch('/api/presensi-siswa/batch-save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kelas_id: parseInt(kelasId),
          mapel_id: parseInt(mapelId),
          guru_id: this.currentUser?.detail?.id || 1,
          tanggal: tanggal,
          attendance_list: attendanceList
        })
      });
      const json = await res.json();

      if (json.success) {
        this.showToast(json.message, 'success');
      } else {
        this.showToast(json.message, 'error');
      }
    } catch (e) {
      this.showToast('Gagal menyimpan presensi: ' + e.message, 'error');
    } finally {
      btn.disabled = false;
      btn.innerHTML = `<span>💾 Simpan Presensi & Kirim Notifikasi WA</span>`;
    }
  },

  // ==========================================
  // VIEW 4: RIWAYAT PRESENSI SISWA
  // ==========================================
  async loadRiwayatSiswaView() {
    const tbody = document.getElementById('riwayat-siswa-tbody');
    if (!tbody) return;

    const siswaId = this.currentUser?.detail?.id || 1;

    try {
      const res = await fetch(`/api/presensi/history?siswa_id=${siswaId}`);
      const json = await res.json();

      if (!json.success || json.data.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" class="p-4 text-center text-slate-400">Belum ada catatan presensi dari guru mata pelajaran.</td></tr>`;
        return;
      }

      const badgeColors = {
        Hadir: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300',
        Izin: 'bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300',
        Sakit: 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300',
        Alfa: 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300'
      };

      tbody.innerHTML = json.data.map(p => `
        <tr class="border-b border-slate-100 dark:border-slate-800 text-xs">
          <td class="p-3 font-semibold text-slate-700 dark:text-slate-300">${p.tanggal}</td>
          <td class="p-3 font-semibold text-indigo-600 dark:text-indigo-400">${p.nama_mapel || 'Pelajaran Umum'}</td>
          <td class="p-3 text-slate-600 dark:text-slate-300">${p.nama_guru_pengampu || '-'}</td>
          <td class="p-3 font-mono text-slate-500">${p.jam_masuk} WIB</td>
          <td class="p-3">
            <span class="px-2.5 py-0.5 rounded-full font-bold ${badgeColors[p.status] || ''}">
              ${p.status}
            </span>
          </td>
          <td class="p-3 text-slate-500">${p.keterangan || '-'}</td>
        </tr>
      `).join('');
    } catch (e) {
      console.warn('Riwayat siswa error:', e);
    }
  },

  // ==========================================
  // VIEW 5: GURU PIKET
  // ==========================================
  async loadPiketView() {
    this.populateSiswaSelect('piket-siswa-select');
    this.loadPiketHistoryTable();
  },

  async populateSiswaSelect(selectId) {
    const sel = document.getElementById(selectId);
    if (!sel) return;

    try {
      const res = await fetch('/api/master/siswa');
      const json = await res.json();
      if (json.success) {
        sel.innerHTML = `<option value="">-- Pilih Siswa --</option>` + json.data.map(s => `
          <option value="${s.id}">${s.nama} (${s.nama_kelas} - NIS: ${s.nis})</option>
        `).join('');
      }
    } catch (e) {
      console.warn('Populate siswa failed:', e);
    }
  },

  async handleGuruPiketSubmit() {
    const siswaId = document.getElementById('piket-siswa-select').value;
    const status = document.getElementById('piket-status-select').value;
    const tanggal = document.getElementById('piket-tanggal-input').value;
    const keterangan = document.getElementById('piket-keterangan-input').value;

    if (!siswaId || !status) {
      this.showToast('Pilih siswa dan status kehadiran!', 'warning');
      return;
    }

    try {
      const res = await fetch('/api/presensi/guru-piket-entry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          siswa_id: siswaId,
          status: status,
          tanggal: tanggal,
          keterangan: keterangan,
          guru_piket_id: this.currentUser?.detail?.id || 2
        })
      });
      const json = await res.json();
      if (json.success) {
        this.showToast(json.message, 'success');
        document.getElementById('piket-keterangan-input').value = '';
        this.loadPiketHistoryTable();
      } else {
        this.showToast(json.message, 'error');
      }
    } catch (e) {
      this.showToast('Gagal memproses validasi piket: ' + e.message, 'error');
    }
  },

  async loadPiketHistoryTable() {
    const tbody = document.getElementById('piket-history-tbody');
    if (!tbody) return;

    try {
      const [resIzin, resSakit] = await Promise.all([
        fetch('/api/presensi/history?status=Izin'),
        fetch('/api/presensi/history?status=Sakit')
      ]);
      const [jsonIzin, jsonSakit] = await Promise.all([resIzin.json(), resSakit.json()]);

      const combined = [...(jsonIzin.data || []), ...(jsonSakit.data || [])];
      combined.sort((a, b) => b.tanggal.localeCompare(a.tanggal));

      if (combined.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" class="p-4 text-center text-slate-400">Belum ada pengajuan izin/sakit yang dicatat.</td></tr>`;
        return;
      }

      tbody.innerHTML = combined.map(p => `
        <tr class="border-b border-slate-100 dark:border-slate-800 text-xs">
          <td class="p-3 font-semibold text-slate-800 dark:text-white">${p.nama_siswa} (${p.nama_kelas})</td>
          <td class="p-3 text-slate-500">${p.tanggal}</td>
          <td class="p-3">
            <span class="px-2 py-0.5 rounded text-xs font-semibold ${
              p.status === 'Sakit' ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300' : 'bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300'
            }">${p.status}</span>
          </td>
          <td class="p-3 text-slate-500">${p.keterangan || '-'}</td>
          <td class="p-3 text-emerald-600 dark:text-emerald-400 font-semibold">Tervalidasi & WA Terkirim</td>
        </tr>
      `).join('');
    } catch (e) {
      console.warn('Piket history failed:', e);
    }
  },

  // ==========================================
  // VIEW 6: PORTAL ORANG TUA
  // ==========================================
  async loadPortalOrtuView() {
    const anakId = 1; // Dimas Aditya
    try {
      const resToday = await fetch(`/api/presensi/status-today?siswa_id=${anakId}`);
      const jsonToday = await resToday.json();
      const statusContainer = document.getElementById('ortu-today-presence-card');

      if (statusContainer) {
        if (jsonToday.hasPresensi) {
          const p = jsonToday.data;
          statusContainer.innerHTML = `
            <div class="flex items-center gap-4">
              <div class="w-14 h-14 rounded-2xl bg-indigo-600/20 text-indigo-500 flex items-center justify-center font-black text-xl border-2 border-indigo-500">
                DA
              </div>
              <div>
                <div class="flex items-center gap-2">
                  <h3 class="font-bold text-lg text-slate-900 dark:text-white">Dimas Aditya (Kelas XII-1)</h3>
                  <span class="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-500 text-white">${p.status}</span>
                </div>
                <p class="text-xs text-slate-500 dark:text-slate-400">Pelajaran: <strong class="text-slate-700 dark:text-slate-200">${p.nama_mapel || 'Matematika Peminatan'}</strong> (Guru: ${p.nama_guru || 'Drs. Bambang Suryono'})</p>
                <p class="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Waktu Dicatat: <span class="font-mono text-emerald-600 dark:text-emerald-400 font-semibold">${p.jam_masuk} WIB</span> • Catatan: ${p.keterangan || 'Hadir aktif di kelas'}</p>
              </div>
            </div>
          `;
        } else {
          statusContainer.innerHTML = `
            <div class="p-4 bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-300 rounded-xl text-xs flex items-center gap-2">
              <span>🕒</span>
              <span>Guru mata pelajaran belum menginput absensi untuk jam pelajaran hari ini. Notifikasi otomatis masuk ke WhatsApp Anda jika anak tidak hadir/izin.</span>
            </div>
          `;
        }
      }

      // Load WA Logs
      const resWa = await fetch('/api/wa/logs');
      const jsonWa = await resWa.json();
      const waLogList = document.getElementById('ortu-wa-feed-list');

      if (waLogList && jsonWa.success) {
        waLogList.innerHTML = jsonWa.data.slice(0, 10).map(log => `
          <div class="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 flex items-start gap-3 text-xs">
            <span class="text-xl">💬</span>
            <div class="flex-1">
              <div class="flex items-center justify-between">
                <span class="font-semibold text-slate-800 dark:text-white">Pemberitahuan Resmi Sekolah</span>
                <span class="text-[10px] text-slate-400 font-mono">${log.created_at}</span>
              </div>
              <p class="mt-1 text-slate-600 dark:text-slate-300 whitespace-pre-line">${log.pesan}</p>
            </div>
          </div>
        `).join('');
      }

      // Load Academic Progression Chart
      const resGrades = await fetch(`/api/nilai/progression?siswa_id=${anakId}`);
      const jsonGrades = await resGrades.json();
      if (jsonGrades.success) {
        ChartEngine.initAcademicChart('chart-ortu-academic', jsonGrades.data);
      }
    } catch (e) {
      console.error('Failed to load parent portal:', e);
    }
  },

  // ==========================================
  // VIEW 7: E-LEARNING MINI
  // ==========================================
  async loadElearningView() {
    this.populateMapelSelect('elearning-mapel-filter');
    this.fetchElearningItems();
  },

  async populateMapelSelect(selectId) {
    const sel = document.getElementById(selectId);
    if (!sel) return;

    sel.innerHTML = `<option value="">-- Semua Mata Pelajaran --</option>` + this.cachedMapel.map(m => `
      <option value="${m.id}">${m.nama_mapel} (${m.kode_mapel})</option>
    `).join('');
  },

  async fetchElearningItems() {
    const mapelId = document.getElementById('elearning-mapel-filter')?.value || '';
    const container = document.getElementById('elearning-cards-container');
    if (!container) return;

    try {
      const url = mapelId ? `/api/elearning/list?mapel_id=${mapelId}` : '/api/elearning/list';
      const res = await fetch(url);
      const json = await res.json();

      if (!json.success || json.data.length === 0) {
        container.innerHTML = `<div class="col-span-full p-8 text-center text-slate-400">Belum ada materi atau tugas yang diterbitkan.</div>`;
        return;
      }

      container.innerHTML = json.data.map(item => {
        const isTugas = item.tipe === 'Tugas';
        const typeBadge = isTugas
          ? `<span class="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/30">📝 Tugas Online</span>`
          : `<span class="px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 border border-indigo-500/30">📖 Modul Materi</span>`;

        return `
          <div class="glass-panel p-5 rounded-2xl flex flex-col justify-between transition-all hover:shadow-xl hover:border-indigo-500/40">
            <div>
              <div class="flex items-center justify-between gap-2 mb-3">
                ${typeBadge}
                <span class="text-xs text-slate-400">${item.nama_kelas}</span>
              </div>
              <h3 class="font-bold text-base text-slate-900 dark:text-white mb-1">${item.judul}</h3>
              <p class="text-xs font-semibold text-indigo-600 dark:text-indigo-400 mb-2">${item.nama_mapel} • ${item.nama_guru}</p>
              <p class="text-xs text-slate-600 dark:text-slate-300 leading-relaxed mb-4 line-clamp-3">${item.deskripsi || ''}</p>
            </div>

            <div class="pt-4 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between">
              <span class="text-xs text-slate-400">${item.deadline ? 'Deadline: ' + item.deadline : 'Materi Terbuka'}</span>
              ${isTugas ? `<button onclick="App.openSubmissionsReviewModal(${item.id}, '${item.judul}')" class="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold shadow-md shadow-indigo-600/30">Periksa (${item.submission_count || 0})</button>` : ''}
            </div>
          </div>
        `;
      }).join('');
    } catch (e) {
      console.error('Fetch elearning failed:', e);
    }
  },

  openCreateMateriModal() {
    this.populateMapelSelect('modal-materi-mapel');
    const modal = document.getElementById('modal-create-materi');
    if (modal) {
      modal.classList.remove('hidden');
      modal.classList.add('flex');
    }
  },

  closeCreateMateriModal() {
    const modal = document.getElementById('modal-create-materi');
    if (modal) {
      modal.classList.add('hidden');
      modal.classList.remove('flex');
    }
  },

  async handleCreateMateriSubmit(e) {
    e.preventDefault();
    const tipe = document.getElementById('modal-materi-tipe').value;
    const mapelId = document.getElementById('modal-materi-mapel').value;
    const judul = document.getElementById('modal-materi-judul').value;
    const deskripsi = document.getElementById('modal-materi-deskripsi').value;
    const deadline = document.getElementById('modal-materi-deadline').value;

    try {
      const res = await fetch('/api/elearning/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tipe,
          mapel_id: mapelId,
          kelas_id: 1,
          guru_id: 1,
          judul,
          deskripsi,
          deadline: deadline || null
        })
      });
      const json = await res.json();
      if (json.success) {
        this.showToast(json.message, 'success');
        this.closeCreateMateriModal();
        this.fetchElearningItems();
      }
    } catch (err) {
      this.showToast('Gagal mempublikasikan materi: ' + err.message, 'error');
    }
  },

  async openSubmissionsReviewModal(tugasId, judulTugas) {
    document.getElementById('review-tugas-title').textContent = judulTugas;
    const tbody = document.getElementById('review-submissions-tbody');
    const modal = document.getElementById('modal-review-submissions');

    if (modal) {
      modal.classList.remove('hidden');
      modal.classList.add('flex');
    }

    try {
      const res = await fetch(`/api/elearning/submissions/${tugasId}`);
      const json = await res.json();

      if (!json.success || json.data.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" class="p-4 text-center text-slate-400">Belum ada siswa yang mengumpulkan tugas ini.</td></tr>`;
        return;
      }

      tbody.innerHTML = json.data.map(sub => `
        <tr class="border-b border-slate-100 dark:border-slate-800 text-xs">
          <td class="p-3 font-semibold text-slate-800 dark:text-white">${sub.nama_siswa} (${sub.nama_kelas})</td>
          <td class="p-3 text-slate-500">${sub.waktu_kirim}</td>
          <td class="p-3">
            <span class="text-indigo-600 dark:text-indigo-400 underline cursor-pointer">Lihat Lembar Jawaban</span>
          </td>
          <td class="p-3">
            <input type="number" id="grade-sub-${sub.id}" value="${sub.nilai || ''}" placeholder="0-100" class="w-20 px-2 py-1 text-center rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-bold" />
          </td>
          <td class="p-3">
            <button onclick="App.saveSubmissionGrade(${sub.id})" class="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded font-semibold text-xs">
              Simpan
            </button>
          </td>
        </tr>
      `).join('');
    } catch (e) {
      console.warn('Review submissions failed:', e);
    }
  },

  async saveSubmissionGrade(subId) {
    const val = document.getElementById(`grade-sub-${subId}`).value;
    try {
      const res = await fetch('/api/elearning/grade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          submission_id: subId,
          nilai: val,
          catatan_guru: 'Telah dinilai oleh guru pengampu.'
        })
      });
      const json = await res.json();
      if (json.success) {
        this.showToast(json.message, 'success');
      }
    } catch (e) {
      this.showToast('Gagal menyimpan nilai: ' + e.message, 'error');
    }
  },

  closeReviewSubmissionsModal() {
    const modal = document.getElementById('modal-review-submissions');
    if (modal) {
      modal.classList.add('hidden');
      modal.classList.remove('flex');
    }
  },

  // ==========================================
  // VIEW 8: NILAI AKADEMIK & CETAK RAPOR SISWA
  // ==========================================
  selectedRaporSiswaId: 1,
  currentStudentGrades: [],

  async loadNilaiView(targetSiswaId) {
    if (targetSiswaId) {
      this.selectedRaporSiswaId = parseInt(targetSiswaId);
    } else if (this.activeRole === 'siswa' && this.currentUser?.detail?.id) {
      this.selectedRaporSiswaId = this.currentUser.detail.id;
    }

    await this.populateRaporSiswaDropdowns();
    await this.loadSelectedStudentGrades(this.selectedRaporSiswaId);
    this.syncInputFormWithStudent(this.selectedRaporSiswaId);
    await this.loadClassAllStudentsRaporSummary();
  },

  async populateRaporSiswaDropdowns() {
    const selRapor = document.getElementById('select-siswa-rapor');
    const selInput = document.getElementById('input-nilai-siswa');
    const selMapel = document.getElementById('input-nilai-mapel');

    try {
      const res = await fetch('/api/master/siswa');
      const json = await res.json();
      if (json.success && json.data) {
        const optionsHtml = json.data.map(s => `
          <option value="${s.id}" ${s.id === this.selectedRaporSiswaId ? 'selected' : ''}>
            ${s.nama} (${s.nama_kelas} - NIS: ${s.nis})
          </option>
        `).join('');

        if (selRapor) selRapor.innerHTML = optionsHtml;
        if (selInput) selInput.innerHTML = optionsHtml;
      }

      if (selMapel) {
        if (!this.cachedMapel || this.cachedMapel.length === 0) {
          const resM = await fetch('/api/master/mapel');
          const jsonM = await resM.json();
          if (jsonM.success) this.cachedMapel = jsonM.data;
        }

        if (this.cachedMapel && this.cachedMapel.length > 0) {
          selMapel.innerHTML = this.cachedMapel.map(m => `
            <option value="${m.id}">${m.nama_mapel} (${m.kode_mapel} - KKM: ${m.kkm})</option>
          `).join('');
        }
      }
    } catch (e) {
      console.warn('Failed to populate student select:', e);
    }
  },

  handleSiswaRaporChange() {
    const sel = document.getElementById('select-siswa-rapor');
    if (sel) {
      this.selectedRaporSiswaId = parseInt(sel.value);
      const selInput = document.getElementById('input-nilai-siswa');
      if (selInput) selInput.value = this.selectedRaporSiswaId;
      this.loadSelectedStudentGrades(this.selectedRaporSiswaId);
      this.syncInputFormWithStudent(this.selectedRaporSiswaId);
    }
  },

  handleInputNilaiSelectionChange() {
    const selInput = document.getElementById('input-nilai-siswa');
    const selRapor = document.getElementById('select-siswa-rapor');
    if (selInput && selInput.value) {
      const newSiswaId = parseInt(selInput.value);
      if (newSiswaId !== this.selectedRaporSiswaId) {
        this.selectedRaporSiswaId = newSiswaId;
        if (selRapor) selRapor.value = newSiswaId;
        this.loadSelectedStudentGrades(this.selectedRaporSiswaId);
      }
    }
    this.syncInputFormWithStudent(this.selectedRaporSiswaId);
  },

  syncInputFormWithStudent(siswaId) {
    const selMapel = document.getElementById('input-nilai-mapel');
    if (!selMapel) return;
    const mapelId = parseInt(selMapel.value);

    // Look up in currentStudentGrades
    const existing = this.currentStudentGrades.find(g => g.mapel_id === mapelId);
    if (existing) {
      document.getElementById('input-nilai-tugas').value = existing.tugas || 0;
      document.getElementById('input-nilai-uh').value = existing.uh || 0;
      document.getElementById('input-nilai-uts').value = existing.uts || 0;
      document.getElementById('input-nilai-uas').value = existing.uas || 0;
      const infoLabel = document.getElementById('input-nilai-info-label');
      if (infoLabel) {
        infoLabel.innerHTML = `<span class="text-indigo-600 dark:text-indigo-400 font-semibold">ℹ️ Menampilkan nilai tersimpan untuk ${existing.nama_mapel}. Anda dapat mengubah dan menyimpan kembali.</span>`;
      }
    } else {
      document.getElementById('input-nilai-tugas').value = 85;
      document.getElementById('input-nilai-uh').value = 85;
      document.getElementById('input-nilai-uts').value = 85;
      document.getElementById('input-nilai-uas').value = 85;
      const infoLabel = document.getElementById('input-nilai-info-label');
      if (infoLabel) {
        infoLabel.innerHTML = `<span>💡 Masukkan nilai komponen lalu klik "Simpan Nilai & Perbarui Rapor".</span>`;
      }
    }
    this.calcLiveGradePreview();
  },

  calcLiveGradePreview() {
    const t = parseFloat(document.getElementById('input-nilai-tugas')?.value) || 0;
    const u = parseFloat(document.getElementById('input-nilai-uh')?.value) || 0;
    const ut = parseFloat(document.getElementById('input-nilai-uts')?.value) || 0;
    const ua = parseFloat(document.getElementById('input-nilai-uas')?.value) || 0;

    const final = Math.round((t * 0.2 + u * 0.2 + ut * 0.3 + ua * 0.3) * 10) / 10;
    const previewNilai = document.getElementById('preview-calc-nilai');
    const previewPredikat = document.getElementById('preview-calc-predikat');
    const previewStatus = document.getElementById('preview-calc-status');

    if (previewNilai) previewNilai.textContent = final;

    let predikat = 'D';
    let kkm = 75;
    const selMapel = document.getElementById('input-nilai-mapel');
    if (selMapel && this.cachedMapel) {
      const mObj = this.cachedMapel.find(m => m.id === parseInt(selMapel.value));
      if (mObj) kkm = mObj.kkm;
    }

    if (final >= 90) predikat = 'Predikat A';
    else if (final >= 80) predikat = 'Predikat B';
    else if (final >= kkm) predikat = 'Predikat C';
    else predikat = 'Predikat D';

    if (previewPredikat) {
      previewPredikat.textContent = predikat;
      if (final >= 90) {
        previewPredikat.className = 'px-2 py-0.5 rounded text-xs font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300';
      } else if (final >= 80) {
        previewPredikat.className = 'px-2 py-0.5 rounded text-xs font-bold bg-sky-100 text-sky-800 dark:bg-sky-950/60 dark:text-sky-300';
      } else if (final >= kkm) {
        previewPredikat.className = 'px-2 py-0.5 rounded text-xs font-bold bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300';
      } else {
        previewPredikat.className = 'px-2 py-0.5 rounded text-xs font-bold bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300';
      }
    }

    if (previewStatus) {
      const isLulus = final >= kkm;
      previewStatus.textContent = isLulus ? 'TUNTAS' : 'REMEDIAL';
      previewStatus.className = `px-2 py-0.5 rounded text-[10px] font-bold ${
        isLulus ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300' : 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300'
      }`;
    }
  },

  editGradeInForm(mapelId, tugas, uh, uts, uas) {
    const selMapel = document.getElementById('input-nilai-mapel');
    if (selMapel) selMapel.value = mapelId;

    document.getElementById('input-nilai-tugas').value = tugas;
    document.getElementById('input-nilai-uh').value = uh;
    document.getElementById('input-nilai-uts').value = uts;
    document.getElementById('input-nilai-uas').value = uas;

    this.calcLiveGradePreview();

    const card = document.getElementById('card-input-nilai');
    if (card) {
      card.scrollIntoView({ behavior: 'smooth', block: 'center' });
      card.classList.add('ring-4', 'ring-indigo-400');
      setTimeout(() => card.classList.remove('ring-4', 'ring-indigo-400'), 1500);
    }
    this.showToast('Data nilai dimuat ke formulir di atas!', 'info');
  },

  async loadSelectedStudentGrades(siswaId) {
    const tbody = document.getElementById('nilai-table-tbody');
    const titleEl = document.getElementById('table-student-name-title');
    const chartLabel = document.getElementById('chart-student-name-label');

    try {
      const res = await fetch(`/api/nilai?siswa_id=${siswaId}`);
      const json = await res.json();

      if (json.success) {
        this.currentStudentGrades = json.data || [];
        const studentName = json.data.length > 0 ? `${json.data[0].nama_siswa} (Kelas ${json.data[0].nama_kelas})` : 'Siswa Terpilih';
        if (titleEl) titleEl.textContent = `Rincian Nilai: ${studentName}`;
        if (chartLabel) chartLabel.textContent = `Siswa: ${studentName}`;

        if (tbody) {
          if (json.data.length === 0) {
            tbody.innerHTML = `<tr><td colspan="10" class="p-4 text-center text-slate-400">Belum ada nilai tercatat untuk siswa ini. Silakan input pada formulir di atas.</td></tr>`;
          } else {
            tbody.innerHTML = json.data.map(n => {
              const isLulus = n.nilai_akhir >= n.kkm;
              let predikat = 'D';
              if (n.nilai_akhir >= 90) predikat = 'A';
              else if (n.nilai_akhir >= 80) predikat = 'B';
              else if (n.nilai_akhir >= n.kkm) predikat = 'C';

              return `
                <tr class="border-b border-slate-100 dark:border-slate-800 text-xs hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                  <td class="p-3 font-semibold text-slate-800 dark:text-white">${n.nama_mapel}</td>
                  <td class="p-3 text-center font-mono">${n.kkm}</td>
                  <td class="p-3 text-center font-mono">${n.tugas}</td>
                  <td class="p-3 text-center font-mono">${n.uh}</td>
                  <td class="p-3 text-center font-mono">${n.uts}</td>
                  <td class="p-3 text-center font-mono">${n.uas}</td>
                  <td class="p-3 text-center font-bold text-sm font-mono ${isLulus ? 'text-indigo-600 dark:text-indigo-400' : 'text-rose-600'}">
                    ${n.nilai_akhir}
                  </td>
                  <td class="p-3 text-center font-bold">
                    <span class="px-2 py-0.5 rounded text-xs font-bold ${
                      predikat === 'A' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300' :
                      predikat === 'B' ? 'bg-sky-100 text-sky-800 dark:bg-sky-950/60 dark:text-sky-300' :
                      predikat === 'C' ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300' :
                      'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300'
                    }">
                      ${predikat}
                    </span>
                  </td>
                  <td class="p-3 text-center">
                    <span class="px-2 py-0.5 rounded text-[11px] font-bold ${
                      isLulus ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300' : 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300'
                    }">
                      ${isLulus ? 'TUNTAS' : 'REMEDIAL'}
                    </span>
                  </td>
                  <td class="p-3 text-center">
                    <button onclick="App.editGradeInForm(${n.mapel_id}, ${n.tugas}, ${n.uh}, ${n.uts}, ${n.uas})" class="px-2.5 py-1 rounded-lg text-xs font-bold bg-indigo-50 hover:bg-indigo-100 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300 dark:border-indigo-800 border border-indigo-200 transition-colors">
                      ✏️ Edit
                    </button>
                  </td>
                </tr>
              `;
            }).join('');
          }
        }

        ChartEngine.initAcademicChart('chart-academic-progression', json.data);
      }
    } catch (e) {
      console.warn('Failed to load selected student grades:', e);
    }
  },

  handleClassRaporFilterChange() {
    this.loadClassAllStudentsRaporSummary();
  },

  async loadClassAllStudentsRaporSummary() {
    const tbody = document.getElementById('rekap-rapor-semua-siswa-tbody');
    if (!tbody) return;

    const filterVal = document.getElementById('rekap-rapor-kelas-filter')?.value || '1';
    let url = '/api/master/siswa';
    if (filterVal !== 'all') {
      url += `?kelas_id=${filterVal}`;
    }

    try {
      const resS = await fetch(url);
      const jsonS = await resS.json();

      if (!jsonS.success || jsonS.data.length === 0) {
        tbody.innerHTML = `<tr><td colspan="9" class="p-4 text-center text-slate-400">Tidak ada siswa ditemukan pada kelas ini.</td></tr>`;
        return;
      }

      const rowsHtml = await Promise.all(jsonS.data.map(async (s, idx) => {
        // Fetch grades and attendance summary
        const [resG, resR] = await Promise.all([
          fetch(`/api/nilai?siswa_id=${s.id}`),
          fetch(`/api/nilai/rapor/${s.id}`)
        ]);
        const jsonG = await resG.json();
        const jsonR = await resR.json();

        const grades = jsonG.data || [];
        const presensi = jsonR.data?.presensi || { hadir: 0, sakit: 0, izin: 0, alfa: 0 };

        let avg = 0;
        let isLulus = true;
        if (grades.length > 0) {
          const sum = grades.reduce((acc, curr) => acc + (curr.nilai_akhir || 0), 0);
          avg = Math.round((sum / grades.length) * 10) / 10;
          isLulus = grades.every(g => g.nilai_akhir >= g.kkm);
        }

        let predikat = 'D';
        if (avg >= 90) predikat = 'A (Amat Baik)';
        else if (avg >= 80) predikat = 'B (Baik)';
        else if (avg >= 75) predikat = 'C (Cukup)';
        else predikat = 'D (Kurang)';

        return `
          <tr class="border-b border-slate-100 dark:border-slate-800 text-xs hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
            <td class="p-3 text-center text-slate-400 font-mono">${idx + 1}</td>
            <td class="p-3 font-mono font-semibold">${s.nis}</td>
            <td class="p-3 font-semibold text-slate-800 dark:text-white">
              ${s.nama}
            </td>
            <td class="p-3 text-slate-600 dark:text-slate-400 font-semibold">${s.nama_kelas}</td>
            <td class="p-3 text-center font-black text-sm font-mono text-indigo-600 dark:text-indigo-400">
              ${avg > 0 ? avg : '--'}
            </td>
            <td class="p-3 text-center font-bold">${predikat}</td>
            <td class="p-3 text-center font-mono text-[11px]">
              <span class="text-emerald-600 font-bold">H:${presensi.hadir}</span> • 
              <span class="text-amber-600">S:${presensi.sakit}</span> • 
              <span class="text-sky-600">I:${presensi.izin}</span> • 
              <span class="${presensi.alfa > 0 ? 'text-rose-600 font-bold' : 'text-slate-400'}">A:${presensi.alfa}</span>
            </td>
            <td class="p-3 text-center">
              <span class="px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                isLulus && avg > 0 ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300' : 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300'
              }">
                ${isLulus && avg > 0 ? 'TUNTAS' : 'PERLU REMEDIAL'}
              </span>
            </td>
            <td class="p-3 text-center">
              <button onclick="App.openRaporPrintModal(${s.id})" class="px-3.5 py-1.5 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 text-white rounded-xl text-xs font-bold shadow-md shadow-indigo-600/30 flex items-center justify-center gap-1.5 mx-auto transition-transform active:scale-95">
                <span>🖨️ Cetak Rapor</span>
              </button>
            </td>
          </tr>
        `;
      }));

      tbody.innerHTML = rowsHtml.join('');
    } catch (e) {
      console.warn('Class rapor summary failed:', e);
    }
  },

  async handleInputNilaiSubmit() {
    const siswaId = document.getElementById('input-nilai-siswa').value;
    const mapelId = document.getElementById('input-nilai-mapel').value;
    const tugas = document.getElementById('input-nilai-tugas').value;
    const uh = document.getElementById('input-nilai-uh').value;
    const uts = document.getElementById('input-nilai-uts').value;
    const uas = document.getElementById('input-nilai-uas').value;

    if (!siswaId || !mapelId) {
      this.showToast('Pilih siswa dan mata pelajaran terlebih dahulu!', 'warning');
      return;
    }

    try {
      const res = await fetch('/api/nilai/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ siswa_id: siswaId, mapel_id: mapelId, tugas, uh, uts, uas })
      });
      const json = await res.json();
      if (json.success) {
        this.showToast(json.message, 'success');
        this.selectedRaporSiswaId = parseInt(siswaId);
        const selRapor = document.getElementById('select-siswa-rapor');
        if (selRapor) selRapor.value = siswaId;
        await this.loadSelectedStudentGrades(this.selectedRaporSiswaId);
        this.syncInputFormWithStudent(this.selectedRaporSiswaId);
        await this.loadClassAllStudentsRaporSummary();
      } else {
        this.showToast(json.message, 'error');
      }
    } catch (e) {
      this.showToast('Gagal menyimpan nilai: ' + e.message, 'error');
    }
  },

  // ==========================================
  // FITUR CETAK RAPOR RESMI SMA HIDAYATUN NAJAH
  // ==========================================
  async openRaporPrintModal(siswaId) {
    const modal = document.getElementById('modal-cetak-rapor');
    if (!modal) return;

    const targetId = siswaId || this.selectedRaporSiswaId || 1;

    try {
      const res = await fetch(`/api/nilai/rapor/${targetId}`);
      const json = await res.json();

      if (!json.success || !json.data) {
        this.showToast('Gagal memuat data rapor siswa: ' + (json.message || ''), 'error');
        return;
      }

      const d = json.data;

      document.getElementById('rapor-nama-siswa').textContent = `: ${d.siswa.nama}`;
      document.getElementById('rapor-kelas').textContent = `: ${d.siswa.kelas}`;
      document.getElementById('rapor-nis').textContent = `: ${d.siswa.nis} / ${d.siswa.nisn || '-'}`;
      document.getElementById('rapor-wali-kelas').textContent = `: ${d.siswa.wali_kelas}`;
      document.getElementById('rapor-sign-kelas').textContent = d.siswa.kelas;
      document.getElementById('rapor-sign-wali').textContent = d.siswa.wali_kelas;
      document.getElementById('rapor-sign-nip-wali').textContent = `NIP: ${d.siswa.nip_wali_kelas || '-'}`;
      document.getElementById('rapor-tanggal-cetak').textContent = `Pamekasan, ${d.tanggal_cetak}`;

      if (document.getElementById('rapor-sign-kepsek')) {
        document.getElementById('rapor-sign-kepsek').textContent = d.sekolah.kepala_sekolah || 'AHMAD ANIS SUYUTI, S. Pd';
      }
      if (document.getElementById('rapor-sign-nip-kepsek')) {
        document.getElementById('rapor-sign-nip-kepsek').textContent = `NIP: ${d.sekolah.nip_kepala_sekolah || '198004122006041005'}`;
      }

      document.getElementById('rapor-absen-sakit').textContent = `${d.presensi.sakit || 0} hari`;
      document.getElementById('rapor-absen-izin').textContent = `${d.presensi.izin || 0} hari`;
      document.getElementById('rapor-absen-alfa').textContent = `${d.presensi.alfa || 0} hari`;

      const tbody = document.getElementById('rapor-nilai-tbody');
      if (tbody) {
        tbody.innerHTML = d.nilai_list.map(g => `
          <tr class="text-center">
            <td class="p-1 border border-slate-400 font-mono">${g.no}</td>
            <td class="p-1 border border-slate-400 text-left font-semibold pl-2">${g.nama_mapel}</td>
            <td class="p-1 border border-slate-400 font-mono">${g.kkm}</td>
            <td class="p-1 border border-slate-400 font-mono">${g.tugas}</td>
            <td class="p-1 border border-slate-400 font-mono">${g.uh}</td>
            <td class="p-1 border border-slate-400 font-mono">${g.uts}</td>
            <td class="p-1 border border-slate-400 font-mono">${g.uas}</td>
            <td class="p-1 border border-slate-400 font-mono font-bold ${g.nilai_akhir >= g.kkm ? 'text-indigo-700' : 'text-rose-600'}">${g.nilai_akhir}</td>
            <td class="p-1 border border-slate-400 font-bold">${g.predikat}</td>
            <td class="p-1 border border-slate-400 text-left pl-2 text-[10px] leading-tight">${g.deskripsi}</td>
          </tr>
        `).join('');
      }

      document.getElementById('rapor-total-rata').textContent = `Total: ${d.statistik.total_nilai} | Rata-Rata: ${d.statistik.rata_rata}`;
      document.getElementById('rapor-predikat-umum').textContent = `Predikat: ${d.statistik.predikat_umum}`;

      const statusEl = document.getElementById('rapor-status-umum');
      const isSemuaTuntas = d.nilai_list.every(g => g.nilai_akhir >= g.kkm);
      if (statusEl) {
        if (isSemuaTuntas && d.statistik.rata_rata >= 75) {
          statusEl.textContent = 'Status: TUNTAS (MEMENUHI KRITERIA KELULUSAN)';
          statusEl.className = 'p-1.5 border border-slate-400 text-left pl-2 font-bold text-emerald-700';
        } else {
          statusEl.textContent = 'Status: PERLU PEMBINAAN & REMEDIAL';
          statusEl.className = 'p-1.5 border border-slate-400 text-left pl-2 font-bold text-rose-700';
        }
      }

      // Dynamic Wali Kelas note based on student achievement
      const catatanEl = document.getElementById('rapor-catatan-wali');
      if (catatanEl) {
        if (d.statistik.rata_rata >= 90) {
          catatanEl.textContent = `Ananda ${d.siswa.nama} menunjukkan capaian prestasi akademik yang amat luar biasa dan istimewa (peringkat atas kelas) serta memiliki budi pekerti yang luhur dan kedisiplinan prima. Pertahankan konsistensi belajar untuk persiapan ke perguruan tinggi unggulan impian.`;
        } else if (d.statistik.rata_rata >= 80) {
          catatanEl.textContent = `Ananda ${d.siswa.nama} menunjukkan ketekunan, integritas akhlak karimah, serta partisipasi yang sangat aktif dalam pembelajaran. Pertahankan semangat belajar dan terus tingkatkan pemahaman pada mata pelajaran analitis.`;
        } else if (d.statistik.rata_rata >= 75) {
          catatanEl.textContent = `Ananda ${d.siswa.nama} telah mencapai standar kriteria ketuntasan dengan baik. Perbanyak latihan soal mandiri dan aktif berdiskusi dalam kelompok belajar agar capaian nilai semester berikutnya semakin meningkat.`;
        } else {
          catatanEl.textContent = `Ananda ${d.siswa.nama} perlu meningkatkan ketekunan belajar dan kedisiplinan kehadiran di sekolah. Disarankan untuk segera berkonsultasi dengan guru mata pelajaran terkait guna mengikuti pendampingan remedial intensif.`;
        }
      }

      modal.classList.remove('hidden');
      modal.classList.add('flex');
    } catch (e) {
      this.showToast('Gagal memuat berkas rapor: ' + e.message, 'error');
    }
  },

  closeRaporPrintModal() {
    const modal = document.getElementById('modal-cetak-rapor');
    if (modal) {
      modal.classList.add('hidden');
      modal.classList.remove('flex');
    }
  },

  // ==========================================
  // VIEW 9: WHATSAPP REAL-TIME GATEWAY
  // ==========================================
  async loadWaGatewayView() {
    this.loadWaLogs();
  },

  async loadWaLogs() {
    const tbody = document.getElementById('wa-logs-tbody');
    const phoneChatContainer = document.getElementById('phone-simulator-messages');
    if (!tbody) return;

    try {
      const res = await fetch('/api/wa/logs');
      const json = await res.json();

      if (!json.success || json.data.length === 0) {
        tbody.innerHTML = `<tr><td colspan="4" class="p-4 text-center text-slate-400">Belum ada riwayat pesan WhatsApp.</td></tr>`;
        return;
      }

      tbody.innerHTML = json.data.map(log => {
        const isSent = log.status_kirim === 'Sent';
        return `
          <tr class="border-b border-slate-100 dark:border-slate-800 text-xs">
            <td class="p-3 font-mono text-slate-600 dark:text-slate-400">${log.created_at}</td>
            <td class="p-3 font-mono font-semibold text-slate-800 dark:text-white">${log.penerima_wa}</td>
            <td class="p-3 text-slate-600 dark:text-slate-300 max-w-sm whitespace-pre-line">${log.pesan}</td>
            <td class="p-3">
              <span class="px-2 py-0.5 rounded text-xs font-semibold ${
                isSent ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300' : 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300'
              }">
                ${log.status_kirim}
              </span>
            </td>
          </tr>
        `;
      }).join('');

      if (phoneChatContainer) {
        phoneChatContainer.innerHTML = json.data.slice(0, 5).reverse().map(log => `
          <div class="wa-bubble-received p-3 text-xs mb-3 shadow">
            <p class="whitespace-pre-line leading-relaxed">${log.pesan}</p>
            <div class="text-[10px] text-slate-400 text-right mt-1 font-mono">${log.created_at.split(' ')[1] || ''} ✓✓</div>
          </div>
        `).join('');
      }
    } catch (e) {
      console.warn('WA logs failed:', e);
    }
  },

  async handleBroadcastSubmit(e) {
    e.preventDefault();
    const kelasId = document.getElementById('broadcast-kelas-select').value;
    const tipe = document.getElementById('broadcast-tipe-select').value;
    const pesan = document.getElementById('broadcast-pesan-textarea').value;
    const btn = document.getElementById('btn-broadcast-submit');

    if (!kelasId || !pesan) {
      this.showToast('Kelas dan isi pesan wajib diisi!', 'warning');
      return;
    }

    btn.disabled = true;
    btn.innerHTML = `<span>⏳ Mengirim Broadcast Berantai...</span>`;

    try {
      const res = await fetch('/api/wa/broadcast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kelas_id: kelasId, tipe, isi_pesan: pesan })
      });
      const json = await res.json();
      if (json.success) {
        this.showToast(json.message, 'success');
        document.getElementById('broadcast-pesan-textarea').value = '';
        this.loadWaLogs();
      } else {
        this.showToast(json.message, 'error');
      }
    } catch (err) {
      this.showToast('Gagal kirim broadcast: ' + err.message, 'error');
    } finally {
      btn.disabled = false;
      btn.innerHTML = `<span>🚀 Kirim Broadcast Sekarang</span>`;
    }
  },

  async handleSendTestWa() {
    const target = document.getElementById('wa-test-target').value;
    const msg = document.getElementById('wa-test-message').value;

    try {
      const res = await fetch('/api/wa/send-test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target, message: msg })
      });
      const json = await res.json();
      if (json.success) {
        this.showToast('Pesan WhatsApp tes terkirim!', 'success');
        this.loadWaLogs();
      }
    } catch (e) {
      this.showToast('Gagal tes WA: ' + e.message, 'error');
    }
  },

  // ==========================================
  // VIEW 10: MASTER DATA
  // ==========================================
  async loadMasterView() {
    const tbodyS = document.getElementById('master-siswa-tbody');
    const tbodyG = document.getElementById('master-guru-tbody');

    try {
      const [resS, resG] = await Promise.all([
        fetch('/api/master/siswa'),
        fetch('/api/master/guru')
      ]);
      const [jsonS, jsonG] = await Promise.all([resS.json(), resG.json()]);

      if (tbodyS && jsonS.success) {
        tbodyS.innerHTML = jsonS.data.map(s => `
          <tr class="border-b border-slate-100 dark:border-slate-800 text-xs">
            <td class="p-2.5 font-mono">${s.nis}</td>
            <td class="p-2.5 font-semibold text-slate-800 dark:text-white">${s.nama}</td>
            <td class="p-2.5">${s.nama_kelas}</td>
            <td class="p-2.5 font-mono">${s.no_wa_ortu}</td>
          </tr>
        `).join('');
      }

      if (tbodyG && jsonG.success) {
        tbodyG.innerHTML = jsonG.data.map(g => `
          <tr class="border-b border-slate-100 dark:border-slate-800 text-xs">
            <td class="p-2.5 font-mono">${g.nip}</td>
            <td class="p-2.5 font-semibold text-slate-800 dark:text-white">${g.nama}</td>
            <td class="p-2.5">
              <span class="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-500">
                <span>✓</span> Terdaftar (500 DPI)
              </span>
            </td>
            <td class="p-2.5 text-slate-500">${g.is_piket ? 'Guru Piket' : 'Guru Mapel'}</td>
          </tr>
        `).join('');
      }
    } catch (e) {
      console.warn('Master error:', e);
    }
  },

  // ==========================================
  // MODAL TAMBAH DATA SISWA & GURU BARU
  // ==========================================
  openModalTambahSiswa() {
    const m = document.getElementById('modal-tambah-siswa');
    if (m) {
      m.classList.remove('hidden');
      m.classList.add('flex');
    }
  },

  closeModalTambahSiswa() {
    const m = document.getElementById('modal-tambah-siswa');
    if (m) {
      m.classList.add('hidden');
      m.classList.remove('flex');
    }
  },

  async submitTambahSiswa(e) {
    e.preventDefault();
    const nis = document.getElementById('add-siswa-nis').value.trim();
    const nisn = document.getElementById('add-siswa-nisn').value.trim();
    const nama = document.getElementById('add-siswa-nama').value.trim();
    const kelas_id = document.getElementById('add-siswa-kelas').value;
    const no_wa_ortu = document.getElementById('add-siswa-wa').value.trim();
    const username = document.getElementById('add-siswa-username').value.trim();
    const password = document.getElementById('add-siswa-password').value.trim();

    try {
      const res = await fetch('/api/master/siswa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nis, nisn, nama, kelas_id, no_wa_ortu, username, password })
      });
      const json = await res.json();
      if (json.success) {
        this.showToast(json.message, 'success');
        this.closeModalTambahSiswa();
        document.getElementById('add-siswa-nis').value = '';
        document.getElementById('add-siswa-nisn').value = '';
        document.getElementById('add-siswa-nama').value = '';
        document.getElementById('add-siswa-wa').value = '';
        document.getElementById('add-siswa-username').value = '';
        await this.loadMasterView();
        if (typeof this.populateRaporSiswaDropdowns === 'function') {
          await this.populateRaporSiswaDropdowns();
        }
      } else {
        this.showToast(json.message, 'error');
      }
    } catch (err) {
      this.showToast('Gagal menambah siswa: ' + err.message, 'error');
    }
  },

  openModalTambahGuru() {
    const m = document.getElementById('modal-tambah-guru');
    if (m) {
      m.classList.remove('hidden');
      m.classList.add('flex');
    }
  },

  closeModalTambahGuru() {
    const m = document.getElementById('modal-tambah-guru');
    if (m) {
      m.classList.add('hidden');
      m.classList.remove('flex');
    }
  },

  async submitTambahGuru(e) {
    e.preventDefault();
    const nip = document.getElementById('add-guru-nip').value.trim();
    const nama = document.getElementById('add-guru-nama').value.trim();
    const no_wa = document.getElementById('add-guru-wa').value.trim();
    const is_piket = parseInt(document.getElementById('add-guru-piket').value);
    const username = document.getElementById('add-guru-username').value.trim();
    const password = document.getElementById('add-guru-password').value.trim();

    try {
      const res = await fetch('/api/master/guru', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nip, nama, no_wa, is_piket, username, password })
      });
      const json = await res.json();
      if (json.success) {
        this.showToast(json.message, 'success');
        this.closeModalTambahGuru();
        document.getElementById('add-guru-nip').value = '';
        document.getElementById('add-guru-nama').value = '';
        document.getElementById('add-guru-wa').value = '';
        document.getElementById('add-guru-username').value = '';
        await this.loadMasterView();
        if (typeof this.loadTeacherAttendanceDashboard === 'function') {
          await this.loadTeacherAttendanceDashboard();
        }
      } else {
        this.showToast(json.message, 'error');
      }
    } catch (err) {
      this.showToast('Gagal menambah guru: ' + err.message, 'error');
    }
  },

  showToast(message, type = 'info') {
    const toast = document.getElementById('global-toast');
    if (!toast) return;

    const colors = {
      success: 'bg-emerald-600 text-white',
      error: 'bg-rose-600 text-white',
      warning: 'bg-amber-600 text-white',
      info: 'bg-indigo-600 text-white'
    };

    toast.className = `fixed bottom-6 right-6 z-50 px-5 py-3 rounded-2xl shadow-2xl flex items-center gap-3 text-xs font-semibold transform transition-all duration-300 ${colors[type] || colors.info}`;
    toast.innerHTML = `
      <span>${type === 'success' ? '✅' : type === 'error' ? '❌' : type === 'warning' ? '⚠️' : 'ℹ️'}</span>
      <span>${message}</span>
    `;

    toast.classList.remove('opacity-0', 'translate-y-4', 'pointer-events-none');
    toast.classList.add('opacity-100', 'translate-y-0');

    clearTimeout(this.toastTimeout);
    this.toastTimeout = setTimeout(() => {
      toast.classList.add('opacity-0', 'translate-y-4', 'pointer-events-none');
      toast.classList.remove('opacity-100', 'translate-y-0');
    }, 4500);
  },

  setupEventListeners() {
    const themeBtn = document.getElementById('btn-theme-toggle');
    if (themeBtn) {
      themeBtn.addEventListener('click', () => this.toggleDarkMode());
    }
  }
};

document.addEventListener('DOMContentLoaded', () => {
  App.init();
});
