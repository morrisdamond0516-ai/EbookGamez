import { Resend } from 'resend';

let connectionSettings: any;

async function getCredentials() {
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY
    ? 'repl ' + process.env.REPL_IDENTITY
    : process.env.WEB_REPL_RENEWAL
    ? 'depl ' + process.env.WEB_REPL_RENEWAL
    : null;

  if (!xReplitToken) {
    throw new Error('X-Replit-Token not found');
  }

  connectionSettings = await fetch(
    'https://' + hostname + '/api/v2/connection?include_secrets=true&connector_names=resend',
    {
      headers: {
        'Accept': 'application/json',
        'X-Replit-Token': xReplitToken
      }
    }
  ).then(res => res.json()).then(data => data.items?.[0]);

  if (!connectionSettings || !connectionSettings.settings.api_key) {
    throw new Error('Resend not connected');
  }
  return {
    apiKey: connectionSettings.settings.api_key,
    fromEmail: connectionSettings.settings.from_email
  };
}

async function getResendClient() {
  const { apiKey } = await getCredentials();
  return {
    client: new Resend(apiKey),
    fromEmail: connectionSettings.settings.from_email
  };
}

const emailWrapper = (content: string) => `
  <div style="font-family: Georgia, serif; max-width: 600px; margin: 0 auto; padding: 0; background: #0f0f1a;">
    <div style="background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); padding: 30px 24px; border-bottom: 3px solid #c4a35a;">
      <h1 style="color: #c4a35a; font-size: 26px; margin: 0; letter-spacing: 1px;">EbookGamez</h1>
      <p style="color: #8a7e6b; font-size: 12px; margin: 6px 0 0; letter-spacing: 2px; text-transform: uppercase;">Premium Digital Library</p>
    </div>
    <div style="padding: 30px 24px; background: #1a1a2e;">
      ${content}
    </div>
    <div style="padding: 20px 24px; background: #0f0f1a; border-top: 1px solid #2a2a3e;">
      <p style="color: #555; font-size: 11px; margin: 0; line-height: 1.6;">
        EbookGamez — P.O. Box 1181, Las Vegas, NV 89125<br/>
        <a href="https://ebookgamez.com" style="color: #c4a35a; text-decoration: none;">ebookgamez.com</a> |
        <a href="mailto:ebookgamez@yahoo.com" style="color: #c4a35a; text-decoration: none;">Contact Us</a>
      </p>
    </div>
  </div>
`;

const ctaButton = (text: string, url: string) => `
  <div style="text-align: center; margin: 28px 0;">
    <a href="${url}" style="background: linear-gradient(135deg, #c4a35a 0%, #d4b86a 100%); color: #1a1a2e; padding: 14px 36px; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 16px; display: inline-block;">${text}</a>
  </div>
`;

export async function sendPasswordResetEmail(toEmail: string, resetToken: string) {
  const { client, fromEmail } = await getResendClient();

  const baseUrl = process.env.REPLIT_DEV_DOMAIN
    ? `https://${process.env.REPLIT_DEV_DOMAIN}`
    : process.env.REPLIT_DEPLOYMENT_URL
    ? `https://${process.env.REPLIT_DEPLOYMENT_URL}`
    : 'https://ebookgamez.com';

  const resetLink = `${baseUrl}/reset-password?token=${resetToken}`;
  const sender = 'EbookGamez <noreply@ebookgamez.com>';
  console.log(`[Email] Sending password reset to ${toEmail} from ${sender}`);

  const result = await client.emails.send({
    from: sender,
    to: toEmail,
    subject: 'Reset Your EbookGamez Password',
    html: emailWrapper(`
      <h2 style="color: #e0d6c8; font-size: 20px; margin-top: 0;">Password Reset Request</h2>
      <p style="line-height: 1.6; color: #b0a898;">We received a request to reset your password. Click the button below to create a new password:</p>
      ${ctaButton('Reset Password', resetLink)}
      <p style="line-height: 1.6; color: #b0a898; font-size: 14px;">This link expires in 1 hour. If you didn't request this, you can safely ignore this email.</p>
    `)
  });
  console.log(`[Email] Password reset result:`, JSON.stringify(result));
}

