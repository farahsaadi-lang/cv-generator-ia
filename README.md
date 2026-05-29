# CV Generator IA

**Auteure :** Farah Saadi  
**Niveau :** 2ème année Cycle Ingénieur — Spécialité SIC  
**Établissement :** ENSTAB — Année académique 2025–2026

---

## Présentation

CV Generator IA est une application web qui génère automatiquement des curriculum vitae et des lettres de motivation à partir des informations saisies par l'utilisateur. Le système repose sur l'intégration de modèles de langage de grande taille (LLM) basés sur l'architecture Transformer, accessibles soit via l'API Groq (cloud), soit déployés localement via HuggingFace Transformers.

---

## Fonctionnement

L'utilisateur remplit un formulaire guidé en cinq étapes : informations personnelles, formation, expériences professionnelles, compétences et langues, puis poste visé avec la description de l'offre. À l'étape finale, il choisit le modèle IA et lance la génération. Le résultat s'affiche directement dans l'interface et peut être exporté en `.txt` ou en `.html`.

---

## Modèles intégrés

Trois modèles sont chargés et disponibles au choix dans l'interface.

**Llama 3.3 70B via Groq** est le modèle principal. Il est accessible gratuitement via l'API Groq et génère du texte à environ 150 à 200 tokens par seconde. Il produit des documents de qualité professionnelle et constitue le choix par défaut lorsque la clé API est configurée.

**Qwen2.5-0.5B** (Alibaba Cloud, 500 millions de paramètres) et **SmolLM2-135M** (HuggingFace, 135 millions de paramètres) sont chargés localement via la bibliothèque HuggingFace Transformers avec PyTorch. Ils fonctionnent sans connexion internet et permettent de comparer les résultats entre un grand modèle cloud et des modèles légers locaux.

---

## Ingénierie des prompts

Deux prompts sont construits dynamiquement selon le type de document demandé. Chaque prompt est structuré en trois parties : un rôle expert donné au modèle, les données du candidat formatées de façon structurée, et des instructions précises sur la structure de sortie attendue. Pour le CV, la sortie est organisée en six sections (en-tête, profil, expériences, formation, compétences, langues), optimisées pour les systèmes ATS. Pour la lettre de motivation, la structure imposée est en quatre paragraphes avec une contrainte de longueur de 300 à 350 mots. Les paramètres d'inférence utilisés sont une température de 0.7 et un top-p de 0.9.

---

## Architecture

Le backend est développé en Python avec Flask et tourne sur le port 5000. Il expose trois routes : `POST /generate` pour la génération, `GET /models` pour lister les modèles disponibles, et `GET /health` pour vérifier l'état du serveur. Il sert également l'interface web directement via `GET /`.

Le frontend est développé en HTML5, CSS3 et JavaScript natif, sans framework externe. Il communique avec le backend via des requêtes HTTP asynchrones (Fetch API) et gère l'état du formulaire côté client.

---

## Lancement

```bash
# Installer les dépendances
pip install flask flask-cors python-dotenv torch transformers openai

# Configurer la clé API dans le fichier .env à la racine du projet
GROQ_API_KEY=gsk_VOTRE_CLE_ICI

# Lancer l'application
python app.py
```

L'application est accessible sur **http://localhost:5000**

La clé API Groq est gratuite sur [console.groq.com](https://console.groq.com/keys).

---

##remarque
vous trouvez un demo reel de fonctionnement déjà 
le clé ne peut pas etre public et ne peut pas etre pouuser sur github 