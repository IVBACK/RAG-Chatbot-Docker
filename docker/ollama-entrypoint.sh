#!/bin/bash
set -e

echo "📦 Ollama Entrypoint: Starting..."

# If a main Ollama model is mounted (optional), copy it to the .ollama directory
if [ -d "/ollama/models" ]; then
    echo "🔄 External model folder found. Importing models..."
    mkdir -p /root/.ollama/models
    cp -r /ollama/models/* /root/.ollama/models/ || true
fi

# Start Ollama server in the background
echo "🚀 Starting Ollama..."
ollama serve &

pid=$!

# Wait until the API is ready
echo "⏳ Waiting for Ollama API to be ready..."
while ! curl -s --fail --silent http://localhost:11434/ > /dev/null; do
  sleep 1
done

echo "✅ Ollama API is ready. (PID: $pid)"
wait $pid
