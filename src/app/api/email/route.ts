import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';

function getResendClient() {
  const key = process.env.RESEND_API_KEY;
  if (!key) return null;
  return new Resend(key);
}

const HERO_IMAGE = 'https://geniferai.com/email/ChatGPT%20Image%20Jul%2012%2C%202026%2C%2004_48_39%20AM.png';

function baseLayout(content: string): string {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="background:#020617;padding:0;margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
<table role="presentation" width="100%" style="max-width:600px;margin:0 auto;border-collapse:collapse;">
<tr><td style="background-color:#0F172A;background-image:linear-gradient(135deg,rgb(2,6,23) 0%,rgb(15,23,42) 100%);">

  <!-- header -->
  <table role="presentation" width="100%" style="border-collapse:collapse;">
  <tr><td style="padding:32px 44px 0;">
    <table role="presentation" style="border-collapse:collapse;">
    <tr>
      <td style="width:30px;height:30px;background:#14D98A;border-radius:8px;text-align:center;vertical-align:middle;">
        <span style="color:#020617;font-size:13px;font-weight:900;line-height:30px;">▶</span>
      </td>
      <td style="padding-left:9px;vertical-align:middle;">
        <span style="color:#ffffff;font-size:14px;font-weight:800;">genifer<span style="color:#14D98A;">AI</span></span>
      </td>
    </tr>
    </table>
  </td></tr>
  </table>

  <!-- hero image -->
  <table role="presentation" width="100%" style="border-collapse:collapse;">
  <tr><td style="padding:28px 0 0;">
    <img src="${HERO_IMAGE}" width="600" alt="GenIfer AI — One AI. Every Platform." style="display:block;width:100%;max-width:600px;border:0;">
  </td></tr>
  </table>

  ${content}

  <!-- social icons -->
  <table role="presentation" width="100%" style="border-collapse:collapse;">
  <tr><td style="padding:44px 44px 0;text-align:center;">
    <table role="presentation" style="margin:0 auto;border-collapse:collapse;">
    <tr>
      <td style="padding:0 8px;">
        <a href="https://instagram.com/geniferai" style="display:inline-block;width:34px;height:34px;background:rgba(255,255,255,0.06);border-radius:50%;text-align:center;line-height:34px;color:#94A3B8;font-size:11px;font-weight:700;text-decoration:none;">IG</a>
      </td>
      <td style="padding:0 8px;">
        <a href="https://x.com/geniferai" style="display:inline-block;width:34px;height:34px;background:rgba(255,255,255,0.06);border-radius:50%;text-align:center;line-height:34px;color:#94A3B8;font-size:11px;font-weight:700;text-decoration:none;">X</a>
      </td>
      <td style="padding:0 8px;">
        <a href="https://tiktok.com/@geniferai" style="display:inline-block;width:34px;height:34px;background:rgba(255,255,255,0.06);border-radius:50%;text-align:center;line-height:34px;color:#94A3B8;font-size:11px;font-weight:700;text-decoration:none;">TT</a>
      </td>
      <td style="padding:0 8px;">
        <a href="https://youtube.com/@geniferai" style="display:inline-block;width:34px;height:34px;background:rgba(255,255,255,0.06);border-radius:50%;text-align:center;line-height:34px;color:#94A3B8;font-size:11px;font-weight:700;text-decoration:none;">YT</a>
      </td>
    </tr>
    </table>
  </td></tr>
  </table>

  <!-- footer -->
  <table role="presentation" width="100%" style="border-collapse:collapse;">
  <tr><td style="padding:24px 44px 36px;text-align:center;">
    <p style="margin:0;color:#475569;font-size:10px;letter-spacing:0.1em;">GENIFER AI · <a href="{{unsubscribe}}" style="color:#475569;">UNSUBSCRIBE</a></p>
  </td></tr>
  </table>

</td></tr>
</table>
</body>
</html>`;
}

function welcomeContent(name?: string): string {
  return `
  <table role="presentation" width="100%" style="border-collapse:collapse;">
  <tr><td style="padding:40px 44px 0;">
    <span style="display:block;color:#64748B;font-size:11px;font-weight:700;letter-spacing:0.25em;text-transform:uppercase;margin-bottom:14px;">Studio initialized</span>
    <h1 style="margin:0 0 14px;font-family:Georgia,'Times New Roman',serif;font-style:italic;font-weight:700;font-size:32px;line-height:1.15;color:#ffffff;">
      ${name ? `${name}, your` : 'Your'} studio is <span style="color:#14D98A;">live.</span>
    </h1>
    <p style="margin:0;max-width:440px;color:#94A3B8;font-size:15px;line-height:1.7;">
      No crew. No gear rental. No waiting on anyone's schedule but yours. Here's what's already inside.
    </p>
  </td></tr>
  </table>

  <table role="presentation" width="100%" style="border-collapse:collapse;">
  <tr><td style="padding:32px 44px 0;">
    <div style="height:1px;background:rgba(255,255,255,0.08);"></div>
  </td></tr>
  </table>

  <table role="presentation" width="100%" style="border-collapse:collapse;">
  <tr><td style="padding:32px 44px 0;">
    <table role="presentation" width="100%" style="border-collapse:collapse;">
    <tr>
      <td style="width:44px;vertical-align:top;padding-top:2px;">
        <div style="width:36px;height:36px;background:rgba(20,217,138,0.08);border:1px solid rgba(20,217,138,0.2);border-radius:8px;text-align:center;line-height:36px;color:#14D98A;font-size:16px;">✎</div>
      </td>
      <td style="padding-left:16px;vertical-align:top;">
        <p style="margin:0 0 3px;color:#ffffff;font-size:15px;font-weight:700;">One prompt. Full video.</p>
        <p style="margin:0;color:#94A3B8;font-size:13px;line-height:1.6;">Idea to storyboard to final cut — no manual grind between steps.</p>
      </td>
    </tr>
    </table>
  </td></tr>
  </table>

  <table role="presentation" width="100%" style="border-collapse:collapse;">
  <tr><td style="padding:20px 44px 0;">
    <table role="presentation" width="100%" style="border-collapse:collapse;">
    <tr>
      <td style="width:44px;vertical-align:top;padding-top:2px;">
        <div style="width:36px;height:36px;background:rgba(20,217,138,0.08);border:1px solid rgba(20,217,138,0.2);border-radius:8px;text-align:center;line-height:36px;color:#14D98A;font-size:16px;">◈</div>
      </td>
      <td style="padding-left:16px;vertical-align:top;">
        <p style="margin:0 0 3px;color:#ffffff;font-size:15px;font-weight:700;">Every engine, one plan.</p>
        <p style="margin:0;color:#94A3B8;font-size:13px;line-height:1.6;">Premium, Artistic, Fast — switch styles without switching tools.</p>
      </td>
    </tr>
    </table>
  </td></tr>
  </table>

  <table role="presentation" width="100%" style="border-collapse:collapse;">
  <tr><td style="padding:20px 44px 0;">
    <table role="presentation" width="100%" style="border-collapse:collapse;">
    <tr>
      <td style="width:44px;vertical-align:top;padding-top:2px;">
        <div style="width:36px;height:36px;background:rgba(20,217,138,0.08);border:1px solid rgba(20,217,138,0.2);border-radius:8px;text-align:center;line-height:36px;color:#14D98A;font-size:16px;">⬇</div>
      </td>
      <td style="padding-left:16px;vertical-align:top;">
        <p style="margin:0 0 3px;color:#ffffff;font-size:15px;font-weight:700;">Export in minutes.</p>
        <p style="margin:0;color:#94A3B8;font-size:13px;line-height:1.6;">Ready-to-post cuts, sized for every platform.</p>
      </td>
    </tr>
    </table>
  </td></tr>
  </table>

  <table role="presentation" width="100%" style="border-collapse:collapse;">
  <tr><td style="padding:40px 44px 0;">
    <table role="presentation" style="border-collapse:collapse;">
    <tr><td style="background:#14D98A;border-radius:10px;">
      <a href="https://geniferai.com" style="display:inline-block;padding:15px 34px;color:#020617;font-size:13px;font-weight:800;text-decoration:none;letter-spacing:0.02em;">Start your first production →</a>
    </td></tr>
    </table>
  </td></tr>
  </table>`;
}

function waitlistContent(name?: string): string {
  return `
  <table role="presentation" width="100%" style="border-collapse:collapse;">
  <tr><td style="padding:40px 44px 0;">
    <span style="display:block;color:#64748B;font-size:11px;font-weight:700;letter-spacing:0.25em;text-transform:uppercase;margin-bottom:14px;">Position confirmed</span>
    <h1 style="margin:0 0 14px;font-family:Georgia,'Times New Roman',serif;font-style:italic;font-weight:700;font-size:32px;line-height:1.15;color:#ffffff;">
      ${name ? `${name}, you've` : "You've"} got <span style="color:#14D98A;">a seat.</span>
    </h1>
    <p style="margin:0;max-width:440px;color:#94A3B8;font-size:15px;line-height:1.7;">
      We'll write the moment the door opens. No need to check back — just watch your inbox.
    </p>
  </td></tr>
  </table>

  <table role="presentation" width="100%" style="border-collapse:collapse;">
  <tr><td style="padding:32px 44px 0;">
    <div style="height:1px;background:rgba(255,255,255,0.08);"></div>
  </td></tr>
  </table>

  <table role="presentation" width="100%" style="border-collapse:collapse;">
  <tr><td style="padding:32px 44px 0;">
    <p style="margin:0;color:#64748B;font-size:13px;line-height:1.7;font-style:italic;">
      While you wait — here's what's coming: one prompt to finished video, every engine in one place, export-ready in minutes.
    </p>
  </td></tr>
  </table>`;
}

function purchaseContent(name?: string, plan?: string): string {
  return `
  <table role="presentation" width="100%" style="border-collapse:collapse;">
  <tr><td style="padding:40px 44px 0;">
    <span style="display:block;color:#64748B;font-size:11px;font-weight:700;letter-spacing:0.25em;text-transform:uppercase;margin-bottom:14px;">Production unlocked</span>
    <h1 style="margin:0 0 14px;font-family:Georgia,'Times New Roman',serif;font-style:italic;font-weight:700;font-size:32px;line-height:1.15;color:#ffffff;">
      Full access.<br/><span style="color:#14D98A;">No limits.</span>
    </h1>
    <p style="margin:0;max-width:440px;color:#94A3B8;font-size:15px;line-height:1.7;">
      ${plan ? `Your ${plan} is active.` : 'Your plan is active.'} Every engine, every tool, every scene — sitting in your dashboard right now.
    </p>
  </td></tr>
  </table>

  <table role="presentation" width="100%" style="border-collapse:collapse;">
  <tr><td style="padding:32px 44px 0;">
    <div style="height:1px;background:rgba(255,255,255,0.08);"></div>
  </td></tr>
  </table>

  <table role="presentation" width="100%" style="border-collapse:collapse;">
  <tr><td style="padding:32px 44px 0;">
    <table role="presentation" width="100%" style="border-collapse:collapse;">
    <tr>
      <td style="width:44px;vertical-align:top;padding-top:2px;">
        <div style="width:36px;height:36px;background:rgba(20,217,138,0.08);border:1px solid rgba(20,217,138,0.2);border-radius:8px;text-align:center;line-height:36px;color:#14D98A;font-size:16px;">✎</div>
      </td>
      <td style="padding-left:16px;vertical-align:top;">
        <p style="margin:0 0 3px;color:#ffffff;font-size:15px;font-weight:700;">One prompt. Full video.</p>
        <p style="margin:0;color:#94A3B8;font-size:13px;line-height:1.6;">Idea to storyboard to final cut — no manual grind between steps.</p>
      </td>
    </tr>
    </table>
  </td></tr>
  </table>

  <table role="presentation" width="100%" style="border-collapse:collapse;">
  <tr><td style="padding:20px 44px 0;">
    <table role="presentation" width="100%" style="border-collapse:collapse;">
    <tr>
      <td style="width:44px;vertical-align:top;padding-top:2px;">
        <div style="width:36px;height:36px;background:rgba(20,217,138,0.08);border:1px solid rgba(20,217,138,0.2);border-radius:8px;text-align:center;line-height:36px;color:#14D98A;font-size:16px;">◈</div>
      </td>
      <td style="padding-left:16px;vertical-align:top;">
        <p style="margin:0 0 3px;color:#ffffff;font-size:15px;font-weight:700;">Every engine, one plan.</p>
        <p style="margin:0;color:#94A3B8;font-size:13px;line-height:1.6;">Premium, Artistic, Fast — switch styles without switching tools.</p>
      </td>
    </tr>
    </table>
  </td></tr>
  </table>

  <table role="presentation" width="100%" style="border-collapse:collapse;">
  <tr><td style="padding:40px 44px 0;">
    <table role="presentation" style="border-collapse:collapse;">
    <tr><td style="background:#14D98A;border-radius:10px;">
      <a href="https://geniferai.com/dashboard" style="display:inline-block;padding:15px 34px;color:#020617;font-size:13px;font-weight:800;text-decoration:none;letter-spacing:0.02em;">Open your dashboard →</a>
    </td></tr>
    </table>
  </td></tr>
  </table>`;
}

export async function POST(req: NextRequest) {
  try {
    const { type, to, toName, data } = await req.json();

    if (!type || !to) {
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
    }

    const templates: Record<string, { subject: string; html: string }> = {
      welcome: {
        subject: 'Your studio is live — GenIfer AI',
        html: baseLayout(welcomeContent(toName)),
      },
      waitlist: {
        subject: "You've got a seat — GenIfer AI",
        html: baseLayout(waitlistContent(toName)),
      },
      purchase_confirm: {
        subject: "Full access unlocked — GenIfer AI",
        html: baseLayout(purchaseContent(toName, data?.plan)),
      },
    };

    const template = templates[type];
    if (!template) {
      return NextResponse.json({ error: 'Unknown template' }, { status: 400 });
    }

    const resend = getResendClient();
    if (!resend) {
      return NextResponse.json({ error: 'RESEND_API_KEY not configured' }, { status: 500 });
    }

    const { error } = await resend.emails.send({
      from: 'GenIfer AI <hello@geniferai.com>',
      to,
      subject: template.subject,
      html: template.html,
    });

    if (error) {
      console.error('[email]', error);
      return NextResponse.json({ error: 'Failed to send' }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[email]', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
