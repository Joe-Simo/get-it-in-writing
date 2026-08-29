struct Params { time: f32, edgeCount: f32, nodeCount: f32, selected: f32 }
@group(0) @binding(0) var<uniform> params: Params;
@group(0) @binding(1) var<storage, read> positions: array<vec4f>;
@group(0) @binding(2) var<storage, read> edgeData: array<vec4u>;

fn segmentDistance(point: vec2f, start: vec2f, end: vec2f) -> f32 {
  let segment = end - start;
  let projection = clamp(dot(point - start, segment) / max(dot(segment, segment), 0.0001), 0.0, 1.0);
  return length(point - (start + projection * segment));
}

@fragment fn fs_main(@location(0) uv: vec2f) -> @location(0) vec4f {
  let point = uv * 2.0 - 1.0;
  let gridA = smoothstep(0.985, 1.0, cos(point.x * 42.0) * cos(point.y * 42.0));
  var color = vec3f(0.032, 0.042, 0.037) + gridA * vec3f(0.018, 0.025, 0.02);
  var glow = 0.0;
  for (var index = 0u; index < 64u; index += 1u) {
    if (index >= u32(params.edgeCount)) { break; }
    let edge = edgeData[index];
    if (edge.x >= u32(params.nodeCount) || edge.y >= u32(params.nodeCount)) { continue; }
    let distance = segmentDistance(point, positions[edge.x].xy, positions[edge.y].xy);
    let pulse = 0.72 + 0.28 * sin(params.time * 0.7 + f32(index));
    glow += exp(-distance * 185.0) * 0.22 * pulse;
  }
  color += vec3f(0.53, 0.78, 0.34) * glow;
  let vignette = 1.0 - smoothstep(0.55, 1.35, length(point));
  return vec4f(color * (0.72 + 0.28 * vignette), 1.0);
}
