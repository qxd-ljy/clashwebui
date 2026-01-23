import os
import json
import yaml
import uvicorn
import httpx
import time
import shutil
from uuid import uuid4
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import asyncio
from typing import Optional, List, Dict, Any
import psutil
from fastapi import WebSocket, WebSocketDisconnect
from starlette.requests import Request
from starlette.responses import Response

app = FastAPI()
start_time = time.time()

# Configuration Paths
# Determine Project Root (apps/server/main.py -> ../../)
PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../"))
PROJECT_CONFIG_PATH = os.path.join(PROJECT_ROOT, "config.yaml")

# Default settings
DEFAULT_CONFIG = {
    "clash": {
        "config_dir": "~/.config/clash",
        "controller_host": "127.0.0.1",
        "controller_port": 9092, # Legacy support
    },
    "ports": {
        "webui": 3000,
        "clash_controller": 9092
    }
}

APP_CONFIG = DEFAULT_CONFIG

# Load Config if exists
if os.path.exists(PROJECT_CONFIG_PATH):
    try:
        with open(PROJECT_CONFIG_PATH, 'r') as f:
            user_config = yaml.safe_load(f)
            # Deep merge simple (just 1 level for now)
            for k, v in user_config.items():
                if isinstance(v, dict) and k in APP_CONFIG:
                   APP_CONFIG[k].update(v)
                else:
                   APP_CONFIG[k] = v
            print(f"Loaded config from {PROJECT_CONFIG_PATH}")
    except Exception as e:
        print(f"Failed to load config.yaml: {e}")

# Apply Config
clash_config_dir = APP_CONFIG["clash"].get("config_dir", "~/.config/clash")
CONFIG_DIR = os.getenv("CLASH_CONFIG_DIR", os.path.expanduser(clash_config_dir))
CONFIG_PATH = os.path.join(CONFIG_DIR, "config.yaml")
PROFILES_DIR = os.path.join(CONFIG_DIR, "profiles")
PROFILES_INDEX = os.path.join(CONFIG_DIR, "profiles.json")

# Ensure Directories
if not os.path.exists(PROFILES_DIR):
    os.makedirs(PROFILES_DIR, exist_ok=True)

# Application state
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global Exception Handler
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    import traceback
    error_msg = f"{str(exc)}\n{traceback.format_exc()}"
    print(f"Global Error: {error_msg}")
    return Response(
        content=json.dumps({"detail": str(exc), "trace": traceback.format_exc()}),
        status_code=500,
        media_type="application/json"
    )

class ProfileImport(BaseModel):
    type: str # 'remote' | 'local'
    url: Optional[str] = None
    content: Optional[str] = None
    name: Optional[str] = None

class Profile(BaseModel):
    id: str
    name: str
    type: str
    url: str = ""
    file: str
    updated: float = 0
    usage: Optional[Dict[str, int]] = None
    desc: Optional[str] = ""
    ua: Optional[str] = ""
    interval: Optional[int] = 0
    auto_update: Optional[bool] = False
    use_system_proxy: Optional[bool] = False
    allow_unsafe: Optional[bool] = False

class ProfileUpdate(BaseModel):
    name: Optional[str] = None
    desc: Optional[str] = None
    url: Optional[str] = None
    ua: Optional[str] = None
    interval: Optional[int] = None
    auto_update: Optional[bool] = None
    use_system_proxy: Optional[bool] = None
    allow_unsafe: Optional[bool] = None

class Preferences(BaseModel):
    mixed_port: Optional[int] = int(os.getenv("CLASH_MIXED_PORT", 7890))
    external_controller: Optional[str] = os.getenv("CLASH_EXTERNAL_CONTROLLER", "127.0.0.1:9092")
    secret: Optional[str] = os.getenv("CLASH_SECRET", "")
    system_proxy: Optional[bool] = False
    tun_mode: Optional[bool] = False
    backend_port: Optional[int] = int(os.getenv("WEBUI_PORT", 3000))
    
    # 自定义路径
    clash_binary_path: Optional[str] = "~/.bin/clash"
    clash_config_dir: Optional[str] = "~/.config/clash"
    python_interpreter_path: Optional[str] = None  # None = auto-detect
    webui_working_directory: Optional[str] = None  # None = current directory

class ProfilesIndex(BaseModel):
    profiles: List[Profile]
    selected: Optional[str] = None
    preferences: Optional[Preferences] = None

# ... (Helpers) ...

