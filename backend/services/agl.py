import numpy as np

def estimate_ground(z_metric: np.ndarray, footprint_pixels: int = 32) -> np.ndarray:
    """
    Estimates the ground plane Z_ground beneath structures and vegetation.
    Uses morphological minimum filter followed by gaussian smoothing.
    """
    try:
        from scipy.ndimage import minimum_filter, gaussian_filter
        z_min = minimum_filter(z_metric, size=footprint_pixels)
        z_ground = gaussian_filter(z_min, sigma=footprint_pixels / 4.0)
        return z_ground.astype(np.float32)
    except ImportError:
        # Fast strided block-minimum fallback when scipy is not yet installed
        H, W = z_metric.shape
        step = max(1, footprint_pixels // 2)
        z_ground = np.copy(z_metric)
        for r in range(0, H, step):
            r_end = min(H, r + footprint_pixels)
            for c in range(0, W, step):
                c_end = min(W, c + footprint_pixels)
                block_min = np.min(z_metric[r:r_end, c:c_end])
                z_ground[r:r_end, c:c_end] = block_min
        return z_ground.astype(np.float32)

def compute_agl(z_metric: np.ndarray, z_ground: np.ndarray) -> np.ndarray:
    """
    Above Ground Level (AGL) height: h_AGL = max(0, Z_metric - Z_ground)
    """
    return np.maximum(0.0, z_metric - z_ground).astype(np.float32)
