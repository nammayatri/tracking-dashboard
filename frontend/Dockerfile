# Build stage
FROM node:18-alpine as build

WORKDIR /app

# Copy package.json and package-lock.json
COPY package*.json ./

# Use npm install instead of npm ci to handle dependency issues better
RUN npm install

# Copy all files
COPY . .

# Build-time args (Vite inlines VITE_* envs into the bundle)
ARG VITE_API_URL
ARG VITE_BASE_URL
ARG NODE_ENV=production
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_BASE_URL=$VITE_BASE_URL
ENV NODE_ENV=$NODE_ENV

# Build the app
RUN npm run build

# Set up serve for production
RUN npm install -g serve

# Expose port
EXPOSE 3000

# Start server
CMD ["serve", "-s", "dist", "-l", "3000"] 