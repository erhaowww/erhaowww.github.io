/* ===========================================================
   3D background + interactions
   - Three.js neon particle field that reacts to mouse + scroll
   - Scroll-reveal animations, cursor glow, mobile menu
   =========================================================== */
(() => {
  "use strict";

  const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------------- THREE.JS PARTICLE FIELD ---------------- */
  function initScene() {
    const canvas = document.getElementById("bg-canvas");
    if (!canvas || typeof THREE === "undefined") return;

    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x060814, 0.0011);

    const camera = new THREE.PerspectiveCamera(
      70,
      window.innerWidth / window.innerHeight,
      1,
      2000
    );
    camera.position.z = 500;

    const renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true,
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(window.innerWidth, window.innerHeight);

    /* ----- Particle cloud ----- */
    const COUNT = window.innerWidth < 768 ? 2200 : 5000;
    const positions = new Float32Array(COUNT * 3);
    const colors = new Float32Array(COUNT * 3);

    const palette = [
      new THREE.Color(0x64ffda), // mint
      new THREE.Color(0x7c5cff), // violet
      new THREE.Color(0x4d9bff), // blue
      new THREE.Color(0xffffff), // white sparkle
    ];

    for (let i = 0; i < COUNT; i++) {
      const i3 = i * 3;
      positions[i3] = (Math.random() - 0.5) * 1600;
      positions[i3 + 1] = (Math.random() - 0.5) * 1600;
      positions[i3 + 2] = (Math.random() - 0.5) * 1600;

      const c = palette[Math.floor(Math.random() * palette.length)];
      colors[i3] = c.r;
      colors[i3 + 1] = c.g;
      colors[i3 + 2] = c.b;
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));

    // Soft round sprite so particles look like glowing dots, not squares
    const sprite = makeCircleTexture();
    const material = new THREE.PointsMaterial({
      size: 4.5,
      map: sprite,
      vertexColors: true,
      transparent: true,
      opacity: 0.9,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      sizeAttenuation: true,
    });

    const points = new THREE.Points(geometry, material);
    scene.add(points);

    /* ----- A few wireframe shapes for depth ----- */
    const shapes = [];
    const shapeDefs = [
      { geo: new THREE.IcosahedronGeometry(60, 0), pos: [-380, 160, -200] },
      { geo: new THREE.TorusGeometry(50, 14, 12, 30), pos: [420, -120, -120] },
      { geo: new THREE.OctahedronGeometry(45, 0), pos: [260, 220, -260] },
    ];
    shapeDefs.forEach((d, i) => {
      const mat = new THREE.MeshBasicMaterial({
        color: i % 2 ? 0x7c5cff : 0x64ffda,
        wireframe: true,
        transparent: true,
        opacity: 0.25,
      });
      const mesh = new THREE.Mesh(d.geo, mat);
      mesh.position.set(...d.pos);
      scene.add(mesh);
      shapes.push(mesh);
    });

    /* ----- Pointer + scroll state ----- */
    const mouse = { x: 0, y: 0, tx: 0, ty: 0 };
    let scrollY = 0;

    window.addEventListener("pointermove", (e) => {
      mouse.tx = (e.clientX / window.innerWidth - 0.5) * 2;
      mouse.ty = (e.clientY / window.innerHeight - 0.5) * 2;
    });
    window.addEventListener(
      "scroll",
      () => { scrollY = window.scrollY; },
      { passive: true }
    );

    /* ----- Resize ----- */
    window.addEventListener("resize", () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    });

    /* ----- Animation loop ----- */
    const clock = new THREE.Clock();
    function animate() {
      requestAnimationFrame(animate);
      const t = clock.getElapsedTime();

      // Ease the camera toward the pointer for parallax
      mouse.x += (mouse.tx - mouse.x) * 0.04;
      mouse.y += (mouse.ty - mouse.y) * 0.04;
      camera.position.x += (mouse.x * 120 - camera.position.x) * 0.05;
      camera.position.y += (-mouse.y * 120 - camera.position.y) * 0.05;
      camera.lookAt(scene.position);

      // Slow drift + gentle scroll-driven rotation
      points.rotation.y = t * 0.02 + scrollY * 0.0004;
      points.rotation.x = Math.sin(t * 0.05) * 0.1;

      shapes.forEach((s, i) => {
        s.rotation.x = t * (0.1 + i * 0.05);
        s.rotation.y = t * (0.15 + i * 0.04);
      });

      renderer.render(scene, camera);
    }

    if (prefersReduced) {
      renderer.render(scene, camera); // single static frame
    } else {
      animate();
    }
  }

  // Build a soft circular texture in code (no external assets needed)
  function makeCircleTexture() {
    const size = 64;
    const cv = document.createElement("canvas");
    cv.width = cv.height = size;
    const ctx = cv.getContext("2d");
    const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    g.addColorStop(0, "rgba(255,255,255,1)");
    g.addColorStop(0.4, "rgba(255,255,255,0.6)");
    g.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
    const tex = new THREE.Texture(cv);
    tex.needsUpdate = true;
    return tex;
  }

  /* ---------------- SCROLL REVEAL ---------------- */
  function initReveal() {
    const els = document.querySelectorAll(".reveal");
    if (prefersReduced || !("IntersectionObserver" in window)) {
      els.forEach((el) => el.classList.add("is-visible"));
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry, i) => {
          if (entry.isIntersecting) {
            // small stagger for siblings
            setTimeout(() => entry.target.classList.add("is-visible"), i * 60);
            io.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12 }
    );
    els.forEach((el) => io.observe(el));
  }

  /* ---------------- CURSOR GLOW ---------------- */
  function initCursor() {
    const glow = document.getElementById("cursorGlow");
    if (!glow || window.matchMedia("(hover: none)").matches) return;
    let x = 0, y = 0, cx = 0, cy = 0;
    window.addEventListener("pointermove", (e) => { x = e.clientX; y = e.clientY; });
    (function follow() {
      cx += (x - cx) * 0.2;
      cy += (y - cy) * 0.2;
      glow.style.transform = `translate(${cx}px, ${cy}px) translate(-50%, -50%)`;
      requestAnimationFrame(follow);
    })();
    document.querySelectorAll("a, button, .skill-card, .project").forEach((el) => {
      el.addEventListener("mouseenter", () => glow.classList.add("is-hover"));
      el.addEventListener("mouseleave", () => glow.classList.remove("is-hover"));
    });
  }

  /* ---------------- MOBILE MENU ---------------- */
  function initMenu() {
    const nav = document.querySelector(".nav");
    const burger = document.getElementById("burger");
    if (!nav || !burger) return;
    burger.addEventListener("click", () => nav.classList.toggle("is-open"));
    nav.querySelectorAll(".nav__links a").forEach((a) =>
      a.addEventListener("click", () => nav.classList.remove("is-open"))
    );
  }

  /* ---------------- INIT ---------------- */
  window.addEventListener("DOMContentLoaded", () => {
    const yearEl = document.getElementById("year");
    if (yearEl) yearEl.textContent = new Date().getFullYear();
    initScene();
    initReveal();
    initCursor();
    initMenu();
  });
})();
