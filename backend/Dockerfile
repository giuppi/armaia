FROM node:24-alpine

WORKDIR /app

COPY package*.json ./

RUN npm install --production

COPY . .

# Prepara la directory upload con ownership compatibile con USER node.
RUN mkdir -p /app/uploads && chown -R node:node /app

# FIX SICUREZZA: disattiviamo l'esecuzione come utente 'root'
USER node

EXPOSE 5000

CMD ["node", "src/server.js"]