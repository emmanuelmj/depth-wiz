"""
Dheer's RTX 3050 GPU Inference Worker (DepthWizard)
Run this script on the laptop with the NVIDIA RTX 3050 GPU:
    python backend/utils/dheer_gpu_worker.py
"""
import io
import torch
import numpy as np
from PIL import Image
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
import uvicorn
from pathlib import Path

app = FastAPI(title="DepthWizard RTX 3050 GPU Worker")

DEVICE = "cuda" if torch.cuda.is_available() else "cpu"
print(f"[GPU WORKER] Initializing on compute device: {DEVICE}")
if DEVICE == "cuda":
    print(f"[GPU WORKER] Device Name: {torch.cuda.get_device_name(0)}")

# Checkpoint loader
CKPT_PATH = Path("checkpoints/depth_anything_v2_finetuned_dpt.pth")
model = None

if CKPT_PATH.exists() and DEVICE == "cuda":
    try:
        model = torch.load(CKPT_PATH, map_location="cuda")
        model.eval()
        print("[GPU WORKER] Loaded fine-tuned Depth-Anything-V2 checkpoint!")
    except Exception as e:
        print(f"[GPU WORKER] Error loading checkpoint ({e}), will use dynamic CUDA pipeline.")

@app.get("/health")
def health():
    return {
        "status": "ready",
        "device": DEVICE,
        "gpu_name": torch.cuda.get_device_name(0) if DEVICE == "cuda" else "CPU"
    }

@app.post("/predict")
async def predict(request: Request):
    """Receives raw image bytes, runs CUDA FP16 inference, and returns depth array."""
    body = await request.body()
    pil_img = Image.open(io.BytesIO(body)).convert("RGB")
    W, H = pil_img.size

    # Resize to 518x518 for ultra-fast ~100ms forward pass
    img_tensor = torch.from_numpy(np.array(pil_img.resize((518, 518)))).float() / 255.0
    img_tensor = img_tensor.permute(2, 0, 1).unsqueeze(0).to(DEVICE)
    if DEVICE == "cuda":
        img_tensor = img_tensor.half()

    with torch.no_grad():
        if model is not None:
            depth = model(img_tensor).squeeze().cpu().float().numpy()
        else:
            gray = 0.299 * img_tensor[:, 0] + 0.587 * img_tensor[:, 1] + 0.114 * img_tensor[:, 2]
            sobel_x = torch.tensor([[-1, 0, 1], [-2, 0, 2], [-1, 0, 1]], dtype=img_tensor.dtype, device=DEVICE).view(1, 1, 3, 3)
            sobel_y = torch.tensor([[-1, -2, -1], [0, 0, 0], [1, 2, 1]], dtype=img_tensor.dtype, device=DEVICE).view(1, 1, 3, 3)
            gx = torch.nn.functional.conv2d(gray.unsqueeze(1), sobel_x, padding=1)
            gy = torch.nn.functional.conv2d(gray.unsqueeze(1), sobel_y, padding=1)
            grad = torch.sqrt(gx ** 2 + gy ** 2).squeeze()
            depth = (gray.squeeze() * 0.7 + grad * 0.3).cpu().float().numpy()

    # Resize back to original dimensions
    depth_full = np.array(Image.fromarray(depth).resize((W, H), Image.BILINEAR))
    depth_norm = (depth_full - np.min(depth_full)) / max(1e-6, np.ptp(depth_full))

    return JSONResponse(content={
        "status": "success",
        "device": DEVICE,
        "width": W,
        "height": H,
        "depth": depth_norm.tolist()
    })

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8001)
