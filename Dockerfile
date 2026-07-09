# Stage 1: Build the React Application and compile the Express server
FROM node:18-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

# Copy full repository
COPY . .

# Run production build (Vite static compilation + esbuild server bundling)
RUN npm run build

# Stage 2: Clean, minimal runtime image
FROM node:18-alpine AS runner

WORKDIR /app

COPY package*.json ./
# Install only production dependencies
RUN npm ci --only=production

# Copy compiled build output files
COPY --from=builder /app/dist ./dist

EXPOSE 3000

ENV NODE_ENV=production
ENV PORT=3000

CMD ["node", "dist/server.cjs"]
