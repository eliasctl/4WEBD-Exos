FROM node:20-alpine AS build

RUN apk add --no-cache python3 make g++

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY . .
RUN node swagger.js

FROM node:20-alpine

RUN apk add --no-cache libstdc++

WORKDIR /app

COPY --from=build /app .

RUN mkdir -p /app/data

EXPOSE 3002

CMD ["node", "index.js"]
