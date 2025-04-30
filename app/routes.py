# app/routes.py
import logging
from flask import Blueprint, request, jsonify, render_template, current_app
import ollama # Make sure ollama is imported

# Import from other app modules
from .ml_models import are_models_ready
from .rag_core import retrieve_context
from .utils import extract_message_content
from .config import config # Import config

# Create a Blueprint for routes
main_bp = Blueprint('main', __name__)

@main_bp.route("/")
def home():
    """Basic endpoint to check if the API is running."""
    status = "Ready" if are_models_ready() else "Initializing/Not Ready"
    return f"RAG Chatbot API is running. Model Status: {status}", 200

@main_bp.route("/chat", methods=["GET"])
def chat_ui():
    """Serves the chat interface HTML."""
    return render_template("chat.html")

@main_bp.route("/chat", methods=["POST"])
def chat_api():
    """Handles chat requests, performs RAG, and interacts with Ollama."""
    if not are_models_ready():
        logging.warning("Received /chat request before models were ready.")
        return jsonify({'error': 'Service is initializing, please try again shortly.'}), 503

    # Get message history from request
    messages = request.json.get('messages')
    if not messages or not isinstance(messages, list):
        logging.error(f"Invalid message format received: {messages}")
        return jsonify({'error': 'Messages must be a list.'}), 400

    # Extract the last user message
    user_message = ""
    for msg in reversed(messages):
        if msg.get("role") == "user":
            user_message = msg.get("content", "").strip()
            break

    if not user_message:
        logging.error("No user message found in the history or message is empty.")
        return jsonify({'error': 'User message cannot be empty.'}), 400

    logging.info(f"Processing user message: '{user_message[:100]}...'")

    # 1. Retrieve Context using RAG
    try:
        context_chunks = retrieve_context(user_message)
        context_text = "\n---\n".join(context_chunks) if context_chunks else "" # Use join for context
    except Exception as e:
         logging.exception("Error retrieving context.")
         return jsonify({'error': 'Failed to retrieve context information.'}), 500


    # Check if context is sufficient
    if not context_text or len(context_text) < 10: # Basic check
        logging.warning(f"Insufficient context found for query: '{user_message[:100]}...'")
        return jsonify({'response': "I couldn't find specific information related to your question in the available documents."})

    # 2. Prepare Prompt for Ollama
    system_prompt = f"""
You are an informational assistant. Answer questions STRICTLY based ONLY on the provided context below.
Do not add information not present in the context. Do not guess or fabricate.
Keep your answers concise and directly derived from the context.
If the question cannot be answered using the context, state "I do not have information on this topic based on the provided documents."

Context from documents:
--- BEGIN CONTEXT ---
{context_text}
--- END CONTEXT ---
    """

    # Prepare messages for Ollama (e.g., system prompt + last user message)
    ollama_messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": user_message}
        # Optionally include more history here if needed, mapping roles correctly
    ]
    logging.debug(f"Messages being sent to Ollama: {ollama_messages}")
    # 3. Call Ollama
    try:
        logging.info(f"Connecting to Ollama at {config.OLLAMA_HOST} with model {config.OLLAMA_MODEL}")
        # Consider adding a request timeout to the client
        ollama_client = ollama.Client(host=config.OLLAMA_HOST, timeout=120.0) # Example 120s timeout

        response = ollama_client.chat(
            model=config.OLLAMA_MODEL,
            messages=ollama_messages,
            options={"temperature": 0.1} # Keep temperature low for factual answers
        )
        logging.info("Received response from Ollama.")

    except Exception as ollama_error:
        logging.exception(f"Error communicating with Ollama: {ollama_error}")
        # Provide a more specific error if possible, but avoid leaking details
        error_msg = "Could not connect to the language model service."
        if "Connection refused" in str(ollama_error):
             error_msg = "Language model service is not reachable."
        elif "timed out" in str(ollama_error).lower():
             error_msg = "Language model service timed out."

        return jsonify({'error': error_msg}), 503 # Service Unavailable or appropriate code

    # 4. Process and Return Response
    response_text = extract_message_content(response)
    logging.debug(f"Raw Ollama response text: {response_text}")

    if "Error processing Ollama response" in response_text or not response_text:
         logging.error(f"Invalid or error response received/processed from Ollama. Raw: {response}")
         # Don't return the raw error to the user
         return jsonify({'response': "Sorry, I encountered an issue generating the response."})

    logging.info(f"Final response to user: '{response_text[:100]}...'")
    return jsonify({'response': response_text})


@main_bp.route("/health")
def health_check():
    """Health check endpoint for Docker and monitoring."""
    if are_models_ready():
        return jsonify({"status": "OK", "message": "Models loaded and ready."}), 200
    else:
        return jsonify({"status": "UNHEALTHY", "message": "Models are initializing or failed to load."}), 503