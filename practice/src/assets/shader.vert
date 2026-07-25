#version 300 es
layout(location = 0) in vec3 aPos;
layout(location = 1) in vec3 aNormal;
layout(location = 2) in vec2 aTexCoord;

out vec3 vNormal;
out vec2 vTexCoord;

uniform mat4 mView;
uniform mat4 mWorld;
uniform mat4 mProjection;

void main() {
  vNormal = mat3(mWorld) * aNormal;
  vTexCoord = aTexCoord;
  gl_Position = mProjection * mView * mWorld * vec4(aPos, 1.0);
}
