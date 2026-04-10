export default function Home() {
  return (
    <main className="min-h-screen">
      {/* Navbar */}
      <nav className="fixed top-0 w-full z-50 bg-background/80 backdrop-blur-md border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="font-heading text-2xl font-bold text-gold">
              QuranSRT
            </span>
          </div>
          <div className="hidden sm:flex items-center gap-8 text-sm text-text-secondary">
            <a href="#fitur" className="hover:text-gold transition-colors">
              Fitur
            </a>
            <a href="#cara-kerja" className="hover:text-gold transition-colors">
              Cara Kerja
            </a>
            <a
              href="#generate"
              className="bg-gold text-background font-semibold px-5 py-2 rounded-lg hover:bg-gold-light transition-colors"
            >
              Mulai Generate
            </a>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative pt-32 pb-20 sm:pt-40 sm:pb-28 px-4 overflow-hidden">
        {/* Background glow */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-gold/5 rounded-full blur-3xl pointer-events-none" />

        <div className="relative max-w-4xl mx-auto text-center">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 bg-surface border border-border rounded-full px-4 py-1.5 mb-8">
            <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
            <span className="text-sm text-text-secondary">
              Zero Install — Langsung di Browser
            </span>
          </div>

          {/* Heading */}
          <h1 className="font-heading text-4xl sm:text-5xl lg:text-6xl font-bold text-text-primary leading-tight mb-6 text-balance">
            Generate{" "}
            <span className="text-gold">Subtitle Al-Quran</span>
            <br />
            dalam Hitungan Detik
          </h1>

          {/* Subheading */}
          <p className="text-lg sm:text-xl text-text-secondary max-w-2xl mx-auto mb-10 text-balance">
            Buat file SRT untuk 114 surah dengan pilihan 14+ qari, 18+ bahasa
            terjemahan, dan 3 mode subtitle. Langsung download SRT + MP3 tanpa
            install apapun.
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <a
              href="#generate"
              className="w-full sm:w-auto bg-gold text-background font-semibold text-lg px-8 py-3.5 rounded-xl hover:bg-gold-light transition-colors"
            >
              Mulai Generate SRT
            </a>
            <a
              href="#cara-kerja"
              className="w-full sm:w-auto border border-border text-text-primary font-medium text-lg px-8 py-3.5 rounded-xl hover:bg-surface transition-colors"
            >
              Lihat Cara Kerja
            </a>
          </div>

          {/* Stats */}
          <div className="mt-16 grid grid-cols-2 sm:grid-cols-4 gap-6 max-w-3xl mx-auto">
            {[
              { value: "114", label: "Surah" },
              { value: "14+", label: "Qari/Reciter" },
              { value: "18+", label: "Bahasa Terjemahan" },
              { value: "3", label: "Mode Subtitle" },
            ].map((stat) => (
              <div key={stat.label} className="text-center">
                <div className="font-heading text-3xl sm:text-4xl font-bold text-gold">
                  {stat.value}
                </div>
                <div className="text-sm text-text-secondary mt-1">
                  {stat.label}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="fitur" className="py-20 px-4">
        <div className="max-w-6xl mx-auto">
          <h2 className="font-heading text-3xl sm:text-4xl font-bold text-center text-text-primary mb-4">
            Kenapa <span className="text-gold">QuranSRT</span>?
          </h2>
          <p className="text-text-secondary text-center max-w-xl mx-auto mb-14">
            Dibanding tools lain, QuranSRT bekerja langsung di browser — tanpa
            download, tanpa install, tanpa ribet.
          </p>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              {
                icon: "🌐",
                title: "Zero Install",
                desc: "Buka browser, pilih surah, download. Tidak perlu install software apapun di komputer Anda.",
              },
              {
                icon: "🎙️",
                title: "14+ Qari Pilihan",
                desc: "Dari Mishari Rashid hingga Abdul Basit — pilih qari favorit dengan preview audio.",
              },
              {
                icon: "🌍",
                title: "18+ Bahasa Terjemahan",
                desc: "Terjemahan Indonesia, Inggris, Melayu, Turki, Urdu, dan banyak lagi termasuk transliterasi.",
              },
              {
                icon: "⏱️",
                title: "3 Mode Timing",
                desc: "WAQOF (jeda natural), VERSE (per ayat), atau STD (karakter tetap) — sesuai kebutuhan video Anda.",
              },
              {
                icon: "📦",
                title: "Bundle SRT + MP3",
                desc: "Download subtitle dan audio sekaligus dalam satu file ZIP, siap pakai untuk editing video.",
              },
              {
                icon: "👁️",
                title: "Live Preview",
                desc: "Lihat hasil subtitle sebelum download. Pastikan semuanya sempurna sebelum digunakan.",
              },
            ].map((feature) => (
              <div
                key={feature.title}
                className="bg-surface border border-border rounded-2xl p-6 hover:border-gold/30 transition-colors"
              >
                <div className="text-3xl mb-4">{feature.icon}</div>
                <h3 className="font-heading text-xl font-bold text-text-primary mb-2">
                  {feature.title}
                </h3>
                <p className="text-text-secondary text-sm leading-relaxed">
                  {feature.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it Works */}
      <section id="cara-kerja" className="py-20 px-4 bg-surface/50">
        <div className="max-w-4xl mx-auto">
          <h2 className="font-heading text-3xl sm:text-4xl font-bold text-center text-text-primary mb-14">
            Cara Kerja
          </h2>

          <div className="grid sm:grid-cols-3 gap-8">
            {[
              {
                step: "1",
                title: "Pilih Surah & Qari",
                desc: "Pilih surah dari 114 surah, qari favorit, dan bahasa terjemahan yang diinginkan.",
              },
              {
                step: "2",
                title: "Atur Mode Subtitle",
                desc: "Pilih mode timing: WAQOF untuk jeda natural, VERSE per ayat, atau STD karakter tetap.",
              },
              {
                step: "3",
                title: "Download SRT + MP3",
                desc: "Klik generate, preview hasilnya, lalu download file SRT dan audio MP3 dalam satu paket.",
              },
            ].map((item) => (
              <div key={item.step} className="text-center">
                <div className="w-14 h-14 bg-gold/10 border border-gold/30 rounded-2xl flex items-center justify-center mx-auto mb-5">
                  <span className="font-heading text-2xl font-bold text-gold">
                    {item.step}
                  </span>
                </div>
                <h3 className="font-heading text-lg font-bold text-text-primary mb-2">
                  {item.title}
                </h3>
                <p className="text-text-secondary text-sm leading-relaxed">
                  {item.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-10 px-4 border-t border-border">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <span className="font-heading text-xl font-bold text-gold">
            QuranSRT
          </span>
          <p className="text-text-muted text-sm">
            &copy; 2026 QuranSRT. Platform generate subtitle Al-Quran berbasis
            browser.
          </p>
        </div>
      </footer>
    </main>
  );
}
