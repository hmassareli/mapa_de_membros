FROM node:22-alpine AS builder

WORKDIR /app

# Instalar TODAS as dependências (inclui devDeps para build do Vite/Tailwind)
COPY package*.json ./
RUN apk add --no-cache python3 make g++ && \
    npm ci && \
    apk del python3 make g++

# Copiar código e fazer build do frontend
COPY . .
RUN npm run build

# ---- Imagem final (só produção) ----
FROM node:22-alpine

WORKDIR /app

COPY package*.json ./
RUN apk add --no-cache python3 make g++ && \
    npm ci --omit=dev && \
    apk del python3 make g++

# Copiar código do servidor + build do frontend
COPY server.js auth.js db.js ./
COPY --from=builder /app/dist ./dist
COPY index.html ./

# Criar pasta de dados
RUN mkdir -p /app/data

# Variável de ambiente para o caminho do banco
ENV DB_PATH=/app/data/membros.db

# Porta
EXPOSE 3000

# Volume para persistir o banco SQLite
VOLUME ["/app/data"]

CMD ["node", "server.js"]
