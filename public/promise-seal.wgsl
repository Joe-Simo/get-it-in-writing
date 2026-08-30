struct Params {
  time: f32,
  motion: f32,
  aspect: f32,
  intensity: f32,
}

@group(0) @binding(0) var<uniform> params: Params;

fn ring(distance: f32, radius: f32, width: f32) -> f32 {
  return 1.0 - smoothstep(width, width + 0.006, abs(distance - radius));
}

@fragment
fn fs_main(@location(0) uv: vec2f) -> @location(0) vec4f {
  let centered = (uv - vec2f(0.5, 0.5)) * vec2f(params.aspect, 1.0);
  let distance = length(centered);
  let angle = atan2(centered.y, centered.x);
  let drift = sin(angle * 7.0 + params.time * 0.22 * params.motion) * 0.007;
  let outer = ring(distance, 0.31 + drift, 0.0025);
  let middle = ring(distance, 0.245 - drift * 0.6, 0.0018);
  let inner = ring(distance, 0.12 + drift * 0.35, 0.0022);
  let ticks = smoothstep(0.84, 1.0, sin(angle * 24.0)) * ring(distance, 0.28, 0.006);
  let diagonal = 1.0 - smoothstep(0.007, 0.013, abs(centered.x * 0.62 + centered.y));
  let nib = diagonal * smoothstep(0.2, 0.04, distance) * 0.72;
  let alpha = clamp((outer + middle * 0.56 + inner * 0.76 + ticks * 0.32 + nib) * params.intensity, 0.0, 0.82);
  let cobalt = vec3f(0.141, 0.298, 1.0);
  let ink = vec3f(0.063, 0.082, 0.067);
  let color = mix(ink, cobalt, smoothstep(0.12, 0.34, distance));
  return vec4f(color * alpha, alpha);
}
