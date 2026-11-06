# EDIConveyor — migration context

Product name: **EDIConveyor** (Day & Ross). Repo package name is still `edi-ingestion`.
GitHub: https://github.com/richardhtoomyat/EDI_Ingestion
Branch: `main`. Last pushed commit when this file was written: `989b307` (2026-10-30, “Let sales enter trader IDs on revised onboardings”).
Owner: Richard. Commits must show only Richard. Do not add an AI co-author.
Vercel rejects deploys when the commit email is `richard@Richards-MacBook-Pro-2.local`. Use the GitHub account email.

This file is the handoff for continuing the project in Cursor on another computer. It summarizes every prior chat, not only the latest one.

## What was not on GitHub when this file was written

`main` matched `origin/main` at `989b307`. These files existed only on the original Mac:

- New `src/IamDashboard.jsx` (local IAM mock, about 1,113 lines)
- Edits in `src/AuthGate.jsx`, `src/chrome.jsx`, `src/main.jsx`, `src/onboardingLink.js`, `src/styles.css` (shared `EDIConveyor` brand, header logo, dev route `/dev/iam`)
- Empty junk files `Untitled` and `tutorial` (do not commit)

If those are still uncommitted, cloning GitHub will not include the IAM mock. Commit and push them, or copy the working tree.

Do not put secrets in this file or in chat. Older chats contain a Google Maps key, an ngrok token, and a SQL Server password. Rotate those and keep them in Vercel, `.env`, or a password store.

## What this app is

Internal tool for Day & Ross EDI customer onboarding.

1. A sales agent signs in and creates an onboarding (company, accounts, contacts, transaction sets, hosting, authorization).
2. They review, then create. They can save the review as PDF. The dashboard copies the form UUID and can search by it.
3. The customer opens a unique link `/c/<token>` and completes what sales does not know (EDI technical contact, directories, 214 status codes).
4. EDI sees every onboarding, assigns owners, drags work into buckets, tracks stages, and flags custom 214 mapping.
5. An EDI coordinator sets Trader ID (QA) and Trader ID (Prod).
6. An admin (assigned only by SQL, never self-serve) can switch workplace and invite users.

Customer links stay links. Customers are not company directory users.

## Stack today

- React 19 + Vite. Entry: `index.html` → `src/main.jsx`.
- One app, not microservices. Vercel serverless routes in `api/` (`onboardings.js`, `profiles.js`, `invite.js`, `notifications.js`, `test-sftp.js`).
- `vercel.json`: Vite build, SPA rewrite for everything except `/api/`.
- Database: Supabase Postgres. Browser uses the publishable key for auth. Shared data goes through `/api/*` with the secret key. The `onboarding` table has row level security and no browser policies on purpose.
- Auth today: Supabase Auth. Microsoft Entra (“Sign in with Microsoft”) plus email/password. Microsoft provider was not enabled in Supabase when last tested (`Unsupported provider`). Azure app registration was postponed. Email sign-up hit Supabase’s email rate limit.
- Address suggestions: Google Places. Env var `VITE_GOOGLE_MAPS_API_KEY`. On Vercel this prefix must be `visibility: config`, not secret.
- Deploy target today: Vercel, user `richardhtoomyat`, team **ActivateMyo** (Hobby). As of 2026-11-05 the Vercel connection worked. There is no Supabase CLI or Supabase MCP link; the app only has env vars (`SUPABASE_URL`, `SUPABASE_SECRET_KEY`, `VITE_SUPABASE_URL`). Project host seen in chat: `stmxiwujvajwqkahnber.supabase.co`.

Local: `npm run dev` (port 5173). Tests: `npm test`. Address QA: `npm run qa:address`.

Dev-only routes (stripped from production builds):

- `/dev/sale` sales form preview
- `/dev/edi` EDI board preview
- `/dev/iam` IAM console mock (local, and uncommitted when this file was written)

Signed-in app routes `/`, `/edi`, and `/coordinator` all render `AuthGate`, which picks the portal from `profiles.role`.

## Direction from the manager (not built)

The prototype should move off public Microsoft login, email/password, Supabase, and Vercel.

