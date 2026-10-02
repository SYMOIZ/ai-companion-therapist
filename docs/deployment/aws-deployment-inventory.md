# Sukoon AWS deployment inventory

Recorded from the mistaken account **591292939267**, region **us-east-1**.  
This file has resource IDs and commands only. It does not contain API keys, passwords, tokens, or `.env` values.

The public application URL on that account was `http://204.236.247.148/`.

## What must be recreated in the correct account

| Piece | This account | Reproduce as |
|---|---|---|
| Region | `us-east-1` | Same, unless the correct account uses another region |
| Network | Default VPC `vpc-0b387796e9bdbdebc`, public subnet `subnet-0103992654e6248df` (`us-east-1d`, `172.31.32.0/20`, auto-assign public IP) | That account’s default VPC and one public subnet. Do not copy this VPC |
| Security group | `sg-063e9591574e309a2` `sukoon-web` | New group: inbound TCP 80 and 443 from `0.0.0.0/0`. No port 22. No port 5432. Egress all |
| IAM | Role `sukoon-ec2-role`, instance profile `sukoon-ec2-profile` | New role trusted by `ec2.amazonaws.com`, plus a new instance profile |
| EC2 | `i-0555ea76cc462bc53`, name `sukoon-hackathon`, `t3.micro`, AMI `ami-0d27e0fb3bac4d724` (Amazon Linux 2023 x86_64), no key pair, public IP | New instance. Resolve the current AL2023 AMI in the target region instead of reusing this AMI id outside `us-east-1` |
| Disk | `vol-0cbecf1d73e20cbbd`, 20 GiB gp3, `/dev/xvda`, delete on termination, not encrypted | Same size and type on the new instance |
| Deploy bucket | `sukoon-deploy-591292939267` (private) | New private bucket named for the correct account id |
| Parameter | `/sukoon/gemini-api-key`, type `SecureString` | Create again in the correct account. Supply the key locally. Do not copy the value from this account |
| App on the host | `/opt/sukoon`, `NODE_ENV=production`, systemd unit `sukoon.service`, iptables redirect 80 → 3000 | Same layout |
| Database | Docker container `sukoon-postgres`, image `postgres:16`, publish `127.0.0.1:5432` only, volume `sukoon_pg`, database name `sukoon`, user `sukoon` | New container. Generate a new password on the host |

## IAM requirements

Trust policy: allow `ec2.amazonaws.com` to call `sts:AssumeRole`.

Attached managed policy:

- `arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore`

Inline policy `sukoon-read-deploy`:

- `s3:GetObject` and `s3:ListBucket` on the deploy bucket and `/*`
- `ssm:GetParameter` and `ssm:GetParameters` on `arn:aws:ssm:REGION:ACCOUNT:parameter/sukoon/*`

Replace `REGION` and `ACCOUNT` with the correct account. Do not keep `591292939267` in the new policy.

## Environment-variable names

Set these on the server in `/opt/sukoon/.env` (mode `600`). Do not put them in the frontend build.

| Name | Purpose |
|---|---|
| `GEMINI_API_KEY` | Read by the Node gateway for Gemini. Value comes from SSM `/sukoon/gemini-api-key` |
| `DATABASE_URL` | `postgresql+psycopg2://sukoon:<generated-password>@127.0.0.1:5432/sukoon` |
| `NODE_ENV` | `production`, set on the systemd unit so Express serves `dist/` |

`OPENAI_API_KEY` is the existing fallback name in `server.ts`. It was not set on this host.

Python is started as `python3 main.py` with `PORT=3001`. The public site is Node on port 3000. Host iptables redirects TCP 80 to 3000. Port 5432 is bound to localhost only and is not in the security group.

## Objects that were uploaded

- `s3://sukoon-deploy-591292939267/sukoon-app.tar.gz` (application archive, no `.env`, no `node_modules`)
- `s3://sukoon-deploy-591292939267/sukoon-install.sh`

Rebuild the archive from the current project. Do not download the old archive if it might be stale. Exclude `.env`, `.git`, and `node_modules`.

## Commands to reproduce

Run these in the correct account after `aws sts get-caller-identity` shows that account. Replace `ACCOUNT`, `VPC`, and `SUBNET`.

