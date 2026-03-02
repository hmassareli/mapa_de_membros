# 🗺️ Mapa de Membros - Ala Parque Industrial

Aplicação web para visualizar e gerenciar o diretório de membros da Igreja no mapa, com registro de visitas e acompanhamento de cada família.

## Funcionalidades

- **Mapa interativo** com todos os membros plotados (Leaflet + OpenStreetMap)
- **Agrupamento por família** (household) — clique no ponto para ver todos os membros
- **Cores por status**: ativo, mudou, desconhecido, aceita/não aceita visitas
- **Registro de visitas** com data, visitante, tipo e resultado
- **Filtros** por status, aceitação de visitas e interesse em retornar
- **Busca** por nome ou endereço
- **Coordenadas manuais** para famílias que o geocodificador não encontrou
- **Link direto para WhatsApp** de cada membro

## Como Usar

### 1. Instalar dependências

```bash
npm install
```

### 2. Importar os membros do JSON

```bash
node importar.js
```

O script vai:
- Ler o arquivo `members.json`
- Agrupar membros por família (household)
- Inserir no banco de dados SQLite
- Perguntar se deseja geocodificar os endereços (encontrar lat/lng)

### 3. Geocodificar endereços (opcional, se não fez no passo anterior)

```bash
node geocodificar.js
```

Usa o Nominatim (OpenStreetMap) para converter endereços em coordenadas. Demora ~1 segundo por endereço.

### 4. Iniciar o servidor

```bash
npm start
```

Acesse: **http://localhost:3000**

## Cores dos Marcadores

| Cor | Significado |
|-----|------------|
| 🟢 Verde | Ativo - Aceita Visitas |
| 🔵 Azul | Ativo - Não Contatado |
| 🟡 Amarelo | Ativo - Não Aceita Visitas |
| 🟣 Roxo | Mudou |
| ⚫ Cinza | Desconhecido |

Marcadores com **animação pulsante** = visitado nos últimos 30 dias.

## Estrutura do Projeto

```
mapa_de_membros/
├── server.js           # Servidor Express (API REST)
├── db.js               # Banco de dados SQLite
├── importar.js         # Script para importar members.json
├── geocodificar.js     # Script para geocodificar endereços
├── members.json        # Dados exportados do diretório da Igreja
├── membros.db          # Banco de dados (criado automaticamente)
├── public/
│   ├── index.html      # Página principal
│   ├── style.css       # Estilos
│   └── app.js          # JavaScript do frontend
└── package.json
```

## API REST

| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/api/familias` | Listar todas as famílias |
| GET | `/api/familias/:id` | Detalhes de uma família |
| PUT | `/api/familias/:id` | Atualizar status da família |
| POST | `/api/visitas` | Registrar nova visita |
| PUT | `/api/visitas/:id` | Atualizar visita |
| DELETE | `/api/visitas/:id` | Remover visita |
| GET | `/api/estatisticas` | Estatísticas gerais |
| POST | `/api/geocodificar/:id` | Atualizar coordenadas |

## Coordenadas Manuais

Para famílias que o geocodificador não encontrou:
1. Abra o Google Maps
2. Pesquise o endereço
3. Clique com o botão direito no local correto
4. Copie as coordenadas (ex: `-23.2237, -45.9009`)
5. No mapa, clique na família → cole as coordenadas

## Tecnologias

- **Frontend**: HTML, CSS, JavaScript, Leaflet.js
- **Backend**: Node.js, Express
- **Banco**: SQLite (better-sqlite3)
- **Mapa**: OpenStreetMap (gratuito, sem API key)
- **Geocodificação**: Nominatim (gratuito)
