#!/usr/bin/env python3
"""
Test script to verify automatic name extraction from YAML content
"""
import asyncio
import sys
import os

# Add parent directory to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'apps', 'server'))

async def test_name_extraction():
    # Import after path is set
    from main import download_profile_content
    
    # KDCloud subscription URL
    url = "https://www.kdcloud.uk/api/v1/client/subscribe?token=56499c7c8601cfcf3d2b3cc3f84b54ce"
    
    print("=" * 60)
    print("Testing automatic name extraction from YAML content")
    print("=" * 60)
    print(f"URL: {url}\n")
    
    try:
        result = await download_profile_content(url)
        
        print("Download successful!")
        print(f"Extracted Name: {result.get('name')}")
        print(f"Usage Info: {result.get('usage')}")
        print(f"Update Interval: {result.get('interval')} minutes")
        print(f"Content Length: {len(result.get('content', ''))} chars")
        
        # Check if name was extracted from YAML
        extracted_name = result.get('name')
        if extracted_name and extracted_name not in ['Profile 4', 'www.kdcloud.uk']:
            print(f"\n✓ SUCCESS: Extracted friendly name: {extracted_name}")
        else:
            print(f"\n✗ FAILED: Name not extracted correctly, got: {extracted_name}")
            
    except Exception as e:
        print(f"Error: {repr(e)}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(test_name_extraction())
