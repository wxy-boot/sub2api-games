from node:24-alpine

WORKDIR /app

COPY package.json ./
COPY src ./src
COPY public ./public
COPY README.md ./

ENV NODE_ENV=production
ENV PORT=8790

EXPOSE 8790

CMD ["npm", "start"]
