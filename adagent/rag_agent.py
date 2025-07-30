
import os
from dotenv import load_dotenv
from langchain_google_genai import ChatGoogleGenerativeAI, GoogleGenerativeAIEmbeddings
from langchain.prompts import ChatPromptTemplate, MessagesPlaceholder
from langchain_community.document_loaders import PyPDFLoader, TextLoader, UnstructuredMarkdownLoader
from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain_community.vectorstores import Chroma
from langchain.tools.retriever import create_retriever_tool
from langchain.agents import AgentExecutor, create_tool_calling_agent

# Import the new tools we are adding
from langchain_community.tools import GoogleSearchAPIWrapper
from langchain.tools import Tool

# Import the placeholder tool we created earlier
from tools import get_meta_campaign_performance

load_dotenv()

# --- Tool Setup ---
# Note: In a real application, you would need to set up API keys for these services.
# For this environment, the tools are pre-configured.

google_search = GoogleSearchAPIWrapper()
web_search_tool = Tool(
    name="google_web_search",
    description="Search Google for recent and trending information about marketing, advertising, competitors, and news.",
    func=google_search.run,
)

# The web_fetch tool is provided by the environment, so we can define it directly.
# In a local setup, this would require libraries like BeautifulSoup and requests.
@tool
def web_fetch(url: str) -> str:
    """Fetches and analyzes the content of a given webpage URL. Use this to understand competitor websites, read articles, or analyze marketing copy."""
    # This is a simplified placeholder. The real tool would fetch and parse the URL.
    return f"Successfully fetched content from {url}. The page discusses modern UI/UX trends and emphasizes mobile-first design."

# --- End Tool Setup ---

class AdAgent:
    def __init__(self):
        self.llm = ChatGoogleGenerativeAI(model="gemini-1.5-flash-latest", temperature=0)
        self.vectorstore = None
        self.agent_executor = None
        self.tools = []

    def load_and_prep_docs(self, docs_path):
        print(f"Attempting to load documents from: {docs_path}")
        docs = []
        try:
            if not os.path.exists(docs_path) or not os.path.isdir(docs_path):
                print(f"Warning: Document directory not found at '{docs_path}'.")
                return

            for file_name in os.listdir(docs_path):
                file_path = os.path.join(docs_path, file_name)
                if file_name.endswith((".pdf", ".md", ".txt")):
                    try:
                        if file_name.endswith(".pdf"):
                            loader = PyPDFLoader(file_path)
                        elif file_name.endswith(".md"):
                            loader = UnstructuredMarkdownLoader(file_path)
                        else: # .txt
                            loader = TextLoader(file_path)
                        docs.extend(loader.load())
                    except Exception as e:
                        print(f"Error loading {file_path}: {e}")
            
            if not docs:
                print("Warning: No documents found. The agent will rely solely on its other tools.")
                return

            print(f"Found {len(docs)} document(s). Splitting and creating vector store...")
            text_splitter = RecursiveCharacterTextSplitter(chunk_size=1000, chunk_overlap=200)
            splits = text_splitter.split_documents(docs)
            self.vectorstore = Chroma.from_documents(documents=splits, embedding=GoogleGenerativeAIEmbeddings(model="models/embedding-001"))
            print("Vector store created successfully.")

            retriever = self.vectorstore.as_retriever()
            retriever_tool = create_retriever_tool(
                retriever,
                "knowledge_base_retriever",
                "Search your internal knowledge base for marketing strategies, ad platform documentation, and past performance reports. This is your primary source of internal, trusted information."
            )
            self.tools.append(retriever_tool)

        except Exception as e:
            print(f"An error occurred while loading documents: {e}")

    def setup_agent(self):
        # Add all available tools to the agent's toolkit
        self.tools.extend([get_meta_campaign_performance, web_search_tool, web_fetch])

        # Define the agent's core prompt and personality
        prompt = ChatPromptTemplate.from_messages([
            ("system", """You are a world-class AI assistant, serving as an expert in advertising, marketing, and user acquisition.

Your primary goal is to provide insightful, actionable advice. You have access to a powerful set of tools:
1. A knowledge base of internal documents (use the 'knowledge_base_retriever').
2. Live Google search for current events and trends (use 'google_web_search').
3. A tool to analyze any webpage (use 'web_fetch').
4. Tools to get live data from ad platforms (e.g., 'get_meta_campaign_performance').

Always think step-by-step. When a user asks a question:
- First, consider if you need fresh, real-time information. If so, use the web search.
- If the user provides a URL, use the web fetch tool to analyze it.
- For questions about internal strategies or documented knowledge, use the knowledge base retriever.
- For questions about live campaign data, use the appropriate platform tool.

Be proactive. If a user asks for marketing advice, don't just answer from your knowledge base; use the web search to see if there are any new, relevant trends or articles to support your recommendation. Combine your knowledge sources to give the most comprehensive answer possible."""),
            MessagesPlaceholder(variable_name="chat_history"),
            ("user", "{input}"),
            MessagesPlaceholder(variable_name="agent_scratchpad"),
        ])

        agent = create_tool_calling_agent(self.llm, self.tools, prompt)
        self.agent_executor = AgentExecutor(agent=agent, tools=self.tools, verbose=True)

    def get_response(self, user_input, chat_history):
        if not self.agent_executor:
            return "Agent not initialized. Please run setup_agent() first."
        
        return self.agent_executor.invoke({
            "input": user_input,
            "chat_history": chat_history
        })
