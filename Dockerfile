# --- Build -------------------------------------------------------------------
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
RUN npm run build

# --- Serve -------------------------------------------------------------------
FROM nginx:1.27-alpine

# nginx resmi imajı /etc/nginx/templates/*.template dosyalarındaki ${DEGISKEN}
# ifadelerini açılışta ortam değişkenleriyle doldurur.
ENV DEVICE_API_URL=http://host.docker.internal:5098 \
    RULE_API_URL=http://host.docker.internal:5165 \
    SATOPS_API_URL=http://host.docker.internal:5131 \
    USER_API_URL=http://host.docker.internal:5050 \
    LOGIN_API_URL=http://host.docker.internal:5002

COPY nginx/default.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80
