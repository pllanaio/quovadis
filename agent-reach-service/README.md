# Agent Reach in QuoVadis

Upstream: https://github.com/Panniantong/Agent-Reach, MIT, version 1.6.0,
revision `beabda7486e9a666360b18cdb5c0e759c2c4d20f`.

Docker installs the actual Python package and links its rendered skill into
`/opt/quovadis/skills/agent-reach`. No runtime package installation or self-update.
The private service exposes only authenticated status and public social-URL reads,
using Agent Reach's Jina web backend. QuoVadis first tries its own public reader;
Reach fills missing page text. Native OpenCLI channels are not installed: these
can still require personal login and do not provide universal anonymous access.
No passwords/cookies are sent to Reach. Existing encrypted Playwright sessions
remain an explicitly selected alternative in the frontend, never an automatic
fallback after rate limits, login walls or security challenges.

Profile descriptions, index snippets and article bodies have distinct coverage.
Only actually read post URLs count as observed posts. No inferred publication dates,
complete posting frequency, prices or service demand from missing access.

The service has no published host port and mounts app_data read-only solely to
validate the internal worker token. User settings require no server environment
variables. Update through the normal Compose build.
