"""Prepara el recorte SMAP del 1 de noviembre de 2026 desde NASA GIBS."""

import argparse
from datetime import UTC, datetime
from hashlib import sha256
import json
from pathlib import Path
from struct import unpack_from
from urllib.parse import quote, urlencode
from urllib.request import urlopen
import xml.etree.ElementTree as ET


GIBS = "https://gibs.earthdata.nasa.gov"
LAYER = "SMAP_L4_Analyzed_Surface_Soil_Moisture"
COLORMAP_URL = f"{GIBS}/colormaps/v1.3/SMAP_Analyzed_Soil_Moisture.xml"
LEGEND_URL = f"{GIBS}/legends/SMAP_Analyzed_Soil_Moisture_H.svg"
METADATA_URL = f"{GIBS}/layer-metadata/v1.0/{LAYER}.json"
DATE = "2026-11-01"
BOUNDS = (-92, 17.5, -87.5, 22)
SIZE = 512
OUTPUT = Path(__file__).resolve().parents[1] / "frontend" / "public" / "regional"


def read(url: str) -> bytes:
    with urlopen(url, timeout=30) as response:
        return response.read()


def get_wms_url() -> str:
    query = urlencode({
        "SERVICE": "WMS", "VERSION": "1.1.1", "REQUEST": "GetMap",
        "LAYERS": LAYER, "STYLES": "", "FORMAT": "image/png", "TRANSPARENT": "TRUE",
        "SRS": "EPSG:4326", "BBOX": ",".join(map(str, BOUNDS)),
        "WIDTH": SIZE, "HEIGHT": SIZE, "TIME": DATE,
    }, safe=",")
    return f"{GIBS}/wms/epsg4326/best/wms.cgi?{query}"


def legend_from_xml(xml: bytes) -> tuple[str, list[dict[str, str]]]:
    soil = ET.fromstring(xml).find("ColorMap[@title='Soil Moisture']")
    if soil is None or soil.get("units") != "m³/m³":
        raise ValueError("La leyenda SMAP no contiene la unidad esperada.")
    scale = soil.find("Legend")
    if scale is None:
        raise ValueError("Falta la escala de humedad en la leyenda de GIBS.")
    entries = scale.findall("LegendEntry")
    selected = [(scale.attrib["minLabel"], entries[0])]
    selected += [(entry.attrib["label"], entry) for entry in entries if entry.get("showLabel") == "true"]
    selected.append((scale.attrib["maxLabel"], entries[-1]))
    result = [{"label": label.replace(".", ","),
               "color": "#" + "".join(f"{int(channel):02x}" for channel in entry.attrib["rgb"].split(","))}
              for label, entry in selected]
    result.append({"label": "Sin datos"})
    return soil.attrib["units"], result


def static_legend(svg: bytes) -> bytes:
    """Conserva el dibujo oficial y retira scripts y capas interactivas."""
    svg_ns = "http://www.w3.org/2000/svg"
    root = ET.fromstring(svg)
    if root.tag != f"{{{svg_ns}}}svg":
        raise ValueError("La leyenda ofrecida por GIBS no es un SVG.")
    for element in root.iter():
        for child in list(element):
            if child.tag.rsplit("}", 1)[-1] in {"script", "metadata"} or child.get("id", "").startswith("tooltip_"):
                element.remove(child)
        for key, value in list(element.attrib.items()):
            attribute = key.rsplit("}", 1)[-1]
            if attribute.lower().startswith("on"):
                del element.attrib[key]
            if attribute == "href" and not value.startswith(("#", "data:image/png;base64,")):
                raise ValueError("Se encontró una referencia externa en la leyenda SMAP.")
    ET.register_namespace("", svg_ns)
    ET.register_namespace("xlink", "http://www.w3.org/1999/xlink")
    return ET.tostring(root, encoding="utf-8", xml_declaration=True)


def prepare(output: Path) -> None:
    request_url = get_wms_url()
    image = read(request_url)
    if not image.startswith(b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR"):
        raise ValueError("NASA GIBS no devolvió un PNG válido para SMAP.")
    width, height = unpack_from(">II", image, 16)
    if (width, height) != (SIZE, SIZE):
        raise ValueError("El mapa SMAP tiene dimensiones distintas a las solicitadas.")

    layer_metadata = json.loads(read(METADATA_URL))
    standard = next(item for item in layer_metadata["conceptIds"] if item["type"] == "STD")
    if (standard["shortName"], standard["version"]) != ("SPL4SMAU", "008"):
        raise ValueError("La colección SMAP cambió. Verifica la versión y la procedencia antes de regenerar la capa.")
    unit, legend = legend_from_xml(read(COLORMAP_URL))
    legend_image = static_legend(read(LEGEND_URL))
    worldview = urlencode({"l": f"{LAYER},Coastlines_15m", "t": f"{DATE}-T12:00:00Z",
                           "v": ",".join(map(str, BOUNDS))}, safe=",", quote_via=quote)
    metadata = {
        "id": "smap",
        "title": "SMAP · Humedad superficial",
        "variable": "Humedad volumétrica del suelo (0–5 cm)",
        "unit": unit,
        "resolution": "9 km",
        "temporal_label": "Análisis instantáneo a las 12:00 UTC (06:00 en Campeche)",
        "date": DATE,
        "retrieved_at": datetime.now(UTC).isoformat(timespec="seconds"),
        "product": "SMAP L4 · SPL4SMAU V008",
        "source_url": "https://nsidc.org/data/spl4smau/versions/8",
        "request_url": request_url,
        "image_url": "/regional/smap.png",
        "image_width": width,
        "image_height": height,
        "bounds": BOUNDS,
        "legend_url": LEGEND_URL,
        "legend_image_url": "/regional/smap-legend.svg",
        "legend_alt": "Escala continua NASA GIBS de humedad del suelo de 0,000 a 0,700 m³/m³ o más, de naranja a gris, con marcas en 0,175, 0,350 y 0,525.",
        "legend": legend,
        "notes": [
            "Análisis de humedad en los 5 cm superficiales. El producto combina observaciones satelitales y un modelo de superficie.",
            "Visualización regional de NASA GIBS. La escala de colores corresponde a la malla original de 9 km y no aporta una lectura puntual de la parcela.",
            "Las zonas transparentes corresponden a ausencia de datos en la visualización.",
        ],
        "grid_label": "EASE-Grid 2.0 · 9 km en el producto de origen",
        "data_kind": "provider_visualization",
        "layer_id": LAYER,
        "metadata_url": METADATA_URL,
        "colormap_url": COLORMAP_URL,
        "worldview_url": f"https://worldview.earthdata.nasa.gov/?{worldview}",
        "citation": "Reichle et al. (2025). SMAP L4 Global 3-hourly 9 km EASE-Grid Surface and Root Zone Soil Moisture Analysis Update, v008. NASA NSIDC DAAC. DOI: 10.5067/02LGW4DGJYRX. Visualización NASA GIBS / ESDIS.",
        "technical_source_url": "https://ntrs.nasa.gov/api/citations/20250006429/downloads/SMAP_L4_SM_PSD_v1-7_for_L4SM_Version_8.pdf",
        "image_sha256": sha256(image).hexdigest(),
    }
    output.mkdir(parents=True, exist_ok=True)
    (output / "smap.png").write_bytes(image)
    (output / "smap-legend.svg").write_bytes(legend_image)
    (output / "smap.json").write_text(json.dumps(metadata, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"{LAYER}: {DATE}, {width}×{height}, SHA-256 {metadata['image_sha256']}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--out", type=Path, default=OUTPUT)
    prepare(parser.parse_args().out)
