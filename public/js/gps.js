// SIAKAD SMA RAD - Geolocation & Haversine Engine
const GpsEngine = {
  schoolConfig: {
    lat: -6.175392,
    lng: 106.827153,
    radius: 150.0,
    name: 'SMA Hidayatun Najah Samiran Proppo Pamekasan'
  },
  currentPosition: {
    lat: -6.175401,
    lng: 106.827160,
    accuracy: 8
  },
  isInsideRadius: true,
  currentDistance: 0,

  // Haversine formula on client
  calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371e3; // meters
    const phi1 = (lat1 * Math.PI) / 180;
    const phi2 = (lat2 * Math.PI) / 180;
    const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
    const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

    const a =
      Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
      Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return Math.round(R * c * 10) / 10;
  },

  async init() {
    try {
      const res = await fetch('/api/config/sekolah');
      const json = await res.json();
      if (json.success && json.data) {
        this.schoolConfig = {
          lat: parseFloat(json.data.latitude_sekolah),
          lng: parseFloat(json.data.longitude_sekolah),
          radius: parseFloat(json.data.radius_meter),
          name: json.data.nama_sekolah
        };
      }
    } catch (e) {
      console.warn('Could not fetch school config:', e);
    }
    this.updatePosition(this.currentPosition.lat, this.currentPosition.lng);
  },

  updatePosition(lat, lng) {
    this.currentPosition.lat = lat;
    this.currentPosition.lng = lng;

    this.currentDistance = this.calculateDistance(
      lat,
      lng,
      this.schoolConfig.lat,
      this.schoolConfig.lng
    );

    this.isInsideRadius = this.currentDistance <= this.schoolConfig.radius;
    this.renderUI();
  },

  // Switch to real device GPS
  useRealGPS() {
    if (!navigator.geolocation) {
      alert('Browser Anda tidak mendukung Geolocation API');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        this.currentPosition.accuracy = Math.round(pos.coords.accuracy);
        this.updatePosition(pos.coords.latitude, pos.coords.longitude);
        App.showToast(`GPS Asli Terdeteksi: Lat ${pos.coords.latitude.toFixed(6)}, Lon ${pos.coords.longitude.toFixed(6)}`, 'info');
      },
      (err) => {
        alert('Gagal mengambil GPS perangkat: ' + err.message + '\nSilakan gunakan opsi Simulasi Lokasi di bawah.');
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  },

  // Simulate within school radius
  simulateInSchool() {
    // Add minor jitter within 25m of school center
    const jitterLat = (Math.random() - 0.5) * 0.0002;
    const jitterLng = (Math.random() - 0.5) * 0.0002;
    this.updatePosition(this.schoolConfig.lat + jitterLat, this.schoolConfig.lng + jitterLng);
    App.showToast('Lokasi disimulasikan DI DALAM radius sekolah (Jarak: ' + this.currentDistance + 'm)', 'success');
  },

  // Simulate outside school radius
  simulateOutsideSchool() {
    // Approx 650m away from school
    this.updatePosition(this.schoolConfig.lat + 0.0055, this.schoolConfig.lng + 0.0055);
    App.showToast('Lokasi disimulasikan DI LUAR radius sekolah (Jarak: ' + this.currentDistance + 'm)', 'warning');
  },

  renderUI() {
    const distanceBadge = document.getElementById('gps-distance-display');
    const statusPill = document.getElementById('gps-status-pill');
    const clockInBtn = document.getElementById('btn-clockin-submit');
    const studentCoords = document.getElementById('gps-student-coords');
    const schoolCoords = document.getElementById('gps-school-coords');
    const radiusLimit = document.getElementById('gps-radius-limit');

    if (studentCoords) {
      studentCoords.textContent = `${this.currentPosition.lat.toFixed(6)}, ${this.currentPosition.lng.toFixed(6)}`;
    }
    if (schoolCoords) {
      schoolCoords.textContent = `${this.schoolConfig.lat.toFixed(6)}, ${this.schoolConfig.lng.toFixed(6)}`;
    }
    if (radiusLimit) {
      radiusLimit.textContent = `${this.schoolConfig.radius} meter`;
    }

    if (distanceBadge) {
      distanceBadge.textContent = `${this.currentDistance} meter`;
    }

    if (statusPill && clockInBtn) {
      if (this.isInsideRadius) {
        statusPill.className = 'inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700';
        statusPill.innerHTML = `<span class="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span> Di Dalam Radius Sekolah`;
        
        clockInBtn.disabled = false;
        clockInBtn.classList.remove('opacity-50', 'cursor-not-allowed', 'bg-slate-400');
        clockInBtn.classList.add('bg-emerald-600', 'hover:bg-emerald-700', 'shadow-emerald-500/30');
      } else {
        statusPill.className = 'inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-rose-100 text-rose-800 dark:bg-rose-900/60 dark:text-rose-300 border border-rose-300 dark:border-rose-700';
        statusPill.innerHTML = `<span class="w-2 h-2 rounded-full bg-rose-500"></span> Di Luar Radius Sekolah (${this.currentDistance}m > ${this.schoolConfig.radius}m)`;

        clockInBtn.disabled = true;
        clockInBtn.classList.add('opacity-50', 'cursor-not-allowed', 'bg-slate-400');
        clockInBtn.classList.remove('bg-emerald-600', 'hover:bg-emerald-700', 'shadow-emerald-500/30');
      }
    }
  }
};
