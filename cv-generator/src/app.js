/* ============================================
   CV GENERATOR IA — APPLICATION LOGIC
   Modèle génératif : Llama 3.3 70B via Groq
   Architecture : LLM Transformer (Meta)
   API : Groq (gratuite, ultra-rapide)
   ============================================ */

"use strict";

// ── STATE ──────────────────────────────────
let currentStep = 0;
const TOTAL_STEPS = 6;
let skills = [];
let eduCount = 0;
let expCount = 0;
let langCount = 0;
let cvText = "";
let lmText = "";
let activeTab = "cv";
let selectedModel = null;
let availableModels = [];

// ── BACKEND CONFIG ────────────────────────
const BASE_URL = "http://localhost:5000";
const BACKEND_URL = `${BASE_URL}/generate`;
const API_MODELS_URL = `${BASE_URL}/models`;
const API_HEALTH_URL = `${BASE_URL}/health`;

// ── NAVIGATION ─────────────────────────────
function goTo(step) {
  // Remove active from current
  document.getElementById("step" + currentStep).classList.remove("active");
  document.getElementById("sb" + currentStep).classList.remove("active");

  // Mark previous steps as done
  for (let i = 0; i < step; i++) {
    document.getElementById("sb" + i).classList.add("done");
    const dot = document.getElementById("sd" + i);
    if (dot && !dot.classList.contains("special")) dot.innerHTML = "<span>✓</span>";
  }

  currentStep = step;

  document.getElementById("step" + step).classList.add("active");
  document.getElementById("sb" + step).classList.add("active");

  // Update progress line
  const pct = (step / (TOTAL_STEPS - 1)) * 100;
  document.getElementById("progressLine").style.height = pct + "%";

  // Scroll to top of form
  document.querySelector(".form-area").scrollTop = 0;
}

// ── EDUCATION ENTRIES ──────────────────────
function addEdu() {
  const id = eduCount++;
  const el = document.createElement("div");
  el.className = "entry-card";
  el.id = "edu" + id;
  el.innerHTML = `
    <button class="remove-btn" onclick="this.parentElement.remove()" title="Supprimer">×</button>
    <div class="field-grid two">
      <div class="field"><label>Diplôme / Titre</label><input id="edu_degree_${id}" placeholder="Master Intelligence Artificielle" /></div>
      <div class="field"><label>Établissement</label><input id="edu_school_${id}" placeholder="Université de Tunis El Manar" /></div>
    </div>
    <div class="field-grid two">
      <div class="field"><label>Année début</label><input id="edu_start_${id}" placeholder="2020" /></div>
      <div class="field"><label>Année fin</label><input id="edu_end_${id}" placeholder="2022" /></div>
    </div>
    <div class="field"><label>Spécialisation / Mention (optionnel)</label>
      <input id="edu_spec_${id}" placeholder="Mention Très Bien — Spécialisation NLP & Vision" />
    </div>
  `;
  document.getElementById("eduList").appendChild(el);
}

// ── EXPERIENCE ENTRIES ─────────────────────
function addExp() {
  const id = expCount++;
  const el = document.createElement("div");
  el.className = "entry-card";
  el.id = "exp" + id;
  el.innerHTML = `
    <button class="remove-btn" onclick="this.parentElement.remove()" title="Supprimer">×</button>
    <div class="field-grid two">
      <div class="field"><label>Intitulé du poste</label><input id="exp_title_${id}" placeholder="Data Scientist" /></div>
      <div class="field"><label>Entreprise</label><input id="exp_company_${id}" placeholder="Tunisie Telecom, Vermeg..." /></div>
    </div>
    <div class="field-grid two">
      <div class="field"><label>Date début</label><input id="exp_start_${id}" placeholder="Jan 2022" /></div>
      <div class="field"><label>Date fin</label><input id="exp_end_${id}" placeholder="Présent" /></div>
    </div>
    <div class="field"><label>Missions & Réalisations</label>
      <textarea id="exp_desc_${id}" rows="3" placeholder="• Développement d'un pipeline de machine learning en production&#10;• Réduction du taux d'erreur de 25% grâce à l'optimisation des modèles&#10;• Collaboration avec les équipes produit pour l'intégration IA"></textarea>
    </div>
  `;
  document.getElementById("expList").appendChild(el);
}

