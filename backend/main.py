import asyncio
import json
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from engine.core import ScraperEngine

app = FastAPI(title="Viridian Recon API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class TelemetryManager:
    def __init__(self):
        self.active_connections: list[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)

    async def broadcast(self, message: dict):
        for connection in self.active_connections:
            try:
                await connection.send_text(json.dumps(message))
            except Exception:
                pass # Fire and forget, broken pipes handled by disconnect

telemetry = TelemetryManager()

@app.websocket("/ws/telemetry")
async def websocket_endpoint(websocket: WebSocket):
    """
    ARCHITECTURAL NOTE: WebSocket Synchronization Strategy
    Instead of traditional polling which hammers the server and clogs the network tab, 
    we maintain an open, full-duplex streaming channel. The extraction engine pushes 
    yield metrics (RPS, payload sizes) directly to `telemetry.broadcast()` via asyncio. 
    This completely decouples the heavy Playwright I/O cycle from the client notification 
    loop, ensuring zero blocking and real-time visualization on the frontend command center.
    """
    await telemetry.connect(websocket)
    try:
        while True:
            # Keep alive and handle potential inbound commands
            data = await websocket.receive_text()
    except WebSocketDisconnect:
        telemetry.disconnect(websocket)

# Global dictionary to store the extracted data for a single run
current_extraction_data = []

@app.post("/api/extract")
async def extract_data(payload: dict):
    global current_extraction_data
    # Reset on new extraction
    current_extraction_data = []

    # Retrieve target config
    target = payload.get("target", "")
    
    # We trigger a background task for true async scraping, letting the API return immediately.
    # The client UI listens on the WebSocket for state updates.
    engine = ScraperEngine(telemetry=telemetry)
    # Give the engine a reference to dump data into
    engine.output_data_ref = current_extraction_data
    asyncio.create_task(engine.run_extraction(target))
    
    return {"status": "Extraction sequence initiated"}

@app.get("/api/export")
async def export_data():
    global current_extraction_data
    return {"data": current_extraction_data}
