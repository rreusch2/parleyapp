
from fastapi import FastAPI
from pydantic import BaseModel
from rag_agent import RagAgent

app = FastAPI()
agent = RagAgent()

class ChatInput(BaseModel):
    user_input: str
    chat_history: list

@app.on_event("startup")
async def startup_event():
    # Load documents on startup
    agent.load_documents("/home/reid/Desktop/parleyapp/adagent/docs")

@app.post("/chat")
async def chat(chat_input: ChatInput):
    response = agent.get_response(chat_input.user_input, chat_input.chat_history)
    return {"response": response}