@app.post("/preferences")
async def update_preferences(prefs: Dict[str, Any]):
    index = load_index()
    if index.preferences is None:
        index.preferences = Preferences()
    
    # Update preferences
    cur_prefs = index.preferences.dict()
    for k, v in prefs.items():
        if k in cur_prefs:
            cur_prefs[k] = v
    
    index.preferences = Preferences(**cur_prefs)
    save_index(index)
    
    # Apply system proxy if changed
    if "system_proxy" in prefs:
        set_system_proxy(prefs["system_proxy"], index.preferences.mixed_port)
    
    # Apply to config.yaml if a profile is selected
    if index.selected:
        try:
            profile = next(p for p in index.profiles if p.id == index.selected)
            file_path = os.path.join(PROFILES_DIR, profile.file)
            if os.path.exists(file_path):
                with open(file_path, "r", encoding="utf-8") as f:
                    config = yaml.safe_load(f)
                
                # Merge logic
                config = inject_config_overrides(config, index.preferences)
                
                with open(CONFIG_PATH, "w", encoding="utf-8") as f:
                    yaml.safe_dump(config, f)
                
                await reload_clash_config()
        except: pass
        
    return {"success": True, "preferences": index.preferences}

@app.get("/proxy_geoip")
async def get_proxy_geoip():
    """Fetch GeoIP info through the local Clash proxy (port 7890)"""
    # Use the mixed_port from preferences or default to 7890
    index = load_index()
    proxy_port = index.preferences.mixed_port if index.preferences else 7890
    
    proxy_url = f"http://127.0.0.1:{proxy_port}"
    target_url = "https://api.ip.sb/geoip"
    
    try:
        async with httpx.AsyncClient(proxies={"all": proxy_url}, timeout=10.0) as client:
            resp = await client.get(target_url)
            return resp.json()
    except Exception as e:
        # Fallback to direct if proxy fails (though we want proxy info)
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.get(target_url)
                return resp.json()
        except Exception as e2:
            raise HTTPException(status_code=500, detail=f"Failed to fetch GeoIP: {str(e2)}")

@app.get("/system_info")
async def get_system_info():
    import platform

    return {
        "os": f"{platform.system()} {platform.release()}",
        "uptime": int(time.time() - start_time),
        "verge_version": "v3.0.0 (WebUI)",
        "last_check": time.strftime("%Y/%m/%d %H:%M:%S", time.localtime()),
        "mode": "Service Mode"
    }



class AutoStartRequest(BaseModel):
    enable: bool

@app.post("/auto_start")
async def set_auto_start(req: AutoStartRequest):
    """
    启用/禁用 systemd user service 实现开机自启
    包括 ClashWebUI (前后端) 和 Clash Core
    """
    user_systemd_dir = os.path.expanduser("~/.config/systemd/user")
    web_service_path = os.path.join(user_systemd_dir, "clashwebui.service")
    core_service_path = os.path.join(user_systemd_dir, "clash.service")
    
    # 获取配置
    index = load_index()
    prefs = index.preferences
    
    # Clash 路径
    clash_bin = os.path.expanduser(prefs.clash_binary_path or "~/.bin/clash")
    clash_config_dir = os.path.expanduser(prefs.clash_config_dir or "~/.config/clash")
    
    # Python 和 WebUI 路径
    import sys
    python_exec = prefs.python_interpreter_path if prefs and prefs.python_interpreter_path else sys.executable
    webui_workdir = prefs.webui_working_directory if prefs and prefs.webui_working_directory else os.getcwd()
    
    if req.enable:
        try:
            if not os.path.exists(user_systemd_dir):
                os.makedirs(user_systemd_dir, exist_ok=True)
            
            # 1. Clash Core Service
            core_content = f"""[Unit]
Description=Clash Core Service
After=network.target

[Service]
Type=simple
ExecStart={clash_bin} -d {clash_config_dir}
Restart=always
RestartSec=5

[Install]
WantedBy=default.target
"""
            with open(core_service_path, "w") as f:
                f.write(core_content)
            
            # 2. WebUI Service
            backend_port = prefs.backend_port if prefs else 3000
            web_content = f"""[Unit]
Description=ClashWebUI Backend Service
After=network.target clash.service

[Service]
Type=simple
WorkingDirectory={webui_workdir}
ExecStart={python_exec} -m uvicorn main:app --host 0.0.0.0 --port {backend_port}
Restart=always
RestartSec=5
Environment=PATH={os.path.dirname(python_exec)}:/usr/bin:/bin
Environment=WEBUI_PORT={backend_port}

[Install]
WantedBy=default.target
"""
            with open(web_service_path, "w") as f:
                f.write(web_content)
            
            # 3. Enable & Start
            os.system("systemctl --user daemon-reload")
            os.system("systemctl --user enable clash.service")
            os.system("systemctl --user enable clashwebui.service")
            # 不自动启动,避免中断当前会话
            
            # 4. Enable lingering
            user = os.environ.get("USER")
            if user:
                os.system(f"loginctl enable-linger {user}")
            
            return {"success": True, "enabled": True}
            
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to enable auto-start: {str(e)}")
    else:
        # Disable
        try:
            os.system("systemctl --user stop clashwebui.service")
            os.system("systemctl --user stop clash.service")
            os.system("systemctl --user disable clashwebui.service")
            os.system("systemctl --user disable clash.service")
            
            if os.path.exists(web_service_path):
                os.remove(web_service_path)
            if os.path.exists(core_service_path):
                os.remove(core_service_path)
            
            os.system("systemctl --user daemon-reload")
            
            return {"success": True, "enabled": False}
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to disable auto-start: {str(e)}")

