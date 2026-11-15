import { useEffect, useRef, useState } from "react";
import "./Globe.css";

export type GlobeSite = { id: string; name: string; lat: number; lon: number };

type GlobeProps = {
  sites: readonly GlobeSite[];
  selected?: string | null;
  onSelect: (id: string) => void;
  onFocused: (id: string) => void;
};

type View = { lat: number; lon: number; zoom: number };
type Frame = View & { width: number; height: number };
type Axes = { right: number[]; up: number[]; front: number[] };
type Renderer = {
  resize: (width: number, height: number) => void;
  draw: (frame: Frame) => void;
  load: (image: HTMLImageElement) => void;
  close: () => void;
};

const toRadians = Math.PI / 180;
const initialView: View = { lat: 19 * toRadians, lon: -78 * toRadians, zoom: 1 };
const limit = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
const wrap = (angle: number) => Math.atan2(Math.sin(angle), Math.cos(angle));
const radius = (frame: Frame) => Math.min(frame.width, frame.height) * 0.45 * frame.zoom;
const polarLimit = 76 * toRadians;

function axes(lat: number, lon: number): Axes {
  const sn = Math.sin(lon);
  const cn = Math.cos(lon);
  const st = Math.sin(lat);
  const ct = Math.cos(lat);
  return { right: [cn, 0, -sn], up: [-st * sn, ct, -st * cn], front: [ct * sn, st, ct * cn] };
}

const vertexShader = `
attribute vec2 a_position;
void main() { gl_Position = vec4(a_position, 0.0, 1.0); }
`;

const fragmentShader = `
precision highp float;
uniform vec2 u_size;
uniform float u_radius;
uniform vec3 u_right, u_up, u_front;
uniform float u_ready;
uniform sampler2D u_earth;
void main() {
  vec2 p = (gl_FragCoord.xy - u_size * 0.5) / u_radius;
  float r = length(p);
  if (r > 1.11) discard;
  if (r > 1.0) {
    float halo = .3 * exp(-42.0 * (r - 1.0)) * (1.0 - smoothstep(1.06, 1.11, r));
    gl_FragColor = vec4(.2, .67, .96, halo);
    return;
  }
  float z = sqrt(max(0.0, 1.0 - dot(p, p)));
  vec3 n = vec3(p, z);
  vec3 v = u_right * p.x + u_up * p.y + u_front * z;
  vec2 uv = vec2(atan(v.x, v.z) * .15915494 + .5, .5 - asin(clamp(v.y, -1., 1.)) * .31830989);
  vec3 color = mix(vec3(.045, .18, .27), texture2D(u_earth, uv).rgb, u_ready);
  float light = clamp(dot(n, normalize(vec3(-.46, .62, .85))) * .75 + .45, .26, 1.0);
  float sky = pow(1.0 - z, 3.6);
  color = color * light + sky * vec3(.08, .22, .36);
  gl_FragColor = vec4(color, 1.0 - smoothstep(1.0 - 1.3 / u_radius, 1.0, r));
}
`;

function compile(gl: WebGLRenderingContext, kind: number, source: string): WebGLShader | null {
  const shader = gl.createShader(kind);
  if (!shader) return null;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (gl.getShaderParameter(shader, gl.COMPILE_STATUS)) return shader;
  gl.deleteShader(shader);
  return null;
}

