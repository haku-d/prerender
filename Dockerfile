FROM node:20-alpine3.19

# Installs Chromium (100) package.
RUN apk add --no-cache \
      chromium \
      nss \
      freetype \
      harfbuzz \
      ca-certificates \
      ttf-freefont

# Install dbmate for database migrations (statically linked binary works on musl/Alpine)
RUN wget -qO /usr/local/bin/dbmate \
      https://github.com/amacneil/dbmate/releases/latest/download/dbmate-linux-amd64 \
    && chmod +x /usr/local/bin/dbmate

RUN addgroup -S pptruser && adduser -S -G pptruser pptruser \
    && mkdir -p /home/pptruser/Downloads /app \
    && chown -R pptruser:pptruser /home/pptruser \
    && chown -R pptruser:pptruser /app

# Set working directory
WORKDIR /app

COPY --chown=pptruser . .

# Set environment variables with default values
ENV PORT=8830
ENV TARGET_URL="http://localhost:4200"
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

# Install dependencies (including Puppeteer)
RUN npm ci

# RUN npm run build:ts

# Expose the Puppeteer middleware port
EXPOSE $PORT

# Run migrations then start the app
CMD ["sh", "-c", "dbmate up && npm run start"]
