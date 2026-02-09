FROM node:20-alpine

WORKDIR /app

# Install dependencies based on package.json
COPY package*.json ./
RUN npm install

# Copy source code
COPY . .

# Start script
RUN chmod +x start.sh

EXPOSE 3001

CMD ["./start.sh"]
