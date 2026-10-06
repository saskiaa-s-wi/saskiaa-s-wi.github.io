# Study Notes Hub
Build 2 plan: CONFIRMED by Build 2 Planner on September 29, 2026.

## What the app does and who it's for
An app for students to upload, share, and access study guides and handwritten notes (PDFs, PNGs, JPGs). It saves students time and effort creating study guides from scratch and keeps essential course materials stored securely in one place.

## Sign-in
- Email + Password sign-in (enforced rules: 8+ characters, at least 1 uppercase letter, 1 lowercase letter, and 1 number).
- GitHub OAuth sign-in.
- Session remains active on page refresh; users can sign out at any time.
- Dedicated Change Password screen for email users.

## Tables
- `profiles`
  - `id` (uuid, primary key, references auth.users.id)
  - `username` (text, unique)
  - `created_at` (timestamp)
- `study_notes`
  - `id` (uuid, primary key)
  - `user_id` (uuid, references auth.users.id)
  - `class_title` (text)
  - `topic_unit` (text)
  - `description` (text)
  - `file_url` (text)
  - `is_public` (boolean)
  - `created_at` (timestamp)

## Who can see what
- `profiles` table:
  - Read: All signed-in users can view usernames (so creator names display on public notes).
  - Insert/Update: Users can only create or edit their own profile entry.
- `study_notes` table:
  - Public notes (`is_public = true`): Any signed-in user can view and read them.
  - Private notes (`is_public = false`): Visible and accessible strictly by the note owner (`user_id = auth.uid()`).
  - Edit/Delete: Only the creator of the note (`user_id = auth.uid()`) can edit or delete it.

## Buckets
- Bucket Name: `notes_bucket`
- Allowed file types: PDF, PNG, JPG
- Max file size limit: 50 MB
- Bucket Access Rules: Signed-in users can upload files. Files attached to public notes are viewable by all signed-in users. Users can only delete files they uploaded.

## Screens
1. **Sign-In / Sign-Up Screen:** Options to sign in or register via Email + Password or GitHub.
2. **Username Setup Screen:** Displayed upon first login to choose a unique username.
3. **Main Dashboard Screen:** Allows users to browse public study guides, view their own private notes, and upload new files with class details.
4. **Settings / Change Password Screen:** Allows email users to change their password and manage account settings.

## Code files
- `index.html`: Holds the page structure, layout, and CSS styles; loads `config.js` before `app.js`.
- `app.js`: Holds all JavaScript logic for auth handling, navigation, database queries, file uploads, and RLS interactions.
- `config.js`: Holds only the Supabase project URL and the publishable API key.

## Rules for every chat
- This app uses exactly three code files: index.html, app.js, config.js. Do not create more.
- index.html contains the HTML and CSS, and loads config.js before app.js.
- config.js contains only the Supabase URL and the publishable key.
- When you change code, name the file and give me the whole file, not a snippet.
- Change nothing I did not ask you to change.
- Never put a secret key in any file.

## Addresses
- GitHub Pages URL: to fill in

## Secrets
- GitHub client secret: configured directly in Supabase Dashboard under Authentication -> Providers -> GitHub (never stored in code or project.md).

## Where we are right now
Configured Supabase credentials in `config.js` and implemented full application logic across `index.html` and `app.js`, including Email/Password and GitHub authentication, username setup, study material uploads to `notes_bucket`, public/private dashboard views, password updates, and note deletion with storage cleanup.

## NOT doing, on purpose
- Forgot password email resets and email confirmation emails (Supabase free tier limits external email delivery).
- AI summarization or automated flashcard generation (reserved for Build 4).

## Next thing I want to add
Deploy the three application files (`index.html`, `app.js`, `config.js`) to GitHub Pages, fill in the GitHub Pages URL, and test the live application end-to-end.

## Change log
- September 29, 2026: Planning session with Build 2 Planner. Plan confirmed.
- October 4, 2026: Initial setup of `index.html`, `app.js`, and `config.js`.
- October 6, 2026: Configured Supabase URL and publishable key in `config.js`. Built all 4 application screens in `index.html` and implemented complete JavaScript logic in `app.js` (Auth, Username profile setup, Storage uploads, Dashboard tabs, Password management, and Modal deletion).