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
# Configuration Paths
# Explicitly set to user request path to avoid ambiguity
CONFIG_DIR = "/home/image/.config/clash"
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
    mixed_port: Optional[int] = 7890
    external_controller: Optional[str] = "127.0.0.1:9092"
    secret: Optional[str] = ""
    system_proxy: Optional[bool] = False
    tun_mode: Optional[bool] = False
    backend_port: Optional[int] = 3001

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
        set_linux_proxy(prefs["system_proxy"], index.preferences.mixed_port)
    
    # Apply to config.yaml if a profile is selected
    if index.selected:
        try:
            profile = next(p for p in index.profiles if p.id == index.selected)
            file_path = os.path.join(PROFILES_DIR, profile.file)
            if os.path.exists(file_path):
                with open(file_path, "r", encoding="utf-8") as f:
                    config = yaml.safe_load(f)
                
                # Merge logic
                config["port"] = index.preferences.mixed_port
                config["external-controller"] = index.preferences.external_controller
                config["secret"] = index.preferences.secret
                if "tun" not in config: config["tun"] = {}
                config["tun"]["enable"] = index.preferences.tun_mode
                
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
        "verge_version": "v2.4.4",
        "last_check": time.strftime("%Y/%m/%d %H:%M:%S", time.localtime()),
        "mode": "Service Mode",
        "auto_start": False
    }

# Helpers
def set_linux_proxy(enable: bool, port: int = 7890):
    """Set system proxy for GNOME/Linux"""
    try:
        mode = "manual" if enable else "none"
        # Use gsettings as a best effort for Linux
        os.system(f"gsettings set org.gnome.system.proxy mode '{mode}'")
        if enable:
            os.system(f"gsettings set org.gnome.system.proxy.http host '127.0.0.1'")
            os.system(f"gsettings set org.gnome.system.proxy.http port {port}")
            os.system(f"gsettings set org.gnome.system.proxy.https host '127.0.0.1'")
            os.system(f"gsettings set org.gnome.system.proxy.https port {port}")
            os.system(f"gsettings set org.gnome.system.proxy.socks host '127.0.0.1'")
            os.system(f"gsettings set org.gnome.system.proxy.socks port {port}")
        print(f"System proxy {'enabled' if enable else 'disabled'}")
    except Exception as e:
        print(f"Error setting system proxy: {e}")

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
    if not index.selected:
        index.selected = profile_id
        
    save_index(index)
    return {"success": True, "profile": new_profile}

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
        profile_config["port"] = index.preferences.mixed_port
        profile_config["external-controller"] = index.preferences.external_controller
        profile_config["secret"] = index.preferences.secret
        
        # Enhanced TUN Configuration
        if index.preferences.tun_mode:
            profile_config["tun"] = {
                "enable": True,
                "stack": "gVisor", # Recommended for compatibility
                "dns-hijack": ["any:53"],
                "auto-route": True,
                "auto-detect-interface": True
            }
            # TUN mode usually requires DNS server to be enabled
            if "dns" not in profile_config:
                profile_config["dns"] = {}
            profile_config["dns"]["enable"] = True
            profile_config["dns"]["enhanced-mode"] = "fake-ip"
            profile_config["dns"]["nameserver"] = ["114.114.114.114", "8.8.8.8"]
        else:
            if "tun" in profile_config:
                profile_config["tun"]["enable"] = False
        
        # Also apply system proxy if enabled
        set_linux_proxy(index.preferences.system_proxy, index.preferences.mixed_port)

    with open(CONFIG_PATH, "w", encoding="utf-8") as f:
        yaml.safe_dump(profile_config, f)
    
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
    # Get configured controller address
    index = load_index()
    controller = "127.0.0.1:9092"
    secret = ""
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
            return Response(content=f"Clash Proxy Error: {str(e)}", status_code=502)

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
    uvicorn.run(app, host="0.0.0.0", port=3001)
