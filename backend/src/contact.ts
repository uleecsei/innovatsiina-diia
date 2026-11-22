import express from 'express';

export interface ContactMessage {
  name: string;
  email: string;
  message: string;
}

export type SendContactMessage = (message: ContactMessage) => Promise<void>;

const emailPattern = /^[^\s@<>(),;:"\\]+@[^\s@<>(),;:"\\]+\.[^\s@<>(),;:"\\]+$/u;

export function createContactSender(
  env: NodeJS.ProcessEnv = process.env,
): SendContactMessage | undefined {
  const key = env['RESEND_API_KEY']?.trim();
  const from = env['CONTACT_FROM']?.trim();
  const to = env['CONTACT_TO']?.trim();
  if (!key || !from || !to) return undefined;
  if (!emailPattern.test(to)) throw new Error('CONTACT_TO must be one email address');

  return async ({ name, email, message }) => {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from,
        to: [to],
        reply_to: email,
        subject: 'Нове повідомлення з сайту «Інноваційна дія»',
        text: `Ім’я: ${name}\nEmail: ${email}\n\nПовідомлення:\n${message}`,
      }),
      signal: AbortSignal.timeout(8000),
    });
    await response.body?.cancel();
    if (!response.ok) throw new Error(`Email provider returned HTTP ${response.status}`);
  };
}

export function createContactRouter(origins: readonly string[], send?: SendContactMessage) {
  const router = express.Router();
  const windowMs = 10 * 60 * 1000;
  const attempts: number[] = [];

  router.post(
    '/',
    (req, res, next) => {
      if (!origins.includes(req.get('origin') ?? '')) {
        res.sendStatus(403);
      } else if (!req.is('application/json')) {
        res.sendStatus(415);
      } else {
        next();
      }
    },
    express.json({ limit: '32kb' }),
    async (req, res) => {
      if (!send) {
        res.sendStatus(503);
        return;
      }

      const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
      const email = typeof req.body?.email === 'string' ? req.body.email.trim() : '';
      const message = typeof req.body?.message === 'string' ? req.body.message.trim() : '';
      if (
        !name ||
        name.length > 100 ||
        email.length > 254 ||
        !emailPattern.test(email) ||
        !message ||
        message.length > 3000
      ) {
        res.sendStatus(400);
        return;
      }

      const now = Date.now();
      while (attempts.length && attempts[0] <= now - windowMs) attempts.shift();
      if (attempts.length >= 10) {
        res.set('Retry-After', String(Math.ceil((attempts[0] + windowMs - now) / 1000)));
        res.sendStatus(429);
        return;
      }
      attempts.push(now);

      try {
        await send({ name, email, message });
        res.sendStatus(204);
      } catch {
        // Keep visitor inputs and provider credentials out of logs.
        console.error('Contact email delivery request failed');
        res.sendStatus(502);
      }
    },
  );
  const handleBodyError: express.ErrorRequestHandler = (error, _req, res, next) => {
    if (error?.status === 400 || error?.status === 413 || error?.status === 415) {
      res.sendStatus(error.status);
    } else {
      next(error);
    }
  };
  router.use(handleBodyError);
  return router;
}