// ── LANGUAGE ENTRIES ───────────────────────
function addLang() {
  const id = langCount++;
  const el = document.createElement("div");
  el.className = "entry-card";
  el.id = "lang" + id;
  el.innerHTML = `
    <button class="remove-btn" onclick="this.parentElement.remove()" title="Supprimer">×</button>
    <div class="field-grid two">
      <div class="field"><label>Langue</label><input id="lang_name_${id}" placeholder="Anglais, Français, Arabe..." /></div>
      <div class="field"><label>Niveau</label>
        <select id="lang_level_${id}">
          <option value="Débutant (A1-A2)">Débutant (A1-A2)</option>
          <option value="Intermédiaire (B1-B2)">Intermédiaire (B1-B2)</option>
          <option value="Avancé (C1-C2)">Avancé (C1-C2)</option>
          <option value="Langue maternelle">Langue maternelle</option>
          <option value="Bilingue">Bilingue</option>
        </select>
      </div>
    </div>
  `;
  document.getElementById("langList").appendChild(el);
}

// ── SKILLS ─────────────────────────────────
function addSkill() {
  const input = document.getElementById("skillInput");
  const raw = input.value.trim();
  if (!raw) return;
  raw.split(",").forEach((s) => {
    const sk = s.trim();
    if (sk && !skills.includes(sk)) {
      skills.push(sk);
    }
  });
  renderSkills();
  input.value = "";
  input.focus();
}

function removeSkill(sk) {
  skills = skills.filter((s) => s !== sk);
  renderSkills();
}

function renderSkills() {
  document.getElementById("skillsGrid").innerHTML = skills
    .map(
      (s) =>
        `<span class="skill-tag">${s}<button onclick="removeSkill('${s.replace(/'/g, "\\'")}')">×</button></span>`
    )
    .join("");
}

// ── DATA GATHERING ─────────────────────────
function gatherData() {
  const education = [];
  document.querySelectorAll("[id^='edu_degree_']").forEach((el) => {
    const id = el.id.split("_").pop();
    education.push({
      degree: el.value || "",
      school: document.getElementById("edu_school_" + id)?.value || "",
      start: document.getElementById("edu_start_" + id)?.value || "",
      end: document.getElementById("edu_end_" + id)?.value || "",
      spec: document.getElementById("edu_spec_" + id)?.value || "",
    });
  });

  const experience = [];
  document.querySelectorAll("[id^='exp_title_']").forEach((el) => {
    const id = el.id.split("_").pop();
    experience.push({
      title: el.value || "",
      company: document.getElementById("exp_company_" + id)?.value || "",
      start: document.getElementById("exp_start_" + id)?.value || "",
      end: document.getElementById("exp_end_" + id)?.value || "",
      desc: document.getElementById("exp_desc_" + id)?.value || "",
    });
  });

  const languages = [];
  document.querySelectorAll("[id^='lang_name_']").forEach((el) => {
    const id = el.id.split("_").pop();
    languages.push({
      name: el.value || "",
      level: document.getElementById("lang_level_" + id)?.value || "",
    });
  });

  return {
    firstName: document.getElementById("firstName")?.value || "",
    lastName: document.getElementById("lastName")?.value || "",
    email: document.getElementById("email")?.value || "",
    phone: document.getElementById("phone")?.value || "",
    location: document.getElementById("location")?.value || "",
    linkedin: document.getElementById("linkedin")?.value || "",
    jobTitle: document.getElementById("jobTitle")?.value || "",
    summary: document.getElementById("summary")?.value || "",
    education,
    experience,
    skills,
    languages,
    targetJob: document.getElementById("targetJob")?.value || "",
    targetCompany: document.getElementById("targetCompany")?.value || "",
    jobDesc: document.getElementById("jobDesc")?.value || "",
    tone: document.getElementById("tone")?.value || "professionnel et formel",
    outLang: document.getElementById("outLang")?.value || "français",
  };
}

