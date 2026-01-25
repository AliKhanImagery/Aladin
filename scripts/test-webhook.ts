
import crypto from 'crypto';

// CONFIGURATION
// Replace with your local or staging URL
const WEBHOOK_URL = 'http://localhost:3000/api/webhooks/lemon-squeezy';
// Replace with the secret you added to .env.local
const SECRET = process.env.LEMON_SQUEEZY_WEBHOOK_SECRET || 'test_secret'; 

// MOCK DATA
// Replace with one of your actual variant IDs from src/constants/billing.ts
// e.g., Starter Monthly: '1246457'
const TEST_VARIANT_ID = '1246457'; 
const TEST_EMAIL = 'alikhanimagery@gmail.com'; // Ensure this user exists in your local Supabase or Auth

async function runSmokeTest() {
  console.log('🚀 Starting Webhook Smoke Test...');
  console.log(`Target: ${WEBHOOK_URL}`);
  console.log(`Variant ID: ${TEST_VARIANT_ID}`);

  // Construct Mock Payload matches Lemon Squeezy format
  const payload = {
    meta: {
      event_name: 'order_created',
      custom_data: {
        // user_id: 'OPTIONAL_USER_ID_IF_KNOWN' 
      }
    },
    data: {
      id: 'ORDER_TEST_' + Date.now(),
      type: 'orders',
      attributes: {
        user_email: TEST_EMAIL,
        variant_id: TEST_VARIANT_ID,
        first_subscription_item: {
            variant_id: TEST_VARIANT_ID
        },
        status: 'paid'
      }
    }
  };

  const rawBody = JSON.stringify(payload);

  // Generate Signature
  const hmac = crypto.createHmac('sha256', SECRET);
  const signature = hmac.update(rawBody).digest('hex');

  console.log('📝 Generated Signature:', signature);

  try {
    const response = await fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-signature': signature
      },
      body: rawBody
    });

    const result = await response.json();
    
    console.log('--- Response ---');
    console.log('Status:', response.status);
    console.log('Body:', JSON.stringify(result, null, 2));

    if (response.status === 200) {
      console.log('✅ Smoke Test PASSED: Webhook accepted.');
    } else {
      console.log('❌ Smoke Test FAILED: Webhook rejected.');
    }

  } catch (error) {
    console.error('❌ Network Error:', error);
  }
}

runSmokeTest();
