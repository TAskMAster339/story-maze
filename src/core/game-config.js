// Runtime settings shared by the game modules.
// Override these values in a project-specific config before loading the runtime.
window.GAME_CONFIG = {
  debug: false,
  render: {
    maxPixelRatio: 1.5,
    maxAnisotropy: 4,
    shadows: true,
  },
  player: {
    walkSpeed: 6,
    runSpeed: 10,
    lookSensitivity: 0.0022,
    maxMouseDelta: 80,
  },
};
