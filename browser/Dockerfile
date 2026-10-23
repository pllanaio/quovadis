# syntax=docker/dockerfile:1
FROM node:22-bookworm-slim
WORKDIR /service
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright
COPY browser/package*.json ./
RUN --mount=type=secret,id=proxy_ca sh -c 'if [ -f /run/secrets/proxy_ca ]; then export NODE_EXTRA_CA_CERTS=/run/secrets/proxy_ca; fi; npm ci --omit=dev && npx playwright install --with-deps chromium && rm -rf /var/lib/apt/lists/* /root/.npm'
COPY browser/server.mjs ./
ENV BROWSER_DATA_DIR=/browser-data
EXPOSE 3010
CMD ["node","server.mjs"]