// ── PROMPT BUILDERS ────────────────────────
function buildCVPrompt(d) {
  const eduStr = d.education.filter(e => e.degree)
    .map((e) => `• ${e.degree} | ${e.school} | ${e.start}–${e.end}${e.spec ? " | " + e.spec : ""}`)
    .join("\n") || "Non renseigné";

  const expStr = d.experience.filter(e => e.title)
    .map((e) => `• ${e.title} chez ${e.company} (${e.start} → ${e.end})\n  ${e.desc}`)
    .join("\n\n") || "Non renseigné";

  const langStr = d.languages.filter(l => l.name)
    .map((l) => `${l.name} — ${l.level}`)
    .join(" | ") || "Non renseigné";

  return `Tu es un expert RH et consultant en recrutement spécialisé dans la rédaction de CV professionnels optimisés ATS (Applicant Tracking Systems). Génère un CV complet, structuré et percutant en ${d.outLang}, avec un ton ${d.tone}.

═══════════════════════════════════════
INFORMATIONS DU CANDIDAT
═══════════════════════════════════════
Nom complet   : ${d.firstName} ${d.lastName}
Email         : ${d.email}
Téléphone     : ${d.phone}
Localisation  : ${d.location}
${d.linkedin ? "LinkedIn      : " + d.linkedin : ""}
Titre actuel  : ${d.jobTitle}
${d.summary ? "Profil        : " + d.summary : ""}

FORMATION :
${eduStr}

EXPÉRIENCES PROFESSIONNELLES :
${expStr}

COMPÉTENCES TECHNIQUES :
${d.skills.join(" • ") || "Non renseigné"}

LANGUES :
${langStr}

═══════════════════════════════════════
POSTE VISÉ & CONTEXTE
═══════════════════════════════════════
Poste         : ${d.targetJob}
${d.targetCompany ? "Entreprise    : " + d.targetCompany : ""}
${d.jobDesc ? "Description du poste :\n" + d.jobDesc : ""}

═══════════════════════════════════════
INSTRUCTIONS DE GÉNÉRATION
═══════════════════════════════════════
Génère un CV complet avec les sections suivantes, séparées par "───────────────" :

1. EN-TÊTE (nom, titre, coordonnées, liens)
2. PROFIL PROFESSIONNEL (2-3 lignes percutantes adaptées au poste visé)
3. EXPÉRIENCES PROFESSIONNELLES (avec puces d'impact, métriques quand possible)
4. FORMATION
5. COMPÉTENCES (organisées par catégorie si pertinent)
6. LANGUES

Le CV doit être optimisé pour l'ATS, utiliser des verbes d'action forts, et mettre en avant les éléments les plus pertinents pour "${d.targetJob}". Format texte clair, sans symboles décoratifs inutiles.`;
}