- Host on an internal .NET server with no public internet.
- Database becomes Microsoft SQL Server.
- Login becomes company SSO on a Windows PC (office network or VPN). The browser sends the Windows identity (`DAYROSS\jsmith`). The .NET app asks Active Directory over LDAP which groups that network ID is in. A matching group opens the portal. No password form, no “choose your portal” screen.
- Being in a group does not sign someone in. Windows already did that. The app only checks the group.
- Ask IT for the real group names. Map them to Sales, EDI, Coordinator, and Admin. If someone is in two groups, admin wins.
- Store network ID, name, email, and role in SQL Server.
- A Mac cannot do Windows integrated auth. For local work, pretend the user is `DAYROSS\jsmith` against a test directory. Delete that pretend user on the real server.
- MFA is not in scope. SSO only.
- LDAP has both email and network ID on the person record.

Legacy app (separate, read-only): folder `EDISearchReports` from `EDIRazorWeb_20261030_EDIfeeds`. SQL Server host `SQLCL02PRD07`, database `EnterpriseIntegrationDB`, login `IntegrationUser`. Reachable from a work laptop on the company VPN. Test with `SELECT 1` only. The password was pasted into an old chat; rotate it and do not store it here.

## Roles

`profiles.role` is `sale`, `edi`, `coordinator`, or `admin`.

- Sales → sales portal.
- EDI → EDI portal. Team tab lists EDI accounts only.
- Coordinator → coordinator portal (submitted onboardings, enter both trader IDs).
- Admin → assigned with SQL only (`supabase/profiles_add_admin.sql`). Extra menu: Switch Workplace (EDI / Coordinator / Sales) and Administration (invite user, list everyone). Administration started empty and then gained invite + org list.

IAM mock adds a future `super-admin` (`EDI-SuperAdmins`). A super admin may grant another person super admin. This is localStorage only (`edi-iam-directory-v6`). It does not update `profiles` or a real directory.

Placeholder LDAP groups in the mock: `EDI-Sales`, `EDI-Analysts`, `EDI-Coordinators`, `EDI-Admins`, `EDI-SuperAdmins`. Replace with IT’s real names.

## Portals and behavior already shipped (on GitHub through `989b307`)

### Sign-in

Centered logo and **EDIConveyor**. No “create account” on the sign-in page. No side panel, no tagline. Account menu on every portal replaces a bare Sign out. Menu has no feature-previews, changelog, or upgrade item. Settings uses a sidebar; only an Account section for now. Welcome, first name sits in the EDI header beside the portal title. Tabs live in the header. Pages are full width. No site footer. Rounded fields and buttons. Hover uses Day & Ross orange, not a black fill.

### Sales form (`src/AgentApp.jsx`)

Sales does not prefill EDI technical contact.

Customer details (not “accounts and contacts”): Company Name, address, city, Prov/State (dropdown only), Postal/Zip (always `XXX XXX`), business contact name/phone/email.

Account IDs, side by side: AS400 and AS400 (Test), Truckmate and Truckmate (QA), Oracle and Oracle (QA). AS400 is 7 characters, zero-padded as the person types. Company address has a US/Canada control and Google suggestions. No temporary “looking up address” UI. Selecting a suggestion must keep the street text the person picked.

Type and Service on one line. At least one of each. Services: LTL, Truckload, Home Delivery, Dedicated CAN, Dedicated USA.

Customer email and Technow Request ID on one line. Technow Request ID is mandatory and unique, not the primary key.

Expected annual revenue formats as `xxx,xxx.xxx`.

Removed: logistic provider, additional location, payment house, fax, main-account block.

Technical contact heading: Name, Email, Contact – Mobile (country flag, auto-format, dummy 4-digit check), Contact – Other (phone, no check). Verification is only for the EDI technical mobile. Any 4 digits pass after about 1 second and show a blue/white check. The SMS is fake.

Transaction sets: one column, code plus what it is. 204 and 211 are mutually exclusive. 214 opens a next page of normal statuses, then exception statuses. Show description plus AT7-01 and AT7-02. Defaults are filled. Customize, then edit, then Save locks the fields. Empty save restores the default. Customized values use Day & Ross orange so EDI can see them. Labels stay fixed when the button switches to Save.

Hosting: Day & Ross (Preferred) or Customer. Customer then chooses AS2 or SFTP (Preferred). Day & Ross + SFTP does not ask for SFTP fields. It shows “Send request to Michael Wright”; the click is a fake sent state with a blue tick. Nothing is emailed. AS2 asks for a certificate.

EDI Communication (old “communication method”) is hidden when type is Revised.

Authorization: the payment-house question was replaced with whether the customer has passed the probationary period against their tariff contract. Person completing the form is the signed-in user’s name, read-only. Company is Day & Ross, read-only. Date is today.

Kickoff: customer picks 3 one-week windows, earliest start two weeks from today, week UI in the style of Google Flights.

