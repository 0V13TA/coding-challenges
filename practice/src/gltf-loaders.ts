import { load } from "@loaders.gl/core";
import {
  GLTFLoader,
  postProcessGLTF,
  type GLTFPostprocessed,
  type GLTFMaterialPostprocessed,
  type GLTFNodePostprocessed,
} from "@loaders.gl/gltf";

import type {
  OrcImportedAsset,
  OrcImage,
  OrcTexture,
  OrcMaterial,
  OrcPrimitive,
  OrcMesh,
  OrcNode,
} from "./orc-types";

/**
 * Pure Domain Converter: Translates raw postprocessed glTF objects into ORC engine data structures.
 */
export class GltfConverter {
  public convert(model: GLTFPostprocessed): OrcImportedAsset {
    const images = this.extractImages(model);
    const textures = this.extractTextures(model);
    const materials = this.extractMaterials(model);
    const primitives: OrcPrimitive[] = [];
    const meshes = this.extractMeshes(model, primitives);
    const nodes = this.extractNodes(model);
    const scenes = this.extractScenes(model);

    return {
      images,
      textures,
      materials,
      primitives,
      meshes,
      nodes,
      scenes,
    };
  }

  private extractImages(model: GLTFPostprocessed): OrcImage[] {
    if (!model.images) return [];
    return model.images.map((img, index) => {
      // loaders.gl usually puts the decoded ImageBitmap directly on img.image
      const isDecodedImage =
        img.image instanceof ImageBitmap ||
        (typeof HTMLImageElement !== "undefined" &&
          img.image instanceof HTMLImageElement);

      // If it's decoded, use it directly. Otherwise, fall back to the raw buffer if it exists.
      const imageData = isDecodedImage ? img.image : img.image?.data;

      return {
        id: index,
        data: imageData,
        mimeType: img.image?.mimeType || img.mimeType || "",
        width: img.image?.width || 0,
        height: img.image?.height || 0,
      };
    });
  }

  private extractTextures(model: GLTFPostprocessed): OrcTexture[] {
    if (!model.textures) return [];

    return model.textures.map((tex, index) => {
      // Resolve image index directly from post-processed object
      const imageIndex = model.images?.indexOf(tex.source!) ?? tex.source;

      return {
        id: index,
        imageHandle: typeof imageIndex === "number" ? imageIndex : 0,
        minFilter: tex.sampler?.minFilter,
        magFilter: tex.sampler?.magFilter,
        wrapS: tex.sampler?.wrapS,
        wrapT: tex.sampler?.wrapT,
      };
    });
  }

  private extractMaterials(model: GLTFPostprocessed): OrcMaterial[] {
    if (!model.materials) return [];

    return model.materials.map((mat: GLTFMaterialPostprocessed, index) => {
      const pbr = (mat.pbrMetallicRoughness as Record<string, any>) || {};

      let baseColorTextureHandle: number | undefined;
      if (pbr.baseColorTexture?.texture) {
        const texObj = pbr.baseColorTexture.texture;
        const texIndex = model.textures?.indexOf(texObj);
        baseColorTextureHandle = texIndex !== -1 ? texIndex : undefined;
      }

      // NEW: Extract base color safely so we can check its alpha channel
      const baseColorFactor = pbr.baseColorFactor || [1, 1, 1, 1];
      let alphaMode = mat.alphaMode || "OPAQUE";

      // SMART FALLBACK: If the artist forgot to set alphaMode, but the color is transparent, force it.
      if (alphaMode === "OPAQUE" && baseColorFactor[3] < 1.0) {
        alphaMode = "BLEND";
      }

      // Extra Safety Net: Sometimes artists leave the alpha at 1.0 but name the material "Glass"
      const matName = (mat.name || "").toLowerCase();
      if (
        alphaMode === "OPAQUE" &&
        (matName.includes("glass") || matName.includes("window"))
      ) {
        alphaMode = "BLEND";
        baseColorFactor[3] = 0.3; // Force it to be 30% opaque
      }

      return {
        id: index,
        baseColorFactor: baseColorFactor as [number, number, number, number],
        metallicFactor: pbr.metallicFactor,
        roughnessFactor: pbr.roughnessFactor,
        baseColorTextureHandle,
        alphaMode,
        alphaCutoff: mat.alphaCutoff !== undefined ? mat.alphaCutoff : 0.5,
      };
    });
  }

