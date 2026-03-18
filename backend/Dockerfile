FROM node:20-alpine

RUN apk add --no-cache openssl

WORKDIR /app

# Install ALL dependencies (dev needed for build + prisma)
COPY package.json ./
RUN npm install

# Copy all source files first
COPY . .

# Generate Prisma client from the final schema
RUN npx prisma generate

# Create uploads directory
RUN mkdir -p /app/uploads

EXPOSE 4000

# Dev mode: prisma push + generate on startup, then run server
CMD ["sh", "-c", "npx prisma generate && npx prisma db push --skip-generate --accept-data-loss && npx tsx src/server.ts"]
