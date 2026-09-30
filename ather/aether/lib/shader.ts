export const VERT = /* glsl */ `
attribute vec2 aPos;
void main() {
  gl_Position = vec4(aPos, 0.0, 1.0);
}
`;

export const FRAG = /* glsl */ `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif

uniform vec2  uRes;
uniform float uTime;
uniform vec2  uMouse;
uniform float uMouseOn;

uniform vec3  uC0;
uniform vec3  uC1;
uniform vec3  uC2;
uniform vec3  uC3;
uniform vec3  uC4;

uniform float uChaos;
uniform float uWarp;
uniform float uGlow;
uniform float uZoom;
uniform float uSpeed;
uniform float uGrain;
uniform float uVignette;
uniform float uSwirl;
uniform float uRidge;

const float TAU = 6.28318530718;

/* --- simplex noise (Ashima / Gustavson, 2D) ------------------------------- */
vec3 permute(vec3 x) { return mod(((x * 34.0) + 1.0) * x, 289.0); }

float snoise(vec2 v) {
  const vec4 C = vec4(0.211324865405187, 0.366025403784439,
                     -0.577350269189626, 0.024390243902439);
  vec2 i  = floor(v + dot(v, C.yy));
  vec2 x0 = v - i + dot(i, C.xx);
  vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
  vec4 x12 = x0.xyxy + C.xxzz;
  x12.xy -= i1;
  i = mod(i, 289.0);
  vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0));
  vec3 m = max(0.5 - vec3(dot(x0, x0), dot(x12.xy, x12.xy), dot(x12.zw, x12.zw)), 0.0);
  m = m * m; m = m * m;
  vec3 x = 2.0 * fract(p * C.www) - 1.0;
  vec3 h = abs(x) - 0.5;
  vec3 ox = floor(x + 0.5);
  vec3 a0 = x - ox;
  m *= 1.79284291400159 - 0.85373472095314 * (a0 * a0 + h * h);
  vec3 g;
  g.x  = a0.x * x0.x + h.x * x0.y;
  g.yz = a0.yz * x12.xz + h.yz * x12.yw;
  return 130.0 * dot(m, g);
}

float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  mat2 rot = mat2(0.80, 0.60, -0.60, 0.80);
  for (int i = 0; i < 5; i++) {
    v += a * snoise(p);
    p = rot * p * 2.02 + 17.3;
    a *= 0.5;
  }
  return v;
}

/* --- five-stop ramp -------------------------------------------------------- */
vec3 pal(float t) {
  float x = clamp(t, 0.0, 1.0) * 4.0;
  vec3 c = uC0;
  c = mix(c, uC1, clamp(x,        0.0, 1.0));
  c = mix(c, uC2, clamp(x - 1.0,  0.0, 1.0));
  c = mix(c, uC3, clamp(x - 2.0,  0.0, 1.0));
  c = mix(c, uC4, clamp(x - 3.0,  0.0, 1.0));
  return c;
}

float hash21(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

void main() {
  vec2 uv = (gl_FragCoord.xy - 0.5 * uRes) / min(uRes.x, uRes.y);
  float t = uTime * 0.085 * uSpeed;

  vec2 p = uv * uZoom * 1.55;

  /* cursor gravity: the field folds around wherever you are looking */
  vec2 m = (uMouse - 0.5 * uRes) / min(uRes.x, uRes.y);
  float md = length(uv - m);
  float infl = exp(-md * 2.7) * uMouseOn;
  float ang = infl * uSwirl * 1.7 * (0.35 + uChaos);
  float ca = cos(ang), sa = sin(ang);
  p = mat2(ca, -sa, sa, ca) * (p - m * uZoom) + m * uZoom;

  /* domain warping */
  vec2 q = vec2(
    fbm(p + vec2(0.0, t)),
    fbm(p + vec2(5.2, 1.3) - t * 0.82)
  );
  vec2 r = vec2(
    fbm(p + uWarp * q + vec2(1.7, 9.2) + t * 0.34),
    fbm(p + uWarp * q + vec2(8.3, 2.8) - t * 0.27)
  );
  float f = fbm(p + uWarp * r * 0.82);

  float v = 0.5 + 0.85 * f;
  float ridge = 1.0 - abs(f * 1.8);
  float veins = pow(clamp(ridge, 0.0, 1.0), 2.0 + uRidge * 8.0);

  vec3 col = pal(v * 1.15 + 0.035 * t);
  col = mix(col, pal(length(q) * 0.85 + t * 0.14 + 0.1), 0.42);
  col = mix(col, pal(length(r) * 0.65 + 0.22), 0.30);

  col += uGlow * veins * 0.65;
  col += 0.22 * pow(clamp(v, 0.0, 1.0), 5.0);

  /* the field has texture, not just gradient */
  col *= 1.0 + 0.22 * snoise(p * 6.0 + vec2(t * 0.6, -t * 0.4))
             + 0.10 * snoise(p * 15.0 + vec2(-t * 0.3, t * 0.2));

  /* depth: valleys keep the light longer than ridges */
  col *= 0.72 + 0.55 * v;

  /* faint chromatic separation at the edges of the frame */
  float ca2 = 0.0016 * (0.4 + uChaos);
  col.r = mix(col.r, pal(v * 1.15 + ca2).r, 0.5);
  col.b = mix(col.b, pal(v * 1.15 - ca2).b, 0.5);

  /* vignette */
  float vig = 1.0 - uVignette * pow(length(uv) * 0.8, 2.3);
  col *= clamp(vig, 0.0, 1.0);

  /* exposure, film curve */
  col *= 1.15 + uGlow * 0.4;
  col = col / (1.0 + col);
  col = pow(max(col, 0.0), vec3(0.9));

  /* contrast about a mid pivot, then win the colour back */
  col = clamp((col - 0.46) * 1.34 + 0.46, 0.0, 1.0);
  float lum = dot(col, vec3(0.2126, 0.7152, 0.0722));
  col = clamp(mix(vec3(lum), col, 1.18), 0.0, 1.0);

  /* grain */
  col += (hash21(gl_FragCoord.xy + fract(uTime) * 91.7) - 0.5) * uGrain;

  gl_FragColor = vec4(max(col, 0.0), 1.0);
}
`;
