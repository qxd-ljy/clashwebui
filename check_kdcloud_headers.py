import httpx
import asyncio

async def check_subscription():
    url = "https://www.kdcloud.uk/api/v1/client/subscribe?token=56499c7c8601cfcf3d2b3cc3f84b54ce"
    
    headers = {
        "User-Agent": "clash-verge/1.3.8"
    }
    
    # Try with proxy first (since direct fails with DNS)
    proxies = {
        "http://": "http://127.0.0.1:7890",
        "https://": "http://127.0.0.1:7890"
    }
    
    async with httpx.AsyncClient(timeout=30.0, headers=headers, follow_redirects=True, proxies=proxies) as client:
        resp = await client.get(url)
        
        print("=" * 60)
        print("KDCloud Subscription Response Headers:")
        print("=" * 60)
        for k, v in resp.headers.items():
            print(f"{k}: {v}")
        
        print("\n" + "=" * 60)
        print("Checking specific headers:")
        print("=" * 60)
        
        # Check for subscription-userinfo
        if "subscription-userinfo" in resp.headers:
            print(f"✓ subscription-userinfo: {resp.headers['subscription-userinfo']}")
        else:
            print("✗ subscription-userinfo: NOT FOUND")
            # Try case-insensitive
            for k, v in resp.headers.items():
                if k.lower() == "subscription-userinfo":
                    print(f"  Found (case mismatch): {k}: {v}")
        
        # Check for profile-title
        if "profile-title" in resp.headers:
            print(f"✓ profile-title: {resp.headers['profile-title']}")
        else:
            print("✗ profile-title: NOT FOUND")
            for k, v in resp.headers.items():
                if k.lower() == "profile-title" or k.lower() == "x-profile-title":
                    print(f"  Found (case mismatch): {k}: {v}")
        
        # Check content-disposition
        if "content-disposition" in resp.headers:
            print(f"✓ content-disposition: {resp.headers['content-disposition']}")
        else:
            print("✗ content-disposition: NOT FOUND")
        
        # Content preview
        print("\n" + "=" * 60)
        print("Content Preview (first 500 chars):")
        print("=" * 60)
        print(resp.text[:500])

if __name__ == "__main__":
    asyncio.run(check_subscription())
