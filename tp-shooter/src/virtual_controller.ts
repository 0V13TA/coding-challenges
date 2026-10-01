import { Input } from "./utils";

// Flat state for the virtual controller
export const VirtualJoystick = {
  active: false,
  touchId: -1,
  origin: { x: 0, y: 0 },
  current: { x: 0, y: 0 },
  axis: { x: 0, y: 0 }, // Normalized -1.0 to 1.0 vector
  maxRadius: 60,        // How far the stick can be dragged
};

export type VirtualButton = {
  x: number;
  y: number;
  radius: number;
  held: boolean;
  pressed: boolean;
  released: boolean;
  touchId: number;
};

// Map of action buttons
export const VirtualButtons: Record<string, VirtualButton> = {
  shoot: { x: 0, y: 0, radius: 45, held: false, pressed: false, released: false, touchId: -1 },
  bomb: { x: 0, y: 0, radius: 35, held: false, pressed: false, released: false, touchId: -1 },
};

export const VirtualController = {
  // Call this once on resize to anchor buttons to the bottom right
  resize(screenWidth: number, screenHeight: number) {
    VirtualButtons.shoot.x = screenWidth - 80;
    VirtualButtons.shoot.y = screenHeight - 80;

    VirtualButtons.bomb.x = screenWidth - 160;
    VirtualButtons.bomb.y = screenHeight - 60;
  },

  // Run this at the start of every frame, before ECS systems
  update(screenWidth: number) {
    // 1. Reset transient button states
    for (const key in VirtualButtons) {
      VirtualButtons[key].pressed = false;
      VirtualButtons[key].released = false;
    }

    // 2. Handle New Touches
    for (const touch of Input.touchesStarted) {
      // Left side of screen = Joystick anchor
      if (touch.startX < screenWidth / 2 && !VirtualJoystick.active) {
        VirtualJoystick.active = true;
        VirtualJoystick.touchId = touch.id;
        VirtualJoystick.origin.x = touch.startX;
        VirtualJoystick.origin.y = touch.startY;
        VirtualJoystick.current.x = touch.startX;
        VirtualJoystick.current.y = touch.startY;
      }
      // Right side of screen = Button checks
      else {
        for (const key in VirtualButtons) {
          const btn = VirtualButtons[key];
          const dx = touch.startX - btn.x;
          const dy = touch.startY - btn.y;
          if (dx * dx + dy * dy <= btn.radius * btn.radius) {
            btn.touchId = touch.id;
            btn.held = true;
            btn.pressed = true;
          }
        }
      }
    }

    // 3. Handle Active Touch Movement
    if (VirtualJoystick.active) {
      const activeTouch = Input.touches.get(VirtualJoystick.touchId);
      if (activeTouch) {
        VirtualJoystick.current.x = activeTouch.x;
        VirtualJoystick.current.y = activeTouch.y;

        // Calculate normalized direction vector
        const dx = activeTouch.x - VirtualJoystick.origin.x;
        const dy = activeTouch.y - VirtualJoystick.origin.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance > 0) {
          // Clamp magnitude to maxRadius for the visual stick, but normalize the axis
          const moveDist = Math.min(distance, VirtualJoystick.maxRadius);
          VirtualJoystick.axis.x = (dx / distance) * (moveDist / VirtualJoystick.maxRadius);
          VirtualJoystick.axis.y = (dy / distance) * (moveDist / VirtualJoystick.maxRadius);
        } else {
          VirtualJoystick.axis.x = 0;
          VirtualJoystick.axis.y = 0;
        }
      }
    }

    // 4. Handle Ended Touches
    for (const touch of Input.touchesEnded) {
      if (touch.id === VirtualJoystick.touchId) {
        VirtualJoystick.active = false;
        VirtualJoystick.touchId = -1;
        VirtualJoystick.axis.x = 0;
        VirtualJoystick.axis.y = 0;
      }

      for (const key in VirtualButtons) {
        const btn = VirtualButtons[key];
        if (btn.touchId === touch.id) {
          btn.held = false;
          btn.released = true;
          btn.touchId = -1;
        }
      }
    }
  },
};
