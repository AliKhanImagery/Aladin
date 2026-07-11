import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

const templates: Record<string, { subject: string; html: (name?: string) => string }> = {
  welcome: {
    subject: 'Welcome to GenIfer AI',
    html: (name) => `
      <p>Hi ${name ?? 'there'},</p>
      <p>You're in. Start creating your first video at <a href="https://geniferai.com">geniferai.com</a></p>
      <p>— The GenIfer team</p>
      <p style="font-size:11px;color:#888;margin-top:32px;">You're receiving this because you signed up at geniferai.com. <a href="{{unsubscribe}}">Unsubscribe</a></p>
    `,
  },
  waitlist: {
    subject: "You're on the GenIfer waitlist",
    html: (name) => `
      <p>Hi ${name ?? 'there'},</p>
      <p>We've got your spot. We'll email you the moment access opens.</p>
      <p>— The GenIfer team</p>
      <p style="font-size:11px;color:#888;margin-top:32px;">You're receiving this because you joined the waitlist at geniferai.com. <a href="{{unsubscribe}}">Unsubscribe</a></p>
    `,
  },
  purchase_confirm: {
    subject: "You're all set — GenIfer AI",
    html: (name) => `
      <p>Hi ${name ?? 'there'},</p>
      <p>Your plan is now active. Head to your dashboard and start creating.</p>
      <p><a href="https://geniferai.com/dashboard">Go to dashboard →</a></p>
      <p>— The GenIfer team</p>
      <p style="font-size:11px;color:#888;margin-top:32px;">You're receiving this because you purchased a plan at geniferai.com. <a href="{{unsubscribe}}">Unsubscribe</a></p>
    `,
  },
};

export async function POST(req: NextRequest) {
  try {
    const { type, to, toName } = await req.json();

    if (!type || !to) {
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
    }

    const template = templates[type];
    if (!template) {
      return NextResponse.json({ error: 'Unknown template' }, { status: 400 });
    }

    const { error } = await resend.emails.send({
      from: 'GenIfer AI <hello@geniferai.com>',
      to,
      subject: template.subject,
      html: template.html(toName),
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
