precision highp float;

uniform sampler2D uTexture;
uniform vec2 uResolution;
uniform float uTime;
uniform vec2 uCenter;
uniform float uRadius;
uniform float uThickness;
uniform float uStrength;

void main() {
    vec2 uv = gl_FragCoord.xy / uResolution;

    // direction from pixel to center
    vec2 dir = uv - uCenter;
    float dist = length(dir);

    // shockwave ring
    float ring = smoothstep(uRadius - uThickness, uRadius, dist) *
                 (1.0 - smoothstep(uRadius, uRadius + uThickness, dist));

    // distortion amount
    float distortion = ring * uStrength;

    // warp UV outward
    uv += normalize(dir) * distortion;

    gl_FragColor = texture2D(uTexture, uv);
}
