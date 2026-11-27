# Path desk

Independent, simulated lab for ranking paths to Tier Zero, a minimum fix set, and a short scan history. It is not the official [Pathwarden](https://github.com/marbas207/Pathwarden) product and is not affiliated with Pathwarden or MarbaSec. It does not scan or attack any network.

Pathwarden is Apache-2.0. This desk is original TypeScript. No Pathwarden source is copied.

```sh
bun install
bun run dev
bun test
```

The bundled directory is an invented company, Northglass Analytical.

## Import subset

Local file only. BloodHound CE envelope, version 5 or 6:

- `meta.version` is `5` or `6`
- `meta.type` is `users`, `groups`, `computers`, or `mixed`
- `data` is an array of at most 40 objects, and the file is at most 256 KB
- A small zip of those JSON files is accepted when the uncompressed total stays under the same cap

Each object uses `ObjectIdentifier`, `Properties.name`, optional `Properties.domain`, and `Properties.highvalue`.

Relationships read from the file:

- group `Members` become `MemberOf` (membership in a group named Domain Users is not offered as a fix)
- computer `LocalAdmins` become `AdminTo`
- computer `Sessions` become `HasSession`
- ACE `RightName` values `GenericAll`, `GenericWrite`, `DCSync`, `AddMember`, and `AdminTo`

Anything else is ignored. Invalid or oversized files stay on the bundled graph and show an error.
