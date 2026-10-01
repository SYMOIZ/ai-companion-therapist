# Development log

**Hackathon alignment date:** 2 October 2026  
**Repository foundation:** GitHub `main`, commit `174b09e` (19 June 2026), message “Initial project upload”.  
**This session’s code and docs:** uncommitted on top of that commit. A rollback stash named `rollback-checkpoint-before-aws-deploy` exists from before the AWS work. Nothing in this log was back-dated.

Cursor (the coding agent in this workspace) did the 2 October alignment, debugging, browser checks, AWS CLI deployment, and this write-up. The June upload is not attributed to that session.

## 1. Idea and architecture

Sukoon was already a mental-wellness web app: React and Vite, a Node/Express gateway on port 3000, FastAPI on port 3001, and PostgreSQL. The gateway serves the UI and the Gemini route. Other `/api` traffic is proxied to FastAPI.

That layout was kept. No second architecture was introduced for the hackathon.

## 2. Application alignment

The local app was run with `npm run dev`. Authentication, demo login, chat, journal, therapist, and admin paths were traced.

Client Demo was made a separate account (`client-demo-001`, `demo.client@sukoon.ai`, account type `client-demo`):

- Chat and journal stay in the browser session. The server still enforces the demo chat limit.
- A new demo login starts a clean session.
- Booking, Help Desk, and other permanent writes redirect to sign-up.
- Notifications and settings for that account stay in the session.
- Profile shows Demo Account and `demo.client@sukoon.ai`.
- Delete Account is hidden and rejected by the API.

Normal client, therapist, and admin persistence was left in place. Local checks of those rules passed on 2 October 2026. A normal seeded client still loaded its existing chat and journal rows.

## 3. Production preparation

- PostgreSQL is the database. Supabase SQL in the repo is reference only.
- Alembic revision `73ebc74ae218` is the initial schema.
- After `gemini-3.5-flash` returned HTTP 429 (free-tier quota), the client model was set to `gemini-2.5-flash`. The server still prefers `GEMINI_API_KEY` and uses `OPENAI_API_KEY` only when Gemini is unset.
- Secrets stay in gitignored `.env` locally and in SSM plus a host `.env` in production. They were not committed.

## 4. Database and authentication

Local PostgreSQL is Docker `postgres:16`, database `sukoon`. Health on the FastAPI process reported the PostgreSQL engine.

Email and password login is unchanged. Quick Demo Access uses `POST /api/auth/demo-login`. Continue with Google is the existing Firebase popup, then the app’s Google login or signup route. Cognito was not added. OTP was not added. Therapist approval writes `email_events` with status `pending`. No mail provider was configured, and no message was sent.

## 5. QA before AWS

Local browser and API checks covered demo login for all three roles, Client Demo restrictions, therapist approve and reject (unauthenticated approve returned 401), and the normal client account remaining intact.

Known product limits from that pass: document preview is a path, and pending email rows are not delivered.

## 6. AWS

1. The CLI was authenticated. The first deploy landed on account `591292939267` (IAM user `sytem`, `us-east-1`): instance `i-0555ea76cc462bc53`, security group `sg-063e9591574e309a2`, bucket `sukoon-deploy-591292939267`, SSM `/sukoon/gemini-api-key`, role `sukoon-ec2-role`. That was the wrong account.
2. Those resources were inventoried in `aws-deployment-inventory.md`. They were **not** deleted.
3. The same application was deployed to the then-connected account `159412676011` (IAM user `claude`): instance `i-01a7d38c28e94d81d`, Elastic IP `44.218.253.204`, security group `sg-0beb2bd2ced3d1ec4`, bucket `sukoon-deploy-159412676011`.
4. `www.sukoon.tech` was pointed at that address. nginx and Certbot issued a certificate covering `sukoon.tech` and `www.sukoon.tech`. `https://www.sukoon.tech` returned the app.
5. Apex DNS still includes four Google A records, so the apex URL is not reliable.

Public URL after that work: `https://www.sukoon.tech`.

## 7. Final verification (live site)

On 2 October 2026 the live URL was opened and the Client, Therapist, and Admin demos were clicked through. Screenshots `01`–`05`, `07`–`18` were saved from that browser session. `19-live-aws-proof.png` is the same live homepage. Shots `06`, `20`, `21`, and `22` were not saved. Reasons are in `submission-checklist.md`.

AI chat on the live Client Demo accepted “Hello” and showed assistant replies. Admin review showed Reject and Approve & Onboard. Those buttons were not clicked, so no application was approved or rejected for the screenshot.
