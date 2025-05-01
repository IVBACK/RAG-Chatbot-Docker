# Auto-detect docker-compose command (V1 or V2)
ifeq (,$(shell command -v docker-compose))
    COMPOSE_CMD=docker compose
else
    COMPOSE_CMD=docker-compose
endif

# Define Compose file names
COMPOSE_BASE_FILE := docker-compose.yml
COMPOSE_CPU_FILE := docker-compose.cpu.yml
COMPOSE_AMD_FILE := docker-compose.amd.yml
COMPOSE_NVIDIA_FILE := docker-compose.nvidia.yml

# State file to remember the last used hardware configuration
STATE_FILE := .make-state

# Read the last used hardware config from the state file, default to 'cpu' if not found
# Use ':=' for immediate assignment after shell execution
CURRENT_HW := $(shell cat $(STATE_FILE) 2>/dev/null || echo cpu)

# Select the appropriate docker compose files based on the current hardware config
ifeq ($(CURRENT_HW),amd)
    CURRENT_FILES := -f $(COMPOSE_BASE_FILE) -f $(COMPOSE_AMD_FILE)
else ifeq ($(CURRENT_HW),nvidia)
    CURRENT_FILES := -f $(COMPOSE_BASE_FILE) -f $(COMPOSE_NVIDIA_FILE)
else
    # Default to CPU if CURRENT_HW is 'cpu' or anything else
    CURRENT_FILES := -f $(COMPOSE_BASE_FILE) -f $(COMPOSE_CPU_FILE)
    # Ensure CURRENT_HW is explicitly 'cpu' if defaulting
    ifeq ($(CURRENT_HW),)
      CURRENT_HW := cpu
    endif
    ifeq ($(shell test -f $(STATE_FILE) || echo no),no)
      $(shell echo $(CURRENT_HW) > $(STATE_FILE))
    endif
endif

# --- Targets for different hardware types ---

up-cpu:
	@echo "Starting services with CPU configuration..."
	@echo "cpu" > $(STATE_FILE)
	$(COMPOSE_CMD) -f $(COMPOSE_BASE_FILE) -f $(COMPOSE_CPU_FILE) up -d --build

up-amd:
	@echo "Starting services with AMD ROCm configuration..."
	@echo "amd" > $(STATE_FILE)
	$(COMPOSE_CMD) -f $(COMPOSE_BASE_FILE) -f $(COMPOSE_AMD_FILE) up -d --build

up-nvidia:
	@echo "Starting services with NVIDIA CUDA configuration..."
	@echo "nvidia" > $(STATE_FILE)
	$(COMPOSE_CMD) -f $(COMPOSE_BASE_FILE) -f $(COMPOSE_NVIDIA_FILE) up -d --build

# Default up (starts with the configuration specified in .make-state, or CPU if none)
up:
	@echo "Starting services with current configuration ($(CURRENT_HW))..."
	$(COMPOSE_CMD) $(CURRENT_FILES) up -d --build

# Standard control commands (now use CURRENT_FILES based on .make-state)

down:
	@echo "Stopping services ($(CURRENT_HW) configuration)..."
	$(COMPOSE_CMD) $(CURRENT_FILES) down

restart:
	@echo "Restarting services ($(CURRENT_HW) configuration)..."
	$(MAKE) down
	$(MAKE) up

rebuild:
	@echo "Rebuilding services ($(CURRENT_HW) configuration)..."
	$(COMPOSE_CMD) $(CURRENT_FILES) build
	$(MAKE) down
	$(MAKE) up

logs:
	@echo "Following logs for ($(CURRENT_HW) configuration)..."
	$(COMPOSE_CMD) $(CURRENT_FILES) logs -f $(service)

logs-ollama:
	$(MAKE) logs service=ollama

ps:
	@echo "Listing containers for ($(CURRENT_HW) configuration)..."
	$(COMPOSE_CMD) $(CURRENT_FILES) ps

# Clean everything (warning: removes volumes!)
clean:
	@echo "Cleaning containers, networks, and volumes! ($(CURRENT_HW) configuration)"
	@echo "This will remove project volumes (database, ollama models, cache etc.)."
	$(COMPOSE_CMD) $(CURRENT_FILES) down -v --remove-orphans
	@-rm -f $(STATE_FILE) # Remove state file during clean

help:
	@echo "Available commands:"
	@echo "  make up-cpu         Start services using CPU configuration (and set as default)"
	@echo "  make up-amd         Start services using AMD GPU configuration (and set as default)"
	@echo "  make up-nvidia      Start services using NVIDIA GPU configuration (and set as default)"
	@echo "  make up             Start services using the last remembered configuration (or CPU default)"
	@echo "  make down           Stop services for the current configuration"
	@echo "  make restart        Restart services for the current configuration"
	@echo "  make rebuild        Rebuild and restart services for the current configuration"
	@echo "  make logs service=<name>  Follow logs for a specific service in the current configuration"
	@echo "  make logs-ollama    Shortcut for Ollama logs in the current configuration"
	@echo "  make ps             List running containers for the current configuration"
	@echo "  make clean          Remove containers, networks, volumes for the current configuration (WARNING: DATA LOSS)"
	@echo "  make help           Show this help message"

.PHONY: up up-cpu up-amd up-nvidia down restart rebuild logs logs-ollama ps clean help

# Default value for service variable used in logs target
service ?=