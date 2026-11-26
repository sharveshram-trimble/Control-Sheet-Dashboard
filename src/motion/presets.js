/**
 * Shared Trimble Corporate + thin Premium motion kit.
 * Signature easing: cubic-bezier(0.2, 0, 0, 1)
 * Durations: 120 / 220 / 320 / 480ms — transform + opacity only.
 */

export const easeBrand = [0.2, 0, 0, 1];

export const duration = {
  micro: 0.12,
  ui: 0.22,
  panel: 0.32,
  enter: 0.48,
};

export const staggerMs = 0.048;
export const STAGGER_CAP = 14;

export const drawerSpring = {
  type: 'spring',
  stiffness: 320,
  damping: 28,
};

export function fadeUp(reduceMotion, distance = 10) {
  if (reduceMotion) {
    return {
      initial: false,
      animate: { opacity: 1, y: 0 },
      exit: { opacity: 0 },
      transition: { duration: duration.micro },
    };
  }
  return {
    initial: { opacity: 0, y: distance },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -6 },
    transition: { duration: duration.ui, ease: easeBrand },
  };
}

export function bootDrop(reduceMotion) {
  if (reduceMotion) {
    return {
      initial: false,
      animate: { opacity: 1, y: 0 },
      transition: { duration: duration.micro },
    };
  }
  return {
    initial: { opacity: 0, y: -8 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: duration.panel, ease: easeBrand },
  };
}

export function staggerContainer(reduceMotion) {
  return {
    hidden: {},
    show: {
      transition: reduceMotion
        ? { staggerChildren: 0 }
        : { staggerChildren: staggerMs, delayChildren: 0.06 },
    },
  };
}

export function staggerItem(reduceMotion, index = 0) {
  const capped = index >= STAGGER_CAP;
  if (reduceMotion || capped) {
    return {
      hidden: { opacity: 1, y: 0 },
      show: { opacity: 1, y: 0 },
      exit: { opacity: 0 },
    };
  }
  return {
    hidden: { opacity: 0, y: 12 },
    show: {
      opacity: 1,
      y: 0,
      transition: { duration: duration.panel, ease: easeBrand },
    },
    exit: {
      opacity: 0,
      y: -8,
      transition: { duration: duration.micro },
    },
  };
}

export function chipPop(reduceMotion) {
  if (reduceMotion) {
    return {
      initial: false,
      animate: { opacity: 1, scale: 1 },
      exit: { opacity: 0 },
      transition: { duration: duration.micro },
    };
  }
  return {
    initial: { opacity: 0, scale: 0.96 },
    animate: { opacity: 1, scale: 1 },
    exit: { opacity: 0, scale: 0.96 },
    transition: { duration: duration.ui, ease: easeBrand },
  };
}

export function modalContent(reduceMotion) {
  if (reduceMotion) {
    return {
      initial: false,
      animate: { opacity: 1, y: 0 },
      transition: { duration: duration.micro },
    };
  }
  return {
    initial: { opacity: 0, y: 10 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: duration.panel, ease: easeBrand },
  };
}

export { drawerSpring as assistDrawerSpring };
