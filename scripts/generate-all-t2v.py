#!/usr/bin/env python3
"""Generate short T2V animations for all cat races (fast & reliable)"""
import urllib.request, json, time, os, http.client

API = "http://192.168.1.131:8188"
DIR = "/Users/frederic/Documents/OpenWork/virtualtable-rpg/frontend/img"

RACES = [
    ("persan", "regal fluffy persian cat with golden fur, royal expression, detailed fur"),
    ("maine-coon", "large majestic maine coon cat, thick fur, powerful build, wise expression"),
    ("bengal", "wild spotted bengal cat, agile pose, leopard-like markings, intense gaze"),
    ("sphynx", "hairless sphynx cat, mysterious appearance, elegant pose, magical aura"),
    ("europeen", "classic friendly european shorthair tabby cat, curious expression, warm colors"),
]

def generate_t2v(race, prompt_desc):
    print(f"\n🎯 {race}", flush=True)
    
    w = {
        "1": {"inputs": {"unet_name": "ltx-2.3-22b-distilled-Q4_K_S.gguf", "dtype": "default"}, "class_type": "UnetLoaderGGUF"},
        "2": {"inputs": {"text_encoder": "gemma_3_12B_it_fp4_mixed.safetensors", "ckpt_name": "ltx-2.3-22b-distilled-fp8.safetensors", "device": "cpu"}, "class_type": "LTXAVTextEncoderLoader"},
        "3": {"inputs": {"vae_name": "LTX23_video_vae_bf16.safetensors"}, "class_type": "VAELoader"},
        "4": {"inputs": {"value": f"Portrait of a {prompt_desc}, fantasy RPG style, cinematic lighting, highly detailed, animated character"},
        "class_type": "PrimitiveStringMultiline"},
        "5": {"inputs": {"text": ["4", 0], "clip": ["2", 0]}, "class_type": "CLIPTextEncode"},
        "6": {"inputs": {"text": "ugly, blurry, low quality, distorted, deformation, bad anatomy", "clip": ["2", 0]}, "class_type": "CLIPTextEncode"},
        "7": {"inputs": {"frame_rate": 25, "positive": ["5", 0], "negative": ["6", 0]}, "class_type": "LTXVConditioning"},
        "8": {"inputs": {"width": 512, "height": 512, "length": 50, "batch_size": 1}, "class_type": "EmptyLTXVLatentVideo"},
        "9": {"inputs": {"noise_seed": hash(race) % 100000}, "class_type": "RandomNoise"},
        "10": {"inputs": {"sampler_name": "euler_ancestral_cfg_pp"}, "class_type": "KSamplerSelect"},
        "11": {"inputs": {"sigmas": "1.0, 0.9875, 0.975, 0.909375, 0.725, 0.421875, 0.0"}, "class_type": "ManualSigmas"},
        "12": {"inputs": {"cfg": 1.0, "model": ["1", 0], "positive": ["7", 0], "negative": ["7", 1]}, "class_type": "CFGGuider"},
        "13": {"inputs": {"noise": ["9", 0], "guider": ["12", 0], "sampler": ["10", 0], "sigmas": ["11", 0], "latent_image": ["8", 0]}, "class_type": "SamplerCustomAdvanced"},
        "14": {"inputs": {"samples": ["13", 0], "vae": ["3", 0]}, "class_type": "VAEDecode"},
        "15": {"inputs": {"fps": 25, "images": ["14", 0]}, "class_type": "CreateVideo"},
        "16": {"inputs": {"filename_prefix": f"video/cats_{race}_t2v", "format": "auto", "codec": "auto", "video": ["15", 0]}, "class_type": "SaveVideo"}
    }
    
    data = json.dumps({"prompt": w}).encode()
    req = urllib.request.Request(f"{API}/prompt", data=data, headers={"Content-Type": "application/json"})
    pid = json.loads(urllib.request.urlopen(req, timeout=30).read()).get("prompt_id", "")
    if not pid:
        print(f"   ❌ Pas de prompt_id", flush=True)
        return None
    
    print(f"   🆔 {pid[:12]}...", flush=True)
    
    for i in range(300):
        time.sleep(5)
        try:
            req = urllib.request.Request(f"{API}/history/{pid}")
            h = json.loads(urllib.request.urlopen(req, timeout=5).read())
        except:
            continue
        if pid not in h: continue
        s = h[pid].get("status", {})
        if s.get("completed"):
            for nid, no in h[pid].get("outputs", {}).items():
                if "videos" in no:
                    for v in no["videos"]:
                        dl = f"{API}/view?filename={v['filename']}&subfolder={v.get('subfolder','')}"
                        dest = f"{DIR}/cats-{race}-i2v.mp4"
                        os.system(f'curl -s -o "{dest}" "{dl}"')
                        sz = os.path.getsize(dest)
                        print(f"   ✅ {sz/1024:.0f} Ko", flush=True)
                        return True
            return True
        if s.get("error"):
            print(f"   ❌ {s['error']}", flush=True)
            return None
        if i % 6 == 0 and i > 0:
            print(f"   ⏳ {i//6*5}s...", flush=True)
    
    print(f"   ⏰ Timeout", flush=True)
    return None

if __name__ == "__main__":
    for race, desc in RACES:
        generate_t2v(race, desc)
    
    print("\n✅ Fini !", flush=True)
