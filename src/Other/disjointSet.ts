// ============================================
// ./src/Other/disjointSet.ts
// ============================================

/**
 * A Disjoint Set Union (Union-Find) data structure with path compression and union by rank
 * Efficiently manages and queries disjoint sets with near-constant time operations
 * @template T The type of elements stored in the sets
 */
export class DisjointSet<T> {
  private parent: Map<T, T> = new Map<T, T>();
  private rank: Map<T, number> = new Map<T, number>();
  private count: number = 0;

  /**
   * Returns the number of distinct sets
   */
  public get size(): number {
    return this.count;
  }

  /**
   * Creates a new set containing only the given element
   * If the element already exists in a set, this operation has no effect
   */
  public makeSet(item: T): void {
    if (this.parent.has(item)) return;
    this.parent.set(item, item);
    this.rank.set(item, 0);
    this.count++;
  }

  /**
   * Finds the representative (root) of the set containing the given element
   * Applies path compression to optimize future queries
   * @returns The representative element, or null if the element is not in any set
   */
  public find(item: T): T | null {
    if (!this.parent.has(item)) return null;

    let root = item;
    while (this.parent.get(root) !== root) {
      root = this.parent.get(root)!;
    }

    // -- 路径压缩：将沿途所有节点的父节点直接指向根 --
    while (item !== root) {
      const next = this.parent.get(item)!;
      this.parent.set(item, root);
      item = next;
    }

    return root;
  }

  /**
   * Merges the sets containing two elements
   * Uses union by rank to keep the tree shallow
   * @returns true if the sets were merged (they were different), false if they were already in the same set
   */
  public union(item1: T, item2: T): boolean {
    const root1 = this.find(item1);
    const root2 = this.find(item2);

    if (root1 === null || root2 === null || root1 === root2) return false;

    // -- 按秩合并：将秩较小的树合并到秩较大的树 --
    const rank1 = this.rank.get(root1)!;
    const rank2 = this.rank.get(root2)!;

    if (rank1 < rank2) {
      this.parent.set(root1, root2);
    } else if (rank1 > rank2) {
      this.parent.set(root2, root1);
    } else {
      this.parent.set(root2, root1);
      this.rank.set(root1, rank1 + 1);
    }

    this.count--;
    return true;
  }

  /**
   * Checks if two elements are in the same set
   * @returns true if both elements exist and are in the same set, false otherwise
   */
  public isConnected(item1: T, item2: T): boolean {
    const root1 = this.find(item1);
    const root2 = this.find(item2);
    return root1 !== null && root2 !== null && root1 === root2;
  }

  /**
   * Checks if an element exists in any set
   */
  public contains(item: T): boolean {
    return this.parent.has(item);
  }

  /**
   * Removes all elements and resets the data structure
   */
  public clear(): void {
    this.parent.clear();
    this.rank.clear();
    this.count = 0;
  }

  /**
   * Returns all elements in the same set as the given element
   * @returns An array of elements in the same set, or null if the element is not in any set
   */
  public getSetMembers(item: T): T[] | null {
    const root = this.find(item);
    if (root === null) return null;

    const members = new Array<T>();
    for (const [elem] of this.parent) {
      if (this.find(elem) === root) {
        members.push(elem);
      }
    }
    return members;
  }

  /**
   * Returns all sets as an array of arrays
   */
  public getAllSets(): T[][] {
    const sets = new Map<T, T[]>();

    for (const item of this.parent.keys()) {
      const root = this.find(item)!;
      if (!sets.has(root)) {
        sets.set(root, new Array<T>());
      }
      sets.get(root)!.push(item);
    }

    return Array.from(sets.values());
  }
}
