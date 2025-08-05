import asyncio
import json
import os
import signal
import sys
import configparser
from datetime import datetime
from typing import Dict, List, Any
from playwright.async_api import async_playwright
from colorama import init, Fore, Style

init()


class CDPAnalyzer:
    def __init__(self, logs_dir: str = "cdp_logs"):
        self.logs_dir = logs_dir
        self.network_logs: List[Dict[str, Any]] = []
        self.session_start = datetime.now()
        self.running = True
        
        # Load settings from INI file
        self.config = configparser.ConfigParser()
        self.config.read('settings.ini')
        
        # Get filter settings
        self.ignore_images = self.config.getboolean('CDP_ANALYZER', 'ignore_images', fallback=True)
        self.image_extensions = [ext.strip() for ext in self.config.get('CDP_ANALYZER', 'image_extensions', fallback='jpg,jpeg,png,gif,webp,svg,ico,bmp,tiff').split(',')]
        self.ignore_resource_types = [rt.strip() for rt in self.config.get('CDP_ANALYZER', 'ignore_resource_types', fallback='image,media,font').split(',')]
        self.ignore_domains = [d.strip() for d in self.config.get('CDP_ANALYZER', 'ignore_domains', fallback='').split(',') if d.strip()]
        self.ignore_url_patterns = [p.strip() for p in self.config.get('CDP_ANALYZER', 'ignore_url_patterns', fallback='').split(',') if p.strip()]
        self.min_response_size = self.config.getint('CDP_ANALYZER', 'min_response_size', fallback=0)
        self.verbose_logging = self.config.getboolean('CDP_ANALYZER', 'verbose_logging', fallback=True)
        
        os.makedirs(self.logs_dir, exist_ok=True)
        
        # Print loaded settings
        print(f"{Fore.CYAN}=== CDP Analyzer Settings ==={Style.RESET_ALL}")
        print(f"Ignore images: {self.ignore_images}")
        if self.ignore_images:
            print(f"Image extensions: {', '.join(self.image_extensions)}")
        print(f"Ignore resource types: {', '.join(self.ignore_resource_types)}")
        if self.ignore_domains:
            print(f"Ignore domains: {', '.join(self.ignore_domains)}")
        print(f"Verbose logging: {self.verbose_logging}")
        print(f"{Fore.CYAN}========================={Style.RESET_ALL}\n")

    def setup_page_listeners(self, page):
        page.on("request", lambda request: self._handle_request(request))
        page.on("response", lambda response: self._handle_response(response))
        page.on("requestfailed", lambda request: self._handle_request_failed(request))
        
        print(f"{Fore.GREEN}Network listeners activated{Style.RESET_ALL}")
        print(f"{Fore.YELLOW}Capturing network logs...{Style.RESET_ALL}")
    
    def _should_ignore_request(self, request):
        """Check if a request should be ignored based on settings"""
        # Check resource type
        if request.resource_type in self.ignore_resource_types:
            return True
        
        # Check if it's an image by extension
        if self.ignore_images:
            url = request.url.lower()
            for ext in self.image_extensions:
                if f'.{ext}' in url:
                    return True
        
        # Check ignored domains
        for domain in self.ignore_domains:
            if domain in request.url:
                return True
        
        # Check URL patterns
        for pattern in self.ignore_url_patterns:
            if pattern.replace('*', '') in request.url:
                return True
        
        return False

    def _handle_request(self, request):
        # Check if request should be ignored
        if self._should_ignore_request(request):
            if self.verbose_logging:
                print(f"{Fore.YELLOW}[IGNORED]{Style.RESET_ALL} {request.resource_type} {request.url[:80]}...")
            return
        
        request_data = {
            "type": "request",
            "timestamp": datetime.now().isoformat(),
            "url": request.url,
            "method": request.method,
            "headers": request.headers,
            "post_data": request.post_data,
            "resource_type": request.resource_type,
        }
        self.network_logs.append(request_data)
        print(f"{Fore.GREEN}[REQUEST]{Style.RESET_ALL} {request.method} {request.url[:80]}... (Total: {len(self.network_logs)})")

    def _handle_response(self, response):
        # Check if the request was ignored
        try:
            # Get the request object from response
            request = response.request
            if self._should_ignore_request(request):
                return
        except:
            # If we can't get request info, check URL patterns
            url = response.url.lower()
            if self.ignore_images:
                for ext in self.image_extensions:
                    if f'.{ext}' in url:
                        return
        
        response_data = {
            "type": "response",
            "timestamp": datetime.now().isoformat(),
            "url": response.url,
            "status": response.status,
            "status_text": response.status_text,
            "headers": response.headers,
        }
        self.network_logs.append(response_data)
        status_color = Fore.GREEN if response.status < 400 else Fore.RED
        print(f"{status_color}[RESPONSE]{Style.RESET_ALL} {response.status} {response.url[:80]}...")

    def _handle_request_failed(self, request):
        # Check if request should be ignored
        if self._should_ignore_request(request):
            return
        
        failed_data = {
            "type": "request_failed",
            "timestamp": datetime.now().isoformat(),
            "url": request.url,
            "failure": request.failure,
            "resource_type": request.resource_type,
        }
        self.network_logs.append(failed_data)
        print(f"{Fore.RED}[FAILED]{Style.RESET_ALL} {request.url[:80]}...")

    def stop(self):
        self.running = False

    def save_logs(self):
        timestamp = self.session_start.strftime("%Y%m%d_%H%M%S")
        log_file = os.path.join(self.logs_dir, f"network_logs_{timestamp}.json")
        
        print(f"\n{Fore.CYAN}=== Saving Logs ==={Style.RESET_ALL}")
        print(f"{Fore.CYAN}Total captured events: {len(self.network_logs)}{Style.RESET_ALL}")
        print(f"{Fore.CYAN}Log directory: {os.path.abspath(self.logs_dir)}{Style.RESET_ALL}")
        
        if self.network_logs:
            try:
                with open(log_file, "w", encoding="utf-8") as f:
                    json.dump(self.network_logs, f, indent=2, ensure_ascii=False)
                print(f"{Fore.GREEN}Logs saved to: {os.path.abspath(log_file)}{Style.RESET_ALL}")
                print(f"{Fore.GREEN}File size: {os.path.getsize(log_file)} bytes{Style.RESET_ALL}")
                return log_file
            except Exception as e:
                print(f"{Fore.RED}Error saving logs: {e}{Style.RESET_ALL}")
                return None
        else:
            print(f"{Fore.RED}No logs captured!{Style.RESET_ALL}")
            return None

    def analyze_logs(self, search_term: str = None):
        print(f"\n{Fore.CYAN}=== Network Log Analysis ==={Style.RESET_ALL}")
        print(f"Total requests: {len([log for log in self.network_logs if log['type'] == 'request'])}")
        
        requests_by_domain = {}
        for log in self.network_logs:
            if log["type"] == "request":
                url = log["url"]
                if url:
                    try:
                        domain = url.split("//")[1].split("/")[0]
                        requests_by_domain[domain] = requests_by_domain.get(domain, 0) + 1
                    except:
                        pass
        
        print(f"\n{Fore.YELLOW}Requests by domain:{Style.RESET_ALL}")
        for domain, count in sorted(requests_by_domain.items(), key=lambda x: x[1], reverse=True)[:10]:
            print(f"  {domain}: {count}")
        
        if search_term:
            print(f"\n{Fore.YELLOW}Searching for '{search_term}':{Style.RESET_ALL}")
            matches = []
            
            for log in self.network_logs:
                log_str = json.dumps(log, ensure_ascii=False).lower()
                if search_term.lower() in log_str:
                    matches.append(log)
            
            print(f"Found {len(matches)} matches")
            for i, match in enumerate(matches[:10]):
                print(f"\n{Fore.MAGENTA}Match {i+1}:{Style.RESET_ALL}")
                print(f"  Type: {match.get('type')}")
                print(f"  URL: {match.get('url', 'N/A')[:100]}...")
                if match.get("type") == "response":
                    print(f"  Status: {match.get('status')}")
                
                for key, value in match.items():
                    value_str = str(value).lower()
                    if search_term.lower() in value_str:
                        print(f"  {Fore.GREEN}{key}: {str(value)[:200]}...{Style.RESET_ALL}")


