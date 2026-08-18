"use client";

import { useEffect, useRef, useState } from "react";

export default function About({ data }) {
  const [stats, setStats] = useState({
    exp: 0,
    projects: 0,
    tech: 0,
  });
  const sectionRef = useRef(null);
  const animatedRef = useRef(false);

  useEffect(() => {
    if (!data) return;
    const section = sectionRef.current;
    if (!section) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (entry.isIntersecting && !animatedRef.current) {
          animatedRef.current = true;
          animateCounters();
          observer.unobserve(section);
        }
      },
      { threshold: 0.3 }
    );

    observer.observe(section);

    function animateCounters() {
      const duration = 1600;
      const startTime = performance.now();
      const targets = data.stats || { exp: 6, projects: 80, tech: 30 };

      function step(now) {
        const elapsed = now - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const ease = 1 - Math.pow(1 - progress, 3); // Cubic ease out

        setStats({
          exp: Math.floor(ease * targets.exp),
          projects: Math.floor(ease * targets.projects),
          tech: Math.floor(ease * targets.tech),
        });

        if (progress < 1) {
          requestAnimationFrame(step);
        }
      }

      requestAnimationFrame(step);
    }

    return () => {
      if (section) observer.disconnect();
    };
  }, [data]);

  if (!data) return null;

  return (
    <section id="about" ref={sectionRef}>
      <div className="section-inner">
        <div className="about-grid">
          <div className="about-text reveal">
            <div className="section-label">About me</div>
            <h2 className="section-title">
              {data.titleLine1}
              <br />
              {data.titleLine2}
            </h2>
            <p dangerouslySetInnerHTML={{ __html: data.p1 }} />
            <p dangerouslySetInnerHTML={{ __html: data.p2 }} />
            <div className="about-focus">
              <strong>Currently focused on:</strong> {data.focus}
            </div>
          </div>
          <div className="stats-grid reveal reveal-delay-2">
            <div className="stat-card">
              <div className="stat-number">{stats.exp}+</div>
              <div className="stat-label">Years Experience</div>
            </div>
            <div className="stat-card">
              <div className="stat-number">{stats.projects}+</div>
              <div className="stat-label">Projects</div>
            </div>
            <div className="stat-card">
              <div className="stat-number">{stats.tech}+</div>
              <div className="stat-label">Technologies</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
