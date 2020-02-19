import { IntersectsMode } from "./IntersectsMode";
import {
  applyBasicStylesToTheSelectionFrame,
  createSelectionFrame,
  SelectionFrame
} from "./SelectionFrame";
import {
  BoundingClientRect,
  css,
  eventPath,
  intersects,
  off,
  on,
  removeElement,
  selectAll,
  simplifyEvent,
  unitify
} from "./utils";
// @ts-ignore
//import {version} from '../package';

// Some var shorting for better compression and readability
const { abs, max, min, round, ceil, sign } = Math;
const preventDefault = (e: Event) => e.preventDefault();

type KeepSelectionStore = {
  _stored: HTMLElement[];
  _selectables: HTMLElement[];
  _selected: HTMLElement[]; // Currently touched elements
  _changed: {
    added: HTMLElement[]; // Added elements since last selection
    removed: HTMLElement[]; // Removed elements since last selection
  };
};

function getKeepSelectionStore(): KeepSelectionStore {
  return {
    _stored: [],
    _selectables: [],
    _selected: [], // Currently touched elements
    _changed: {
      added: [], // Added elements since last selection
      removed: [] // Removed elements since last selection
    }
  };
}

type EvenlistenerStore = {
  beforestart: any[];
  start: any[];
  move: any[];
  stop: any[];
};

