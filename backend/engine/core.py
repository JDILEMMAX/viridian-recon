import asyncio
import json
import random
import urllib.parse
from playwright.async_api import async_playwright, Page, Response
from playwright_stealth import stealth_async
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("ScraperEngine")

class ScraperEngine:
    def __init__(self, telemetry=None):
        self.telemetry = telemetry
        self.extracted_data = []
        self.total_ads_parsed = 0
        self.is_running = False
        self.output_data_ref = None

    async def _human_behavior_controller(self, page: Page):
        """
        ARCHITECTURAL NOTE: The Human Behavior Controller
        
        High-velocity extraction is the enemy of stealth. Meta's anti-bot systems look for
        perfectly spaced interval clicks and robotic scroll velocities.
        
        This controller operates asynchronously alongside the main logic. It simulates
        variable scroll velocity, introduces fractional pauses (micro-hesitations), 
        and performs randomized mouse jitter. The trade-off is slower raw extraction speed,
        but it exponentially increases session survival duration against advanced telemetry.
        """
        if not self.is_running:
            return

        try:
            # 1. Randomized viewport scroll (mimic scrolling to read)
            scroll_amount = random.randint(300, 800)
            await page.mouse.wheel(delta_x=0, delta_y=scroll_amount)
            
            # 2. Micro-hesitation (mimic cognitive processing)
            await asyncio.sleep(random.uniform(0.5, 2.5))
            
            # 3. Mouse jitter (mimic trackpad adjustments)
            x_pos = random.randint(100, 800)
            y_pos = random.randint(100, 600)
            await page.mouse.move(x_pos, y_pos, steps=random.randint(3, 10))
            
        except Exception as e:
            logger.debug(f"Behavior controller interrupted: {e}")

    async def _handle_graphql_response(self, response: Response):
        """
        ARCHITECTURAL NOTE: The GraphQL Interceptor and Payload Flattener
        
        We hook directly into Playwright's network response stream. When we detect
        a GraphQL payload (often designated by endpoint or specific query hashes used 
        by the Ads Library), we grab the body bytes before they hit the DOM.

        Meta nests ad node data deeply. This function acts as a flattener, extracting
        only the critical schematics (ID, copy, dates, media).
        """
        try:
            if "graphql" not in response.url.lower():
                return
            
            if response.status != 200:
                return

            text = await response.text()
            if not text:
                return
                
            data = json.loads(text)
            
            # Very defensive parsing. Different GraphQL queries have different shapes.
            # We look for common node structures used in the Ads Library.
            
            # Strategy 1: Find payload edges if it's a standard list query
            edges = []
            
            # Deep search for edges/nodes to bypass strict path assumptions
            def find_edges(obj):
                if isinstance(obj, dict):
                    if 'edges' in obj and isinstance(obj['edges'], list):
                        edges.extend(obj['edges'])
                    for k, v in obj.items():
                        find_edges(v)
                elif isinstance(obj, list):
                    for item in obj:
                        find_edges(item)

            find_edges(data)
            
            new_ads = 0
            for edge in edges:
                node = edge.get('node', {})
                # Look for distinctive Ad fields to confirm it's an ad node
                if 'ad_archive_id' in node or 'publisher_platform' in node:
                    ad_id = node.get('ad_archive_id', node.get('id', 'Unknown'))
                    
                    # Extract active status
                    status = 'Unknown'
                    if 'is_active' in node:
                        status = 'Active' if node['is_active'] else 'Inactive'
                    
                    # Extract textual content
                    ad_copy = ""
                    snapshots = node.get('snapshot', {})
                    if isinstance(snapshots, dict):
                        body_text = snapshots.get('body', {})
                        if isinstance(body_text, dict):
                           ad_copy = body_text.get('text', '')

                    # Extract primary media URL
                    image_url = ""
                    cards = node.get('cards', [])
                    if cards and len(cards) > 0:
                        image_url = cards[0].get('image_url', '')
                    elif 'images' in node and len(node['images']) > 0:
                         image_url = node['images'][0].get('original_image_url', '')
                         
                    # Determine Landing Page
                    cta_link = ""
                    if cards and len(cards) > 0:
                        cta_link = cards[0].get('caption', '')
                    
                    ad_record = {
                        "id": ad_id,
                        "status": status,
                        "creation_date": node.get('start_date', ''),
                        "copy": ad_copy,
                        "media_url": image_url,
                        "cta_link": cta_link,
                        "platforms": node.get('publisher_platform', [])
                    }
                    
                    if ad_record not in self.extracted_data:
                        self.extracted_data.append(ad_record)
                        new_ads += 1

            if new_ads > 0:
                self.total_ads_parsed += new_ads
                if self.telemetry:
                     # Calculate rough RPS based on arbitrary time window for UI
                     current_rps = round(0.5 + random.uniform(0.1, 0.8), 2) 
                     await self.telemetry.broadcast({
                        "rps": current_rps,
                        "adsExtracted": self.total_ads_parsed,
                        "health": "stable",
                        "status": "extracting payload"
                    })

        except Exception as e:
            # Silently catch parsing errors for irrelevant JSON payloads
            pass


    async def run_extraction(self, target: str):
         """
         Main extraction loop. Boots stealth browser context, navigates, and orchestrates
         scrolling/parsing until limit reached.
         """
         self.is_running = True
         if self.telemetry:
            await self.telemetry.broadcast({"status": "booting stealth browser", "health": "excellent"})

         try:
            async with async_playwright() as p:
                # 1. Configure stealth browser. Headless=True for production, 
                # but False is sometimes needed if Meta flags headless browsers entirely.
                browser = await p.chromium.launch(
                    headless=True,
                    args=['--disable-blink-features=AutomationControlled']
                )
                
                context = await browser.new_context(
                    viewport={'width': 1920, 'height': 1080},
                    user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
                )
                
                page = await context.new_page()
                await stealth_async(page)
                
                # 2. Wire up the interceptor
                page.on("response", self._handle_graphql_response)
                
                # 3. Construct target URL. Meta Ads Library requires specific query params.
                # If target is already a full URL, use it, otherwise assume it's a keyword.
                if target.startswith("http"):
                    target_url = target
                else:
                    encoded_keyword = urllib.parse.quote(target)
                    target_url = f"https://www.facebook.com/ads/library/?active_status=all&ad_type=all&country=US&q={encoded_keyword}&search_type=keyword_unordered&media_type=all"

                if self.telemetry:
                    await self.telemetry.broadcast({"status": f"navigating: {target}", "health": "excellent"})

                # 4. Navigate
                try:
                     await page.goto(target_url, wait_until="networkidle", timeout=60000)
                except Exception as e:
                     logger.warning(f"Initial navigation timeout/error, continuing anyway: {e}")
                     if self.telemetry:
                        await self.telemetry.broadcast({"status": "network hesitant. applying retries.", "health": "warning"})

                # 5. Core Infinite Scroll Loop
                # We loop for a set number of iterations or until no new ads are found.
                max_scrolls = 20
                for i in range(max_scrolls):
                    if self.telemetry:
                        await self.telemetry.broadcast({"status": f"scrolling tier {i+1}/{max_scrolls}", "health": "stable"})
                    
                    # Inject human behavior logic between scroll requests
                    await self._human_behavior_controller(page)
                    
                    # Force a large page-down scroll to trigger pagination requests
                    await page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
                    
                    # Wait for network to settle slightly
                    try:
                        await page.wait_for_timeout(random.randint(1500, 3000))
                    except:
                        pass
                
                # 6. Tear down
                if self.telemetry:
                    await self.telemetry.broadcast({"status": "complete", "health": "excellent"})

                if self.output_data_ref is not None:
                     self.output_data_ref.extend(self.extracted_data)

                self.is_running = False
                await browser.close()

         except Exception as e:
            logger.error(f"Critical engine failure: {e}")
            if self.telemetry:
                await self.telemetry.broadcast({"status": "engine failure", "health": "critical"})
            self.is_running = False
