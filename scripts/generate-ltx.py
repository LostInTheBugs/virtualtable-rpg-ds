#!/usr/bin/env python3
"""Generate LTX 2.3 video on remote ComfyUI"""
import urllib.request, json, time, os, random, sys

API = "http://192.168.1.131:8188"
OUTPUT = "/Users/frederic/Documents/OpenWork/comfyui/output"

def queue(workflow):
    data = json.dumps({"prompt": workflow}).encode()
    req = urllib.request.Request(f"{API}/prompt", data=data, headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=30) as resp:
        return json.loads(resp.read())

def history(pid):
    try:
        req = urllib.request.Request(f"{API}/history/{pid}")
        with urllib.request.urlopen(req, timeout=5) as resp:
            return json.loads(resp.read())
    except: return None

def wait(pid, timeout=600):
    print("⏳ Génération LTX 2.3 en cours...")
    start = time.time()
    while time.time() - start < timeout:
        h = history(pid)
        if h and pid in h:
            out = h[pid].get("outputs", {})
            for nid, no in out.items():
                for key in ("videos", "gifs"):
                    if key in no:
                        for item in no[key]:
                            path = os.path.join("/home/administrator/ComfyUI/output", item["subfolder"], item["filename"])
                            # We can't access remote files directly, just note the filename
                            return f"{item['subfolder']}/{item['filename']}"
        time.sleep(5)
    return None

# Build workflow
w = {
    "1": {"class_type": "LTXAVTextEncoderLoader", "inputs": {
        "text_encoder": "gemma_3_12B_it_fp4_mixed.safetensors",
        "ckpt_name": "ltx-2.3-22b-dev-fp8.safetensors",
        "device": "default"
    }},
    "2": {"class_type": "LTXVConditioning", "inputs": {
        "positive": "Cinematic night scene on a modern city rooftop, multiple cats of different breeds gathered under moonlight, city skyline with glowing lights, one leader cat on a chimney addressing the others, mysterious urban atmosphere, Cats La Mascarade style, high quality, detailed, warm lighting",
        "negative": "text, watermark, ugly, deformed, blurry, low quality, medieval, fantasy, swords, magic",
        "frame_rate": 25,
        "clip": ["1", 0]
    }},
    "3": {"class_type": "EmptyLTXVLatentVideo", "inputs": {
        "width": 640, "height": 360,
        "length": 10, "batch_size": 1  # 10 seconds
    }},
    "4": {"class_type": "LTXVScheduler", "inputs": {
        "steps": 20, "max_shift": 2.0, "base_shift": 0.5,
        "stretch": 1.0, "terminal": 0.0
    }},
    "5": {"class_type": "ModelSamplingLTXV", "inputs": {
        "model": ["1", 1],
        "max_shift": 2.0, "base_shift": 0.5,
        "latent": ["3", 0]
    }},
    "6": {"class_type": "LTXVBaseSampler", "inputs": {
        "model": ["5", 0],
        "vae": ["1", 2],
        "width": 640, "height": 360,
        "num_frames": 250,
        "guider": ["2", 0],
        "sampler": ["4", 0],
        "sigmas": ["4", 1],
        "noise": ["4", 2]
    }},
    "7": {"class_type": "VAEDecode", "inputs": {
        "samples": ["6", 0],
        "vae": ["1", 2]
    }},
    "8": {"class_type": "VHS_VideoCombine", "inputs": {
        "frame_rate": 25, "loop_count": 1,
        "filename_prefix": "cats_intro_ltx",
        "images": ["7", 0],
        "format": "video/h264-mp4",
        "pingpong": False, "save_output": True
    }}
}

print("🎬 Génération LTX 2.3 — Cats intro (10s)")
print(f"   Modèle: ltx-2.3-22b-dev-fp8")
print(f"   Résolution: 640x360, 10s, 25fps, 250 frames")
print(f"   Temps estimé: 2-5 minutes")

result = queue(w)
pid = result.get("prompt_id", "")

if "node_errors" in result and result["node_errors"]:
    print(f"⚠️ Erreurs: {json.dumps(result['node_errors'], indent=2)[:2000]}")

if pid:
    print(f"   Prompt ID: {pid}")
    path = wait(pid)
    if path:
        print(f"✅ Vidéo générée: {path}")
        print(f"   Fichier sur PCMaison: /home/administrator/ComfyUI/output/{path}")
        print(f"   Tu peux le récupérer avec scp ou depuis l'interface web:")
        print(f"   http://192.168.1.131:8188/view?filename={path.split('/')[-1]}")
    else:
        print("❌ Timeout")
else:
    print(f"❌ Erreur: {result.get('error', result)}")