@app.get("/auto_start/status")
async def get_auto_start_status():
    """获取自启状态"""
    import subprocess
    try:
        result = subprocess.run(
            ["systemctl", "--user", "is-enabled", "clashwebui.service"],
            capture_output=True,
            text=True
        )
        enabled = (result.returncode == 0)
        return {"enabled": enabled}
    except:
        return {"enabled": False}
# Helpers
def inject_config_overrides(config: dict, prefs: Preferences):
    """
    Centralized logic to inject global preferences into Clash config.
    Handles TUN mode (gVisor, DNS-Hijack, Fake-IP) and other globals.
    """
    config["mixed-port"] = prefs.mixed_port
    config.pop("port", None)
    config.pop("socks-port", None)
    config["external-controller"] = prefs.external_controller
    config["secret"] = prefs.secret
    
    # Enhanced TUN Configuration
    if prefs.tun_mode:
        config["tun"] = {
            "enable": True,
            "stack": "gVisor", # Recommended for compatibility
            "dns-hijack": ["any:53"],
            "auto-route": True,
            "auto-detect-interface": True
        }
        # TUN mode usually requires DNS server to be enabled
        if "dns" not in config:
            config["dns"] = {}
        config["dns"]["enable"] = True
        config["dns"]["enhanced-mode"] = "fake-ip"
        if not config["dns"].get("nameserver"):
             config["dns"]["nameserver"] = ["114.114.114.114", "8.8.8.8"]
    else:
        if "tun" in config:
            config["tun"]["enable"] = False
            
    return config

def set_system_proxy(enable: bool, port: int = 7890):
    """
    控制 Clash 进程来实现系统代理的启用/禁用
    启用 = 启动 Clash
    禁用 = 停止 Clash
    """
    print(f"[Info] System Proxy: {enable} - Controlling Clash process")
    
    try:
        import subprocess
        
        # 从 preferences 获取自定义路径
        index = load_index()
        if index.preferences:
            clash_bin = os.path.expanduser(index.preferences.clash_binary_path or "~/.bin/clash")
            clash_config_dir = os.path.expanduser(index.preferences.clash_config_dir or "~/.config/clash")
        else:
            clash_bin = os.path.expanduser("~/.bin/clash")
            clash_config_dir = os.path.expanduser("~/.config/clash")
            
        clash_log = os.path.expanduser("~/clash.log")
        
        if enable:
            # 启用系统代理 = 启动 Clash
            # 1. 先停止已存在的实例
            subprocess.run(["pkill", "clash"], capture_output=True)
            time.sleep(0.5)  # 等待进程完全停止
            
            # 2. 启动新实例
            cmd = f"nohup {clash_bin} -d {clash_config_dir} > {clash_log} 2>&1 &"
            subprocess.Popen(cmd, shell=True, 
                           stdout=subprocess.DEVNULL, 
                           stderr=subprocess.DEVNULL,
                           start_new_session=True)
            print(f"[Info] Clash started: {clash_bin} -d {clash_config_dir}")
        else:
            # 禁用系统代理 = 停止 Clash
            result = subprocess.run(["pkill", "clash"], capture_output=True)
            if result.returncode == 0:
                print("[Info] Clash stopped")
            else:
                print("[Info] Clash was not running")
                
    except Exception as e:
        print(f"Failed to control Clash process: {e}")


def load_index() -> ProfilesIndex:
    if not os.path.exists(PROFILES_INDEX):
        return ProfilesIndex(profiles=[], selected=None, preferences=Preferences())
    try:
        with open(PROFILES_INDEX, "r", encoding="utf-8") as f:
            data = json.load(f)
        if "preferences" not in data:
            data["preferences"] = Preferences().dict()
        return ProfilesIndex(**data)
    except Exception as e:
        print(f"Error loading index: {e}")
        return ProfilesIndex(profiles=[], selected=None, preferences=Preferences())

def save_index(index: ProfilesIndex):
    with open(PROFILES_INDEX, "w", encoding="utf-8") as f:
        # Dump using pydantic's dict method
        f.write(json.dumps(index.dict(), indent=2, ensure_ascii=False))

