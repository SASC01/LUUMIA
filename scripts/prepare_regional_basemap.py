"""Descarga la línea de costa de NASA GIBS para el encuadre regional de Don Tino."""

from pathlib import Path
from urllib.parse import urlencode
from urllib.request import urlopen


ROOT = Path(__file__).resolve().parents[1]
WMS = "https://gibs.earthdata.nasa.gov/wms/epsg4326/best/wms.cgi"
PARAMETERS = {
    "service": "WMS", "request": "GetMap", "version": "1.1.1", "layers": "Coastlines_15m",
    "styles": "", "srs": "EPSG:4326", "bbox": "-92,17.5,-87.5,22", "width": 512, "height": 512,
    "format": "image/png", "transparent": "TRUE",
}


def main() -> None:
    url = f"{WMS}?{urlencode(PARAMETERS)}"
    with urlopen(url, timeout=30) as response:
        image = response.read()
    if not image.startswith(b"\x89PNG\r\n\x1a\n"):
        raise SystemExit("NASA GIBS no devolvió un PNG de línea de costa.")
    output = ROOT / "frontend/public/regional/coastline.png"
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_bytes(image)
    print(f"Línea de costa verificada: {url}")


if __name__ == "__main__":
    main()
