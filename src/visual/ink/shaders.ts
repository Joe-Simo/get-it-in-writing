// The ink stage: a small pressure-projected flow field that carries a
// monochrome wash density, emitted from a rasterized word mask. The solver
// borrows standard semi-Lagrangian fluid mathematics; the emission model,
// buoyancy, breeze, palette, granulation, and compositing are this product's
// own. Sizes are compile-time constants shared between WGSL and TypeScript.

export const FLOW_SIZE = [160, 90] as const;
export const WASH_SIZE = [480, 270] as const;

const common = /* wgsl */ `
struct Drive {
  step: u32,
  pointer_active: f32,
  pointer_from: vec2f,
  pointer_to: vec2f,
  pointer_velocity: vec2f,
  emit: f32,
  breeze: f32,
}

const FLOW_SIZE = vec2u(${FLOW_SIZE[0]}, ${FLOW_SIZE[1]});
const WASH_SIZE = vec2u(${WASH_SIZE[0]}, ${WASH_SIZE[1]});

fn index_of(p: vec2i, size: vec2u) -> u32 {
  let q = clamp(p, vec2i(0), vec2i(size) - 1);
  return u32(q.y) * size.x + u32(q.x);
}

fn cell_uv(p: vec2i, size: vec2u) -> vec2f {
  return (vec2f(p) + 0.5) / vec2f(size);
}

fn stroke_weight(p: vec2f, a: vec2f, b: vec2f, radius_squared: f32, aspect: f32) -> f32 {
  let scale = vec2f(aspect, 1.0);
  let point = p * scale;
  let origin = a * scale;
  let delta = (b - a) * scale;
  let t = clamp(dot(point - origin, delta) / max(dot(delta, delta), 1e-7), 0.0, 1.0);
  let d = point - (origin + t * delta);
  return exp(-dot(d, d) / radius_squared);
}
`;

export const flowShader = /* wgsl */ `
${common}
@group(0) @binding(0) var<uniform> drive: Drive;
@group(0) @binding(1) var<storage, read> src: array<vec2f>;
@group(0) @binding(2) var<storage, read> wash: array<f32>;
@group(0) @binding(3) var<storage, read_write> dst: array<vec2f>;

fn sample_flow(p: vec2f) -> vec2f {
  let coord = clamp(p * vec2f(FLOW_SIZE) - 0.5, vec2f(0), vec2f(FLOW_SIZE) - 1.0);
  let cell = vec2i(floor(coord));
  let f = fract(coord);
  let bottom = mix(src[index_of(cell, FLOW_SIZE)], src[index_of(cell + vec2i(1, 0), FLOW_SIZE)], f.x);
  let top = mix(src[index_of(cell + vec2i(0, 1), FLOW_SIZE)], src[index_of(cell + vec2i(1, 1), FLOW_SIZE)], f.x);
  return mix(bottom, top, f.y);
}

fn sample_wash(p: vec2f) -> f32 {
  let coord = clamp(p * vec2f(WASH_SIZE) - 0.5, vec2f(0), vec2f(WASH_SIZE) - 1.0);
  let cell = vec2i(floor(coord));
  return wash[index_of(cell, WASH_SIZE)];
}

@compute @workgroup_size(8, 8)
fn main(@builtin(global_invocation_id) id: vec3u) {
  if (any(id.xy >= FLOW_SIZE)) { return; }
  let cell = vec2i(id.xy);
  let p = cell_uv(cell, FLOW_SIZE);
  let aspect = f32(FLOW_SIZE.x) / f32(FLOW_SIZE.y);
  let dt = 1.0 / 60.0;
  let here = src[index_of(cell, FLOW_SIZE)];
  let backtrace = clamp(p - dt * here, 0.5 / vec2f(FLOW_SIZE), 1.0 - 0.5 / vec2f(FLOW_SIZE));
  var velocity = 0.985 * sample_flow(backtrace);

  // Ink is lighter than the page: dense wash rises and drifts slightly aside.
  let density = sample_wash(p);
  velocity.y += dt * 0.5 * density;
  velocity.x += dt * 0.14 * density * sin(f32(drive.step) * 0.008 + p.y * 6.2);

  // A slow ambient breeze keeps the field alive without visible emitters.
  let t = f32(drive.step) / 60.0;
  let wind = vec2f(
    sin(0.29 * t + p.y * 4.6),
    0.55 * sin(0.21 * t + p.x * 3.8 + 1.7),
  );
  velocity += dt * drive.breeze * 0.35 * wind;

  if (drive.pointer_active > 0.0) {
    let weight = stroke_weight(p, drive.pointer_from, drive.pointer_to, 0.0035, aspect);
    velocity += weight * drive.pointer_velocity * 0.55;
  }

  let speed = length(velocity);
  if (speed > 2.0) { velocity *= 2.0 / speed; }
  dst[index_of(cell, FLOW_SIZE)] = velocity;
}
`;

