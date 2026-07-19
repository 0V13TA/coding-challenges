#version 300 es

precision mediump float;

in vec2 fTexCoord;
uniform sampler2D sampler;

out vec4 FragColor;
void main() {
  FragColor = texture(sampler, fTexCoord);
}
