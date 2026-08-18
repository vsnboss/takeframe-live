# TAKEFRAME — website and commercial runtime

Production website and commercial backend for **TAKEFRAME**, VSN's professional football broadcast graphics and live-production system.

This repository owns `takeframe.live`: the public website, pricing/checkout flow, My TAKEFRAME account area, Revolut Merchant integration, commercial source of truth, and public licensing APIs. It does **not** contain the TAKEFRAME Windows broadcast application.

## Design source

```
design/
  Main.dc.html      Homepage — desktop artboard
  Mobile.dc.html    Homepage — mobile artboard
  canvas.json       Artboard layout and handover notes
  img/              Derived webp assets
assets/media/       Original TAKEFRAME product media
assets/logos/       Official TAKEFRAME logo assets
```

The production website lives in `site/`. The approved visual/pricing baseline is intentionally kept separate from commercial backend work.

## Production website

```
site/
  index.html
  pricing.html
  subscribe.html
  welcome.html
  account.html
  styles.css
  fonts.css
  assets/
  api/
```

The site is static HTML/CSS with Vercel serverless functions. The Vercel project is deployed from the **repository root**; root `api/` entrypoints and `vercel.json` bridge the public routes to the implementation in `site/api/`.

## Commercial model

TAKEFRAME has no perpetual licence and no paid feature tiers. Every paid plan carries the full product.

| Plan | Price | Commercial rule |
| --- | ---: | --- |
| Evaluation | €0 | 7 days, no card, watermarked output |
| Match Pass | €79 once | One unused Match Pass credit; 72-hour timer starts only when activated for a match |
| Monthly | €169/month | Full TAKEFRAME subscription |
| Annual | €1,690/year | Full TAKEFRAME subscription |

Standard paid authority allows **2 registered Windows production computers** and **1 simultaneous clean production**. Custom league concurrency is handled commercially rather than as a public pricing tier.

## Production commerce architecture

```text
pricing / subscribe
        ↓
TAKEFRAME commerce API
        ↓
Revolut Business Merchant API
        ↓
verified Revolut webhook
        ↓
TAKEFRAME Supabase commercial DB
        ↓
signed Ed25519 entitlement
        ↓
TAKEFRAME app licensing API
```

The browser redirect after checkout is never entitlement authority. Paid state is granted only from verified server-side provider state.

For subscriptions, a new TAKEFRAME licence requires an **active Revolut subscription plus a current billing cycle backed by an authoritative Revolut order in `completed` state**. A `pending` subscription cannot create a paid licence.

For Match Pass, an `ORDER_COMPLETED` authoritative re-read creates exactly one unused credit. Match Pass binding and its 72-hour clock are performed atomically when the pass is first activated by the app.

## Revolut Merchant

Production uses the current Merchant API host:

```text
https://merchant.revolut.com/api
```

and Merchant API version `2026-04-20`.

Paid checkout fails closed if a production Vercel deployment is configured for Revolut Sandbox.

Before creating the first paid customer/order/subscription, the commerce API ensures that the production webhook exists at:

```text
https://takeframe.live/api/webhook
```

The webhook signing secret returned by Revolut is stored directly in **Supabase Vault**. It is not exposed to browser code and is not stored as a Vercel environment variable.

Webhook processing is signature-verified over the raw request body, idempotent, retryable after failure, and always re-reads authoritative Revolut order/subscription state before mutating TAKEFRAME commercial authority.

## Supabase commercial source of truth

The TAKEFRAME Supabase project stores only the commercial/licensing state needed by the product rather than acting as a general CRM.

Core entities:

```text
customers
orders
subscriptions
licenses
devices
match_passes
production_leases
entitlements
webhook_events
audit_events
```

Runtime/security support includes:

```text
licensing_signing_keys
licensing_runtime_config
payment_provider_webhooks
```

All commercial tables have RLS enabled and are server-only by default. Public browser access to the commercial tables is not used.

Important database invariants include:

- customer email is unique for deterministic server upserts
- one setup order resolves to at most one TAKEFRAME subscription
- an active licence must have a concrete `valid_until`
- devices, entitlements, and production leases have exactly one licence/Match-Pass authority where applicable
- device registration is atomic under the authority lock so the 2-device limit cannot be raced
- Match Pass activation is atomic so one credit cannot be bound to two matches
- production concurrency is enforced atomically by database RPCs

## Signed entitlement authority

Entitlements use Ed25519 signatures. The private signing key is held in **Supabase Vault** and is retrievable only through service-role-only runtime authority. The matching public key is the verification authority for the TAKEFRAME application.

Signed payloads include the licence/pass authority, plan, device, device/concurrency limits, clean-output/watermark state, match binding where applicable, issue/valid/offline windows, and signing `keyId`.

The server does not persist a fake notion of being online. Offline authority is bounded by the signed `offlineUntil` value.

## Public licensing API

Canonical external routes:

```text
POST /v1/licenses/activate
POST /v1/licenses/refresh
POST /v1/licenses/deactivate
GET  /v1/licenses/status

POST /v1/match-passes/activate

POST /v1/productions/acquire
POST /v1/productions/heartbeat
POST /v1/productions/release
```

The repository-root Vercel routing maps `/v1/...` to the serverless API implementation.

## My TAKEFRAME

`/account` is a real authenticated customer area, not a placeholder. Passwordless email OTP authentication is provided by Supabase Auth and the session is held in secure server-side cookies.

Authenticated customers can see their current plan/licence status, paid-through state, TAKEFRAME licence key, unused Match Pass balance, registered production machines, and can deactivate a device. Server-side ownership is re-checked before customer data or device mutations are returned.

Unknown email addresses receive the same login-request response as known addresses to avoid account enumeration.

## Required Vercel environment variables

Production requires:

| Variable | Secret | Purpose |
| --- | :---: | --- |
| `REVOLUT_SECRET_KEY` | yes | Revolut Merchant production API authentication |
| `REVOLUT_ENV` | no | Must be `production` on the production deployment |
| `SUPABASE_URL` | no | TAKEFRAME Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | yes | Server-only commercial/Auth access |

Ed25519 private signing authority and the Revolut webhook signing secret are deliberately **not** Vercel environment variables; they live in Supabase Vault.

## Security rules

- Never grant entitlement from `/welcome` or any browser redirect.
- Never expose Revolut or Supabase server secrets to client JavaScript.
- Never use provider order/subscription IDs as TAKEFRAME licence keys.
- Never issue a paid subscription licence without verified paid authority.
- Never let Match Pass activation or device/concurrency limits rely on read-then-write application logic when an atomic DB operation is required.
- Never remotely terminate an already-running broadcast because a payment state changed mid-show.

## Claim discipline

Public product copy remains limited to verified capability: Windows operator application, local-first operation, Preview/Program/Take playout, NDI/OMT workflow output and the other capabilities explicitly approved in the website baseline. Do not introduce partner/certification/integration claims without evidence.

Third-party production systems are described as workflow-compatible where appropriate, not as partnerships. No third-party logos are used without permission.
