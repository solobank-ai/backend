FROM node:22-alpine AS builder

RUN apk add --no-cache python3 make g++

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

FROM node:22-alpine

RUN apk add --no-cache python3 make g++ ca-certificates

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && apk del python3 make g++
COPY --from=builder /app/dist ./dist

EXPOSE 3001

CMD ["node", "dist/index.js"]