export const curlShader = /* wgsl */ `
${common}
@group(0) @binding(0) var<storage, read> velocity: array<vec2f>;
@group(0) @binding(1) var<storage, read_write> curl: array<f32>;

@compute @workgroup_size(8, 8)
fn main(@builtin(global_invocation_id) id: vec3u) {
  if (any(id.xy >= FLOW_SIZE)) { return; }
  let p = vec2i(id.xy);
  let left = velocity[index_of(p - vec2i(1, 0), FLOW_SIZE)].y;
  let right = velocity[index_of(p + vec2i(1, 0), FLOW_SIZE)].y;
  let top = velocity[index_of(p + vec2i(0, 1), FLOW_SIZE)].x;
  let bottom = velocity[index_of(p - vec2i(0, 1), FLOW_SIZE)].x;
  curl[index_of(p, FLOW_SIZE)] = 0.5 * (right - left - top + bottom);
}
`;

export const confineShader = /* wgsl */ `
${common}
@group(0) @binding(0) var<storage, read> src: array<vec2f>;
@group(0) @binding(1) var<storage, read> curl: array<f32>;
@group(0) @binding(2) var<storage, read_write> dst: array<vec2f>;

@compute @workgroup_size(8, 8)
fn main(@builtin(global_invocation_id) id: vec3u) {
  if (any(id.xy >= FLOW_SIZE)) { return; }
  let p = vec2i(id.xy);
  let left = abs(curl[index_of(p - vec2i(1, 0), FLOW_SIZE)]);
  let right = abs(curl[index_of(p + vec2i(1, 0), FLOW_SIZE)]);
  let top = abs(curl[index_of(p + vec2i(0, 1), FLOW_SIZE)]);
  let bottom = abs(curl[index_of(p - vec2i(0, 1), FLOW_SIZE)]);
  let center = curl[index_of(p, FLOW_SIZE)];

  var force = 0.5 * vec2f(top - bottom, right - left);
  force /= length(force) + 0.0001;
  force *= 13.0 * center;
  force.y *= -1.0;

  var velocity = src[index_of(p, FLOW_SIZE)] + force / 60.0;
  let speed = length(velocity);
  if (speed > 2.0) { velocity *= 2.0 / speed; }
  dst[index_of(p, FLOW_SIZE)] = velocity;
}
`;

export const divergeShader = /* wgsl */ `
${common}
@group(0) @binding(0) var<storage, read> velocity: array<vec2f>;
@group(0) @binding(1) var<storage, read_write> divergence: array<f32>;

@compute @workgroup_size(8, 8)
fn main(@builtin(global_invocation_id) id: vec3u) {
  if (any(id.xy >= FLOW_SIZE)) { return; }
  let p = vec2i(id.xy);
  let last = vec2i(FLOW_SIZE) - 1;
  let l = select(velocity[index_of(p - vec2i(1, 0), FLOW_SIZE)].x, 0.0, p.x == 0);
  let r = select(velocity[index_of(p + vec2i(1, 0), FLOW_SIZE)].x, 0.0, p.x == last.x);
  let b = select(velocity[index_of(p - vec2i(0, 1), FLOW_SIZE)].y, 0.0, p.y == 0);
  let t = select(velocity[index_of(p + vec2i(0, 1), FLOW_SIZE)].y, 0.0, p.y == last.y);
  divergence[index_of(p, FLOW_SIZE)] =
    (r - l) * 0.5 * f32(FLOW_SIZE.x) + (t - b) * 0.5 * f32(FLOW_SIZE.y);
}
`;

