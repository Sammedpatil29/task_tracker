# Stage 1: Build Angular Application
FROM node:20-alpine AS build
WORKDIR /app

# Copy package files first for efficient caching
COPY package*.json ./
RUN npm install

# Copy source code and build for production
COPY . .
RUN npm run build --configuration=production

# Stage 2: Serve with Nginx
FROM nginx:alpine

# 1. Remove default Nginx config
RUN rm /etc/nginx/conf.d/default.conf

# 2. Copy custom Nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

# 3. Copy built Angular assets
COPY --from=build /app/dist/task_tracker/browser /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
