FROM node:8.0.0

MAINTAINER cciccia

RUN npm install nodemon  -g

# specify the working directory
WORKDIR app

RUN chmod -R 777 .

# build process
RUN npm install

# run application
CMD ["npm", "start"]