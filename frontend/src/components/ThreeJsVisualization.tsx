import { useEffect, useRef } from "react";

declare const THREE: any;

interface ThreeJsVisualizationProps {
  score: number;
  className?: string;
}

export const ThreeJsVisualization = ({ score, className = "" }: ThreeJsVisualizationProps) => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current || typeof window === "undefined") return;

    // Dynamically load Three.js from CDN
    const script = document.createElement("script");
    script.src = "https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js";
    script.onload = () => {
      initScene();
    };
    document.head.appendChild(script);

    const initScene = () => {
      if (!containerRef.current || !window.THREE) return;

      const scene = new window.THREE.Scene();
      scene.background = new window.THREE.Color(0x0a0a0a);
      scene.fog = new window.THREE.Fog(0x0a0a0a, 8, 0.1);

      const camera = new window.THREE.PerspectiveCamera(
        75,
        containerRef.current.clientWidth / containerRef.current.clientHeight,
        0.1,
        1000
      );
      camera.position.z = 3.5;

      const renderer = new window.THREE.WebGLRenderer({ antialias: true, alpha: true });
      renderer.setSize(containerRef.current.clientWidth, containerRef.current.clientHeight);
      renderer.setPixelRatio(window.devicePixelRatio);
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = window.THREE.PCFShadowShadowMap;
      containerRef.current.appendChild(renderer.domElement);

      // Create multiple rotating geometries for sexier effect
      const sphereGeom = new window.THREE.IcosahedronGeometry(0.8, 4);
      const sphereMat = new window.THREE.MeshPhongMaterial({
        color: new window.THREE.Color().setHSL(0, 1, 0.5), // Pure red
        emissive: new window.THREE.Color().setHSL(0, 1, 0.3),
        shininess: 100,
        wireframe: false,
      });
      const sphere = new window.THREE.Mesh(sphereGeom, sphereMat);
      sphere.position.x = -1.2;
      sphere.castShadow = true;
      sphere.receiveShadow = true;
      scene.add(sphere);

      // Rotating ring
      const torusGeom = new window.THREE.TorusGeometry(0.9, 0.15, 32, 100);
      const torusMat = new window.THREE.MeshPhongMaterial({
        color: new window.THREE.Color().setHSL(0.05, 0.9, 0.55), // Orange
        emissive: new window.THREE.Color().setHSL(0.05, 0.8, 0.35),
        shininess: 100,
      });
      const torus = new window.THREE.Mesh(torusGeom, torusMat);
      torus.position.x = 1.2;
      torus.castShadow = true;
      torus.receiveShadow = true;
      scene.add(torus);

      // Central orb
      const orbGeom = new window.THREE.SphereGeometry(0.35, 32, 32);
      const orbMat = new window.THREE.MeshPhongMaterial({
        color: new window.THREE.Color().setHSL(0, 0.8, 0.45),
        emissive: new window.THREE.Color().setHSL(0, 1, 0.5),
        shininess: 150,
      });
      const orb = new window.THREE.Mesh(orbGeom, orbMat);
      orb.position.z = 0;
      orb.castShadow = true;
      orb.receiveShadow = true;
      scene.add(orb);

      // Octahedron
      const octaGeom = new window.THREE.OctahedronGeometry(0.6, 0);
      const octaMat = new window.THREE.MeshPhongMaterial({
        color: new window.THREE.Color().setHSL(0.02, 1, 0.4),
        emissive: new window.THREE.Color().setHSL(0.02, 1, 0.3),
        shininess: 200,
        wireframe: false,
      });
      const octahedron = new window.THREE.Mesh(octaGeom, octaMat);
      octahedron.position.y = 1.2;
      octahedron.castShadow = true;
      octahedron.receiveShadow = true;
      scene.add(octahedron);

      // Tetrahedron
      const tetraGeom = new window.THREE.TetrahedronGeometry(0.5, 0);
      const tetraMat = new window.THREE.MeshPhongMaterial({
        color: new window.THREE.Color().setHSL(0.015, 0.95, 0.45),
        emissive: new window.THREE.Color().setHSL(0.015, 1, 0.35),
        shininess: 180,
      });
      const tetrahedron = new window.THREE.Mesh(tetraGeom, tetraMat);
      tetrahedron.position.y = -1.2;
      tetrahedron.castShadow = true;
      tetrahedron.receiveShadow = true;
      scene.add(tetrahedron);

      // Dramatic lighting
      const mainLight = new window.THREE.PointLight(0xff6b35, 2);
      mainLight.position.set(5, 5, 5);
      mainLight.castShadow = true;
      mainLight.shadow.mapSize.width = 2048;
      mainLight.shadow.mapSize.height = 2048;
      scene.add(mainLight);

      const blueLight = new window.THREE.PointLight(0x0066ff, 1.5);
      blueLight.position.set(-5, -3, 4);
      scene.add(blueLight);

      const redLight = new window.THREE.PointLight(0xff1744, 1.2);
      redLight.position.set(3, -5, 3);
      scene.add(redLight);

      const ambientLight = new window.THREE.AmbientLight(0xffffff, 0.3);
      scene.add(ambientLight);

      // Particles for extra sexiness
      const particleCount = 50;
      const particles = new window.THREE.BufferGeometry();
      const posArray = new Float32Array(particleCount * 3);

      for (let i = 0; i < particleCount * 3; i += 3) {
        posArray[i] = (Math.random() - 0.5) * 6;
        posArray[i + 1] = (Math.random() - 0.5) * 6;
        posArray[i + 2] = (Math.random() - 0.5) * 6;
      }

      particles.setAttribute("position", new window.THREE.BufferAttribute(posArray, 3));
      const particleMat = new window.THREE.PointsMaterial({
        color: 0xff4444,
        size: 0.05,
        sizeAttenuation: true,
      });
      const particleSystem = new window.THREE.Points(particles, particleMat);
      scene.add(particleSystem);

      let time = 0;

      // Animation loop
      const animate = () => {
        requestAnimationFrame(animate);
        time += 0.01;

        // Rotation speed based on score
        const rotationSpeed = (score / 100) * 0.04 + 0.008;

        // Rotate all objects
        sphere.rotation.x += rotationSpeed * 1.2;
        sphere.rotation.y += rotationSpeed;
        sphere.rotation.z += rotationSpeed * 0.7;

        torus.rotation.y += rotationSpeed * 0.8;
        torus.rotation.x += rotationSpeed * 0.3;

        octahedron.rotation.x += rotationSpeed * 1.5;
        octahedron.rotation.y += rotationSpeed * 0.9;
        octahedron.rotation.z += rotationSpeed * 1.2;

        tetrahedron.rotation.x -= rotationSpeed * 0.7;
        tetrahedron.rotation.y -= rotationSpeed * 1.1;

        // Orb pulses
        const pulseScale = 1 + Math.sin(time * 2) * 0.15;
        orb.scale.set(pulseScale, pulseScale, pulseScale);

        // Floating animation
        sphere.position.y = Math.sin(time * 0.5) * 0.3;
        torus.position.y = Math.cos(time * 0.6) * 0.25;
        octahedron.position.z = Math.sin(time * 0.7) * 0.2;
        tetrahedron.position.z = Math.cos(time * 0.5) * 0.2;

        // Particles movement
        const positions = particles.attributes.position.array as Float32Array;
        for (let i = 0; i < positions.length; i += 3) {
          positions[i] += (Math.random() - 0.5) * 0.05;
          positions[i + 1] += (Math.random() - 0.5) * 0.05;
          positions[i + 2] += (Math.random() - 0.5) * 0.05;

          // Wrap around
          if (Math.abs(positions[i]) > 3) positions[i] *= -0.9;
          if (Math.abs(positions[i + 1]) > 3) positions[i + 1] *= -0.9;
          if (Math.abs(positions[i + 2]) > 3) positions[i + 2] *= -0.9;
        }
        particles.attributes.position.needsUpdate = true;

        // Camera orbit
        const cameraDistance = 3.5 + Math.sin(time * 0.3) * 0.5;
        camera.position.x = Math.sin(time * 0.2) * cameraDistance * 0.3;
        camera.position.z = cameraDistance;
        camera.lookAt(0, 0, 0);

        renderer.render(scene, camera);
      };
      animate();

      // Handle resize
      const handleResize = () => {
        if (!containerRef.current) return;
        const width = containerRef.current.clientWidth;
        const height = containerRef.current.clientHeight;
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
        renderer.setSize(width, height);
      };
      window.addEventListener("resize", handleResize);

      // Cleanup
      return () => {
        window.removeEventListener("resize", handleResize);
        if (containerRef.current && renderer.domElement.parentNode === containerRef.current) {
          containerRef.current.removeChild(renderer.domElement);
        }
      };
    };

    return () => {
      document.head.removeChild(script);
    };
  }, [score]);

  return (
    <div
      ref={containerRef}
      className={`w-full rounded-lg overflow-hidden border border-red-500/30 ${className}`}
      style={{
        height: "400px",
        background:
          "linear-gradient(135deg, rgba(10,10,10,0.95) 0%, rgba(20,5,5,0.9) 50%, rgba(10,10,20,0.95) 100%)",
      }}
    />
  );
};
