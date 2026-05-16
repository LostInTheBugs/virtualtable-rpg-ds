#!/usr/bin/env python3
"""Generate Image-to-Video for cat portraits using LTX 2.3 GGUF on PCMaison"""
import urllib.request, json, time, sys, os

API = "http://192.168.1.131:8188"

def generate_i2v(portrait_url, output_prefix, seed=42):
    """Generate a short animation from a portrait image"""
    
    workflow = {
        "1": {"inputs": {"unet_name": "ltx-2.3-22b-distilled-Q4_K_S.gguf", "dtype": "default"}, "class_type": "UnetLoaderGGUF"},
        "2": {"inputs": {"text_encoder": "gemma_3_12B_it_fp4_mixed.safetensors", "ckpt_name": "ltx-2.3-22b-distilled-fp8.safetensors", "device": "cpu"}, "class_type": "LTXAVTextEncoderLoader"},
        "3": {"inputs": {"vae_name": "LTX23_video_vae_bf16.safetensors"}, "class_type": "VAELoader"},
        "10": {"inputs": {"image": portrait_url}, "class_type": "LoadImage"},
        "11": {"inputs": {"img_compression": 0.5, "image": ["10", 0]}, "class_type": "LTXVPreprocess"},
        "4": {"inputs": {"value": "a cute cat character, fantasy RPG style, detailed fur, cinematic lighting, high quality"}, "class_type": "PrimitiveStringMultiline"},
        "5": {"inputs": {"text": ["4", 0], "clip": ["2", 0]}, "class_type": "CLIPTextEncode"},
        "6": {"inputs": {"text": "ugly, blurry, low quality, distorted, deformation", "clip": ["2", 0]}, "class_type": "CLIPTextEncode"},
        "7": {"inputs": {"frame_rate": 25, "positive": ["5", 0], "negative": ["6", 0]}, "class_type": "LTXVConditioning"},
        "12": {"inputs": {"vae": ["3", 0], "image": ["11", 0], "latent": ["8", 0], "strength": 0.8, "bypass": False}, "class_type": "LTXVImgToVideoInplace"},
        "8": {"inputs": {"width": 512, "height": 512, "length": 50, "batch_size": 1}, "class_type": "EmptyLTXVLatentVideo"},
        "9": {"inputs": {"noise_seed": seed}, "class_type": "RandomNoise"},
        "13": {"inputs": {"sampler_name": "euler_ancestral_cfg_pp"}, "class_type": "KSamplerSelect"},
        "14": {"inputs": {"sigmas": "1.0, 0.9875, 0.975, 0.909375, 0.725, 0.421875, 0.0"}, "class_type": "ManualSigmas"},
        "15": {"inputs": {"cfg": 1.0, "model": ["1", 0], "positive": ["7", 0], "negative": ["7", 1]}, "class_type": "CFGGuider"},
        "16": {"inputs": {"noise": ["9", 0], "guider": ["15", 0], "sampler": ["13", 0], "sigmas": ["14", 0], "latent_image": ["12", 0]}, "class_type": "SamplerCustomAdvanced"},
        "17": {"inputs": {"samples": ["16", 0], "vae": ["3", 0]}, "class_type": "VAEDecode"},
        "18": {"inputs": {"fps": 25, "images": ["17", 0]}, "class_type": "CreateVideo"},
        "19": {"inputs": {"filename_prefix": f"video/{output_prefix}", "format": "auto", "codec": "auto", "video": ["18", 0]}, "class_type": "SaveVideo"}
    }
    
    print(f"📤 I2V: {output_prefix}", flush=True)
    data = json.dumps({"prompt": workflow}).encode()
    req = urllib.request.Request(f"{API}/prompt", data=data, headers={"Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            r = json.loads(resp.read())
    except urllib.error.HTTPError as e:
        err = e.read().decode()[:500]
        if "missing" in err.lower():
            print(f"   ⚠️ Ajustement nécessaire: {err[:200]}", flush=True)
            return None
        print(f"   ❌ {err}", flush=True)
        return None
    
    pid = r.get("prompt_id")
    if not pid:
        print(f"   ❌ {json.dumps(r)[:200]}", flush=True)
        return None
    
    print(f"   Prompt ID: {pid}", flush=True)
    
    for i in range(300):
        time.sleep(5)
        try:
            req = urllib.request.Request(f"{API}/history/{pid}")
            with urllib.request.urlopen(req, timeout=5) as hr:
                h = json.loads(hr.read())
        except:
            continue
        if pid not in h: continue
        s = h[pid].get("status", {})
        if s.get("completed"):
            for nid, no in h[pid].get("outputs", {}).items():
                if "videos" in no:
                    for v in no["videos"]:
                        print(f"   ✅ {v['filename']}", flush=True)
                        return v['filename']
            return "completed_no_video"
        if s.get("error"):
            print(f"   ❌ {s['error']}", flush=True)
            return None
        if i % 12 == 0:
            print(f"   {i*5}s...", flush=True)
    
    print("   ⏰ Timeout", flush=True)
    return None

if __name__ == "__main__":
    # Test with the vagabond portrait
    # First we need to upload the image to PCMaison or use a URL
    print("Test I2V avec le portrait Chat de gouttière", flush=True)
    
    # The image needs to be accessible from PCMaison
    # Option 1: upload via ComfyUI API
    # Option 2: use a URL
    # For now, let's check if the image is already on PCMaison
    
    # Upload the portrait image to PCMaison
    import subprocess
    img_path = "/Users/frederic/Documents/OpenWork/virtualtable-rpg/frontend/img/cats-vagabond-portrait.jpg"
    
    # Use scp to copy to PCMaison ComfyUI input folder
    result = subprocess.run(
        ["scp", img_path, "administrator@192.168.1.131:/home/administrator/ComfyUI/input/cats-vagabond.jpg"],
        capture_output=True, text=True, timeout=30
    )
    print(f"Upload: {result.returncode}", flush=True)
    
    if result.returncode == 0:
        fn = generate_i2v("cats-vagabond.jpg", "cats_vagabond_i2v")
        if fn:
            print(f"\n📁 {fn}", flush=True)
            print(f"🔗 http://192.168.1.131:8188/view?filename={fn}&subfolder=video&type=output", flush=True)
    else:
        print(f"Upload failed: {result.stderr}", flush=True)
