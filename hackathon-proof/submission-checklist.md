# Submission checklist

Checked on 2 October 2026 against the live site and the AWS CLI record. A box is checked only when the evidence exists.

## Product

- [x] App category stated: AI mental-wellness companion
- [x] Community / Startup lane named as the lane this pack is for
- [ ] Judge-portal screenshot confirming the lane — **PENDING**
- [x] Public URL works: https://www.sukoon.tech
- [ ] Apex https://sukoon.tech is stable — **PENDING** (Google A records still present)
- [x] Client, Therapist, and Admin demo flows opened on the live site
- [x] AI chat returned a reply on the live Client Demo
- [ ] Continue with Google completed on the live domain — **PENDING** (Firebase authorized domains not confirmed)
- [ ] Non-demo booking screen captured — **PENDING** (Client Demo redirects to sign-up; no production booking was created for the docs)

## Coding agent and AWS

- [x] Coding agent in this workspace used the AWS CLI on account `159412676011`
- [x] Live EC2 application is publicly reachable over HTTPS on `www`
- [x] Services, instance id, security group, bucket, and SSM parameter name recorded without secret values
- [x] `hackathon-proof/screenshots/20.png` — AWS console, S3 bucket `sukoon-deploy-159412676011`
- [ ] Cursor coding-agent window — **PENDING** (`20.png` is the console, not the agent)
- [x] `hackathon-proof/screenshots/21.png` — AWS console, EC2 `i-01a7d38c28e94d81d`
- [x] `hackathon-proof/screenshots/22.png` — AWS console, EC2 networking tab
- [ ] PostgreSQL client screenshot — **PENDING** (`22.png` is networking, not the database)

## Screenshots from the live app

Saved under `docs/screenshots/` unless noted.

- [x] `01-landing-page.png`
- [x] `02-login-page.png`
- [x] `03-client-dashboard.png`
- [x] `04-client-ai-chat.png`
- [x] `05-client-therapists.png`
- [ ] `06-client-booking.png` — **PENDING**
- [x] `07-client-journal.png`
- [x] `08-therapist-dashboard.png`
- [x] `09-therapist-profile.png` (therapist settings and profile fields)
- [x] `10-therapist-client-management.png` (patient registry; no active patients in the demo)
- [x] `11-therapist-appointments.png`
- [x] `12-admin-dashboard.png` (flag text blurred)
- [x] `13-admin-user-management.png` (user details blurred)
- [x] `14-admin-therapist-review.png` (Reject / Approve & Onboard visible; not submitted)
- [x] `15-admin-support-management.png` (user column blurred)
- [x] `16-notifications.png`
- [x] `17-profile-settings.png`
- [x] `18-responsive-mobile.png` (landing page; admin itself is desktop-only)
- [x] `hackathon-proof/screenshots/19-live-aws-proof.png` (browser on the live homepage)

## Process docs

- [x] Root `README.md`
- [x] `hackathon-proof/README.md`
- [x] `hackathon-proof/development-log.md`
- [x] `hackathon-proof/aws-services.md`
- [x] `hackathon-proof/deployment.md`
- [x] `hackathon-proof/aws-deployment-inventory.md` (wrong account, not deleted)
- [x] Markdown image paths checked against files on disk

## Still in the way of a clean submission

1. A Cursor-window screenshot and a PostgreSQL client screenshot are still pending. `20.png` and `22.png` are AWS console views.
2. Delete the four Google apex A records so `sukoon.tech` and `www.sukoon.tech` both hit `44.218.253.204`.
3. Allow both hostnames in Firebase project `sukoon-e8df7` if Google login is part of the demo.
4. Decide whether account `591292939267` should be torn down. It is still billing if that instance is running. Do not delete it without an explicit confirmation, and do not delete unrelated resources on that account.
5. This documentation is local and uncommitted. It is not on GitHub until it is committed and pushed.
