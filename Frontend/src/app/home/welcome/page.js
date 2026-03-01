"use client";

import React, { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { auth } from "../../../lib/Firebase";
import { fetchUserDetails } from "@/services/userServices";
import Navbar from "@/Components/common/Navbar";
import { motion } from "framer-motion";

const ParticleBackground = () => {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    const particles = [];

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    class Particle {
      constructor() {
        this.x = Math.random() * canvas.width;
        this.y = Math.random() * canvas.height;
        this.size = Math.random() * 2 + 1;
        this.speedX = Math.random() * 0.5 - 0.25;
        this.speedY = Math.random() * 0.5 - 0.25;
        this.color = "#00ffa3";
        this.opacity = Math.random() * 0.5 + 0.1;
      }

      update() {
        this.x += this.speedX;
        this.y += this.speedY;

        if (this.x < 0 || this.x > canvas.width) this.speedX *= -1;
        if (this.y < 0 || this.y > canvas.height) this.speedY *= -1;
      }

      draw() {
        ctx.fillStyle = this.color;
        ctx.globalAlpha = this.opacity;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    const createParticles = () => {
      for (let i = 0; i < 100; i++) {
        particles.push(new Particle());
      }
    };

    const connectParticles = () => {
      for (let i = 0; i < particles.length; i++) {
        for (let j = i; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const distance = Math.sqrt(dx * dx + dy * dy);

          if (distance < 100) {
            ctx.beginPath();
            ctx.strokeStyle = "#00ffa3";
            ctx.globalAlpha = 0.1;
            ctx.lineWidth = 1;
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.stroke();
          }
        }
      }
    };

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      for (let i = 0; i < particles.length; i++) {
        particles[i].update();
        particles[i].draw();
      }

      connectParticles();
      requestAnimationFrame(animate);
    };

    createParticles();
    animate();

    const handleResize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };

    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  return <canvas ref={canvasRef} className="absolute top-0 left-0 w-full h-full" />;
};

const WelcomeScreen = () => {
  const router = useRouter();
  const [name, setName] = useState("")
  useEffect(() => {
      const unsubscribe = auth.onAuthStateChanged(async (user) => {
        if (user) {
          try {
            const userDetails = await fetchUserDetails(user.uid);
            const userData = userDetails?.data || userDetails;
            if (userData && userData.name) {
              console.log("Fetched user details:", userData); // Debugging
              const firstName = userData.name.split(' ')[0];
              setName(firstName);
            }
          } catch (error) {
            console.error("Error fetching user data:", error.message);
          }
        }
      });
  
      return () => unsubscribe();
    }, []);
  
  const handleZone = (zone) => {
    router.push(`/home/feed`);
  };

  return (
    <div className="flex flex-col min-h-screen bg-black text-white relative overflow-hidden">
      <Navbar />
      <div className="flex flex-col items-center justify-center flex-1 relative">
        <ParticleBackground />

        <div className="text-center space-y-6 relative z-10">
          <motion.h1 
            className="text-5xl font-semibold"
            initial={{ opacity: 0, y: -30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
          >
            Hello <span className="text-emerald-400">{name}</span>
          </motion.h1>
          <motion.h2 
            className="text-6xl font-bold text-emerald-400"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.3, ease: "easeOut" }}
          >
            Welcome to Gradus
          </motion.h2>

          <motion.div 
            className="mt-16"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, delay: 0.6, ease: "easeOut" }}
          >
            <div className="flex space-x-4 justify-center">
              <button
                className="px-8 py-4 bg-green-400 text-black rounded-full text-xl font-semibold hover:bg-opacity-90 transition-all transform hover:scale-105"
                onClick={() => handleZone("academia")}
              >
                Launch Study Mode
              </button>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
};

export default WelcomeScreen;