// Reusable procedural texture factory. Keeps the demo self-contained and avoids external asset requests.
(function attachTextureSystem(global) {
  const THREE = global.THREE;
  const textureCache = new Map();

  function getCachedTexture(kind, options, factory) {
    const key = `${kind}:${JSON.stringify(options)}`;
    if (!textureCache.has(key)) textureCache.set(key, factory());
    return textureCache.get(key);
  }

  function makeCanvasTexture(draw, options = {}) {
    const size = options.size ?? 128;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    draw(canvas.getContext("2d"), size);

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(options.repeatX ?? 1, options.repeatY ?? 1);
    texture.anisotropy = options.anisotropy ?? 1;
    texture.needsUpdate = true;
    return texture;
  }

  function seededNoise(seed) {
    let state = seed >>> 0;
    return () => {
      state = (1664525 * state + 1013904223) >>> 0;
      return state / 4294967296;
    };
  }

  function createWallTexture(options = {}) {
    const textureOptions = { ...options, repeatX: options.repeatX ?? 1, repeatY: options.repeatY ?? 1 };
    return getCachedTexture("wall", textureOptions, () => makeCanvasTexture((ctx, size) => {
      const random = seededNoise(options.seed ?? 19);
      ctx.fillStyle = options.base ?? "#684226";
      ctx.fillRect(0, 0, size, size);

      for (let i = 0; i < 700; i += 1) {
        const value = Math.floor(45 + random() * 55);
        ctx.fillStyle = `rgba(${value + 25}, ${value}, ${value - 18}, ${0.08 + random() * 0.18})`;
        const x = random() * size;
        const y = random() * size;
        const w = 1 + random() * 9;
        const h = 1 + random() * 4;
        ctx.fillRect(x, y, w, h);
      }

      ctx.strokeStyle = "rgba(32, 18, 10, 0.34)";
      ctx.lineWidth = 2;
      for (let y = 18; y < size; y += 32) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(size, y);
        ctx.stroke();
      }
      ctx.strokeStyle = "rgba(255, 210, 150, 0.08)";
      ctx.lineWidth = 1;
      for (let x = 0; x < size; x += 32) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, size);
        ctx.stroke();
      }
    }, textureOptions));
  }

  function createFloorTexture(options = {}) {
    const textureOptions = { ...options, repeatX: options.repeatX ?? 24, repeatY: options.repeatY ?? 24 };
    return getCachedTexture("floor", textureOptions, () => makeCanvasTexture((ctx, size) => {
      const random = seededNoise(options.seed ?? 77);
      ctx.fillStyle = options.base ?? "#25252a";
      ctx.fillRect(0, 0, size, size);
      for (let i = 0; i < 1100; i += 1) {
        const shade = Math.floor(35 + random() * 35);
        ctx.fillStyle = `rgba(${shade}, ${shade}, ${shade + 5}, ${0.1 + random() * 0.16})`;
        ctx.fillRect(random() * size, random() * size, 1 + random() * 3, 1 + random() * 3);
      }
      ctx.strokeStyle = "rgba(160, 170, 190, 0.08)";
      ctx.lineWidth = 1;
      for (let p = 0; p <= size; p += 32) {
        ctx.beginPath();
        ctx.moveTo(p, 0);
        ctx.lineTo(p, size);
        ctx.moveTo(0, p);
        ctx.lineTo(size, p);
        ctx.stroke();
      }
    }, textureOptions));
  }

  function disposeTexture(texture) {
    if (!texture) return;
    texture.dispose();
    for (const [key, cached] of textureCache) {
      if (cached === texture) textureCache.delete(key);
    }
  }

  global.textureSystem = { createWallTexture, createFloorTexture, disposeTexture };
})(window);
