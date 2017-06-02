FROM node:8.0.0

MAINTAINER cciccia

# add files to container
ADD . /app

# specify the working directory
WORKDIR app

RUN chmod -R 777 .

# build process
RUN npm install
RUN npm run build

# run application
CMD ["npm", "start"]