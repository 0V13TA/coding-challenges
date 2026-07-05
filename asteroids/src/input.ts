import * as glm from "gl-matrix";

//#region Key Codes
export type KeyCode =
  | LetterKey
  | DigitKey
  | ModifierKey
  | NavigationKey
  | ControlKey
  | SymbolKey
  | FunctionKey
  | MediaKey;

type LetterKey =
  | "KeyA"
  | "KeyB"
  | "KeyC"
  | "KeyD"
  | "KeyE"
  | "KeyF"
  | "KeyG"
  | "KeyH"
  | "KeyI"
  | "KeyJ"
  | "KeyK"
  | "KeyL"
  | "KeyM"
  | "KeyN"
  | "KeyO"
  | "KeyP"
  | "KeyQ"
  | "KeyR"
  | "KeyS"
  | "KeyT"
  | "KeyU"
  | "KeyV"
  | "KeyW"
  | "KeyX"
  | "KeyY"
  | "KeyZ";

type DigitKey =
  | "Digit0"
  | "Digit1"
  | "Digit2"
  | "Digit3"
  | "Digit4"
  | "Digit5"
  | "Digit6"
  | "Digit7"
  | "Digit8"
  | "Digit9";

type ModifierKey =
  | "ShiftLeft"
  | "ShiftRight"
  | "ControlLeft"
  | "ControlRight"
  | "AltLeft"
  | "AltRight"
  | "MetaLeft"
  | "MetaRight";

type NavigationKey =
  | "ArrowUp"
  | "ArrowDown"
  | "ArrowLeft"
  | "ArrowRight"
  | "Home"
  | "End"
  | "PageUp"
  | "PageDown";

type ControlKey =
  | "Enter"
  | "Escape"
  | "Tab"
  | "Backspace"
  | "Delete"
  | "Space"
  | "CapsLock"
  | "NumLock"
  | "ScrollLock"
  | "Insert"
  | "PrintScreen"
  | "Pause";

type SymbolKey =
  | "Backquote"
  | "Minus"
  | "Equal"
  | "BracketLeft"
  | "BracketRight"
  | "Backslash"
  | "Semicolon"
  | "Quote"
  | "Comma"
  | "Period"
  | "Slash";

type FunctionKey =
  | "F1"
  | "F2"
  | "F3"
  | "F4"
  | "F5"
  | "F6"
  | "F7"
  | "F8"
  | "F9"
  | "F10"
  | "F11"
  | "F12"
  | "F13"
  | "F14"
  | "F15"
  | "F16"
  | "F17"
  | "F18"
  | "F19"
  | "F20"
  | "F21"
  | "F22"
  | "F23"
  | "F24";

type MediaKey =
  | "MediaTrackNext"
  | "MediaTrackPrevious"
  | "MediaStop"
  | "MediaPlayPause"
  | "MediaSelect"
  | "Eject";
//#endregion

export default class InputManager {
  // Staging Buffers: Browser events dump data here instantly
  private stagingPressed = new Set<KeyCode>();
  private stagingReleased = new Set<KeyCode>();
  private stagingMousePressed = new Set<number>();
  private stagingMouseReleased = new Set<number>();
  private stagingMouseDelta = glm.vec2.create();
  private stagingTouchLookDelta = glm.vec2.create();
  private stagingWheelDeltaY = 0;

  // Active Buffers: Systems read from these during a physics step
  private activePressed = new Set<KeyCode>();
  private activeReleased = new Set<KeyCode>();
  private activeMousePressed = new Set<number>();
  private activeMouseReleased = new Set<number>();
  private activeMouseDelta = glm.vec2.create();
  private activeTouchLookDelta = glm.vec2.create();
  private activeWheelDeltaY = 0;

  // Continuous State (Immediate value, safe to read anywhere)
  private held = new Set<KeyCode>();
  private mouseHeld = new Set<number>();
  private mousePosition = glm.vec2.create();
  public isPointerLocked = false;

  public activeTouches = new Map<
    number,
    { startX: number; startY: number; currentX: number; currentY: number }
  >();
  public touchMoveVector = glm.vec2.create();

  constructor(targetElement: HTMLElement = document.body) {
    this.initListeners(targetElement);
  }

