type Entity = number;
export type TransformComponent = {
  x: number;
  y: number;
  dir: number; // Degrees
  canWarp: boolean;
};
export type RenderComponent = { radius: number; color: string };

interface ComponentRegistry {
  render: RenderComponent;
  transform: TransformComponent;
}

export class Registry {
  private components: Map<keyof ComponentRegistry, SparseSet<any>> = new Map();

  createEntity(): Entity {
    return EntityManager.createEntity();
  }

  destroyEntity(entity: Entity) {
    for (const component of this.components.values())
      component.removeData(entity);

    EntityManager.deleteEntity(entity);
  }

  createComponent<T extends keyof ComponentRegistry>(name: T) {
    if (this.components.has(name)) {
      console.error(`Component ${name} already exist`);
      return;
    }
    this.components.set(name, new SparseSet<ComponentRegistry[T]>());
  }

  addData<T extends keyof ComponentRegistry>(
    entity: Entity,
    name: T,
    data: ComponentRegistry[T],
  ) {
    if (!this.components.has(name)) {
      console.error(`Component ${name} does not exist`);
      return;
    }

    this.components.get(name)?.addData(entity, data);
  }

  removeData<T extends keyof ComponentRegistry>(
    entity: Entity,
    componentName: T,
  ) {
    if (!this.components.has(componentName)) {
      console.error(`Component ${componentName} does not exist`);
      return;
    }
    this.components.get(componentName)?.removeData(entity);
  }

  getData<T extends keyof ComponentRegistry>(
    entity: Entity,
    componentName: T,
  ): ComponentRegistry[T] | null {
    const set = this.components.get(componentName);
    return set ? set.getData(entity) : null;
  }

  view<T extends keyof ComponentRegistry>(...set: T[]): Array<Entity> {
    if (set.length === 0) return [];
    const setArr: Array<SparseSet<ComponentRegistry[T]>> = [];

    for (const componentName of set) {
      const component = this.components.get(componentName);
      if (!component) return [];
      setArr.push(component);
    }

    const sortedSets = setArr.sort(
      (a, b) => a.entities.length - b.entities.length,
    );
    const smallestSet = sortedSets[0];
    const otherSets = sortedSets.slice(1);

    const matches: Array<Entity> = [];

    for (let i = 0; i < smallestSet.entities.length; i++) {
      const entity = smallestSet.entities[i];
      const [index, _] = EntityManager.extractInfoFromEntityID(entity);

      const existInAll = otherSets.every(
        (set) => set.sparse[index] !== null && set.sparse[index] !== undefined,
      );

      if (existInAll) matches.push(entity);
    }

    return matches;
  }
}

class SparseSet<T extends object> {
  sparse: Array<number | null> = [];
  dense: Array<T> = [];
  entities: Array<Entity> = [];

  addData(entity: Entity, data: T) {
    const [index, generation] = EntityManager.extractInfoFromEntityID(entity);
    if (generation !== EntityManager.generationStack[index]) return;
    this.dense.push(data);
    this.entities.push(entity);
    this.sparse[index] = this.dense.length - 1;
  }

  removeData(entity: Entity) {
    const [index, _] = EntityManager.extractInfoFromEntityID(entity);

    if (this.sparse[index] === undefined || this.sparse[index] === null) return;

    const indexToRemove = this.sparse[index];
    const lastIndex = this.dense.length - 1;

    if (indexToRemove !== lastIndex) {
      const lastData = this.dense[lastIndex];
      const lastEntity = this.entities[lastIndex];

      this.dense[indexToRemove] = lastData;
      this.entities[indexToRemove] = lastEntity;

      const [lastIndexOfLastEntity, _] =
        EntityManager.extractInfoFromEntityID(lastEntity);
      this.sparse[lastIndexOfLastEntity] = indexToRemove;
    }

    this.dense.pop();
    this.entities.pop();
    this.sparse[index] = null;
  }
  getData(entity: Entity) {
    const [index, generation] = EntityManager.extractInfoFromEntityID(entity);
    if (
      generation !== EntityManager.generationStack[index] ||
      this.sparse[index] === null
    )
      return null;
    return this.dense[this.sparse[index]];
  }

  updateData(entity: Entity, value: Partial<T>) {
    const [index, generation] = EntityManager.extractInfoFromEntityID(entity);
    if (
      generation !== EntityManager.generationStack[index] ||
      this.sparse[index] === null
    )
      return;
    let val = this.dense[this.sparse[index]];
    this.dense[this.sparse[index]] = { ...val, ...value };
  }
}

const EntityManager = {
  indexCounter: 0,
  indexStack: new Array<number>(),
  generationStack: new Array<number>(),

  createEntity(): Entity {
    const index = this.indexStack.pop() ?? this.indexCounter++;

    if (!this.generationStack[index]) this.generationStack[index] = 0;

    if (this.generationStack[index] > 0b111111111111)
      this.generationStack[index] = 0;

    let ID = 0b00000000000000000000_000000000000;
    ID |= index << 12;
    ID |= this.generationStack[index];
    return ID;
  },

  deleteEntity(entity: Entity) {
    const [index, _] = this.extractInfoFromEntityID(entity);
    this.generationStack[index]++;
    this.indexStack.push(index);
  },

  extractInfoFromEntityID(entity: Entity) {
    const index = entity >>> 12;
    const generation = entity & 0b111111111111;
    return [index, generation];
  },
};
