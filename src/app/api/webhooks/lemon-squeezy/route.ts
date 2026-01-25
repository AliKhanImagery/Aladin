import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'
import { BILLING_PLANS_V2 } from '@/constants/billing'

export async function POST(request: NextRequest) {
  try {
    // 1. Validate Lemon Squeezy Signature
    const secret = process.env.LEMON_SQUEEZY_WEBHOOK_SECRET
    if (!secret) {
      console.error('LEMON_SQUEEZY_WEBHOOK_SECRET not set')
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })
    }

    const rawBody = await request.text()
    const hmac = crypto.createHmac('sha256', secret)
    const digest = Buffer.from(hmac.update(rawBody).digest('hex'), 'utf8')

    const signature = Buffer.from(request.headers.get('x-signature') || '', 'utf8')

    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/129050c5-8ab3-425c-8423-399022a83f73',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'route.ts:20',message:'Webhook entry & sig check',data:{signatureHex: signature.toString('hex')},timestamp:Date.now(),sessionId:'debug-session', runId: 'run1', hypothesisId: 'all'})}).catch(()=>{});
    // #endregion

    if (!crypto.timingSafeEqual(digest, signature)) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
    }

    const payload = JSON.parse(rawBody)
    const eventName = payload.meta.event_name
    const data = payload.data

    console.log(`🍋 Lemon Squeezy Webhook: ${eventName}`, data.id)

    // 2. Handle 'order_created' or 'subscription_payment_success'
    if (eventName === 'order_created' || eventName === 'subscription_payment_success') {
      const attributes = data.attributes
      const variantId = attributes.first_subscription_item?.variant_id || attributes.variant_id
      const customerEmail = attributes.user_email
      const customData = payload.meta.custom_data || {} // Pass user_id here from frontend if possible

      // 3. Determine Credits to Grant based on Variant ID
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/129050c5-8ab3-425c-8423-399022a83f73',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'route.ts:40',message:'Processing webhook payload',data:{eventName, variantId, customerEmail},timestamp:Date.now(),sessionId:'debug-session', runId: 'run1', hypothesisId: '1,2'})}).catch(()=>{});
      // #endregion

      let creditsToAdd = 0
      let planName = 'unknown'

      // Lookup plan by variantId 
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/129050c5-8ab3-425c-8423-399022a83f73',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'route.ts:45',message:'Starting plan lookup',data:{targetId: variantId, targetType: typeof variantId, plansCount: Object.values(BILLING_PLANS_V2).length},timestamp:Date.now(),sessionId:'debug-session', runId: 'run3', hypothesisId: '2'})}).catch(()=>{});
      // #endregion

      const foundPlan = Object.values(BILLING_PLANS_V2).find(p => {
        const m = String(p.variantIdMonthly);
        const y = String(p.variantIdYearly);
        const v = String(variantId);
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/129050c5-8ab3-425c-8423-399022a83f73',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'route.ts:50',message:'Comparing plan',data:{plan: p.name, m, y, v, matchM: m === v, matchY: y === v},timestamp:Date.now(),sessionId:'debug-session', runId: 'run2', hypothesisId: '2'})}).catch(()=>{});
        // #endregion
        return m === v || y === v;
      })

      if (foundPlan) {
        creditsToAdd = foundPlan.coins
        planName = foundPlan.name
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/129050c5-8ab3-425c-8423-399022a83f73',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'route.ts:57',message:'Plan found',data:{planName, creditsToAdd},timestamp:Date.now(),sessionId:'debug-session', runId: 'run1', hypothesisId: '2'})}).catch(()=>{});
        // #endregion
      } else {
         // #region agent log
         fetch('http://127.0.0.1:7242/ingest/129050c5-8ab3-425c-8423-399022a83f73',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'route.ts:60',message:'Plan NOT found',data:{variantId},timestamp:Date.now(),sessionId:'debug-session', runId: 'run1', hypothesisId: '2'})}).catch(()=>{});
         // #endregion
         console.warn(`Variant ID ${variantId} not found in billing constants.`)
      }

      // If we identified credits to add
      if (creditsToAdd > 0) {
        // 4. Find User by Email (or custom_data.user_id)
        const supabaseAdmin = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!
        )

        let userId = customData.user_id
        
        if (!userId && customerEmail) {
            // Try to find user by email
            const { data: users, error: userError } = await supabaseAdmin.auth.admin.listUsers()
            if (!userError && users.users) {
                const user = users.users.find(u => u.email?.toLowerCase() === customerEmail.toLowerCase())
                if (user) userId = user.id
            }
            // #region agent log
            fetch('http://127.0.0.1:7242/ingest/129050c5-8ab3-425c-8423-399022a83f73',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'route.ts:80',message:'User lookup by email result',data:{customerEmail, foundUserId: userId, error: userError},timestamp:Date.now(),sessionId:'debug-session', runId: 'run1', hypothesisId: '1'})}).catch(()=>{});
            // #endregion
        }

        if (userId) {
            console.log(`Granting ${creditsToAdd} credits to user ${userId} for plan ${planName}`)
            
            // 5. Grant Credits via NEW SECURE RPC (admin_grant_credits)
            // #region agent log
            fetch('http://127.0.0.1:7242/ingest/129050c5-8ab3-425c-8423-399022a83f73',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'route.ts:88',message:'Calling admin_grant_credits',data:{userId, creditsToAdd},timestamp:Date.now(),sessionId:'debug-session', runId: 'run1', hypothesisId: '3'})}).catch(()=>{});
            // #endregion
            const { error: rpcError } = await supabaseAdmin.rpc('admin_grant_credits', {
                p_user_id: userId,
                p_amount: creditsToAdd,
                p_reason: 'purchase',
                p_metadata: {
                    source: 'lemon_squeezy',
                    event: eventName,
                    order_id: data.id,
                    variant_id: variantId,
                    plan: planName,
                    email: customerEmail
                }
            })

            if (rpcError) {
                // #region agent log
                fetch('http://127.0.0.1:7242/ingest/129050c5-8ab3-425c-8423-399022a83f73',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'route.ts:103',message:'RPC Error',data:{rpcError},timestamp:Date.now(),sessionId:'debug-session', runId: 'run1', hypothesisId: '3'})}).catch(()=>{});
                // #endregion
                console.error('Failed to grant credits:', rpcError)
                return NextResponse.json({ error: 'Failed to grant credits' }, { status: 500 })
            }
        } else {
            // #region agent log
            fetch('http://127.0.0.1:7242/ingest/129050c5-8ab3-425c-8423-399022a83f73',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'route.ts:108',message:'User not found, skipping grant',data:{customerEmail},timestamp:Date.now(),sessionId:'debug-session', runId: 'run1', hypothesisId: '1'})}).catch(()=>{});
            // #endregion
            console.error('User not found for email:', customerEmail)
            // Consider storing a "pending grant" if user doesn't exist yet
        }
      }
    }

    return NextResponse.json({ received: true })
  } catch (error: any) {
    console.error('Webhook error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