async def download_profile_content(url: str) -> Dict[str, Any]:
    """
    Robust download:
    1. Try direct download (bypass system proxy).
    2. Try proxy via 127.0.0.1:7890 if direct fails.
    Returns: {"content": str, "usage": dict}
    """
    
    headers = {
        "User-Agent": "clash-verge/1.3.8"
    }
    
    usage = {"used": 0, "total": 0}

    async def _extract_usage(resp):
        usage_str = resp.headers.get("subscription-userinfo", "")
        # Try case-insensitive lookup
        if not usage_str:
            for k, v in resp.headers.items():
                if k.lower() == "subscription-userinfo":
                    usage_str = v
                    break
        
        if not usage_str:
            return None
        
        print(f"[DEBUG] Usage Header: {usage_str}")
        
        data = {}
        # Case-insensitive parsing
        parts = usage_str.split(';')
        for part in parts:
            if '=' not in part: continue
            k, v = part.split('=', 1)
            k = k.strip().lower()
            v = v.strip()
            
            if k in ['upload', 'download', 'total', 'expire']:
                try:
                    data[k] = int(v) if v else 0
                except ValueError:
                    data[k] = 0
        
        print(f"[DEBUG] Parsed Usage: {data}")
        
        if "total" in data:
            return {
                "used": data.get("upload", 0) + data.get("download", 0),
                "total": data.get("total", 0),
                "expire": data.get("expire", 0)
            }
        
        # If "total" is not in data, return a default or None
        return None

    def _extract_name(resp, url):
        # Log headers for debugging extraction issues
        print(f"[DEBUG] Full Headers: {dict(resp.headers)}")

        # 1. Try profile-title header (Case-insensitive)
        name = None
        for k, v in resp.headers.items():
            if k.lower() == "profile-title" or k.lower() == "x-profile-title":
                name = v
                break
        
        if name:
            try:
                import urllib.parse
                # Handle potential percent-encoding in title
                return urllib.parse.unquote(name)
            except:
                return name

        # 2. Try Content-Disposition
        cd = ""
        for k, v in resp.headers.items():
            if k.lower() == "content-disposition":
                cd = v
                break
        
        if cd:
            import re
            import urllib.parse
            
            # A. Try filename* (RFC 5987)
            # Example: filename*=utf-8''%e4%bd%a0%e5%a5%bd.yaml
            star_match = re.search(r"filename\*\s*=\s*([^;]+)", cd, re.IGNORECASE)
            if star_match:
                val = star_match.group(1).strip().strip("'\"")
                if "''" in val:
                    parts = val.split("''", 1)
                    encoding = parts[0].lower() or "utf-8"
                    encoded_text = parts[1]
                    try:
                        return urllib.parse.unquote(encoded_text, encoding=encoding)
                    except:
                        pass
                else:
                    try:
                        return urllib.parse.unquote(val)
                    except:
                        return val

            # B. Try regular filename
            # Example: filename="NiceSub.yaml"
            match = re.search(r"filename\s*=\s*([^;]+)", cd, re.IGNORECASE)
            if match:
                res = match.group(1).strip().strip("'\"")
                try:
                    # Some providers erroneously percent-encode regular filename too
                    return urllib.parse.unquote(res)
                except:
                    return res

        # 3. Last fallback: URL baseline (Smarter)
        try:
            from urllib.parse import urlparse, unquote
            parsed = urlparse(url)
            path = parsed.path
            base = os.path.basename(path)
            if base and len(base) > 3:
                 return unquote(base)
            
            # If path is too short (like /s), use domain as hint
            return parsed.netloc or "Remote Profile"
        except:
            return "Remote Profile"

    def _extract_interval(resp):
        # X-Profile-Update-Interval (hours)
        interval = resp.headers.get("profile-update-interval")
        if not interval:
            for k, v in resp.headers.items():
                if k.lower() == "profile-update-interval":
                    interval = v
                    break
        if interval:
            try:
                # Convert hours to minutes
                return int(interval) * 60
            except:
                pass
        return None

    # 1. Direct Attempt
    print(f"Attempting direct download: {url}")
    try:
        async with httpx.AsyncClient(trust_env=False, timeout=30.0, headers=headers, follow_redirects=True) as client:
            resp = await client.get(url)
            resp.raise_for_status()
            return {
                "content": resp.text, 
                "usage": await _extract_usage(resp),
                "name": _extract_name(resp, url),
                "interval": _extract_interval(resp)
            }
    except Exception as e:
        print(f"Direct download failed: {repr(e)}. Retrying with proxy...")
    
    # 2. Proxy Attempt
    print(f"Attempting proxy download: {url}")
    try:
        async with httpx.AsyncClient(proxy="http://127.0.0.1:7890", timeout=30.0, headers=headers, follow_redirects=True) as client:
            resp = await client.get(url)
            resp.raise_for_status()
            return {
                "content": resp.text, 
                "usage": await _extract_usage(resp),
                "name": _extract_name(resp, url),
                "interval": _extract_interval(resp)
            }
    except Exception as e:
        print(f"Proxy download failed: {repr(e)}")
        raise HTTPException(status_code=502, detail=f"Download failed: {str(e)}")