function buildLMPrompt(d) {
  const mainExp = d.experience.find(e => e.title) || { title: "", company: "" };
  const mainEdu = d.education.find(e => e.degree) || { degree: "", school: "" };

  return `Tu es un expert en communication professionnelle et en recrutement. Rédige une lettre de motivation exceptionnelle en ${d.outLang}, avec un ton ${d.tone}.

═══════════════════════════════════════
PROFIL DU CANDIDAT
═══════════════════════════════════════
Nom           : ${d.firstName} ${d.lastName}
Titre         : ${d.jobTitle}
Email         : ${d.email}
Téléphone     : ${d.phone}
${d.linkedin ? "LinkedIn      : " + d.linkedin : ""}

Formation principale : ${mainEdu.degree} — ${mainEdu.school}
Expérience clé       : ${mainExp.title} chez ${mainExp.company}
Compétences clés     : ${d.skills.slice(0, 8).join(", ")}
${d.summary ? "Profil        : " + d.summary : ""}

═══════════════════════════════════════
POSTE VISÉ
═══════════════════════════════════════
Poste         : ${d.targetJob}
${d.targetCompany ? "Entreprise    : " + d.targetCompany : ""}
${d.jobDesc ? "Offre d'emploi :\n" + d.jobDesc : ""}

═══════════════════════════════════════
STRUCTURE DE LA LETTRE
═══════════════════════════════════════
Rédige une lettre de motivation complète avec :

• Lieu et date (en haut à droite)
• Coordonnées expéditeur
• Coordonnées destinataire (si entreprise connue) 
• Objet : Candidature au poste de ${d.targetJob}

PARAGRAPHE 1 — ACCROCHE (2-3 phrases)
Formule d'introduction originale et percutante. Exprime un enthousiasme sincère et précis pour le poste et l'entreprise. Évite les formulations génériques.

PARAGRAPHE 2 — VALEUR AJOUTÉE (3-4 phrases)
Présente les 2-3 compétences/expériences les plus pertinentes pour le poste. Illustre avec des réalisations concrètes et des résultats mesurables.

PARAGRAPHE 3 — MOTIVATION SPÉCIFIQUE (2-3 phrases)
Montre une connaissance de l'entreprise/secteur. Explique pourquoi cette entreprise spécifiquement et ce que tu apportes de unique.

PARAGRAPHE 4 — CONCLUSION & CALL-TO-ACTION
Propose un entretien, remercie, formule de politesse professionnelle et adaptée à la langue.

La lettre doit sonner authentique, être directe, éviter les clichés et convaincre en moins de 350 mots.`;
}

// ── GENERATION (FLASK BACKEND) ────────────
async function generate(type) {
  const d = gatherData();

  // Validation basique
  if (!d.firstName && !d.lastName) {
    alert("Veuillez renseigner au minimum votre prénom ou nom (étape 1).");
    goTo(0);
    return;
  }

  const isCV = type === "cv";
  const btn = document.getElementById(isCV ? "genCVBtn" : "genLMBtn");
  const spin = document.getElementById(isCV ? "spinCV" : "spinLM");

  btn.disabled = true;
  spin.style.display = "block";

  document.getElementById("outputBlock").style.display = "block";
  switchTab(type);
  document.getElementById("outputText").textContent = isCV
    ? "⏳ Génération du CV en cours..."
    : "⏳ Rédaction de la lettre de motivation en cours...";

  try {
    const payload = { type, ...d };
    // Ajouter le modèle sélectionné au payload s'il existe
    if (selectedModel) {
      payload.model = selectedModel;
    }

    const response = await fetch(BACKEND_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error || `Erreur HTTP ${response.status}`);
    }

    const data = await response.json();
    const text = data.result || "Aucune réponse reçue.";

    if (isCV) cvText = text;
    else lmText = text;

    document.getElementById("outputText").textContent = text;

    if (data.model_used) {
      console.log(`✓ Document généré via : ${data.model_used}`);
    }
  } catch (err) {
    console.error("Erreur backend:", err);
    document.getElementById("outputText").textContent =
      `❌ Erreur lors de la génération :\n${err.message}\n\nVérifiez que le serveur est lancé sur http://localhost:5000`;
  }

  btn.disabled = false;
  spin.style.display = "none";
}

// ── MODELS MANAGEMENT ─────────────────────
async function loadAvailableModels() {
  try {
    const response = await fetch(API_MODELS_URL);
    if (response.ok) {
      const data = await response.json();
      availableModels = data.models || [];
      if (availableModels.length > 0) {
        selectedModel = availableModels[0]; // Sélectionner le premier par défaut
        updateModelDisplay();
        console.log("✓ Modèles disponibles:", availableModels);
        console.log("✓ Modèle sélectionné par défaut:", selectedModel);
      }
    }
  } catch (err) {
    console.warn("Impossible de charger les modèles:", err.message);
    console.warn("Le serveur Flask doit être lancé sur http://localhost:5000");
  }
}

function updateModelDisplay() {
  const modelSelector = document.getElementById("modelSelector");
  if (modelSelector) {
    modelSelector.innerHTML = availableModels
      .map(m => `<option value="${m}" ${m === selectedModel ? 'selected' : ''}>${m}</option>`)
      .join("");
  }
}

