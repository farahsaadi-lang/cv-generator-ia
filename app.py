import os
import warnings
import torch

from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from dotenv import load_dotenv

from transformers import (
    AutoTokenizer,
    AutoModelForCausalLM,
    set_seed,
)

warnings.filterwarnings("ignore")

load_dotenv()
set_seed(42)

# ─────────────────────────────────────────────
# BACKEND API FLASK (Port 5000)
# Frontend communique via http://localhost:5000
# ─────────────────────────────────────────────

FRONTEND_DIR = os.path.join(os.path.dirname(__file__), "cv-generator")

app = Flask(__name__, static_folder=FRONTEND_DIR, static_url_path="")
CORS(app)

@app.route("/", methods=["GET"])
def index():
    return send_from_directory(FRONTEND_DIR, "index.html")

@app.route("/<path:path>", methods=["GET"])
def static_files(path):
    return send_from_directory(FRONTEND_DIR, path)

DEVICE = "cuda" if torch.cuda.is_available() else "cpu"
print(f"Torch : {torch.__version__}")
print(f"Device : {DEVICE}")

# ─────────────────────────────────────────────
# 0.3 Configuration — Modèles locaux + API Groq
# ─────────────────────────────────────────────

# Modèles locaux (HuggingFace)
MODELS = {
    "SmolLM2-135M": "HuggingFaceTB/SmolLM2-135M-Instruct",
    "Qwen2.5-0.5B": "Qwen/Qwen2.5-0.5B-Instruct",
}

# Configuration Groq
# La clé est lue depuis le fichier .env (variable GROQ_API_KEY)
GROQ_API_KEY  = os.environ.get("GROQ_API_KEY", "")
GROQ_MODEL    = "llama-3.3-70b-versatile"
GROQ_BASE_URL = "https://api.groq.com/openai/v1"

API_AVAILABLE = GROQ_API_KEY.startswith("gsk_") and len(GROQ_API_KEY) > 30
print(f"API Groq disponible : {API_AVAILABLE}")
print(f"Modèle sélectionné  : {GROQ_MODEL}")
if not API_AVAILABLE:
    print("→ Les cellules API seront ignorées. Ajoutez votre clé dans .env pour les activer.")

# ─────────────────────────────────────────────
# 1.1 Chargement des modèles locaux
# ─────────────────────────────────────────────

models     = {}
tokenizers = {}

for short_name, hf_name in MODELS.items():
    print(f"Chargement de {short_name}...")
    tokenizers[short_name] = AutoTokenizer.from_pretrained(hf_name)
    models[short_name] = AutoModelForCausalLM.from_pretrained(
        hf_name,
        torch_dtype=torch.float32,
        device_map=DEVICE,
    )
    models[short_name].eval()
    print(f"  OK ({sum(p.numel() for p in models[short_name].parameters()) / 1e6:.1f}M paramètres)")

print("\nTous les modèles sont chargés.")

# ─────────────────────────────────────────────
# 1.2 Helper : génération avec un modèle local
# ─────────────────────────────────────────────

def generate_local(model_key, prompt, max_new_tokens=300, temperature=0.7, top_p=0.9):
    """
    Génère du texte avec un modèle local HuggingFace
    
    Args:
        model_key: Clé du modèle (SmolLM2-135M, Qwen2.5-0.5B)
        prompt: Prompt à utiliser
        max_new_tokens: Nombre max de tokens à générer
        temperature: Contrôle la créativité (0-1)
        top_p: Nucleus sampling
    
    Returns:
        Texte généré
    """
    try:
        tok = tokenizers[model_key]
        mdl = models[model_key]

        messages = [{"role": "user", "content": prompt}]
        text     = tok.apply_chat_template(messages, tokenize=False, add_generation_prompt=True)
        inputs   = tok(text, return_tensors="pt").to(DEVICE)

        with torch.no_grad():
            outputs = mdl.generate(
                **inputs,
                max_new_tokens=max_new_tokens,
                temperature=temperature,
                top_p=top_p,
                do_sample=temperature > 0,
                pad_token_id=tok.eos_token_id,
            )

        response = tok.decode(outputs[0][inputs["input_ids"].shape[1]:], skip_special_tokens=True)
        return response.strip()
    except Exception as e:
        print(f"Erreur lors de la génération avec {model_key}: {str(e)}")
        raise

# ─────────────────────────────────────────────
# 1.3 Helper : appel de l'API Groq
# ─────────────────────────────────────────────

