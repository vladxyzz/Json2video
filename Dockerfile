FROM node:24-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg espeak-ng fonts-dejavu-core ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app
RUN npm install --global pnpm@11.19.0
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
ENV FFMPEG_PATH=/usr/bin/ffmpeg
RUN pnpm install --frozen-lockfile --ignore-scripts
COPY . .
RUN pnpm build && mkdir -p /app/data && chown -R node:node /app/data
ENV NODE_ENV=production HOST=0.0.0.0 PORT=3000 DATA_DIR=/app/data ESPEAK_PATH=/usr/bin/espeak-ng
USER node
EXPOSE 3000
CMD ["node", "--env-file-if-exists=.env", "server/index.js"]
