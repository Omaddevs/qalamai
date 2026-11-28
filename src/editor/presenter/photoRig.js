// A photo of a real-looking presenter, brought to life in WebGL without any AI model at run time.
//
// The cut-out photo (transparent background) is drawn through a fine mesh. Each frame the mesh is
// bent smoothly — no layers, so no seams or gaps:
//   • head    turns and nods around the neck (weight 1 inside the head ellipse, fading outside)
//   • jaw     the chin and lower lip move down with the voice (the mouth opens)
//   • hand    the raised hand waves around the wrist
//   • body    breathes and sways a little around the feet
// Blinking happens in the fragment shader: inside each eye, the upper lid comes down by showing the
// skin just above the eye. All of it is a pure function of the state, so the video export draws
// exactly what the player shows.

const VS = `
attribute vec2 a_src;
uniform vec2 u_size;      // photo size (px)
uniform vec3 u_pad;       // empty room on the canvas: sides, top, bottom (px)
uniform float u_flip;     // 1 = mirrored (hand towards the left)
uniform vec2 u_neck;
uniform vec4 u_head;      // ellipse cx, cy, rx, ry
uniform float u_headRot, u_nod;
uniform vec4 u_jawE;      // ellipse of the moving chin
uniform float u_jawLine, u_jaw;
uniform vec2 u_wrist;
uniform vec4 u_hand;      // x where the hand region starts, y of full weight, unused, y where it fades out
uniform float u_handRot;
uniform vec2 u_base;
uniform float u_sway, u_breath;
varying vec2 v_src;
vec2 rot(vec2 p, vec2 c, float a) {
  float s = sin(a), k = cos(a);
  p -= c;
  return vec2(p.x * k - p.y * s, p.x * s + p.y * k) + c;
}
void main() {
  vec2 p = a_src;
  vec2 q = p;
  float wh = (1.0 - smoothstep(1.0, 1.4, length((p - u_head.xy) / u_head.zw))) * (1.0 - smoothstep(u_neck.y - 6.0, u_neck.y + 16.0, p.y));
  q += (rot(p, u_neck, u_headRot) - p) * wh + vec2(0.0, u_nod) * wh;
  float wj = (1.0 - smoothstep(0.55, 1.0, length((p - u_jawE.xy) / u_jawE.zw))) * smoothstep(u_jawLine - 1.0, u_jawLine + 5.0, p.y);
  q.y += u_jaw * wj;
  if (u_hand.x > 0.0) {
    float wa = smoothstep(u_hand.x - 12.0, u_hand.x + 6.0, p.x) * (1.0 - smoothstep(u_hand.y, u_hand.w, p.y));
    q += (rot(p, u_wrist, u_handRot) - p) * wa;
  }
  q = rot(q, u_base, u_sway);
  q.y = u_base.y + (q.y - u_base.y) * (1.0 + u_breath);
  vec2 full = u_size + vec2(u_pad.x * 2.0, u_pad.y + u_pad.z);
  vec2 c = (q + u_pad.xy) / full * 2.0 - 1.0;
  c.y = -c.y;
  if (u_flip > 0.5) c.x = -c.x;
  gl_Position = vec4(c, 0.0, 1.0);
  v_src = p;
}`

const FS = `
precision highp float;
uniform sampler2D u_tex;
uniform vec2 u_size;
uniform vec4 u_eyeL, u_eyeR; // cx, cy, rx, ry
uniform float u_blink;       // 0 open … 1 closed
varying vec2 v_src;
vec2 lid(vec2 s, vec4 e) {
  vec2 d = (s - e.xy) / e.zw;
  if (dot(d, d) < 1.0) {
    float top = e.y - e.w;
    if (s.y < top + u_blink * 2.0 * e.w) return vec2(s.x, top - 2.5 - (top - s.y) * 0.15);
  }
  return s;
}
void main() {
  vec2 s = v_src;
  if (u_blink > 0.01) s = lid(lid(s, u_eyeL), u_eyeR);
  gl_FragColor = texture2D(u_tex, s / u_size);
}`

const GRID = 64

function shader(gl, type, src) {
  const s = gl.createShader(type)
  gl.shaderSource(s, src)
  gl.compileShader(s)
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) ?? 'shader')
  return s
}

/**
 * @param {HTMLImageElement|ImageBitmap} image the cut-out photo
 * @param {object} rig points of this photo (characters.jsx REAL presenters)
 * @param {{ width?: number, flip?: boolean }} [opt] canvas width in px (height follows)
 * @returns {{ canvas: HTMLCanvasElement, draw: (state: object) => void, dispose: () => void } | null}
 *   null when WebGL is not available
 */
