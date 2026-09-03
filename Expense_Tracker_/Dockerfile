FROM php:8.3-cli

RUN docker-php-ext-install pdo_sqlite

WORKDIR /app

COPY . .

RUN mkdir -p /app/data && chmod 775 /app/data

ENV DATA_DIR=/app/data

EXPOSE 10000

CMD ["sh", "-c", "php -S 0.0.0.0:${PORT:-10000} -t /app"]
