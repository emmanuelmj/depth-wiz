import numpy as np
from PIL import Image
from pathlib import Path
from typing import Tuple, Optional

def export_displacement_png(d_rel: np.ndarray, output_path: str) -> str:
    """
    Saves a normalized relative depth array (0.0 to 1.0) as an uncompressed
    16-bit grayscale PNG for Three.js GPU vertex displacement.
    """
    Path(output_path).parent.mkdir(parents=True, exist_ok=True)
    d_clamped = np.clip(d_rel, 0.0, 1.0)
    d_uint16 = (d_clamped * 65535.0).astype(np.uint16)
    Image.fromarray(d_uint16).save(output_path)
    return output_path

def export_metric_geotiff(output_path: str, z_metric: np.ndarray,
                          bounds: Tuple[float, float, float, float],
                          crs: str = "EPSG:32643") -> str:
    """
    Exports a float32 calibrated Digital Surface Model as a GeoTIFF.
    """
    Path(output_path).parent.mkdir(parents=True, exist_ok=True)
    try:
        import rasterio
        from rasterio.transform import from_bounds
        H, W = z_metric.shape
        transform = from_bounds(*bounds, width=W, height=H)
        with rasterio.open(
            output_path, 'w',
            driver='GTiff',
            height=H, width=W,
            count=1,
            dtype=rasterio.float32,
            crs=crs,
            transform=transform
        ) as dst:
            dst.write(z_metric.astype(rasterio.float32), 1)
        return output_path
    except ImportError:
        # Fallback: save as raw float32 binary or numpy file if rasterio is not installed
        npy_path = str(output_path).replace(".tif", ".npy")
        np.save(npy_path, z_metric.astype(np.float32))
        return npy_path