function webGlRenderer(canvas: HTMLCanvasElement): Renderer | null {
  const gl = canvas.getContext("webgl", { alpha: true, premultipliedAlpha: false, antialias: false });
  if (!gl) return null;
  const vertex = compile(gl, gl.VERTEX_SHADER, vertexShader);
  const fragment = compile(gl, gl.FRAGMENT_SHADER, fragmentShader);
  const program = gl.createProgram();
  if (!vertex || !fragment || !program) return null;
  gl.attachShader(program, vertex);
  gl.attachShader(program, fragment);
  gl.linkProgram(program);
  gl.deleteShader(vertex);
  gl.deleteShader(fragment);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    gl.deleteProgram(program);
    return null;
  }

  gl.useProgram(program);
  const buffer = gl.createBuffer();
  const texture = gl.createTexture();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const attribute = gl.getAttribLocation(program, "a_position");
  gl.enableVertexAttribArray(attribute);
  gl.vertexAttribPointer(attribute, 2, gl.FLOAT, false, 0, 0);
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([0, 0, 0, 255]));
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

  const size = gl.getUniformLocation(program, "u_size");
  const disc = gl.getUniformLocation(program, "u_radius");
  const right = gl.getUniformLocation(program, "u_right");
  const up = gl.getUniformLocation(program, "u_up");
  const front = gl.getUniformLocation(program, "u_front");
  const ready = gl.getUniformLocation(program, "u_ready");
  return {
    resize(width, height) {
      const dpr = Math.min(window.devicePixelRatio || 1, 1.6);
      canvas.width = Math.max(1, Math.round(width * dpr));
      canvas.height = Math.max(1, Math.round(height * dpr));
      gl.viewport(0, 0, canvas.width, canvas.height);
    },
    draw(frame) {
      const basis = axes(frame.lat, frame.lon);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.uniform2f(size, canvas.width, canvas.height);
      gl.uniform1f(disc, radius(frame) * canvas.width / frame.width);
      gl.uniform3fv(right, basis.right);
      gl.uniform3fv(up, basis.up);
      gl.uniform3fv(front, basis.front);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    },
    load(image) {
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
      gl.uniform1f(ready, 1);
    },
    close() {
      gl.deleteTexture(texture);
      gl.deleteBuffer(buffer);
      gl.deleteProgram(program);
    },
  };
}

function canvasRenderer(canvas: HTMLCanvasElement): Renderer | null {
  const context = canvas.getContext("2d");
  if (!context) return null;
  let colorMap: ImageData | undefined;
  let pixels = context.createImageData(1, 1);
  let lastDraw = -Infinity;
  return {
    resize(width, height) {
      const ratio = Math.min(1, 580 / Math.max(width, height));
      canvas.width = Math.max(1, Math.round(width * ratio));
      canvas.height = Math.max(1, Math.round(height * ratio));
      pixels = context.createImageData(canvas.width, canvas.height);
      lastDraw = -Infinity;
    },
    load(image) {
      const sample = document.createElement("canvas");
      sample.width = image.naturalWidth;
      sample.height = image.naturalHeight;
      const source = sample.getContext("2d", { willReadFrequently: true });
      source?.drawImage(image, 0, 0);
      colorMap = source?.getImageData(0, 0, sample.width, sample.height);
      lastDraw = -Infinity;
    },
    draw(frame) {
      const now = performance.now();
      if (now - lastDraw < 33) return;
      lastDraw = now;
      const { height, width } = canvas;
      const centerX = width * 0.5;
      const centerY = height * 0.5;
      const span = radius(frame) * width / frame.width;
      const { right, up, front } = axes(frame.lat, frame.lon);
      const data = pixels.data;
      data.fill(0);
      const texture = colorMap?.data;
      const textureWidth = colorMap?.width ?? 1;
      const textureHeight = colorMap?.height ?? 1;
      for (let row = Math.max(0, Math.floor(centerY - span)); row < Math.min(height, Math.ceil(centerY + span)); row++) {
        const y = (centerY - row - 0.5) / span;
        if (Math.abs(y) >= 1) continue;
        const rowRadius = Math.sqrt(1 - y * y) * span;
        const deltaX = up[0] * y;
        const deltaY = up[1] * y;
        const deltaZ = up[2] * y;
        for (let col = Math.max(0, Math.floor(centerX - rowRadius)); col < Math.min(width, Math.ceil(centerX + rowRadius)); col++) {
          const x = (col + 0.5 - centerX) / span;
          const zSquared = 1 - x * x - y * y;
          if (zSquared <= 0) continue;
          const z = Math.sqrt(zSquared);
          const latitude = Math.asin(limit(deltaY + front[1] * z, -1, 1));
          const longitude = Math.atan2(deltaX + right[0] * x + front[0] * z, deltaZ + right[2] * x + front[2] * z);
          const sx = Math.min(textureWidth - 1, Math.floor((longitude / (Math.PI * 2) + 0.5) * textureWidth));
          const sy = Math.min(textureHeight - 1, Math.floor((0.5 - latitude / Math.PI) * textureHeight));
          const offset = (sy * textureWidth + sx) * 4;
          const i = (row * width + col) * 4;
          const light = limit((-0.46 * x + 0.62 * y + 0.85 * z) * 0.65 + 0.46, 0.26, 1);
          const sky = Math.pow(1 - z, 3.6);
          data[i] = (texture?.[offset] ?? 12) * light + sky * 20;
          data[i + 1] = (texture?.[offset + 1] ?? 45) * light + sky * 56;
          data[i + 2] = (texture?.[offset + 2] ?? 67) * light + sky * 92;
          data[i + 3] = Math.min(255, Math.round(zSquared * span * 255));
        }
      }
      context.putImageData(pixels, 0, 0);
    },
    close() {},
  };
}

