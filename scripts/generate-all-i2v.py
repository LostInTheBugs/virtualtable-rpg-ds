#!/usr/bin/env python3
"""Generate TRUE Image-to-Video for cat portraits using LTX 2.3 on PCMaison"""
import urllib.request, json, time, sys, os, http.client

API = "http://192.168.1.131:8188"
IMG_DIR = "/Users/frederic/Documents/OpenWork/virtualtable-rpg/frontend/img"

def upload_image(local_path):
    with open(local_path, "rb") as f:
        file_data = f.read()
    boundary = "----WebKitFormBoundary7MA4YWxkTrZu0gW"
    fname = os.path.basename(local_path)
    body = (f"--{boundary}\r\nContent-Disposition: form-data; name=\"image\"; filename=\"{fname}\"\r\nContent-Type: image/jpeg\r\n\r\n").encode() + file_data + f"\r\n--{boundary}--\r\n".encode()
    conn = http.client.HTTPConnection("192.168.1.131", 8188, timeout=30)
    conn.request("POST", "/upload/image", body, {"Content-Type": f"multipart/form-data; boundary={boundary}"})
    result = json.loads(conn.getresponse().read())
    conn.close()
    return result.get("name")

def generate_i2v(race_key, seed=42):
    """True I2V workflow with LTXVImgToVideoInplace"""
    
    # Upload portrait
    img_path = f"{IMG_DIR}/cats-{race_key}-portrait.jpg"
    remote_img = upload_image(img_path)
    print(f"   📤 Image uploadée: {remote_img}", flush=True)
    
    # Proper I2V workflow using LTXVImgToVideoInplace
    w = {
        "1": {"inputs": {"unet_name": "ltx-2.3-22b-distilled-Q4_K_S.gguf", "dtype": "default"}, "class_type": "UnetLoaderGGUF"},
        "2": {"inputs": {"text_encoder": "gemma_3_12B_it_fp4_mixed.safetensors", "ckpt_name": "ltx-2.3-22b-distilled-fp8.safetensors", "device": "cpu"}, "class_type": "LTXAVTextEncoderLoader"},
        "3": {"inputs": {"vae_name": "LTX23_video_vae_bf16.safetensors"}, "class_type": "VAELoader"},
        "10": {"inputs": {"image": remote_img}, "class_type": "LoadImage"},
        "11": {"inputs": {"img_compression": 0.5, "image": ["10", 0]}, "class_type": "LTXVPreprocess"},
        "4": {"inputs": {"value": f"a cute cat character, fantasy RPG style, detailed fur, cinematic lighting, high quality"}, "class_type": "PrimitiveStringMultiline"},
        "5": {"inputs": {"text": ["4", 0], "clip": ["2", 0]}, "class_type": "CLIPTextEncode"},
        "6": {"inputs": {"text": "ugly, blurry, low quality, distorted, deformation, bad anatomy", "clip": ["2", 0]}, "class_type": "CLIPTextEncode"},
        "7": {"inputs": {"frame_rate": 25, "positive": ["5", 0], "negative": ["6", 0]}, "class_type": "LTXVConditioning"},
        "8": {"inputs": {"width": 512, "height": 512, "length": 50, "batch_size": 1}, "class_type": "EmptyLTXVLatentVideo"},
        "12": {"inputs": {"vae": ["3", 0], "image": ["11", 0], "latent": ["8", 0], "strength": 0.85, "bypass": False}, "class_type": "LTXVImgToVideoInplace"},
        "9": {"inputs": {"noise_seed": seed}, "class_type": "RandomNoise"},
        "13": {"inputs": {"sampler_name": "euler_ancestral_cfg_pp"}, "class_type": "KSamplerSelect"},
        "14": {"inputs": {"sigmas": "1.0, 0.9875, 0.975, 0.909375, 0.725, 0.421875, 0.0"}, "class_type": "ManualSigmas"},
        "15": {"inputs": {"cfg": 1.0, "model": ["1", 0], "positive": ["7", 0], "negative": ["7", 1]}, "class_type": "CFGGuider"},
        "16": {"inputs": {"noise": ["9", 0], "guider": ["15", 0], "sampler": ["13", 0], "sigmas": ["14", 0], "latent_image": ["12", 0]}, "class_type": "SamplerCustomAdvanced"},
        "17": {"inputs": {"samples": ["16", 0], "vae": ["3", 0]}, "class_type": "VAEDecode"},
        "18": {"inputs": {"fps": 25, "images": ["17", 0]}, "class_type": "CreateVideo"},
        "19": {"inputs": {"filename_prefix": f"video/cats_{race_key}_i2v", "format": "auto", "codec": "auto", "video": ["18", 0]}, "class_type": "SaveVideo"}
    }
    
    print(f"   🚀 Envoi du workflow I2V...", flush=True)
    data = json.dumps({"prompt": w}).encode()
    req = urllib.request.Request(f"{API}/prompt", data=data, headers={"Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            pid = json.loads(resp.read()).get("prompt_id", "")
    except urllib.error.HTTPError as e:
        err = e.read().decode()[:500]
        if "validation" not in err:
            print(f"   ❌ {err}", flush=True)
            return None
        pid = ""
    
    if not pid:
        print(f"   ❌ Pas de prompt_id", flush=True)
        return None
    
    print(f"   🆔 {pid[:12]}...", flush=True)
    
    for i in range(300):
        time.sleep(5)
        try:
            req2 = urllib.request.Request(f"{API}/history/{pid}")
            with urllib.request.urlopen(req2, timeout=5) as hr:
                h = json.loads(hr.read())
        except:
            continue
        if pid not in h: continue
        s = h[pid].get("status", {})
        if s.get("completed"):
            for nid, no in h[pid].get("outputs", {}).items():
                if "videos" in no:
                    for v in no["videos"]:
                        fn = v["filename"]
                        dl = f"{API}/view?filename={fn}&subfolder={v.get('subfolder','')}"
                        dest = f"{IMG_DIR}/cats-{race_key}-i2v.mp4"
                        os.system(f'curl -s -o "{dest}" "{dl}"')
                        sz = os.path.getsize(dest)
                        print(f"   ✅ {sz/1024:.0f} Ko: {fn}", flush=True)
                        return True
            return True
        if s.get("error"):
            print(f"   ❌ {s['error']}", flush=True)
            return None
        if i % 12 == 0 and i > 0:
            print(f"   ⏳ {i//12} min...", flush=True)
    
    print(f"   ⏰ Timeout", flush=True)
    return None

if __name__ == "__main__":
    races = [
        ("siamois", "Siamois"),
        ("persan", "Persan"),
        ("maine-coon", "Maine Coon"),
        ("bengal", "Bengal"),
        ("sphynx", "Sphynx"),
        ("europeen", "Européen"),
    ]
    
    print("🎬 I2V: Génération Image-to-Video pour toutes les races")
    print("=" * 50, flush=True)
    
    for key, label in races:
        print(f"\n🎯 {label} ({key})", flush=True)
        ok = generate_i2v(key)
        print(f"   {'✅' if ok else '❌'} Terminé", flush=True)
        time.sleep(2)
    
    print("\n" + "=" * 50)
    print("✅ Toutes les I2V générées !")
    print("=" * 50, flush=True)
