# docker/ollama.Dockerfile

# Define an ARG to specify the base image tag externally (default: latest)
ARG OLLAMA_BASE_TAG=latest
# Use the defined ARG in the FROM statement
FROM ollama/ollama:${OLLAMA_BASE_TAG}

# Install the curl package (assuming the base image is Debian-based)
# If the base is different (e.g., Fedora/UBI), use microdnf as a fallback. Add a simple fallback mechanism.
USER root
RUN apt-get update && apt-get install -y curl --no-install-recommends && rm -rf /var/lib/apt/lists/* || \
    (microdnf --version > /dev/null 2>&1 && microdnf install -y curl && microdnf clean all) || \
    (echo "Warning: curl could not be installed via apt-get or microdnf." && exit 0)

# Copy the custom entrypoint script and make it executable
COPY docker/ollama-entrypoint.sh /app/ollama-entrypoint.sh
RUN chmod +x /app/ollama-entrypoint.sh

# Set the custom entrypoint
ENTRYPOINT ["/app/ollama-entrypoint.sh"]
