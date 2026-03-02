FROM node:22-alpine

WORKDIR /app

# Instalar dependências (build nativo do better-sqlite3)
COPY package*.json ./
RUN apk add --no-cache python3 make g++ && \
    npm ci --only=production && \
    apk del python3 make g++

# Copiar código
COPY . .

# Criar pasta de dados
RUN mkdir -p /app/data

# Variável de ambiente para o caminho do banco
ENV DB_PATH=/app/data/membros.db

# Porta
EXPOSE 3000

# Volume para persistir o banco SQLite
VOLUME ["/app/data"]

CMD ["node", "server.js"]
