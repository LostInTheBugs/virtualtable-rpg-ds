#!/usr/bin/env python3
"""Generate LTX 2.3 video on PCMaison using workflow_api.json"""
import urllib.request, json, time, sys, os

API = "http://192.168.1.131:8188"
WORKFLOW_FILE = os.path.join(os.path.dirname(__file__), "workflow_api.json")

def generate_video(prompt, duration=10, width=768, height=512):
    """Generate a video with LTX 2.3. Returns (success, filename or error)"""
    
    # Load workflow
    with open(WORKFLOW_FILE) as f:
        workflow = json.load(f)
    
    # Modify parameters
    workflow["267:266"]["inputs"]["value"] = prompt        # Prompt
    workflow["267:225"]["inputs"]["value"] = duration       # Duration in seconds
    workflow["267:257"]["inputs"]["value"] = width          # Width (768 or 1280)
    workflow["267:258"]["inputs"]["value"] = height         # Height (512 or 720)
    
    print(f"🎬 Génération LTX 2.3 — {duration}s — {width}x{height}")
    
    # Send to API
    data = json.dumps({"prompt": workflow}).encode("utf-8")
    req = urllib.request.Request(f"{API}/prompt", data=data,
                                 headers={"Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            result = json.loads(resp.read())
    except urllib.error.HTTPError as e:
        return False, f"API Error: {e.read().decode()[:500]}"
    
    prompt_id = result.get("prompt_id")
    if not prompt_id:
        return False, f"Unexpected response: {json.dumps(result)[:500]}"
    
    print(f"   Prompt ID: {prompt_id}")
    
    # Poll for completion
    for attempt in range(300):  # 300 * 5s = 25 min max
        time.sleep(5)
        try:
            req = urllib.request.Request(f"{API}/history/{prompt_id}")
            with urllib.request.urlopen(req, timeout=5) as hr:
                history = json.loads(hr.read())
        except:
            continue
        
        if prompt_id not in history:
            continue
        
        entry = history[prompt_id]
        status = entry.get("status", {})
        
        if status.get("completed"):
            # Find output filename
            outputs = entry.get("outputs", {})
            for node_id, node_output in outputs.items():
                for key in ("videos", "gifs"):
                    if key in node_output:
                        for item in node_output[key]:
                            filename = item.get("filename", "")
                            if filename:
                                print(f"✅ Vidéo générée: {filename}")
                                return True, filename
            
            return True, "completed (no video file found in output)"
        
        if status.get("error"):
            return False, f"Generation error: {status.get('error')}"
        
        if attempt % 12 == 0:  # Every minute
            print(f"   En cours... ({attempt * 5}s)")
    
    return False, "Timeout after 25 minutes"

if __name__ == "__main__":
    # Example: generate the Cats! intro
    prompt = "Cinematic night scene on a modern city rooftop, multiple cats of different breeds gathered under moonlight, city skyline with glowing lights in the background, one leader cat standing on a chimney addressing the others, cats wearing collars and small accessories, mysterious urban atmosphere, high quality, detailed, warm orange and blue neon lighting"
    
    success, result = generate_video(prompt, duration=10, width=768, height=512)
    if success:
        print(f"\n📁 Fichier: {result}")
        print(f"   Disponible sur PCMaison dans /home/administrator/ComfyUI/output/")
        print(f"   API: {API}/view?filename={result}")
    else:
        print(f"\n❌ {result}")
