# Multi-Tenant SaaS API: Email and Zero-Card Stack

Oct 8, 2026 · @Samuel

## Email options

Sending through Gmail directly with Nodemailer is the simplest domain-free, card-free option. Resend and Brevo are out: Resend only delivers to your own address until a domain is verified.

[Sendlib](https://sendlib.samueltuoyo.com/) is a thin REST relay that sends through a connected Gmail account over Google OAuth, so it needs no domain either.

| Option | Domain needed | Card needed | Daily limit | Notes |
| --- | --- | --- | --- | --- |
| Gmail via Nodemailer | No | No | About 500 (personal account) | App password (needs 2FA) or OAuth2; no third-party dependency |
| Sendlib (free plan) | No | No | 200 per connected Gmail; 3,500 per month | 30 API requests per minute; 5-day log retention |
| Resend / Brevo | Yes | No | n/a | Rejected: needs a verified domain |

Use a dedicated Gmail account for the project, not a personal one. Emails will show that Gmail address as the sender, and some may land in spam, which is acceptable for a demo.

## Recommended approach

Put email behind an `EmailProvider` interface (ports and adapters) and choose the implementation with an environment variable. A provider outage or quota limit then never blocks flows like user invitations.

1. **Mailpit** for local development and tests: a fake SMTP inbox that catches every message.
2. **Gmail via Nodemailer** as the default deployed provider.
3. **Sendlib** as an alternative adapter. If it is your own project, using it here doubles as a dogfooding story.

Swapping providers by configuration is also a clear demonstration of clean architecture for the portfolio.

## Updated stack, no card required

Every service below has a free tier that, as far as I know, needs no card. Three were replaced: file storage, hosting and email.

| Concern | Choice | Change from earlier suggestion |
| --- | --- | --- |
| Framework | NestJS (TypeScript) | None |
| Database | PostgreSQL on Neon | None |
| Redis (cache, rate limits) | Upstash | None |
| Background jobs | pg-boss (runs on Postgres) | None |
| File storage | Supabase Storage (S3-compatible) | Replaces Cloudflare R2, which asks for a payment method |
| Hosting | Render free web service | Replaces Oracle Cloud and Fly.io, which require card verification |
| Email | Gmail via Nodemailer, with adapters | Replaces Resend and Brevo, which need a domain |
| Errors and logs | Sentry, Grafana Cloud | None |
| CI | GitHub Actions | None |

## Notes

Free-tier terms change often, so confirm at signup that none of these services has started asking for a card.

- Render's free web service sleeps after about 15 minutes idle, so the first request after a pause is slow. Say so in the README.
- Skip Render's free Postgres, which expires; Neon covers the database.
- Put file storage behind a `StorageProvider` interface, like email, so a change to Supabase's free tier means swapping one adapter.

Sources: [Sendlib](https://sendlib.samueltuoyo.com/)
