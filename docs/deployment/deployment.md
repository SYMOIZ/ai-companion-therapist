# Deployment

The application is already deployed. This file records what was done. It is not a script to run again.

**Live URL:** [https://www.sukoon.tech](https://www.sukoon.tech)  
**Checked:** 2 October 2026, browser loaded the production homepage and the three demo roles.  
**Account:** `159412676011` (`us-east-1`)  
**Public IPv4:** `44.218.253.204`

## What was shipped

One EC2 instance runs the existing Node gateway, FastAPI, and a private PostgreSQL container. nginx terminates HTTPS and proxies to `127.0.0.1:3000`. There is no RDS, NAT, or load balancer.

| Piece | Value |
|---|---|
| Instance | `i-01a7d38c28e94d81d` (`t3.micro`, name `sukoon-hackathon`) |
| AMI | `ami-0d27e0fb3bac4d724` (Amazon Linux 2023, x86_64) |
| Security group | `sg-0beb2bd2ced3d1ec4` — TCP 80 and 443 |
| Root volume | `vol-07350a72c6a46361c` — 20 GiB gp3 |
| Deploy bucket | `sukoon-deploy-159412676011` (private) |
| Secret | SSM SecureString `/sukoon/gemini-api-key` |
| Process | systemd `sukoon.service`, working directory `/opt/sukoon`, `NODE_ENV=production` |
| Database | Docker `postgres:16`, loopback port 5432 only |
| Certificate | Certbot, names `sukoon.tech` and `www.sukoon.tech` |

The first automatic public IP `34.205.55.182` was replaced by the Elastic IP. The old address no longer serves the site.

## How it was deployed

1. AWS CLI identity was confirmed. The first successful create used the wrong account (`591292939267`). That stack was inventoried and left in place. See [aws-deployment-inventory.md](aws-deployment-inventory.md).
2. On `159412676011`, the CLI created the security group, IAM role, instance profile, private bucket, SSM parameter, and the instance. The app archive and install script were uploaded to the bucket. Systems Manager ran the install: Node, Python packages, Docker Postgres, environment file mode 600, and `sukoon.service`.
3. Checks that passed on the new host before DNS existed: demo login, a journal insert and read, Gemini generate returning a short ok payload, and Postgres not reachable from the public internet on 5432. Node `/api/health` only proves the gateway. It was not treated as proof of the database.
4. The Elastic IP was associated. The registrar A record for `www` was set to `44.218.253.204`.
5. An early iptables redirect from port 80 to port 3000, and the `sukoon-http-redirect` unit, were removed so nginx could bind 80 and 443. Certbot `--nginx` issued the certificate. `https://www.sukoon.tech` returned HTTP 200.

Install scripts lived in the deploy bucket and in the local temp directory used for the CLI. They are not required to view the running site.

## DNS still open

`www.sukoon.tech` → `44.218.253.204` only.

Apex `sukoon.tech` still returned `44.218.253.204` **and** `216.239.32.21`, `216.239.34.21`, `216.239.36.21`, `216.239.38.21`. Those four addresses are Google. Until they are deleted at the registrar, `https://sukoon.tech` can hit the wrong host even though the certificate already lists the apex name. AAAA records for Google were removed earlier; the last apex lookup used for this note did not show AAAA.

Firebase authorized domains still need `sukoon.tech` and `www.sukoon.tech` before Continue with Google is dependable. That login was not finished on the live site.

## Cost if it keeps running

Approximate: t3.micro about $7.60, public IPv4 about $3.65, 20 GiB gp3 about $1.60, together about $13 per month, less if the free tier still covers the instance. The Elastic IP is attached to a running instance, so it is the public-IPv4 charge, not an extra idle-address charge. No RDS or NAT charge.

Stop the instance to stop compute. Releasing the Elastic IP and deleting the bucket and role are separate. Do not stop or delete the `591292939267` resources unless that account’s owner asks.

## What this document does not claim

- AWS console shots are `docs/screenshots/20.png` (S3), `21.png` (EC2), and `22.png` (networking).
- A PostgreSQL client screenshot is still **PENDING**. `22.png` is the networking tab.
- A Cursor coding-agent window screenshot is still **PENDING**.
- The mistaken account was not removed.
- Mail is not delivered.
