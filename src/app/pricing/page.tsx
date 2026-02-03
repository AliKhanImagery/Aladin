'use client'

import { useState } from 'react'
import { Check, X, Zap, Crown, Sparkles, ArrowRight, HelpCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { BILLING_PLANS_V2, CREDIT_COSTS } from '@/constants/billing'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'

import { useAppStore } from '@/lib/store'
import { toast } from 'react-hot-toast'
import Logo from '@/components/ui/Logo'
import Footer from '@/components/Footer'

export default function PricingPage() {
  const [isYearly, setIsYearly] = useState(false)
  const { user, setShowAuthModal } = useAppStore()

  const handleCheckout = (plan: typeof BILLING_PLANS_V2[keyof typeof BILLING_PLANS_V2]) => {
    if (!user) {
      toast.error('Please sign in to purchase a plan')
      setShowAuthModal(true)
      return
    }

    const variantId = isYearly ? plan.variantIdYearly : plan.variantIdMonthly
    if (!variantId) {
      toast.error('This plan is not available yet')
      return
    }

    // Construct Lemon Squeezy Checkout URL
    // Pass user_id in custom data so webhook can fulfill credits
    // Pre-fill email for better UX
    const checkoutUrl = `https://geniferai.lemonsqueezy.com/checkout/buy/${variantId}?checkout[custom][user_id]=${user.id}&checkout[email]=${user.email}`
    
    window.open(checkoutUrl, '_blank')
  }

  const plans = [
    {
      ...BILLING_PLANS_V2.STARTER,
      cta: 'Get Starter',
      ctaVariant: 'outline',
      highlight: false,
    },
    {
      ...BILLING_PLANS_V2.CREATOR,
      cta: 'Get Creator',
      ctaVariant: 'primary',
      highlight: false,
    },
    {
      ...BILLING_PLANS_V2.STUDIO,
      cta: 'Get Studio',
      ctaVariant: 'gradient',
      highlight: true,
    },
  ]

  return (
    <div className="min-h-screen bg-[#020617] text-white overflow-hidden relative selection:bg-brand-emerald selection:text-brand-obsidian">
      {/* Background Ambience */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-[-20%] left-[20%] w-[500px] h-[500px] bg-brand-emerald/10 blur-[120px] rounded-full mix-blend-screen" />
        <div className="absolute bottom-[-20%] right-[20%] w-[500px] h-[500px] bg-brand-amber/5 blur-[120px] rounded-full mix-blend-screen" />
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-[0.03]" />
      </div>

      <header className="relative z-10 max-w-7xl mx-auto px-6 py-6 flex justify-between items-center">
        <Link href="/" className="flex items-center gap-2 group">
          <Logo size="sm" />
        </Link>
        <Button 
          variant="ghost" 
          className="text-white/60 hover:text-white"
          onClick={() => setShowAuthModal(true)}
        >
          Sign In
        </Button>
      </header>

      <main className="relative z-10 py-20 px-6 max-w-7xl mx-auto">
        {/* Header Section */}
        <div className="text-center mb-16 space-y-4 animate-fade-in">
          <h1 className="text-4xl md:text-6xl font-bold tracking-tight">
            Simple, Transparent <span className="text-brand-emerald">geniferAI Credits.</span>
          </h1>
          <p className="text-lg text-white/40 max-w-2xl mx-auto">
            Pay only for what you generate. Unused credits roll over for 30 days.
            Upgrade or downgrade anytime.
          </p>

          {/* Toggle */}
          <div className="flex items-center justify-center gap-4 pt-8">
            <span className={`text-sm font-medium ${!isYearly ? 'text-white' : 'text-white/40'}`}>Monthly</span>
            <button
              onClick={() => setIsYearly(!isYearly)}
              className={`w-14 h-7 rounded-full p-1 transition-colors duration-300 relative ${
                isYearly ? 'bg-brand-emerald' : 'bg-white/10'
              }`}
            >
              <div
                className={`w-5 h-5 bg-white rounded-full shadow-lg transition-transform duration-300 ${
                  isYearly ? 'translate-x-7' : 'translate-x-0'
                }`}
              />
            </button>
            <span className={`text-sm font-medium ${isYearly ? 'text-white' : 'text-white/40'}`}>
              Yearly <span className="text-brand-emerald text-xs ml-1">(Save 20%)</span>
            </span>
          </div>
        </div>

        {/* Usage Guide Component */}
        <div className="max-w-4xl mx-auto mb-20">
          <div className="bg-white/5 border border-white/10 rounded-xl p-6 backdrop-blur-sm">
            <h3 className="text-sm font-semibold text-white/60 uppercase tracking-wider mb-4 flex items-center gap-2">
              <HelpCircle className="w-4 h-4" /> Usage Guide (Est. Costs)
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
                <span className="text-white/80">Video Generation</span>
                <span className="font-mono text-brand-emerald">{CREDIT_COSTS.VIDEO_GENERATION}c</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
                <span className="text-white/80">Nano Banana (Fast)</span>
                <span className="font-mono text-brand-emerald">{CREDIT_COSTS.NANO_BANANA}c</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
                <span className="text-white/80">Edits & Remixes</span>
                <span className="font-mono text-brand-emerald">{CREDIT_COSTS.EDITS}c</span>
              </div>
            </div>
            <p className="text-xs text-white/30 mt-4 text-center">
              *Actual costs may vary based on model settings (duration, resolution, etc.)
            </p>
          </div>
        </div>

        {/* Pricing Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-start">
          {plans.map((plan) => (
            <div
              key={plan.name}
              className={`relative rounded-2xl border backdrop-blur-xl p-8 transition-all duration-300 hover:translate-y-[-4px] ${
                plan.highlight
                  ? 'bg-white/5 border-brand-emerald/50 shadow-2xl shadow-brand-emerald/10'
                  : 'bg-white/5 border-white/10 hover:border-white/20'
              }`}
            >
              {plan.popular && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-brand-emerald text-brand-obsidian text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wide shadow-lg glow-emerald">
                  Most Popular
                </div>
              )}

              <div className="mb-8">
                <h3 className="text-xl font-bold mb-2 flex items-center gap-2">
                  {plan.name}
                  {plan.name === 'Studio' && <Crown className="w-4 h-4 text-brand-amber" />}
                </h3>
                <p className="text-sm text-white/40 mb-6 h-10">{plan.description}</p>
                <div className="flex items-baseline gap-1">
                  <span className="text-4xl font-bold tracking-tight">
                    ${isYearly ? (plan.priceMonthly * 0.8).toFixed(2) : plan.priceMonthly}
                  </span>
                  <span className="text-white/40">/month</span>
                </div>
                {isYearly && (
                  <p className="text-xs text-brand-emerald mt-2">
                    Billed ${(plan.priceMonthly * 0.8 * 12).toFixed(2)} yearly
                  </p>
                )}
              </div>

              <div className="space-y-4 mb-8">
                {plan.features.map((feature) => (
                  <div key={feature} className="flex items-start gap-3">
                    <div className="w-5 h-5 rounded-full bg-brand-emerald/10 flex items-center justify-center shrink-0 mt-0.5">
                      <Check className="w-3 h-3 text-brand-emerald" />
                    </div>
                    <span className="text-sm text-white/80">{feature}</span>
                  </div>
                ))}
                {plan.notIncluded.map((feature) => (
                  <div key={feature} className="flex items-start gap-3 opacity-40">
                    <div className="w-5 h-5 rounded-full bg-white/5 flex items-center justify-center shrink-0 mt-0.5">
                      <X className="w-3 h-3 text-white" />
                    </div>
                    <span className="text-sm text-white">{feature}</span>
                  </div>
                ))}
              </div>

              <Button
                className={`w-full py-6 text-base ${
                  plan.ctaVariant === 'gradient'
                    ? 'bg-gradient-to-r from-brand-emerald to-brand-emerald/80 hover:to-brand-emerald text-brand-obsidian shadow-lg shadow-brand-emerald/20 border-0'
                    : plan.ctaVariant === 'primary'
                    ? 'bg-white text-black hover:bg-gray-200'
                    : 'bg-transparent border border-white/20 hover:bg-white/5'
                }`}
                // Add Checkout Link logic here later
                onClick={() => handleCheckout(plan)}
              >
                {plan.cta}
                {plan.highlight && <ArrowRight className="w-4 h-4 ml-2" />}
              </Button>
            </div>
          ))}
        </div>

        {/* Enterprise / Pay-as-you-go */}
        <div className="mt-20 p-8 rounded-2xl bg-gradient-to-r from-white/5 to-transparent border border-white/10 flex flex-col md:flex-row items-center justify-between gap-8">
          <div>
            <h3 className="text-2xl font-bold mb-2">Need a custom enterprise plan?</h3>
            <p className="text-white/60 max-w-xl">
              For teams generating 50k+ credits/month, we offer dedicated GPU clusters, 
              custom fine-tuning, and SLA guarantees.
            </p>
          </div>
          <Button variant="outline" className="border-white/20 hover:bg-white/5 px-8">
            Contact Sales
          </Button>
        </div>
      </main>

      <Footer />
    </div>
  )
}
