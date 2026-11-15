"""Refresh the pinned NASA GIBS IMERG demonstration image and provenance."""

import argparse
import base64
from datetime import UTC, datetime
from hashlib import sha256
import json
from pathlib import Path
import struct
import subprocess
from tempfile import TemporaryDirectory
from urllib.parse import urlencode
from urllib.request import urlopen
from xml.etree import ElementTree


DATE = "2026-11-01"
BOUNDS = (-92, 17.5, -87.5, 22)
SIZE = 512
CENTER = (-89.8415, 19.7418)
LAYER = "IMERG_Precipitation_Rate"
GIBS = "https://gibs.earthdata.nasa.gov"
WMS = f"{GIBS}/wms/epsg4326/best/wms.cgi"
COLOR_MAP = f"{GIBS}/colormaps/v1.3/GPM_Precipitation_Rate.xml"
LEGEND_URL = f"{GIBS}/legends/GPM_Precipitation_Rate_H.svg"
METADATA_URL = (
    "https://github.com/nasa-gibs/worldview/blob/main/config/default/common/config/"
    "metadata/layers/multi-mission/imerg/IMERG_Precipitation_Rate.md"
)


def get_bytes(url: str, content_type: str) -> bytes:
    with urlopen(url, timeout=30) as response:
        if response.headers.get_content_type() != content_type:
            raise RuntimeError(f"NASA GIBS no devolvió {content_type}: {response.url}")
        return response.read()


def parse_legend(xml: bytes) -> list[dict[str, str]]:
    rain_map = ElementTree.fromstring(xml).find("ColorMap[@title='Rain Rate'][@units='mm/hr']")
    if rain_map is None:
        raise ValueError("No se encontró la escala de lluvia de NASA en mm/h.")
    entries = rain_map.findall("Legend/LegendEntry")
    # The display uses selected exact classes and links to the complete NASA legend.
    references = ("2", "29", "42", "54", "69", "82", "111")
    by_id = {entry.attrib["id"]: entry.attrib for entry in entries}
    return [
        {
            "label": by_id[ref]["tooltip"].replace(".", ","),
            "color": "#" + "".join(f"{int(channel):02x}" for channel in by_id[ref]["rgb"].split(",")),
        }
        for ref in references
    ]


def rasterize_legend(chrome: Path) -> bytes:
    legend_svg = base64.b64encode(get_bytes(LEGEND_URL, "image/svg+xml")).decode("ascii")
    with TemporaryDirectory(prefix="luumia-imerg-legend-") as tmp:
        root = Path(tmp)
        page = root / "legend.html"
        screenshot = root / "legend.png"
        page.write_text(
            '<!doctype html><meta charset="utf-8"><style>body{margin:0;background:white}'
            'img{display:block;width:756px;height:351px}</style>'
            f'<img src="data:image/svg+xml;base64,{legend_svg}" alt="">',
            encoding="utf-8",
        )
        # Load as an image (scripts inactive), then save only the raster.
        subprocess.run(
            [
                str(chrome.resolve()), "--headless", "--hide-scrollbars", "--disable-gpu",
                "--force-device-scale-factor=1", "--window-size=756,351",
                f"--user-data-dir={root / 'profile'}", f"--screenshot={screenshot}", page.as_uri(),
            ],
            check=True, timeout=45, capture_output=True,
            creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0),
        )
        return screenshot.read_bytes()


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--chrome", type=Path, help="Chrome/Chromium para regenerar el PNG de la leyenda oficial.")
    args = parser.parse_args()
    west, south, east, north = BOUNDS
    lon, lat = CENTER
    query = urlencode({
        "SERVICE": "WMS", "REQUEST": "GetMap", "VERSION": "1.3.0", "CRS": "EPSG:4326",
        "BBOX": f"{south},{west},{north},{east}", "WIDTH": SIZE, "HEIGHT": SIZE,
        "LAYERS": LAYER, "STYLES": "", "FORMAT": "image/png", "TRANSPARENT": "TRUE", "TIME": DATE,
    })
    request_url = f"{WMS}?{query}"
    image = get_bytes(request_url, "image/png")
    if (image[:8] != b"\x89PNG\r\n\x1a\n" or image[12:16] != b"IHDR"
            or struct.unpack(">II", image[16:24]) != (SIZE, SIZE)):
        raise ValueError("La respuesta no es el PNG regional esperado.")
    legend = parse_legend(get_bytes(COLOR_MAP, "text/xml"))
    manifest = {
        "id": "imerg",
        "title": "Precipitación regional · IMERG",
        "variable": "Tasa de precipitación",
        "unit": "mm/h",
        "resolution": "0,1° × 0,1°",
        "temporal_label": "Visualización diaria UTC",
        "date": DATE,
        "retrieved_at": datetime.now(UTC).isoformat(timespec="seconds"),
        "product": "NASA GPM IMERG V07 · NASA EOSDIS GIBS",
        "source_url": "https://gpm.nasa.gov/data/imerg",
        "metadata_url": METADATA_URL,
        "request_url": request_url,
        "image_url": "/regional/imerg.png",
        "image_width": SIZE,
        "image_height": SIZE,
        "bounds": BOUNDS,
        "legend_url": LEGEND_URL,
        "legend": legend,
        "legend_is_sampled": True,
        "colormap_url": COLOR_MAP,
        "layer_id": LAYER,
        "data_kind": "provider_visualization",
        "marker": {"x_percent": 100 * (lon - west) / (east - west), "y_percent": 100 * (north - lat) / (north - south)},
        "notes": [
            "Imagen diaria del proveedor a partir de estimaciones semihorarias. La escala expresa una tasa en mm/h.",
            "Las áreas transparentes pueden indicar tasas menores a 0,1 mm/h o falta de datos.",
            "Se muestran clases de color de la escala de lluvia. La leyenda oficial incluye todas las clases y la escala de nieve.",
        ],
        "sha256": sha256(image).hexdigest(),
    }
    output = Path(__file__).resolve().parents[1] / "frontend/public/regional"
    output.mkdir(parents=True, exist_ok=True)
    legend_path = output / "imerg-legend.png"
    if args.chrome:
        legend_path.write_bytes(rasterize_legend(args.chrome))
    if legend_path.is_file():
        manifest.update({
            "legend_image_url": "/regional/imerg-legend.png",
            "legend_alt": "Escala oficial NASA GIBS para lluvia y nieve en milímetros por hora, de 0,1 a 53 o más.",
        })
    (output / "imerg.png").write_bytes(image)
    (output / "imerg.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"NASA GIBS IMERG {DATE}, {SIZE}×{SIZE} px, SHA-256 {manifest['sha256']}")


if __name__ == "__main__":
    main()
