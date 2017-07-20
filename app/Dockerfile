FROM node:8.0.0

MAINTAINER cciccia

RUN mkdir /src

RUN npm install nodemon sequelize-cli gulp typescript -g

# specify the working directory
WORKDIR /src/app

RUN chmod -R 777 .
ADD package.json package.json

# build process
RUN npm install

# run application
CMD ["npm", "start"]