import Navbar from './components/Navbar';
import Hero from './components/Hero';
import ToolsGrid from './components/ToolsGrid';
import { useState } from 'react';



function App() {
  const [activeTool, setActiveTool] = useState<string | null>(null)
  return (
    <div className="min-h-screen bg-[#f4f5f8] flex flex-col w-full selection:bg-indigo-100 selection:text-indigo-900 overflow-x-hidden relative">
      {/* Fixed continuous video background playing underneath */}
      <div className="fixed inset-0 w-full h-full z-0 overflow-hidden pointer-events-none">
        <video
          autoPlay
          muted
          loop
          playsInline
          className="w-full h-full object-cover select-none"
        >
          <source src="/hero-bg.mp4" type="video/mp4" />
          Your browser does not support the video tag.
        </video>
        
        {/* Soft radial glow in center for reading text */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.45)_0%,transparent_75%)]" />
        
        {/* Atmosphere mix blend */}
        <div className="absolute inset-0 bg-white/5 mix-blend-overlay" />
      </div>

      {/* Header containing the navigation bar */}
      <header className="w-full bg-white/10 backdrop-blur-md border-b border-white/20 sticky top-0 z-50">
        <Navbar />
      </header>

      {/* Main content body */}
      <main className="flex-grow flex flex-col items-center w-full relative z-10">
        <Hero />
        <ToolsGrid setActiveTool={setActiveTool} />
      </main>

      {/* Small copyright footer */}
      <footer className="w-full py-8 text-center text-[13px] text-slate-400 font-sans border-t border-slate-200/50 bg-white/50">
        <div className="max-w-[1240px] mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p>© {new Date().getFullYear()} Folio. All rights reserved.</p>
          <div className="flex items-center gap-6">
            <a href="#privacy" className="hover:text-slate-600 transition-colors">Privacy Policy</a>
            <a href="#terms" className="hover:text-slate-600 transition-colors">Terms of Service</a>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default App;
