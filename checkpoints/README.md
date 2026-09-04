# Model Checkpoints Directory

Place the fine-tuned PyTorch model weights downloaded from Google Colab here:

```
checkpoints/depth_anything_v2_finetuned_dpt.pth
```

### Auto-Detection:
- When running on an NVIDIA GPU machine (e.g. Dheer's RTX 3050), `backend/services/inference.py` automatically looks for this `.pth` file and loads it onto CUDA Tensor Cores.
- If the file is not present or if running on a CPU-only machine, the backend seamlessly activates the instant fallback feature engine without crashing.
