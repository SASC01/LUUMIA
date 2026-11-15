"""Regenera la vista precargada de Don Tino desde un gránulo HLS L30 v2.0.

Dependencias de preparación: python -m pip install rasterio Pillow.
El sitio consume solamente el PNG y JSON resultantes.
"""

import argparse
from concurrent.futures import ThreadPoolExecutor
from contextlib import ExitStack
from datetime import UTC, datetime
from hashlib import sha256
import json
from math import ceil, floor
from pathlib import Path
import sys
from urllib.parse import urlsplit
from urllib.request import urlopen

import numpy as np
from PIL import Image, ImageColor, ImageDraw
from rasterio.features import geometry_mask
from rasterio.io import MemoryFile
from rasterio.warp import transform_geom
from rasterio.windows import Window, from_bounds

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "backend" / "src"))
from luumia.base import seed_context

GRANULE = "HLS.L30.T16QBG.2023054T162247.v2.0"
COMPUTER = "https://planetarycomputer.microsoft.com"
COLLECTION = "hls2-l30"
ITEM = f"{COMPUTER}/api/stac/v1/collections/{COLLECTION}/items/{GRANULE}"
SOURCE = "https://doi.org/10.5067/HLS/HLSL30.002"
QA_GUIDE = "https://hls.gsfc.nasa.gov/data-products/"
BANDS = ("B04", "B05", "Fmask")
LEGEND = {
    "min": -0.2,
    "max": 0.9,
    "colors": ["#d4ad77", "#e5d69f", "#a0bf7e", "#4c8556", "#174f42"],
    "no_data_color": "#dce0e1",
    "parcel_outline_color": "#ffffff",
}
IMAGE_NAME = "don-tino-ndvi.png"


def get_bytes(url: str) -> bytes:
    try:
        with urlopen(url, timeout=60) as response:
            return response.read()
    except OSError as error:
        # Keep the read-only SAS query outside console messages and public files.
        raise SystemExit(f"No se pudo leer {urlsplit(url).path} (HTTP o conexión).") from None


def download_assets(item: dict) -> tuple[dict[str, str], dict[str, bytes]]:
    assets = {band: item["assets"][band]["href"] for band in BANDS}
    accounts = {(urlsplit(url).hostname.split(".")[0], urlsplit(url).path.split("/")[1])
                for url in assets.values()}
    if len(accounts) != 1 or any(urlsplit(url).query for url in assets.values()):
        raise SystemExit("Se esperaba un contenedor común con URL de origen sin firma.")
    account, container = accounts.pop()
    token = json.loads(get_bytes(f"{COMPUTER}/api/sas/v1/token/{account}/{container}"))["token"]
    with ThreadPoolExecutor(max_workers=len(BANDS)) as pool:
        payloads = pool.map(lambda url: get_bytes(f"{url}?{token.lstrip('?')}"), assets.values())
        return assets, dict(zip(assets, payloads))


def make_window(dataset, shape: dict, padding: int = 420) -> Window:
    ring = shape["coordinates"][0]
    xs, ys = zip(*ring)
    fractional = from_bounds(min(xs) - padding, min(ys) - padding,
                             max(xs) + padding, max(ys) + padding, dataset.transform)
    left = floor(fractional.col_off)
    top = floor(fractional.row_off)
    right = ceil(fractional.col_off + fractional.width)
    bottom = ceil(fractional.row_off + fractional.height)
    if left < 0 or top < 0 or right > dataset.width or bottom > dataset.height:
        raise SystemExit("El gránulo no contiene el polígono y su margen de contexto.")
    return Window(left, top, right - left, bottom - top)


def reflectance_scaling(dataset) -> dict[str, float]:
    tags = {**dataset.tags(), **dataset.tags(1)}
    return {"scale": float(tags.get("scale_factor", dataset.scales[0])),
            "offset": float(tags.get("add_offset", dataset.offsets[0]))}


def reflectance(dataset, window: Window, scaling: dict[str, float]) -> np.ndarray:
    raw = dataset.read(1, window=window, masked=True).astype("float64")
    return (raw * scaling["scale"] + scaling["offset"]).filled(np.nan)


def get_ndvi(red, nir, fmask, window: Window) -> tuple[np.ndarray, np.ndarray, dict]:
    scaling = {band: reflectance_scaling(dataset) for band, dataset in zip(BANDS[:2], (red, nir))}
    red_values = reflectance(red, window, scaling[BANDS[0]])
    nir_values = reflectance(nir, window, scaling[BANDS[1]])
    qa = fmask.read(1, window=window, masked=True).filled(255)
    denominator = nir_values + red_values
    ndvi = np.full(red_values.shape, np.nan)
    np.divide(nir_values - red_values, denominator, out=ndvi, where=denominator > 0)
    # Bits 1–5: cloud, adjacency, shadow, snow/ice, water. Bits 6–7 = 11: high aerosol.
    qa_fill = qa == 255
    atmospheric_or_surface = ((qa & 0b00111110) != 0) & ~qa_fill
    high_aerosol = ((qa >> 6) == 3) & ~qa_fill
    bad_spectrum = ~np.isfinite(ndvi) | (ndvi < -1) | (ndvi > 1)
    valid = ~(qa_fill | atmospheric_or_surface | high_aerosol | bad_spectrum)
    return ndvi, valid, {
        "scaling": scaling,
        "mask": {"fmask_no_data": qa_fill, "cloud_adjacency_shadow_snow_ice_or_water": atmospheric_or_surface,
                 "high_aerosol": high_aerosol, "invalid_spectral_data": bad_spectrum},
    }


