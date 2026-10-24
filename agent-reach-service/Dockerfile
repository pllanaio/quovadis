# syntax=docker/dockerfile:1
FROM python:3.12-slim-bookworm
WORKDIR /service
# Audited upstream revision; upgrades are deliberate, never performed during research.
RUN --mount=type=secret,id=proxy_ca sh -c 'if [ -f /run/secrets/proxy_ca ]; then export PIP_CERT=/run/secrets/proxy_ca; fi; pip install --no-cache-dir "https://github.com/Panniantong/Agent-Reach/archive/beabda7486e9a666360b18cdb5c0e759c2c4d20f.zip"'
RUN agent-reach skill link /opt/quovadis/skills
COPY agent-reach-service/server.py ./server.py
EXPOSE 3012
CMD ["python", "server.py"]