function placeMarkers(markers: Map<string, HTMLButtonElement>, sites: readonly GlobeSite[], frame: Frame) {
  const span = radius(frame);
  const visible = sites.flatMap((site) => {
    const marker = markers.get(site.id);
    if (!marker) return [];
    const latitude = site.lat * toRadians;
    const delta = site.lon * toRadians - frame.lon;
    const x = Math.cos(latitude) * Math.sin(delta);
    const y = Math.cos(frame.lat) * Math.sin(latitude) - Math.sin(frame.lat) * Math.cos(latitude) * Math.cos(delta);
    const depth = Math.sin(frame.lat) * Math.sin(latitude) + Math.cos(frame.lat) * Math.cos(latitude) * Math.cos(delta);
    const screenX = frame.width / 2 + x * span;
    const screenY = frame.height / 2 - y * span;
    marker.hidden = depth < 0.22 || screenX < 16 || screenX > frame.width - 16 || screenY < 15 || screenY > frame.height - 15;
    if (marker.hidden) return [];
    marker.style.setProperty("--pin-x", `${screenX.toFixed(1)}px`);
    marker.style.setProperty("--pin-y", `${screenY.toFixed(1)}px`);
    return [{ marker, x: screenX, y: screenY }];
  });
  for (const point of visible) {
    const nearby = visible.find((next) => point !== next && Math.abs(point.x - next.x) < 35 && Math.abs(point.y - next.y) < 22);
    point.marker.dataset.side = nearby ? (point.x < nearby.x ? "left" : "right")
      : point.x > frame.width - 108 ? "left" : "right";
  }
}

