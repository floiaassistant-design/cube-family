import * as THREE from "three";
import swordUrl from "../../assets/3d/epee-cuivre/epee-cuivre_v1.glb?url";
import axeUrl from "../../assets/3d/hache-cuivre/hache-cuivre_v1.glb?url";
import shieldUrl from "../../assets/3d/bouclier-bois/bouclier-bois_v1.glb?url";
import armorUrl from "../../assets/3d/plastron-cuivre/plastron-cuivre_v1.glb?url";
import { COPPER_ARMOR, type HandEquipment } from "../game/items";
import { COPPER_AXE, COPPER_SWORD, isNewEquipment, WOOD_SHIELD } from "../game/equipment";

export type EquipmentModelId =
  typeof COPPER_SWORD | typeof COPPER_AXE | typeof WOOD_SHIELD | typeof COPPER_ARMOR;

const MODEL_URLS: Readonly<Record<EquipmentModelId, string>> = {
  [COPPER_SWORD]: swordUrl,
  [COPPER_AXE]: axeUrl,
  [WOOD_SHIELD]: shieldUrl,
  [COPPER_ARMOR]: armorUrl,
};

/** All GLBs are local and have no network-dependent textures or external buffers. */
export async function loadEquipmentModel(item: EquipmentModelId): Promise<THREE.Group> {
  const [{ GLTFLoader }, response] = await Promise.all([
    import("three/addons/loaders/GLTFLoader.js"),
    fetch(MODEL_URLS[item]),
  ]);
  if (!response.ok) throw new Error(`Equipment model missing: ${item}`);
  const { scene } = await new GLTFLoader().parseAsync(await response.arrayBuffer(), "");
  scene.traverse((node) => {
    if (!(node instanceof THREE.Mesh)) return;
    const original = node.material as THREE.MeshStandardMaterial;
    node.material = new THREE.MeshBasicMaterial({
      color: original.color.clone(),
      depthTest: false,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    node.frustumCulled = false;
    node.renderOrder = 41;
  });
  return scene;
}

/** Loads visible equipment only when selected. Old hand tools keep their renderer. */
export class EquipmentHandModels {
  private current: HandEquipment | null = null;
  private readonly models = new Map<EquipmentModelId, THREE.Group>();
  private readonly pending = new Set<EquipmentModelId>();
  private readonly parent: THREE.Group;

  constructor(parent: THREE.Group) {
    this.parent = parent;
  }

  setItem(item: HandEquipment | null): void {
    this.current = item;
    for (const [id, model] of this.models) model.visible = id === item;
    if (!isNewEquipment(item) || this.models.has(item) || this.pending.has(item)) return;
    this.pending.add(item);
    void loadEquipmentModel(item)
      .then((model) => {
        model.position.y = item === WOOD_SHIELD ? 0 : -0.23;
        this.parent.add(model);
        this.models.set(item, model);
        model.visible = this.current === item;
      })
      .catch((error: unknown) => {
        console.warn("Equipment unavailable:", item, error);
      })
      .finally(() => this.pending.delete(item));
  }
}
