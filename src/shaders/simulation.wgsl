struct Params { time: f32, nodeCount: f32, motion: f32, selected: f32 }
@group(0) @binding(0) var<uniform> params: Params;
@group(0) @binding(1) var<storage, read_write> positions: array<vec4f>;
@group(0) @binding(2) var<storage, read> metadata: array<vec4f>;

@compute @workgroup_size(64)
fn cs_main(@builtin(global_invocation_id) id: vec3u) {
  if (id.x >= u32(params.nodeCount)) { return; }
  var state = positions[id.x];
  let anchor = metadata[id.x].xy;
  let drift = vec2f(
    sin(params.time * 0.24 + f32(id.x) * 1.7),
    cos(params.time * 0.19 + f32(id.x) * 1.3)
  ) * 0.018 * params.motion;
  let anchorTarget = anchor + drift;
  let nextVelocity = state.zw * 0.91 + (anchorTarget - state.xy) * 0.045;
  let nextPosition = state.xy + nextVelocity;
  positions[id.x] = vec4f(nextPosition, nextVelocity);
}
