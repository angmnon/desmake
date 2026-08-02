FROM node:20-slim

WORKDIR /app

# Install pnpm (the project's package manager)
RUN npm install -g pnpm@9

# Install deps first (cached layer). Non-frozen so a minor lockfile drift
# from the build host never fails the image build.
COPY package.json pnpm-lock.yaml ./
RUN pnpm install

# Copy the rest of the source, then build (next build + tsup -> dist/server.js)
COPY . .
RUN pnpm next build
RUN pnpm tsup src/server.ts --format cjs --platform node --target node20 --outDir dist --no-splitting --no-minify

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
ENV COZE_PROJECT_ENV=PROD

EXPOSE 3000

CMD ["node", "dist/server.js"]