Create flow: button says Review, then Create, then a done page with Save as PDF (the review, not the empty done page), email, and back to dashboard. Review lists transaction sets as codes only (`214`, `990`).

On the done page, show last modified by first and last name plus team, for example `Adam King (EDI)`.

Dashboard: “Copy form ID” (the UUID), not “copy link” or “send this link”. Search bar by UUID. Trader IDs show on the sales edit form, greyed out; empty reads “not available” until the coordinator fills them. Sales can type trader IDs on revised onboardings (commit `989b307`).

### Customer form

Link `/c/<token>`. Fields sales already filled are shown and locked, with an Edit button that also saves. Removed from the customer view by default: request, main account, logistic provider, additional location, payment house.

### EDI portal

Board of all sales onboardings.

Status: pending customer (technical contact incomplete) → pending (trader IDs missing; the label is “pending”, not “pending coordinator”) → ready → assigned (first name) → started → test → production. Completed rows stay at the bottom.

Phase column before status, and sort by it: pending/ready/assigned = Backlog; started/test = In Progress; production = Complete.

No sales-agent column and no sales-agent search.

Flags say “custom mapping”, not “custom AT7 mapping”. There is no AT7-only checkbox and no explanatory sentence about pending customer / pending coordinator.

Open a row to see the same form sales can edit, including which 214 codes changed (orange). Button is “view form”, not “mark completed”.

My Assignment: onboardings assigned to you. Stage control is a dropdown: start, test, production. Start requires an estimated completion date.

Under the company name: “Created on Oct 27, 2026” in a green box, plus coordinator when assigned. Technical contact is its own small section (name, email, mobile). The demo contact `richardhtoomyat@gmail.com` was used while designing that block.

Team tab: EDI users only. Each person has a work bucket. Drag an onboarding in; everyone sees who has it. Unassigned is a column stuck to the right. Task-card order inside a bucket is shared and must persist. Team-member column order is per signed-in user only. Long-press to reorder. While dragging, other cards shuffle before the drop, and the card itself moves (not only an overlay). Hit testing uses the card, including moves to the right. A midpoint-swap experiment was reverted on purpose. User cards show only first name, last name, and the task cards. One Hide button for the page: checkboxes to hide or show members in your view.

Internal notes support @mentions with teammate autocomplete (Teams-like). You cannot mention yourself. Mentions, assign, and unassign create a notification for the other person. There is a Notifications tab. Re-run `supabase/edi_notifications.sql` so the `kind` column exists.

KPI tab: average created→ready, average created→complete, ready-unassigned count plus aging, and a GitHub-style calendar of completions this week.

Do not put dummy people (Alex EDI and similar) back on the live site. A one-off SQL seed of 20 onboardings for `sales@dayross.com` filled only mandatory fields and did not select 214. Quick-assign, stage change, and a blocker line on team cards were built and then reverted. Do not add them back unless asked.

### Coordinator

Sees submitted onboardings, opens one, sets Trader ID (QA) and Trader ID (Prod). Those values must show up on the sales edit form.

## Database

Current table is `public.onboarding` in `supabase/onboarding.sql`. UUID `id` is the primary key. `technow_request_id` is required and unique. `public.onboardings` is deprecated.

Important columns: token, company, customer email, `prefill` jsonb, `submission` jsonb, trader_id_qa, trader_id_prod, needs_at7_mapping, at7_custom_count, last_modified_by_name, last_modified_by_team, edi_owner_id, edi_note, edi_stage (`'' | started | test | production`), estimated_completion_date, edi_bucket_order, and timestamps ready/assigned/started/test/production/completed.

Custom 214 codes live in `public.onboarding_at7_code` (normal vs exception, prefill vs submission, default vs actual AT7-01/02, `is_custom`). That flag is how EDI knows mapping work is required.

`profiles`: id = `auth.users.id`, email, first name, last name, role, `edi_team_view_order`, `edi_team_hidden`. Insert policy blocks self-service admin.

Incremental scripts in `supabase/` were run in the Supabase SQL editor as features landed (`profiles_*.sql`, `onboarding_*.sql`, `edi_notifications.sql`). `onboarding.sql` already includes most of those columns. On a fresh database, follow the file comments. Do not blindly replay every incremental script on top of the consolidated create.

Review on 2026-11-06 (not fixed): `supabase/profiles_update_own.sql` lets a signed-in user update their own row with no column limit, so they can change `role` and `email`. Insert already blocks self-service admin. Lock the update policy to name fields.