export async function sendWelcomeEmail(toEmail: string, name?: string) {
  const { client, fromEmail } = await getResendClient();
  const sender = 'EbookGamez <noreply@ebookgamez.com>';
  console.log(`[Email] Sending welcome email to ${toEmail}`);

  await client.emails.send({
    from: sender,
    to: toEmail,
    subject: `Welcome to EbookGamez${name ? ', ' + name : ''}! Here's your 10% off code`,
    html: emailWrapper(`
      <h2 style="color: #e0d6c8; font-size: 22px; margin-top: 0;">Welcome to Your New Digital Library${name ? ', ' + name : ''}!</h2>
      <p style="line-height: 1.8; color: #b0a898; font-size: 15px;">
        You now have access to <strong style="color: #c4a35a;">600+ premium ebooks</strong> across every genre — from bestseller-quality fiction to illustrated guides, activity books, and professional reference manuals.
      </p>

      <div style="background: linear-gradient(135deg, #2a2a3e 0%, #1e1e32 100%); border: 1px solid #c4a35a; border-radius: 8px; padding: 20px; margin: 24px 0; text-align: center;">
        <p style="color: #c4a35a; font-size: 13px; margin: 0 0 8px; text-transform: uppercase; letter-spacing: 2px;">First-Time Customer Discount</p>
        <p style="color: #fff; font-size: 32px; font-weight: bold; margin: 0; letter-spacing: 3px;">WELCOME10</p>
        <p style="color: #b0a898; font-size: 14px; margin: 8px 0 0;">10% off your first purchase</p>
      </div>

      <p style="color: #b0a898; font-size: 14px; line-height: 1.6;">Here's what makes EbookGamez different:</p>
      <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
        <tr>
          <td style="padding: 10px 12px; color: #c4a35a; font-size: 20px; width: 30px; vertical-align: top;">&#128214;</td>
          <td style="padding: 10px 0; color: #b0a898; font-size: 14px; line-height: 1.5;"><strong style="color: #e0d6c8;">Read Online Free</strong> — Preview any book right in your browser before buying</td>
        </tr>
        <tr>
          <td style="padding: 10px 12px; color: #c4a35a; font-size: 20px; width: 30px; vertical-align: top;">&#128229;</td>
          <td style="padding: 10px 0; color: #b0a898; font-size: 14px; line-height: 1.5;"><strong style="color: #e0d6c8;">DRM-Free Downloads</strong> — Buy once, keep forever in EPUB format</td>
        </tr>
        <tr>
          <td style="padding: 10px 12px; color: #c4a35a; font-size: 20px; width: 30px; vertical-align: top;">&#127775;</td>
          <td style="padding: 10px 0; color: #b0a898; font-size: 14px; line-height: 1.5;"><strong style="color: #e0d6c8;">Reading Pass</strong> — Unlimited reading + monthly download credits starting at $4.99/mo</td>
        </tr>
      </table>

      ${ctaButton('Start Browsing', 'https://ebookgamez.com/catalog')}

      <p style="color: #777; font-size: 12px; text-align: center; margin-top: 20px;">Use code <strong style="color: #c4a35a;">WELCOME10</strong> at checkout for 10% off your first order.</p>
    `)
  });
}

export async function sendSubscriptionOTPEmail(toEmail: string, code: string) {
  const { client } = await getResendClient();
  const sender = 'EbookGamez <noreply@ebookgamez.com>';
  console.log(`[Email] Sending subscription OTP to ${toEmail}`);

  await client.emails.send({
    from: sender,
    to: toEmail,
    subject: `Your EbookGamez verification code: ${code}`,
    html: emailWrapper(`
      <h2 style="color: #e0d6c8; font-size: 20px; margin-top: 0;">Verify Your Email</h2>
      <p style="line-height: 1.6; color: #b0a898; font-size: 15px;">
        Use the code below to access your subscription account:
      </p>

      <div style="background: linear-gradient(135deg, #2a2a3e 0%, #1e1e32 100%); border: 1px solid #c4a35a; border-radius: 8px; padding: 24px; margin: 24px 0; text-align: center;">
        <p style="color: #c4a35a; font-size: 13px; margin: 0 0 8px; text-transform: uppercase; letter-spacing: 2px;">Verification Code</p>
        <p style="color: #fff; font-size: 36px; font-weight: bold; margin: 0; letter-spacing: 8px; font-family: monospace;">${code}</p>
        <p style="color: #b0a898; font-size: 13px; margin: 12px 0 0;">This code expires in 10 minutes</p>
      </div>

      <p style="color: #777; font-size: 12px; text-align: center; margin-top: 20px;">If you didn't request this code, you can safely ignore this email.</p>
    `)
  });
}

