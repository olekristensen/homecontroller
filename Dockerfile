# This official base image contains node.js and npm
FROM node:11.0-alpine

# Install git (alpine)
RUN apk add --no-cache \
   git \
   tzdata \
   && rm -rf /tmp/* /var/cache/*

ENV TZ Europe/Copenhagen

WORKDIR /usr/src/app

# Install app dependencies
COPY package.json ./
COPY yarn.lock ./

RUN yarn install

# Bundle app source
COPY . .

EXPOSE 3000

# Make the application run when running the container
CMD [ "yarn", "start" ]