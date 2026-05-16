#!/usr/bin/env python3
"""Generate video with LTX 2.3 GGUF Q4_K_S on PCMaison"""
import urllib.request, json, time, sys

API = "http://192.168.1.131:8188"

# The exact workflow from the user
workflow = {
    "1": {"inputs": {"unet_name": "ltx-2.3-22b-distilled-Q4_K_S.gguf", "dtype": "default"}, "class_type": "UnetLoaderGGUF"},
    "2": {"inputs": {"text_encoder": "gemma_3_12B_it_fp4_mixed.safetensors", "ckpt_name": "ltx-2.3-22b-distilled-fp8.safetensors", "device": "cpu"}, "class_type": "LTXAVTextEncoderLoader"},
    "3": {"inputs": {"vae_name": "LTX23_video_vae_bf16.safetensors"}, "class_type": "VAELoader"},
    "4": {"inputs": {"value": ""}, "class_type": "PrimitiveStringMultiline"},  # PROMPT HERE
    "5": {"inputs": {"text": ["4", 0], "clip": ["2", 0]}, "class_type": "CLIPTextEncode"},
    "6": {"inputs": {"text": "ugly, blurry, low quality, distorted, watermark", "clip": ["2", 0]}, "class_type": "CLIPTextEncode"},
    "7": {"inputs": {"frame_rate": 25, "positive": ["5", 0], "negative": ["6", 0]}, "class_type": "LTXVConditioning"},
    "8": {"inputs": {"width": 512, "height": 288, "length": 253, "batch_size": 1}, "class_type": "EmptyLTXVLatentVideo"},
    "9": {"inputs": {"noise_seed": 78901}, "class_type": "RandomNoise"},
    "10": {"inputs": {"sampler_name": "euler_ancestral_cfg_pp"}, "class_type": "KSamplerSelect"},
    "11": {"inputs": {"sigmas": "1.0, 0.9875, 0.975, 0.909375, 0.725, 0.421875, 0.0"}, "class_type": "ManualSigmas"},
    "12": {"inputs": {"cfg": 1.0, "model": ["1", 0], "positive": ["7", 0], "negative": ["7", 1]}, "class_type": "CFGGuider"},
    "13": {"inputs": {"noise": ["9", 0], "guider": ["12", 0], "sampler": ["10", 0], "sigmas": ["11", 0], "latent_image": ["8", 0]}, "class_type": "SamplerCustomAdvanced"},
    "14": {"inputs": {"samples": ["13", 0], "vae": ["3", 0]}, "class_type": "VAEDecode"},
    "15": {"inputs": {"fps": 25, "images": ["14", 0]}, "class_type": "CreateVideo"},
    "16": {"inputs": {"filename_prefix": "video/LTX_gguf", "format": "auto", "codec": "auto", "video": ["15", 0]}, "class_type": "SaveVideo"}
}

# Set the prompt
workflow["4"]["inputs"]["value"] = "Cinematic night scene on a modern city rooftop, multiple cats of different breeds gathered under moonlight, city skyline with glowing lights in the background, one leader cat standing on a chimney addressing the others, mysterious urban atmosphere, high quality, detailed, warm neon lighting, animated movie style"

print("📤 Envoi du workflow GGUF Q4_K_S...", flush=True)
data = json.dumps({"prompt": workflow}).encode()
req = urllib.request.Request(f"{API}/prompt", data=data, headers={"Content-Type": "application/json"})
try:
    with urllib.request.urlopen(req, timeout=30) as resp:
        r = json.loads(resp.read())
except urllib.error.HTTPError as e:
    print(f"❌ HTTP Error: {e.read().decode()[:500]}", flush=True)
    sys.exit(1)

pid = r.get("prompt_id")
if not pid:
    print(f"❌ {json.dumps(r)[:500]}", flush=True)
    sys.exit(1)

print(f"✅ Prompt ID: {pid}", flush=True)
print("⏳ Génération (Q4_K_S, 10s, 512x288)", flush=True)

for i in range(600):
    time.sleep(10)
    try:
        req = urllib.request.Request(f"{API}/history/{pid}")
        with urllib.request.urlopen(req, timeout=5) as hr:
            h = json.loads(hr.read())
    except:
        continue
    if pid not in h:
        continue
    s = h[pid].get("status", {})
    if s.get("completed"):
        print("✅ Terminée !", flush=True)
        for nid, no in h[pid].get("outputs", {}).items():
            if "videos" in no:
                for v in no["videos"]:
                    fn = v["filename"]
                    print(f"📁 {fn}", flush=True)
                    print(f"🔗 {API}/view?filename={fn}", flush=True)
        break
    if s.get("error"):
        print(f"❌ {s['error']}", flush=True)
        break
    if i % 3 == 0:
        print(f"   {i*10}s...", flush=True)
