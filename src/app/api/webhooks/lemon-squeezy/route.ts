import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'
import { BILLING_PLANS_V2 } from '@/constants/billing'

export async function POST(request: NextRequest) {
  try {
    const secret = process.env.LEMON_SQUEEZY_WEBHOOK_SECRET
    if (!secret) {
      console.error('[LS-Webhook] LEMON_SQUEEZY_WEBHOOK_SECRET not set')
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })
    }

    const rawBody = await request.text()
    const hmac = crypto.createHmac('sha256', secret)
    const digest = Buffer.from(hmac.update(rawBody).digest('hex'), 'utf8')
    const signature = Buffer.from(request.headers.get('x-signature') || '', 'utf8')

    if (digest.length !== signature.length || !crypto.timingSafeEqual(digest, signature)) {
      console.warn('[LS-Webhook] Invalid signature')
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
    }

    const payload = JSON.parse(rawBody)
    const eventName = payload.meta.event_name
    const data = payload.data

    console.log(`[LS-Webhook] Event: ${eventName}, Order: ${data.id}`)

    if (eventName === 'order_created' || eventName === 'subscription_payment_success') {
      const attributes = data.attributes
      const variantId = String(
        attributes.first_subscription_item?.variant_id ?? attributes.variant_id ?? ''
      )
      const customerEmail = attributes.user_email
      const customData = payload.meta.custom_data || {}

      const foundPlan = Object.values(BILLING_PLANS_V2).find(
        (p) => String(p.variantIdMonthly) === variantId || String(p.variantIdYearly) === variantId
      )

      if (!foundPlan) {
        console.error(`[LS-Webhook] Unknown variant ID: ${variantId}`)
        return NextResponse.json({ received: true, warning: 'unknown_variant' })
      }

      const creditsToAdd = foundPlan.coins
      const planName = foundPlan.name

      console.log(`[LS-Webhook] Plan matched: ${planName} (${creditsToAdd} credits)`)

      const supabaseAdmin = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      )

      let userId: string | undefined = customData.user_id

      if (!userId && customerEmail) {
        const { data: users, error: userError } = await supabaseAdmin.auth.admin.listUsers()
        if (!userError && users.users) {
          const user = users.users.find(
            (u) => u.email?.toLowerCase() === customerEmail.toLowerCase()
          )
          if (user) userId = user.id
        }
        if (!userId) {
          console.error(`[LS-Webhook] No user found for email: ${customerEmail}`)
        }
      }

      if (!userId) {
        console.error(
          `[LS-Webhook] Cannot resolve user. email=${customerEmail}, custom_data=${JSON.stringify(customData)}`
        )
        return NextResponse.json({
          received: true,
          warning: 'user_not_found',
          email: customerEmail,
        })
      }

      const { data: newBalance, error: rpcError } = await supabaseAdmin.rpc(
        'admin_grant_credits',
        {
          p_user_id: userId,
          p_amount: creditsToAdd,
          p_reason: 'purchase',
          p_metadata: {
            source: 'lemon_squeezy',
            event: eventName,
            order_id: data.id,
            variant_id: variantId,
            plan: planName,
            email: customerEmail,
          },
        }
      )

      if (rpcError) {
        console.error(`[LS-Webhook] RPC admin_grant_credits failed:`, rpcError)
        return NextResponse.json({ error: 'Failed to grant credits' }, { status: 500 })
      }

      console.log(`[LS-Webhook] Credits granted. New balance: ${newBalance}`)
    }

    return NextResponse.json({ received: true })
  } catch (error: any) {
    console.error('[LS-Webhook] Unhandled error:', error.message || error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
