/* eslint-disable prefer-rest-params */
import { IntersectsMode } from "./IntersectsMode";

function eventListener<
  T extends
    | Document
    | EventTarget
    | HTMLElement
    | HTMLCollection
    | NodeList
    | HTMLElement[]
>(method: "addEventListener" | "removeEventListener") {
  return (
    elements: T,
    events: string | string[],
    fn: any,
    options: any = {}
  ) => {
    const normalizedEvents = normalizeArray(events);
    const normalizedElements = normalizeDomArray(elements);
    for (const element of normalizedElements) {
      for (const event of normalizedEvents) {
        (element as any)[method](event, fn, { capture: false, ...options });
      }
    }

    return Array.prototype.slice.call(arguments, 1);
  };
}

function normalizeDomArray(
  elements:
    | Document
    | EventTarget
    | HTMLElement
    | HTMLCollection
    | NodeList
    | HTMLElement[]
) {
  if (elements instanceof HTMLCollection || elements instanceof NodeList) {
    return Array.from(elements);
  }
  return normalizeArray(elements);
}
function normalizeArray<T>(elements: T | T[]): T[] {
  if (!Array.isArray(elements)) {
    return [elements];
  }
  return elements;
}
/**
 * Add event(s) to element(s).
 * @param elements DOM-Elements
 * @param events Event names
 * @param fn Callback
 * @param options Optional options
 * @return Array passed arguments
 */
export const on = eventListener("addEventListener");

/**
 * Remove event(s) from element(s).
 * @param elements DOM-Elements
 * @param events Event names
 * @param fn Callback
 * @param options Optional options
 * @return Array passed arguments
 */
export const off = eventListener("removeEventListener");

export const unitify = <
  T extends CSSStyleDeclarationWithNumber[keyof CSSStyleDeclarationWithNumber]
>(
  val: T,
  unit = "px"
) => (typeof val === "number" ? val + unit : val);

type CSSStyleDeclarationWithNumber = {
  [P in keyof CSSStyleDeclaration]?: CSSStyleDeclaration[P] | number;
};
/**
 * Add css to a DOM-Element or returns the current
 * value of a property.
 *
 * @param el The Element.
 * @param attr The attribute or a object which holds css key-properties.
 * @param val The value for a single attribute.
 * @returns {*}
 */
export function css<T extends keyof CSSStyleDeclarationWithNumber>(
  el: ElementCSSInlineStyle,
  attr: T,
  val: CSSStyleDeclarationWithNumber[T]
): void;
export function css(
  el: ElementCSSInlineStyle,
  attr: CSSStyleDeclarationWithNumber
): void;
export function css<T extends keyof CSSStyleDeclarationWithNumber>(
  el: ElementCSSInlineStyle,
  attr: T | CSSStyleDeclarationWithNumber,
  val?: CSSStyleDeclarationWithNumber[T]
): void {
  const style = el && el.style;
  if (style) {
    if (typeof attr === "object") {
      for (const [key, value] of Object.entries(attr)) {
        style[key as any] = unitify(value);
      }
    } else if (val && typeof attr === "string") {
      style[attr as any] = unitify(val);
    }
  }
}

export type BoundingClientRect = ClientRect | DOMRect;
/**
 * Check if two DOM-Elements intersects each other.
 * @param a BoundingClientRect of the first element.
 * @param b BoundingClientRect of the second element.
 * @param mode Options are center, cover or touch.
 * @returns {boolean} If both elements intersects each other.
 */
export function intersects(
  a: BoundingClientRect,
  b: BoundingClientRect,
  mode?: IntersectsMode
) {
  switch (mode || IntersectsMode.touch) {
    case IntersectsMode.center: {
      const bxc = b.left + b.width / 2;
      const byc = b.top + b.height / 2;

      return bxc >= a.left && bxc <= a.right && byc >= a.top && byc <= a.bottom;
    }
    case IntersectsMode.cover: {
      return (
        b.left >= a.left &&
        b.top >= a.top &&
        b.right <= a.right &&
        b.bottom <= a.bottom
      );
    }
    case IntersectsMode.touch: {
      return (
        a.right >= b.left &&
        a.left <= b.right &&
        a.bottom >= b.top &&
        a.top <= b.bottom
      );
    }
    default: {
      throw new Error(`Unkown intersection mode: ${mode}`);
    }
  }
}

/**
 * Takes a selector (or array of selectors) and returns the matched nodes.
 * @param selector The selector or an Array of selectors.
 * @param doc
 * @returns {Array} Array of DOM-Nodes.
 */
export function selectAll(
  selector: string | HTMLElement | Array<string | HTMLElement>,
  doc: Document = document
): HTMLElement[] {
  if (!Array.isArray(selector)) {
    selector = [selector];
  }

  return selector.flatMap(item => {
    if (typeof item === "string") {
      return Array.from(doc.querySelectorAll(item));
    } else if (item instanceof (doc.defaultView as any).HTMLElement) {
      return item;
    }
  });
}
type MouseEventMaybePath = (MouseEvent | TouchEvent) & {
  path?: HTMLElement[];
};
/**
 * Polyfill for safari & firefox for the eventPath event property.
 * @param evt The event object.
 * @return [String] event path.
 */
export function eventPath(evt: MouseEventMaybePath) {
  let path = evt.path || (evt.composedPath && evt.composedPath());

  if (path) {
    return path;
  }

  let el = evt.target;
  for (path = [el]; (el = (el as HTMLElement).parentElement); ) {
    path.push(el);
  }

  path.push(document, window);
  return path;
}

/**
 * Removes an element from an Array.
 */
export function removeElement<T>(arr: T[], el: T) {
  const index = arr.indexOf(el);

  if (~index) {
    arr.splice(index, 1);
  }
}

export function simplifyEvent(evt: MouseEvent | TouchEvent) {
  const tap =
    ((evt as TouchEvent).touches && (evt as TouchEvent).touches[0]) || evt;
  return {
    tap,
    x: (tap as MouseEvent).clientX,
    y: (tap as MouseEvent).clientY,
    target: tap.target as HTMLElement
  };
}