  private initListeners(targetElement: HTMLElement): void {
    // Keyboard Input Hooks
    targetElement.addEventListener("keydown", (e: KeyboardEvent) => {
      const code = e.code as KeyCode;
      if (!this.held.has(code)) {
        this.stagingPressed.add(code);
      }
      this.held.add(code);
    });

    targetElement.addEventListener("keyup", (e: KeyboardEvent) => {
      const code = e.code as KeyCode;
      this.held.delete(code);
      this.stagingReleased.add(code);
    });

    // Mouse Buttons Hooks
    targetElement.addEventListener("mousedown", (e: MouseEvent) => {
      if (!this.mouseHeld.has(e.button)) {
        this.stagingMousePressed.add(e.button);
      }
      this.mouseHeld.add(e.button);

      if (!this.isPointerLocked && targetElement.requestPointerLock) {
        targetElement.requestPointerLock();
      }
    });

    targetElement.addEventListener("mouseup", (e: MouseEvent) => {
      this.mouseHeld.delete(e.button);
      this.stagingMouseReleased.add(e.button);
    });

    // Mouse Movement Hooks
    targetElement.addEventListener("mousemove", (e: MouseEvent) => {
      this.mousePosition[0] = e.clientX;
      this.mousePosition[1] = e.clientY;
      this.stagingMouseDelta[0] += e.movementX || 0;
      this.stagingMouseDelta[1] += e.movementY || 0;
    });

    // Scroll Wheel Hooks
    targetElement.addEventListener(
      "wheel",
      (e: WheelEvent) => {
        this.stagingWheelDeltaY += e.deltaY;
      },
      { passive: true },
    );

    // Mobile Touch Movement Loop
    targetElement.addEventListener(
      "touchmove",
      (e: TouchEvent) => {
        e.preventDefault();
        const rect = targetElement.getBoundingClientRect();
        const halfWidth = rect.width / 2;

        for (let i = 0; i < e.changedTouches.length; i++) {
          const touch = e.changedTouches[i];
          const trackingNode = this.activeTouches.get(touch.identifier);

          if (trackingNode) {
            const newX = touch.clientX - rect.left;
            const newY = touch.clientY - rect.top;

            if (trackingNode.startX > halfWidth) {
              // Accumulate into staging buffer instead of raw mutation
              this.stagingTouchLookDelta[0] += newX - trackingNode.currentX;
              this.stagingTouchLookDelta[1] += newY - trackingNode.currentY;
            }

            trackingNode.currentX = newX;
            trackingNode.currentY = newY;
          }
        }
        this.updatePhoneJoystick(halfWidth);
      },
      { passive: false },
    );

    targetElement.addEventListener(
      "touchstart",
      (e: TouchEvent) => {
        e.preventDefault();
        const rect = targetElement.getBoundingClientRect();

        for (let i = 0; i < e.changedTouches.length; i++) {
          const touch = e.changedTouches[i];
          const x = touch.clientX - rect.left;
          const y = touch.clientY - rect.top;
          this.activeTouches.set(touch.identifier, {
            startX: x,
            startY: y,
            currentX: x,
            currentY: y,
          });
        }
      },
      { passive: false },
    );

    const handleTouchClose = (e: TouchEvent) => {
      for (let i = 0; i < e.changedTouches.length; i++) {
        this.activeTouches.delete(e.changedTouches[i].identifier);
      }
      const rect = targetElement.getBoundingClientRect();
      this.updatePhoneJoystick(rect.width / 2);
    };

    targetElement.addEventListener("touchend", handleTouchClose);
    targetElement.addEventListener("touchcancel", handleTouchClose);
  }

  private updatePhoneJoystick(halfWidth: number): void {
    this.touchMoveVector[0] = 0;
    this.touchMoveVector[1] = 0;

    for (const [_id, trackingNode] of this.activeTouches.entries()) {
      if (trackingNode.startX <= halfWidth) {
        const dx = trackingNode.currentX - trackingNode.startX;
        const dy = trackingNode.currentY - trackingNode.startY;
        const distance = Math.sqrt(dx * dx + dy * dy) || 1;

        const maxRadius = 45;
        const throttle = Math.min(1, distance / maxRadius);

        this.touchMoveVector[0] = (dx / distance) * throttle;
        this.touchMoveVector[1] = (dy / distance) * throttle;
        break;
      }
    }
  }

  // Public Query Interfaces
  public isHeld(key: KeyCode): boolean {
    return this.held.has(key);
  }
  public isMouseHeld(button: number = 0): boolean {
    return this.mouseHeld.has(button);
  }
  public getMousePosition(): glm.vec2 {
    return this.mousePosition;
  }
  public isPressed(key: KeyCode): boolean {
    return this.activePressed.has(key);
  }
  public isReleased(key: KeyCode): boolean {
    return this.activeReleased.has(key);
  }
  public isMousePressed(button: number = 0): boolean {
    return this.activeMousePressed.has(button);
  }
  public isMouseReleased(button: number = 0): boolean {
    return this.activeMouseReleased.has(button);
  }
  public getMouseDelta(): glm.vec2 {
    return this.activeMouseDelta;
  }
  public getWheelDeltaY(): number {
    return this.activeWheelDeltaY;
  }
  public getTouchLookDelta(): glm.vec2 {
    return this.activeTouchLookDelta;
  }

  public beginPhysicsStep(): void {
    // Snapshot all staging records into active frames
    this.activePressed = new Set(this.stagingPressed);
    this.activeReleased = new Set(this.stagingReleased);
    this.activeMousePressed = new Set(this.stagingMousePressed);
    this.activeMouseReleased = new Set(this.stagingMouseReleased);

    glm.vec2.copy(this.activeMouseDelta, this.stagingMouseDelta);
    glm.vec2.copy(this.activeTouchLookDelta, this.stagingTouchLookDelta);
    this.activeWheelDeltaY = this.stagingWheelDeltaY;

    // Clear staging buffers instantly
    this.stagingPressed.clear();
    this.stagingReleased.clear();
    this.stagingMousePressed.clear();
    this.stagingMouseReleased.clear();
    this.stagingMouseDelta[0] = 0;
    this.stagingMouseDelta[1] = 0;
    this.stagingTouchLookDelta[0] = 0;
    this.stagingTouchLookDelta[1] = 0;
    this.stagingWheelDeltaY = 0;
  }
}
