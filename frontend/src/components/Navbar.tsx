import { ChevronDown } from 'lucide-react';

export default function Navbar() {
  return (
    <nav className="w-full max-w-6xl mx-auto mt-4 px-2">
      <div className="bg-white/90 backdrop-blur-md rounded-full shadow-[0_2px_20px_-4px_rgba(0,0,0,0.06)] border border-white/60 px-5 md:px-8 py-3 flex items-center justify-between">
        {/* Logo */}
        <div className="flex items-center cursor-pointer select-none">
          <span className="font-sans font-extrabold text-[22px] text-[#1D3557] tracking-tight">folio</span>
          <span className="text-lg font-bold text-amber-400 self-start -mt-0.5 ml-0.5">+</span>
        </div>

        {/* Nav Links */}
        <div className="hidden md:flex items-center gap-7 text-[14px] font-medium text-slate-500">
          <button className="flex items-center gap-1 hover:text-slate-800 transition-colors">
            Features <ChevronDown className="w-3.5 h-3.5 opacity-60" />
          </button>
          <button className="flex items-center gap-1 hover:text-slate-800 transition-colors">
            Tools <ChevronDown className="w-3.5 h-3.5 opacity-60" />
          </button>
          <a href="#pricing" className="hover:text-slate-800 transition-colors">Pricing</a>
          <a href="#blog" className="hover:text-slate-800 transition-colors">Blog</a>
          <a href="#about" className="hover:text-slate-800 transition-colors">About</a>
        </div>

        {/* Auth buttons */}
        <div className="flex items-center gap-2">
          <button className="text-[14px] font-medium text-slate-600 hover:text-slate-900 px-4 py-2 transition-colors">
            Log in
          </button>
          <button className="bg-[#1D3557] text-white text-[13px] font-semibold px-5 py-2.5 rounded-full hover:bg-[#15294a] hover:shadow-lg hover:shadow-slate-800/10 active:scale-[0.98] transition-all">
            Get Started
          </button>
        </div>
      </div>
    </nav>
  );
}
