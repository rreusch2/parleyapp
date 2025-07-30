from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from rag_agent import AdAgent
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI()

# --- CORS Middleware Setup ---
# This allows your frontend website to communicate with this backend server.
origins = [
    "https://www.predictive-play.com", # Your deployed website
    "http://localhost",
    "http://127.0.0.1",
    # You can add other origins here if needed, e.g., for local development
    "http://localhost:8080",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"], # Allows all methods (GET, POST, etc.)
    allow_headers=["*"], # Allows all headers
)
# ---------------------------

agent = AdAgent()

class ChatInput(BaseModel):
    user_input: str
    chat_history: list

@app.on_event("startup")
async def startup_event():
    logger.info("Starting up the application...")
    try:
        # 1. Load documents into the vector store and create the retriever tool
        agent.load_and_prep_docs("/home/reid/Desktop/parleyapp/adagent/docs")
        
        # 2. Setup the agent with all available tools
        agent.setup_agent()

        logger.info("Application startup and agent setup completed.")
    except Exception as e:
        logger.error(f"An error occurred during startup: {e}", exc_info=True)

@app.post("/chat")
async def chat(chat_input: ChatInput):
    try:
        response = agent.get_response(chat_input.user_input, chat_input.chat_history)
        # The response from AgentExecutor is a dict, we're interested in the 'output'
        return {"response": response.get("output")}
    except Exception as e:
        logger.error(f"An error occurred during chat processing: {e}", exc_info=True)
        return {"response": "An unexpected error occurred. Please check the server logs."}