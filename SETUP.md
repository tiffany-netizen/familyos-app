# FamilyOS Setup

Follow these once your GitHub, Vercel, and Supabase accounts exist. About 15 minutes total.

## 1. Supabase (the database)

Go to supabase.com, create a new project called familyos. Pick any region near you and set a strong database password (save it somewhere safe).

When it finishes, open the SQL Editor, paste the entire contents of `supabase/migrations/001_init.sql` from this project, and click Run. That creates every table with security rules.

Then go to Project Settings > API and copy two values: the Project URL and the anon public key.

## 2. Environment variables

Create a file called `.env.local` in the project root with:

    NEXT_PUBLIC_SUPABASE_URL=your-project-url
    NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key

## 3. Run it locally (optional)

    npm install
    npm run dev

Open http://localhost:3000, create an account, and walk the onboarding.

## 4. Deploy to Vercel

Push this folder to a GitHub repository, then in Vercel click Add New Project, import that repo, and add the same two environment variables in the Vercel project settings. Deploy. You'll get a live URL you can open on your phone and share with Jamie.

## What works in phase 1

Signup and login. The full onboarding intake (spouse, kids one page each, parents, pets, holiday reminders with lead times, date night frequency, gift lists, home tasks, service providers), all saving to the database. The Today screen with a real brief computed from your data: upcoming birthdays, anniversary and holiday countdowns, call gaps, and home maintenance due. The + memory capture that files notes to the right person and creates gift ideas automatically.

## Phase 2 adds

The Claude API layer that writes the brief in natural language, morning email delivery, people profiles and gift list screens, call logging buttons, and the weekly digest.
