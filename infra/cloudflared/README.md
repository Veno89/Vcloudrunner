# Cloudflared Tunnel (Single-Node Ingress)

This directory contains baseline Cloudflare Tunnel configuration for the MVP.

## Setup

1. Create a Cloudflare tunnel and obtain a tunnel token.
2. Export token for compose:
   ```bash
   export CLOUDFLARED_TOKEN='<your-token>'
   ```
3. Start the optional tunnel profile:
   ```bash
   docker compose --profile tunnel up -d cloudflared
   ```

Optional file-based ingress template is provided in `config.yml.example`.

The `cloudflared` service forwards edge traffic into local `caddy` and avoids router port-forwarding.
