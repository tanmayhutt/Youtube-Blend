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

      const camera = new window.THREE.PerspectiveCamera(
        75,
        containerRef.current.clientWidth / containerRef.current.clientHeight,
        0.1,
        1000
      );
      camera.position.z = 3;

      const renderer = new window.THREE.WebGLRenderer({ antialias: true, alpha: true });
      renderer.setSize(containerRef.current.clientWidth, containerRef.current.clientHeight);
      renderer.setPixelRatio(window.devicePixelRatio);
      containerRef.current.appendChild(renderer.domElement);

      // Create rotating cube and torus based on compatibility score
      const geometry1 = new window.THREE.BoxGeometry(1, 1, 1);
      const material1 = new window.THREE.MeshPhongMaterial({
        color: new window.THREE.Color().setHSL(0.02, 1, 0.5), // Red
        wireframe: false,
      });
      const cube = new window.THREE.Mesh(geometry1, material1);
      cube.position.x = -1.5;
      scene.add(cube);

      const geometry2 = new window.THREE.TorusGeometry(0.7, 0.2, 16, 100);
      const material2 = new window.THREE.MeshPhongMaterial({
        color: new window.THREE.Color().setHSL(0.02, 0.85, 0.6), // Orange
      });
      const torus = new window.THREE.Mesh(geometry2, material2);
      torus.position.x = 1.5;
      scene.add(torus);

      // Add lights
      const light1 = new window.THREE.PointLight(0xff4444, 1.5);
      light1.position.set(5, 5, 5);
      scene.add(light1);

      const light2 = new window.THREE.PointLight(0x4444ff, 1);
      light2.position.set(-5, -5, 5);
      scene.add(light2);

      const ambientLight = new window.THREE.AmbientLight(0xffffff, 0.4);
      scene.add(ambientLight);

      // Animation loop
      const animate = () => {
        requestAnimationFrame(animate);

        // Rotate based on score (higher score = faster rotation)
        const rotationSpeed = (score / 100) * 0.02 + 0.005;
        cube.rotation.x += rotationSpeed;
        cube.rotation.y += rotationSpeed;
        torus.rotation.y += rotationSpeed * 0.7;

        // Scale pulsing based on score
        const scale = 1 + Math.sin(Date.now() * 0.002) * ((score / 100) * 0.2 + 0.05);
        cube.scale.set(scale, scale, scale);
        torus.scale.set(scale * 0.9, scale * 0.9, scale * 0.9);

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
        containerRef.current?.removeChild(renderer.domElement);
      };
    };

    return () => {
      // Cleanup script
      document.head.removeChild(script);
    };
  }, [score]);

  return (
    <div
      ref={containerRef}
      className={`w-full rounded-lg overflow-hidden border border-border/50 ${className}`}
      style={{ height: "300px", background: "linear-gradient(135deg, rgba(10,10,10,0.9) 0%, rgba(20,10,10,0.8) 100%)" }}
    />
  );
};
