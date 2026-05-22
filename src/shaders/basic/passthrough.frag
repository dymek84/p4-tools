precision mediump float;

uniform sampler2D texture;
uniform float time;
uniform vec2 resolution;
uniform float strength;
uniform vec3 tint;

varying vec2 vUv;

void main() {
  vec4 color = texture2D(texture, vUv);
  float wave = sin(time * 1.5 + vUv.x * 12.0 + vUv.y * 8.0) * 0.08 * strength;
  vec3 modulated = color.rgb * (0.94 + wave) * tint;
  gl_FragColor = vec4(modulated, color.a);
}