export async function sendPlanChangeEmail(
  toEmail: string,
  fromPlanName: string,
  toPlanName: string,
  action: "upgraded" | "downgraded",
  newPrice: string,
  billingInterval: "monthly" | "annual",
  periodEnd: Date
) {
  const { client } = await getResendClient();
  const sender = 'EbookGamez <noreply@ebookgamez.com>';
  const actionWord = action === "upgraded" ? "Upgraded" : "Downgraded";
  const renewalDate = periodEnd.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  const subjectLine = `Your Reading Pass has been ${actionWord.toLowerCase()} to ${toPlanName}`;
  console.log(`[Email] Sending plan change email to ${toEmail}: ${fromPlanName} → ${toPlanName}`);

  await client.emails.send({
    from: sender,
    to: toEmail,
    subject: subjectLine,
    html: emailWrapper(`
      <h2 style="color: #e0d6c8; font-size: 20px; margin-top: 0;">Plan Change Confirmed ✓</h2>
      <p style="line-height: 1.6; color: #b0a898; font-size: 15px;">
        Your Reading Pass has been ${action === "upgraded" ? "upgraded" : "downgraded"} from <strong style="color: #c4a35a;">${fromPlanName} Pass</strong> to <strong style="color: #c4a35a;">${toPlanName} Pass</strong>. The change is effective immediately.
      </p>

      <div style="background: #2a2a3e; border-radius: 8px; padding: 20px; margin: 24px 0; border-left: 4px solid #c4a35a;">
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="color: #8a7e6b; font-size: 13px; padding: 4px 0;">New Plan</td>
            <td style="color: #e0d6c8; font-size: 14px; font-weight: bold; text-align: right;">${toPlanName} Pass</td>
          </tr>
          <tr>
            <td style="color: #8a7e6b; font-size: 13px; padding: 4px 0;">Billing</td>
            <td style="color: #e0d6c8; font-size: 14px; text-align: right;">${newPrice} / ${billingInterval === "annual" ? "year" : "month"}</td>
          </tr>
          <tr>
            <td style="color: #8a7e6b; font-size: 13px; padding: 4px 0;">Next Renewal</td>
            <td style="color: #e0d6c8; font-size: 14px; text-align: right;">${renewalDate}</td>
          </tr>
        </table>
      </div>

      <p style="line-height: 1.6; color: #b0a898; font-size: 14px;">
        Your billing has been prorated — any unused credit from your previous plan has been applied toward future invoices.
      </p>

      ${ctaButton('View My Reading Pass', 'https://ebookgamez.com/reading-pass')}

      <p style="line-height: 1.6; color: #7a7268; font-size: 13px;">
        Questions? Reply to this email or visit <a href="https://ebookgamez.com/contact" style="color: #c4a35a; text-decoration: none;">our contact page</a>.
      </p>
    `)
  });
}

export async function sendPurchaseThankYouEmail(toEmail: string, bookTitle: string, orderId: number) {
  const { client } = await getResendClient();
  const sender = 'EbookGamez <noreply@ebookgamez.com>';
  console.log(`[Email] Sending purchase thank-you to ${toEmail} for order #${orderId}`);

  await client.emails.send({
    from: sender,
    to: toEmail,
    subject: `Your EbookGamez order is ready! (#${orderId})`,
    html: emailWrapper(`
      <h2 style="color: #e0d6c8; font-size: 20px; margin-top: 0;">Thanks for your purchase!</h2>
      <p style="line-height: 1.6; color: #b0a898; font-size: 15px;">
        Your order <strong style="color: #c4a35a;">#${orderId}</strong> is confirmed. You can now access your book:
      </p>

      <div style="background: #2a2a3e; border-radius: 8px; padding: 16px; margin: 20px 0; border-left: 4px solid #c4a35a;">
        <p style="color: #e0d6c8; font-size: 16px; margin: 0 0 4px; font-weight: bold;">${bookTitle}</p>
        <p style="color: #b0a898; font-size: 13px; margin: 0;">Available to read online and download from your account</p>
      </div>

      ${ctaButton('Access Your Book', 'https://ebookgamez.com/my-account')}

      <div style="background: #16213e; border-radius: 8px; padding: 16px; margin: 24px 0;">
        <p style="color: #c4a35a; font-size: 13px; margin: 0 0 8px; font-weight: bold;">Did you know?</p>
        <p style="color: #b0a898; font-size: 13px; margin: 0; line-height: 1.6;">
          Our <strong style="color: #e0d6c8;">Reading Pass</strong> gives you unlimited reading access + monthly download credits. Plans start at just $4.99/mo — it pays for itself after one book!
        </p>
      </div>
    `)
  });
}