def generate_api(prompt, model=None, max_tokens=500, temperature=0.7):
    """
    Génère du texte via l'API Groq (Llama 3.3 70B)
    
    Args:
        prompt: Prompt à utiliser
        model: Modèle à utiliser (par défaut GROQ_MODEL)
        max_tokens: Nombre max de tokens
        temperature: Créativité (0-1)
    
    Returns:
        Texte généré ou message d'erreur si API non configurée
    """
    if not API_AVAILABLE:
        return "[API Groq non configurée — ajoutez votre clé dans .env (GROQ_API_KEY)]"
    
    try:
        from openai import OpenAI
        client = OpenAI(base_url=GROQ_BASE_URL, api_key=GROQ_API_KEY)
        response = client.chat.completions.create(
            model=model or GROQ_MODEL,
            messages=[{"role": "user", "content": prompt}],
            max_tokens=max_tokens,
            temperature=temperature,
        )
        return response.choices[0].message.content.strip()
    except Exception as e:
        print(f"Erreur API Groq: {str(e)}")
        raise

# ─────────────────────────────────────────────
# 2.1 Construction du prompt CV
# ─────────────────────────────────────────────

def build_cv_prompt(data: dict) -> str:
    edu_str = "\n".join(
        f"• {e['degree']} | {e['school']} | {e['start']}–{e['end']}"
        + (f" | {e['spec']}" if e.get("spec") else "")
        for e in data.get("education", []) if e.get("degree")
    ) or "Non renseigné"

    exp_str = "\n\n".join(
        f"• {e['title']} chez {e['company']} ({e['start']} → {e['end']})\n  {e['desc']}"
        for e in data.get("experience", []) if e.get("title")
    ) or "Non renseigné"

    skills_str = " • ".join(data.get("skills", [])) or "Non renseigné"
    lang_str   = " | ".join(
        f"{l['name']} — {l['level']}" for l in data.get("languages", []) if l.get("name")
    ) or "Non renseigné"

    return f"""Tu es un expert RH spécialisé en rédaction de CV professionnels optimisés ATS.
Génère un CV complet et percutant en {data.get('outLang', 'français')}, ton {data.get('tone', 'professionnel')}.

═══════════════════════════════════════
INFORMATIONS DU CANDIDAT
═══════════════════════════════════════
Nom complet  : {data.get('firstName', '')} {data.get('lastName', '')}
Email        : {data.get('email', 'Non fourni')}
Téléphone    : {data.get('phone', 'Non fourni')}
Localisation : {data.get('location', 'Non fourni')}
{f"LinkedIn     : {data.get('linkedin')}" if data.get('linkedin') else ""}
Titre actuel : {data.get('jobTitle', '')}
{f"Profil       : {data.get('summary')}" if data.get('summary') else ""}

FORMATION :
{edu_str}

EXPÉRIENCES PROFESSIONNELLES :
{exp_str}

COMPÉTENCES TECHNIQUES :
{skills_str}

LANGUES :
{lang_str}

═══════════════════════════════════════
POSTE VISÉ
═══════════════════════════════════════
Poste        : {data.get('targetJob', '')}
{f"Entreprise   : {data.get('targetCompany')}" if data.get('targetCompany') else ""}
{f"Description du poste :\n{data.get('jobDesc')}" if data.get('jobDesc') else ""}

═══════════════════════════════════════
INSTRUCTIONS
═══════════════════════════════════════
Structure obligatoire (sections séparées par ───────────────) :
1. EN-TÊTE  2. PROFIL PROFESSIONNEL  3. EXPÉRIENCES  4. FORMATION  5. COMPÉTENCES  6. LANGUES
Verbes d'action forts, optimisé ATS pour "{data.get('targetJob', '')}"."""

# ─────────────────────────────────────────────
# 2.2 Construction du prompt Lettre de Motivation
# ─────────────────────────────────────────────

