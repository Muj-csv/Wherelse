# Running the postcard garden

The solo world remains usable without an account or backend. Postcards are a separate, optional invited pilot backed by a Node HTTP service and a SQLite database. Static-only hosting supports the solo activities but cannot provide sharing.

## Local development

Use the Node 22 release pinned by `.nvmrc` (the cloud setup installs 22.23.4). The service uses Node's built-in SQLite API, which emits an experimental-feature warning on Node 22; no database package or remote provider is needed.

```sh
npm ci
npm run build
npm run community:init
npm start
```

`npm start` serves the built app and `/api` from port 8787, bound to loopback by default. For frontend editing, keep that service running and run `npm run dev` in another terminal. Vite proxies `/api` to port 8787. Vite preview is useful for the solo app; use the Node service for the full experience.

Initialization is repeatable and preserves existing invitation codes. It generates `.community/invitations.json` with owner-only permissions and never prints the codes. Read it privately in your local editor, distribute the **member** invitation only to your pilot group, and use the **moderator** invitation yourself to register a moderator account. Do not paste either code into chat, source control, screenshots, or a public issue. The moderator invitation can enroll moderators and must remain with the service owner.

Open **World guide → Visit the postcard garden**, choose **Join with an invitation**, and create an alias and a unique passphrase. There is no email recovery in this pilot. The solo world requires no account. Do not use production invitation codes in browser test fixtures.

## What is implemented

- Invited registration, password hashing with per-account salts and scrypt, sign-in, seven-day hashed server sessions, sign-out and account deletion.
- Only-me postcards by default. Audience review before submitting. Changing a shared card to Only me retracts it immediately.
- Community submissions remain pending until a moderator approves them. Editing or re-sharing a card requires review again. Moderator UI cannot read Only-me cards, including cards retracted after a report.
- Author deletion, bounded “I hear you” and “Thank you” responses without public popularity counts, two-way content blocking, unblocking, and reports that hide a card from the reporting member.
- Moderator approval, rejection, removal, report resolution and an action log. Removed cards have their body cleared; author deletion deletes the card. Account deletion cascades to its content and sessions.
- The feed includes all of your own cards and the latest 100 approved community cards, filtered for blocks and reports. Each personal shelf is limited to 100 cards. Posting and authentication have server-side request limits.
- Server-enforced access checks, SQL parameters, JSON body limits, same-origin/custom-header protection, HttpOnly/SameSite cookies and security headers. User content is rendered as text, never HTML.

## Storage and privacy

Private bench writing and Waters thoughts stay in the browser unless the visitor explicitly saves them there. They are not transferred to postcards. The Story Tree remembers only reading paths. These browser saves are not encrypted, shared or synced.

All postcards, including Only-me cards, are stored on the community service. Other members and the moderator interface cannot read private cards; the server operator can access the database. Do not present this as encrypted private messaging. Sign-out clears the postcard draft and visible feed; account deletion does not erase solo browser saves.

The `.community/` directory is ignored by Git and contains private invitations, database files, and live session records. Keep it owner-only, keep backups private, and define a backup retention/deletion policy before collecting real student content. Deleting content removes it from the live service; copies in older backups require separate expiry. SQLite secure-delete is enabled, but this is not a promise of forensic erasure of disks or backups. No content or passwords are written to application logs.

## Public hosting

Set these through the hosting service's secure environment settings:

| Name | Purpose |
| --- | --- |
| `COMMUNITY_ORIGIN` | Exact public HTTPS origin, without a path |
| `COMMUNITY_DATA_DIR` | Private directory on a persistent disk |
| `PORT` | Service port; default 8787 |
| `HOST` | Binding address; default 127.0.0.1; use 0.0.0.0 only behind the host's ingress |
| `COMMUNITY_INVITE_CODE` | Optional secure override for the member invitation |
| `COMMUNITY_MODERATOR_CODE` | Optional secure override for the moderator invitation |

`.env.example` lists names, not real credentials. The server does not automatically load `.env`: export variables in your shell or use the hosting environment settings. Configure your reverse proxy to terminate HTTPS and forward to this service. Public HTTP origins are rejected and public HTTPS configuration sets Secure session cookies. Browser requests must come from the configured origin; CORS is intentionally not opened to other sites. Local Vite development on localhost/127.0.0.1 port 5173 is additionally accepted only for a loopback configuration.

Run one service instance per SQLite database on a local persistent volume. This version is not designed for multiple replicas, network filesystems or serverless ephemeral storage. Back up the database with SQLite-aware tooling. The current frontend-only Vercel instructions apply to solo mode; deploying the postcard backend needs a Node host and persistent disk.

Before inviting real students, designate a human moderator, test their account and review queue, agree on community rules and response hours, define the pilot's age range and support contacts, and explain that this space is not continuously monitored or an emergency service. Approval and reporting controls are implemented; human moderation is an operating responsibility. No public hosting was provisioned by this change.

## Verification

```sh
npm run typecheck
npm test
npm run build
```

`npm test` uses isolated temporary databases to test cross-account access, moderation, retraction, deletion, persisted sessions, rate limits and invalid storage. Test identities and invitations are synthetic.

With Python Playwright and Chromium installed:

```sh
python tests/browser_smoke.py --url http://127.0.0.1:8787
python tests/world_browser.py
```

The first command targets the running built app. The second starts its own temporary service on port 8790 and uses separate member/moderator browser contexts. It checks Waters save/release, all Story Tree stories and recall, graphics settings, postcard audience review, moderation, responses, block/unblock, reporting, deletion and mobile layouts. Screenshots go to `/tmp/wherelse-world-browser`. The temporary accounts/database are removed afterward.

Physical low-end phone performance and a real student pilot remain to be measured. Graphics tiers reduce pixel ratio, shadows, instanced detail and decorative population; they do not constitute a measured frame-rate guarantee.
