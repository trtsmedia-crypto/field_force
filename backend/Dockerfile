# Build stage
FROM node:20-slim AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Run stage — smaller image, only what's needed to run
FROM node:20-slim
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
RUN npm ci --omit=dev
COPY --from=build /app/dist ./dist
COPY --from=build /app/src/db/schema.sql ./dist/db/schema.sql
COPY --from=build /app/src/db/face-schema.sql ./dist/db/face-schema.sql

EXPOSE 4000
CMD ["node", "dist/index.js"]
