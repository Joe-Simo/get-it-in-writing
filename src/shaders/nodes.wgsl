struct Params { time: f32, nodeCount: f32, motion: f32, selected: f32 }
@group(0) @binding(0) var<uniform> params: Params;
@group(0) @binding(1) var<storage, read> positions: array<vec4f>;
@group(0) @binding(2) var<storage, read> metadata: array<vec4f>;

struct VertexOut {
  @builtin(position) position: vec4f,
  @location(0) local: vec2f,
  @location(1) color: vec3f,
  @location(2) selected: f32,
}

@vertex fn vs_main(@builtin(vertex_index) vertex: u32, @builtin(instance_index) instance: u32) -> VertexOut {
  var corners = array<vec2f, 6>(
    vec2f(-1.0, -1.0), vec2f(1.0, -1.0), vec2f(-1.0, 1.0),
    vec2f(-1.0, 1.0), vec2f(1.0, -1.0), vec2f(1.0, 1.0)
  );
  let nodeMeta = metadata[instance];
  let status = nodeMeta.z;
  let isSource = nodeMeta.w;
  let size = mix(0.022, 0.046, clamp(nodeMeta.y, 0.0, 1.0)) + isSource * 0.009;
  let local = corners[vertex];
  var out: VertexOut;
  out.position = vec4f(positions[instance].xy + local * size, 0.0, 1.0);
  out.local = local;
  out.color = select(
    select(vec3f(1.0, 0.43, 0.34), vec3f(0.77, 1.0, 0.29), status < 0.5),
    vec3f(0.56, 0.68, 1.0),
    status > 1.5
  );
  out.selected = select(0.0, 1.0, abs(params.selected - f32(instance)) < 0.25);
  return out;
}

@fragment fn fs_main(input: VertexOut) -> @location(0) vec4f {
  let distance = length(input.local);
  if (distance > 1.0) { discard; }
  let core = 1.0 - smoothstep(0.18, 0.72, distance);
  let halo = 1.0 - smoothstep(0.35, 1.0, distance);
  let ring = smoothstep(0.78, 0.9, distance) * (1.0 - smoothstep(0.9, 1.0, distance));
  let color = input.color * (core * 1.35 + halo * 0.48 + ring * input.selected * 1.8);
  return vec4f(color, max(core, halo * 0.62));
}
