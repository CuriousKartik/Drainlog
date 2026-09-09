FROM node:18-alpine

WORKDIR /app

ARG NEXT_PUBLIC_API_BASE_URL=http://localhost:8000
ENV NEXT_PUBLIC_API_BASE_URL=$NEXT_PUBLIC_API_BASE_URL

COPY package.json ./
RUN npm install

COPY . ./
RUN npm run build

EXPOSE 3000

CMD ["npm", "start"]

