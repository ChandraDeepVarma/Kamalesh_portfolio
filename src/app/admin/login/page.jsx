"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Logo from "@/components/Logo";

export default function AdminLogin() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  useEffect(() => {
    // Reset body cursor default so user can interact easily
    document.body.style.cursor = "default";
    // Check if already logged in
    fetch("/api/auth/session")
      .then((res) => {
        if (res.ok) {
          router.push("/admin");
        }
      })
      .catch(() => {});
  }, [router]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        router.push("/admin");
      } else {
        setError(data.error || "Invalid username or password");
      }
    } catch (err) {
      setError("An error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.ambientBlob1}></div>
      <div style={styles.ambientBlob2}></div>
      
      <div style={styles.card}>
        <div style={styles.header}>
          <div style={{ display: "flex", justifyContent: "center", marginBottom: "16px" }}>
            <Logo initials="CDVN" style={{ cursor: "default" }} />
          </div>
          <h1 style={styles.title}>Admin Portal</h1>
          <p style={styles.subtitle}>Sign in to manage your portfolio content dynamically</p>
        </div>

        {error && <div style={styles.error}>{error}</div>}

        <form onSubmit={handleSubmit} style={styles.form}>
          <div style={styles.formGroup}>
            <label style={styles.label} htmlFor="username">Mobile Number</label>
            <input
              style={styles.input}
              type="text"
              id="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="9885360325"
              required
            />
          </div>

          <div style={styles.formGroup}>
            <label style={styles.label} htmlFor="password">Password</label>
            <input
              style={styles.input}
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••••••"
              required
            />
          </div>

          <button style={styles.button} type="submit" disabled={loading}>
            {loading ? "Verifying..." : "Access Control Center →"}
          </button>
        </form>

        <div style={styles.footer}>
          <a style={styles.backLink} href="/">← Back to portfolio website</a>
        </div>
      </div>
    </div>
  );
}

const styles = {
  container: {
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "radial-gradient(circle at 50% 50%, #0c0b1e 0%, #030308 100%)",
    padding: "20px",
    fontFamily: "'Plus Jakarta Sans', sans-serif",
    position: "relative",
    overflow: "hidden",
  },
  ambientBlob1: {
    position: "absolute",
    width: "400px",
    height: "400px",
    background: "radial-gradient(circle, rgba(124, 58, 237, 0.15) 0%, transparent 70%)",
    top: "10%",
    left: "15%",
    borderRadius: "50%",
    pointerEvents: "none",
  },
  ambientBlob2: {
    position: "absolute",
    width: "500px",
    height: "500px",
    background: "radial-gradient(circle, rgba(6, 182, 212, 0.12) 0%, transparent 70%)",
    bottom: "10%",
    right: "10%",
    borderRadius: "50%",
    pointerEvents: "none",
  },
  card: {
    width: "100%",
    maxWidth: "440px",
    background: "rgba(17, 17, 39, 0.65)",
    backdropFilter: "blur(16px)",
    WebkitBackdropFilter: "blur(16px)",
    border: "1px solid rgba(255, 255, 255, 0.08)",
    borderRadius: "24px",
    padding: "48px 40px",
    boxShadow: "0 30px 80px rgba(0, 0, 0, 0.6), inset 0 1px 0 rgba(255,255,255,0.1)",
    position: "relative",
    zIndex: 1,
  },
  header: {
    textAlign: "center",
    marginBottom: "32px",
  },
  logo: {
    fontFamily: "'Outfit', sans-serif",
    fontSize: "2.4rem",
    fontWeight: "900",
    background: "linear-gradient(135deg, #c084fc, #22d3ee)",
    WebkitBackgroundClip: "text",
    WebkitTextFillColor: "transparent",
    letterSpacing: "-1.5px",
    marginBottom: "12px",
  },
  title: {
    fontSize: "1.75rem",
    fontWeight: "800",
    color: "#f8fafc",
    marginBottom: "8px",
    letterSpacing: "-0.5px",
  },
  subtitle: {
    fontSize: "0.875rem",
    color: "#94a3b8",
    lineHeight: "1.6",
  },
  form: {
    display: "flex",
    flexDirection: "column",
    gap: "24px",
  },
  formGroup: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
  },
  label: {
    fontSize: "0.75rem",
    fontWeight: "600",
    color: "#a1a1aa",
    letterSpacing: "0.05em",
    textTransform: "uppercase",
  },
  input: {
    background: "rgba(10, 10, 20, 0.8)",
    border: "1px solid rgba(255, 255, 255, 0.08)",
    borderRadius: "12px",
    padding: "16px",
    color: "#f8fafc",
    fontSize: "0.95rem",
    outline: "none",
    transition: "all 0.25s ease",
  },
  error: {
    background: "rgba(239, 68, 68, 0.08)",
    border: "1px solid rgba(239, 68, 68, 0.2)",
    borderRadius: "12px",
    padding: "12px 16px",
    color: "#fca5a5",
    fontSize: "0.85rem",
    marginBottom: "20px",
    textAlign: "center",
  },
  button: {
    padding: "16px",
    background: "linear-gradient(135deg, #8b5cf6, #06b6d4)",
    border: "none",
    borderRadius: "30px",
    color: "#fff",
    fontSize: "0.95rem",
    fontWeight: "700",
    cursor: "pointer",
    boxShadow: "0 8px 24px rgba(139, 92, 246, 0.25)",
    transition: "all 0.25s ease",
    marginTop: "8px",
  },
  footer: {
    textAlign: "center",
    marginTop: "28px",
  },
  backLink: {
    fontSize: "0.875rem",
    color: "#71717a",
    textDecoration: "none",
    transition: "color 0.2s",
  },
};
