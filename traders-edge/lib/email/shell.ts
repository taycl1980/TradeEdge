// Shared HTML shell for transactional emails. All templates pass their
// inner body and a preheader (the snippet shown next to the subject in
// most inboxes — invisible in the email itself).
//
// Design: deliberately plain. Most email clients strip CSS, mobile
// rendering varies, and Apple Mail / Outlook handle inline styles
// inconsistently. Sticking to a narrow palette of inline-styled blocks
// renders consistently across Gmail, Apple Mail, Outlook, and Yahoo.

export function emailShell(opts: {
  preheader: string;
  body: string;
  ctaHref?: string;
  ctaLabel?: string;
  footerNote?: string;
}): string {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://example.com';
  const productName = "Trader's Edge";
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="color-scheme" content="light only" />
  <title>${productName}</title>
</head>
<body style="margin:0;padding:0;background:#faf7f2;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:#1a1816;">
  <!-- Preheader: shown in inbox preview, hidden in body -->
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:#faf7f2;">
    ${escapeHtml(opts.preheader)}
  </div>
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#faf7f2;">
    <tr>
      <td align="center" style="padding:32px 16px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="560" style="max-width:560px;background:#fffdf9;border:1px solid rgba(60,40,15,0.08);border-radius:14px;">
          <tr>
            <td style="padding:28px 32px 8px;">
              <div style="font-family:Georgia,'Source Serif 4',serif;font-size:20px;font-weight:600;color:#1a1816;letter-spacing:-0.01em;">
                ${productName}
              </div>
            </td>
          </tr>
          <tr>
            <td style="padding:8px 32px 24px;font-size:15px;line-height:1.65;color:#3a3530;">
              ${opts.body}
              ${opts.ctaHref && opts.ctaLabel ? `
                <div style="margin:24px 0 8px;">
                  <a href="${opts.ctaHref}"
                     style="display:inline-block;background:#0a7c5f;color:#fffdf9;text-decoration:none;font-weight:600;padding:11px 22px;border-radius:7px;font-size:14px;">
                    ${escapeHtml(opts.ctaLabel)}
                  </a>
                </div>
              ` : ''}
            </td>
          </tr>
          <tr>
            <td style="padding:18px 32px 28px;border-top:1px solid rgba(60,40,15,0.08);font-size:12px;color:#8f8678;line-height:1.6;">
              ${opts.footerNote ? `<div style="margin-bottom:10px;">${opts.footerNote}</div>` : ''}
              <div>You're receiving this because you have a ${productName} account.</div>
              <div style="margin-top:6px;">
                <a href="${siteUrl}/legal/privacy" style="color:#5d564d;text-decoration:underline;">Privacy</a>
                &nbsp;·&nbsp;
                <a href="${siteUrl}/legal/terms" style="color:#5d564d;text-decoration:underline;">Terms</a>
                &nbsp;·&nbsp;
                <a href="${siteUrl}/dashboard/settings" style="color:#5d564d;text-decoration:underline;">Email preferences</a>
              </div>
              <div style="margin-top:10px;color:#a59c8e;">
                Decision support against your own checklist — not financial advice.
              </div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
