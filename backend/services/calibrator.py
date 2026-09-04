import numpy as np
from typing import Tuple

def affine_fit(d_rel: np.ndarray, dem_coarse: np.ndarray, nodata: float = -9999.0) -> Tuple[np.ndarray, float, float]:
    """
    Fits metric scale s and translation offset t such that:
        Z_metric = s * d_rel + t
    matches dem_coarse on valid pixels.
    """
    mask = (dem_coarse > nodata) & np.isfinite(d_rel) & np.isfinite(dem_coarse)
    if mask.sum() < 100:
        raise ValueError("Insufficient valid pixels for metric calibration (need >= 100)")

    # Ordinary Least Squares linear regression: y = s * x + t
    poly = np.polyfit(d_rel[mask], dem_coarse[mask], deg=1)
    scale_s = float(poly[0])
    offset_t = float(poly[1])

    z_metric = scale_s * d_rel + offset_t
    return z_metric.astype(np.float32), scale_s, offset_t

def affine_fit_ransac(d_rel: np.ndarray, dem_coarse: np.ndarray,
                      nodata: float = -9999.0,
                      max_trials: int = 100,
                      residual_threshold: float = 5.0) -> Tuple[np.ndarray, float, float]:
    """
    RANSAC affine fit for scenes containing large water bodies, clouds, or nodata gores.
    """
    mask = (dem_coarse > nodata) & np.isfinite(d_rel) & np.isfinite(dem_coarse)
    x = d_rel[mask]
    y = dem_coarse[mask]
    n = len(x)

    if n < 100:
        return affine_fit(d_rel, dem_coarse, nodata)

    best_inliers = 0
    best_s = 1.0
    best_t = 0.0

    rng = np.random.default_rng(42)

    for _ in range(max_trials):
        idx = rng.choice(n, size=2, replace=False)
        x_sample = x[idx]
        y_sample = y[idx]

        if np.abs(x_sample[1] - x_sample[0]) < 1e-6:
            continue

        s = (y_sample[1] - y_sample[0]) / (x_sample[1] - x_sample[0])
        t = y_sample[0] - s * x_sample[0]

        residuals = np.abs(y - (s * x + t))
        inliers = np.sum(residuals < residual_threshold)

        if inliers > best_inliers:
            best_inliers = inliers
            best_s = s
            best_t = t

    # Refit on all inliers
    residuals = np.abs(y - (best_s * x + best_t))
    inlier_mask = residuals < residual_threshold
    if inlier_mask.sum() > 2:
        poly = np.polyfit(x[inlier_mask], y[inlier_mask], deg=1)
        best_s, best_t = float(poly[0]), float(poly[1])

    z_metric = best_s * d_rel + best_t
    return z_metric.astype(np.float32), float(best_s), float(best_t)
