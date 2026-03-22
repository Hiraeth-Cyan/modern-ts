// ============================================
// ./src/Other/disjointSet.spec.ts
// ============================================

import {describe, it, expect} from 'vitest';
import {DisjointSet} from './disjointSet';

describe.concurrent('DisjointSet', () => {
  describe('basic operations', () => {
    it('should create an empty disjoint set', () => {
      const ds = new DisjointSet<number>();
      expect(ds.size).toBe(0);
    });

    it('should create sets with makeSet', () => {
      const ds = new DisjointSet<number>();
      ds.makeSet(1);
      ds.makeSet(2);
      ds.makeSet(3);

      expect(ds.size).toBe(3);
      expect(ds.contains(1)).toBe(true);
      expect(ds.contains(2)).toBe(true);
      expect(ds.contains(3)).toBe(true);
      expect(ds.contains(4)).toBe(false);
    });

    it('should not create duplicate sets', () => {
      const ds = new DisjointSet<number>();
      ds.makeSet(1);
      ds.makeSet(1);
      ds.makeSet(1);

      expect(ds.size).toBe(1);
    });

    it('should find the root of a set', () => {
      const ds = new DisjointSet<number>();
      ds.makeSet(1);
      ds.makeSet(2);
      ds.makeSet(3);

      expect(ds.find(1)).toBe(1);
      expect(ds.find(2)).toBe(2);
      expect(ds.find(3)).toBe(3);
    });

    it('should return null for non-existent elements', () => {
      const ds = new DisjointSet<number>();
      expect(ds.find(1)).toBeNull();
      expect(ds.find(999)).toBeNull();
    });
  });

  describe('union operations', () => {
    it('should union two sets', () => {
      const ds = new DisjointSet<number>();
      ds.makeSet(1);
      ds.makeSet(2);

      expect(ds.union(1, 2)).toBe(true);
      expect(ds.size).toBe(1);
      expect(ds.isConnected(1, 2)).toBe(true);
    });

    it('should return false when unioning elements in the same set', () => {
      const ds = new DisjointSet<number>();
      ds.makeSet(1);
      ds.makeSet(2);
      ds.union(1, 2);

      expect(ds.union(1, 2)).toBe(false);
      expect(ds.size).toBe(1);
    });

    it('should return false when unioning non-existent elements', () => {
      const ds = new DisjointSet<number>();
      expect(ds.union(1, 2)).toBe(false);
    });

    it('should union multiple sets', () => {
      const ds = new DisjointSet<number>();
      ds.makeSet(1);
      ds.makeSet(2);
      ds.makeSet(3);
      ds.makeSet(4);

      ds.union(1, 2);
      ds.union(3, 4);
      ds.union(1, 3);

      expect(ds.size).toBe(1);
      expect(ds.isConnected(1, 2)).toBe(true);
      expect(ds.isConnected(3, 4)).toBe(true);
      expect(ds.isConnected(1, 3)).toBe(true);
      expect(ds.isConnected(2, 4)).toBe(true);
    });

    it('should handle union with non-existent element', () => {
      const ds = new DisjointSet<number>();
      ds.makeSet(1);
      ds.makeSet(2);

      expect(ds.union(1, 3)).toBe(false);
      expect(ds.size).toBe(2);
    });
  });

  describe('isConnected', () => {
    it('should return false for elements in different sets', () => {
      const ds = new DisjointSet<number>();
      ds.makeSet(1);
      ds.makeSet(2);
      ds.makeSet(3);

      expect(ds.isConnected(1, 2)).toBe(false);
      expect(ds.isConnected(2, 3)).toBe(false);
      expect(ds.isConnected(1, 3)).toBe(false);
    });

    it('should return true for elements in the same set', () => {
      const ds = new DisjointSet<number>();
      ds.makeSet(1);
      ds.makeSet(2);
      ds.makeSet(3);

      ds.union(1, 2);
      ds.union(2, 3);

      expect(ds.isConnected(1, 2)).toBe(true);
      expect(ds.isConnected(2, 3)).toBe(true);
      expect(ds.isConnected(1, 3)).toBe(true);
    });

    it('should return false for non-existent elements', () => {
      const ds = new DisjointSet<number>();
      ds.makeSet(1);

      expect(ds.isConnected(1, 2)).toBe(false);
      expect(ds.isConnected(2, 3)).toBe(false);
    });
  });

  describe('getSetMembers', () => {
    it('should return all members of a set', () => {
      const ds = new DisjointSet<number>();
      ds.makeSet(1);
      ds.makeSet(2);
      ds.makeSet(3);
      ds.makeSet(4);

      ds.union(1, 2);
      ds.union(1, 3);

      const members = ds.getSetMembers(1);
      expect(members).toEqual(expect.arrayContaining([1, 2, 3]));
      expect(members).toHaveLength(3);
    });

    it('should return null for non-existent elements', () => {
      const ds = new DisjointSet<number>();
      expect(ds.getSetMembers(1)).toBeNull();
    });

    it('should return single element for singleton set', () => {
      const ds = new DisjointSet<number>();
      ds.makeSet(1);

      const members = ds.getSetMembers(1);
      expect(members).toEqual([1]);
    });
  });

  describe('getAllSets', () => {
    it('should return all sets', () => {
      const ds = new DisjointSet<number>();
      ds.makeSet(1);
      ds.makeSet(2);
      ds.makeSet(3);
      ds.makeSet(4);

      ds.union(1, 2);
      ds.union(3, 4);

      const sets = ds.getAllSets();
      expect(sets).toHaveLength(2);
      expect(sets).toEqual(
        expect.arrayContaining([
          expect.arrayContaining([1, 2]),
          expect.arrayContaining([3, 4]),
        ]),
      );
    });

    it('should return empty array for empty disjoint set', () => {
      const ds = new DisjointSet<number>();
      expect(ds.getAllSets()).toEqual([]);
    });

    it('should return single set when all elements are connected', () => {
      const ds = new DisjointSet<number>();
      ds.makeSet(1);
      ds.makeSet(2);
      ds.makeSet(3);

      ds.union(1, 2);
      ds.union(2, 3);

      const sets = ds.getAllSets();
      expect(sets).toHaveLength(1);
      expect(sets[0]).toEqual(expect.arrayContaining([1, 2, 3]));
    });
  });

  describe('clear', () => {
    it('should clear all elements', () => {
      const ds = new DisjointSet<number>();
      ds.makeSet(1);
      ds.makeSet(2);
      ds.makeSet(3);

      ds.union(1, 2);

      ds.clear();

      expect(ds.size).toBe(0);
      expect(ds.contains(1)).toBe(false);
      expect(ds.contains(2)).toBe(false);
      expect(ds.contains(3)).toBe(false);
    });
  });

  describe('generic type support', () => {
    it('should work with strings', () => {
      const ds = new DisjointSet<string>();
      ds.makeSet('a');
      ds.makeSet('b');
      ds.makeSet('c');

      ds.union('a', 'b');

      expect(ds.isConnected('a', 'b')).toBe(true);
      expect(ds.isConnected('a', 'c')).toBe(false);
    });

    it('should work with objects', () => {
      interface Node {
        id: number;
      }
      const ds = new DisjointSet<Node>();
      const node1 = {id: 1};
      const node2 = {id: 2};
      const node3 = {id: 3};

      ds.makeSet(node1);
      ds.makeSet(node2);
      ds.makeSet(node3);

      ds.union(node1, node2);

      expect(ds.isConnected(node1, node2)).toBe(true);
      expect(ds.isConnected(node1, node3)).toBe(false);
    });
  });

  describe('path compression', () => {
    it('should compress paths during find', () => {
      const ds = new DisjointSet<number>();
      ds.makeSet(1);
      ds.makeSet(2);
      ds.makeSet(3);
      ds.makeSet(4);
      ds.makeSet(5);

      ds.union(1, 2);
      ds.union(2, 3);
      ds.union(3, 4);
      ds.union(4, 5);

      const root1 = ds.find(1);
      const root5 = ds.find(5);

      expect(root1).toBe(root5);
      expect(ds.isConnected(1, 5)).toBe(true);
    });

    it('should maintain correct structure after multiple finds', () => {
      const ds = new DisjointSet<number>();
      ds.makeSet(1);
      ds.makeSet(2);
      ds.makeSet(3);
      ds.makeSet(4);

      ds.union(1, 2);
      ds.union(3, 4);
      ds.union(1, 3);

      ds.find(2);
      ds.find(4);
      ds.find(1);

      expect(ds.isConnected(1, 2)).toBe(true);
      expect(ds.isConnected(3, 4)).toBe(true);
      expect(ds.isConnected(1, 4)).toBe(true);
    });
  });

  describe('edge cases', () => {
    it('should handle union by rank correctly', () => {
      const ds = new DisjointSet<number>();
      for (let i = 1; i <= 10; i++) {
        ds.makeSet(i);
      }

      ds.union(1, 2);
      ds.union(3, 4);
      ds.union(1, 3);
      ds.union(5, 6);
      ds.union(7, 8);
      ds.union(5, 7);
      ds.union(1, 5);

      expect(ds.size).toBe(3);
      expect(ds.isConnected(1, 8)).toBe(true);
      expect(ds.isConnected(9, 10)).toBe(false);
    });

    it('should union smaller rank tree into larger rank tree', () => {
      const ds = new DisjointSet<number>();
      ds.makeSet(1);
      ds.makeSet(2);
      ds.makeSet(3);

      ds.union(1, 2);
      const root_after_first_union = ds.find(1);
      ds.makeSet(4);
      ds.union(3, root_after_first_union === 1 ? 2 : 1);
      ds.union(4, root_after_first_union === 1 ? 1 : 2);

      expect(ds.isConnected(4, 1)).toBe(true);
      expect(ds.isConnected(4, 2)).toBe(true);
    });

    it('should handle large number of elements', () => {
      const ds = new DisjointSet<number>();
      const count = 1000;

      for (let i = 0; i < count; i++) {
        ds.makeSet(i);
      }

      for (let i = 0; i < count - 1; i++) {
        ds.union(i, i + 1);
      }

      expect(ds.size).toBe(1);
      expect(ds.isConnected(0, count - 1)).toBe(true);
    });

    it('should handle self-union', () => {
      const ds = new DisjointSet<number>();
      ds.makeSet(1);

      expect(ds.union(1, 1)).toBe(false);
      expect(ds.size).toBe(1);
    });
  });
});