export const relaxShader = /* wgsl */ `
${common}
struct RelaxParams {
  decay: f32,
}
@group(0) @binding(0) var<uniform> params: RelaxParams;
@group(0) @binding(1) var<storage, read> src: array<f32>;
@group(0) @binding(2) var<storage, read> divergence: array<f32>;
@group(0) @binding(3) var<storage, read_write> dst: array<f32>;

@compute @workgroup_size(8, 8)
fn main(@builtin(global_invocation_id) id: vec3u) {
  if (any(id.xy >= FLOW_SIZE)) { return; }
  let p = vec2i(id.xy);
  let i = index_of(p, FLOW_SIZE);
  let center = src[i];
  let last = vec2i(FLOW_SIZE) - 1;
  let left = select(src[index_of(p - vec2i(1, 0), FLOW_SIZE)], center, p.x == 0) * params.decay;
  let right = select(src[index_of(p + vec2i(1, 0), FLOW_SIZE)], center, p.x == last.x) * params.decay;
  let bottom = select(src[index_of(p - vec2i(0, 1), FLOW_SIZE)], center, p.y == 0) * params.decay;
  let top = select(src[index_of(p + vec2i(0, 1), FLOW_SIZE)], center, p.y == last.y) * params.decay;
  let wx = f32(FLOW_SIZE.x * FLOW_SIZE.x);
  let wy = f32(FLOW_SIZE.y * FLOW_SIZE.y);
  dst[i] = ((left + right) * wx + (bottom + top) * wy - divergence[i]) / (2.0 * wx + 2.0 * wy);
}
`;

export const projectShader = /* wgsl */ `
${common}
@group(0) @binding(0) var<storage, read> src: array<vec2f>;
@group(0) @binding(1) var<storage, read> pressure: array<f32>;
@group(0) @binding(2) var<storage, read_write> dst: array<vec2f>;

@compute @workgroup_size(8, 8)
fn main(@builtin(global_invocation_id) id: vec3u) {
  if (any(id.xy >= FLOW_SIZE)) { return; }
  let p = vec2i(id.xy);
  let last = vec2i(FLOW_SIZE) - 1;
  let c = pressure[index_of(p, FLOW_SIZE)];
  let l = select(pressure[index_of(p - vec2i(1, 0), FLOW_SIZE)], c, p.x == 0);
  let r = select(pressure[index_of(p + vec2i(1, 0), FLOW_SIZE)], c, p.x == last.x);
  let b = select(pressure[index_of(p - vec2i(0, 1), FLOW_SIZE)], c, p.y == 0);
  let t = select(pressure[index_of(p + vec2i(0, 1), FLOW_SIZE)], c, p.y == last.y);
  var u = src[index_of(p, FLOW_SIZE)] - vec2f(
    (r - l) * 0.5 * f32(FLOW_SIZE.x),
    (t - b) * 0.5 * f32(FLOW_SIZE.y),
  );
  if (p.x == 0 && u.x < 0.0) { u.x = 0.0; }
  if (p.x == last.x && u.x > 0.0) { u.x = 0.0; }
  if (p.y == 0 && u.y < 0.0) { u.y = 0.0; }
  if (p.y == last.y && u.y > 0.0) { u.y = 0.0; }
  let s = length(u);
  if (s > 2.0) { u *= 2.0 / s; }
  dst[index_of(p, FLOW_SIZE)] = u;
}
`;