// Evenlistener name: [callbacks]
function getEvenlistenerStore(): EvenlistenerStore {
  return {
    beforestart: [],
    start: [],
    move: [],
    stop: []
  };
}
export const enum TapMode {
  native = "native",
  touch = "touch"
}
type Point = { x: number; y: number };
function isPoint(startThreshold: number | Point): startThreshold is Point {
  return typeof startThreshold === "object";
}
type SelectionOptions = {
  class: string;
  frame: Document;
  mode: IntersectsMode;
  tapMode: TapMode;
  startThreshold: number | Point;
  singleClick: boolean;
  disableTouch: boolean;

  selectables: any[];
  scrollSpeedDivider: number;
  manualScrollSpeed: number;

  startareas: string[];
  boundaries: string[];
  selectionAreaContainer: string;
};
type Boundery = Element | HTMLElement;
type SupportedEvent = MouseEvent | TouchEvent;
type SelectionData = {
  options: SelectionOptions;
  _eventListener: EvenlistenerStore;
  selectionFrame: SelectionFrame;

  // Create area element
  _areaDomRect: BoundingClientRect | null; // Caches the position of the selection-area
  _boundaries: Boundery[];
  _targetContainer: Boundery | undefined;
  _targetBoundary: DOMRect;
  _singleClick: boolean;
  // Is getting set on movement. Varied.
  _scrollAvailable: boolean;
  _scrollSpeed: { x: number | null; y: number | null };
  _init(): void;
  _bindStartEvents(type: typeof on | typeof off): void;
  _onTapStart(evt: SupportedEvent): void;
  _onSingleTap(evt: SupportedEvent): boolean;
  _delayedTapMove(evt: SupportedEvent): void;
  __delayedTapMove(evt: SupportedEvent): void;
  _onTapMove(evt: SupportedEvent): void;
  _manualScroll(evt: WheelEvent): void;
  _redrawArea(): void;
  _onTapStop(evt: SupportedEvent, noevent?: boolean): void;
  _updatedTouchingElements(): void;
  _emit(event: keyof EvenlistenerStore, evt: SupportedEvent): boolean;
  on(event: keyof EvenlistenerStore, cb: any): SelectionData;
  off(event: keyof EvenlistenerStore, cb: any): SelectionData;
  resolveSelectables(): void;
  keepSelection(): void;
  clearSelection(store: boolean): void;
  removeFromSelection(el: HTMLElement): void;
  getSelection(): HTMLElement[];
  cancel(keepEvent: boolean): void;
  option<T extends keyof SelectionOptions>(
    name: T,
    value?: SelectionOptions[T]
  ): SelectionOptions[T];
  disable(): void;
  destroy(): void;
  enable(): void;
  select(query: string | HTMLElement | (string | HTMLElement)[]): HTMLElement[];
} & KeepSelectionStore;
function Selection(options: Partial<SelectionOptions> = {}) {
  const areaStartPoint = {
    _ax1: 0,
    _ay1: 0
  };
  const areaEndPoint = {
    _ax2: 0,
    _ay2: 0
  };
  const that: SelectionData = {
    // >- новые?
    _boundaries: [],
    _targetContainer: undefined,
    _targetBoundary: undefined as any,
    _singleClick: false,
    selectionFrame: (null as any) as SelectionFrame,
    // <- новые?
    options: {
      class: "selection-area",
      frame: document,
      mode: IntersectsMode.touch,
      tapMode: TapMode.native,
      startThreshold: 10,
      singleClick: true,
      disableTouch: false,

      selectables: [],
      scrollSpeedDivider: 10,
      manualScrollSpeed: 750,

      startareas: ["html"],
      boundaries: ["html"],
      selectionAreaContainer: "body",
      ...options
    },
    ...getKeepSelectionStore(),

    _eventListener: getEvenlistenerStore(),

    // Create area element
    _areaDomRect: null, // Caches the position of the selection-area

    // Is getting set on movement. Varied.
    _scrollAvailable: true,
    _scrollSpeed: { x: null, y: null },

    _init(): void {
      const { frame } = that.options;
      that.selectionFrame = createSelectionFrame(frame);
      that.selectionFrame.area.classList.add(that.options.class);
      applyBasicStylesToTheSelectionFrame(that.selectionFrame);
      that.enable();
    },

    _bindStartEvents(fn: typeof on | typeof off): void {
      const { frame } = that.options;
      fn(frame, "mousedown", that._onTapStart);

      if (!that.options.disableTouch) {
        fn(frame, "touchstart", that._onTapStart, {
          passive: false
        });
      }
    },

    _onTapStart(evt: SupportedEvent): void {
      const { x, y, target } = simplifyEvent(evt);
      const { startareas, boundaries, frame } = that.options;
      const targetBoundingClientRect = target.getBoundingClientRect();

      // Find start-areas and boundaries
      const startAreas = selectAll(startareas, frame);
      that._boundaries = selectAll(boundaries, frame);

      // Check in which container the user currently acts
      that._targetContainer = that._boundaries.find(el =>
        intersects(el.getBoundingClientRect(), targetBoundingClientRect)
      );

      function isAreaStartsInOneOfTheStartAreasOrBoundaries() {
        const evtpath = eventPath(evt);
        return (
          !that._targetContainer ||
          !startAreas.find(el => evtpath.includes(el)) ||
          !that._boundaries.find(el => evtpath.includes(el))
        );
      }
      if (isAreaStartsInOneOfTheStartAreasOrBoundaries()) {
        return;
      }
      // мб тут нужно больши инфы передать?
      if (that._emit("beforestart", evt) === false) {
        return;
      }

      // Area start point
      areaStartPoint._ax1 = x;
      areaStartPoint._ay1 = y;

      // Area end point
      areaEndPoint._ax2 = 0;
      areaEndPoint._ay2 = 0;

      // To detect single-click
      that._singleClick = true;
      that.clearSelection(false);

      // Prevent default select event (firefox bug-fix)
      on(frame, "selectstart", preventDefault);

      // Add listener
      on(frame, ["touchmove", "mousemove"], that._delayedTapMove, {
        passive: false
      });
      on(frame, ["mouseup", "touchcancel", "touchend"], that._onTapStop);

      // Firefox will scroll down the page which would break the selection.
      evt.preventDefault();
    },

    _onSingleTap(evt: SupportedEvent): boolean {
      const { tapMode } = that.options;
      const spl = simplifyEvent(evt);
      let target: HTMLElement | null = null;

      if (tapMode === TapMode.native) {
        target = spl.target;
      } else if (tapMode === TapMode.touch) {
        that.resolveSelectables();

        const { x, y } = spl;
        target = that._selectables.find(v => {
          const { right, left, top, bottom } = v.getBoundingClientRect();
          return x < right && x > left && y < bottom && y > top;
        });
      } else {
        throw new Error(`Unknown tapMode option: ${tapMode}`);
      }

      if (!target) {
        return false;
      }

      /**
       * Resolve selectables again.
       * If the user starded in a scrollable area they will be reduced
       * to the current area. Prevent the exclusion of these if a range-selection
       * gets performed.
       */
      that.resolveSelectables();

      // Traverse dom upwards to check if target is selectable
      while (!that._selectables.includes(target)) {
        if (!target.parentElement) {
          return;
        }

        target = target.parentElement;
      }

      that._emit("start", evt);
      const stored = that._stored;
      if (evt.shiftKey && stored.length) {
        const reference = stored[stored.length - 1];

        // Resolve correct range
        const [preceding, following] =
          reference.compareDocumentPosition(target) &
          Node.DOCUMENT_POSITION_FOLLOWING
            ? [target, reference]
            : [reference, target];

        const rangeItems = [
          ...that._selectables.filter(
            el =>
              el.compareDocumentPosition(preceding) &
                Node.DOCUMENT_POSITION_FOLLOWING &&
              el.compareDocumentPosition(following) &
                Node.DOCUMENT_POSITION_PRECEDING
          ),
          target
        ];

        that.select(rangeItems);
        that._emit("move", evt);
        that._emit("stop", evt);
      } else {
        if (stored.includes(target)) {
          that.removeFromSelection(target);
        } else {
          that.select(target);
        }

        that._emit("move", evt);
        that._emit("stop", evt);
      }
    },

    _delayedTapMove(evt: SupportedEvent): void {
      // Check pixel threshold
      function isMoreWhenThreshold() {
        const { startThreshold } = that.options;
        const { x, y } = simplifyEvent(evt);
        const { _ax1, _ay1 } = areaStartPoint; // Coordinates of first "tap"
        return (
          (typeof startThreshold === "number" &&
            abs(x + y - (_ax1 + _ay1)) >= startThreshold) ||
          (isPoint(startThreshold) &&
            (abs(x - _ax1) >= startThreshold.x ||
              abs(y - _ay1) >= startThreshold.y))
        );
      }
      if (isMoreWhenThreshold()) {
        that.__delayedTapMove(evt);
      }

      evt.preventDefault(); // Prevent swipe-down refresh
    },

    __delayedTapMove(evt: SupportedEvent): void {
      const { frame } = that.options;
      off(frame, ["mousemove", "touchmove"], that._delayedTapMove, {
        passive: false
      });
      on(frame, ["mousemove", "touchmove"], that._onTapMove, {
        passive: false
      });

      // Make area element visible
      css(that.selectionFrame.area, "display", "block");

      // Apppend selection-area to the dom
      selectAll(that.options.selectionAreaContainer, frame)[0].appendChild(
        that.selectionFrame.clippingElement
      );

      // Now after the threshold is reached resolve all selectables
      that.resolveSelectables();

      // An action is recognized as single-select until the user performed a mutli-selection
      that._singleClick = false;

      // Just saving the boundaries of this container for later
      const tb = (that._targetBoundary = that._targetContainer.getBoundingClientRect());

      // Find container and check if it's scrollable
      // Indenticates if the user is currently in a scrollable area
      that._scrollAvailable =
        round(that._targetContainer.scrollHeight) !== round(tb.height) ||
        round(that._targetContainer.scrollWidth) !== round(tb.width);
      if (that._scrollAvailable) {
        // Detect mouse scrolling
        on(window, "wheel", that._manualScroll, { passive: false });

        /**
         * The selection-area will also cover other element which are
         * out of the current scrollable parent. So find all elements
         * which are in the current scrollable element. Later these are
         * the only selectables instead of all.
         */
        that._selectables = that._selectables.filter(s =>
          that._targetContainer.contains(s)
        );

        /**
         * To clip the area, the selection area has a parent
         * which has exact the same dimensions as the scrollable elemeent.
         * Now if the area exeeds these boundaries it will be cropped.
         */
        css(that.selectionFrame.clippingElement, {
          top: tb.top,
          left: tb.left,
          width: tb.width,
          height: tb.height
        });

        /**
         * The area element is relative to the clipping element,
         * but when this is moved or transformed we need to correct
         * the positions via a negative margin.
         */
        css(that.selectionFrame.area, {
          marginTop: -tb.top,
          marginLeft: -tb.left
        });
      } else {
        /**
         * Reset margin and clipping element dimensions.
         */
        css(that.selectionFrame.clippingElement, {
          top: 0,
          left: 0,
          width: "100%",
          height: "100%"
        });

        css(that.selectionFrame.area, {
          marginTop: 0,
          marginLeft: 0
        });
      }

      // Trigger recalc and fire event
      that._onTapMove(evt);
      that._emit("start", evt);
    },
    _onTapMove(evt: SupportedEvent): void {
      const { x, y } = simplifyEvent(evt);
      const { scrollSpeedDivider } = that.options;
      const scon = that._targetContainer;
      let ss = that._scrollSpeed;
      areaEndPoint._ax2 = x;
      areaEndPoint._ay2 = y;

      if (that._scrollAvailable && (ss.y !== null || ss.x !== null)) {
        // Continous scrolling
        requestAnimationFrame(function scroll() {
          // Make sure that ss is not outdated
          ss = that._scrollSpeed;
          const scrollY = ss.y !== null;
          const scrollX = ss.x !== null;

          // Scrolling is not anymore required
          if (!scrollY && !scrollX) {
            return;
          }

          /**
           * If the value exeeds the scrollable area it will
           * be set to the max / min value. So change only
           */
          const { scrollTop, scrollLeft } = scon;

          // Reduce velocity, use ceil in both directions to scroll at least 1px per frame
          if (scrollY) {
            scon.scrollTop += ceil(ss.y / scrollSpeedDivider);
            areaStartPoint._ay1 -= scon.scrollTop - scrollTop;
          }

          if (scrollX) {
            scon.scrollLeft += ceil(ss.x / scrollSpeedDivider);
            areaStartPoint._ax1 -= scon.scrollLeft - scrollLeft;
          }

          /**
           * We changed the start coordinates -> redraw the selectiona area
           * We changed the dimensions of the area element -> re-calc selected elements
           * The selected elements array has been changed -> fire event
           */
          redraw();

          // Keep scrolling even if the user stops to move his pointer
          requestAnimationFrame(scroll);
        });
      } else {
        /**
         * Perform redraw only if scrolling is not active.
         * If scrolling is active this area is getting re-dragwed by the scroll function.
         */
        redraw();
      }

      function redraw() {
        that._redrawArea();
        that._updatedTouchingElements();
        that._emit("move", evt);
      }

      evt.preventDefault(); // Prevent swipe-down refresh
    },

    _manualScroll(evt: WheelEvent): void {
      const { manualScrollSpeed } = that.options;

      // Consistent scrolling speed on all browsers
      that._scrollSpeed.y += sign(evt.deltaY) * manualScrollSpeed;
      that._scrollSpeed.x += sign(evt.deltaX) * manualScrollSpeed;
      that._onTapMove(evt);

      // Prevent defaul scrolling behaviour, eg. page scrolling
      evt.preventDefault();
    },

    _redrawArea(): void {
      const ss = that._scrollSpeed;
      const {
        scrollTop,
        scrollHeight,
        clientHeight,
        scrollLeft,
        scrollWidth,
        clientWidth
      } = that._targetContainer;
      const brect = that._targetBoundary;
      let x = areaEndPoint._ax2;
      let y = areaEndPoint._ay2;
      [ss.x, x] = scrollSpeedWithNewCoord(
        x,
        brect.left,
        brect.width,
        scrollWidth,
        scrollLeft,
        clientWidth
      );
      [ss.y, y] = scrollSpeedWithNewCoord(
        y,
        brect.top,
        brect.height,
        scrollHeight,
        scrollTop,
        clientHeight
      );

      const x3 = min(areaStartPoint._ax1, x);
      const y3 = min(areaStartPoint._ay1, y);
      const x4 = max(areaStartPoint._ax1, x);
      const y4 = max(areaStartPoint._ay1, y);
      const width = x4 - x3;
      const height = y4 - y3;

      // It's generally faster to not use es6-templates
      Object.assign(that.selectionFrame.area.style, {
        transform: `translate3d(${unitify(x3)}, ${unitify(y3)}` + ", 0)",
        width: unitify(width),
        height: unitify(height)
      });
      that._areaDomRect = new DOMRect(x3, y3, width, height);
    },

    _onTapStop(evt: SupportedEvent, noevent?: boolean): void {
      const { frame, singleClick } = that.options;

      // Remove event handlers
      off(frame, ["mousemove", "touchmove"], that._delayedTapMove);
      off(frame, ["touchmove", "mousemove"], that._onTapMove);
      off(frame, ["mouseup", "touchcancel", "touchend"], that._onTapStop);

      if (evt && that._singleClick && singleClick) {
        that._onSingleTap(evt);
      } else if (!that._singleClick && !noevent) {
        that._updatedTouchingElements();
        that._emit("stop", evt);
      }

      // Reset scroll speed
      that._scrollSpeed = { x: null, y: null };

      // Unbind mouse scrolling listener
      off(window, "wheel", that._manualScroll);

      // Remove selection-area from dom
      that.selectionFrame.clippingElement.remove();

      // Enable default select event
      off(frame, "selectstart", preventDefault);
      css(that.selectionFrame.area, "display", "none");
    },

    _updatedTouchingElements(): void {
      const { _selected, _selectables, options, _areaDomRect } = that;
      const { mode } = options;
      function isAreaIntersectsElement(node: Element | HTMLElement) {
        return intersects(_areaDomRect, node.getBoundingClientRect(), mode);
      }
      const touched = _selectables.filter(isAreaIntersectsElement);
      const added = touched.filter(node => !_selected.includes(node));
      // Check which elements where removed since last selection
      const removed = _selected.filter(el => !touched.includes(el));
      // Save
      that._selected = touched;
      that._changed = { added, removed };
    },

    _emit(event: keyof EvenlistenerStore, evt: SupportedEvent): boolean {
      // isOk?
      return that._eventListener[event].reduce((ok, listener) => {
        return (
          listener.call(that, {
            inst: that,
            area: that.selectionFrame.area,
            selected: that._selected.concat(that._stored),
            changed: that._changed,
            oe: evt
          }) && ok
        );
      }, true);
    },

    /**
     * Adds an eventlistener
     * @param event
     * @param cb
     */
    on(event: keyof EvenlistenerStore, cb: any): SelectionData {
      that._eventListener[event].push(cb);
      return that;
    },

    /**
     * Removes an event listener
     * @param event
     * @param cb
     */
    off(event: keyof EvenlistenerStore, cb: any): SelectionData {
      const callBacks = that._eventListener[event];

      if (callBacks) {
        const index = callBacks.indexOf(cb);

        if (~index) {
          callBacks.splice(index, 1);
        }
      }

      return that;
    },

    /**
     * Can be used if during a selection elements have been added.
     * Will update everything which can be selected.
     */
    resolveSelectables(): void {
      // Resolve selectors
      that._selectables = selectAll(
        that.options.selectables,
        that.options.frame
      );
    },

    /**
     * Saves the current selection for the next selecion.
     * Allows multiple selections.
     */
    keepSelection(): void {
      const { _selected, _stored } = that;
      // _stored это Set
      for (let i = 0; i < _selected.length; i++) {
        const el = _selected[i];
        if (!_stored.includes(el)) {
          _stored.push(el);
        }
      }
    },

    /**
     * Clear the elements which where saved by 'keepSelection()'.
     * @param store If the store should also get cleared
     */
    clearSelection(store: boolean = true): void {
      store && (that._stored = []);
      that._selected = [];
      that._changed.added = [];
      that._changed.removed = [];
    },

    /**
     * Removes an particular element from the selection.
     */
    removeFromSelection(el: HTMLElement): void {
      that._changed.removed.push(el);
      removeElement(that._stored, el);
      removeElement(that._selected, el);
    },

    /**
     * @returns {Array} Selected elements
     */
    getSelection(): HTMLElement[] {
      return that._stored;
    },

    /**
     * Cancel the current selection process.
     * @param keepEvent {boolean} true to fire the onStop listener after cancel.
     */
    cancel(keepEvent: boolean = false): void {
      that._onTapStop(null, !keepEvent);
    },

    /**
     * Set or get an option.
     * @param   {string} name
     * @param   {*}      value
     * @return  {*}      the new value
     */
    option<T extends keyof SelectionOptions>(
      name: T,
      value?: SelectionOptions[T]
    ): SelectionOptions[T] {
      const { options } = that;
      return value === undefined ? options[name] : (options[name] = value);
    },

    /**
     * Disable the selection functinality.
     */
    disable(): void {
      that._bindStartEvents(off);
    },

    /**
     * Unbinds all events and removes the area-element
     */
    destroy(): void {
      that.disable();
      that.selectionFrame.clippingElement.remove();
    },

    /**
     * Enable the selection functinality.
     */
    enable(): void {
      that._bindStartEvents(on);
    },

    /**
     * Manually select elements
     * @param query - CSS Query, can be an array of queries
     */
    select(
      query: string | HTMLElement | (string | HTMLElement)[]
    ): HTMLElement[] {
      const { _selected, _stored, options } = that;
      const elements = selectAll(query, options.frame).filter(
        el => !_selected.includes(el) && !_stored.includes(el)
      );

      that._selected.push(...elements);
      that._changed.added.push(...elements);
      return elements;
    }
  };

  // Initialize
  that._init();

  return that;
}

function scrollSpeedWithNewCoord(
  coord: number,
  directionCoord: number,
  length: number,
  scrollLength: number,
  scrollDirectionCoord: number,
  clientLength: number
) {
  if (coord < directionCoord) {
    return [
      scrollDirectionCoord ? -abs(directionCoord - coord) : null,
      directionCoord
    ];
  } else {
    const alternateDirectionCoord = directionCoord + length;
    if (coord > alternateDirectionCoord) {
      return [
        scrollLength - scrollDirectionCoord - clientLength
          ? abs(alternateDirectionCoord - coord)
          : null,
        alternateDirectionCoord
      ];
    }
  }
  return [null, coord];
}

// Export utils
Selection.utils = {
  on,
  off,
  css,
  intersects,
  selectAll,
  eventPath,
  removeElement
};

/**
 * Create selection instance
 * @param {Object} [options]
 */
Selection.create = (options: Partial<SelectionOptions>) => Selection(options);

// Set version and export
// Selection.version = version;
export default Selection;
