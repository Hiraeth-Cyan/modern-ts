// ========================================
// ./src/Utils/Array/sorting.ts
// ========================================

/**
 * Extracts a comparable value from an item for sorting
 * @template T - The type of items being sorted
 */
export type Iteratee<T> = (item: T) => string | number | boolean | Date;

/**
 * Sort order direction
 */
export type Order = 'asc' | 'desc';

/**
 * Core sorting function with full configuration
 * @template T - Array element type
 * @param array - Source array to sort
 * @param iteratees - Functions to extract sort values
 * @param orders - Sort directions for each iteratee
 * @param inplace - Modify original array if true
 * @returns Sorted array (original if inplace)
 */
export const coreSort = <T>(
  array: T[],
  iteratees: Array<Iteratee<T>>,
  orders: Array<Order>,
  inplace: boolean,
): T[] => {
  const target = inplace ? array : [...array];
  return target.sort((a, b) => {
    for (let i = 0; i < iteratees.length; i++) {
      const valA = iteratees[i](a);
      const valB = iteratees[i](b);
      if (valA === valB) continue;

      const dir = orders[i] ?? 'asc';
      const compA = valA instanceof Date ? valA.getTime() : valA;
      const compB = valB instanceof Date ? valB.getTime() : valB;

      if (typeof compA !== typeof compB) {
        // 如果类型不同，按类型的字符串名称排序
        const typeOrder = typeof compA > typeof compB ? 1 : -1;
        return dir === 'asc' ? typeOrder : -typeOrder;
      }

      if (compA > compB) {
        return dir === 'asc' ? 1 : -1;
      } else {
        return dir === 'asc' ? -1 : 1;
      }
    }
    return 0;
  });
};

/**
 * Returns a new sorted array by multiple criteria
 * @template T - Array element type
 * @param array - Source array
 * @param iteratees - Value extraction functions
 * @param orders - Sort directions
 * @returns New sorted array
 */
export const orderBy = <T>(
  array: T[],
  iteratees: Array<Iteratee<T>>,
  orders: Array<Order>,
): T[] => coreSort(array, iteratees, orders, false);

/**
 * Sorts array in-place by multiple criteria
 * @template T - Array element type
 * @param array - Array to sort (modified)
 * @param iteratees - Value extraction functions
 * @param orders - Sort directions
 * @returns Original sorted array
 */
export const orderByInplace = <T>(
  array: T[],
  iteratees: Array<Iteratee<T>>,
  orders: Array<Order>,
): T[] => coreSort(array, iteratees, orders, true);

/**
 * Returns new array sorted by single criterion
 * @template T - Array element type
 * @param array - Source array
 * @param iteratee - Value extraction function
 * @param order - Sort direction (defaults to 'asc')
 * @returns New sorted array
 */
export const sortBy = <T>(
  array: T[],
  iteratee: Iteratee<T>,
  order: Order = 'asc',
): T[] => coreSort(array, [iteratee], [order], false);

/**
 * Sorts array in-place by single criterion
 * @template T - Array element type
 * @param array - Array to sort (modified)
 * @param iteratee - Value extraction function
 * @param order - Sort direction (defaults to 'asc')
 * @returns Original sorted array
 */
export const sortByInplace = <T>(
  array: T[],
  iteratee: Iteratee<T>,
  order: Order = 'asc',
): T[] => coreSort(array, [iteratee], [order], true);
