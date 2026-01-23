'use client'

import { useState } from 'react'
import { Check, X, Zap, Crown, Sparkles, ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import Link from 'next/link'

export default function PricingPage() {
  const [isYearly, setIsYearly] = useState(false)

  const plans = [
    {
      name: 'Starter',
      description: 'For hobbyists and experimenters.',
      price: 0,
      yearlyPrice: 0,
      features: [
        '100 Coins / month',
        'Standard generation speed',
        'Public gallery access',
        'Basic models (Flux Dev)',
      ],
      notIncluded: [
        'Commercial usage rights',
        'Priority support',
        'Pro batch discounts',
      ],
      cta: 'Current Plan',
      ctaVariant: 'outline',
      highlight: false,
    },
    {
      name: 'Creator',
      description: 'For content creators growing their audience.',
      price: 19,
      yearlyPrice: 15,
      features: [
        '2,000 Coins / month',
        'Fast generation speed',
        'Commercial usage rights',
        'Access to Flux Pro & Kling',
        'Private gallery',
      ],
      notIncluded: [
        'Pro batch discounts',
        'API access',
      ],
      cta: 'Upgrade to Creator',
      ctaVariant: 'primary',
      highlight: false,
      popular: false,
    },
    {
      name: 'Pro',
      description: 'For professional studios and power users.',
      price: 49,
      yearlyPrice: 39,
      features: [
        '6,000 Coins / month',
        'Turbo generation speed',
        '10% Volume Discount on all generations',
        'Priority support (Email)',
        'Early access to new models (Sora/Gen-3)',
      ],
      notIncluded: [],
      cta: 'Get Pro Access',
      ctaVariant: 'gradient',
      highlight: true,
      popular: true,
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
          <div className="w-8 h-8 bg-brand-emerald rounded-lg flex items-center justify-center glow-emerald transition-transform group-hover:scale-105">
            <Zap className="w-4 h-4 text-brand-obsidian fill-current" />
          </div>
          <span className="text-lg font-bold tracking-tight">Flowboard</span>
        </Link>
        <Link href="/login">
          <Button variant="ghost" className="text-white/60 hover:text-white">Sign In</Button>
        </Link>
      </header>

      <main className="relative z-10 py-20 px-6 max-w-7xl mx-auto">
        {/* Header Section */}
        <div className="text-center mb-20 space-y-4 animate-fade-in">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-xs font-medium text-brand-emerald mb-4">
            <Sparkles className="w-3 h-3" />
            <span>Launch Special: Double Coins on Yearly Plans</span>
          </div>
          <h1 className="text-4xl md:text-6xl font-bold tracking-tight">
            Simple, Transparent <span className="text-brand-emerald">Credit Pricing.</span>
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

        {/* Pricing Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-start">
          {plans.map((plan, idx) => (
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
                  {plan.name === 'Pro' && <Crown className="w-4 h-4 text-brand-amber" />}
                </h3>
                <p className="text-sm text-white/40 mb-6 h-10">{plan.description}</p>
                <div className="flex items-baseline gap-1">
                  <span className="text-4xl font-bold tracking-tight">
                    ${isYearly ? plan.yearlyPrice : plan.price}
                  </span>
                  <span className="text-white/40">/month</span>
                </div>
                {isYearly && plan.price > 0 && (
                  <p className="text-xs text-brand-emerald mt-2">
                    Billed ${plan.yearlyPrice * 12} yearly
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
    </div>
  )
}
