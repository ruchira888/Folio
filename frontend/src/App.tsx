import Navbar from './components/Navbar';
import Hero from './components/Hero';
import ToolsGrid from './components/ToolsGrid';
import SummarizeModal from './components/SummarizeModal';
import GenericToolModal from './components/GenericToolModal';
import { useState } from 'react';
import { isModalTool, type ToolType } from './config/toolConfigs';

function App() {
  const [activeTool, setActiveTool] = useState<ToolType | null>(null);

  const closeModal = () => {
    setActiveTool(null);
  };

  return (
    <div className="min-h-screen flex flex-col w-full selection:bg-indigo-100 selection:text-indigo-900 overflow-x-hidden relative">
      {/* Fixed continuous video background */}
      <div className="fixed inset-0 w-full h-full z-0 overflow-hidden pointer-events-none">
        <video
          autoPlay
          muted
          loop
          playsInline
          className="w-full h-full object-cover select-none"
        >
          <source src="https://res.cloudinary.com/dnwjrhlze/video/upload/v1782305324/_seed1739660999_icbirx.mp4" type="video/mp4" />
          Your browser does not support the video tag.
        </video>
        {/* Soft radial glow for text readability */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.45)_0%,transparent_75%)]" />
        <div className="absolute inset-0 bg-white/5 mix-blend-overlay" />
      </div>

      {/* Header containing the navigation bar */}
      <header className="w-full sticky top-0 z-50">
        <Navbar />
      </header>

      {/* Main content body */}
      <main className="flex-grow flex flex-col items-center w-full relative z-10">
        <Hero />
        <ToolsGrid setActiveTool={setActiveTool} />
      </main>

      {/* Minimal copyright footer */}
      <footer className="w-full py-6 text-center text-[12px] text-slate-400 font-sans">
        <p>© {new Date().getFullYear()} Folio. All rights reserved.</p>
      </footer>

      {/* Summarize Modal */}
      <SummarizeModal
        isOpen={activeTool === 'summarize'}
        onClose={closeModal}
      />

      {activeTool && activeTool !== 'summarize' && isModalTool(activeTool) && (
        <GenericToolModal
          isOpen
          toolType={activeTool}
          onClose={closeModal}
        />
      )}
    </div>
  );
}

export default App;
