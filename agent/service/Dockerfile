# Professor Lock Agent Service
FROM python:3.12-slim

# Install system deps
RUN apt-get update && apt-get install -y \
    curl \
    git \
    build-essential \
    libnss3 \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libcups2 \
    libxkbcommon0 \
    libxcomposite1 \
    libxdamage1 \
    libxfixes3 \
    libxrandr2 \
    libgbm1 \
    libasound2 \
    libpangocairo-1.0-0 \
    libpango-1.0-0 \
    libcairo2 \
    libatspi2.0-0 \
    libdrm2 \
    fonts-liberation \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy whole repo so agent package is available
COPY . /app

# Install python deps
RUN pip install --no-cache-dir -r agent/requirements.txt

# Install Playwright browsers + deps
RUN python -m playwright install --with-deps

ENV PORT=8000
EXPOSE 8000

CMD ["uvicorn", "agent.service.server:app", "--host", "0.0.0.0", "--port", "8000"]