function selectModel(model) {
  selectedModel = model;
  console.log("Modèle sélectionné:", selectedModel);
}

async function checkBackendHealth() {
  try {
    const response = await fetch(API_HEALTH_URL);
    if (response.ok) {
      const data = await response.json();
      console.log("✓ Backend santé:", {
        status: data.status,
        device: data.device,
        groq_available: data.groq_available,
        local_models: data.local_models
      });
      return true;
    }
  } catch (err) {
    console.error("❌ Backend indisponible:", err.message);
    return false;
  }
}

// ── OUTPUT UTILITIES ───────────────────────
function switchTab(tab) {
  activeTab = tab;
  document.getElementById("tabCV").classList.toggle("active", tab === "cv");
  document.getElementById("tabLM").classList.toggle("active", tab === "lm");
  const content = tab === "cv" ? cvText : lmText;
  if (content) document.getElementById("outputText").textContent = content;
  else if (tab === "lm" && !lmText)
    document.getElementById("outputText").textContent =
      "Cliquez sur « Générer la lettre » pour créer votre lettre de motivation.";
  else if (tab === "cv" && !cvText)
    document.getElementById("outputText").textContent =
      "Cliquez sur « Générer le CV » pour créer votre CV.";
}

function copyOutput() {
  const text = document.getElementById("outputText").textContent;
  navigator.clipboard.writeText(text).then(() => {
    const btn = event.target;
    const orig = btn.textContent;
    btn.textContent = "✅ Copié !";
    setTimeout(() => (btn.textContent = orig), 2000);
  });
}

function downloadTxt() {
  const d = gatherData();
  const text = document.getElementById("outputText").textContent;
  const fname =
    activeTab === "cv"
      ? `CV_${d.firstName}_${d.lastName}.txt`
      : `LM_${d.firstName}_${d.lastName}.txt`;
  downloadFile(text, fname, "text/plain;charset=utf-8");
}

function downloadHtml() {
  const d = gatherData();
  const rawText = document.getElementById("outputText").textContent;
  const html = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${activeTab === "cv" ? "CV" : "Lettre de motivation"} — ${d.firstName} ${d.lastName}</title>
  <style>
    body { font-family: 'Georgia', serif; max-width: 800px; margin: 40px auto; padding: 2rem; color: #1a1a18; line-height: 1.8; }
    pre { white-space: pre-wrap; font-family: inherit; font-size: 15px; }
    h1 { color: #0F6E56; margin-bottom: 1rem; }
    @media print { body { margin: 20px; } }
  </style>
</head>
<body>
  <pre>${rawText.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</pre>
</body>
</html>`;
  const fname =
    activeTab === "cv"
      ? `CV_${d.firstName}_${d.lastName}.html`
      : `LM_${d.firstName}_${d.lastName}.html`;
  downloadFile(html, fname, "text/html;charset=utf-8");
}

function downloadFile(content, filename, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ── INIT ───────────────────────────────────
(async function init() {
  console.log("🚀 Initialisation de CV Generator IA...");
  
  // Vérifier la santé du backend
  const backendOk = await checkBackendHealth();
  if (!backendOk) {
    console.warn("⚠️  Le serveur Flask n'est pas accessible. Lancez 'python app.py'");
    document.body.insertAdjacentHTML("beforeend", 
      `<div style="position:fixed;top:20px;right:20px;background:#ff6b6b;color:white;padding:15px;border-radius:8px;z-index:9999;">
        ⚠️ Serveur indisponible — Lancez <code>python app.py</code>
      </div>`);
  } else {
    // Charger les modèles disponibles
    await loadAvailableModels();
  }
  
  // Ajouter des entrées par défaut pour guider les utilisateurs
  addEdu();
  addExp();
  addLang();
  
  console.log("✓ CV Generator IA prêt ! Modèles :", availableModels);
  console.log("✓ Modèle actif :", selectedModel);
})();