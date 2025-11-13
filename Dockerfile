# ---------- Stage 1: Build ----------
FROM node:24-alpine AS builder

# Set working directory
WORKDIR /app

# Copy package files first for better cache
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy rest of the source code
COPY . .

# Generate Prisma client (needed before build)
RUN npx prisma generate

# Build TypeScript to JavaScript
RUN npm run build


# ---------- Stage 2: Run ----------
FROM node:24-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

# Copy built app and package files
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package*.json ./

# Copy Prisma client (needed at runtime)
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma

# Install only production dependencies
RUN npm install --omit=dev

# Expose app port
EXPOSE 3000

# Start the app
CMD ["node", "dist/index.js"]
