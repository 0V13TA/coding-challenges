#version 300 es

precision mediump float;

in vec3 colors;
out vec4 FragColor;

void main() {
  FragColor = vec4(colors, 1.0f);
}
