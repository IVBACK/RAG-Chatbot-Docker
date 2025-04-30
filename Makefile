
# Auto-detect docker-compose command (V1 or V2)
ifeq (,$(shell command -v docker-compose))
    COMPOSE_CMD=docker compose
else
    COMPOSE_CMD=docker-compose
endif

# Define Compose files
COMPOSE_BASE_FILE := docker-compose.yml
COMPOSE_CPU_FILE := docker-compose.cpu.yml
COMPOSE_AMD_FILE := docker-compose.amd.yml
COMPOSE_NVIDIA_FILE := docker-compose.nvidia.yml

# Default Compose files (CPU by default)
DEFAULT_FILES := -f $(COMPOSE_BASE_FILE) -f $(COMPOSE_CPU_FILE)
CURRENT_FILES ?= $(DEFAULT_FILES)

# --- Targets for different hardware types ---

up-cpu:
	@echo "Starting services with CPU configuration..."
	$(eval CURRENT_FILES := -f $(COMPOSE_BASE_FILE) -f $(COMPOSE_CPU_FILE))
	$(COMPOSE_CMD) $(CURRENT_FILES) up -d --build

up-amd:
	@echo "Starting services with AMD ROCm configuration..."
	$(eval CURRENT_FILES := -f $(COMPOSE_BASE_FILE) -f $(COMPOSE_AMD_FILE))
	$(COMPOSE_CMD) $(CURRENT_FILES) up -d --build

up-nvidia:
	@echo "Starting services with NVIDIA CUDA configuration..."
	$(eval CURRENT_FILES := -f $(COMPOSE_BASE_FILE) -f $(COMPOSE_NVIDIA_FILE))
	$(COMPOSE_CMD) $(CURRENT_FILES) up -d --build

# Default up (CPU)
up: up-cpu

# Standard control commands

down:
	@echo "Stopping services..."
	$(COMPOSE_CMD) $(CURRENT_FILES) down

restart:
	@echo "Restarting services..."
	$(MAKE) down
	$(MAKE) up

rebuild:
	@echo "Rebuilding services..."
	$(COMPOSE_CMD) $(CURRENT_FILES) build
	$(MAKE) down
	$(MAKE) up

logs:
	@echo "Following logs..."
	$(COMPOSE_CMD) $(CURRENT_FILES) logs -f $(service)

logs-ollama:
	$(MAKE) logs service=ollama

ps:
	@echo "Listing containers..."
	$(COMPOSE_CMD) $(CURRENT_FILES) ps

# Clean everything (warning: removes volumes!)
clean:
	@echo "Cleaning containers, networks, and volumes!"
	$(COMPOSE_CMD) $(CURRENT_FILES) down -v --remove-orphans

help:
	@echo "Available commands:"
	@echo "  make up-cpu         Start services using CPU configuration"
	@echo "  make up-amd         Start services using AMD GPU configuration"
	@echo "  make up-nvidia      Start services using NVIDIA GPU configuration"
	@echo "  make up             Start services using default (CPU) configuration"
	@echo "  make down           Stop and remove containers, networks"
	@echo "  make restart        Restart services cleanly"
	@echo "  make rebuild        Rebuild and restart services"
	@echo "  make logs service=<name>  Follow logs for a specific service"
	@echo "  make logs-ollama    Shortcut for Ollama logs"
	@echo "  make ps             List running containers"
	@echo "  make clean          Remove containers, networks, volumes"
	@echo "  make help           Show this help message"

.PHONY: up up-cpu up-amd up-nvidia down restart rebuild logs logs-ollama ps clean help

# Default value for service variable used in logs target
service ?=