export type KeyCode =
  | "KeyW" | "KeyA" | "KeyS" | "KeyD"
  | "KeyQ" | "KeyE" | "KeyR" | "KeyF"
  | "ArrowUp" | "ArrowDown" | "ArrowLeft" | "ArrowRight"
  | "Space" | "ShiftLeft" | "ShiftRight" | "ControlLeft" | "ControlRight"
  | "Escape" | "Enter" | "Tab" | "Backspace"
  | (string & {});

export type MouseButton = 0 | 1 | 2; // 0: Left, 1: Middle, 2: Right

export interface TouchPoint {
  id: number;
  x: number;
  y: number;
  startX: number;
  startY: number;
}

export interface Vec2 {
  x: number;
  y: number;
}

export const Input = {
  // Keyboard state
  private_keysHeld: new Set<string>(),
  private_keysPressed: new Set<string>(),
  private_keysReleased: new Set<string>(),

  // Mouse state
  mouse: {
    x: 0,
    y: 0,
    held: new Set<number>(),
    pressed: new Set<number>(),
    released: new Set<number>(),
  },

  // Multi-touch state
  touches: new Map<number, TouchPoint>(),
  touchesStarted: new Array<TouchPoint>(),
  touchesEnded: new Array<TouchPoint>(),

  private_targetElement: null as HTMLElement | null,

  init(target: HTMLElement = window.document.body): void {
    this.private_targetElement = target;

    // --- Keyboard Listeners ---
    window.addEventListener("keydown", (e: KeyboardEvent) => {
      if (e.repeat) return;
      if (!this.private_keysHeld.has(e.code)) {
        this.private_keysPressed.add(e.code);
      }
      this.private_keysHeld.add(e.code);
    });

    window.addEventListener("keyup", (e: KeyboardEvent) => {
      this.private_keysHeld.delete(e.code);
      this.private_keysReleased.add(e.code);
    });

    // Reset inputs on blur to prevent stuck keys/buttons
    window.addEventListener("blur", () => {
      this.resetAll();
    });

    // --- Mouse Listeners ---
    window.addEventListener("mousemove", (e: MouseEvent) => {
      const coords = this.toElementCoords(e.clientX, e.clientY);
      this.mouse.x = coords.x;
      this.mouse.y = coords.y;
    });

    window.addEventListener("mousedown", (e: MouseEvent) => {
      if (!this.mouse.held.has(e.button)) {
        this.mouse.pressed.add(e.button);
      }
      this.mouse.held.add(e.button);
    });

    window.addEventListener("mouseup", (e: MouseEvent) => {
      this.mouse.held.delete(e.button);
      this.mouse.released.add(e.button);
    });

    // --- Touch Listeners ---
    // Registered on target element to avoid hijacking global gestures
    target.addEventListener(
      "touchstart",
      (e: TouchEvent) => {
        for (let i = 0; i < e.changedTouches.length; i++) {
          const t = e.changedTouches[i];
          const coords = this.toElementCoords(t.clientX, t.clientY);
          const touchData: TouchPoint = {
            id: t.identifier,
            x: coords.x,
            y: coords.y,
            startX: coords.x,
            startY: coords.y,
          };
          this.touches.set(t.identifier, touchData);
          this.touchesStarted.push(touchData);
        }
      },
      { passive: false }
    );

    target.addEventListener(
      "touchmove",
      (e: TouchEvent) => {
        for (let i = 0; i < e.changedTouches.length; i++) {
          const t = e.changedTouches[i];
          const existing = this.touches.get(t.identifier);
          if (existing) {
            const coords = this.toElementCoords(t.clientX, t.clientY);
            existing.x = coords.x;
            existing.y = coords.y;
          }
        }
      },
      { passive: false }
    );

    const handleTouchEnd = (e: TouchEvent) => {
      for (let i = 0; i < e.changedTouches.length; i++) {
        const t = e.changedTouches[i];
        const existing = this.touches.get(t.identifier);
        if (existing) {
          this.touchesEnded.push(existing);
          this.touches.delete(t.identifier);
        }
      }
    };

    target.addEventListener("touchend", handleTouchEnd);
    target.addEventListener("touchcancel", handleTouchEnd);
  },

  // Coordinate normalizer relative to target canvas / container
  toElementCoords(clientX: number, clientY: number): Vec2 {
    if (!this.private_targetElement) return { x: clientX, y: clientY };
    const rect = this.private_targetElement.getBoundingClientRect();
    return {
      x: clientX - rect.left,
      y: clientY - rect.top,
    };
  },

  // Keyboard Query Methods
  isKeyHeld(key: KeyCode): boolean {
    return this.private_keysHeld.has(key);
  },
  isKeyPressed(key: KeyCode): boolean {
    return this.private_keysPressed.has(key);
  },
  isKeyReleased(key: KeyCode): boolean {
    return this.private_keysReleased.has(key);
  },

  // Mouse Query Methods
  isMouseHeld(button: MouseButton = 0): boolean {
    return this.mouse.held.has(button);
  },
  isMousePressed(button: MouseButton = 0): boolean {
    return this.mouse.pressed.has(button);
  },
  isMouseReleased(button: MouseButton = 0): boolean {
    return this.mouse.released.has(button);
  },
  getMousePosition(): Vec2 {
    return { x: this.mouse.x, y: this.mouse.y };
  },

  // Touch Query Methods
  hasActiveTouches(): boolean {
    return this.touches.size > 0;
  },
  getActiveTouches(): TouchPoint[] {
    return Array.from(this.touches.values());
  },
  getPrimaryTouch(): TouchPoint | null {
    if (this.touches.size === 0) return null;
    return this.touches.values().next().value ?? null;
  },

  // State cleanup
  resetAll(): void {
    this.private_keysHeld.clear();
    this.private_keysPressed.clear();
    this.private_keysReleased.clear();
    this.mouse.held.clear();
    this.mouse.pressed.clear();
    this.mouse.released.clear();
    this.touches.clear();
    this.touchesStarted.length = 0;
    this.touchesEnded.length = 0;
  },

  endFrame(): void {
    this.private_keysPressed.clear();
    this.private_keysReleased.clear();
    this.mouse.pressed.clear();
    this.mouse.released.clear();
    this.touchesStarted.length = 0;
    this.touchesEnded.length = 0;
  },
};