Live updates (not built): boards call `loadOnboardings()` once. The person who saves sees their own response; everyone else keeps the list from page load until refresh. Notifications already poll about every 30 seconds. Onboardings do not. Do not render `postgres_changes` payloads in the browser. The table has no select policy, and adding one would expose EDI notes, trader IDs, and assignment. Use Realtime only as a “something changed” ping, then reload through `/api/onboardings`.

## SFTP test (prototype only)

EDI people confirm a customer SFTP by a test button. A local Python server (`scripts/mock_sftp.py`, `scripts/requirements.txt`, port 2222) plus a public TCP tunnel because Vercel cannot reach localhost. ngrok wanted a credit card, so the tunnel is Pinggy:

```bash
ssh -tt -p 443 -R0:localhost:2222 tcp@a.pinggy.io
```

The free host and port change every time the tunnel starts and last about an hour. Put them in Vercel `SFTP_HOST` and `SFTP_PORT`. Flow: Establish connection, then the button becomes Test and uploads `inbound.txt`. The person drops `outbound.txt` in the local folder. When the app sees it, outbound passes. This mock is separate from the sales form, where Day & Ross-hosted SFTP does not collect host, port, or directories.

## IAM mock (local only when this file was written)

`src/IamDashboard.jsx`, opened at `/dev/iam` while `npm run dev` is running. It is a local directory in the browser, styled to match the sign-in page (logo + EDIConveyor). IAM can onboard and offboard. Each person has email and network ID. One LDAP group per person. No MFA and no “review” tab. Offboard reasons: left the company, role no longer needed, duplicate account. Dormant threshold is 90 days. Granting a group in the real system means changing LDAP membership; the .NET app reads groups at login. It must not write a Supabase `profiles` row over the internet.

## UI rules

- Day & Ross orange for custom EDI codes and for hovers. No black hover fill.
- Full-width layout. No footer.
- Rounded controls.
- Phone formatting uses a country flag and `(XXX) XXX-XXXX`. Fax was removed.
- Dummy verification should look smooth: flag, formatted number, code box, blue check.

## Chat index

These are the prior Cursor chats this brief was drawn from, oldest first.

| When | Topic |
|---|---|
| 2026-10-21 | How the project SFTP tunnel works, and what Pinggy is |
| 2026-10-21 | Confirmed the web app is React + Vite |
| 2026-10-27 | Git author must be Richard only; sales and customer form; SFTP connection test; 214 status codes; phone verification; sales-agent portal; Supabase and Vercel link; EDI dashboard and coordinator page |
| 2026-10-27 | View the EDI dashboard locally |
| 2026-10-27 | Microsoft Entra sign-in, three roles, sales form rebuild, `onboarding` table, AT7 mapping, EDI board, KPI, admin, team buckets, @mentions |
| 2026-10-27 to 2026-10-30 | Name the app EDIConveyor; sign-in layout; settings sidebar; rounded controls; team-card drag; Day & Ross / SFTP preferred; annual revenue; authorization wording; trader IDs on revised onboardings |
| 2026-10-30 | Local IAM console mock for LDAP and SSO |
| 2026-10-30 | Legacy `EDISearchReports` SQL Server location (read-only check from a work laptop) |
| 2026-11-05 | Vercel still connected; Supabase MCP and CLI are not |
| 2026-11-05 | Manager direction: internal host, LDAP, network ID, Windows SSO, SQL Server |
| 2026-11-06 | `profiles` update policy is too open; onboardings do not update live until refresh |
| 2026-11-06 | Confirmed latest work was not pushed; this migration brief |

## How to continue on the work computer

1. Clone `main`. If the IAM mock was pushed after this note, it will be in the repo. If not, it is only on the original Mac.
2. `npm install`, then `npm run dev`.
3. Copy env vars from Vercel or the old `.env`. Names only: `SUPABASE_URL`, `SUPABASE_SECRET_KEY`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` or the publishable key, `VITE_GOOGLE_MAPS_API_KEY`, `SFTP_HOST`, `SFTP_PORT`. Do not paste secret values into chat.
4. In a new Cursor chat, attach this file so the agent has the history.
5. Next real milestone is the manager’s cutover: Windows SSO + LDAP groups, .NET host, SQL Server, and a schema move from `supabase/*.sql`. Keep customer `/c/<token>` links outside the directory.
6. Before that, the open prototype gaps are the `profiles` update policy, live refresh of onboardings, Microsoft provider still disabled, and the IAM screen still being a mock.
