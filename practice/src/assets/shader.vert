#version 300 es

layout(location = 0) in vec3 aPos;
uniform mat4 mView;
uniform mat4 mWorld;
uniform mat4 mProjection;

void main() {
  gl_Position = mProjection * mView * mWorld * vec4(aPos, 1.0);
}