def paint(ndvi: np.ndarray, valid: np.ndarray, shape: dict, transform) -> Image.Image:
    colors = np.array([ImageColor.getrgb(color) for color in LEGEND["colors"]])
    stops = np.linspace(LEGEND["min"], LEGEND["max"], len(colors))
    pixels = np.empty((*ndvi.shape, 3), dtype="uint8")
    pixels[:] = ImageColor.getrgb(LEGEND["no_data_color"])
    for channel in range(3):
        pixels[:, :, channel][valid] = np.rint(np.interp(ndvi[valid], stops, colors[:, channel]))

    zoom = 14
    height, width = ndvi.shape
    image = Image.fromarray(pixels).resize((width * zoom, height * zoom), Image.Resampling.NEAREST)
    points = [tuple(component * zoom for component in ((~transform) * (x, y)))
              for x, y in shape["coordinates"][0]]
    overlay = ImageDraw.Draw(image)
    overlay.line(points, fill="#20362d", width=6, joint="curve")
    overlay.line(points, fill=LEGEND["parcel_outline_color"], width=3, joint="curve")
    return image


def render(payloads: dict[str, bytes], geometry: dict) -> tuple[Image.Image, dict, dict, dict]:
    with ExitStack() as resources:
        red, nir, qa = [resources.enter_context(resources.enter_context(MemoryFile(payloads[band])).open())
                        for band in BANDS]
        grid = (red.crs, red.transform, red.width, red.height)
        if red.res != (30.0, 30.0) or not red.crs.is_projected or any(
            (dataset.crs, dataset.transform, dataset.width, dataset.height) != grid for dataset in (nir, qa)
        ):
            raise SystemExit("Las bandas HLS no comparten la misma malla proyectada de 30 m.")
        polygon = transform_geom("EPSG:4326", red.crs, geometry)
        window = make_window(red, polygon)
        transform = red.window_transform(window)
        ndvi, valid, method = get_ndvi(red, nir, qa, window)
        inside = geometry_mask([polygon], out_shape=ndvi.shape, transform=transform, invert=True)
        sample = ndvi[inside & valid]
        if not sample.size:
            raise SystemExit("La máscara de calidad dejó la parcela sin píxeles válidos.")

        total = int(inside.sum())
        coverage = {"valid_pixels": int(sample.size), "total_pixels": total,
                    "fraction": round(sample.size / total, 6)}
        index = {name: round(float(statistic(sample)), 4)
                 for name, statistic in (("min", np.min), ("median", np.median), ("max", np.max))}
        window_meta = {
            "crs": red.crs.to_string(), "columns": int(window.width), "rows": int(window.height),
            "column_offset": int(window.col_off), "row_offset": int(window.row_off),
        }
        method.update(mask_breakdown={reason: int((inside & rejected).sum())
                                      for reason, rejected in method.pop("mask").items()}, window=window_meta)
        return paint(ndvi, valid, polygon, transform), coverage, index, method


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--out", type=Path, default=ROOT / "frontend" / "public" / "hls")
    output = parser.parse_args().out
    item = json.loads(get_bytes(ITEM))
    if item["id"] != GRANULE or item["collection"] != COLLECTION:
        raise SystemExit("La respuesta STAC no corresponde al gránulo HLS esperado.")
    assets, payloads = download_assets(item)
    retrieved_at = datetime.now(UTC).isoformat(timespec="seconds")
    image, coverage, ndvi, method = render(payloads, seed_context()["parcel"]["geometry"])
    details = {
        "granule_id": GRANULE, "product": "HLSL30", "version": "2.0",
        "acquired_at": item["properties"]["datetime"], "retrieved_at": retrieved_at,
        "platform": "Landsat 9", "resolution_m": 30,
        "source_url": SOURCE, "item_url": ITEM, "mask_source_url": QA_GUIDE,
        "mask_method": "Fmask de HLS v2.0. Se excluyen nubes, adyacencia, sombra, nieve o hielo, agua y aerosol alto, además de datos ausentes o con NDVI inválido.",
        "ndvi_method": "(B05 − B04) / (B05 + B04) a partir de reflectancia de superficie.",
        "evidence_tier": "derived", "coverage": coverage, "ndvi": ndvi, "legend": LEGEND,
        "parcel_geometry_kind": "synthetic",
        "count_method": "Centros de píxel dentro del polígono sintético; cobertura espacial de una escena.",
        "image_url": f"/hls/{IMAGE_NAME}", "image_width": image.width, "image_height": image.height,
        **method,
        "assets": {band: {"url": assets[band], "sha256": sha256(payloads[band]).hexdigest()} for band in BANDS},
    }
    output.mkdir(parents=True, exist_ok=True)
    image.save(output / IMAGE_NAME, optimize=True)
    (output / "scene.json").write_text(json.dumps(details, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"{GRANULE}: {coverage['valid_pixels']}/{coverage['total_pixels']} píxeles válidos; NDVI mediano {ndvi['median']}.")


if __name__ == "__main__":
    main()
