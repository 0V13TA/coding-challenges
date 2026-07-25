#version 300 es
precision mediump float;

in vec3 vNormal;
in vec2 vTexCoord;

out vec4 FragColor;

uniform vec4 uBaseColorFactor;
uniform sampler2D uSampler;
uniform bool uHasTexture;

uniform int uAlphaMode; // 0 = OPAQUE/BLEND, 1 = MASK
uniform float uAlphaCutoff;

void main() {
  vec3 normal = normalize(vNormal);
  vec3 lightDir = normalize(vec3(1.0, 1.0, -1.0));
  float diff = max(dot(normal, lightDir), 0.2);

  vec4 finalColor = uBaseColorFactor;
  if (uHasTexture) {
    finalColor *= texture(uSampler, vTexCoord);
  }

  // NEW: Handle Alpha Masking (e.g. cutouts)
  if (uAlphaMode == 1 && finalColor.a < uAlphaCutoff) {
    discard; // Throw away the pixel completely
  }

  FragColor = vec4(finalColor.rgb * diff, finalColor.a);
}
