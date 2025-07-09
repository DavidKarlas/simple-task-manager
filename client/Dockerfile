# Stage 1: Buil
FROM node:21-alpine AS builder

COPY . /stm-client
WORKDIR /stm-client/

COPY package.json /stm-client/package.json
COPY package-lock.json /stm-client/package-lock.json

RUN npm install

RUN NODE_OPTIONS="--max_old_space_size=4096" npm run build
