import { ChevronDown } from 'lucide-react';

export default function Navbar() {
  return (
    <nav className="w-full max-w-7xl mx-auto px-6 md:px-12 py-5 flex items-center justify-between relative z-50">
      {/* Logo */}
      <div className="flex items-center cursor-pointer select-none">
        <span className="font-sans font-extrabold text-2xl text-slate-900 tracking-tight">folio</span>
        <span className="text-xl font-bold text-pink-500 self-start -mt-1 ml-0.5">+</span>
      </div>

      {/* Nav Links */}
      <div className="hidden md:flex items-center gap-8 text-[15px] font-medium text-slate-600">
        <button className="flex items-center gap-1 hover:text-slate-900 transition-colors">
          Features <ChevronDown className="w-4 h-4 opacity-75" />
        </button>
        <div className="relative py-2 flex flex-col items-center">
          <button className="flex items-center gap-1 text-slate-900 font-semibold transition-colors">
            Tools <ChevronDown className="w-4 h-4 opacity-75" />
          </button>
          <div className="absolute bottom-0 w-8 h-[2px] bg-slate-900 rounded-full" />
        </div>
        <a href="#pricing" className="hover:text-slate-900 transition-colors">Pricing</a>
        <a href="#blog" className="hover:text-slate-900 transition-colors">Blog</a>
        <a href="#about" className="hover:text-slate-900 transition-colors font-medium">About</a>
      </div>

      {/* Auth buttons */}
      <div className="flex items-center gap-3">
        <button className="text-[15px] font-medium text-slate-700 hover:text-slate-900 px-4 py-2 transition-colors">
          Log in
        </button>
        <button className="bg-[#1D3557] text-white text-[14px] font-medium px-5 py-2.5 rounded-full hover:bg-slate-800 hover:shadow-lg hover:shadow-slate-800/10 active:scale-[0.98] transition-all">
          Get Started
        </button>
      </div>
    </nav>
  );
}
