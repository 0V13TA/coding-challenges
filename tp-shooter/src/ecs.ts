import type ComponentRegistry from "./components";

export type Entity = number;

type ComponentName = keyof ComponentRegistry;

class SparseSet<T> {
  private dense: T[] = [];
  private entities: Entity[] = [];
  private sparse: Array<number | null> = [];

  has(entity: Entity): boolean {
    const [index, generation] = EntityManager.extractInfoFromEntityID(entity);
    return (
      generation === EntityManager.generationStack[index] &&
      this.sparse[index] !== null &&
      this.sparse[index] !== undefined
    );
  }

  getEntities(): Entity[] {
    return [...this.entities];
  }

  addData(entity: Entity, data: T): void {
    const [index, generation] = EntityManager.extractInfoFromEntityID(entity);
    if (generation !== EntityManager.generationStack[index]) return;

    this.dense.push(data);
    this.entities.push(entity);
    this.sparse[index] = this.dense.length - 1;
  }

  removeData(entity: Entity): void {
    const [index] = EntityManager.extractInfoFromEntityID(entity);
    const position = this.sparse[index];

    if (position === undefined || position === null) return;

    const lastIndex = this.dense.length - 1;

    if (position !== lastIndex) {
      const lastData = this.dense[lastIndex];
      const lastEntity = this.entities[lastIndex];

      this.dense[position] = lastData;
      this.entities[position] = lastEntity;

      const [lastEntityIndex] = EntityManager.extractInfoFromEntityID(lastEntity);
      this.sparse[lastEntityIndex] = position;
    }

    this.dense.pop();
    this.entities.pop();
    this.sparse[index] = null;
  }

  getData(entity: Entity): T | null {
    const [index, generation] = EntityManager.extractInfoFromEntityID(entity);

    if (
      generation !== EntityManager.generationStack[index] ||
      this.sparse[index] === undefined ||
      this.sparse[index] === null
    ) {
      return null;
    }

    return this.dense[this.sparse[index] ?? 0];
  }

  updateData(entity: Entity, updater: (value: T) => T): void {
    const [index, generation] = EntityManager.extractInfoFromEntityID(entity);
    const position = this.sparse[index];

    if (
      generation !== EntityManager.generationStack[index] ||
      position === undefined ||
      position === null
    ) {
      return;
    }

    this.dense[position] = updater(this.dense[position]);
  }
}

const EntityManager = {
  indexCounter: 0,
  indexStack: new Array<number>(),
  generationStack: new Array<number>(),

  createEntity(): Entity {
    const index = this.indexStack.pop() ?? this.indexCounter++;

    if (!this.generationStack[index]) {
      this.generationStack[index] = 0;
    }

    if (this.generationStack[index] > 0b111111111111) {
      this.generationStack[index] = 0;
    }

    return (index << 12) | this.generationStack[index];
  },

  deleteEntity(entity: Entity): void {
    const [index] = this.extractInfoFromEntityID(entity);
    this.generationStack[index] = (this.generationStack[index] ?? 0) + 1;
    this.indexStack.push(index);
  },

  extractInfoFromEntityID(entity: Entity): [number, number] {
    const index = entity >>> 12;
    const generation = entity & 0b111111111111;
    return [index, generation];
  },
};

export class Registry {
  private components = new Map<ComponentName, SparseSet<ComponentRegistry[ComponentName]>>();

  createEntity(): Entity {
    return EntityManager.createEntity();
  }

  destroyEntity(entity: Entity): void {
    for (const component of this.components.values()) {
      component.removeData(entity);
    }

    EntityManager.deleteEntity(entity);
  }

  createComponent<T extends ComponentName>(name: T): void {
    if (this.components.has(name)) {
      console.error(`Component ${name} already exists`);
      return;
    }

    this.components.set(name, new SparseSet<ComponentRegistry[T]>());
  }

  addData<T extends ComponentName>(
    entity: Entity,
    name: T,
    data: ComponentRegistry[T],
  ): void {
    const set = this.components.get(name);
    if (!set) {
      console.error(`Component ${name} does not exist`);
      return;
    }

    set.addData(entity, data);
  }

  removeData<T extends ComponentName>(entity: Entity, componentName: T): void {
    const set = this.components.get(componentName);
    if (!set) {
      console.error(`Component ${componentName} does not exist`);
      return;
    }

    set.removeData(entity);
  }

  getData<T extends ComponentName>(
    entity: Entity,
    componentName: T,
  ): ComponentRegistry[T] | null {
    const set = this.components.get(componentName);
    return set ? set.getData(entity) : null;
  }

  updateData<T extends ComponentName>(
    entity: Entity,
    componentName: T,
    updater: (value: ComponentRegistry[T]) => ComponentRegistry[T],
  ): void {
    const set = this.components.get(componentName);
    if (!set) {
      console.error(`Component ${componentName} does not exist`);
      return;
    }

    set.updateData(entity, (value) => updater(value as ComponentRegistry[T]));
  }

  hasComponent<T extends ComponentName>(entity: Entity, componentName: T): boolean {
    const set = this.components.get(componentName);
    return set ? set.has(entity) : false;
  }

  view<T extends ComponentName>(...componentNames: T[]): Entity[] {
    if (componentNames.length === 0) return [];

    const sets = componentNames.map((name) => this.components.get(name));
    if (sets.some((set) => !set)) return [];

    const validSets = sets as Array<SparseSet<ComponentRegistry[T]>>;
    const sortedSets = [...validSets].sort((a, b) => a.getEntities().length - b.getEntities().length);
    const smallest = sortedSets[0];
    const others = sortedSets.slice(1);

    const matches: Entity[] = [];
    for (const entity of smallest.getEntities()) {
      const existsInAll = others.every((set) => set.has(entity));
      if (existsInAll) matches.push(entity);
    }

    return matches;
  }
}
