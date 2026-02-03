import Link from 'next/link'
import Logo from '@/components/ui/Logo'
import Footer from '@/components/Footer'

export default function PrivacyPolicy() {
  return (
    <div className="min-h-screen bg-[#020617] text-white flex flex-col selection:bg-brand-emerald selection:text-brand-obsidian">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 backdrop-blur-xl border-b border-white/[0.02]">
        <div className="max-w-7xl mx-auto px-8 h-20 flex items-center justify-between">
          <Link href="/" className="hover:opacity-80 transition-opacity">
            <Logo size="md" />
          </Link>
        </div>
      </header>

      <main className="flex-1 pt-32 pb-20 px-8">
        <div className="max-w-3xl mx-auto">
          <h1 className="text-4xl md:text-5xl font-bold mb-12 serif tracking-tight">Privacy Policy</h1>
          
          <div className="space-y-12 text-white/60 font-light leading-relaxed">
            <section>
              <h2 className="text-white text-lg font-bold uppercase tracking-wider mb-4">1. Introduction</h2>
              <p>
                Welcome to geniferAI. We respect your privacy and are committed to protecting your personal data. 
                This privacy policy will inform you as to how we look after your personal data when you visit our 
                website and use our AI production tools.
              </p>
            </section>

            <section>
              <h2 className="text-white text-lg font-bold uppercase tracking-wider mb-4">2. Data We Collect</h2>
              <ul className="list-disc pl-5 space-y-2">
                <li><strong>Identity Data:</strong> Includes first name, last name, and username.</li>
                <li><strong>Contact Data:</strong> Includes email address.</li>
                <li><strong>Content Data:</strong> Scripts, prompts, images, and videos you upload or generate using our AI tools.</li>
                <li><strong>Usage Data:</strong> Information about how you use our website, products, and services.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-white text-lg font-bold uppercase tracking-wider mb-4">3. AI Processing</h2>
              <p>
                To provide our services, user inputs (such as text prompts and uploaded images) are processed by 
                third-party AI models (including but not limited to Fal.ai and OpenAI). By using geniferAI, 
                you acknowledge that your inputs will be shared with these providers solely for the purpose of content generation.
              </p>
            </section>

             <section>
              <h2 className="text-white text-lg font-bold uppercase tracking-wider mb-4">4. Contact Us</h2>
              <p>
                If you have any questions about this privacy policy, please contact us at: <br/>
                <a href="mailto:support@geniferai.com" className="text-brand-emerald hover:underline">support@geniferai.com</a>
              </p>
            </section>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  )
}
