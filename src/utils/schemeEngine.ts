// Scheme engine — operations for composing, updating, and transforming schemes.
import { v4 as uuid } from 'uuid';
import type { AttributeType, AttributeSet, Scheme, Form } from '../types/scheme';

/**
 * Replace all attributes of a given type across all forms in a scheme.
 * Takes values from the newSet items in order, cycling if the set is shorter.
 */
export function replaceAttributeType(
  scheme: Scheme,
  type: AttributeType,
  newSet: AttributeSet
): Scheme {
  const forms = scheme.forms.map((form, i) => {
    const item = newSet.items[i % newSet.items.length];
    if (!item) return form;

    const updated = { ...form };
    switch (type) {
      case 'color':
        updated.color = item.color;
        break;
      case 'texture':
        updated.texture = item.texture;
        break;
      case 'shape':
        updated.shape = item.shape;
        break;
      case 'sound':
        updated.sound = item.sound;
        break;
    }
    return updated;
  });

  return { ...scheme, forms };
}

/**
 * Swap all attributes of a given type with a new attribute set.
 * Alias for replaceAttributeType with source tracking.
 */
export function swapAttributeSet(
  scheme: Scheme,
  type: AttributeType,
  newSet: AttributeSet
): Scheme {
  const updated = replaceAttributeType(scheme, type, newSet);
  const sourceSetIds = [...(scheme.sourceSetIds ?? [])].filter(
    (id) => !id.startsWith(type + '-')
  );
  sourceSetIds.push(newSet.id);
  return { ...updated, sourceSetIds };
}

/**
 * Compose a new Scheme from multiple attribute sets + label list.
 */
export function composeScheme(
  name: string,
  colorSet?: AttributeSet,
  textureSet?: AttributeSet,
  shapeSet?: AttributeSet,
  soundSet?: AttributeSet,
  labels?: string[]
): Scheme {
  // Determine the maximum number of forms from the largest set
  const maxItems = Math.max(
    colorSet?.items.length ?? 0,
    textureSet?.items.length ?? 0,
    shapeSet?.items.length ?? 0,
    soundSet?.items.length ?? 0,
    labels?.length ?? 0,
    1
  );

  const forms: Form[] = [];
  for (let i = 0; i < maxItems; i++) {
    const colorItem = colorSet?.items[i % (colorSet.items.length || 1)];
    const textureItem = textureSet?.items[i % (textureSet.items.length || 1)];
    const shapeItem = shapeSet?.items[i % (shapeSet.items.length || 1)];
    const soundItem = soundSet?.items[i % (soundSet.items.length || 1)];

    forms.push({
      id: uuid(),
      label: labels?.[i] ?? colorItem?.label ?? `Form ${i + 1}`,
      shortcutKey: i < 9 ? i + 1 : 0,
      color: colorItem?.color,
      texture: textureItem?.texture,
      shape: shapeItem?.shape,
      sound: soundItem?.sound,
    });
  }

  const sourceSetIds = [
    colorSet?.id,
    textureSet?.id,
    shapeSet?.id,
    soundSet?.id,
  ].filter((id): id is string => !!id);

  return {
    id: uuid(),
    name,
    builtIn: false,
    forms,
    sourceSetIds,
  };
}

/**
 * Update multiple attribute types at once on a scheme.
 */
export function updateSchemeAttributes(
  scheme: Scheme,
  updates: Partial<Record<AttributeType, AttributeSet>>
): Scheme {
  let result = scheme;
  for (const [type, set] of Object.entries(updates) as [AttributeType, AttributeSet][]) {
    if (set) {
      result = replaceAttributeType(result, type, set);
    }
  }
  return result;
}
