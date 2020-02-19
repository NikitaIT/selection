import { css } from "./utils";

export type SelectionFrame = {
  area: HTMLElement;
  clippingElement: HTMLElement;
};

export function createSelectionFrame(frame: Document): SelectionFrame {
  const area = frame.createElement("div");
  const clippingElement = frame.createElement("div");
  clippingElement.appendChild(area);
  return { area, clippingElement };
}
export function applyBasicStylesToTheSelectionFrame(
  selectionFrame: SelectionFrame
) {
  css(selectionFrame.area, {
    willChange: "top, left, bottom, right, width, height",
    top: 0,
    left: 0,
    position: "fixed"
  });

  css(selectionFrame.clippingElement, {
    overflow: "hidden",
    position: "fixed",
    transform: "translate3d(0, 0, 0)", // https://stackoverflow.com/a/38268846
    pointerEvents: "none",
    zIndex: "1"
  });
}