export const washShader = /* wgsl */ `
${common}
@group(0) @binding(0) var<uniform> drive: Drive;
@group(0) @binding(1) var<storage, read> src: array<f32>;
@group(0) @binding(2) var<storage, read> velocity: array<vec2f>;
@group(0) @binding(3) var<storage, read> mask: array<f32>;
@group(0) @binding(4) var<storage, read_write> dst: array<f32>;

fn sample_wash(p: vec2f) -> f32 {
  let coord = clamp(p * vec2f(WASH_SIZE) - 0.5, vec2f(0), vec2f(WASH_SIZE) - 1.0);
  let cell = vec2i(floor(coord));
  let f = fract(coord);
  let bottom = mix(src[index_of(cell, WASH_SIZE)], src[index_of(cell + vec2i(1, 0), WASH_SIZE)], f.x);
  let top = mix(src[index_of(cell + vec2i(0, 1), WASH_SIZE)], src[index_of(cell + vec2i(1, 1), WASH_SIZE)], f.x);
  return mix(bottom, top, f.y);
}

fn sample_flow(p: vec2f) -> vec2f {
  let coord = clamp(p * vec2f(FLOW_SIZE) - 0.5, vec2f(0), vec2f(FLOW_SIZE) - 1.0);
  let cell = vec2i(floor(coord));
  let f = fract(coord);
  let bottom = mix(velocity[index_of(cell, FLOW_SIZE)], velocity[index_of(cell + vec2i(1, 0), FLOW_SIZE)], f.x);
  let top = mix(velocity[index_of(cell + vec2i(0, 1), FLOW_SIZE)], velocity[index_of(cell + vec2i(1, 1), FLOW_SIZE)], f.x);
  return mix(bottom, top, f.y);
}

@compute @workgroup_size(8, 8)
fn main(@builtin(global_invocation_id) id: vec3u) {
  if (any(id.xy >= WASH_SIZE)) { return; }
  let cell = vec2i(id.xy);
  let i = index_of(cell, WASH_SIZE);
  let p = cell_uv(cell, WASH_SIZE);
  let backtrace = clamp(p - sample_flow(p) / 60.0, 0.5 / vec2f(WASH_SIZE), 1.0 - 0.5 / vec2f(WASH_SIZE));
  var density = 0.988 * sample_wash(backtrace);

  // The word itself is the only emitter. It breathes slowly, phase-shifted
  // along its own width so the bleed travels like a written stroke.
  let breathe = 0.62 + 0.38 * sin(f32(drive.step) * 0.012 + p.x * 9.0);
  density += mask[i] * drive.emit * breathe * 0.045;

  dst[i] = clamp(density, 0.0, 2.2);
}
`;

export const blotShader = /* wgsl */ `
struct BlotConfig {
  output_size: vec2f,
  grain_step: f32,
}
const WASH_SIZE = vec2u(${WASH_SIZE[0]}, ${WASH_SIZE[1]});
@group(0) @binding(0) var<uniform> config: BlotConfig;
@group(0) @binding(1) var<storage, read> wash: array<f32>;

fn index_of(p: vec2i, size: vec2u) -> u32 {
  let q = clamp(p, vec2i(0), vec2i(size) - 1);
  return u32(q.y) * size.x + u32(q.x);
}

fn sample_wash(p: vec2f) -> f32 {
  let grid = clamp(p * vec2f(WASH_SIZE) - 0.5, vec2f(0), vec2f(WASH_SIZE) - 1.0);
  let cell = vec2i(floor(grid));
  let f = fract(grid);
  let bottom = mix(wash[index_of(cell, WASH_SIZE)], wash[index_of(cell + vec2i(1, 0), WASH_SIZE)], f.x);
  let top = mix(wash[index_of(cell + vec2i(0, 1), WASH_SIZE)], wash[index_of(cell + vec2i(1, 1), WASH_SIZE)], f.x);
  return mix(bottom, top, f.y);
}

fn grain(p: vec2f) -> f32 {
  let h = fract(sin(dot(p, vec2f(127.1, 311.7))) * 43758.5453);
  return h;
}

@fragment
fn fs_main(@builtin(position) position: vec4f) -> @location(0) vec4f {
  var uv = position.xy / config.output_size;
  uv.y = 1.0 - uv.y;
  let density = sample_wash(uv);

  // Watercolor rim: pigment collects where the wash thins out.
  let texel = 1.0 / vec2f(WASH_SIZE);
  let gx = sample_wash(uv + vec2f(texel.x, 0.0)) - sample_wash(uv - vec2f(texel.x, 0.0));
  let gy = sample_wash(uv + vec2f(0.0, texel.y)) - sample_wash(uv - vec2f(0.0, texel.y));
  let edge = smoothstep(0.04, 0.34, length(vec2f(gx, gy)));

  // Paper granulation, quantized so it reads as tooth rather than noise.
  let speck = grain(floor(position.xy / 3.0) + floor(config.grain_step) * 0.37);

  var alpha = 1.0 - exp(-density * 0.9);
  alpha = alpha * (0.9 + 0.1 * speck) + edge * 0.05;
  // The wash may never compromise the page: ink text stays readable over it.
  alpha = min(alpha, 0.42);

  let cobalt = vec3f(0.141, 0.298, 1.0);
  let ink = vec3f(0.063, 0.082, 0.067);
  let body = smoothstep(0.12, 1.9, density);
  let color = mix(cobalt, ink, 0.42 * body + 0.22 * edge);
  return vec4f(color * alpha, alpha);
}
`;
