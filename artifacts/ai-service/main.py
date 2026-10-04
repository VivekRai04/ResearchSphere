import os
import logging
from flask import Flask, request, jsonify
from sentence_transformers import SentenceTransformer

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)

MODEL_NAME = os.getenv("MODEL_NAME", "all-mpnet-base-v2")

logger.info(f"Loading SentenceTransformer model: {MODEL_NAME}...")
try:
    model = SentenceTransformer(MODEL_NAME)
    logger.info("Model loaded successfully.")
except Exception as e:
    logger.error(f"Failed to load model: {e}")
    raise e

@app.route("/health", methods=["GET"])
def health_check():
    return jsonify({"status": "ok", "model": MODEL_NAME})

@app.route("/embed", methods=["POST"])
def generate_embedding():
    data = request.json
    if not data or 'text' not in data or not str(data['text']).strip():
        return jsonify({"detail": "Text cannot be empty"}), 400
        
    try:
        text = str(data['text'])
        embedding = model.encode(text)
        embedding_list = embedding.tolist()
        
        return jsonify({
            "embedding": embedding_list,
            "model": MODEL_NAME,
            "dimensions": len(embedding_list)
        })
    except Exception as e:
        logger.error(f"Embedding generation failed: {e}")
        return jsonify({"detail": "Failed to generate embedding"}), 500

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=8000)
