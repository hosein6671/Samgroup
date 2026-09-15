# Self-Hosted Mail Server Setup — samgp.com

Self-hosted email for `samgp.com` on the same VPS as the application, using
[docker-mailserver](https://github.com/docker-mailserver/docker-mailserver)
(MIT licensed — Postfix, Dovecot, Rspamd, Fail2ban in one container).

**Status: configuration verified locally on an isolated test domain
(`samgp-test.local`), 15 September 2026. Not yet run against the real
`samgp.com` domain or this VPS.** See "What was actually tested" below for
exactly what that verification covered and did not cover.

This is independent of the application deployment. `apps/api` and `apps/cms`
already degrade gracefully with no mail server configured — a form
submission still succeeds, only the internal notification email is skipped
(`SmtpMailer`, `docs/DEVOPS.md` §Email). Nothing here is required to deploy
the website.

## What was actually tested

Against a throwaway, non-public test domain in an isolated Docker network —
never `samgp.com`, never a real recipient:

- Mailbox creation (`setup email add`) and DKIM key generation
  (`setup config dkim domain`) both worked as documented.
- An authenticated SMTP submission through the project's own `nodemailer`
  dependency (the same one `SmtpMailer` uses) was accepted, DKIM-signed, and
  delivered to another mailbox on the same server.
- Fail2ban was running with its three default jails (`postfix`, `dovecot`,
  `custom`).
- An **unauthenticated relay attempt** to an external address was **refused**
  (`554 5.7.1 Relay access denied`) — the server is not an open relay with
  `PERMIT_DOCKER=none`.

**Not tested:** real DNS propagation, real-world spam-folder placement,
Let's Encrypt issuance for `mail.samgp.com` (the test used the image's
built-in self-signed fallback), ClamAV, and delivery to a real external
mailbox (Gmail, Outlook, etc.). Those depend on the real domain, the real
VPS, and the SSL/TLS gate landing first.

## Prerequisites

1. The SSL/TLS gate (nginx + certbot) is set up, so `deploy/certbot/certs`
   holds a real Let's Encrypt certificate this compose overlay can mount
   read-only — see `docker-compose.mail.yml`'s volume for the exact path.
2. `MAIL_HOSTNAME` (`deploy/mail.env.example`) is a **dedicated subdomain**,
   e.g. `mail.samgp.com` — not the same host as the public website. Mail and
   web share the domain, not the hostname.
3. You control DNS for `samgp.com` and can add the records below.

## DNS records to create

Replace `mail.samgp.com` if a different `MAIL_HOSTNAME` was chosen.

| Type | Name                        | Value                                                                                                                                |
| ---- | --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| A    | `mail.samgp.com`            | the VPS's IP address                                                                                                                 |
| MX   | `samgp.com`                 | `mail.samgp.com` (priority 10)                                                                                                       |
| PTR  | (reverse DNS on the VPS)    | `mail.samgp.com` — set this with the **hosting provider**, not your DNS zone; ask them if it isn't self-service                      |
| TXT  | `samgp.com`                 | `v=spf1 mx -all` (start with `~all` while testing, tighten to `-all` for production)                                                 |
| TXT  | `mail._domainkey.samgp.com` | the exact value `setup config dkim` prints — **generate a new key for the real domain; never reuse the test key from this document** |
| TXT  | `_dmarc.samgp.com`          | `v=DMARC1; p=none; rua=mailto:<a real inbox you can read>` while testing, then tighten `p=` to `quarantine` once mail flows cleanly  |

**PTR matters more than any setting in this repository.** A mail server
without a matching reverse-DNS record is treated as suspicious by nearly
every large mail provider, independent of SPF/DKIM/DMARC being correct.

## Bringing it up

```bash
cp deploy/mail.env.example deploy/mail.env
# edit deploy/mail.env — at minimum confirm MAIL_HOSTNAME
docker compose -f docker-compose.yml -f docker-compose.prod.yml -f docker-compose.mail.yml up -d mailserver
```

## Creating the mailboxes

One command per address — there is no bulk-import, by design, so each
account is a deliberate action:

```bash
docker compose exec mailserver setup email add info@samgp.com     '<strong password>'
docker compose exec mailserver setup email add sales@samgp.com    '<strong password>'
docker compose exec mailserver setup email add export@samgp.com   '<strong password>'
# ...repeat for the rest of the twelve addresses actually needed.
```

Passwords are supplied by you at creation time — nothing here invents or
stores a default one, matching this repository's existing rule for the
platform Admin bootstrap (`SECURITY.md` §Admin bootstrap).

**If some of the twelve are meant to be aliases into a shared inbox rather
than separate logins**, add them as aliases instead of accounts:

```bash
docker compose exec mailserver setup alias add support@samgp.com info@samgp.com
```

## Generating DKIM for the real domain

```bash
docker compose exec mailserver setup config dkim domain samgp.com
```

This prints the exact TXT record value for `mail._domainkey.samgp.com` —
copy it verbatim into DNS. Restart the `mailserver` service afterwards so
outgoing mail is signed with the new key.

## Connecting this to the application

Once mailboxes exist, point the API and CMS at this server exactly as any
other SMTP relay (`docs/DEVOPS.md` §Email, `apps/api/.env.example`):

```
SMTP_HOST=mail.samgp.com
SMTP_PORT=587
SMTP_USER=<the sending mailbox, e.g. leads@samgp.com>
SMTP_PASSWORD=<its password>
SMTP_SECURE=false
MAIL_FROM=SAM Group <leads@samgp.com>
LEAD_NOTIFICATION_TO=<the internal mailbox that should receive lead alerts>
```

## Security checklist before this is considered production-ready

- [ ] `PERMIT_DOCKER=none` unchanged — verified locally to refuse an
      unauthenticated relay attempt; do not change this value.
- [ ] Real Let's Encrypt certificate mounted (`SSL_TYPE=letsencrypt`), not
      `self-signed`.
- [ ] PTR record set with the hosting provider and matches `MAIL_HOSTNAME`.
- [ ] SPF, DKIM and DMARC TXT records published and verified with
      `dig +short TXT mail._domainkey.samgp.com` (and the SPF/DMARC
      equivalents) returning the expected value.
- [ ] `deploy/mail.env` is not committed (matches every other real `.env` in
      this repository) and mailbox passwords are stored only in a password
      manager, never in a file in this repository.
- [ ] A decision made on `ENABLE_CLAMAV` based on the VPS's actual available
      RAM (3-4 GB recommended if enabled), not left at the default silently.
- [ ] The twelve real addresses are confirmed against what the business
      actually needs — this document invents none of them.
