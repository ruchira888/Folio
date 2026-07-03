import { ChevronDown } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { motion } from "framer-motion";

export default function Navbar() {
  const location = useLocation();
  const isHome = location.pathname === "/";
  const isTools = location.pathname === "/tools";
  const isFaq = location.pathname === "/faq";

  return (
    <motion.nav
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        delay: 0.2,
        duration: 0.8,
        ease: [0.22, 1, 0.36, 1],
      }}
      className="w-full max-w-6xl mx-auto mt-4 px-2"
    >
      <div className="bg-white/90 backdrop-blur-md rounded-full shadow-[0_2px_20px_-4px_rgba(0,0,0,0.06)] border border-white/60 px-5 md:px-8 py-3 flex items-center justify-between">
        {/* Logo */}
        <Link
          to="/"
          className="flex items-center cursor-pointer select-none no-underline"
        >
          <span className="font-sans font-extrabold text-[22px] text-[#1D3557] tracking-tight">
            folio
          </span>
          <span className="text-lg font-bold text-amber-400 self-start -mt-0.5 ml-0.5">
            +
          </span>
        </Link>

        {/* Nav Links */}
        <div className="hidden md:flex items-center gap-7 text-[14px] font-medium text-slate-500">
          <Link
            to="/"
            className={`hover:text-slate-800 transition-colors no-underline ${isHome ? "text-slate-900 font-semibold" : ""}`}
          >
            Home
          </Link>
          <button className="flex items-center gap-1 hover:text-slate-800 transition-colors">
            Features <ChevronDown className="w-3.5 h-3.5 opacity-60" />
          </button>
          <Link
            to="/tools"
            className={`flex items-center gap-1 hover:text-slate-800 transition-colors no-underline ${isTools ? "text-slate-900 font-semibold" : ""}`}
          >
            Tools <ChevronDown className="w-3.5 h-3.5 opacity-60" />
          </Link>
          <Link
            to="/faq"
            className={`hover:text-[#8B5CF6] transition-colors no-underline ${isFaq ? "text-[#8B5CF6] font-bold" : ""}`}
          >
            FAQ
          </Link>
          <a href="#about" className="hover:text-slate-800 transition-colors">
            About
          </a>
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
    </motion.nav>
  );
}
