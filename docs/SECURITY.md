# Security notes

## Group access

- Group and device tokens are generated with `crypto.getRandomValues`.
- D1 stores SHA-256 token hashes, not newly issued raw tokens.
- Each device receives separate read and edit tokens.
- Legacy group tokens remain usable and are migrated to a hash on their next authenticated request.
- Join codes expire after 90 days. Active device tokens expire after 180 days.
- Group creation and joining are rate limited per hashed Cloudflare client address.

## Data handling

- Reservation references and reservation attachments stay on the current device and are removed from group sync payloads.
- Group API payloads are limited to 4 MB and recursively constrained before D1 storage.
- User-provided external links must use HTTP or HTTPS.
- API responses are not cached. The service worker excludes `/api/` requests.

## Browser controls

Cloudflare Pages serves CSP, clickjacking, MIME sniffing, referrer, permissions, opener, and HSTS headers from `public/_headers`.

## Remaining operational limits

- Local browser storage is not encrypted. Do not store passwords, payment card data, passport data, or other high-impact secrets.
- Application-level user accounts are not included. For wider distribution, protect the site with Cloudflare Access or add an identity provider.
- If a device is lost, its token cannot currently be revoked from the UI. Token revocation and join-code rotation should be added before public multi-group operation.
