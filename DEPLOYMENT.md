# Deployment Checklist

Production app domain: `https://clinic-tsukisoi.jp`

Recommended Auth email domain: `auth.clinic-tsukisoi.jp`

## 1. Supabase

1. Run `supabase/schema.sql` in the Supabase SQL Editor for a fresh project.
2. If the project already has the old RLS policies, run `supabase/fix-rls-recursion.sql`.
3. Create a private Storage bucket named `reservation-images`.
4. Enable Supabase Auth email/password sign-in.
5. For production Auth email, configure custom SMTP. Resend settings:

```txt
SMTP Host: smtp.resend.com
SMTP Port: 587
SMTP Username: resend
SMTP Password: your Resend API key
Sender email: no-reply@your-verified-domain
Sender name: つきそい
```

Use a verified sending domain in Resend before setting the sender email.

For this project, use:

```txt
Sender email: no-reply@auth.clinic-tsukisoi.jp
Sender name: つきそい
```

Supabase Auth URL settings:

```txt
Site URL: https://clinic-tsukisoi.jp
Redirect URLs:
  https://clinic-tsukisoi.jp
  https://clinic-tsukisoi.jp/**
  https://clinic-escort-app.vercel.app
  https://clinic-escort-app.vercel.app/**
```

## 2. Vercel

Set these environment variables in Vercel Project Settings:

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
NEXT_PUBLIC_SUPABASE_RESERVATION_BUCKET=reservation-images
NEXT_PUBLIC_APP_URL=https://clinic-tsukisoi.jp
```

Then deploy the GitHub repository from Vercel.

Add `clinic-tsukisoi.jp` in Vercel Project Settings > Domains.
Keep `clinic-escort-app.vercel.app` as the fallback preview URL.

Typical DNS records:

```txt
clinic-tsukisoi.jp        A      76.76.21.21
www.clinic-tsukisoi.jp    CNAME  cname.vercel-dns.com
```

Use the exact DNS records Vercel shows if they differ.

## 3. Resend DNS

Add `auth.clinic-tsukisoi.jp` in Resend Domains.
Resend will show DNS records for DKIM, SPF, and DMARC. Add those exact records at your DNS provider, then verify them in Resend.

## 4. LINE MVP

The app does not use restricted LINE notification features.
It uses LINE share URLs so users can manually send:

- Group invitation links
- Appointment share links
- Companion assignment notices

Automatic LINE push notifications can be added later through a LINE Official Account and Messaging API.
