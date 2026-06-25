# Deployment Checklist

## 1. Supabase

1. Run `supabase/schema.sql` in the Supabase SQL Editor for a fresh project.
2. If the project already has the old RLS policies, run `supabase/fix-rls-recursion.sql`.
3. Create a private Storage bucket named `reservation-images`.
4. Enable Supabase Auth email/password sign-in.

## 2. Vercel

Set these environment variables in Vercel Project Settings:

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
NEXT_PUBLIC_SUPABASE_RESERVATION_BUCKET=reservation-images
NEXT_PUBLIC_APP_URL=https://your-app.vercel.app
```

Then deploy the GitHub repository from Vercel.

## 3. LINE MVP

The app does not use restricted LINE notification features.
It uses LINE share URLs so users can manually send:

- Group invitation links
- Appointment share links
- Companion assignment notices

Automatic LINE push notifications can be added later through a LINE Official Account and Messaging API.
