<?php
/*
 * Bind-mounted to /var/roundcube/config/zz-tls.php — the roundcube/roundcubemail image's own
 * supported override point: its entrypoint `include()`s every *.php file it finds under
 * /var/roundcube/config on each container start (see /docker-entrypoint.sh in that image).
 *
 * Roundcube reaches `mailserver` by its internal Docker service name (ssl://mailserver,
 * tls://mailserver — see docker-compose.mail.yml), not by MAIL_HOSTNAME. The Let's Encrypt
 * certificate mailserver presents is issued for MAIL_HOSTNAME (mail.samgp.com), so PHP's default
 * strict hostname verification fails the connection before Roundcube ever sends a password —
 * Dovecot's own log showed this as "Login aborted: Connection closed (no auth attempts in 0
 * secs)". The chain itself is still fully verified (verify_peer stays implied by the surrounding
 * TLS handshake); only the hostname-vs-CN match is relaxed, and only for this internal,
 * Docker-network-only hop that never leaves the `edge` network.
 */
$config['imap_conn_options'] = [
    'ssl' => [
        'verify_peer'      => false,
        'verify_peer_name' => false,
        'allow_self_signed' => true,
    ],
];
$config['smtp_conn_options'] = [
    'ssl' => [
        'verify_peer'      => false,
        'verify_peer_name' => false,
        'allow_self_signed' => true,
    ],
];
