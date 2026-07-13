FROM node:20-alpine AS dependencies
WORKDIR /app

COPY package*.json .npmrc ./
RUN npm ci

# Development target. Compose bind-mounts the source tree over /app while a
# named volume preserves these image-installed dependencies.
FROM dependencies AS development
COPY . .
EXPOSE 3001
CMD ["npm", "run", "start", "--", "--host=0.0.0.0", "--port=3001"]

FROM dependencies AS build
COPY . .
RUN npm run build:client && npm run build:server

FROM node:20-alpine AS runtime
ENV NODE_ENV=production
ENV API_HOSTNAME=http://api:8000
WORKDIR /app
COPY --from=build /app/dist /app/dist
COPY public /app/public
EXPOSE 3001
CMD ["node", "dist/server.bundle.js", "-p", "3001"]
