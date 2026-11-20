# Coworker desk

Independent lab for the decide-then-record loop: a coworker proposes one action, a policy check runs before anything changes, and only Approve mutates an in-memory sandbox. Deny writes an audit row and leaves the files alone.

This is not an official CopilotKit or OpenBot product. The OpenBot application template is MIT. CopilotKit Intelligence is separately licensed and is not used here.

```sh
bun install
bun run dev
bun test
```

No model keys, license tokens, or network tools are required.
