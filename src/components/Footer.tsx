import Link from 'next/link'

export default function Footer() {
  const currentYear = new Date().getFullYear()
  
  return (
    <footer className="py-16 px-8 border-t border-white/[0.02]">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-8 md:gap-12">
        {/* Version / Brand */}
        <div className="flex items-center gap-4 opacity-20 hover:opacity-40 transition-opacity">
          <div className="w-2 h-2 rounded-full bg-brand-emerald" />
          <span className="text-[10px] font-black uppercase tracking-[0.3em] text-white">geniferAI</span>
        </div>

        {/* Legal Links */}
        <div className="flex flex-wrap justify-center items-center gap-8 text-[10px] font-bold uppercase tracking-[0.2em] text-white/30">
          <Link href="/privacy-policy" className="hover:text-white transition-colors">
            Privacy Policy
          </Link>
          <Link href="/terms" className="hover:text-white transition-colors">
            Terms of Service
          </Link>
          <Link href="mailto:support@geniferai.com" className="hover:text-white transition-colors">
            Contact
          </Link>
        </div>

        {/* Copyright */}
        <div className="opacity-20 text-[10px] font-black uppercase tracking-[0.3em] text-white text-right">
          © {currentYear}
        </div>
      </div>
    </footer>
  )
}
