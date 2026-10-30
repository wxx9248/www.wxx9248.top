/** Same query as .extra-keys in machine.css. */
const TOUCH_SCREEN = "(pointer: coarse)";

/** A phone or tablet, typed on with an on-screen keyboard. */
export const isTouchScreen = () => matchMedia(TOUCH_SCREEN).matches;
