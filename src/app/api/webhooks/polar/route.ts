import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'
import { BILLING_PLANS_V2 } from '@/constants/billing'

function verifyWebhookSignature(
  payload: string,
  signature: string | null,
  webhookId: string | null,
  timestamp: string | null,
  secret: string
): boolean {
  if (!signature || !webhookId || !timestamp) return false
  const ts = parseInt(timestamp, 10)
  if (isNaN(ts) || Math.abs(Date.now() / 1000 - ts) > 300) return false
  const secretBytes = Buffer.from(secret.replace('whsec_', ''), 'base64')
  const signedContent = `${webhookId}.${timestamp}.${payload}`
  const expectedSig = crypto.createHmac('sha256', secretBytes).update(signedContent).digest('base64')
  const signatures = signature.split(' ')
  return signatures.some((sig) => {
    const [, sigValue] = sig.split(',')
    if (!sigValue) return false
    try {
      return crypto.timingSafeEqual(Buffer.from(expectedSig), Buffer.from(sigValue))
    } catch { return false }
  })
}

function resolveProductToPlan(productId: string): { plan: string; credits: number } | null {
  const env = process.env
  const mapping: Record<string, { plan: string; credits: number }> = {}
  if (env.POLAR_PRODUCT_STARTER_MONTHLY) mapping[env.POLAR_PRODUCT_STARTER_MONTHLY] = { plan: 'Starter', credits: BILLING_PLANS_V2.STARTER.coins }
  if (env.POLAR_PRODUCT_STARTER_YEARLY) mapping[env.POLAR_PRODUCT_STARTER_YEARLY] = { plan: 'Starter', credits: BILLING_PLANS_V2.STARTER.coins }
  if (env.POLAR_PRODUCT_CREATOR_MONTHLY) mapping[env.POLAR_PRODUCT_CREATOR_MONTHLY] = { plan: 'Creator', credits: BILLING_PLANS_V2.CREATOR.coins }
  if (env.POLAR_PRODUCT_CREATOR_YEARLY) mapping[env.POLAR_PRODUCT_CREATOR_YEARLY] = { plan: 'Creator', credits: BILLING_PLANS_V2.CREATOR.coins }
  if (env.POLAR_PRODUCT_STUDIO_MONTHLY) mapping[env.POLAR_PRODUCT_STUDIO_MONTHLY] = { plan: 'Studio', credits: BILLING_PLANS_V2.STUDIO.coins }
  if (env.POLAR_PRODUCT_STUDIO_YEARLY) mapping[env.POLAR_PRODUCT_STUDIO_YEARLY] = { plan: 'Studio', credits: BILLING_PLANS_V2.STUDIO.coins }
  return mapping[productId] || null
}

export async function POST(request: NextRequest) {
  try {
    const secret = process.env.POLAR_WEBHOOK_SECRET
    if (!secret) {
      console.error('[Polar-Webhook] POLAR_WEBHOOK_SECRET not set')
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })
    }
    const rawBody = await request.text()
    const webhookId = request.headers.get('webhook-id')
    const timestamp = request.headers.get('webhook-timestamp')
    const signature = request.headers.get('webhook-signature')
    if (!verifyWebhookSignature(rawBody, signature, webhookId, timestamp, secret)) {
      console.warn('[Polar-Webhook] Signature verification failed')
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
    }
    const payload = JSON.parse(rawBody)
    const eventType: string = payload.type
    const data = payload.data
    console.log(`[Polar-Webhook] Event: ${eventType}`)
    if (eventType === 'order.paid') {
      const productId = data.product?.id || data.productId
      const customerEmail = data.customer?.email || data.customerEmail
      const metadata = data.metadata || {}
      const resolved = resolveProductToPlan(productId)
      if (!resolved) {
        console.error(`[Polar-Webhook] Unknown product ID: ${productId}`)
        return NextResponse.json({ received: true, warning: 'unknown_product' })
      }
      await grantCreditsToUser(metadata.user_id, customerEmail, resolved.credits, resolved.plan, eventType, data.id || 'unknown', productId)
    }
    if (eventType === 'subscription.active') {
      const productId = data.product?.id || data.productId
      const customerEmail = data.customer?.email
      const metadata = data.metadata || {}
      const resolved = resolveProductToPlan(productId)
      if (!resolved) {
        console.error(`[Polar-Webhook] Unknown product ID on renewal: ${productId}`)
        return NextResponse.json({ received: true, warning: 'unknown_product' })
      }
      await grantCreditsToUser(metadata.user_id, customerEmail, resolved.credits, resolved.plan, eventType, data.id || 'unknown', productId)
    }
    if (eventType === 'subscription.canceled' || eventType === 'subscription.revoked') {
      const customerEmail = data.customer?.email
      console.log(`[Polar-Webhook] Subscription ${eventType} for ${customerEmail || 'unknown'}`)
    }
    return NextResponse.json({ received: true })
  } catch (error: any) {
    console.error('[Polar-Webhook] Unhandled error:', error.message || error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

async function grantCreditsToUser(
  userId: string | undefined,
  customerEmail: string | undefined,
  credits: number,
  planName: string,
  eventType: string,
  orderId: string,
  productId: string
) {
  const supabaseAdmin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
  if (!userId && customerEmail) {
    const { data: users, error } = await supabaseAdmin.auth.admin.listUsers()
    if (!error && users.users) {
      const user = users.users.find((u) => u.email?.toLowerCase() === customerEmail.toLowerCase())
      if (user) userId = user.id
    }
  }
  if (!userId) {
    console.error(`[Polar-Webhook] Cannot resolve user. email=${customerEmail}`)
    return
  }
  const { data: newBalance, error: rpcError } = await supabaseAdmin.rpc('admin_grant_credits', {
    p_user_id: userId,
    p_amount: credits,
    p_reason: 'purchase',
    p_metadata: { source: 'polar', event: eventType, order_id: orderId, product_id: productId, plan: planName, email: customerEmail },
  })
  if (rpcError) {
    console.error(`[Polar-Webhook] admin_grant_credits failed:`, rpcError)
  } else {
    console.log(`[Polar-Webhook] Credits granted to ${userId}. Balance: ${newBalance}`)
  }
}
