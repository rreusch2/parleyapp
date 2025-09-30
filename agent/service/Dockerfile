# Professor Lock Agent Service
FROM python:3.12-slim

# Install system deps
RUN apt-get update && apt-get install -y \
    curl \
    git \
    build-essential \
    gettext-base \
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

# Copy agent directory contents
COPY . /app

# Copy Railway config template to config directory
RUN mkdir -p /app/OpenManus/config && \
    cp /app/railway.toml /app/OpenManus/config/config.toml

# Install python deps
RUN pip install --no-cache-dir -r requirements.txt

# Install Playwright browsers + deps
RUN python -m playwright install --with-deps

# Make startup script executable
RUN chmod +x /app/service/start.sh

ENV PORT=8000
EXPOSE 8000

CMD ["/app/service/start.sh"]
