import type { Env } from './http';

export async function sendMail(
  env: Env,
  to: string,
  subject: string,
  text: string,
): Promise<boolean> {
  const apiKey = env.RESEND_API_KEY;
  const from = env.RESEND_FROM;
  if (apiKey === undefined || apiKey.length === 0 || from === undefined || from.length === 0) {
    return false;
  }

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ from, to: [to], subject, text }),
  });
  return response.ok;
}
