# Security Policy

## Reporting a Vulnerability

If you discover a security vulnerability in Aura, **please do not open a public issue**. Instead, email:

📧 **security@<your-domain>**

Include:
- A description of the vulnerability and impact
- Steps to reproduce
- Affected versions / commits
- Any suggested mitigation

We aim to:
- Acknowledge receipt within **48 hours**
- Provide an initial assessment within **5 business days**
- Coordinate a fix and disclosure timeline with you

We will credit reporters in release notes unless they prefer to remain anonymous.

## Supported versions

Aura is pre-1.0. Security fixes are applied to the `main` branch only. Once we cut stable releases this policy will be updated.

## Scope

In scope:
- The Aura web app and its server functions
- Supabase migrations and RLS policies in this repo
- Public API endpoints under `/api/public/*`

Out of scope (please report to the upstream project):
- Vulnerabilities in TanStack Start, Supabase, Cloudflare Workers, or other dependencies

## Hardening checklist for self-hosters

- ✅ Keep `SUPABASE_SERVICE_ROLE_KEY` server-side only
- ✅ Enable RLS on every table (the repo enforces this; don't disable it)
- ✅ Rotate API keys regularly
- ✅ Configure email/auth providers with your own domain
- ✅ Enable Cloudflare Access or similar in front of admin routes if self-hosting