```bash
aws ssm get-parameter --name /aws/service/ami-amazon-linux-latest/al2023-ami-kernel-default-x86_64 --query Parameter.Value --output text

aws iam create-role --role-name sukoon-ec2-role --assume-role-policy-document file://trust.json
aws iam attach-role-policy --role-name sukoon-ec2-role --policy-arn arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore
aws iam put-role-policy --role-name sukoon-ec2-role --policy-name sukoon-read-deploy --policy-document file://inline.json
aws iam create-instance-profile --instance-profile-name sukoon-ec2-profile
aws iam add-role-to-instance-profile --instance-profile-name sukoon-ec2-profile --role-name sukoon-ec2-role

aws ec2 create-security-group --group-name sukoon-web --description "Sukoon public HTTP and HTTPS only" --vpc-id VPC
aws ec2 authorize-security-group-ingress --group-id SG --protocol tcp --port 80 --cidr 0.0.0.0/0
aws ec2 authorize-security-group-ingress --group-id SG --protocol tcp --port 443 --cidr 0.0.0.0/0

aws s3api create-bucket --bucket sukoon-deploy-ACCOUNT --region us-east-1
aws s3api put-public-access-block --bucket sukoon-deploy-ACCOUNT --public-access-block-configuration BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true
aws ssm put-parameter --name /sukoon/gemini-api-key --type SecureString --value file://gemini.txt

aws ec2 run-instances --image-id AMI --instance-type t3.micro --subnet-id SUBNET --security-group-ids SG --associate-public-ip-address --iam-instance-profile Name=sukoon-ec2-profile --user-data file://user-data.sh --block-device-mappings file://bdm.json --tag-specifications "ResourceType=instance,Tags=[{Key=Name,Value=sukoon-hackathon}]"
```

`bdm.json` is a 20 GiB gp3 root volume on `/dev/xvda` with `DeleteOnTermination` true.

`user-data.sh` installs Docker, Python 3, pip packages `fastapi`, `uvicorn[standard]`, `sqlalchemy`, `psycopg2-binary`, `pydantic`, `email-validator`, Node (`nodejs20` or `nodejs`), and an iptables redirect from port 80 to 3000.

After the instance is SSM Online:

```bash
aws s3 cp sukoon-app.tar.gz s3://sukoon-deploy-ACCOUNT/sukoon-app.tar.gz
aws s3 cp sukoon-install.sh s3://sukoon-deploy-ACCOUNT/sukoon-install.sh
aws ssm send-command --instance-ids INSTANCE --document-name AWS-RunShellScript --timeout-seconds 1800 --parameters commands="aws s3 cp s3://sukoon-deploy-ACCOUNT/sukoon-install.sh /tmp/sukoon-install.sh && bash /tmp/sukoon-install.sh"
```

`sukoon-install.sh` must use Unix line endings. It extracts the archive to `/opt/sukoon`, runs `npm install --omit=dev`, starts Postgres on `127.0.0.1:5432` with a newly generated password, writes `/opt/sukoon/.env` from SSM plus that password, and enables systemd unit `sukoon.service` (`WorkingDirectory=/opt/sukoon`, `Environment=NODE_ENV=production`, `ExecStart=/usr/bin/npm start`).

Before packaging, run `npm run build` so `dist/` is in the archive.

## Sufficiency check

A second account can rebuild this host from the commands above plus the application tree and a locally supplied `GEMINI_API_KEY`. It does not need this account’s instance id, volume id, security group id, public IP, or the stored parameter value.

Not portable as-is: the AMI id, subnet id, VPC id, bucket name, and IAM resource ARNs. The commands above tell the operator to look those up in the target account.

Not included, because they were not part of this deployment: a custom domain, an HTTPS certificate, Cognito, SES, RDS, or a NAT gateway.

## Left untouched in account 591292939267

These already existed and are not part of the Sukoon host:

- Default VPC `vpc-0b387796e9bdbdebc` and subnet `subnet-0103992654e6248df`
- Security groups `launch-wizard-1` through `launch-wizard-5`, and the VPC default group
- S3 buckets `awsresourcelensstack-frontend23d93c55-y9xc21qcwxs2`, `awsresourcelensstack-reports65402a0a-lmuif4dnnffo`, `cdk-hnb659fds-assets-591292939267-us-east-1`
- Key pairs `kp-scd-warehousing` and `ec2-kp-lambda-layer`
- IAM user `sytem`
