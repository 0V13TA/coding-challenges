import { load } from "@loaders.gl/core";
import { GLTFLoader } from "@loaders.gl/gltf";

export default class AssetLoader {
  constructor(url: string) {
    const gltf = load(url, GLTFLoader);
  }
}
