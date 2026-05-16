#!/usr/bin/env python3
"""Generate intro video using remote ComfyUI"""
import json, urllib.request, time, os, random, shutil

API_URL = "http://192.168.1.131:8188"
OUTPUT_DIR = "/Users/frederic/Documents/OpenWork/comfyui/output"

def queue_prompt(workflow):
    data = json.dumps({"prompt": workflow}).encode("utf-8")
    req = urllib.request.Request(f"{API_URL}/prompt", data=data, headers={"Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            return json.loads(resp.read())
    except Exception as e:
        return {"error": str(e)}

def get_history(prompt_id):
    req = urllib.request.Request(f"{API_URL}/history/{prompt_id}")
    try:
        with urllib.request.urlopen(req, timeout=5) as resp:
            return json.loads(resp.read())
    except: return None

def wait_for_result(prompt_id, timeout=3600, poll=10):
    print("⏳ Génération en cours...")
    start = time.time()
    while time.time() - start < timeout:
        history = get_history(prompt_id)
        if history and prompt_id in history:
            outputs = history[prompt_id].get("outputs", {})
            for nid, out in outputs.items():
                for key in ("gifs", "videos"):
                    if key in out:
                        for item in out[key]:
                            path = os.path.join(OUTPUT_DIR, item["subfolder"], item["filename"])
                            if os.path.exists(path): return path
        time.sleep(poll)
    return None

if __name__ == "__main__":
    # Check connection first
    try:
        req = urllib.request.Request(f"{API_URL}/object_info", headers={"Accept": "application/json"})
        with urllib.request.urlopen(req, timeout=5) as resp:
            print(f"✅ Connecté à ComfyUI sur {API_URL}")
    except Exception as e:
        print(f"❌ Impossible de se connecter à {API_URL}: {e}")
        print("Vérifie que ComfyUI tourne bien sur http://192.168.1.131:8188")
        exit(1)

    # Check available models
    print("\n📦 Modèles disponibles:")
    try:
        req = urllib.request.Request(f"{API_URL}/object_info/CheckpointLoaderSimple")
        with urllib.request.urlopen(req, timeout=5) as resp:
            data = json.loads(resp.read())
            models = data.get("input", {}).get("required", {}).get("ckpt_name", [[], {}])[0]
            for m in models:
                print(f"   - {m}")
    except: pass

    prompt = "Cinematic night scene on a modern city rooftop, multiple cats of different breeds gathered under the moonlight, city skyline with glowing lights in the background, one leader cat standing on a chimney addressing the others, cats wearing collars and small accessories, mysterious urban atmosphere, Cats La Mascarade RPG style, high quality, animated movie style, dark blue and orange neon lighting"
    neg = "text, watermark, ugly, deformed, blurry, low quality, extra limbs, bad anatomy, distorted, medieval, fantasy armor, swords, medieval clothing"

    print(f"\n🎬 Génération vidéo d'intro — Cats! La Mascarade (urbain, nuit)")
    print(f"   Prompt: {prompt[:80]}...")
    print(f"   Temps estimé: 2-5 minutes (selon GPU)")
    
    workflow = {
        "1":  { "class_type": "CheckpointLoaderSimple", "inputs": { "ckpt_name": "RealVisXL_V4.0.safetensors" } },
        "2":  { "class_type": "CLIPTextEncode", "inputs": { "text": prompt, "clip": ["1", 1] } },
        "3":  { "class_type": "CLIPTextEncode", "inputs": { "text": neg, "clip": ["1", 1] } },
        "4":  { "class_type": "EmptyLatentImage", "inputs": { "width": 1024, "height": 576, "batch_size": 1 } },
        "5":  { "class_type": "KSampler", "inputs": {
            "seed": random.randint(0, 2**31-1), "steps": 25, "cfg": 7,
            "sampler_name": "euler", "scheduler": "normal", "denoise": 1,
            "model": ["1", 0], "positive": ["2", 0], "negative": ["3", 0],
            "latent_image": ["4", 0]
        }},
        "6":  { "class_type": "VAEDecode", "inputs": { "samples": ["5", 0], "vae": ["1", 2] } },
        "7":  { "class_type": "SaveImage", "inputs": {
            "filename_prefix": "cats_intro_test",
            "images": ["6", 0]
        }}
    }

    result = queue_prompt(workflow)
    if "error" in result:
        print(f"❌ Erreur: {result['error']}")
        exit(1)
    
    pid = result.get("prompt_id", "")
    print(f"   Prompt ID: {pid}")
    
    if "node_errors" in result:
        print(f"⚠️ Erreurs: {json.dumps(result['node_errors'], indent=2)[:1000]}")
    
    if pid:
        path = wait_for_result(pid)
        if path:
            print(f"✅ Image générée: {path}")
            dest = "/Users/frederic/Documents/OpenWork/comfyui/latest_result.png"
            shutil.copy(path, dest)
            print(f"   Copiée vers: {dest}")
        else:
            print("❌ Timeout")
