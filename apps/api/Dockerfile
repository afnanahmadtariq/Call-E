FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies (including devDependencies for build)
RUN npm install

# Copy source code
COPY prisma ./prisma/
COPY src ./src/
COPY tsconfig.json ./

# Generate Prisma Client
RUN npx prisma generate --schema=prisma/schema.prisma

# Build the TypeScript application
RUN npm run build

# Expose the port
EXPOSE 3001

# Start the application
CMD ["npm", "start"]