export function Globe({ sites, selected, onSelect, onFocused }: GlobeProps) {
  const surface = useRef<HTMLDivElement>(null);
  const markers = useRef(new Map<string, HTMLButtonElement>());
  const callbacks = useRef({ sites, selected, onFocused });
  const pose = useRef<View>({ ...initialView });
  const pointer = useRef<{ id: number; x: number; y: number } | null>(null);
  const focusMarker = useRef(false);
  const reduced = useRef(window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  const [spinning, setSpinning] = useState(!reduced.current);
  const spinState = useRef(spinning);

  useEffect(() => { callbacks.current = { sites, selected, onFocused }; }, [sites, selected, onFocused]);
  useEffect(() => { spinState.current = spinning; }, [spinning]);
  useEffect(() => {
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    function changed(event: MediaQueryListEvent) {
      reduced.current = event.matches;
      if (event.matches) setSpinning(false);
    }
    preference.addEventListener("change", changed);
    return () => preference.removeEventListener("change", changed);
  }, []);

  useEffect(() => {
    const host = surface.current;
    if (!host) return;
    let renderer: Renderer | null;
    let canvas: HTMLCanvasElement;
    let width = 0;
    let height = 0;
    let image: HTMLImageElement | undefined;
    let dirty = true;
    let disposed = false;
    let frameId = 0;
    let lastTime = 0;
    let lastSelected: GlobeProps["selected"];
    let flight: { from: View; to: GlobeSite; started: number; duration: number } | undefined;

    function replaceCanvas(fallback: boolean) {
      renderer?.close();
      canvas?.remove();
      canvas = document.createElement("canvas");
      renderer = fallback ? canvasRenderer(canvas) : webGlRenderer(canvas);
      if (!renderer && !fallback) {
        replaceCanvas(true);
        return;
      }
      host?.append(canvas);
      canvas.addEventListener("webglcontextlost", (event) => {
        event.preventDefault();
        if (!disposed) replaceCanvas(true);
      }, { once: true });
      if (width && height) renderer?.resize(width, height);
      if (image?.complete && image.naturalWidth) renderer?.load(image);
      dirty = true;
    }
    replaceCanvas(false);

    const observer = new ResizeObserver(([entry]) => {
      const measured = entry.contentRect;
      width = measured.width;
      height = measured.height;
      if (width && height) renderer?.resize(width, height);
      dirty = true;
    });
    observer.observe(host);

    image = new Image();
    image.onload = () => {
      if (image) renderer?.load(image);
      dirty = true;
    };
    image.src = "/global/blue-marble.jpg";

    let drawnLat = Infinity;
    let drawnLon = Infinity;
    let drawnZoom = Infinity;
    function tick(time: number) {
      const dt = Math.min(time - lastTime, 48);
      lastTime = time;
      const view = pose.current;
      const { sites: points, selected: targetId, onFocused: arrival } = callbacks.current;
      if (targetId !== lastSelected) {
        lastSelected = targetId;
        const target = points.find((site) => site.id === targetId);
        flight = target ? { from: { ...view }, to: target, started: time, duration: reduced.current ? 0 : 1250 } : undefined;
        if (!target) view.zoom = 1;
      }
      if (flight) {
        const fraction = flight.duration ? Math.min(1, (time - flight.started) / flight.duration) : 1;
        const ease = 1 - (1 - fraction) ** 3;
        view.lat = flight.from.lat + (flight.to.lat * toRadians - flight.from.lat) * ease;
        view.lon = flight.from.lon + wrap(flight.to.lon * toRadians - flight.from.lon) * ease;
        const zoomEase = limit((fraction - 0.16) / 0.84, 0, 1);
        view.zoom = flight.from.zoom + (2.25 - flight.from.zoom) * zoomEase * zoomEase;
        if (fraction === 1) {
          const id = flight.to.id;
          flight = undefined;
          arrival(id);
        }
      } else if (!targetId && !pointer.current && !focusMarker.current && spinState.current) {
        view.lon = wrap(view.lon + dt * 0.000087);
      }
      if (width && height && (dirty || drawnLat !== view.lat || drawnLon !== view.lon || drawnZoom !== view.zoom)) {
        const frame = { ...view, width, height };
        renderer?.draw(frame);
        placeMarkers(markers.current, points, frame);
        drawnLat = view.lat;
        drawnLon = view.lon;
        drawnZoom = view.zoom;
        dirty = false;
      }
      frameId = requestAnimationFrame(tick);
    }
    frameId = requestAnimationFrame(tick);
    return () => {
      disposed = true;
      cancelAnimationFrame(frameId);
      observer.disconnect();
      if (image) image.onload = null;
      renderer?.close();
      host.replaceChildren();
    };
  }, []);

  return <div className="world-globe">
    <div className="world-globe-surface" ref={surface} tabIndex={0} role="group"
      aria-label="Globo terrestre. Usa las flechas o arrastra para girarlo."
      onKeyDown={(event) => {
        if (selected) return;
        const view = pose.current;
        if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
          view.lon = wrap(view.lon + (event.key === "ArrowLeft" ? -0.18 : 0.18));
        } else if (event.key === "ArrowUp" || event.key === "ArrowDown") {
          view.lat = limit(view.lat + (event.key === "ArrowUp" ? 0.14 : -0.14), -polarLimit, polarLimit);
        } else return;
        setSpinning(false);
        event.preventDefault();
      }}
      onPointerDown={(event) => {
        if (event.button !== 0 || selected) return;
        pointer.current = { id: event.pointerId, x: event.clientX, y: event.clientY };
        event.currentTarget.setPointerCapture(event.pointerId);
      }}
      onPointerMove={(event) => {
        const drag = pointer.current;
        if (drag?.id !== event.pointerId) return;
        const view = pose.current;
        view.lon = wrap(view.lon - (event.clientX - drag.x) * 0.007);
        view.lat = limit(view.lat + (event.clientY - drag.y) * 0.007, -polarLimit, polarLimit);
        drag.x = event.clientX;
        drag.y = event.clientY;
      }}
      onLostPointerCapture={() => { pointer.current = null; }}
    />
    <div className="world-globe-markers">
      {sites.map((site) => <button key={site.id} className="world-globe-marker"
        aria-label={`Abrir parcela de ${site.name}`} aria-pressed={selected === site.id}
        ref={(button) => {
          if (button) markers.current.set(site.id, button);
          else markers.current.delete(site.id);
        }}
        type="button" hidden
        onClick={() => onSelect(site.id)}
        onFocus={() => { focusMarker.current = true; }}
        onBlur={() => { focusMarker.current = false; }}
      ><span className="world-globe-dot" aria-hidden="true" /><span className="world-globe-label">{site.name}</span></button>)}
    </div>
    <button className="world-globe-motion" type="button" aria-pressed={spinning} disabled={Boolean(selected)}
      onClick={() => setSpinning((value) => !value)}>
      <span className={spinning ? "world-globe-pause" : "world-globe-play"} aria-hidden="true" />
      {spinning ? "Pausar giro" : "Girar globo"}
    </button>
  </div>;
}
