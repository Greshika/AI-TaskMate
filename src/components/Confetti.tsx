import React, { useEffect, useState } from "react";
import { motion } from "motion/react";

interface ConfettiProps {
  active: boolean;
}

interface Particle {
  id: number;
  x: number;
  y: number;
  color: string;
  size: number;
  rotation: number;
  speedX: number;
  speedY: number;
}

export default function Confetti({ active }: ConfettiProps) {
  const [particles, setParticles] = useState<Particle[]>([]);

  useEffect(() => {
    if (!active) {
      setParticles([]);
      return;
    }

    const colors = ["#6366f1", "#a855f7", "#ec4899", "#3b82f6", "#10b981", "#f59e0b"];
    const newParticles: Particle[] = Array.from({ length: 80 }).map((_, i) => ({
      id: i,
      x: window.innerWidth / 2 + (Math.random() - 0.5) * 100,
      y: window.innerHeight + 20,
      color: colors[Math.floor(Math.random() * colors.length)],
      size: Math.random() * 10 + 6,
      rotation: Math.random() * 360,
      speedX: (Math.random() - 0.5) * 15,
      speedY: -Math.random() * 15 - 10,
    }));

    setParticles(newParticles);

    const interval = setInterval(() => {
      setParticles((prev) =>
        prev
          .map((p) => ({
            ...p,
            x: p.x + p.speedX,
            y: p.y + p.speedY,
            speedY: p.speedY + 0.3, // gravity
            rotation: p.rotation + p.speedX,
          }))
          .filter((p) => p.y < window.innerHeight + 100 && p.x > -100 && p.x < window.innerWidth + 100)
      );
    }, 16);

    const timeout = setTimeout(() => {
      setParticles([]);
    }, 4000);

    return () => {
      clearInterval(interval);
      clearTimeout(timeout);
    };
  }, [active]);

  if (!active || particles.length === 0) return null;

  return (
    <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
      {particles.map((p) => (
        <div
          key={p.id}
          style={{
            position: "absolute",
            left: `${p.x}px`,
            top: `${p.y}px`,
            width: `${p.size}px`,
            height: `${p.size}px`,
            backgroundColor: p.color,
            transform: `rotate(${p.rotation}deg)`,
            borderRadius: Math.random() > 0.5 ? "50%" : "2px",
            opacity: 0.8,
          }}
        />
      ))}
    </div>
  );
}