async def perform_profile_update(profile_id: str) -> bool:
    """Common logic to update a remote profile"""
    try:
        index = load_index()
        try:
            profile = next(p for p in index.profiles if p.id == profile_id)
            idx = index.profiles.index(profile)
        except StopIteration:
            print(f"Profile {profile_id} not found during update")
            return False

        if profile.type == 'remote' and profile.url:
            print(f"Updating profile: {profile.name}")
            result = await download_profile_content(profile.url)
            yaml_content = result["content"]
            usage_data = result["usage"]
            
            # Update name if it was generic "Profile *" or empty
            if profile.name.startswith("Profile ") and result.get("name"):
                 profile.name = result.get("name")
            if result.get("interval"):
                 profile.interval = result.get("interval")
            
            file_path = os.path.join(PROFILES_DIR, profile.file)
            
            with open(file_path, "w", encoding="utf-8") as f:
                f.write(yaml_content)

            profile.updated = time.time() * 1000
            profile.usage = usage_data
            
            # Refresh index to avoid race conditions
            current_index = load_index()
            for i, p in enumerate(current_index.profiles):
                if p.id == profile_id:
                    current_index.profiles[i] = profile
                    break
            
            save_index(current_index)
            print(f"Profile {profile.name} updated successfully")
            return True
    except Exception as e:
        print(f"Failed to update profile {profile_id}: {e}")
    return False

async def schedule_profile_updates():
    """Background task to check for auto-updates"""
    print("Starting profile auto-update scheduler...")
    while True:
        try:
            index = load_index()
            now = time.time() * 1000 # ms
            
            for profile in index.profiles:
                if profile.type == 'remote' and profile.auto_update and profile.interval > 0:
                    # interval is in minutes
                    interval_ms = profile.interval * 60 * 1000
                    if now - profile.updated > interval_ms:
                        print(f"Auto-updating profile: {profile.name}")
                        await perform_profile_update(profile.id)
                        
        except Exception as e:
            print(f"Error in update scheduler: {e}")
            
        await asyncio.sleep(60) # Check every minute

# Routes
@app.get("/profiles")
def get_profiles():
    return load_index()

