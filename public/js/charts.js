// SIAKAD SMA RAD - Interactive Chart.js Module
const ChartEngine = {
  attendanceChartInstance: null,
  academicChartInstance: null,
  classChartInstance: null,

  initAttendanceChart(canvasId, stats) {
    const ctx = document.getElementById(canvasId);
    if (!ctx) return;

    if (this.attendanceChartInstance) {
      this.attendanceChartInstance.destroy();
    }

    const isDark = document.documentElement.classList.contains('dark');

    this.attendanceChartInstance = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: ['Hadir', 'Izin', 'Sakit', 'Alfa'],
        datasets: [{
          data: [stats.Hadir || 0, stats.Izin || 0, stats.Sakit || 0, stats.Alfa || 0],
          backgroundColor: [
            '#10b981', // emerald
            '#3b82f6', // blue
            '#f59e0b', // amber
            '#ef4444'  // red
          ],
          borderWidth: 2,
          borderColor: isDark ? '#1e293b' : '#ffffff',
          hoverOffset: 6
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'bottom',
            labels: {
              boxWidth: 12,
              font: { family: 'Plus Jakarta Sans', size: 12 },
              color: isDark ? '#cbd5e1' : '#475569'
            }
          },
          tooltip: {
            callbacks: {
              label: function(context) {
                const total = context.dataset.data.reduce((a, b) => a + b, 0);
                const val = context.raw || 0;
                const pct = total > 0 ? Math.round((val / total) * 100) : 0;
                return ` ${context.label}: ${val} siswa (${pct}%)`;
              }
            }
          }
        },
        cutout: '68%'
      }
    });
  },

  initAcademicChart(canvasId, gradesData) {
    const ctx = document.getElementById(canvasId);
    if (!ctx) return;

    if (this.academicChartInstance) {
      this.academicChartInstance.destroy();
    }

    const isDark = document.documentElement.classList.contains('dark');
    const labels = gradesData.map(g => g.kode_mapel || g.nama_mapel);
    const finalGrades = gradesData.map(g => g.nilai_akhir);
    const kkmValues = gradesData.map(g => g.kkm || 75);

    this.academicChartInstance = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [
          {
            label: 'Nilai Akhir Siswa',
            data: finalGrades,
            backgroundColor: finalGrades.map((v, i) => v >= kkmValues[i] ? '#4f46e5' : '#ef4444'),
            borderRadius: 6,
            order: 2
          },
          {
            label: 'Standar KKM (Batas Lulus)',
            data: kkmValues,
            type: 'line',
            borderColor: '#f59e0b',
            borderWidth: 2,
            borderDash: [5, 5],
            fill: false,
            pointRadius: 4,
            pointBackgroundColor: '#f59e0b',
            order: 1
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: {
            min: 40,
            max: 100,
            ticks: {
              color: isDark ? '#94a3b8' : '#64748b'
            },
            grid: {
              color: isDark ? '#334155' : '#f1f5f9'
            }
          },
          x: {
            ticks: {
              color: isDark ? '#94a3b8' : '#64748b'
            },
            grid: {
              display: false
            }
          }
        },
        plugins: {
          legend: {
            position: 'top',
            labels: {
              boxWidth: 12,
              font: { family: 'Plus Jakarta Sans', size: 12 },
              color: isDark ? '#cbd5e1' : '#475569'
            }
          }
        }
      }
    });
  },

  initClassAttendanceChart(canvasId, classData) {
    const ctx = document.getElementById(canvasId);
    if (!ctx) return;

    if (this.classChartInstance) {
      this.classChartInstance.destroy();
    }

    const isDark = document.documentElement.classList.contains('dark');
    const labels = classData.map(c => c.nama_kelas);
    const hadirRates = classData.map(c => {
      const tot = c.total_siswa || 1;
      return Math.round((c.hadir_count / tot) * 100);
    });

    this.classChartInstance = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [{
          label: '% Kehadiran Hari Ini',
          data: hadirRates,
          backgroundColor: '#059669',
          borderRadius: 8
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: {
            min: 0,
            max: 100,
            ticks: {
              callback: v => v + '%',
              color: isDark ? '#94a3b8' : '#64748b'
            },
            grid: {
              color: isDark ? '#334155' : '#f1f5f9'
            }
          },
          x: {
            ticks: {
              color: isDark ? '#94a3b8' : '#64748b'
            },
            grid: {
              display: false
            }
          }
        },
        plugins: {
          legend: {
            display: false
          }
        }
      }
    });
  }
};
