# syntax=docker/dockerfile:1
FROM node:22-alpine
WORKDIR /app
COPY package*.json ./
RUN --mount=type=secret,id=proxy_ca sh -c 'if [ -f /run/secrets/proxy_ca ]; then export NODE_EXTRA_CA_CERTS=/run/secrets/proxy_ca; fi; npm ci'
COPY . .
RUN npm run build
EXPOSE 3000
CMD ["npm","start"]
