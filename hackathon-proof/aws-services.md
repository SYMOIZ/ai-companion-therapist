# AWS services

Live site only, unless a row says otherwise. Account `159412676011`, region `us-east-1`. Described from the AWS CLI on 2 October 2026. No secret values are included.

## Used by the running app

| Service | What it is doing | Evidence |
|---|---|---|
| Amazon EC2 | One `t3.micro`, `i-01a7d38c28e94d81d`, name `sukoon-hackathon`, Amazon Linux 2023, AZ `us-east-1a`. No SSH key. Runs Node, FastAPI, nginx, and Docker | CLI `describe-instances` during deploy |
| Amazon EC2 Elastic IP | `44.218.253.204` associated with that instance (allocation tagged `sukoon-tech`) | CLI association; `www` DNS points here |
| Amazon VPC | Default VPC `vpc-00316835b395c271c`, public subnet `subnet-0d493b1eecbe4e5d9` (`us-east-1a`). Pre-existing. Not created for Sukoon | CLI subnet list |
| Security group | `sg-0beb2bd2ced3d1ec4`, name `sukoon-web`. Inbound TCP 80 and 443 from `0.0.0.0/0`. Egress allowed. No 22, no 5432 | CLI security-group description |
| EBS | `vol-07350a72c6a46361c`, 20 GiB gp3, delete on termination, root `/dev/xvda` | CLI volume description |
| Amazon S3 | `sukoon-deploy-159412676011`, block public access on. Holds `sukoon-app.tar.gz`, `sukoon-install.sh`, `sukoon-https.sh` | CLI bucket listing |
| AWS Systems Manager Parameter Store | SecureString `/sukoon/gemini-api-key`. The instance role can read `/sukoon/*` | Parameter created with the CLI. Value not copied into git or this file |
| AWS Systems Manager Session / Run Command | Used to install the app and later nginx. No inbound SSH | Install completed; host then served HTTP and HTTPS |
| IAM | Role `sukoon-ec2-role` trusted by `ec2.amazonaws.com`. Instance profile `sukoon-ec2-profile`. Attached `AmazonSSMManagedInstanceCore`. Inline policy `sukoon-read-deploy` for the deploy bucket and `/sukoon/*` | CLI IAM reads |
| TLS | nginx and Certbot on the instance. Certificate SAN `DNS:sukoon.tech`, `DNS:www.sukoon.tech`. Not AWS Certificate Manager, and not a load balancer | `https://www.sukoon.tech` returned the site |

## Explicitly not used

- Amazon RDS
- NAT gateway
- Application Load Balancer or CloudFront
- Amazon Route 53 (DNS is at the registrar)
- Amazon Cognito
- Amazon SES (no mail is sent)
- A second instance or an Auto Scaling group

## On the host, not a separate AWS service

PostgreSQL 16 in Docker, container `sukoon-postgres`, publish `127.0.0.1:5432` only, volume `sukoon_pg`. systemd `sukoon.service` (`enabled`, `active` at deploy time) runs `npm start` in `/opt/sukoon`.

## Mistaken earlier account (not the live site)

Account `591292939267` still has a Sukoon-shaped stack from the first deploy attempt: instance `i-0555ea76cc462bc53`, volume `vol-0cbecf1d73e20cbbd`, security group `sg-063e9591574e309a2`, bucket `sukoon-deploy-591292939267`, SSM `/sukoon/gemini-api-key`, role `sukoon-ec2-role`, instance profile `sukoon-ec2-profile`. It was inventoried and not deleted. Default VPC, unrelated security groups, unrelated buckets, key pairs, and IAM user `sytem` on that account must not be removed as part of cleaning up that mistake. Full list: [aws-deployment-inventory.md](aws-deployment-inventory.md).

## Console screenshot

The running instance is shown in `screenshots/21.png`. The deploy bucket is shown in `screenshots/20.png`. The networking tab is `screenshots/22.png`.
