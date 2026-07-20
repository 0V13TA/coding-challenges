export type NumericHandle = number;

export interface Attribute<T extends ArrayBufferView = Float32Array> {
  data: T;
  normalized: boolean;
  componentType: number; // e.g. gl.FLOAT, gl.UNSIGNED_SHORT
}

export interface OrcImage {
  id: NumericHandle;
  data: ImageBitmap | HTMLImageElement | ArrayBufferView;
  mimeType?: string;
  width?: number;
  height?: number;
}

export interface OrcTexture {
  id: NumericHandle;
  imageHandle: NumericHandle;
  minFilter?: number;
  magFilter?: number;
  wrapS?: number;
  wrapT?: number;
}

export interface OrcMaterial {
  id: NumericHandle;
  baseColorFactor?: [number, number, number, number];
  baseColorTextureHandle?: NumericHandle;
  metallicFactor?: number;
  roughnessFactor?: number;
}

export interface OrcPrimitive {
  id: NumericHandle;
  positions: Attribute<Float32Array>;
  normals?: Attribute<Float32Array>;
  uvs?: Attribute<Float32Array>;
  indices?: Attribute<Uint32Array | Uint16Array | Uint8Array>;
  materialHandle?: NumericHandle;
}

export interface OrcMesh {
  id: NumericHandle;
  name?: string;
  primitives: NumericHandle[]; // Array of OrcPrimitive handles
}

export interface OrcNode {
  id: NumericHandle;
  name?: string;
  translation: [number, number, number];
  rotation: [number, number, number, number]; // Quaternion [x, y, z, w]
  scale: [number, number, number];
  meshHandle?: NumericHandle;
  children: NumericHandle[];
}

export interface OrcImportedAsset {
  images: OrcImage[];
  textures: OrcTexture[];
  materials: OrcMaterial[];
  primitives: OrcPrimitive[];
  meshes: OrcMesh[];
  nodes: OrcNode[];
  scenes: { name?: string; nodes: NumericHandle[] }[];
}
