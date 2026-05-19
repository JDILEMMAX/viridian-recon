import asyncio
import sys
import json
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from engine.core import ScraperEngine

if sys.platform == "win32":
    try:
        asyncio.set_event_loop_policy(asyncio.WindowsProactorEventLoopPolicy())
    except AttributeError:
        pass

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
        self.main_loop = None
        # ARCHITECTURAL NOTE: Telemetry Caching
        # We cache the state so refreshes instantly sync the UI without 
        # waiting for the next scraper loop iteration.
        self.last_state = {"status": "idle", "health": "standby", "rps": 0.0, "adsExtracted": 0}

    async def connect(self, websocket: WebSocket):
        if self.main_loop is None:
            self.main_loop = asyncio.get_running_loop()
        await websocket.accept()
        self.active_connections.append(websocket)
        # Instantly sync state to newly connected client
        await websocket.send_text(json.dumps(self.last_state))

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)

    async def broadcast(self, message: dict):
        try:
            current_loop = asyncio.get_running_loop()
        except RuntimeError:
            current_loop = None
            
        if self.main_loop and current_loop != self.main_loop:
            asyncio.run_coroutine_threadsafe(self._broadcast_internal(message), self.main_loop)
        else:
            await self._broadcast_internal(message)

    async def _broadcast_internal(self, message: dict):
        self.last_state.update(message)
        for connection in list(self.active_connections):
            try:
                await connection.send_text(json.dumps(message))
            except Exception:
                pass # Fire and forget

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

# Global data and engine reference
current_extraction_data = []
active_engine = None # FIX: Initialized globally to prevent NameError

import threading

def run_extraction_in_thread(target):
    global active_engine
    # This will use the ProactorEventLoop policy set at the top of the file
    new_loop = asyncio.new_event_loop()
    asyncio.set_event_loop(new_loop)
    
    engine = ScraperEngine(telemetry=telemetry)
    active_engine = engine # Map the instance to the global reference
    
    # Give the engine a reference to dump data into
    engine.output_data_ref = current_extraction_data
    try:
        new_loop.run_until_complete(engine.run_extraction(target))
    finally:
        active_engine = None # Clear reference upon completion
        new_loop.close()

@app.post("/api/extract")
async def extract_data(payload: dict):
    global current_extraction_data
    # Reset on new extraction
    current_extraction_data.clear()
    
    # Reset telemetry cache for the new run
    telemetry.last_state.update({"rps": 0.0, "adsExtracted": 0})

    # Retrieve target config
    target = payload.get("target", "")
    
    # We trigger a background task for true async scraping, letting the API return immediately.
    # The client UI listens on the WebSocket for state updates.
    # Bypass Uvicorn's SelectorEventLoop by running Playwright in a fresh thread/loop
    thread = threading.Thread(target=run_extraction_in_thread, args=(target,), daemon=True)
    thread.start()
    
    return {"status": "Extraction sequence initiated"}

@app.post("/api/stop")
async def stop_extraction():
    global active_engine
    if active_engine:
        active_engine.is_running = False # Flip the kill switch
        return {"status": "Stop command issued"}
    return {"status": "No active engine found"}

@app.get("/api/export")
async def export_data():
    return {"data": current_extraction_data}
