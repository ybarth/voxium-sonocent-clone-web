import type { Section } from '../types';

/**
 * Depth-first walk producing display order of sections.
 * Top-level sections are sorted by orderIndex, children nested under their parent.
 */
export function getFlatSectionOrder(sections: Section[]): Section[] {
  const result: Section[] = [];
  const childrenMap = new Map<string | null, Section[]>();

  for (const section of sections) {
    const key = section.parentId;
    const arr = childrenMap.get(key) ?? [];
    arr.push(section);
    childrenMap.set(key, arr);
  }

  // Sort each group by orderIndex
  for (const arr of childrenMap.values()) {
    arr.sort((a, b) => a.orderIndex - b.orderIndex);
  }

  function walk(parentId: string | null) {
    const children = childrenMap.get(parentId) ?? [];
    for (const child of children) {
      result.push(child);
      walk(child.id);
    }
  }

  walk(null);
  return result;
}

/**
 * Get all descendant section IDs of the given section.
 */
export function getDescendantIds(sections: Section[], sectionId: string): string[] {
  const childrenMap = new Map<string, Section[]>();
  for (const section of sections) {
    if (section.parentId) {
      const arr = childrenMap.get(section.parentId) ?? [];
      arr.push(section);
      childrenMap.set(section.parentId, arr);
    }
  }

  const result: string[] = [];
  function walk(id: string) {
    const children = childrenMap.get(id) ?? [];
    for (const child of children) {
      result.push(child.id);
      walk(child.id);
    }
  }
  walk(sectionId);
  return result;
}

/**
 * Get siblings of a section (sections with the same parentId), sorted by orderIndex.
 */
export function getSiblings(sections: Section[], sectionId: string): Section[] {
  const section = sections.find((s) => s.id === sectionId);
  if (!section) return [];
  return sections
    .filter((s) => s.parentId === section.parentId && s.id !== sectionId)
    .sort((a, b) => a.orderIndex - b.orderIndex);
}

/**
 * Check if any ancestor of a section is collapsed.
 */
export function hasCollapsedAncestor(sections: Section[], sectionId: string): boolean {
  const sectionMap = new Map(sections.map((s) => [s.id, s]));
  let current = sectionMap.get(sectionId);
  while (current?.parentId) {
    const parent = sectionMap.get(current.parentId);
    if (!parent) break;
    if (parent.isCollapsed) return true;
    current = parent;
  }
  return false;
}
