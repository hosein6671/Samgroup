# Self-Hosted Mail Server Setup — samgp.com

Self-hosted email for `samgp.com` on the same VPS as the application, using
[docker-mailserver](https://github.com/docker-mailserver/docker-mailserver)
(MIT licensed — Postfix, Dovecot, Rspamd, Fail2ban in one container), plus
[Roundcube](https://roundcube.net/) (MIT licensed) as the browser webmail
client on top of it, reached at the same `MAIL_HOSTNAME` over HTTPS. Roundcube
is a client of `mailserver` — it reads/sends through the same IMAP and
submission ports a desktop mail client would, and holds no mail data of its
own (its one SQLite file is per-user preferences only).

**Status: live in production.** First verified locally on an isolated test
domain (`samgp-test.local`), 15 September 2026 — see "What was actually
tested" below for that record. Superseded 18–20 September 2026: DNS cut
over to this VPS, a real Let's Encrypt certificate issued for
`mail.samgp.com` (DNS-01 challenge via the Cloudflare API, so no downtime
during issuance — see "Issuing the certificate for webmail"), a real DKIM
key published, mailboxes created and their mail migrated from the previous
host with `imapsync`, and delivery verified both directions against a real
external mailbox (Gmail) — see "What changed going from the isolated test
to production" below for the two real defects that surfaced only under
production conditions and how they were fixed.

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

**Not tested by this local pass:** real DNS propagation, real-world
spam-folder placement, Let's Encrypt issuance for `mail.samgp.com` (the
test used the image's built-in self-signed fallback), ClamAV, and delivery
to a real external mailbox. All of these were exercised for real in the
production rollout below.

## What changed going from the isolated test to production

Two real defects surfaced only against production conditions — a
genuinely low-RAM VPS and a real external sender — that the isolated test
domain had no way to expose:

- **Amavis silently runs alongside Rspamd by default.** `ENABLE_RSPAMD=1`
  does not turn Amavis off; that is a separate variable
  (`ENABLE_AMAVIS=0`, now in `deploy/mail.env.example`), and the image's
  own startup log already warns about the combination ("Running Amavis/SA
  & Rspamd at the same time is discouraged"). Left on, a real Gmail
  delivery to this VPS was rejected with `4.7.1 timeout processing
message` — traced to Rspamd's own fuzzy-hash check (a network round
  trip to `rspamd.com`) averaging ~8 seconds per message against this
  VPS's connection, which Postfix's default milter timeouts did not
  tolerate. Fixed by turning Amavis off **and** widening the milter
  timeouts to 30s (`deploy/mailserver/postfix-main.cf`, bind-mounted by
  `docker-compose.mail.yml`) — the fuzzy check itself stays on, since
  disabling it would trade a latency problem for lost spam coverage.
- **Roundcube cannot verify `mailserver`'s certificate hostname.** Roundcube
  reaches `mailserver` by its internal Docker service name
  (`ssl://mailserver`), but the certificate SSL_TYPE=letsencrypt presents
  is issued for `MAIL_HOSTNAME` (`mail.samgp.com`) — a real hostname
  mismatch PHP's default strict verification correctly rejects, seen as
  Dovecot logging "Login aborted: Connection closed (no auth attempts in 0
  secs)" — Roundcube closed the connection before ever sending a
  password. Fixed by relaxing hostname (not chain) verification for this
  one internal, `edge`-network-only hop
  (`deploy/mailserver/roundcube-tls.php`, bind-mounted the same way).

Both fixes are ordinary Postfix/Roundcube configuration, not something
specific to this VPS — a fresh deployment following this document today
inherits them automatically via the two bind mounts.

## Prerequisites

1. The SSL/TLS gate (nginx + certbot) is set up — confirmed already done on
   this VPS. `mailserver` mounts the host's real certbot path directly
   (`/etc/letsencrypt`, read-only — the same path `docker-compose.prod.yml`'s
   own nginx service already mounts), not a path inside this repository.
2. `MAIL_HOSTNAME` (`deploy/mail.env.example`) is a **dedicated subdomain**,
   e.g. `mail.samgp.com` — not the same host as the public website. Mail and
   web share the domain, not the hostname. Set the matching `MAIL_HOST` (the
   VPS `.env`, alongside `PUBLIC_HOST`/`CMS_HOST`) to the same value — nginx's
   webmail server block reads it.
3. You control DNS for `samgp.com` and can add the records below.
4. A certificate exists for `MAIL_HOSTNAME` specifically before Roundcube's
   nginx block can serve HTTPS — see "Issuing the certificate for webmail"
   below. `mailserver` itself needs the same certificate for a different
   reason: it presents it on ports 25/587/993.

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

## Issuing the certificate for webmail

Two paths, depending on whether `MAIL_HOSTNAME` already resolves somewhere
that must keep working right up to cutover:

**If the hostname is not live anywhere yet** (a fresh subdomain), webroot
mode is simplest — nginx will not start with an `ssl_certificate` directive
pointing at a file that does not exist yet (the same ordering constraint
`docker/nginx/README.md` "Activating TLS" describes for the other two
hosts), so point the `A` record at the VPS first:

```bash
# 1. Add MAIL_HOST=mail.samgp.com to the VPS .env, alongside PUBLIC_HOST/CMS_HOST.
# 2. Restart nginx so the ACME-challenge server block picks up the new host:
docker compose -f docker-compose.yml -f docker-compose.prod.yml restart nginx
# 3. Issue the certificate the same way the other two hosts were issued
#    (webroot mode, against the volume nginx already serves
#    /.well-known/acme-challenge/ from):
sudo certbot certonly --webroot -w /var/www/certbot -d mail.samgp.com
# 4. Restart nginx once more so it picks up the new certificate:
docker compose -f docker-compose.yml -f docker-compose.prod.yml restart nginx
```

**If the hostname already points at a live mail server that must not go
down mid-migration** (the production case, 18 September 2026: `mail.samgp.com`
still resolved to the previous host at this point), use a DNS-01 challenge
instead — it proves ownership by writing a TXT record via the Cloudflare
API, so the certificate for the new host exists **before** any DNS cutover
and the old server's mail keeps flowing the entire time:

```bash
apt-get install -y python3-certbot-dns-cloudflare
mkdir -p /root/.secrets
cat > /root/.secrets/cloudflare.ini <<'EOF'
dns_cloudflare_api_token = <a token scoped to Zone:DNS:Edit on samgp.com only>
EOF
chmod 600 /root/.secrets/cloudflare.ini
certbot certonly --dns-cloudflare --dns-cloudflare-credentials /root/.secrets/cloudflare.ini -d mail.samgp.com
```

Only then repoint the `A` record and restart nginx/`mailserver` to pick up
the new hostname and certificate. Revoke or roll the Cloudflare API token
once cutover is confirmed — it needs to exist only for this one command.

## Bringing it up

```bash
cp deploy/mail.env.example deploy/mail.env
# edit deploy/mail.env — at minimum confirm MAIL_HOSTNAME
docker compose -f docker-compose.yml -f docker-compose.prod.yml -f docker-compose.mail.yml up -d mailserver roundcube
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

**If an existing mailbox needs to also forward to an external address while
still keeping its own copy** (unlike an alias, which has no mailbox of its
own), `setup alias add` refuses — docker-mailserver will not let an address
be both a real account and an alias. The supported answer is a per-user
Sieve filter, `ENABLE_MANAGESIEVE=1` in `deploy/mail.env` plus a
`redirect :copy` script at that mailbox's own `.dovecot.sieve`:

```bash
# Enable Sieve processing once (needs a mailserver restart to take effect):
echo "ENABLE_MANAGESIEVE=1" >> deploy/mail.env
docker compose -f docker-compose.yml -f docker-compose.prod.yml -f docker-compose.mail.yml up -d mailserver

# Per mailbox that needs it — path is /var/mail/<domain>/<local-part>/home/.dovecot.sieve:
docker compose exec mailserver sh -c "cat > /var/mail/samgp.com/sales/home/.dovecot.sieve" <<'SIEVE'
require ["copy"];
redirect :copy "forward-target@example.com";
SIEVE
docker compose exec mailserver chown docker:docker /var/mail/samgp.com/sales/home/.dovecot.sieve
docker compose exec mailserver sievec /var/mail/samgp.com/sales/home/.dovecot.sieve
```

`redirect :copy` forwards **and** keeps the message in the mailbox; a bare
`redirect` (no `:copy`) forwards and stops further delivery, so the
mailbox never sees it at all — choose deliberately.

## Migrating mail from a previous host

`imapsync` (MIT licensed, the official `gilleslamiral/imapsync` Docker
image) copies mailboxes between any two IMAP servers without needing shell
access to either — the standard tool for exactly this, and how the
migration from this domain's previous DirectAdmin host was done. It never
deletes from the source by default, so a failed or partial run is safe to
re-run.

```bash
# --dry first: previews the copy, writes nothing.
docker run --rm --network host gilleslamiral/imapsync imapsync \
  --host1 <previous host, e.g. mail.samgp.com before cutover> \
  --user1 'info@samgp.com' --password1 '<its existing password>' --ssl1 \
  --host2 localhost --user2 'info@samgp.com' --password2 '<the SAME password just set on this server>' --ssl2 \
  --dry
# Drop --dry once the preview looks right. Re-run once more, after cutover,
# to pick up anything that arrived on the old host during the migration
# window — imapsync skips what it already copied, so this is a safe delta.
```

Reusing the exact same password on both sides (rather than inventing a new
one) means every mailbox owner's phone/desktop client keeps working with
zero reconfiguration once DNS cuts over to this server — same hostname,
same login, same password, just a different server behind it.

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

## Security checklist

- [x] `PERMIT_DOCKER=none` unchanged — verified locally to refuse an
      unauthenticated relay attempt; do not change this value.
- [x] Real Let's Encrypt certificate mounted (`SSL_TYPE=letsencrypt`), not
      `self-signed` — issued via DNS-01, live for `mail.samgp.com`.
- [ ] PTR record set with the hosting provider and matches `MAIL_HOSTNAME`
      — **not yet confirmed against this VPS's actual hosting provider.**
- [x] SPF and DKIM TXT records published — `mail._domainkey.samgp.com`
      verified resolving to the real key. **DMARC not yet published.**
- [x] Roundcube reachable only over HTTPS at `MAIL_HOSTNAME` (nginx's `443`
      block, not a published container port) and its own login is a real
      mailbox password created with `setup email add` — Roundcube has no
      separate admin account of its own to secure or forget about.
- [x] `deploy/mail.env` is not committed (matches every other real `.env` in
      this repository) and mailbox passwords are stored only in a password
      manager, never in a file in this repository.
- [ ] A decision made on `ENABLE_CLAMAV` based on the VPS's actual available
      RAM — **still off**; this VPS's RAM is modest (see the Amavis finding
      above), so 3–4 GB free should be confirmed before turning it on.
- [x] The real addresses migrated match what DirectAdmin actually had —
      ten mailboxes, confirmed against the previous host's own account
      list, not invented by this document. One DirectAdmin address
      (`samansa5@samgp.com`) was deliberately not migrated (owner decision).
- [ ] The old SPF record's `ip4:185.106.200.0/24` clause (the previous
      host's range) is still present alongside this server's own
      authorization — harmless to delivery today, but worth removing once
      the previous host is fully decommissioned, so SPF names only what
      can still legitimately send.
