# Viridian Recon

Viridian Recon is a high-performance Meta Ads Library extraction engine. It is engineered from first principles to bypass modern network bot detection while delivering structured data via an ultra-premium glassmorphism command center.

## Architecture
The system is split into a relentless extraction backend and a highly polished reactive frontend.
* **Frontend**: Next.js, Tailwind CSS and Framer Motion. 
* **Backend**: FastAPI, WebSockets and Playwright.
* **Infrastructure**: Completely containerized via Docker.

## Core Capabilities
* **Targeted Extraction**: Search by keyword, page URL or slug.
* **Stealth Operations**: Under-the-radar network interception with resilient infinite scroll handling.
* **Live Telemetry & Diagnostics**: Real-time connection via WebSockets displaying requests per second, system health and total payload size. Features a comprehensive floating Analytics Overlay.
* **Dynamic Aesthetics**: Emerald glassmorphism with true refractive physics. Includes frosted/clear state toggles and pointer-reactive panel edge lighting.
* **Export**: Clean JSON or CSV data dumps.

## Setup Instructions
The entire stack is configured for instant deployment. You do not need to configure isolated virtual environments or Node runtimes.

1. Ensure Docker is installed and running on your host machine.
2. Clone the repository and navigate to the root directory.
3. Execute the following command:
   `docker-compose up --build`
4. Access the command center at `http://localhost:3000`. The backend socket connects automatically on port 8000.

## Terminal Mastery
For power users, Viridian Recon can be fully operated headlessly via the terminal:

**1. Trigger Extraction:**
```bash
curl -X POST http://localhost:8000/api/extract \
  -H "Content-Type: application/json" \
  -d '{"target": "nike"}'
```

**2. Monitor Telemetry (requires wscat or similar WebSocket client):**
```bash
wscat -c ws://localhost:8000/ws/telemetry
```

**3. Export Payload:**
```bash
curl -s http://localhost:8000/api/export > payload.json
```

## Testing Suite & Diagnostics
The backend features a robust Pytest suite mimicking complex GraphQL layouts to ensure the extraction flattener operates flawlessly without regressions.

Run the automated test suite locally or inside Docker:
```bash
docker-compose exec backend pytest tests/
```

Execute run-time diagnostics to verify Playwright capabilities and bindings:
```bash
docker-compose exec backend python diagnostic.py
```
