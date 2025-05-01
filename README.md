# RAG Chatbot - Deployment Guide

## Project Description

This project implements a Retrieval-Augmented Generation (RAG) chatbot using Docker. It processes a collection of documents (provided in the `data/` directory), generates vector embeddings for the content, and stores them in a specialized database. When a user asks a question, the system retrieves relevant document chunks based on the query and uses a Large Language Model (LLM) via Ollama to generate an informed answer based solely on the retrieved context. The goal is to provide a chatbot that can ans...

---

**Core Requirements:**

* **Docker Engine:** To build and run the application containers. ([Installation Guide](https://docs.docker.com/engine/install/))
* **Docker Compose:** To manage the multi-container application defined in `docker-compose.yml`. Version 2 (`docker compose`) is recommended. ([Installation Guide](https://docs.docker.com/compose/install/))
* **Make:** To use the convenient commands provided in the `Makefile` (e.g., `make up-cpu`, `make down`). (Usually pre-installed on Linux/macOS; can be installed on Windows via tools like Chocolatey or WSL).
* **Git:** To clone the repository. ([Installation Guide](https://git-scm.com/book/en/v2/Getting-Started-Installing-Git))
* **`curl`:** Used for fetching the Ollama installation script (optional if installing Ollama on the host). (Usually pre-installed on Linux/macOS).

**Optional / Conditional Requirements:**

* **For NVIDIA GPU Acceleration:** [UNTESTED]
    * NVIDIA GPU Drivers for your specific GPU and OS.
    * NVIDIA Container Toolkit (`nvidia-docker2`).
* **For AMD GPU Acceleration:**
    * AMD GPU Drivers (e.g., AMDGPU) for your specific GPU and OS.
    * ROCm Toolkit (ensure compatibility with your GPU).
* **Ollama CLI (Optional):** Not required for running the project, but can be installed on the host machine as an *alternative method* for downloading and managing LLM models (see "Getting the LLM Model Files" section below). ([Installation Guide](https://ollama.com/download))
* **`certbot` (Production HTTPS):** Required only if you are deploying to production with a real domain and want to set up HTTPS using Let's Encrypt as described in the deployment steps.

---

## Getting the LLM Model Files

The Ollama service running inside Docker needs access to the Large Language Model files (e.g., the model specified in the `OLLAMA_MODEL` variable in your `.env` file, like `llama3.1:8b`). These models are stored in the directory mapped by the `OLLAMA_PATH` variable in your `.env` file.

Using Ollama CLI on Host Machine

1.  **Install Ollama CLI (if needed):**
    ```bash
    curl -fsSL [https://ollama.com/install.sh](https://ollama.com/install.sh) | sh
    ```
2.  **Download Model:** Use the Ollama CLI to download the desired model. This typically stores models in `/usr/share/ollama/.ollama/models` or `~/.ollama/models`.
    ```bash
    ollama run llama3.1:8b # Or the specific model you need
    ```
3.  **Find Model Path:** Locate the directory where the host Ollama stores models (e.g., `/usr/share/ollama/.ollama`).
4.  **Set `OLLAMA_PATH`:** In your `.env` file, set `OLLAMA_PATH` to the *parent* directory found in the previous step (e.g., `OLLAMA_PATH=/usr/share/ollama/.ollama`).
5.  **Stop Host Ollama Service:** **Important:** If the host Ollama service is running, you **must stop it** to avoid conflicts with the Dockerized version trying to use the same resources or ports.
    ```bash
    sudo systemctl stop ollama
    ```
---

## Project Setup

1. **Clone the Repository**:

```bash
git clone https://github.com/IVBACK/rag-chatbot-docker.git
cd rag-chatbot-docker
```

2. **Prepare Environment Variables**:

```bash
cp .env.example .env
```

Edit `.env` as needed (especially `OLLAMA_PATH` and database credentials).

---

3. ## Knowledge Base (`data/` Directory)

The `data/` directory holds the source documents that form the knowledge base for the RAG chatbot. Documents should be organized into subdirectories based on their topic or category. The names of these subdirectories are automatically used as **categories** by the system during the context retrieval process.

Place your `.txt`, `.pdf`, or `.docx` files within the appropriate category subfolder.

**Example Structure:**

```text
data/
├── about/
│   └── about.txt
├── backup/
│   └── backup.txt
├── cloud/
│   └── cloud.txt
├── datacenter/
│   └── datacenter.txt
├── milestones/
│   └── milestones.txt
├── monitoring/
│   └── monitoring.txt
├── networking/
│   └── networking.txt
├── security/
│   └── security.txt
└── system_integration/
    └── system_integration.txt
```

Ensure the subdirectory names are meaningful, as they directly influence how the RAG system filters and retrieves context.  
You can put multiple files under subdirectories.

---

## Hardware Acceleration Configuration

This project supports CPU, NVIDIA (CUDA) GPUs, and AMD (ROCm) GPUs.

1. **Host Prerequisites**:
   - **NVIDIA**: Install NVIDIA drivers and NVIDIA Container Toolkit.
   - **AMD**: Install AMD drivers and ROCm Toolkit.
   - **CPU**: No special requirements. [DEFAULT]

2. **Environment Variables**:
   Edit your `.env` file as needed:
   - `OLLAMA_IMAGE_TAG=latest` (CPU or NVIDIA)
   - `OLLAMA_IMAGE_TAG=rocm` (AMD)
   - `OLLAMA_PATH=./ollama_data` or `/usr/share/ollama/.ollama`

---

## Choose Deployment Type

### ➡️ Local Development (No Domain, No SSL)

1. **Update `/etc/hosts`**:

```bash
sudo nano /etc/hosts
```

Add:

```plaintext
127.0.0.1 sitetest.local
```

2. **Use Local Nginx Config**:
Ensure `sitetest.conf` is mounted in `docker-compose.yml`.

3. **Update `.env`**:

```plaintext
CORS_ORIGINS=http://sitetest.local
```

4. **Start Services**:
Use Makefile commands based on your hardware:

```bash
make up-cpu     # For CPU
make up-amd     # For AMD GPU
make up-nvidia  # For NVIDIA GPU
```

4. **Access**:
Visit: [http://sitetest.local/chat](http://sitetest.local/chat)

---

### ➡️ Production Deployment (Real Domain + SSL)

1. **Point your domain's A record** to your server.
2. **Update `.env`**:

```plaintext
CORS_ORIGINS=https://yourdomain.com
```

3. **Use Production Nginx Config**:
Edit `deployment/yourdomain.com.conf` and mount it.
Dont forget to replace all yourdomain.com with your actual domain.

4. **Obtain SSL Certificates**:
Dont forget to reaplace yourdomain.com with your actual domain.

```bash
sudo apt install -y certbot
sudo certbot certonly --standalone -d yourdomain.com
```

5. **Start Services**:
Use Makefile commands as per your hardware:

```bash
make up-cpu     # For CPU
make up-amd     # For AMD GPU
make up-nvidia  # For NVIDIA GPU
```

6. **Access**:
Visit: [https://yourdomain.com/chat](https://yourdomain.com/chat)

---

## Makefile Commands

| Command | Description |
|:---|:---|
| `make up-cpu` | Start services using CPU configuration |
| `make up-amd` | Start services using AMD GPU configuration |
| `make up-nvidia` | Start services using NVIDIA GPU configuration |
| `make up` | Start services with default (CPU) configuration |
| `make down` | Stop and remove services |
| `make restart` | Restart services cleanly |
| `make rebuild` | Rebuild and restart services |
| `make logs service=<service>` | Follow logs for a specific service |
| `make logs-ollama` | Shortcut for Ollama logs |
| `make ps` | List running containers |
| `make clean` | Remove containers, networks, and volumes |
| `make help` | Show available commands |

Example usage:

```bash
make up-amd
make logs service=rag-app
make down
```

---

## Third-Party Libraries

This project includes the [DOMPurify](https://github.com/cure53/DOMPurify) library (v3.2.5) to sanitize HTML input.  
DOMPurify is released under the [Apache License 2.0](https://github.com/cure53/DOMPurify/blob/main/LICENSE) and [Mozilla Public License 2.0](https://www.mozilla.org/MPL/2.0/).  
The original copyright notice and license are preserved.
