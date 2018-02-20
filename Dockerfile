FROM node:8.9-alpine

COPY . /etl

RUN cd /etl && npm i && npm run build && rm -fr src

WORKDIR /etl

CMD ["npm", "start"]