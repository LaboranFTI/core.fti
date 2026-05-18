import React, { useState } from 'react';
import { Info, Users, Code, Mail, Phone, MapPin, ExternalLink, Github, Linkedin, Twitter, Heart, X } from 'lucide-react';
import { APP_VERSION, APP_NAME, APP_FULL_NAME } from '../config';
import nocLogo from "../src/assets/NOC.svg";
import ftiLogo from "../src/assets/FTI.svg";
import ukswLogo from "../src/assets/UKSW.svg";
import confetti from 'canvas-confetti';
import PageHeader from '../components/PageHeader';

const Tentang: React.FC = () => {
  // State untuk Easter Egg NOC
  const [nocClicks, setNocClicks] = useState(0);
  const [isSpinning, setIsSpinning] = useState(false);
  const [showEasterEggModal, setShowEasterEggModal] = useState(false);

  const handleNocClick = () => {
    const newClicks = nocClicks + 1;
    setNocClicks(newClicks);

    if (newClicks === 5) {
      setIsSpinning(true);

      // Ledakan confetti!
      confetti({
        particleCount: 150,
        spread: 70,
        origin: { y: 0.6 },
        zIndex: 9999
      });

      // Tampilkan custom modal alih-alih alert bawaan browser agar confetti tidak tertutup/berhenti
      setTimeout(() => {
        setShowEasterEggModal(true);
      }, 300);

      setTimeout(() => {
        setIsSpinning(false);
        setNocClicks(0);
      }, 3000);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      <PageHeader
        title="Tentang"
        description={`Kenal lebih dekat dengan ${APP_NAME} dan tim di baliknya`}
        centered
        className="py-8"
        titleClassName="text-3xl font-bold text-gray-900 dark:text-white"
      />

      {/* Section 1: About the Project */}
      <section className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="bg-linear-to-r from-blue-600 to-indigo-600 px-6 py-4">
          <div className="flex items-center space-x-3">
            <Info className="w-6 h-6 text-white" />
            <h2 className="text-xl font-bold text-white">Tentang Proyek</h2>
          </div>
        </div>
        <div className="p-6">
          <div className="flex flex-col md:flex-row gap-6">
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">{APP_NAME}</h3>
              <p className="text-gray-600 dark:text-gray-300 leading-relaxed mb-4">
                <span className="font-bold">{APP_NAME}</span> ({APP_FULL_NAME})
                adalah sistem manajemen resources dan fasilitas dari Sarana dan Prasarana Fakultas Teknologi Informasi
                UKSW. Sistem ini dirancang untuk memudahkan pengelolaan peminjaman ruangan, peralatan, administrasi,
                serta penjadwalan kegiatan di lingkungan FTI UKSW.
              </p>
              <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
                Dengan adanya sistem ini, mahasiswa, dosen, dan staff dapat dengan mudah melakukan
                pemesanan ruangan, melihat jadwal ketersediaan ruang, menikmati layanan administrasi serta mengelola inventaris
                sarpras secara efisien dan terstruktur.
              </p>
            </div>
            <div className="md:w-1/3 flex flex-col items-center justify-center">
              <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-6 text-center w-full">
                <div className="flex items-center justify-center gap-3 mb-4">
                  <a
                    href="https://www.uksw.edu"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="transition-transform duration-300 hover:scale-110 hover:-translate-y-1"
                    title="Kunjungi Website UKSW"
                  >
                    <img src={ukswLogo} alt="UKSW Logo" className="h-10 w-auto object-contain" />
                  </a>
                  <a
                    href="https://fti.uksw.edu"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="transition-transform duration-300 hover:scale-110 hover:-translate-y-1"
                    title="Kunjungi Website FTI UKSW"
                  >
                    <img src={ftiLogo} alt="FTI Logo" className="h-10 w-auto object-contain" />
                  </a>
                  <button
                    type="button"
                    onClick={handleNocClick}
                    className={`outline-none transition-all duration-300 hover:scale-110 hover:rotate-12 cursor-pointer ${isSpinning ? 'animate-spin' : ''}`}
                    title="Tim NOC"
                  >
                    <img src={nocLogo} alt="NOC Logo" className="h-10 w-10 object-contain" />
                  </button>
                </div>
                <div className="text-4xl font-bold text-blue-600 dark:text-blue-400 mb-1">{APP_NAME}</div>
                <div className="text-sm text-gray-500 dark:text-gray-400">Versi {APP_VERSION}</div>
                <div className="mt-3 inline-flex items-center px-3 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-full text-sm font-medium">
                  <span className="w-2 h-2 bg-green-500 rounded-full mr-2 animate-pulse"></span>
                  Sistem Aktif
                </div>
              </div>
            </div>
          </div>

          {/* Features Grid */}
          <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
              <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center mb-3">
                <MapPin className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              </div>
              <h4 className="font-semibold text-gray-900 dark:text-white mb-1">Peminjaman Ruangan</h4>
              <p className="text-sm text-gray-500 dark:text-gray-400">Pesan ruangan laboratorium dengan mudah sesuai kebutuhan</p>
            </div>
            <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
              <div className="w-10 h-10 bg-green-100 dark:bg-green-900/30 rounded-lg flex items-center justify-center mb-3">
                <Users className="w-5 h-5 text-green-600 dark:text-green-400" />
              </div>
              <h4 className="font-semibold text-gray-900 dark:text-white mb-1">Manajemen Inventaris</h4>
              <p className="text-sm text-gray-500 dark:text-gray-400">Kelola peralatan dan aset laboratorium secara efisien</p>
            </div>
            <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
              <div className="w-10 h-10 bg-purple-100 dark:bg-purple-900/30 rounded-lg flex items-center justify-center mb-3">
                <Code className="w-5 h-5 text-purple-600 dark:text-purple-400" />
              </div>
              <h4 className="font-semibold text-gray-900 dark:text-white mb-1">Jadwal Kuliah</h4>
              <p className="text-sm text-gray-500 dark:text-gray-400">Lihat jadwal penggunaan ruangan laboratorium</p>
            </div>
          </div>
        </div>
      </section>

      {/* Section 2: About Laboran FTI UKSW */}
      <section className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="bg-linear-to-r from-emerald-600 to-teal-600 px-6 py-4">
          <div className="flex items-center space-x-3">
            <Users className="w-6 h-6 text-white" />
            <h2 className="text-xl font-bold text-white">Tentang Laboran FTI UKSW (Sarpras)</h2>
          </div>
        </div>
        <div className="p-6">
          <div className="flex flex-col md:flex-row gap-6">
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">Tim Laboran FTI UKSW</h3>
              <p className="text-gray-600 dark:text-gray-300 leading-relaxed mb-4">
                <span className="font-bold">Laboran FTI UKSW</span> adalah tim teknisi dan admin yang bertanggung jawab
                atas pengelolaan, pemeliharaan, dan administrasi fasilitas laboratorium di Fakultas Teknologi Informasi
                Universitas Kristen Satya Wacana.
              </p>
              <p className="text-gray-600 dark:text-gray-300 leading-relaxed mb-4">
                Tim kami terdiri dari mahasiswa part-time dan staff tendik yang berdedikasi untuk memastikan semua peralatan laboratorium
                berfungsi dengan baik, menyediakan dukungan teknis untuk kegiatan akademik, dan membantu
                mahasiswa serta dosen dalam memanfaatkan fasilitas laboratorium dan fakultas secara optimal.
              </p>
            </div>
          </div>

          {/* Responsibilities */}
          <div className="mt-6">
            <h4 className="font-semibold text-gray-900 dark:text-white mb-3">Tugas & Tanggung Jawab:</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="flex items-start space-x-3 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                <div className="w-6 h-6 bg-emerald-100 dark:bg-emerald-900/30 rounded-full flex items-center justify-center shrink-0 mt-0.5">
                  <span className="text-emerald-600 dark:text-emerald-400 text-xs font-bold">1</span>
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-300">Mengelola peminjaman ruangan dan peralatan</p>
              </div>
              <div className="flex items-start space-x-3 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                <div className="w-6 h-6 bg-emerald-100 dark:bg-emerald-900/30 rounded-full flex items-center justify-center shrink-0 mt-0.5">
                  <span className="text-emerald-600 dark:text-emerald-400 text-xs font-bold">2</span>
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-300">Memastikan peralatan laboratorium dalam kondisi siap pakai</p>
              </div>
              <div className="flex items-start space-x-3 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                <div className="w-6 h-6 bg-emerald-100 dark:bg-emerald-900/30 rounded-full flex items-center justify-center shrink-0 mt-0.5">
                  <span className="text-emerald-600 dark:text-emerald-400 text-xs font-bold">3</span>
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-300">Memberikan dukungan teknis untuk kegiatan praktikum dan acara fakultas</p>
              </div>
              <div className="flex items-start space-x-3 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                <div className="w-6 h-6 bg-emerald-100 dark:bg-emerald-900/30 rounded-full flex items-center justify-center shrink-0 mt-0.5">
                  <span className="text-emerald-600 dark:text-emerald-400 text-xs font-bold">4</span>
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-300">Mengelola inventaris dan spesifikasi software laboratorium</p>
              </div>
            </div>
          </div>

          {/* Contact Info */}
          <div className="mt-6 p-4 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg border border-emerald-100 dark:border-emerald-800">
            <h4 className="font-semibold text-emerald-900 dark:text-emerald-300 mb-3">Informasi Kontak:</h4>
            <div className="flex flex-col sm:flex-row sm:space-x-6 space-y-2 sm:space-y-0">
              <div className="flex items-center space-x-2 text-sm text-emerald-700 dark:text-emerald-400">
                <MapPin className="w-4 h-4" />
                <span>Gedung FTI UKSW, Ruang 227</span>
              </div>
              <div className="flex items-center space-x-2 text-sm text-emerald-700 dark:text-emerald-400">
                <Mail className="w-4 h-4" />
                <span>fti.laboran@adm.uksw.edu</span>
              </div>
              <div className="flex items-center space-x-2 text-sm text-emerald-700 dark:text-emerald-400">
                <Phone className="w-4 h-4" />
                <span>(0298) 321212</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Section 3: About Developers */}
      <section className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="bg-linear-to-r from-violet-600 to-purple-600 px-6 py-4">
          <div className="flex items-center space-x-3">
            <Code className="w-6 h-6 text-white" />
            <h2 className="text-xl font-bold text-white">Tentang Pengembang</h2>
          </div>
        </div>
        <div className="p-6">
          <p className="text-gray-600 dark:text-gray-300 mb-6">
            {APP_NAME} dikembangkan oleh tim laboran mahasiswa yang sedang melakukan proyek untuk internal Sarpras.
            Kami berkomitmen untuk terus mengembangkan dan menyempurnakan sistem ini demi kenyamanan
            seluruh civitas akademika FTI UKSW.
          </p>

          {/* Developer Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Developer 1 */}
            <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-6 border border-gray-200 dark:border-gray-600">
              <div className="flex items-start space-x-4">
                <div className="w-16 h-16 bg-linear-to-br from-violet-500 to-purple-600 rounded-full flex items-center justify-center text-white text-xl font-bold">
                  FFA
                </div>
                <div className="flex-1">
                  <h4 className="font-bold text-gray-900 dark:text-white">Firmandez Febrian Afandy</h4>
                  <p className="text-sm text-violet-600 dark:text-violet-400 font-medium">Full Stack Developer</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Laboran Mahasiswa Angkatan 2022</p>
                </div>
              </div>
              <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-600">
                <p className="text-sm text-gray-600 dark:text-gray-300 mb-3">
                  Bertanggung jawab penuh dalam pengembangan sistem {APP_NAME} dari awal hingga akhir.
                </p>
                <div className="flex space-x-3">
                  <a
                    href="https://github.com/Firmandez"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center space-x-1 text-sm text-gray-600 dark:text-gray-400 hover:text-violet-600 dark:hover:text-violet-400 transition-colors"
                  >
                    <Github className="w-4 h-4" />
                    <span>GitHub</span>
                  </a>
                  <a
                    href="https://linkedin.com/in/firmandezfebrian"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center space-x-1 text-sm text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                  >
                    <Linkedin className="w-4 h-4" />
                    <span>LinkedIn</span>
                  </a>
                  <a
                    href="mailto:firmandez10@gmail.com"
                    className="flex items-center space-x-1 text-sm text-gray-600 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                  >
                    <Mail className="w-4 h-4" />
                    <span>Email</span>
                  </a>
                </div>
              </div>
            </div>

            {/* Developer 2 */}
            <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-6 border border-gray-200 dark:border-gray-600">
              <div className="flex items-start space-x-4">
                <div className="w-16 h-16 bg-linear-to-br from-blue-500 to-cyan-600 rounded-full flex items-center justify-center text-white text-xl font-bold">
                  NCP
                </div>
                <div className="flex-1">
                  <h4 className="font-bold text-gray-900 dark:text-white">Nauval Caesaro Premana</h4>
                  <p className="text-sm text-blue-600 dark:text-blue-400 font-medium">DevOps</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Laboran Mahasiswa Angkatan 2021</p>
                </div>
              </div>
              <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-600">
                <p className="text-sm text-gray-600 dark:text-gray-300 mb-3">
                  Membantu hosting, deployment dan optimasi web server.
                </p>
                <div className="flex space-x-3">
                  <a
                    href="https://github.com/caesaro"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center space-x-1 text-sm text-gray-600 dark:text-gray-400 hover:text-violet-600 dark:hover:text-violet-400 transition-colors"
                  >
                    <Github className="w-4 h-4" />
                    <span>GitHub</span>
                  </a>
                  <a
                    href="https://linkedin.com/in/nauvalcaesaropremana"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center space-x-1 text-sm text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                  >
                    <Linkedin className="w-4 h-4" />
                    <span>LinkedIn</span>
                  </a>
                  <a
                    href="mailto:nauvalpremana@gmail.com"
                    className="flex items-center space-x-1 text-sm text-gray-600 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                  >
                    <Mail className="w-4 h-4" />
                    <span>Email</span>
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Modal Easter Egg Custom */}
      {showEasterEggModal && (
        <div className="fixed inset-0 z-[9998] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-sm w-full p-6 text-center relative border border-gray-200 dark:border-gray-700 animate-in zoom-in-95 duration-300">
            <button
              onClick={() => setShowEasterEggModal(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
            <div className="text-5xl mb-4">🎉</div>
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">DOR!</h3>
            <p className="text-gray-600 dark:text-gray-300 mb-4">
              Kamu baru aja nemuin Easter Egg!
            </p>
            <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-xl border border-blue-100 dark:border-blue-800/50">
              <p className="text-blue-800 dark:text-blue-300 font-mono text-sm italic">
                "Segabut itu ya ngeklik logo NOC sampe 5 kali? atau ngefans sama developernya?"
              </p>
            </div>
            <button
              onClick={() => setShowEasterEggModal(false)}
              className="mt-6 w-full py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 font-medium transition-colors"
            >
              Tutup
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Tentang;