async def main():
    analyzer = CDPAnalyzer()
    browser = None
    
    # Windows에서 Ctrl+C 처리를 위한 설정
    def signal_handler(sig, frame):
        print(f"\n{Fore.RED}Stopping...{Style.RESET_ALL}")
        analyzer.stop()
    
    signal.signal(signal.SIGINT, signal_handler)
    
    try:
        async with async_playwright() as p:
            print(f"{Fore.CYAN}Launching browser...{Style.RESET_ALL}")
            browser = await p.chromium.launch(
                headless=False,
                args=['--disable-blink-features=AutomationControlled']
            )
            context = await browser.new_context(
                viewport={'width': 1280, 'height': 720}
            )
            page = await context.new_page()
            
            analyzer.setup_page_listeners(page)
            
            print(f"{Fore.CYAN}Browser is ready. Navigate to any website.{Style.RESET_ALL}")
            print(f"{Fore.YELLOW}Press Ctrl+C when done to save logs and analyze.{Style.RESET_ALL}")
            
            # Ctrl+C가 눌릴 때까지 대기
            while analyzer.running:
                await asyncio.sleep(0.1)
            
            # 로그 저장
            log_file = analyzer.save_logs()
            
            if log_file:
                try:
                    while True:
                        search_term = input(f"\n{Fore.CYAN}Enter search term (or 'exit' to quit): {Style.RESET_ALL}")
                        if search_term.lower() == "exit":
                            break
                        analyzer.analyze_logs(search_term)
                except (KeyboardInterrupt, EOFError):
                    print(f"\n{Fore.YELLOW}Exiting...{Style.RESET_ALL}")
            
            await browser.close()
            
    except Exception as e:
        print(f"{Fore.RED}Error: {e}{Style.RESET_ALL}")
        print(f"{Fore.YELLOW}Make sure Playwright is properly installed:{Style.RESET_ALL}")
        print("  python -m playwright install chromium")
        if browser:
            await browser.close()


if __name__ == "__main__":
    # Windows에서 ProactorEventLoop 사용 (기본값)
    if sys.platform == "win32":
        asyncio.set_event_loop_policy(asyncio.WindowsProactorEventLoopPolicy())
    
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print(f"\n{Fore.YELLOW}Program terminated by user{Style.RESET_ALL}")