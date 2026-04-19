# Inter-Agent Messaging

Octogent has a simple local channel system for messages between terminals.

## What it is for

Use channel messages for short coordination:

- ask for review
- report completion
- hand off a finding
- point another agent to a file or risk

It is not a replacement for proper context files.

## CLI usage

Send a message:

```bash
octogent channel send <terminal-id> "Need review on the parser change"
```

List messages:

```bash
octogent channel list <terminal-id>
```

## API usage

- `POST /api/channels/:terminalId/messages`
- `GET /api/channels/:terminalId/messages`

## Current behavior

- messages are stored in memory
- messages do not persist across API restarts
- delivery state is tracked by the API

## Practical rule

If a message needs to survive, write it into the tentacle files. Use the channel for short-lived coordination only.