  private extractMeshes(
    model: GLTFPostprocessed,
    outPrimitives: OrcPrimitive[],
  ): OrcMesh[] {
    if (!model.meshes) return [];

    return model.meshes.map((mesh, meshIndex) => {
      const primitiveHandles: number[] = [];

      mesh.primitives.forEach((prim) => {
        const primHandle = outPrimitives.length;

        // Clean material handle extraction via object reference lookup
        let materialHandle: number | undefined;
        if (prim.material) {
          const foundIdx = model.materials?.indexOf(prim.material);
          if (foundIdx !== undefined && foundIdx !== -1) {
            materialHandle = foundIdx;
          }
        }

        const attributes = prim.attributes || {};

        const positions = attributes.POSITION;
        const normals = attributes.NORMAL;
        const uvs = attributes.TEXCOORD_0;

        const primitive: OrcPrimitive = {
          id: primHandle,
          positions: {
            data: positions.value as Float32Array,
            normalized: positions.normalized || false,
            componentType: positions.componentType || 5126, // 5126 = FLOAT
          },
          normals: normals
            ? {
                data: normals.value as Float32Array,
                normalized: normals.normalized || false,
                componentType: normals.componentType || 5126,
              }
            : undefined,
          uvs: uvs
            ? {
                data: uvs.value as Float32Array,
                normalized: uvs.normalized || false,
                componentType: uvs.componentType || 5126,
              }
            : undefined,
          indices: prim.indices
            ? {
                data: prim.indices.value as
                  Uint32Array | Uint16Array | Uint8Array,
                normalized: prim.indices.normalized || false,
                componentType: prim.indices.componentType || 5123, // 5123 = UNSIGNED_SHORT
              }
            : undefined,
          materialHandle,
        };

        outPrimitives.push(primitive);
        primitiveHandles.push(primHandle);
      });

      return {
        id: meshIndex,
        name: mesh.name,
        primitives: primitiveHandles,
      };
    });
  }

  private extractNodes(model: GLTFPostprocessed): OrcNode[] {
    if (!model.nodes) return [];

    return model.nodes.map((node: GLTFNodePostprocessed, index) => {
      let meshHandle: number | undefined;
      if (node.mesh) {
        const foundMeshIdx = model.meshes?.indexOf(node.mesh);
        if (foundMeshIdx !== undefined && foundMeshIdx !== -1) {
          meshHandle = foundMeshIdx;
        }
      }

      const children: number[] = [];
      if (node.children) {
        node.children.forEach((childNode) => {
          const childIdx = model.nodes?.indexOf(childNode);
          if (childIdx !== undefined && childIdx !== -1) {
            children.push(childIdx);
          }
        });
      }

      return {
        id: index,
        name: node.name,
        // NEW: Extract the baked matrix if the exporter provided one
        matrix: node.matrix ? new Float32Array(node.matrix) : undefined,
        translation: (node.translation as [number, number, number]) || [
          0, 0, 0,
        ],
        rotation: (node.rotation as [number, number, number, number]) || [
          0, 0, 0, 1,
        ],
        scale: (node.scale as [number, number, number]) || [1, 1, 1],
        meshHandle,
        children,
      };
    });
  }

  private extractScenes(
    model: GLTFPostprocessed,
  ): { name?: string; nodes: number[] }[] {
    if (!model.scenes) return [];

    return model.scenes.map((scene) => ({
      name: scene.name,
      nodes: (scene.nodes || [])
        .map((n) => model.nodes?.indexOf(n))
        .filter((idx): idx is number => idx !== undefined && idx !== -1),
    }));
  }
}

/**
 * File I/O Importer: Fetches raw files and orchestrates the conversion pipeline.
 */
export class GltfImporter {
  private converter = new GltfConverter();

  public async import(url: string): Promise<OrcImportedAsset> {
    const rawModel = await load(url, GLTFLoader, {
      gltf: { loadBuffers: true, loadImages: true },
    });

    const postprocessedModel = postProcessGLTF(rawModel);
    return this.converter.convert(postprocessedModel);
  }
}
