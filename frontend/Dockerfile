# STAGE 1: Compilazione del codice sorgente React/Vite
FROM node:24-alpine AS builder
WORKDIR /app

COPY package*.json ./

RUN npm install --include=dev

COPY . .
RUN npm run build

# STAGE 2: Web Server per i file statici compilati
FROM nginx:alpine

COPY --from=builder /app/dist /usr/share/nginx/html

# Configurazione Nginx con Fallback SPA (Single Page Application)
# Risolve l'errore 404 quando l'utente aggiorna manualmente una rotta (es. /libreria)
RUN echo $'server {\n\
    listen 80;\n\
    location / {\n\
    root /usr/share/nginx/html;\n\
    index index.html;\n\
    # SPA Fallback: Se la risorsa richiesta non esiste, restituisci sempre index.html\n\
    # delegando la logica di routing al frontend React\n\
    try_files $uri $uri/ /index.html;\n\
    }\n\
    }' > /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]