def build_lm_prompt(data: dict) -> str:
    main_exp = next((e for e in data.get("experience", []) if e.get("title")), {})
    main_edu = next((e for e in data.get("education",  []) if e.get("degree")), {})

    return f"""Tu es un expert en communication professionnelle et en recrutement.
Rédige une lettre de motivation exceptionnelle en {data.get('outLang', 'français')},
ton {data.get('tone', 'professionnel')}.

PROFIL DU CANDIDAT :
Nom             : {data.get('firstName', '')} {data.get('lastName', '')}
Formation prin. : {main_edu.get('degree', '')} — {main_edu.get('school', '')}
Expérience clé  : {main_exp.get('title', '')} chez {main_exp.get('company', '')}
Compétences     : {', '.join(data.get('skills', [])[:8])}
{f"Profil          : {data.get('summary')}" if data.get('summary') else ""}

POSTE VISÉ      : {data.get('targetJob', '')}
{f"Entreprise      : {data.get('targetCompany')}" if data.get('targetCompany') else ""}
{f"Offre d'emploi :\n{data.get('jobDesc')}" if data.get('jobDesc') else ""}

STRUCTURE :
• Paragraphe 1 — Accroche percutante (2-3 phrases)
• Paragraphe 2 — Valeur ajoutée : compétences + réalisations mesurables (3-4 phrases)
• Paragraphe 3 — Motivation spécifique pour le poste (2-3 phrases)
• Paragraphe 4 — Conclusion avec demande d'entretien

Longueur : 300-350 mots. Authentique, directe, sans clichés."""

# ─────────────────────────────────────────────
# Routes Flask — API seulement
# ─────────────────────────────────────────────

@app.route("/generate", methods=["POST"])
def generate():
    try:
        data      = request.get_json()
        doc_type  = data.get("type", "cv")
        model_key = data.get("model")

        # Validation des champs requis
        if not data.get("firstName") or not data.get("lastName"):
            return jsonify({"error": "Prénom et nom obligatoires"}), 400

        # Sélectionner le modèle par défaut si aucun n'est spécifié
        if not model_key:
            model_key = "groq" if API_AVAILABLE else next(iter(models.keys()), None)

        if not model_key:
            return jsonify({"error": "Aucun modèle disponible"}), 503

        # Construire le prompt selon le type de document
        if doc_type == "cv":
            prompt = build_cv_prompt(data)
        elif doc_type == "lm":
            prompt = build_lm_prompt(data)
        else:
            # Générer les deux documents
            prompt = build_cv_prompt(data) + "\n\n" + build_lm_prompt(data)

        # Générer le texte avec le modèle sélectionné
        if model_key == "groq":
            if not API_AVAILABLE:
                return jsonify({"error": "API Groq non configurée — ajoutez votre clé dans .env"}), 503
            result = generate_api(prompt, max_tokens=600)
        elif model_key in models:
            result = generate_local(model_key, prompt, max_new_tokens=400)
        else:
            return jsonify({"error": f"Modèle inconnu : {model_key}"}), 400

        return jsonify({
            "result": result,
            "model_used": model_key,
            "type": doc_type
        }), 200

    except Exception as e:
        print(f"Erreur dans /generate: {str(e)}")
        return jsonify({"error": f"Erreur serveur : {str(e)}"}), 500


@app.route("/models", methods=["GET"])
def list_models():
    """Retourne la liste des modèles disponibles"""
    available = list(models.keys())
    if API_AVAILABLE:
        available.insert(0, "groq")
    return jsonify({
        "models": available,
        "default": available[0] if available else None,
        "groq_available": API_AVAILABLE,
        "local_models": list(models.keys()),
        "device": DEVICE
    }), 200


@app.route("/health", methods=["GET"])
def health():
    """Endpoint de santé du serveur"""
    return jsonify({
        "status"         : "ok",
        "device"         : DEVICE,
        "torch_version"  : torch.__version__,
        "local_models"   : list(models.keys()),
        "groq_available" : API_AVAILABLE,
        "total_params"   : sum(
            sum(p.numel() for p in models[m].parameters()) / 1e6 
            for m in models.keys()
        )
    }), 200


if __name__ == "__main__":
    print("\n" + "=" * 80)
    print("  🚀 CV GENERATOR IA — BACKEND FLASK")
    print("=" * 80)
    print(f"  Serveur       : http://localhost:5000")
    print(f"  Device        : {DEVICE}")
    print(f"  Modèles locaux: {len(models)} chargés")
    for name, model_obj in models.items():
        params = sum(p.numel() for p in model_obj.parameters()) / 1e6
        print(f"    → {name}: {params:.1f}M paramètres")
    print(f"  Groq API      : {'✅ Disponible' if API_AVAILABLE else '❌ Non configurée'}")
    if not API_AVAILABLE:
        print(f"    Ajoutez votre clé Groq dans .env (variable GROQ_API_KEY)")
    print("=" * 80)
    print("  Routes disponibles:")
    print("    GET  /health    — Vérifier l'état du serveur")
    print("    GET  /models    — Lister les modèles disponibles")
    print("    POST /generate  — Générer CV ou lettre de motivation")
    print("    GET  /          — Interface web")
    print("=" * 80 + "\n")
    app.run(debug=True, port=5000, host="0.0.0.0")