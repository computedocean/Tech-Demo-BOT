# pathwarden-path-desk

## Goal
Ship a single-user Bun + Vite React desk that visualizes **synthetic** Active Directory / Entra ID attack paths to Tier Zero, ranks findings, shows a minimum fix set you can toggle to watch paths close, and diffs a short scan-history timeline — fully offline, with no real directory, no collectors, and no scanning or attacking of anything.

## Reality check
Verified 2026-11-21 from [marbas207/Pathwarden](https://github.com/marbas207/Pathwarden) (homepage [pathwarden.org](https://pathwarden.org)). GitHub SPDX and the repo `LICENSE` are **Apache-2.0**. Pathwarden is free, open-source **attack-path management** for AD and Entra ID: it finds every path to **Tier Zero**, ranks findings, computes a **remediation path** (a minimum cut: the fewest changes that leave no account outside Tier Zero with a path into it), and tracks each finding from run to run (New, Open, Back, Fixed, and related states). It can read SharpHound, RustHound-CE, and AzureHound collections, or collect itself. Official docs used for this plan: [README](https://github.com/marbas207/Pathwarden/blob/main/README.md), [How it works](https://github.com/marbas207/Pathwarden/blob/main/docs/how-it-works.md), [Rules](https://github.com/marbas207/Pathwarden/blob/main/docs/rules.md).

**This demo is not Pathwarden.** It is an independent, simulated one-screen lab that models those product ideas on a **bundled synthetic graph**. It must never sign in to a domain, run a collector, talk to LDAP/SMB/Kerberos, or scan a network. Do not ship official “how to collect” or “how to abuse” procedures, and do not copy Pathwarden’s step-by-step PowerShell guides. Prefer an original TypeScript implementation of path walk, ranking, min-cut, and diffs. Reuse Apache-2.0 source only with attribution and the license notice; do not vendor the collector or a large official dataset.

**Synthetic data only.** Invent a small original company (not a copy of a real domain, and not a wholesale dump of Pathwarden’s SCALE.LOCAL corpus). Use clearly fake names (users, groups, computers, an Entra tenant). “GTA 6” and other unrelated brands do not belong here. Graph edges may use well-known defensive relationship labels (for example `MemberOf`, `AdminTo`, `HasSession`, and a small set of permission edges such as `GenericAll` / `DCSync`) as **labels on fixtures**, not as a tutorial.

## Single-user MVP
- Scaffold with `bunx create-vite` (React + TypeScript). Add `bunfig.toml` with `[install]` and `minimumReleaseAge = 259200` **before** any install, then `bun install`.
- Init shadcn/ui with a minimalist preset (Nova or the closest available preset).
- Add a `.gitignore` covering `node_modules`, `dist`, `.vite`, `.env`, and `.env.local`. No API keys are required; do not add a live-model path.
- One-page (or tight tabbed) **path desk**, labeled **independent and simulated** in the header or footer:
  1. **Attack-path graph to Tier Zero, with ranked findings.** On load, render a bundled synthetic AD + Entra graph (users, groups, computers, a domain / DC, a Tier Zero set such as Domain Admins / a domain controller, and at least one hybrid Entra Tier Zero link). Pan/zoom the graph, highlight a selected path, and list **ranked findings** (most severe / most exposed first). Ranking should follow Pathwarden’s idea: count how many non–Tier Zero accounts can use a path or finding, and band severity from that share (Critical from 95%, High from 80%, Medium from 40%, otherwise Low; direct control of Tier Zero, such as DCSync or control of a Tier Zero object, is at least High). Show a short headline count of accounts with a path to Tier Zero. Click a finding to draw its path from a start object to Tier Zero.
  2. **Minimum fix set panel.** Compute the **smallest set of changes** (edge removals or equivalent high-level remediations, e.g. “remove this AdminTo right”) that disconnects every non–Tier Zero account from Tier Zero. List those fixes, most effective first (paths closed or accounts cut per toggle). **Toggling a fix on** must immediately hide or dim every path that used that edge; toggling it off restores them. Applying the full recommended set must leave **zero** remaining paths from non–Tier Zero accounts into Tier Zero on the active graph. Do not propose impossible cuts (for example, removing Domain Users as a class of membership). Fixes are described at a high level only — no exploit steps, no live directory commands.
  3. **Scan-history timeline.** Bundle **3–4 sample snapshots** of the same synthetic environment. A timeline or run list diffs findings across runs and badges them **New**, **Fixed**, and **Regressed** (Pathwarden’s **Back**: a finding that was fixed earlier and has returned). Open findings that persist may stay **Open**. Switching snapshots updates the graph and findings. This is fixture history, not a live re-scan.
  4. **Optional import** of a **small** RustHound/SharpHound-style JSON (BloodHound CE-style `data` + `meta` envelope, v5 or v6; a single file or a tiny zip of `users` / `groups` / `computers` files). Support a **documented, limited subset**: `ObjectIdentifier`, `Properties.name` (and domain when present), group `Members`, computer sessions, local-admin / `AdminTo`-style links, and a small allow-list of ACE rights that map to the demo’s edge types. **Size-capped** (keep the cap low — tens of objects, a small megabyte-or-less file). Reject missing/invalid `meta`, unknown or huge payloads, and graphs that cannot be parsed safely. Import is a local file read only: **never** treat it as permission to collect from a network. Bundle a tiny **valid** sample and at least one **invalid** fixture for tests. If import fails, stay on the bundled graph with a clear error. Imported graphs are analyzed with the same path / min-cut / ranking code; say clearly that the result is a **simulation on the file the user provided**.
  5. Footer: **independent demo, simulated, not the official Pathwarden product**, not affiliated with Pathwarden or MarbaSec, **does not scan or attack any network**, and uses a **synthetic** directory (or a user-supplied file). Attribute **Pathwarden, Apache-2.0**, and link https://github.com/marbas207/Pathwarden. If any upstream code is reused, keep the Apache-2.0 license notice.
- Vendor the bundled graph and snapshots as original synthetic fixtures, with a short source note in the app. No real domain data, no secrets, no credentials.
- `bun install && bun run dev` from `apps/pathwarden-path-desk/` must run with **no secrets**, no network requirement after install, and no extra system deps. Self-contained `package.json`; no monorepo workspace dependencies.
- **Tests (required):** `bun test` covering at least: (a) **path ranking** — on the bundled graph, findings are ordered by the documented severity/exposure rules, and the account-with-a-path count is correct; (b) **min-fix-set correctness** — the recommended set is sufficient (no residual non–T0 path to T0 when all recommended fixes are applied) and necessary in the sense that omitting a recommended fix leaves at least one path that fix was meant to close; toggling a single fix closes exactly the paths that include that edge; (c) **scan diff badges** — given the bundled snapshots, New / Fixed / Regressed (Back) labels match the fixture answer key; (d) **import validation** — a small valid SharpHound/RustHound-style sample is accepted and produces a graph; malformed, oversized, or missing-`meta` files are rejected without throwing past the handler; (e) no API keys in client bundles, and no collector or network-scan entry point ships in the default app.
- **Validation:** Playwright captures **at least one screenshot** of the running UI (graph, ranked findings, and min-fix panel visible). The PR also includes **at least one video** (under 15 MB) of highlighting a path, toggling a fix so paths disappear, stepping the scan-history timeline so badges are visible, and (optionally) a successful or failed import. Attach both to **exactly one PR**. Do not commit large videos. **Do not merge the PR.**

## Explicitly out of scope
- Collectors, live LDAP / SMB / Kerberos, domain join, or scanning or attacking any real network or tenant.
- Implementing the full Pathwarden 38-rule catalog, AD CS ESC how-tos, ServiceNow/Jira plugins, git-encrypted run history, or signed evidence packs.
- Exploit procedures, PoCs, payloads, or copy-pasted official PowerShell “abuse” or “collect” guides.
- Auth, routing, deploy, a new GitHub repo, or changes outside `apps/pathwarden-path-desk/`.
- Shared monorepo workspace deps. Merging the PR. Implying this app is official Pathwarden.

## Outcome-oriented tasks
1. Scaffold Vite React-TS under `apps/pathwarden-path-desk/`, add `bunfig.toml` and `.gitignore`, install with Bun, init shadcn, and vendor a small original synthetic AD/Entra graph plus 3–4 snapshots.
2. Implement path enumeration to Tier Zero, exposure-based ranking, the interactive graph, and the ranked findings list.
3. Implement the minimum fix set with live path hiding on toggle, the scan-history timeline with New/Fixed/Regressed badges, and the size-capped SharpHound/RustHound-style importer with clear validation errors.
4. Write `bun test` coverage for path ranking, min-fix-set correctness, scan diff badges, and import validation (plus no keys / no collector in the default app).
5. Add Playwright screenshot capture of the running app, record a short video (under 15 MB), and open exactly one PR with both artifacts attached. Do not merge.

## Stack
- **Bun** — runtime, package manager, scripts, and tests (repo rule).
- **Vite + React + TypeScript** — official one-screen scaffold.
- **shadcn/ui + Tailwind** — findings list, fix-set panel, timeline, and import controls.
- **A maintained graph view (e.g. React Flow / @xyflow/react)** — pan, zoom, and path highlighting without a custom engine.
- **Playwright** — screenshot validation of the running UI (plus a manually or script-recorded video attached to the PR).

## Secrets
None required. Do not add API keys or collector credentials. Do not commit tokens.

## License limits
Pathwarden is **Apache-2.0**. This desk is original work in the monorepo and is **not** the official product. Reuse upstream source only with attribution and the Apache-2.0 notice. Bundled fixtures must be original and synthetic. The demo is not affiliated with Pathwarden or MarbaSec.

## Deferred
- A full BloodHound CE importer, AzureHound, OpenGraph, PingCastle, and zip-of-everything compatibility — a small documented subset is enough.
- Live re-test against a fresh collection, accepted-risk workflow, and ticket plugins — out of scope on purpose.
- Cloudflare Pages preview wiring — optional later.

## Source
https://github.com/marbas207/Pathwarden  
Bookmark (approval source): https://x.com/g0h4n_0/status/2121948225020023120
