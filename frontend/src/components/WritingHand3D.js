import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';

// A genuinely-3D hand+pen (real WebGL geometry, lighting, and depth via `three` — no
// external model asset to source/license, since none of the free options found were a
// good fit; low-poly/stylized rather than a scanned or rigged hand, but actually
// three-dimensional, not an image). Rendered in its own tiny scene/canvas rather than
// TalkingHead's, since it needs to live inline in the text flow next to the currently-
// typing line, not in the avatar's fixed viewport.
const WritingHand3D = () => {
  const containerRef = useRef(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return undefined;

    const width = 46;
    const height = 42;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(32, width / height, 0.1, 100);
    camera.position.set(0, 0.25, 4.4);
    camera.lookAt(0, 0, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    container.appendChild(renderer.domElement);

    scene.add(new THREE.AmbientLight(0xffffff, 0.7));
    const keyLight = new THREE.DirectionalLight(0xffffff, 0.9);
    keyLight.position.set(2, 3, 4);
    scene.add(keyLight);
    const rimLight = new THREE.DirectionalLight(0x8ec9c2, 0.35);
    rimLight.position.set(-2, -1, -3);
    scene.add(rimLight);

    const group = new THREE.Group();
    scene.add(group);

    // Pen: shaft + accent band + tip, tilted like it's actually being held.
    const penGroup = new THREE.Group();
    const shaft = new THREE.Mesh(
      new THREE.CylinderGeometry(0.065, 0.065, 2.3, 14),
      new THREE.MeshStandardMaterial({ color: 0x1f2937, roughness: 0.4, metalness: 0.15 })
    );
    penGroup.add(shaft);

    const band = new THREE.Mesh(
      new THREE.CylinderGeometry(0.08, 0.08, 0.2, 14),
      new THREE.MeshStandardMaterial({ color: 0x2dd4bf, roughness: 0.3 })
    );
    band.position.y = -0.85;
    penGroup.add(band);

    const tip = new THREE.Mesh(
      new THREE.ConeGeometry(0.065, 0.3, 14),
      new THREE.MeshStandardMaterial({ color: 0x0f766e, roughness: 0.4 })
    );
    tip.position.y = -1.28;
    penGroup.add(tip);

    penGroup.rotation.z = Math.PI / 5.2;
    penGroup.position.set(0.12, 0.2, 0.15);
    group.add(penGroup);

    // Hand: a loose cluster of soft-shaded forms — a palm plus a few finger knuckles
    // curled over the pen — rather than an anatomically precise mesh.
    const handMaterial = new THREE.MeshStandardMaterial({ color: 0xd9b38c, roughness: 0.7 });
    const palm = new THREE.Mesh(new THREE.SphereGeometry(0.62, 16, 16), handMaterial);
    palm.scale.set(1, 0.78, 0.82);
    palm.position.set(0, -0.55, 0);
    group.add(palm);

    const thumb = new THREE.Mesh(new THREE.CapsuleGeometry(0.16, 0.35, 4, 8), handMaterial);
    thumb.rotation.z = Math.PI / 3.2;
    thumb.position.set(-0.42, -0.15, 0.25);
    group.add(thumb);

    const fingerPositions = [
      [-0.28, 0.08, 0.18],
      [-0.02, 0.16, 0.2],
      [0.22, 0.12, 0.16],
      [0.44, -0.02, 0.08],
    ];
    fingerPositions.forEach(([x, y, z]) => {
      const finger = new THREE.Mesh(new THREE.SphereGeometry(0.23, 12, 12), handMaterial);
      finger.position.set(x, y, z);
      group.add(finger);
    });

    group.rotation.x = 0.18;
    group.rotation.y = -0.15;
    group.scale.setScalar(0.82);

    let frameId;
    const clock = new THREE.Clock();
    const animate = () => {
      const t = clock.getElapsedTime();
      // Natural writing wobble: small rotation + bob, same rhythm the old 2D icon used,
      // but now genuinely rotating a 3D form so the depth/shading actually shifts too.
      group.rotation.z = Math.sin(t * 5) * 0.14;
      group.position.y = Math.sin(t * 5) * 0.05;
      group.position.x = Math.sin(t * 2.5) * 0.03;
      renderer.render(scene, camera);
      frameId = requestAnimationFrame(animate);
    };
    animate();

    return () => {
      cancelAnimationFrame(frameId);
      renderer.dispose();
      scene.traverse((object) => {
        if (object.geometry) object.geometry.dispose();
        if (object.material) object.material.dispose();
      });
      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  return <div ref={containerRef} className="whiteboard-hand-3d" aria-hidden="true" />;
};

export default WritingHand3D;
