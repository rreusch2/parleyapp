import os
from dotenv import load_dotenv
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser
from langchain_community.document_loaders import PyPDFLoader, TextLoader, UnstructuredMarkdownLoader
from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain_community.vectorstores import Chroma
from langchain_google_genai import GoogleGenerativeAIEmbeddings
from langchain.chains.combine_documents import create_stuff_documents_chain
from langchain.chains import create_retrieval_chain
from langchain.chains import create_history_aware_retriever
from langchain_core.prompts import MessagesPlaceholder
from langchain_core.messages import HumanMessage, AIMessage

load_dotenv()

class RagAgent:
    def __init__(self):
        self.llm = ChatGoogleGenerativeAI(model="gemini-pro")
        self.vectorstore = None

    def load_documents(self, docs_path):
        docs = []
        for file_name in os.listdir(docs_path):
            file_path = os.path.join(docs_path, file_name)
            if file_name.endswith(".pdf"):
                loader = PyPDFLoader(file_path)
                docs.extend(loader.load())
            elif file_name.endswith(".md"):
                loader = UnstructuredMarkdownLoader(file_path)
                docs.extend(loader.load())
            elif file_name.endswith(".txt"):
                loader = TextLoader(file_path)
                docs.extend(loader.load())
        
        text_splitter = RecursiveCharacterTextSplitter(chunk_size=1000, chunk_overlap=200)
        splits = text_splitter.split_documents(docs)
        self.vectorstore = Chroma.from_documents(documents=splits, embedding=GoogleGenerativeAIEmbeddings(model="models/embedding-001"))

    def get_response(self, user_input, chat_history):
        if self.vectorstore is None:
            return "Please load documents first."

        retriever = self.vectorstore.as_retriever()

        ### Contextualize question ###
        contextualize_q_system_prompt = """Given a chat history and the latest user question \
        which might reference context in the chat history, formulate a standalone question \
        which can be understood without the chat history. Do NOT answer the question, \
        just reformulate it if needed and otherwise return it as is."""
        contextualize_q_prompt = ChatPromptTemplate.from_messages(
            [
                ("system", contextualize_q_system_prompt),
                MessagesPlaceholder("chat_history"),
                ("human", "{input}"),
            ]
        )
        history_aware_retriever = create_history_aware_retriever(
            self.llm, retriever, contextualize_q_prompt
        )


        ### Answer question ###
        qa_system_prompt = """You are an expert in advertising, marketing, and user acquisition for mobile applications. \
        You have access to a knowledge base of documents containing information on various advertising platforms, \
        as well as strategies for user acquisition, retention, and monetization. \
        Use the following retrieved context to answer the question. \
        If you don't know the answer, just say that you don't know. \
        Use three sentences maximum and keep the answer concise.\

        {context}"""
        qa_prompt = ChatPromptTemplate.from_messages(
            [
                ("system", qa_system_prompt),
                MessagesPlaceholder("chat_history"),
                ("human", "{input}"),
            ]
        )
        question_answer_chain = create_stuff_documents_chain(self.llm, qa_prompt)

        rag_chain = create_retrieval_chain(history_aware_retriever, question_answer_chain)

        response = rag_chain.invoke({"input": user_input, "chat_history": chat_history})
        return response["answer"]

if __name__ == '__main__':
    # Example usage
    agent = RagAgent()
    # Create a dummy docs folder and files for testing
    os.makedirs("docs", exist_ok=True)
    with open("docs/doc1.txt", "w") as f:
        f.write("This is a dummy text file for testing.")
    with open("docs/doc2.md", "w") as f:
        f.write("# This is a dummy markdown file for testing.")
        
    agent.load_documents("docs")
    chat_history = [HumanMessage(content="What are the documents about?"), AIMessage(content="They are dummy files for testing.")]
    response = agent.get_response("Tell me more.", chat_history)
    print(response)