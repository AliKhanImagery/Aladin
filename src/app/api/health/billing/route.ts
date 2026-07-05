import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { BILLING_PLANS_V2 } from '@/constants/billing'

export async function GET(_request: NextRequest) {
  const checks: Record<string, { ok: boolean; detail: string }> = {}

  checks['polar_webhook_secret'] = process.env.POLAR_WEBHOOK_SECRET
    ? { ok: true, detail: 'Set' }
    : { ok: false, detail: 'POLAR_WEBHOOK_SECRET env var is missing' }

  checks['lemon_squeezy_webhook_secret'] = process.env.LEMON_SQUEEZY_WEBHOOK_SECRET
    ? { ok: true, detail: 'Set' }
    : { ok: false, detail: 'LEMON_SQUEEZY_WEBHOOK_SECRET env var is missing' }

  checks['payment_provider'] = {
    ok: true,
    detail: `Active provider: ${process.env.NEXT_PUBLIC_PAYMENT_PROVIDER || 'lemonsqueezy (default)'}`,
  }

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL

  checks['supabase_service_role_key'] = serviceKey
    ? { ok: true, detail: 'Set' }
    : { ok: false, detail: 'SUPABASE_SERVICE_ROLE_KEY missing — webhook cannot grant credits' }

  if (serviceKey && supabaseUrl) {
    const supabase = createClient(supabaseUrl, serviceKey)

    const { data: pricing, error: pricingError } = await supabase
      .from('credit_pricing')
      .select('key, cost, active')
      .limit(20)

    if (pricingError) {
      checks['credit_pricing_table'] = { ok: false, detail: `Query failed: ${pricingError.message}` }
    } else {
      const activeCount = pricing?.filter((p) => p.active).length ?? 0
      checks['credit_pricing_table'] = { ok: activeCount > 0, detail: `${activeCount} active pricing rules found` }
    }

    const { data: settings, error: settingsError } = await supabase
      .from('billing_settings')
      .select('signup_grant')
      .single()

    if (settingsError) {
      checks['billing_settings'] = { ok: false, detail: `Query failed: ${settingsError.message}` }
    } else {
      checks['billing_settings'] = { ok: true, detail: `Signup grant: ${settings.signup_grant} coins` }
    }
  } else {
    checks['database_checks'] = { ok: false, detail: 'Skipped — missing Supabase credentials' }
  }

  const polarProducts = [
    'NEXT_PUBLIC_POLAR_PRODUCT_STARTER_MONTHLY',
    'NEXT_PUBLIC_POLAR_PRODUCT_STARTER_YEARLY',
    'NEXT_PUBLIC_POLAR_PRODUCT_CREATOR_MONTHLY',
    'NEXT_PUBLIC_POLAR_PRODUCT_CREATOR_YEARLY',
    'NEXT_PUBLIC_POLAR_PRODUCT_STUDIO_MONTHLY',
    'NEXT_PUBLIC_POLAR_PRODUCT_STUDIO_YEARLY',
  ]
  const missingPolar = polarProducts.filter((k) => !process.env[k])
  checks['polar_product_ids'] = {
    ok: missingPolar.length === 0,
    detail: missingPolar.length === 0 ? 'All 6 Polar product UUIDs set' : `Missing: ${missingPolar.join(', ')}`,
  }

  const allOk = Object.values(checks).every((c) => c.ok)

  return NextResponse.json({
    status: allOk ? 'healthy' : 'degraded',
    timestamp: new Date().toISOString(),
    checks,
  })
}
