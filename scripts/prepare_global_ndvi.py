"""Prepare historical NASA HLS vegetation overlays for the global demo.

Run with the Rasterio, NumPy and Pillow preparation dependencies.
"""

from concurrent.futures import ThreadPoolExecutor
from contextlib import ExitStack
from functools import lru_cache
from math import ceil, floor
from pathlib import Path
import json
from urllib.parse import urlencode, urlsplit
from urllib.request import urlopen

import numpy as np
from PIL import Image
import rasterio
from rasterio.enums import Resampling
from rasterio.transform import from_bounds
from rasterio.warp import reproject, transform_bounds
from rasterio.windows import Window, from_bounds as window_at

from prepare_hls import BANDS, COMPUTER, get_ndvi


SIDE_METERS = 3000
PIXELS = SIDE_METERS // 30
PALETTE = np.array([[152, 96, 62], [215, 172, 97], [182, 204, 110], [87, 155, 88], [21, 76, 62]])
FRONTEND = Path(__file__).resolve().parents[1] / "frontend"
OUTPUT = FRONTEND / "public" / "global"


def fetch_json(url):
    with urlopen(url, timeout=15) as response:
        return json.load(response)


@lru_cache(maxsize=8)
def token_for(host, container):
    account = host.split(".")[0]
    return fetch_json(f"{COMPUTER}/api/sas/v1/token/{account}/{container}")["token"].lstrip("?")


def open_band(item, band):
    href = item["assets"][band]["href"]
    parsed = urlsplit(href)
    token = token_for(parsed.hostname, parsed.path.split("/")[1])
    return rasterio.open(f"{href}?{token}")


def read_layer(item, bounds):
    with rasterio.Env(GDAL_DISABLE_READDIR_ON_OPEN="EMPTY_DIR", GDAL_HTTP_TIMEOUT="12"), ExitStack() as stack:
        red, nir, mask = [stack.enter_context(open_band(item, band)) for band in BANDS]
        fractional = window_at(*transform_bounds("EPSG:4326", red.crs, *bounds), red.transform)
        left, top = floor(fractional.col_off), floor(fractional.row_off)
        right = ceil(fractional.col_off + fractional.width)
        bottom = ceil(fractional.row_off + fractional.height)
        window = Window(left, top, right - left, bottom - top)
        if (window.col_off < 0 or window.row_off < 0 or window.col_off + window.width > red.width
                or window.row_off + window.height > red.height):
            return None
        ndvi, valid, _ = get_ndvi(red, nir, mask, window)
        result = np.full((PIXELS, PIXELS), np.nan, dtype="float32")
        reproject(
            np.where(valid, ndvi, np.nan), result, src_transform=red.window_transform(window),
            src_crs=red.crs, dst_transform=from_bounds(*bounds, PIXELS, PIXELS), dst_crs="EPSG:4326",
            src_nodata=np.nan, dst_nodata=np.nan, resampling=Resampling.nearest,
        )
        return result


def prepare(site):
    key, terrain = site
    bounds = terrain["bounds"]
    if terrain["widthMeters"] != SIDE_METERS or terrain["heightMeters"] != SIDE_METERS:
        raise ValueError(f"El terreno de {key} debe cubrir {SIDE_METERS} m por lado.")
    query = urlencode({
        "collections": "hls2-l30", "bbox": ",".join(map(str, bounds)),
        "datetime": "2025-01-01T00:00:00Z/2025-12-31T23:59:59Z", "limit": 14,
        "sortby": "+properties.eo:cloud_cover",
    })
    items = fetch_json(f"{COMPUTER}/api/stac/v1/search?{query}")["features"]
    for item in items[:8]:
        try:
            layer = read_layer(item, bounds)
        except (OSError, rasterio.errors.RasterioError):
            continue
        if layer is None:
            continue
        valid = np.isfinite(layer)
        coverage = float(valid.mean())
        if coverage < 0.68:
            continue
        pixels = np.zeros((*layer.shape, 4), dtype="uint8")
        for channel in range(3):
            pixels[:, :, channel][valid] = np.interp(
                layer[valid], [-0.2, 0.05, 0.3, 0.55, 0.85], PALETTE[:, channel],
            ).astype("uint8")
        pixels[:, :, 3][valid] = 255
        name = f"ndvi-{key}.png"
        Image.fromarray(pixels).save(OUTPUT / name, optimize=True)
        return key, {
            "imageUrl": f"/global/{name}", "date": item["properties"]["datetime"][:10],
            "granule": item["id"], "coverage": round(coverage, 4), "sideMeters": SIDE_METERS,
            "sourceUrl": f"{COMPUTER}/api/stac/v1/collections/hls2-l30/items/{item['id']}",
        }
    raise RuntimeError(f"No suitable regional HLS tile for {key}.")


def main():
    OUTPUT.mkdir(parents=True, exist_ok=True)
    terrain = json.loads((FRONTEND / "src" / "global" / "terrain.json").read_text(encoding="utf-8"))
    with ThreadPoolExecutor(max_workers=5) as pool:
        manifest = dict(pool.map(prepare, terrain.items()))
    (OUTPUT / "ndvi.json").write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
