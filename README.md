# WAMS

WhatsApp reminders for one company. Staff add customers, sync approved Meta templates, and schedule a recurring message for a single customer. Inbound STOP opts that customer out.

This version uses the official WhatsApp Cloud API. It does not send free-form marketing text on a timer, and it does not message someone who has not opted in.

## What you can do

- Create one company workspace per account
- Connect a WhatsApp Business phone number with a permanent token
- Add customers, or import them from CSV
- Record service and marketing opt-in separately
- Sync templates from Meta
- Schedule a daily, weekly, monthly, or every-N-days reminder for one customer
- Send due reminders from the dashboard, or from a cron job
- Keep a send log with delivery updates
- Honor STOP, and the WhatsApp marketing-message preference

## Setup

1. Create a Supabase project.
2. Open the SQL editor and run `supabase/migrations/20261003180000_init.sql`.
3. In Authentication, turn off email confirmation for a local trial.
4. Copy `.env.example` to `.env.local` and fill in the Supabase URL, anon key, and service role key.
5. Set `WHATSAPP_WEBHOOK_VERIFY_TOKEN`, `META_APP_SECRET`, and `CRON_SECRET` to long random strings.
6. `npm install`
7. `npm run dev`

Sign up at `/signup`. That creates the company through a database trigger.

## WhatsApp

In a Meta app with the WhatsApp product:

- Copy the WhatsApp Business Account ID and Phone number ID into Settings.
- Create a system user token with `whatsapp_business_messaging` and `whatsapp_business_management`.
- Create message templates in WhatsApp Manager and wait until they are approved.
- Set the webhook callback to `https://your-domain/api/webhooks/whatsapp`.
- Use the verify token from `.env.local`.
- Subscribe to the `messages` field.

Utility templates require the service opt-in flag. Marketing templates require the marketing opt-in flag. Templates with a media header or a dynamic button URL are synced, then marked as not usable.

A new phone number has a low daily cap. Rate-limit errors are retried 15 minutes later. Missed months are not backfilled.

## Sending on a schedule

The dashboard button **Send due reminders** sends whatever is due for the signed-in company.

For automatic sending, call this every minute:

```bash
curl -H "Authorization: Bearer $CRON_SECRET" https://your-domain/api/cron/dispatch
```

`vercel.json` registers that path as a Vercel Cron. Hobby plans may not allow a per-minute schedule; use an external scheduler if so.

## CSV

Headers: `first_name`, `last_name`, `phone`, `email`, `tags`, `service_opt_in`, `marketing_opt_in`, `notes`.

Separate tags with `|`. A sample file is at `/sample-customers.csv`. Numbers without `+` use the calling code on the import form. Re-importing a customer who sent STOP does not opt them back in.

## Tests

```bash
npm test
```
