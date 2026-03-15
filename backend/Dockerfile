FROM node:20-alpine

RUN apk add --no-cache openssl

WORKDIR /app

# Install ALL dependencies (dev needed for build + prisma)
COPY package.json ./
RUN npm install

# Generate Prisma client
COPY prisma ./prisma
RUN npx prisma generate

# Copy source (volumes will override in dev)
COPY . .

EXPOSE 4000

# Dev mode: tsx watch for hot reload, prisma push on startup
CMD ["sh", "-c", "npx prisma db push --skip-generate && npx tsx watch src/server.ts"]
