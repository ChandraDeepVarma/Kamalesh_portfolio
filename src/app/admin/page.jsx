"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { THEMES } from "@/lib/themes";
import Logo from "@/components/Logo";

function convertToWebP(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0);
        canvas.toBlob(
          (blob) => {
            if (blob) {
              const newName = file.name.replace(/\.[^/.]+$/, "") + ".webp";
              const webpFile = new File([blob], newName, { type: "image/webp" });
              resolve(webpFile);
            } else {
              reject(new Error("Canvas export returned null"));
            }
          },
          "image/webp",
          0.8
        );
      };
      img.onerror = () => reject(new Error("Failed to load image structure"));
      img.src = event.target.result;
    };
    reader.onerror = () => reject(new Error("Failed to read file data"));
    reader.readAsDataURL(file);
  });
}

function FileUploader({ value, onChange, label, accept = "*" }) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  const handleFileChange = async (e) => {
    let file = e.target.files[0];
    if (!file) return;

    setUploading(true);
    setError("");

    if (file.type.startsWith("image/")) {
      try {
        file = await convertToWebP(file);
      } catch (err) {
        console.error("WebP conversion failed, using original file", err);
      }
    }

    const formData = new FormData();
    formData.append("file", file, file.name);

    try {
      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Upload failed");
      }

      const result = await res.json();
      onChange(result.url);
    } catch (err) {
      console.error(err);
      setError(err.message || "Failed to upload file");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "8px", width: "100%" }}>
      <label style={styles.fieldLabel}>{label}</label>
      <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
        <input
          style={{ ...styles.fieldInput, flex: 1 }}
          type="text"
          value={value || ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder="No file uploaded yet..."
        />
        <label
          style={{
            ...styles.btnSecondary,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "0 22px",
            height: "46px",
            boxSizing: "border-box",
            whiteSpace: "nowrap",
            cursor: uploading ? "not-allowed" : "pointer",
            opacity: uploading ? 0.7 : 1,
            position: "relative",
            background: "rgba(255, 255, 255, 0.05)",
            border: "1px dashed rgba(255, 255, 255, 0.2)",
            borderRadius: "10px",
            color: "#e2e8f0",
            fontSize: "0.85rem",
            fontWeight: "600",
            transition: "all 0.2s ease",
          }}
        >
          {uploading ? (
            <span style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span className="spinner-mini" style={styles.spinnerMini}></span>
              Uploading...
            </span>
          ) : (
            "Choose File"
          )}
          <input
            type="file"
            accept={accept}
            onChange={handleFileChange}
            disabled={uploading}
            style={{
              position: "absolute",
              width: "100%",
              height: "100%",
              opacity: 0,
              cursor: "pointer",
              top: 0,
              left: 0,
              display: uploading ? "none" : "block",
            }}
          />
        </label>
      </div>
      {error && <span style={{ color: "#f87171", fontSize: "0.75rem", marginTop: "2px" }}>{error}</span>}
    </div>
  );
}

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState("overview");
  const [data, setData] = useState(null);
  const [messages, setMessages] = useState([]);
  const [selectedMessage, setSelectedMessage] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState({ text: "", type: "" });
  const router = useRouter();

  useEffect(() => {
    // Enable default cursor for forms interaction
    document.body.style.cursor = "default";

    // Authenticate
    fetch("/api/auth/session")
      .then((res) => {
        if (!res.ok) {
          router.push("/admin/login");
        } else {
          // Load data
          fetch("/api/portfolio")
            .then((r) => r.json())
            .then((d) => {
              setData(d);
              // Fetch inbox messages
              fetch("/api/contact")
                .then((r) => r.ok ? r.json() : [])
                .then((m) => {
                  setMessages(m);
                  setLoading(false);
                })
                .catch(() => {
                  setLoading(false);
                });
            })
            .catch(() => {
              setMessage({ text: "Failed to load portfolio content.", type: "error" });
              setLoading(false);
            });
        }
      })
      .catch(() => {
        router.push("/admin/login");
      });
  }, [router]);

  const handleToggleRead = async (msgId, currentRead) => {
    try {
      const res = await fetch("/api/contact", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: msgId, read: !currentRead }),
      });
      if (res.ok) {
        const updated = messages.map(m => m._id === msgId ? { ...m, read: !currentRead } : m);
        setMessages(updated);
        if (selectedMessage && selectedMessage._id === msgId) {
          setSelectedMessage({ ...selectedMessage, read: !currentRead });
        }
      } else {
        const err = await res.json();
        setMessage({ text: err.error || "Failed to update message.", type: "error" });
      }
    } catch (err) {
      setMessage({ text: "Failed to update message.", type: "error" });
    }
  };

  const handleDeleteMessage = async (msgId) => {
    if (!window.confirm("Are you sure you want to delete this message?")) return;
    try {
      const res = await fetch(`/api/contact?id=${msgId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setMessages(messages.filter(m => m._id !== msgId));
        if (selectedMessage && selectedMessage._id === msgId) {
          setSelectedMessage(null);
        }
        setMessage({ text: "Message deleted successfully.", type: "success" });
        setTimeout(() => setMessage({ text: "", type: "" }), 4000);
      } else {
        const err = await res.json();
        setMessage({ text: err.error || "Failed to delete message.", type: "error" });
      }
    } catch (err) {
      setMessage({ text: "Failed to delete message.", type: "error" });
    }
  };

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/admin/login");
  };

  const handleSave = async () => {
    setSaving(true);
    setMessage({ text: "", type: "" });

    try {
      const res = await fetch("/api/portfolio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (res.ok) {
        setMessage({ text: "Portfolio updated successfully!", type: "success" });
        setTimeout(() => setMessage({ text: "", type: "" }), 4000);
      } else {
        const err = await res.json();
        setMessage({ text: err.error || "Failed to update portfolio.", type: "error" });
      }
    } catch (err) {
      setMessage({ text: "Network error occurred.", type: "error" });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div style={styles.loadingContainer}>
        <div style={styles.spinner} />
        <p style={{ marginTop: "20px", color: "#94a3b8", fontWeight: "500", fontSize: "0.95rem" }}>Loading dashboard context...</p>
      </div>
    );
  }

  // --- State Updators ---
  const updateHero = (field, val) => {
    setData({
      ...data,
      hero: { ...data.hero, [field]: val },
    });
  };

  const updateAbout = (field, val) => {
    setData({
      ...data,
      about: { ...data.about, [field]: val },
    });
  };

  const updateAboutStats = (field, val) => {
    setData({
      ...data,
      about: {
        ...data.about,
        stats: { ...data.about.stats, [field]: Number(val) },
      },
    });
  };

  const updateContact = (field, val) => {
    setData({
      ...data,
      contact: { ...data.contact, [field]: val },
    });
  };

  // Lists Mutators: Projects
  const handleProjectChange = (index, field, val) => {
    const updatedProjects = [...data.projects.projects];
    updatedProjects[index] = { ...updatedProjects[index], [field]: val };
    setData({
      ...data,
      projects: { ...data.projects, projects: updatedProjects },
    });
  };

  const handleProjectTagsChange = (index, tagIndex, val) => {
    const updatedProjects = [...data.projects.projects];
    const updatedTags = [...updatedProjects[index].tags];
    updatedTags[tagIndex] = val;
    updatedProjects[index] = { ...updatedProjects[index], tags: updatedTags };
    setData({
      ...data,
      projects: { ...data.projects, projects: updatedProjects },
    });
  };

  const addProjectTag = (index) => {
    const updatedProjects = [...data.projects.projects];
    const updatedTags = [...updatedProjects[index].tags, "New Tag"];
    updatedProjects[index] = { ...updatedProjects[index], tags: updatedTags };
    setData({
      ...data,
      projects: { ...data.projects, projects: updatedProjects },
    });
  };

  const removeProjectTag = (index, tagIndex) => {
    const updatedProjects = [...data.projects.projects];
    const updatedTags = updatedProjects[index].tags.filter((_, i) => i !== tagIndex);
    updatedProjects[index] = { ...updatedProjects[index], tags: updatedTags };
    setData({
      ...data,
      projects: { ...data.projects, projects: updatedProjects },
    });
  };

  const addProject = () => {
    const newProj = {
      num: `Project 0${data.projects.projects.length + 1}`,
      title: "New Project Title",
      desc: "Project description goes here.",
      tags: ["React"],
      bgClass: "pg1",
      liveUrl: "#",
      sourceUrl: "#",
    };
    setData({
      ...data,
      projects: { ...data.projects, projects: [...data.projects.projects, newProj] },
    });
  };

  const removeProject = (index) => {
    const updated = data.projects.projects.filter((_, i) => i !== index);
    setData({
      ...data,
      projects: { ...data.projects, projects: updated },
    });
  };

  // Experience Mutators
  const handleJobChange = (index, field, val) => {
    const updatedJobs = [...data.experience.jobs];
    updatedJobs[index] = { ...updatedJobs[index], [field]: val };
    setData({
      ...data,
      experience: { ...data.experience, jobs: updatedJobs },
    });
  };

  const handleJobTagsChange = (index, tagIndex, val) => {
    const updatedJobs = [...data.experience.jobs];
    const updatedTags = [...updatedJobs[index].tags];
    updatedTags[tagIndex] = val;
    updatedJobs[index] = { ...updatedJobs[index], tags: updatedTags };
    setData({
      ...data,
      experience: { ...data.experience, jobs: updatedJobs },
    });
  };

  const addJobTag = (index) => {
    const updatedJobs = [...data.experience.jobs];
    const updatedTags = [...updatedJobs[index].tags, "New Skill"];
    updatedJobs[index] = { ...updatedJobs[index], tags: updatedTags };
    setData({
      ...data,
      experience: { ...data.experience, jobs: updatedJobs },
    });
  };

  const removeJobTag = (index, tagIndex) => {
    const updatedJobs = [...data.experience.jobs];
    const updatedTags = updatedJobs[index].tags.filter((_, i) => i !== tagIndex);
    updatedJobs[index] = { ...updatedJobs[index], tags: updatedTags };
    setData({
      ...data,
      experience: { ...data.experience, jobs: updatedJobs },
    });
  };

  const addJob = () => {
    const newJob = {
      date: "Date Range",
      role: "Job Title",
      company: "Company Name · Location",
      desc: "Brief description of achievements.",
      tags: ["React"],
    };
    setData({
      ...data,
      experience: { ...data.experience, jobs: [...data.experience.jobs, newJob] },
    });
  };

  const removeJob = (index) => {
    const updated = data.experience.jobs.filter((_, i) => i !== index);
    setData({
      ...data,
      experience: { ...data.experience, jobs: updated },
    });
  };

  // Skills Categories Mutators
  const handleSkillCatChange = (index, field, val) => {
    const updated = [...data.skills.categories];
    updated[index] = { ...updated[index], [field]: val };
    setData({
      ...data,
      skills: { ...data.skills, categories: updated },
    });
  };

  const handleSkillTagChange = (index, tagIndex, val) => {
    const updated = [...data.skills.categories];
    const updatedTags = [...updated[index].tags];
    updatedTags[tagIndex] = val;
    updated[index] = { ...updated[index], tags: updatedTags };
    setData({
      ...data,
      skills: { ...data.skills, categories: updated },
    });
  };

  const addSkillTag = (index) => {
    const updated = [...data.skills.categories];
    const updatedTags = [...updated[index].tags, "Skill"];
    updated[index] = { ...updated[index], tags: updatedTags };
    setData({
      ...data,
      skills: { ...data.skills, categories: updated },
    });
  };

  const removeSkillTag = (index, tagIndex) => {
    const updated = [...data.skills.categories];
    const updatedTags = updated[index].tags.filter((_, i) => i !== tagIndex);
    updated[index] = { ...updated[index], tags: updatedTags };
    setData({
      ...data,
      skills: { ...data.skills, categories: updated },
    });
  };

  const addSkillCategory = () => {
    const newCat = {
      icon: "⬡",
      colorClass: "violet",
      title: "New Category",
      subtitle: "Sub Heading",
      tags: ["Skill"],
    };
    setData({
      ...data,
      skills: { ...data.skills, categories: [...data.skills.categories, newCat] },
    });
  };

  const removeSkillCategory = (index) => {
    const updated = data.skills.categories.filter((_, i) => i !== index);
    setData({
      ...data,
      skills: { ...data.skills, categories: updated },
    });
  };

  // Certifications Mutators
  const handleCertChange = (index, field, val) => {
    const updated = [...data.certifications.certs];
    updated[index] = { ...updated[index], [field]: val };
    setData({
      ...data,
      certifications: { ...data.certifications, certs: updated },
    });
  };

  const addCert = () => {
    const newCert = {
      issuer: "Credential Issuer",
      name: "Certification Name",
      year: "Year",
      icon: "◈",
      color: "rgba(124,58,237,0.15)",
      certFile: "",
      certLink: "",
    };
    setData({
      ...data,
      certifications: { ...data.certifications, certs: [...data.certifications.certs, newCert] },
    });
  };

  const removeCert = (index) => {
    const updated = data.certifications.certs.filter((_, i) => i !== index);
    setData({
      ...data,
      certifications: { ...data.certifications, certs: updated },
    });
  };

  // Services Mutators
  const handleServiceChange = (index, field, val) => {
    const updated = [...data.services.services];
    updated[index] = { ...updated[index], [field]: val };
    setData({
      ...data,
      services: { ...data.services, services: updated },
    });
  };

  const addService = () => {
    const newService = {
      icon: "⬡",
      type: "v1",
      title: "Service Title",
      desc: "Brief description of service offerings.",
    };
    setData({
      ...data,
      services: { ...data.services, services: [...data.services.services, newService] },
    });
  };

  const removeService = (index) => {
    const updated = data.services.services.filter((_, i) => i !== index);
    setData({
      ...data,
      services: { ...data.services, services: updated },
    });
  };

  // Resume Mutators
  const updateResume = (field, val) => {
    setData({
      ...data,
      resume: { ...data.resume, [field]: val },
    });
  };

  const handleResumeHighlightChange = (index, val) => {
    const updated = [...data.resume.highlights];
    updated[index] = val;
    setData({
      ...data,
      resume: { ...data.resume, highlights: updated },
    });
  };

  const addResumeHighlight = () => {
    setData({
      ...data,
      resume: { ...data.resume, highlights: [...data.resume.highlights, "New highlight description"] },
    });
  };

  const removeResumeHighlight = (index) => {
    const updated = data.resume.highlights.filter((_, i) => i !== index);
    setData({
      ...data,
      resume: { ...data.resume, highlights: updated },
    });
  };

  if (loading || !data) {
    return (
      <div style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#030308",
        color: "#94a3b8",
        fontFamily: "'Plus Jakarta Sans', sans-serif"
      }}>
        <div style={{ textAlign: "center" }}>
          <div style={{
            border: "3px solid rgba(255, 255, 255, 0.1)",
            borderTop: "3px solid #8b5cf6",
            borderRadius: "50%",
            width: "36px",
            height: "36px",
            animation: "spin 1s linear infinite",
            margin: "0 auto 16px auto"
          }} />
          <div>Loading Control Center...</div>
          <style>{`
            @keyframes spin {
              0% { transform: rotate(0deg); }
              100% { transform: rotate(360deg); }
            }
          `}</style>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.ambientBlob1}></div>
      <div style={styles.ambientBlob2}></div>

      {/* Top Bar */}
      <header style={styles.topbar}>
        <div style={{ ...styles.logo, display: "flex", alignItems: "center", gap: "8px" }}>
          <Logo initials={data?.hero?.avatarInitials || "CDVN"} style={{ cursor: "default" }} />
          <span style={styles.logoDivider}></span>
          <span style={styles.logoTitle}>Control Center</span>
        </div>
        <div style={styles.topActions}>
          <button style={styles.btnSecondary} onClick={handleLogout}>
            Logout
          </button>
          <button style={styles.btnPrimary} onClick={handleSave} disabled={saving}>
            {saving ? (
              <span style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span className="spinner-mini" style={styles.spinnerMini}></span>
                Saving...
              </span>
            ) : (
              "Save Modifications"
            )}
          </button>
        </div>
      </header>

      {message.text && (
        <div
          style={{
            ...styles.alert,
            backgroundColor: message.type === "success" ? "rgba(16, 185, 129, 0.12)" : "rgba(239, 68, 68, 0.12)",
            borderColor: message.type === "success" ? "rgba(16, 185, 129, 0.25)" : "rgba(239, 68, 68, 0.25)",
            color: message.type === "success" ? "#34d399" : "#f87171",
          }}
        >
          <span style={{ marginRight: "8px" }}>{message.type === "success" ? "✓" : "⚠"}</span>
          {message.text}
        </div>
      )}

      {/* Main Workspace */}
      <div style={styles.workspace}>
        {/* Navigation Sidebar */}
        <aside style={styles.sidebar}>
          {navigationGroups.map((group, groupIdx) => (
            <div key={groupIdx} style={styles.sidebarGroup}>
              <div style={styles.sidebarGroupLabel}>{group.title}</div>
              <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                {group.items.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    style={{
                      ...styles.tabButton,
                      color: activeTab === tab.id ? "#f8fafc" : "#94a3b8",
                      backgroundColor: activeTab === tab.id ? "rgba(139, 92, 246, 0.12)" : "transparent",
                      borderLeft: activeTab === tab.id ? "3px solid #8b5cf6" : "3px solid transparent",
                    }}
                  >
                    <span style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                      <span style={{ color: activeTab === tab.id ? "#a78bfa" : "#64748b" }}>{tab.icon}</span>
                      {tab.label}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </aside>

        {/* Tab content area */}
        <main style={styles.content}>
          <div style={styles.glassContainer}>
            {/* OVERVIEW */}
            {activeTab === "overview" && (
              <div>
                <div style={{ marginBottom: "32px" }}>
                  <h2 style={styles.sectionTitle}>Overview</h2>
                  <p style={{ color: "#94a3b8", marginTop: "-16px", fontSize: "0.95rem" }}>
                    Welcome back, Chandra! Quickly monitor and edit all your portfolio sections.
                  </p>
                </div>

                {/* Dashboard Stats */}
                <div style={styles.statsGrid}>
                  <div style={styles.statCard} onClick={() => setActiveTab("projects")}>
                    <div style={styles.statIcon}>{tabIcons.projects}</div>
                    <div>
                      <div style={styles.statNumber}>{data?.projects?.projects?.length || 0}</div>
                      <div style={styles.statLabel}>Selected Projects</div>
                    </div>
                  </div>
                  <div style={styles.statCard} onClick={() => setActiveTab("experience")}>
                    <div style={styles.statIcon}>{tabIcons.experience}</div>
                    <div>
                      <div style={styles.statNumber}>{data?.experience?.jobs?.length || 0}</div>
                      <div style={styles.statLabel}>Work Positions</div>
                    </div>
                  </div>
                  <div style={styles.statCard} onClick={() => setActiveTab("skills")}>
                    <div style={styles.statIcon}>{tabIcons.skills}</div>
                    <div>
                      <div style={styles.statNumber}>{data?.skills?.categories?.length || 0}</div>
                      <div style={styles.statLabel}>Skill Categories</div>
                    </div>
                  </div>
                  <div style={styles.statCard} onClick={() => setActiveTab("certifications")}>
                    <div style={styles.statIcon}>{tabIcons.certifications}</div>
                    <div>
                      <div style={styles.statNumber}>{data?.certifications?.certs?.length || 0}</div>
                      <div style={styles.statLabel}>Certifications</div>
                    </div>
                  </div>
                </div>

                {/* Profile Overview Card */}
                <div style={styles.profileOverviewCard}>
                  <div style={{ display: "flex", gap: "24px", alignItems: "center" }}>
                    {data.hero.avatarUrl ? (
                      <img src={data.hero.avatarUrl} alt="Avatar" style={styles.avatarImg} />
                    ) : (
                      <div style={styles.avatarPlaceholder}>{data.hero.avatarInitials || "AM"}</div>
                    )}
                    <div>
                      <h3 style={{ fontSize: "1.4rem", fontWeight: "700", color: "#f8fafc", margin: 0 }}>
                        {data.hero.nameLine1} {data.hero.nameLine2}
                      </h3>
                      <p style={{ color: "#3b82f6", fontWeight: "600", margin: "4px 0 8px 0", fontSize: "0.9rem" }}>
                        {data.hero.title}
                      </p>
                      <div style={{ display: "flex", gap: "16px", color: "#94a3b8", fontSize: "0.85rem" }}>
                        <span>✉ {data.hero.email}</span>
                        <span>💼 {data.hero.yearsExp}</span>
                        <span style={{ color: data.hero.openToWork ? "#10b981" : "#ef4444" }}>
                          ● {data.hero.openToWork ? "Open to Opportunities" : "Busy"}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div style={styles.overviewQuickActions}>
                    <button style={styles.btnSecondary} onClick={() => setActiveTab("hero")}>
                      Edit Hero Section
                    </button>
                    <button style={styles.btnSecondary} onClick={() => setActiveTab("about")}>
                      Update Biography
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* HERO */}
            {activeTab === "hero" && (
              <div style={styles.formContainer}>
                <h2 style={styles.sectionTitle}>Hero Section</h2>
                <div style={styles.formGrid}>
                  <div style={styles.fieldGroup}>
                    <label style={styles.fieldLabel}>Eyebrow Badge</label>
                    <input style={styles.fieldInput} type="text" value={data.hero.eyebrow} onChange={(e) => updateHero("eyebrow", e.target.value)} />
                  </div>
                  <div style={styles.fieldGroup}>
                    <label style={styles.fieldLabel}>Name First Line</label>
                    <input style={styles.fieldInput} type="text" value={data.hero.nameLine1} onChange={(e) => updateHero("nameLine1", e.target.value)} />
                  </div>
                  <div style={styles.fieldGroup}>
                    <label style={styles.fieldLabel}>Name Second Line</label>
                    <input style={styles.fieldInput} type="text" value={data.hero.nameLine2} onChange={(e) => updateHero("nameLine2", e.target.value)} />
                  </div>
                  <div style={styles.fieldGroup}>
                    <label style={styles.fieldLabel}>Role / Title</label>
                    <input style={styles.fieldInput} type="text" value={data.hero.title} onChange={(e) => updateHero("title", e.target.value)} />
                  </div>
                  <div style={{ ...styles.fieldGroup, gridColumn: "1 / span 2" }}>
                    <label style={styles.fieldLabel}>Tagline</label>
                    <textarea style={styles.fieldTextarea} value={data.hero.tagline} onChange={(e) => updateHero("tagline", e.target.value)} />
                  </div>
                  <div style={styles.fieldGroup}>
                    <label style={styles.fieldLabel}>GitHub URL</label>
                    <input style={styles.fieldInput} type="text" value={data.hero.github} onChange={(e) => updateHero("github", e.target.value)} />
                  </div>
                  <div style={styles.fieldGroup}>
                    <label style={styles.fieldLabel}>LinkedIn URL</label>
                    <input style={styles.fieldInput} type="text" value={data.hero.linkedin} onChange={(e) => updateHero("linkedin", e.target.value)} />
                  </div>
                  <div style={styles.fieldGroup}>
                    <label style={styles.fieldLabel}>Twitter URL</label>
                    <input style={styles.fieldInput} type="text" value={data.hero.twitter} onChange={(e) => updateHero("twitter", e.target.value)} />
                  </div>
                  <div style={styles.fieldGroup}>
                    <label style={styles.fieldLabel}>Email Address</label>
                    <input style={styles.fieldInput} type="email" value={data.hero.email} onChange={(e) => updateHero("email", e.target.value)} />
                  </div>
                  <div style={{ ...styles.fieldGroup, gridColumn: "1 / span 2" }}>
                    <FileUploader
                      label="CV / Resume PDF Link"
                      value={data.hero.cvUrl}
                      onChange={(val) => updateHero("cvUrl", val)}
                      accept=".pdf,application/pdf"
                    />
                  </div>
                  <div style={{ ...styles.fieldGroup, gridColumn: "1 / span 2" }}>
                    <FileUploader
                      label="Profile Photo / Avatar Image"
                      value={data.hero.avatarUrl || ""}
                      onChange={(val) => updateHero("avatarUrl", val)}
                      accept="image/*"
                    />
                  </div>
                  <div style={styles.fieldGroup}>
                    <label style={styles.fieldLabel}>Monogram / Initials</label>
                    <input style={styles.fieldInput} type="text" value={data.hero.avatarInitials} onChange={(e) => updateHero("avatarInitials", e.target.value)} />
                  </div>
                  <div style={styles.fieldGroup}>
                    <label style={styles.fieldLabel}>Years of Experience Text</label>
                    <input style={styles.fieldInput} type="text" value={data.hero.yearsExp} onChange={(e) => updateHero("yearsExp", e.target.value)} />
                  </div>
                  <div style={styles.fieldGroup}>
                    <label style={styles.fieldLabel}>Open to work?</label>
                    <select style={styles.fieldInput} value={data.hero.openToWork ? "true" : "false"} onChange={(e) => updateHero("openToWork", e.target.value === "true")}>
                      <option value="true">Yes (Green Light)</option>
                      <option value="false">No (Hidden)</option>
                    </select>
                  </div>
                </div>
              </div>
            )}

            {/* ABOUT */}
            {activeTab === "about" && (
              <div style={styles.formContainer}>
                <h2 style={styles.sectionTitle}>About Section</h2>
                <div style={styles.formGrid}>
                  <div style={styles.fieldGroup}>
                    <label style={styles.fieldLabel}>Title First Line</label>
                    <input style={styles.fieldInput} type="text" value={data.about.titleLine1} onChange={(e) => updateAbout("titleLine1", e.target.value)} />
                  </div>
                  <div style={styles.fieldGroup}>
                    <label style={styles.fieldLabel}>Title Second Line</label>
                    <input style={styles.fieldInput} type="text" value={data.about.titleLine2} onChange={(e) => updateAbout("titleLine2", e.target.value)} />
                  </div>
                  <div style={{ ...styles.fieldGroup, gridColumn: "1 / span 2" }}>
                    <label style={styles.fieldLabel}>Paragraph 1</label>
                    <textarea style={styles.fieldTextarea} value={data.about.p1} onChange={(e) => updateAbout("p1", e.target.value)} />
                  </div>
                  <div style={{ ...styles.fieldGroup, gridColumn: "1 / span 2" }}>
                    <label style={styles.fieldLabel}>Paragraph 2</label>
                    <textarea style={styles.fieldTextarea} value={data.about.p2} onChange={(e) => updateAbout("p2", e.target.value)} />
                  </div>
                  <div style={{ ...styles.fieldGroup, gridColumn: "1 / span 2" }}>
                    <label style={styles.fieldLabel}>Focus Area Box Text</label>
                    <textarea style={styles.fieldTextarea} value={data.about.focus} onChange={(e) => updateAbout("focus", e.target.value)} />
                  </div>
                  <div style={styles.fieldGroup}>
                    <label style={styles.fieldLabel}>Counter: Years Exp</label>
                    <input style={styles.fieldInput} type="number" value={data.about.stats.exp} onChange={(e) => updateAboutStats("exp", e.target.value)} />
                  </div>
                  <div style={styles.fieldGroup}>
                    <label style={styles.fieldLabel}>Counter: Projects Shipped</label>
                    <input style={styles.fieldInput} type="number" value={data.about.stats.projects} onChange={(e) => updateAboutStats("projects", e.target.value)} />
                  </div>
                  <div style={styles.fieldGroup}>
                    <label style={styles.fieldLabel}>Counter: Technologies</label>
                    <input style={styles.fieldInput} type="number" value={data.about.stats.tech} onChange={(e) => updateAboutStats("tech", e.target.value)} />
                  </div>
                  <div style={styles.fieldGroup}>
                    <label style={styles.fieldLabel}>Counter: Happy Clients</label>
                    <input style={styles.fieldInput} type="number" value={data.about.stats.clients} onChange={(e) => updateAboutStats("clients", e.target.value)} />
                  </div>
                </div>
              </div>
            )}

            {/* PROJECTS */}
            {activeTab === "projects" && (
              <div style={styles.formContainer}>
                <div style={styles.sectionHeader}>
                  <h2 style={styles.sectionTitle}>Projects</h2>
                  <button style={styles.btnSecondary} onClick={addProject}>+ Add New Project</button>
                </div>

                {data.projects.projects.map((proj, idx) => (
                  <div key={idx} style={styles.listItemCard}>
                    <div style={styles.listItemHeader}>
                      <h4 style={{ color: "#a78bfa", fontSize: "1.1rem", fontWeight: "700" }}>{proj.num || `Project ${idx + 1}`}</h4>
                      <button style={styles.btnDelete} onClick={() => removeProject(idx)}>Remove</button>
                    </div>
                    <div style={styles.formGrid}>
                      <div style={styles.fieldGroup}>
                        <label style={styles.fieldLabel}>Project Number (e.g. Project 01)</label>
                        <input style={styles.fieldInput} type="text" value={proj.num || ""} onChange={(e) => handleProjectChange(idx, "num", e.target.value)} />
                      </div>
                      <div style={styles.fieldGroup}>
                        <label style={styles.fieldLabel}>Title</label>
                        <input style={styles.fieldInput} type="text" value={proj.title || ""} onChange={(e) => handleProjectChange(idx, "title", e.target.value)} />
                      </div>
                      <div style={{ ...styles.fieldGroup, gridColumn: "1 / span 2" }}>
                        <label style={styles.fieldLabel}>Description</label>
                        <textarea style={styles.fieldTextarea} value={proj.desc || ""} onChange={(e) => handleProjectChange(idx, "desc", e.target.value)} />
                      </div>
                      <div style={styles.fieldGroup}>
                        <label style={styles.fieldLabel}>Background Color Class (pg1 to pg6)</label>
                        <input style={styles.fieldInput} type="text" value={proj.bgClass || ""} onChange={(e) => handleProjectChange(idx, "bgClass", e.target.value)} />
                      </div>
                      <div style={styles.fieldGroup}>
                        <label style={styles.fieldLabel}>Live Link</label>
                        <input style={styles.fieldInput} type="text" value={proj.liveUrl || ""} onChange={(e) => handleProjectChange(idx, "liveUrl", e.target.value)} />
                      </div>
                      <div style={styles.fieldGroup}>
                        <label style={styles.fieldLabel}>Source Link</label>
                        <input style={styles.fieldInput} type="text" value={proj.sourceUrl || ""} onChange={(e) => handleProjectChange(idx, "sourceUrl", e.target.value)} />
                      </div>
                      <div style={{ ...styles.fieldGroup, gridColumn: "1 / span 2" }}>
                        <label style={styles.fieldLabel}>Tags</label>
                        <div style={styles.tagList}>
                          {proj.tags.map((tag, tIdx) => (
                            <div key={tIdx} style={styles.tagItem}>
                              <input
                                style={styles.tagInput}
                                type="text"
                                value={tag}
                                onChange={(e) => handleProjectTagsChange(idx, tIdx, e.target.value)}
                              />
                              <button style={styles.tagRemoveBtn} onClick={() => removeProjectTag(idx, tIdx)}>×</button>
                            </div>
                          ))}
                          <button style={styles.btnTagAdd} onClick={() => addProjectTag(idx)}>+ Add Tag</button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* EXPERIENCE */}
            {activeTab === "experience" && (
              <div style={styles.formContainer}>
                <div style={styles.sectionHeader}>
                  <h2 style={styles.sectionTitle}>Experience Timeline</h2>
                  <button style={styles.btnSecondary} onClick={addJob}>+ Add Job Experience</button>
                </div>

                {data.experience.jobs.map((job, idx) => (
                  <div key={idx} style={styles.listItemCard}>
                    <div style={styles.listItemHeader}>
                      <h4 style={{ color: "#38bdf8", fontSize: "1.1rem", fontWeight: "700" }}>{job.role || "Job Experience"}</h4>
                      <button style={styles.btnDelete} onClick={() => removeJob(idx)}>Remove</button>
                    </div>
                    <div style={styles.formGrid}>
                      <div style={styles.fieldGroup}>
                        <label style={styles.fieldLabel}>Date Range (e.g. Jan 2023 — Present)</label>
                        <input style={styles.fieldInput} type="text" value={job.date || ""} onChange={(e) => handleJobChange(idx, "date", e.target.value)} />
                      </div>
                      <div style={styles.fieldGroup}>
                        <label style={styles.fieldLabel}>Role / Title</label>
                        <input style={styles.fieldInput} type="text" value={job.role || ""} onChange={(e) => handleJobChange(idx, "role", e.target.value)} />
                      </div>
                      <div style={styles.fieldGroup}>
                        <label style={styles.fieldLabel}>Company Name & Location</label>
                        <input style={styles.fieldInput} type="text" value={job.company || ""} onChange={(e) => handleJobChange(idx, "company", e.target.value)} />
                      </div>
                      <div style={{ ...styles.fieldGroup, gridColumn: "1 / span 2" }}>
                        <label style={styles.fieldLabel}>Description</label>
                        <textarea style={styles.fieldTextarea} value={job.desc || ""} onChange={(e) => handleJobChange(idx, "desc", e.target.value)} />
                      </div>
                      <div style={{ ...styles.fieldGroup, gridColumn: "1 / span 2" }}>
                        <label style={styles.fieldLabel}>Technologies / Skills Used</label>
                        <div style={styles.tagList}>
                          {job.tags.map((tag, tIdx) => (
                            <div key={tIdx} style={styles.tagItem}>
                              <input
                                style={styles.tagInput}
                                type="text"
                                value={tag}
                                onChange={(e) => handleJobTagsChange(idx, tIdx, e.target.value)}
                              />
                              <button style={styles.tagRemoveBtn} onClick={() => removeJobTag(idx, tIdx)}>×</button>
                            </div>
                          ))}
                          <button style={styles.btnTagAdd} onClick={() => addJobTag(idx)}>+ Add Skill</button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* SKILLS */}
            {activeTab === "skills" && (
              <div style={styles.formContainer}>
                <div style={styles.sectionHeader}>
                  <h2 style={styles.sectionTitle}>Tech Stack Categories</h2>
                  <button style={styles.btnSecondary} onClick={addSkillCategory}>+ Add Skill Category</button>
                </div>

                {data.skills.categories.map((cat, idx) => (
                  <div key={idx} style={styles.listItemCard}>
                    <div style={styles.listItemHeader}>
                      <h4 style={{ color: "#34d399", fontSize: "1.1rem", fontWeight: "700" }}>{cat.title || "Skill Category"}</h4>
                      <button style={styles.btnDelete} onClick={() => removeSkillCategory(idx)}>Remove</button>
                    </div>
                    <div style={styles.formGrid}>
                      <div style={styles.fieldGroup}>
                        <label style={styles.fieldLabel}>Category Icon (e.g. ⬡, ◈, ◇, ◉)</label>
                        <input style={styles.fieldInput} type="text" value={cat.icon || ""} onChange={(e) => handleSkillCatChange(idx, "icon", e.target.value)} />
                      </div>
                      <div style={styles.fieldGroup}>
                        <label style={styles.fieldLabel}>Color CSS Class (e.g. violet, cyan, blue, green)</label>
                        <input style={styles.fieldInput} type="text" value={cat.colorClass || ""} onChange={(e) => handleSkillCatChange(idx, "colorClass", e.target.value)} />
                      </div>
                      <div style={styles.fieldGroup}>
                        <label style={styles.fieldLabel}>Title</label>
                        <input style={styles.fieldInput} type="text" value={cat.title || ""} onChange={(e) => handleSkillCatChange(idx, "title", e.target.value)} />
                      </div>
                      <div style={styles.fieldGroup}>
                        <label style={styles.fieldLabel}>Subtitle</label>
                        <input style={styles.fieldInput} type="text" value={cat.subtitle || ""} onChange={(e) => handleSkillCatChange(idx, "subtitle", e.target.value)} />
                      </div>
                      <div style={{ ...styles.fieldGroup, gridColumn: "1 / span 2" }}>
                        <label style={styles.fieldLabel}>Skills List</label>
                        <div style={styles.tagList}>
                          {cat.tags.map((tag, tIdx) => (
                            <div key={tIdx} style={styles.tagItem}>
                              <input
                                style={styles.tagInput}
                                type="text"
                                value={tag}
                                onChange={(e) => handleSkillTagChange(idx, tIdx, e.target.value)}
                              />
                              <button style={styles.tagRemoveBtn} onClick={() => removeSkillTag(idx, tIdx)}>×</button>
                            </div>
                          ))}
                          <button style={styles.btnTagAdd} onClick={() => addSkillTag(idx)}>+ Add Tag</button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* CERTIFICATIONS */}
            {activeTab === "certifications" && (
              <div style={styles.formContainer}>
                <div style={styles.sectionHeader}>
                  <h2 style={styles.sectionTitle}>Certifications</h2>
                  <button style={styles.btnSecondary} onClick={addCert}>+ Add Certification</button>
                </div>

                {data.certifications.certs.map((cert, idx) => (
                  <div key={idx} style={styles.listItemCard}>
                    <div style={styles.listItemHeader}>
                      <h4 style={{ color: "#c084fc", fontSize: "1.1rem", fontWeight: "700" }}>{cert.name || "Certification"}</h4>
                      <button style={styles.btnDelete} onClick={() => removeCert(idx)}>Remove</button>
                    </div>
                    <div style={styles.formGrid}>
                      <div style={styles.fieldGroup}>
                        <label style={styles.fieldLabel}>Issuer</label>
                        <input style={styles.fieldInput} type="text" value={cert.issuer || ""} onChange={(e) => handleCertChange(idx, "issuer", e.target.value)} />
                      </div>
                      <div style={styles.fieldGroup}>
                        <label style={styles.fieldLabel}>Name</label>
                        <input style={styles.fieldInput} type="text" value={cert.name || ""} onChange={(e) => handleCertChange(idx, "name", e.target.value)} />
                      </div>
                      <div style={styles.fieldGroup}>
                        <label style={styles.fieldLabel}>Year</label>
                        <input style={styles.fieldInput} type="text" value={cert.year || ""} onChange={(e) => handleCertChange(idx, "year", e.target.value)} />
                      </div>
                      <div style={styles.fieldGroup}>
                        <label style={styles.fieldLabel}>Badge Icon (character/symbol)</label>
                        <input style={styles.fieldInput} type="text" value={cert.icon || ""} onChange={(e) => handleCertChange(idx, "icon", e.target.value)} />
                      </div>
                      <div style={styles.fieldGroup}>
                        <label style={styles.fieldLabel}>Badge Background Color Style (CSS string)</label>
                        <input style={styles.fieldInput} type="text" value={cert.color || ""} onChange={(e) => handleCertChange(idx, "color", e.target.value)} />
                      </div>
                      <div style={{ ...styles.fieldGroup, gridColumn: "1 / span 2" }}>
                        <FileUploader
                          label="Direct Certificate Upload (Image or PDF)"
                          value={cert.certFile || ""}
                          onChange={(val) => handleCertChange(idx, "certFile", val)}
                          accept="image/*,application/pdf"
                        />
                      </div>
                      <div style={{ ...styles.fieldGroup, gridColumn: "1 / span 2" }}>
                        <label style={styles.fieldLabel}>External Link (Google Drive / Credly / URL)</label>
                        <input
                          style={styles.fieldInput}
                          type="text"
                          value={cert.certLink || ""}
                          onChange={(e) => handleCertChange(idx, "certLink", e.target.value)}
                          placeholder="e.g. https://drive.google.com/..."
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}


            {/* SERVICES */}
            {activeTab === "services" && (
              <div style={styles.formContainer}>
                <div style={styles.sectionHeader}>
                  <h2 style={styles.sectionTitle}>Services Offered</h2>
                  <button style={styles.btnSecondary} onClick={addService}>+ Add Service</button>
                </div>

                {data.services.services.map((svc, idx) => (
                  <div key={idx} style={styles.listItemCard}>
                    <div style={styles.listItemHeader}>
                      <h4 style={{ color: "#60a5fa", fontSize: "1.1rem", fontWeight: "700" }}>{svc.title || "Service"}</h4>
                      <button style={styles.btnDelete} onClick={() => removeService(idx)}>Remove</button>
                    </div>
                    <div style={styles.formGrid}>
                      <div style={styles.fieldGroup}>
                        <label style={styles.fieldLabel}>Icon symbol (e.g. ⬡, ◈, ◇, ◉, ⊞, ⊕)</label>
                        <input style={styles.fieldInput} type="text" value={svc.icon || ""} onChange={(e) => handleServiceChange(idx, "icon", e.target.value)} />
                      </div>
                      <div style={styles.fieldGroup}>
                        <label style={styles.fieldLabel}>Hover Class Type (v1, v2, v3)</label>
                        <input style={styles.fieldInput} type="text" value={svc.type || ""} onChange={(e) => handleServiceChange(idx, "type", e.target.value)} />
                      </div>
                      <div style={{ ...styles.fieldGroup, gridColumn: "1 / span 2" }}>
                        <label style={styles.fieldLabel}>Title</label>
                        <input style={styles.fieldInput} type="text" value={svc.title || ""} onChange={(e) => handleServiceChange(idx, "title", e.target.value)} />
                      </div>
                      <div style={{ ...styles.fieldGroup, gridColumn: "1 / span 2" }}>
                        <label style={styles.fieldLabel}>Description</label>
                        <textarea style={styles.fieldTextarea} value={svc.desc || ""} onChange={(e) => handleServiceChange(idx, "desc", e.target.value)} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* RESUME / EDUCATION */}
            {activeTab === "resume" && (
              <div style={styles.formContainer}>
                <h2 style={styles.sectionTitle}>Resume Section & PDF Options</h2>
                <div style={styles.formGrid}>
                  <div style={{ ...styles.fieldGroup, gridColumn: "1 / span 2" }}>
                    <label style={styles.fieldLabel}>Headline</label>
                    <input style={styles.fieldInput} type="text" value={data.resume.title} onChange={(e) => updateResume("title", e.target.value)} />
                  </div>
                  <div style={{ ...styles.fieldGroup, gridColumn: "1 / span 2" }}>
                    <label style={styles.fieldLabel}>Description Text</label>
                    <textarea style={styles.fieldTextarea} value={data.resume.desc} onChange={(e) => updateResume("desc", e.target.value)} />
                  </div>
                  <div style={styles.fieldGroup}>
                    <FileUploader
                      label="Download Resume PDF"
                      value={data.resume.cvUrl || ""}
                      onChange={(val) => updateResume("cvUrl", val)}
                      accept=".pdf,application/pdf"
                    />
                  </div>
                  <div style={styles.fieldGroup}>
                    <label style={styles.fieldLabel}>View Online Resume Link</label>
                    <input style={styles.fieldInput} type="text" value={data.resume.viewUrl || ""} onChange={(e) => updateResume("viewUrl", e.target.value)} placeholder="e.g. Google Drive link or Web page URL" />
                  </div>
                  <div style={{ ...styles.fieldGroup, gridColumn: "1 / span 2" }}>
                    <label style={styles.fieldLabel}>Highlights List</label>
                    <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                      {data.resume.highlights.map((hl, idx) => (
                        <div key={idx} style={{ display: "flex", gap: "12px", alignItems: "center" }}>
                          <input
                            style={{ ...styles.fieldInput, flex: 1 }}
                            type="text"
                            value={hl}
                            onChange={(e) => handleResumeHighlightChange(idx, e.target.value)}
                          />
                          <button style={styles.btnDelete} onClick={() => removeResumeHighlight(idx)}>Remove</button>
                        </div>
                      ))}
                      <button style={{ ...styles.btnSecondary, alignSelf: "flex-start", marginTop: "6px" }} onClick={addResumeHighlight}>+ Add Highlight</button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* CONTACT DETAILS */}
            {activeTab === "contact" && (
              <div style={styles.formContainer}>
                <h2 style={styles.sectionTitle}>Contact & Social Details</h2>
                <div style={styles.formGrid}>
                  <div style={styles.fieldGroup}>
                    <label style={styles.fieldLabel}>Email Address</label>
                    <input style={styles.fieldInput} type="email" value={data.contact?.email || ""} onChange={(e) => updateContact("email", e.target.value)} />
                  </div>
                  <div style={styles.fieldGroup}>
                    <label style={styles.fieldLabel}>Phone Number</label>
                    <input style={styles.fieldInput} type="text" value={data.contact?.phone || ""} onChange={(e) => updateContact("phone", e.target.value)} />
                  </div>
                  <div style={{ ...styles.fieldGroup, gridColumn: "1 / span 2" }}>
                    <label style={styles.fieldLabel}>Location</label>
                    <input style={styles.fieldInput} type="text" value={data.contact?.location || ""} onChange={(e) => updateContact("location", e.target.value)} />
                  </div>
                  <div style={styles.fieldGroup}>
                    <label style={styles.fieldLabel}>GitHub URL</label>
                    <input style={styles.fieldInput} type="text" value={data.contact?.github || ""} onChange={(e) => updateContact("github", e.target.value)} />
                  </div>
                  <div style={styles.fieldGroup}>
                    <label style={styles.fieldLabel}>LinkedIn URL</label>
                    <input style={styles.fieldInput} type="text" value={data.contact?.linkedin || ""} onChange={(e) => updateContact("linkedin", e.target.value)} />
                  </div>
                  <div style={styles.fieldGroup}>
                    <label style={styles.fieldLabel}>Twitter URL</label>
                    <input style={styles.fieldInput} type="text" value={data.contact?.twitter || ""} onChange={(e) => updateContact("twitter", e.target.value)} />
                  </div>
                </div>
              </div>
            )}

            {/* INBOX MESSAGES */}
            {activeTab === "messages" && (
              <div>
                <div style={{ marginBottom: "32px" }}>
                  <h2 style={styles.sectionTitle}>Inbox Messages</h2>
                  <p style={{ color: "#94a3b8", marginTop: "-16px", fontSize: "0.95rem" }}>
                    View and manage direct messages submitted by visitors on your contact page.
                  </p>
                </div>

                {messages.length === 0 ? (
                  <div style={{
                    background: "rgba(10, 10, 20, 0.3)",
                    border: "1px dashed rgba(255, 255, 255, 0.1)",
                    borderRadius: "16px",
                    padding: "60px 40px",
                    textAlign: "center",
                    color: "#94a3b8",
                  }}>
                     <span style={{ fontSize: "2.5rem", display: "block", marginBottom: "16px" }}>✉</span>
                     <p style={{ fontWeight: "600", fontSize: "1.1rem", color: "#f8fafc" }}>Your inbox is empty</p>
                     <p style={{ fontSize: "0.85rem", color: "#64748b", marginTop: "6px" }}>When visitors send messages via your contact form, they will appear here.</p>
                  </div>
                ) : (
                  <div style={{
                    display: "grid",
                    gridTemplateColumns: "350px 1fr",
                    gap: "28px",
                    minHeight: "500px",
                    alignItems: "stretch",
                  }}>
                    {/* Left Pane: Messages list */}
                    <div style={{
                      background: "rgba(10, 10, 20, 0.4)",
                      border: "1px solid rgba(255, 255, 255, 0.05)",
                      borderRadius: "16px",
                      overflowY: "auto",
                      maxHeight: "600px",
                      padding: "16px",
                      display: "flex",
                      flexDirection: "column",
                      gap: "12px",
                    }}>
                      {messages.map((msg) => {
                        const isSelected = selectedMessage && selectedMessage._id === msg._id;
                        const date = new Date(msg.createdAt).toLocaleDateString(undefined, {
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit"
                        });
                        return (
                          <div
                            key={msg._id}
                            onClick={() => {
                              setSelectedMessage(msg);
                              if (!msg.read) {
                                handleToggleRead(msg._id, false);
                              }
                            }}
                            style={{
                              background: isSelected ? "rgba(139, 92, 246, 0.12)" : "rgba(10, 10, 20, 0.6)",
                              border: isSelected ? "1px solid #8b5cf6" : "1px solid rgba(255, 255, 255, 0.04)",
                              borderRadius: "12px",
                              padding: "16px",
                              cursor: "pointer",
                              transition: "all 0.2s ease",
                              position: "relative",
                            }}
                          >
                            {!msg.read && (
                              <span style={{
                                position: "absolute",
                                top: "16px",
                                right: "16px",
                                width: "8px",
                                height: "8px",
                                borderRadius: "50%",
                                backgroundColor: "#3b82f6",
                                boxShadow: "0 0 10px #3b82f6",
                              }} />
                            )}
                            <div style={{
                              fontSize: "0.75rem",
                              color: "#64748b",
                              fontWeight: "600",
                              marginBottom: "4px"
                            }}>{date}</div>
                            <div style={{
                              fontSize: "0.95rem",
                              fontWeight: msg.read ? "600" : "700",
                              color: msg.read ? "#cbd5e1" : "#f8fafc",
                              marginBottom: "4px",
                              whiteSpace: "nowrap",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                            }}>{msg.name}</div>
                            <div style={{
                              fontSize: "0.85rem",
                              fontWeight: msg.read ? "500" : "600",
                              color: msg.read ? "#94a3b8" : "#e2e8f0",
                              marginBottom: "8px",
                              whiteSpace: "nowrap",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                            }}>{msg.subject}</div>
                            <div style={{
                              fontSize: "0.8rem",
                              color: "#64748b",
                              whiteSpace: "nowrap",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                            }}>{msg.message}</div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Right Pane: Message details */}
                    <div style={{
                      background: "rgba(10, 10, 20, 0.2)",
                      border: "1px solid rgba(255, 255, 255, 0.05)",
                      borderRadius: "16px",
                      padding: "32px",
                      display: "flex",
                      flexDirection: "column",
                      justifyContent: selectedMessage ? "space-between" : "center",
                      alignItems: selectedMessage ? "stretch" : "center",
                      textAlign: selectedMessage ? "left" : "center",
                    }}>
                      {selectedMessage ? (
                        <>
                          <div>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "24px", borderBottom: "1px solid rgba(255, 255, 255, 0.05)", paddingBottom: "20px" }}>
                              <div>
                                <h3 style={{ fontSize: "1.25rem", fontWeight: "700", color: "#f8fafc", margin: 0 }}>
                                  {selectedMessage.subject}
                                </h3>
                                <div style={{ display: "flex", gap: "12px", alignItems: "center", marginTop: "8px", fontSize: "0.85rem", color: "#94a3b8" }}>
                                  <span style={{ fontWeight: "600", color: "#f8fafc" }}>From: {selectedMessage.name}</span>
                                  <span>&lt;<a href={`mailto:${selectedMessage.email}`} style={{ color: "#3b82f6", textDecoration: "underline" }}>{selectedMessage.email}</a>&gt;</span>
                                </div>
                              </div>
                              <div style={{ fontSize: "0.8rem", color: "#64748b", fontWeight: "600" }}>
                                {new Date(selectedMessage.createdAt).toLocaleString(undefined, {
                                  dateStyle: "medium",
                                  timeStyle: "short"
                                })}
                              </div>
                            </div>

                            <div style={{
                              background: "rgba(10, 10, 20, 0.4)",
                              border: "1px solid rgba(255, 255, 255, 0.03)",
                              borderRadius: "12px",
                              padding: "24px",
                              fontSize: "0.95rem",
                              color: "#cbd5e1",
                              lineHeight: "1.7",
                              whiteSpace: "pre-wrap",
                              minHeight: "200px",
                              maxHeight: "350px",
                              overflowY: "auto",
                            }}>
                              {selectedMessage.message}
                            </div>
                          </div>

                          <div style={{
                            display: "flex",
                            justifyContent: "space-between",
                            marginTop: "24px",
                            borderTop: "1px solid rgba(255, 255, 255, 0.05)",
                            paddingTop: "20px"
                          }}>
                            <button
                              onClick={() => handleToggleRead(selectedMessage._id, selectedMessage.read)}
                              style={styles.btnSecondary}
                            >
                              Mark as {selectedMessage.read ? "Unread" : "Read"}
                            </button>
                            <button
                              onClick={() => handleDeleteMessage(selectedMessage._id)}
                              style={{
                                ...styles.btnDelete,
                                padding: "12px 24px",
                                borderRadius: "30px",
                              }}
                            >
                              Delete Message
                            </button>
                          </div>
                        </>
                      ) : (
                        <div>
                          <span style={{ fontSize: "2.5rem", color: "#3b82f6" }}>🗪</span>
                          <h4 style={{ color: "#f8fafc", marginTop: "16px", fontSize: "1.05rem", fontWeight: "600" }}>No Message Selected</h4>
                          <p style={{ color: "#64748b", fontSize: "0.85rem", marginTop: "6px" }}>Select a conversation from the left sidebar list to read the full body content.</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* SYSTEM SETTINGS */}
            {activeTab === "settings" && (
              <div style={styles.formContainer}>
                <div style={{ marginBottom: "32px" }}>
                  <h2 style={styles.sectionTitle}>System Settings</h2>
                  <p style={{ color: "#94a3b8", marginTop: "-16px", fontSize: "0.95rem" }}>
                    Configure global behavior, design variables, and portfolio theme configurations.
                  </p>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "28px" }}>
                  <div>
                    <h3 style={{ fontSize: "1.2rem", fontWeight: "700", color: "#f8fafc", marginBottom: "16px" }}>
                      Portfolio Theme Customizer
                    </h3>
                    <p style={{ color: "#94a3b8", fontSize: "0.85rem", marginBottom: "24px", maxWidth: "600px" }}>
                      Select from professional color palettes designed to fit various aesthetics. Once saved, all accents, gradients, glows, text gradients, and interactive states will automatically update across your portfolio site.
                    </p>

                    <div style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
                      gap: "20px",
                    }}>
                      {THEMES.map((theme) => {
                        const isSelected = (data.themeId || "midnight-violet") === theme.id;
                        return (
                          <div
                            key={theme.id}
                            onClick={() => setData({ ...data, themeId: theme.id })}
                            style={{
                              background: "rgba(15, 15, 30, 0.4)",
                              border: isSelected ? "2px solid #8b5cf6" : "1px solid rgba(255, 255, 255, 0.08)",
                              borderRadius: "16px",
                              padding: "20px",
                              cursor: "pointer",
                              transition: "all 0.25s ease",
                              boxShadow: isSelected ? "0 0 20px rgba(139, 92, 246, 0.25)" : "none",
                              position: "relative",
                              overflow: "hidden",
                            }}
                          >
                            {isSelected && (
                              <div style={{
                                position: "absolute",
                                top: "12px",
                                right: "12px",
                                background: "#8b5cf6",
                                color: "#fff",
                                fontSize: "0.7rem",
                                fontWeight: "800",
                                padding: "4px 8px",
                                borderRadius: "20px",
                                textTransform: "uppercase",
                              }}>
                                Active
                              </div>
                            )}
                            <h4 style={{ fontSize: "1rem", fontWeight: "700", color: "#f8fafc", marginBottom: "6px" }}>
                              {theme.name}
                            </h4>
                            <p style={{ fontSize: "0.78rem", color: "#94a3b8", lineHeight: "1.4", marginBottom: "16px", minHeight: "40px" }}>
                              {theme.description}
                            </p>

                            {/* Color Preview Swatches */}
                            <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                              <div style={{ display: "flex", flex: 1, height: "32px", borderRadius: "8px", overflow: "hidden", border: "1px solid rgba(255, 255, 255, 0.1)" }}>
                                <div style={{ backgroundColor: theme.colors.bg, flex: 2 }} />
                                <div style={{ backgroundColor: theme.colors.primary, flex: 1 }} />
                                <div style={{ backgroundColor: theme.colors.secondary, flex: 1 }} />
                              </div>
                              <div style={{
                                display: "flex",
                                gap: "4px",
                              }}>
                                <span style={{ display: "inline-block", width: "8px", height: "8px", borderRadius: "50%", backgroundColor: theme.colors.primary }} />
                                <span style={{ display: "inline-block", width: "8px", height: "8px", borderRadius: "50%", backgroundColor: theme.colors.secondary }} />
                                <span style={{ display: "inline-block", width: "8px", height: "8px", borderRadius: "50%", backgroundColor: theme.colors.tertiary }} />
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}

const tabIcons = {
  overview: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="9"></rect>
      <rect x="14" y="3" width="7" height="5"></rect>
      <rect x="14" y="12" width="7" height="9"></rect>
      <rect x="3" y="16" width="7" height="5"></rect>
    </svg>
  ),
  hero: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"></path>
      <line x1="4" y1="22" x2="4" y2="15"></line>
    </svg>
  ),
  about: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
      <circle cx="12" cy="7" r="4"></circle>
    </svg>
  ),
  projects: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
    </svg>
  ),
  experience: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="7" width="20" height="14" rx="2" ry="2"></rect>
      <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"></path>
    </svg>
  ),
  skills: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="16 18 22 12 16 6"></polyline>
      <polyline points="8 6 2 12 8 18"></polyline>
    </svg>
  ),
  certifications: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="8" r="7"></circle>
      <polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88"></polyline>
    </svg>
  ),

  services: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"></path>
    </svg>
  ),
  resume: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
      <polyline points="14 2 14 8 20 8"></polyline>
      <line x1="16" y1="13" x2="8" y2="13"></line>
      <line x1="16" y1="17" x2="8" y2="17"></line>
    </svg>
  ),
  contact: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
      <polyline points="22,6 12,13 2,6"></polyline>
    </svg>
  ),
  messages: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
    </svg>
  ),
  settings: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3"></circle>
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
    </svg>
  ),
};

const navigationGroups = [
  {
    title: "Overview",
    items: [
      { id: "overview", label: "Dashboard", icon: tabIcons.overview },
    ],
  },
  {
    title: "Core Content",
    items: [
      { id: "hero", label: "Hero Banner", icon: tabIcons.hero },
      { id: "about", label: "About Bio", icon: tabIcons.about },
      { id: "resume", label: "Resume Details", icon: tabIcons.resume },
      { id: "contact", label: "Contact Details", icon: tabIcons.contact },
      { id: "messages", label: "Inbox Messages", icon: tabIcons.messages },
    ],
  },
  {
    title: "Portfolio & Work",
    items: [
      { id: "projects", label: "Selected Projects", icon: tabIcons.projects },
      { id: "experience", label: "Work Timeline", icon: tabIcons.experience },
    ],
  },
  {
    title: "Credentials & Services",
    items: [
      { id: "skills", label: "Tech Stack & Skills", icon: tabIcons.skills },
      { id: "certifications", label: "Certifications", icon: tabIcons.certifications },
      { id: "services", label: "Services Catalog", icon: tabIcons.services },
    ],
  },
  {
    title: "Configuration",
    items: [
      { id: "settings", label: "System Settings", icon: tabIcons.settings },
    ],
  },
];

const styles = {
  container: {
    minHeight: "100vh",
    background: "#05050b",
    color: "#f8fafc",
    fontFamily: "'Plus Jakarta Sans', sans-serif",
    display: "flex",
    flexDirection: "column",
    position: "relative",
    overflow: "hidden",
  },
  ambientBlob1: {
    position: "absolute",
    width: "600px",
    height: "600px",
    background: "radial-gradient(circle, rgba(139, 92, 246, 0.07) 0%, transparent 70%)",
    top: "-10%",
    left: "-10%",
    borderRadius: "50%",
    pointerEvents: "none",
  },
  ambientBlob2: {
    position: "absolute",
    width: "600px",
    height: "600px",
    background: "radial-gradient(circle, rgba(6, 182, 212, 0.05) 0%, transparent 70%)",
    bottom: "-10%",
    right: "-10%",
    borderRadius: "50%",
    pointerEvents: "none",
  },
  topbar: {
    height: "72px",
    background: "rgba(10, 10, 25, 0.7)",
    backdropFilter: "blur(12px)",
    WebkitBackdropFilter: "blur(12px)",
    borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
    padding: "0 32px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    position: "relative",
    zIndex: 10,
  },
  logo: {
    display: "flex",
    alignItems: "center",
  },
  logoDivider: {
    width: "1px",
    height: "18px",
    background: "rgba(255,255,255,0.15)",
    margin: "0 14px",
  },
  logoTitle: {
    fontSize: "0.875rem",
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: "0.1em",
    background: "linear-gradient(135deg, #c084fc, #67e8f9)",
    WebkitBackgroundClip: "text",
    WebkitTextFillColor: "transparent",
  },
  topActions: {
    display: "flex",
    gap: "14px",
  },
  workspace: {
    flex: 1,
    display: "flex",
    position: "relative",
    zIndex: 5,
  },
  sidebar: {
    width: "280px",
    background: "rgba(8, 8, 20, 0.4)",
    borderRight: "1px solid rgba(255, 255, 255, 0.06)",
    padding: "32px 16px",
    display: "flex",
    flexDirection: "column",
    gap: "28px",
  },
  sidebarGroup: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
  },
  sidebarGroupLabel: {
    fontSize: "0.7rem",
    fontWeight: "800",
    color: "#4b5563",
    textTransform: "uppercase",
    letterSpacing: "0.1em",
    paddingLeft: "16px",
    marginBottom: "4px",
  },
  tabButton: {
    padding: "12px 18px",
    fontSize: "0.85rem",
    fontWeight: "600",
    textAlign: "left",
    border: "none",
    borderRadius: "10px",
    cursor: "pointer",
    transition: "all 0.2s ease",
  },
  content: {
    flex: 1,
    padding: "40px 48px",
    overflowY: "auto",
    maxHeight: "calc(100vh - 72px)",
  },
  glassContainer: {
    background: "rgba(17, 17, 39, 0.45)",
    backdropFilter: "blur(20px)",
    WebkitBackdropFilter: "blur(20px)",
    border: "1px solid rgba(255, 255, 255, 0.06)",
    borderRadius: "24px",
    padding: "40px",
    boxShadow: "0 20px 50px rgba(0, 0, 0, 0.3)",
  },
  formContainer: {
    maxWidth: "850px",
  },
  sectionTitle: {
    fontSize: "1.75rem",
    fontWeight: "800",
    marginBottom: "28px",
    fontFamily: "'Outfit', sans-serif",
    letterSpacing: "-0.5px",
    background: "linear-gradient(135deg, #f8fafc, #cbd5e1)",
    WebkitBackgroundClip: "text",
    WebkitTextFillColor: "transparent",
  },
  sectionHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "28px",
  },
  formGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "24px",
  },
  fieldGroup: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
  },
  fieldLabel: {
    fontSize: "0.75rem",
    fontWeight: "700",
    color: "#94a3b8",
    letterSpacing: "0.05em",
    textTransform: "uppercase",
  },
  fieldInput: {
    background: "rgba(10, 10, 20, 0.8)",
    border: "1px solid rgba(255, 255, 255, 0.08)",
    borderRadius: "12px",
    padding: "14px 18px",
    color: "#f8fafc",
    fontSize: "0.9rem",
    outline: "none",
    transition: "all 0.2s ease",
  },
  fieldTextarea: {
    background: "rgba(10, 10, 20, 0.8)",
    border: "1px solid rgba(255, 255, 255, 0.08)",
    borderRadius: "12px",
    padding: "14px 18px",
    color: "#f8fafc",
    fontSize: "0.9rem",
    outline: "none",
    minHeight: "120px",
    fontFamily: "inherit",
    resize: "vertical",
    transition: "all 0.2s ease",
  },
  btnPrimary: {
    padding: "12px 24px",
    background: "linear-gradient(135deg, #8b5cf6, #3b82f6)",
    border: "none",
    borderRadius: "30px",
    color: "#fff",
    fontWeight: "700",
    fontSize: "0.85rem",
    cursor: "pointer",
    boxShadow: "0 6px 20px rgba(139, 92, 246, 0.35)",
    transition: "all 0.2s ease",
  },
  btnSecondary: {
    padding: "12px 24px",
    background: "rgba(255, 255, 255, 0.04)",
    border: "1px solid rgba(255, 255, 255, 0.08)",
    borderRadius: "30px",
    color: "#e2e8f0",
    fontWeight: "600",
    fontSize: "0.85rem",
    cursor: "pointer",
    transition: "all 0.2s ease",
  },
  btnDelete: {
    padding: "8px 16px",
    background: "rgba(239, 68, 68, 0.08)",
    border: "1px solid rgba(239, 68, 68, 0.15)",
    borderRadius: "8px",
    color: "#fca5a5",
    fontSize: "0.75rem",
    fontWeight: "700",
    cursor: "pointer",
    transition: "all 0.2s ease",
  },
  listItemCard: {
    background: "rgba(10, 10, 20, 0.5)",
    border: "1px solid rgba(255, 255, 255, 0.05)",
    borderRadius: "16px",
    padding: "28px",
    marginBottom: "28px",
  },
  listItemHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "22px",
    borderBottom: "1px solid rgba(255, 255, 255, 0.05)",
    paddingBottom: "14px",
  },
  tagList: {
    display: "flex",
    flexWrap: "wrap",
    gap: "10px",
    alignItems: "center",
    marginTop: "6px",
  },
  tagItem: {
    display: "flex",
    alignItems: "center",
    background: "rgba(10, 10, 20, 0.8)",
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: "8px",
    padding: "6px 12px",
  },
  tagInput: {
    background: "transparent",
    border: "none",
    color: "#f8fafc",
    fontSize: "0.75rem",
    outline: "none",
    width: "90px",
    fontWeight: "500",
  },
  tagRemoveBtn: {
    background: "transparent",
    border: "none",
    color: "#6b7280",
    cursor: "pointer",
    fontSize: "0.95rem",
    marginLeft: "6px",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
  },
  btnTagAdd: {
    padding: "6px 14px",
    background: "rgba(255,255,255,0.03)",
    border: "1px dashed rgba(255,255,255,0.15)",
    borderRadius: "8px",
    color: "#94a3b8",
    fontSize: "0.75rem",
    fontWeight: "600",
    cursor: "pointer",
    transition: "all 0.2s ease",
  },
  alert: {
    padding: "14px 32px",
    borderBottom: "1px solid",
    fontSize: "0.9rem",
    textAlign: "center",
    fontWeight: "600",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
    zIndex: 20,
  },
  loadingContainer: {
    height: "100vh",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    background: "#05050b",
  },
  spinner: {
    width: "44px",
    height: "44px",
    border: "3px solid rgba(139, 92, 246, 0.08)",
    borderTop: "3px solid #8b5cf6",
    borderRadius: "50%",
    animation: "spin 0.8s linear infinite",
  },
  spinnerMini: {
    width: "14px",
    height: "14px",
    border: "2px solid rgba(255, 255, 255, 0.2)",
    borderTop: "2px solid #fff",
    borderRadius: "50%",
    animation: "spin 0.8s linear infinite",
    display: "inline-block",
  },
  // Overview Tab Custom Styles
  statsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(4, 1fr)",
    gap: "20px",
    marginBottom: "32px",
  },
  statCard: {
    background: "rgba(10, 10, 20, 0.45)",
    border: "1px solid rgba(255, 255, 255, 0.06)",
    borderRadius: "16px",
    padding: "24px",
    display: "flex",
    alignItems: "center",
    gap: "18px",
    cursor: "pointer",
    transition: "all 0.2s ease",
  },
  statIcon: {
    width: "44px",
    height: "44px",
    borderRadius: "10px",
    background: "rgba(139, 92, 246, 0.12)",
    color: "#a78bfa",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  statNumber: {
    fontSize: "1.5rem",
    fontWeight: "800",
    color: "#f8fafc",
  },
  statLabel: {
    fontSize: "0.75rem",
    color: "#64748b",
    fontWeight: "700",
    textTransform: "uppercase",
    marginTop: "2px",
  },
  profileOverviewCard: {
    background: "rgba(10, 10, 20, 0.3)",
    border: "1px solid rgba(255, 255, 255, 0.04)",
    borderRadius: "16px",
    padding: "28px",
    marginTop: "32px",
  },
  avatarImg: {
    width: "64px",
    height: "64px",
    borderRadius: "50%",
    objectFit: "cover",
    border: "2px solid rgba(139, 92, 246, 0.3)",
  },
  avatarPlaceholder: {
    width: "64px",
    height: "64px",
    borderRadius: "50%",
    background: "linear-gradient(135deg, #8b5cf6, #3b82f6)",
    color: "#fff",
    fontSize: "1.4rem",
    fontWeight: "800",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  overviewQuickActions: {
    display: "flex",
    gap: "12px",
    marginTop: "24px",
    borderTop: "1px solid rgba(255, 255, 255, 0.04)",
    paddingTop: "20px",
  },
};