export function createRig(image, rig, { width = 480, flip = false } = {}) {
  const W = image.width
  const H = image.height
  // room for the moving head and hand: at the sides and above; none below, where the photo is cut off
  // (it stands on the bottom edge of the slide)
  const pad = rig.pad ?? [W * 0.08, H * 0.04, 0]
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(width)
  canvas.height = Math.round((width * (H + pad[1] + pad[2])) / (W + pad[0] * 2))
  const gl = canvas.getContext('webgl', { premultipliedAlpha: true, alpha: true, preserveDrawingBuffer: true, antialias: true })
  if (!gl) return null
  const prog = gl.createProgram()
  gl.attachShader(prog, shader(gl, gl.VERTEX_SHADER, VS))
  gl.attachShader(prog, shader(gl, gl.FRAGMENT_SHADER, FS))
  gl.linkProgram(prog)
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog) ?? 'link')
  gl.useProgram(prog)

  // the mesh: GRID × GRID cells over the photo, two triangles each
  const verts = new Float32Array((GRID + 1) * (GRID + 1) * 2)
  for (let y = 0; y <= GRID; y++)
    for (let x = 0; x <= GRID; x++) {
      const i = (y * (GRID + 1) + x) * 2
      verts[i] = (x / GRID) * W
      verts[i + 1] = (y / GRID) * H
    }
  const idx = new Uint16Array(GRID * GRID * 6)
  let n = 0
  for (let y = 0; y < GRID; y++)
    for (let x = 0; x < GRID; x++) {
      const a = y * (GRID + 1) + x
      const b = a + 1
      const c = a + GRID + 1
      const d = c + 1
      idx.set([a, b, c, b, d, c], n)
      n += 6
    }
  const vb = gl.createBuffer()
  gl.bindBuffer(gl.ARRAY_BUFFER, vb)
  gl.bufferData(gl.ARRAY_BUFFER, verts, gl.STATIC_DRAW)
  const ib = gl.createBuffer()
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ib)
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, idx, gl.STATIC_DRAW)
  const loc = gl.getAttribLocation(prog, 'a_src')
  gl.enableVertexAttribArray(loc)
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0)

  const tex = gl.createTexture()
  gl.bindTexture(gl.TEXTURE_2D, tex)
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true)
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
  gl.enable(gl.BLEND)
  gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA)

  const u = (name) => gl.getUniformLocation(prog, name)
  gl.uniform2f(u('u_size'), W, H)
  gl.uniform3f(u('u_pad'), pad[0], pad[1], pad[2])
  gl.uniform1f(u('u_flip'), flip ? 1 : 0)
  gl.uniform2f(u('u_neck'), ...rig.neck)
  gl.uniform4f(u('u_head'), ...rig.head)
  gl.uniform4f(u('u_jawE'), ...rig.jaw)
  gl.uniform1f(u('u_jawLine'), rig.jawLine)
  gl.uniform2f(u('u_wrist'), ...(rig.wrist ?? [0, 0]))
  gl.uniform4f(u('u_hand'), ...(rig.hand ?? [0, 0, 0, 0]))
  gl.uniform2f(u('u_base'), ...(rig.base ?? [W / 2, H]))
  gl.uniform4f(u('u_eyeL'), ...rig.eyes[0])
  gl.uniform4f(u('u_eyeR'), ...rig.eyes[1])
  const U = {
    headRot: u('u_headRot'),
    nod: u('u_nod'),
    jaw: u('u_jaw'),
    handRot: u('u_handRot'),
    sway: u('u_sway'),
    breath: u('u_breath'),
    blink: u('u_blink'),
  }

  /**
   * One frame. state: { t: seconds, level: voice 0…1, wave: 0…1 (how much the hand waves now),
   * blink: 0…1 }. Everything else (breathing, small head moves) follows from t.
   */
  function draw({ t = 0, level = 0, wave = 0, blink = 0 }) {
    gl.viewport(0, 0, canvas.width, canvas.height)
    gl.clearColor(0, 0, 0, 0)
    gl.clear(gl.COLOR_BUFFER_BIT)
    const talk = Math.min(1, level)
    gl.uniform1f(U.headRot, Math.sin(t * 0.9) * 0.018 + Math.sin(t * 2.7) * 0.012 * talk)
    gl.uniform1f(U.nod, Math.sin(t * 5.3) * 1.2 * talk + Math.sin(t * 0.6) * 0.6)
    gl.uniform1f(U.jaw, talk * (rig.jawMax ?? 5))
    gl.uniform1f(U.handRot, Math.sin(t * 1.1) * 0.025 + Math.sin(t * 8.5) * 0.17 * wave)
    gl.uniform1f(U.sway, Math.sin(t * 0.55) * 0.006)
    gl.uniform1f(U.breath, Math.sin(t * 1.5) * 0.0035)
    gl.uniform1f(U.blink, blink)
    gl.drawElements(gl.TRIANGLES, idx.length, gl.UNSIGNED_SHORT, 0)
  }

  function dispose() {
    gl.deleteBuffer(vb)
    gl.deleteBuffer(ib)
    gl.deleteTexture(tex)
    gl.deleteProgram(prog)
    gl.getExtension('WEBGL_lose_context')?.loseContext()
  }

  return { canvas, draw, dispose, aspect: canvas.width / canvas.height }
}

/** Width / height of the canvas createRig makes for a photo of this size (for layout before it loads). */
export const rigAspect = (w, h, rig) => {
  const pad = rig.pad ?? [w * 0.08, h * 0.04, 0]
  return (w + pad[0] * 2) / (h + pad[1] + pad[2])
}

/** Blinks: closed for ~0.14 s every few seconds (deterministic in t, so a replay looks the same). */
export function blinkAt(t) {
  const period = 4.6
  const k = (t % period) / period
  const at = 0.93
  const d = Math.abs(k - at) * period
  return d < 0.07 ? 1 - d / 0.07 : 0
}

/** The hand waves for ~1.6 s after `since` (s), easing in and out. */
export function waveAt(t, since) {
  if (since == null) return 0
  const d = t - since
  if (d < 0 || d > 1.6) return 0
  return Math.sin((d / 1.6) * Math.PI)
}