@app.post("/profiles")
async def import_profile(data: ProfileImport):
    try:
        yaml_content = data.content
        usage_data = {"used": 0, "total": 0}
        profile_name = data.name # Keep it None if not provided
        profile_url = data.url or ""
        profile_id = str(uuid4())
        interval = 1440 # Default 24h
        
        if data.type == "remote" and data.url:
            result = await download_profile_content(data.url)
            yaml_content = result["content"]
            usage_data = result["usage"]
            if not profile_name:
                profile_name = result.get("name")
            if result.get("interval"):
                interval = result.get("interval")
        
        if not profile_name:
            profile_name = "New Profile"
        
        # Validate YAML
        try:
            yaml.safe_load(yaml_content)
        except yaml.YAMLError:
            raise HTTPException(status_code=400, detail="Invalid YAML content")

        file_name = f"{profile_id}.yaml"
        file_path = os.path.join(PROFILES_DIR, file_name)
        
        with open(file_path, "w", encoding="utf-8") as f:
            f.write(yaml_content)
            
        index = load_index()
        new_profile = Profile(
            id=profile_id,
            name=profile_name,
            type=data.type,
            url=profile_url,
            file=file_name,
            updated=time.time() * 1000,
            usage=usage_data,
            interval=interval,
            auto_update=True if data.type == "remote" else False
        )
        
        index.profiles.append(new_profile)
        
        # 如果是第一个配置文件，自动应用它
        first_profile = len(index.profiles) == 1
        if first_profile:
            index.selected = profile_id
            
            # Apply Logic (Duplicate of select_profile logic, consider refactoring if complex)
            # 1. Merge Prefs
            try:
                 # Load YAML
                import yaml
                profile_config = yaml.safe_load(yaml_content)
                
                # Inject
                if index.preferences:
                    profile_config = inject_config_overrides(profile_config, index.preferences)
                
                # Write global config
                with open(CONFIG_PATH, "w", encoding="utf-8") as f:
                    yaml.safe_dump(profile_config, f)
                    
                # Reload Core (Async inside sync function? No, import_profile is async)
                await reload_clash_config()
                
                # Set System Proxy if needed
                if index.preferences:
                     set_system_proxy(index.preferences.system_proxy, index.preferences.mixed_port)
                     
            except Exception as e:
                print(f"Failed to auto-apply imported profile: {e}")

        save_index(index)
        return {"success": True, "profile": new_profile}

    except HTTPException:
        raise
    except Exception as e:
        import traceback
        print(f"Import Profile Failed: {e}\n{traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=f"Import failed: {str(e)}")

@app.put("/profiles/{profile_id}")
async def update_profile(profile_id: str):
    success = await perform_profile_update(profile_id)
    if success:
        index = load_index()
        profile = next(p for p in index.profiles if p.id == profile_id)
        return {"success": True, "profile": profile}
    else:
        raise HTTPException(status_code=500, detail="Failed to update profile")

@app.patch("/profiles/{profile_id}")
async def patch_profile(profile_id: str, diff: ProfileUpdate):
    index = load_index()
    target = None
    for p in index.profiles:
        if p.id == profile_id:
            target = p
            break
            
    if not target:
        raise HTTPException(status_code=404, detail="Profile not found")

    # Update fields
    update_data = diff.dict(exclude_unset=True)
    # Update object in place or replace
    # We construct a new Profile object with updated fields
    target_dict = target.dict()
    target_dict.update(update_data)
    updated_profile = Profile(**target_dict)
    
    # Replace in list
    index.profiles = [updated_profile if p.id == profile_id else p for p in index.profiles]
    save_index(index)
    
    return {"success": True, "profile": updated_profile}

@app.delete("/profiles/{profile_id}")
def delete_profile(profile_id: str):
    index = load_index()
    profiles_list = index.profiles
    
    target = None
    for p in profiles_list:
        if p.id == profile_id:
            target = p
            break
            
    if not target:
        raise HTTPException(status_code=404, detail="Profile not found")
        
    # Delete file
    file_path = os.path.join(PROFILES_DIR, target.file)
    if os.path.exists(file_path):
        os.remove(file_path)
        
    # Remove from list
    index.profiles = [p for p in profiles_list if p.id != profile_id]
    
    if index.selected == profile_id:
        index.selected = index.profiles[0].id if index.profiles else None
        
    save_index(index)
    return {"success": True, "index": index}

async def reload_clash_config():
    """Force Clash Core to reload the config file"""
    try:
        index = load_index()
        secret = index.preferences.secret if index.preferences else ""
        
        url = "http://127.0.0.1:9092/configs"
        payload = {"path": CONFIG_PATH}
        headers = {"Authorization": f"Bearer {secret}"} if secret else {}
        
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.put(url, json=payload, headers=headers)
            if resp.status_code == 204:
                print("Clash Core reloaded config successfully")
            else:
                print(f"Clash Core reload failed: {resp.status_code} {resp.text}")
    except Exception as e:
        print(f"Failed to reload Clash Core: {e}")

@app.put("/profiles/select/{profile_id}")
async def select_profile(profile_id: str):
    index = load_index()
    try:
        profile = next(p for p in index.profiles if p.id == profile_id)
    except StopIteration:
        raise HTTPException(status_code=404, detail="Profile not found")
        
    file_path = os.path.join(PROFILES_DIR, profile.file)
    if not os.path.exists(file_path):
        raise HTTPException(status_code=500, detail="Profile file missing")

    # Merge logic
    with open(file_path, "r", encoding="utf-8") as f:
        profile_config = yaml.safe_load(f)
    
    # Apply Global Preferences
    if index.preferences:
        profile_config = inject_config_overrides(profile_config, index.preferences)
    with open(CONFIG_PATH, "w", encoding="utf-8") as f:
        yaml.safe_dump(profile_config, f)
    
    # Reload Core or Restart if needed
    # Apply Global Preferences (Restart Core if System Proxy is enabled/toggle logic)
    if index.preferences:
         set_system_proxy(index.preferences.system_proxy, index.preferences.mixed_port)
    
    # Update selected profile in index
    index.selected = profile_id
    save_index(index)
    
    # Reload Core
    await reload_clash_config()
    
    
    return {"success": True}

class TestRequest(BaseModel):
    url: str
    match: str = "" # Keyword to match. If empty, just check 200 OK.
    type: str = "status" # status, text, json

@app.post("/test/unlock")
async def test_unlock(req: TestRequest):
    index = load_index()
    proxy_port = index.preferences.mixed_port if index.preferences else 7890
    proxy_url = f"http://127.0.0.1:{proxy_port}"
    
    start_time = time.time()
    try:
        async with httpx.AsyncClient(proxy=proxy_url, verify=False, timeout=10.0, follow_redirects=True) as client:
            headers = {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
            }
            resp = await client.get(req.url, headers=headers)
            latency = int((time.time() - start_time) * 1000)
            
            is_success = False
            info = ""
            
            if req.type == "status":
                if req.match and req.match.lower() == "not available":
                     # Negative match status (e.g. Netflix) - complex, simplfy for now
                     # Usually 200 OK means accessible
                     is_success = resp.status_code < 400
                elif req.match:
                    # Match specific status code if match is digit
                    if req.match.isdigit():
                         is_success = resp.status_code == int(req.match)
                    else:
                         is_success = resp.status_code < 400
                else:
                    is_success = resp.status_code < 400
                    
            elif req.type == "text" or req.type == "json":
                content = resp.text
                if req.match:
                     if req.match.startswith("!"):
                         # Negative match
                         keyword = req.match[1:]
                         is_success = keyword not in content
                     else:
                        is_success = req.match in content
                else:
                    is_success = resp.status_code < 400
            
            return {
                "status": "success" if is_success else "failed",
                "latency": f"{latency}ms",
                "info": "Unlocked" if is_success else "Failed"
            }
            
    except Exception as e:
        return {
            "status": "failed",
            "latency": "Error",
            "info": str(e)
        }
class ProfileContentUpdate(BaseModel):
    content: str

@app.get("/profiles/{profile_id}/content")
async def get_profile_content(profile_id: str):
    index = load_index()
    profile = next((p for p in index.profiles if p.id == profile_id), None)
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")

    file_path = os.path.join(PROFILES_DIR, profile.file)
    if not os.path.exists(file_path):
         return {"content": ""}

    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
        return {"content": content}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to read file: {str(e)}")

@app.put("/profiles/{profile_id}/content")
async def update_profile_content(profile_id: str, update: ProfileContentUpdate):
    index = load_index()
    profile = next((p for p in index.profiles if p.id == profile_id), None)
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")

    file_path = os.path.join(PROFILES_DIR, profile.file)
    
    try:
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(update.content)
        
        # Update timestamp
        profile.updated = time.time() * 1000
        for i, p in enumerate(index.profiles):
            if p.id == profile_id:
                index.profiles[i] = profile
                break
        save_index(index)
        
        return {"status": "success"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to write file: {str(e)}")

@app.on_event("startup")
async def startup_event():
    # Start auto-update scheduler
    asyncio.create_task(schedule_profile_updates())
    
    index = load_index()
    if not index.profiles and os.path.exists(CONFIG_PATH):
        print("Empty profile list. Discovering existing config.yaml as 'Default' profile.")
        try:
            profile_id = str(uuid4())
            file_name = f"{profile_id}.yaml"
            file_path = os.path.join(PROFILES_DIR, file_name)
            
            # Copy existing config to profiles
            shutil.copy2(CONFIG_PATH, file_path)
            
            new_profile = Profile(
                id=profile_id,
                name="Default Config",
                type="local",
                url="",
                file=file_name,
                updated=os.path.getmtime(CONFIG_PATH) * 1000,
                usage={"used": 0, "total": 0}
            )
            index.profiles.append(new_profile)
            index.selected = profile_id
            save_index(index)
        except Exception as e:
            print(f"Failed to discover existing config: {e}")

@app.websocket("/memory")
async def websocket_memory(websocket: WebSocket):
    await websocket.accept()
    try:
        while True:
            mem = psutil.virtual_memory()
            # Send data in the format expected by the frontend: { inUse: number, total: number }
            await websocket.send_json({
                "inUse": mem.used,
                "total": mem.total
            })
            await asyncio.sleep(2)
    except WebSocketDisconnect:
        pass
    except Exception as e:
        print(f"Memory WS error: {e}")


# --- IP Info Proxy ---
@app.get("/proxy_geoip")
async def proxy_geoip():
    # 1. Try to use the local proxy (Clash) to fetch IP info
    # This serves two purposes:
    #   a) Gets the actual exit IP of the proxy
    #   b) Verifies the proxy connectivity
    
    # Defaults
    proxies = {}
    
    # Determine proxy address from config
    try:
        index = load_index()
        port = 7890 # Default mixed port
        if index.preferences and index.preferences.mixed_port:
             port = index.preferences.mixed_port
        else:
             # Fallback to reading config.yaml if preferences not set
             if os.path.exists(CONFIG_PATH):
                 with open(CONFIG_PATH, 'r') as f:
                     config = yaml.safe_load(f)
                     port = config.get('mixed-port', config.get('port', 7890))
        
        proxy_url = f"http://127.0.0.1:{port}"
        proxies = {
            "http://": proxy_url,
            "https://": proxy_url
        }
    except:
        pass # Fallback to direct if determining proxy fails

    # 2. Fetch from ipapi.co (or similar)
    # We use httpx with proxy
    async with httpx.AsyncClient(proxies=proxies, timeout=10.0) as client:
        try:
             # ipapi.co is good but rate limited. ip-api.com is http only but fast.
             # let's try ipapi.co first for rich data
            resp = await client.get("https://ipapi.co/json/")
            resp.raise_for_status()
            return resp.json()
        except Exception as e:
            print(f"IP Fetch with proxy failed: {e}")
            # Fallback: Try Direct
            try:
                async with httpx.AsyncClient(timeout=5.0) as direct_client:
                    resp = await direct_client.get("https://ipapi.co/json/")
                    return resp.json()
            except Exception as e2:
                # Last resort stub
                return {
                    "ip": "Error",
                    "city": "Unknown", 
                    "region": "Unknown",
                    "country": "Unknown",
                    "org": str(e)
                }

# --- Docker / Production Support ---
# 1. Rename the core application to backend_app
backend_app = app

# 2. Create a new Root App
app = FastAPI()

# 3. Mount the Backend
app.mount("/backend", backend_app)

# 4. Implement /api Proxy (Clash External Controller)
@app.api_route("/api/{path_name:path}", methods=["GET", "POST", "PUT", "DELETE", "PATCH", "HEAD", "OPTIONS"])
async def proxy_clash_api(path_name: str, request: Request):
    try:
        # Get configured controller address
        index = load_index()
        
        # Default from Config
        default_host = APP_CONFIG["clash"].get("controller_host", "127.0.0.1")
        default_port = APP_CONFIG["ports"].get("clash_controller", 9092)
        default_secret = APP_CONFIG["clash"].get("secret", "")
        
        controller = f"{default_host}:{default_port}"
        secret = default_secret
        
        if index.preferences:
            controller = index.preferences.external_controller or controller
            secret = index.preferences.secret or secret
        
        # Ensure protocol
        if not controller.startswith("http"):
            controller = f"http://{controller}"
            
        target_url = f"{controller}/{path_name}"
        
        # Forward headers (excluding host)
        headers = dict(request.headers)
        headers.pop("host", None)
        headers.pop("content-length", None)
        if secret:
            headers["Authorization"] = f"Bearer {secret}"

        async with httpx.AsyncClient() as client:
            try:
                content = await request.body()
                proxy_req = client.build_request(
                    request.method,
                    target_url,
                    headers=headers,
                    content=content,
                    params=request.query_params
                )
                proxy_res = await client.send(proxy_req)
                
                return Response(
                    content=proxy_res.content,
                    status_code=proxy_res.status_code,
                    headers=dict(proxy_res.headers)
                )
            except Exception as e:
                return Response(
                    content=json.dumps({"error": f"Clash Proxy Connection Failed: {str(e)}"}), 
                    status_code=502,
                    media_type="application/json"
                )
    except Exception as e:
        import traceback
        print(f"Proxy API Failed: {e}\n{traceback.format_exc()}")
        return Response(
            content=json.dumps({"error": f"Proxy Internal Error: {str(e)}"}),
            status_code=500, # Use 500 for internal errors
            media_type="application/json"
        )

# 5. Serve Static Files (SPA)
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

# Only mount if the directory exists (Production mode)
# In Docker, we will copy dist to /app/static_dist. 
# But let's support local too: ../../dist? 
# Let's standardize on a path relative to main.py or env var.
# Let's assume Dockerfile copies to `static/`.
STATIC_DIR = os.path.join(os.getcwd(), "static")

if os.path.exists(STATIC_DIR):
    print(f"Serving static files from {STATIC_DIR}")
    # Mount assets
    if os.path.exists(os.path.join(STATIC_DIR, "assets")):
        app.mount("/assets", StaticFiles(directory=os.path.join(STATIC_DIR, "assets")), name="assets")
    
    # Favicon
    @app.get("/logo.svg")
    async def serve_logo():
         return FileResponse(os.path.join(STATIC_DIR, "logo.svg"))

    # Catch-all for SPA
    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str):
        # API/Backend handled by mounts above.
        # Check if file exists (e.g. docs/logo.svg via direct path?)
        # For now, just serve index for everything else
        index_path = os.path.join(STATIC_DIR, "index.html")
        if os.path.exists(index_path):
            return FileResponse(index_path)
        return "Frontend build not found", 404
else:
    print(f"Warning: Static directory {STATIC_DIR} not found. Running in API-only mode.")

if __name__ == "__main__":
    webui_port = APP_CONFIG["ports"].get("webui", 3000)
    port = int(os.getenv("WEBUI_PORT", webui_port))
    uvicorn.run(app, host="0.0.0.0", port=port)
