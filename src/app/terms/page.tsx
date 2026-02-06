import Link from 'next/link'
import Logo from '@/components/ui/Logo'
import Footer from '@/components/Footer'

export default function TermsOfService() {
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
          <h1 className="text-4xl md:text-5xl font-bold mb-12 serif tracking-tight">Terms of Service</h1>
          
          <div className="space-y-12 text-white/60 font-light leading-relaxed">
            <section>
              <h2 className="text-white text-lg font-bold uppercase tracking-wider mb-4">1. Acceptance of Terms</h2>
              <p>
                By accessing and using geniferAI, you agree to be bound by these Terms of Service. 
                If you do not agree to these terms, please do not use our services.
              </p>
            </section>

            <section>
              <h2 className="text-white text-lg font-bold uppercase tracking-wider mb-4">2. AI Generation & Content Policy</h2>
              <div className="space-y-4">
                <p>
                  <strong>Ownership:</strong> You retain ownership of all inputs you provide and all content you generate using our tools, 
                  subject to the terms of our underlying AI providers (e.g., Fal.ai, OpenAI).
                </p>
                <p>
                  <strong>Prohibited Content:</strong> You may not use geniferAI to generate:
                </p>
                <ul className="list-disc pl-5 space-y-2">
                  <li>Sexual, pornographic, or adult content.</li>
                  <li>Hateful, harassing, or violent content.</li>
                  <li>Content that infringes on the intellectual property rights of others.</li>
                  <li>Deepfakes or misleading political content.</li>
                </ul>
                <p>
                  <strong>AI Accuracy:</strong> Artificial Intelligence can make mistakes. You are responsible for verifying the accuracy 
                  of any generated content before publishing or using it professionally.
                </p>
              </div>
            </section>

            <section>
              <h2 className="text-white text-lg font-bold uppercase tracking-wider mb-4">3. Subscriptions & Billing</h2>
              <p>
                Payments are processed securely via Lemon Squeezy. Subscriptions auto-renew unless cancelled. 
                Credits purchased do not expire as long as your subscription is active, but specific plan terms may vary. 
                Refunds are handled on a case-by-case basis.
              </p>
            </section>

            <section>
              <h2 className="text-white text-lg font-bold uppercase tracking-wider mb-4">4. Limitation of Liability</h2>
              <p>
                geniferAI is provided &quot;as is&quot;. We make no warranties regarding the uptime, availability, or accuracy of the service. 
                We are not liable for any indirect damages arising from your use of the platform.
              </p>
            </section>

             <section>
              <h2 className="text-white text-lg font-bold uppercase tracking-wider mb-4">5. Contact</h2>
              <p>
                For legal inquiries, please contact: <br/>
                <a href="mailto:legal@geniferai.com" className="text-brand-emerald hover:underline">legal@geniferai.com</a>
              </p>
            </section>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  )
}
