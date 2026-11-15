/**
 * Phone tilt, as a smooth x/y value from -1 to 1 in screen directions
 * (x: right is positive, y: toward the bottom of the screen is positive).
 * "Level" is however the phone was held when tilt first came in, or when
 * `recalibrate` is called, so people can hold it at a comfortable angle.
 *
 * Android sends tilt freely. iPhones only send it after `requestTilt()` is
 * called from a tap and the person allows motion access.
 */

export interface Tilt {
  x: number;
  y: number;
  /** True once real tilt data has arrived. */
  active: boolean;
}

const RANGE = 30; // degrees of tilt for full strength

let baseY: number | null = null;
let rawX = 0;
let rawY = 0;

export function recalibrate(): void {
  baseY = null;
}

export function trackTilt(tilt: Tilt): (dt: number) => void {
  addEventListener('deviceorientation', (e) => {
    if (e.beta == null || e.gamma == null) return;
    // Turn device angles into screen directions for the current rotation.
    const angle = screen.orientation?.angle ?? 0;
    let sx = e.gamma;
    let sy = e.beta;
    if (angle === 90) {
      sx = e.beta;
      sy = -e.gamma;
    } else if (angle === 270) {
      sx = -e.beta;
      sy = e.gamma;
    } else if (angle === 180) {
      sx = -e.gamma;
      sy = -e.beta;
    }
    if (baseY === null) baseY = sy;
    rawX = Math.max(-1, Math.min(1, sx / RANGE));
    rawY = Math.max(-1, Math.min(1, (sy - baseY) / RANGE));
    tilt.active = true;
  });
  screen.orientation?.addEventListener('change', recalibrate);

  // Call once per frame to ease toward the latest reading.
  return (dt) => {
    const k = Math.min(1, dt * 10);
    tilt.x += (rawX - tilt.x) * k;
    tilt.y += (rawY - tilt.y) * k;
  };
}

/** Ask for motion access where the browser requires it (iPhone). Call from a tap. */
export async function requestTilt(): Promise<boolean> {
  const D = (window as unknown as { DeviceOrientationEvent?: { requestPermission?: () => Promise<string> } })
    .DeviceOrientationEvent;
  if (!D) return false;
  if (typeof D.requestPermission === 'function') {
    try {
      return (await D.requestPermission()) === 'granted';
    } catch {
      return false;
    }
  }
  return true;
}
